-- 002_rules_wall_syncrethread.sql
-- Tailored for your live DB (PostgreSQL 17). Add-only and idempotent.
-- Focus: persist-as-you-build Program Template ("rules_*") + live counters + slot definitions.
-- Requires: uuid-ossp extension available (you have uuid_generate_v4() defaults elsewhere).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Extend rules_programs with fields needed for fortnight + UI signals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rules_programs' AND column_name='week_in_cycle'
  ) THEN
    ALTER TABLE rules_programs ADD COLUMN week_in_cycle smallint DEFAULT 1;  -- 1 or 2
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rules_programs' AND column_name='pickup_runs'
  ) THEN
    ALTER TABLE rules_programs ADD COLUMN pickup_runs smallint NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rules_programs' AND column_name='dropoff_runs'
  ) THEN
    ALTER TABLE rules_programs ADD COLUMN dropoff_runs smallint NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rules_programs' AND column_name='status'
  ) THEN
    ALTER TABLE rules_programs ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;
END$$;

-- 2) Template time slots (Wall) → drives Dashboard cards via event_card_map
CREATE TABLE IF NOT EXISTS rules_program_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id uuid NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
  seq int NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('pickup','activity','meal','other','dropoff')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  route_run_number int NULL,              -- for multi-run pickup/dropoff
  label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rules_program_slots_rule ON rules_program_slots(rule_id);
CREATE INDEX IF NOT EXISTS idx_rules_program_slots_type ON rules_program_slots(slot_type);

-- 3) Template participants on the Wall (separate from legacy program_participants)
CREATE TABLE IF NOT EXISTS rules_program_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id uuid NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_rules_program_participants_rule ON rules_program_participants(rule_id);
CREATE INDEX IF NOT EXISTS idx_rules_program_participants_part ON rules_program_participants(participant_id);

-- Optional per-participant billing on the template
CREATE TABLE IF NOT EXISTS rules_program_participant_billing (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_participant_id uuid NOT NULL REFERENCES rules_program_participants(id) ON DELETE CASCADE,
  billing_code_id uuid NOT NULL REFERENCES billing_codes(id) ON DELETE RESTRICT,
  hours numeric(5,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Live requirements counters for the template (participants, WPU, staff, vehicles)
CREATE TABLE IF NOT EXISTS rules_program_requirements (
  rule_id uuid PRIMARY KEY REFERENCES rules_programs(id) ON DELETE CASCADE,
  participant_count int NOT NULL DEFAULT 0,
  wpu_total numeric(8,2) NOT NULL DEFAULT 0.00,
  staff_required int NOT NULL DEFAULT 0,
  vehicles_required int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Settings lookups (fallbacks used if not present)
-- Expect 'settings' table exists already; if you prefer org-scoped, adjust as needed.

-- 5) Recompute function + triggers (based on rules_program_participants and participants.supervision_multiplier)
CREATE OR REPLACE FUNCTION recompute_rule_requirements(p_rule uuid) RETURNS void AS $$
DECLARE
  v_threshold numeric := 5.0;     -- WPU per staff
  v_vehicle_cap int := 10;        -- participants per vehicle (MVP)
  v_participants int := 0;
  v_wpu numeric := 0.0;
  v_staff int := 0;
  v_vehicles int := 0;
BEGIN
  -- Optional: pull threshold/capacity from settings table if present
  BEGIN
    SELECT COALESCE((SELECT (value::jsonb->>'staff_threshold_per_wpu')::numeric FROM settings WHERE key='org'), 5.0)
      INTO v_threshold;
  EXCEPTION WHEN others THEN v_threshold := 5.0;
  END;
  BEGIN
    SELECT COALESCE((SELECT (value::jsonb->>'default_bus_capacity')::int FROM settings WHERE key='org'), 10)
      INTO v_vehicle_cap;
  EXCEPTION WHEN others THEN v_vehicle_cap := 10;
  END;

  SELECT COUNT(*),
         COALESCE(SUM(p.supervision_multiplier),0.0)
  INTO v_participants, v_wpu
  FROM rules_program_participants rpp
  JOIN participants p ON p.id = rpp.participant_id
  WHERE rpp.rule_id = p_rule;

  v_staff := CEIL( CASE WHEN v_threshold>0 THEN v_wpu / v_threshold ELSE v_wpu / 5.0 END );
  v_vehicles := CEIL( CASE WHEN v_vehicle_cap>0 THEN v_participants::numeric / v_vehicle_cap ELSE v_participants::numeric / 10 END );

  INSERT INTO rules_program_requirements(rule_id, participant_count, wpu_total, staff_required, vehicles_required, computed_at)
  VALUES (p_rule, v_participants, v_wpu, v_staff, v_vehicles, now())
  ON CONFLICT (rule_id) DO UPDATE
    SET participant_count = EXCLUDED.participant_count,
        wpu_total = EXCLUDED.wpu_total,
        staff_required = EXCLUDED.staff_required,
        vehicles_required = EXCLUDED.vehicles_required,
        computed_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_rpp_recompute_aiud() RETURNS trigger AS $$
BEGIN
  PERFORM recompute_rule_requirements(COALESCE(NEW.rule_id, OLD.rule_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='t_rules_program_participants_aiud') THEN
    CREATE TRIGGER t_rules_program_participants_aiud
    AFTER INSERT OR UPDATE OR DELETE ON rules_program_participants
    FOR EACH ROW EXECUTE PROCEDURE trg_rpp_recompute_aiud();
  END IF;
END$$;

-- 6) Extend rules_program_exceptions with metadata for flexible cases (e.g., short-notice cancel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='rules_program_exceptions' AND column_name='metadata'
  ) THEN
    ALTER TABLE rules_program_exceptions ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- 7) Helper view for FE summary (optional)
CREATE OR REPLACE VIEW v_rules_program_summary AS
SELECT r.id AS rule_id, r.name, r.day_of_week, r.week_in_cycle, r.start_time, r.end_time, r.venue_id,
       r.pickup_runs, r.dropoff_runs, r.status,
       COALESCE(req.participant_count,0) AS participant_count,
       COALESCE(req.wpu_total,0.0) AS wpu_total,
       COALESCE(req.staff_required,0) AS staff_required,
       COALESCE(req.vehicles_required,0) AS vehicles_required
FROM rules_programs r
LEFT JOIN rules_program_requirements req ON req.rule_id = r.id;
