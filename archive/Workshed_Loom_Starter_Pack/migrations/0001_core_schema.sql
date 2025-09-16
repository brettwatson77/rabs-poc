-- 0001_core_schema.sql
-- Adds core templates / calendar / loom tables and a requirements recompute function + triggers.
-- NOTE: Uses IF NOT EXISTS guards. For columns, uses DO blocks to check existence.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Filing Cabinet (minimal)
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  supervision_multiplier numeric(4,2) NOT NULL DEFAULT 1.00,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  capacity_total int NOT NULL DEFAULT 10,
  capacity_wheelchair int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL,
  description text,
  base_rate_cents int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Wall: Program Templates
CREATE TABLE IF NOT EXISTS program_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  venue_id uuid REFERENCES venues(id),
  recurrence_period_weeks smallint NOT NULL DEFAULT 2,
  day_of_week smallint NOT NULL,        -- 0..6 Monday..Sunday (adjust to your convention)
  week_in_cycle smallint NOT NULL,      -- 1 or 2
  start_time time NOT NULL,
  end_time time NOT NULL,
  pickup_runs smallint NOT NULL DEFAULT 1,
  dropoff_runs smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft', -- 'draft','active','archived'
  notes text,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_template_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  seq int NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('pickup','activity','meal','other','dropoff')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  route_run_number int NULL,
  label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_template_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_template_participant_billing (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_participant_id uuid NOT NULL REFERENCES program_template_participants(id) ON DELETE CASCADE,
  billing_code_id uuid NOT NULL REFERENCES billing_codes(id),
  hours numeric(5,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_template_requirements (
  template_id uuid PRIMARY KEY REFERENCES program_templates(id) ON DELETE CASCADE,
  participant_count int NOT NULL DEFAULT 0,
  wpu_total numeric(8,2) NOT NULL DEFAULT 0.00,
  staff_required int NOT NULL DEFAULT 0,
  vehicles_required int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Calendar (intents)
CREATE TABLE IF NOT EXISTS calendar_intents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN (
    'participant_absence','staff_absence','venue_change','time_change','program_cancellation',
    'program_reschedule','participant_transfer','billing_exception','vehicle_maintenance'
  )),
  date date NOT NULL,
  end_date date NULL,
  template_id uuid NULL REFERENCES program_templates(id),
  participant_id uuid NULL REFERENCES participants(id),
  staff_id uuid NULL REFERENCES staff(id),
  vehicle_id uuid NULL REFERENCES vehicles(id),
  permanent boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

-- Loom
CREATE TABLE IF NOT EXISTS loom_instances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  instance_staff_required int NOT NULL DEFAULT 0,
  instance_vehicles_required int NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, date)
);

CREATE TABLE IF NOT EXISTS loom_instance_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id uuid NOT NULL REFERENCES loom_instances(id) ON DELETE CASCADE,
  seq int NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('pickup','activity','meal','other','dropoff')),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  route_run_number int NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rethread queue
CREATE TABLE IF NOT EXISTS loom_rethread_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reason text NOT NULL CHECK (reason IN ('template_changed','intent_added','manual_trigger')),
  template_id uuid NULL REFERENCES program_templates(id) ON DELETE SET NULL,
  date_from date NULL,
  date_to date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  picked_at timestamptz NULL,
  status text NOT NULL DEFAULT 'queued',
  error text NULL
);

-- Requirements recompute function
CREATE OR REPLACE FUNCTION recompute_template_requirements(p_template uuid) RETURNS void AS $$
DECLARE
  v_threshold numeric := 5.0; -- default threshold if not set
  v_vehicle_capacity int := 10;
  v_participants int := 0;
  v_wpu numeric := 0.0;
  v_staff int := 0;
  v_vehicles int := 0;
  v_json jsonb;
BEGIN
  SELECT (value->>'staff_threshold_per_wpu')::numeric
  INTO v_threshold
  FROM org_settings WHERE key='staff_threshold_per_wpu';
  IF v_threshold IS NULL THEN v_threshold := 5.0; END IF;

  SELECT (value->>'default_bus_capacity')::int
  INTO v_vehicle_capacity
  FROM org_settings WHERE key='default_bus_capacity';
  IF v_vehicle_capacity IS NULL THEN v_vehicle_capacity := 10; END IF;

  SELECT COUNT(*), COALESCE(SUM(p.supervision_multiplier),0.0)
  INTO v_participants, v_wpu
  FROM program_template_participants tpp
  JOIN participants p ON p.id=tpp.participant_id
  WHERE tpp.template_id = p_template;

  v_staff := CEIL( CASE WHEN v_threshold>0 THEN v_wpu / v_threshold ELSE v_wpu / 5.0 END );
  v_vehicles := CEIL( CASE WHEN v_vehicle_capacity>0 THEN v_participants::numeric / v_vehicle_capacity ELSE v_participants::numeric / 10 END );

  INSERT INTO program_template_requirements (template_id, participant_count, wpu_total, staff_required, vehicles_required, computed_at)
  VALUES (p_template, v_participants, v_wpu, v_staff, v_vehicles, now())
  ON CONFLICT (template_id) DO UPDATE
    SET participant_count=EXCLUDED.participant_count,
        wpu_total=EXCLUDED.wpu_total,
        staff_required=EXCLUDED.staff_required,
        vehicles_required=EXCLUDED.vehicles_required,
        computed_at=now();
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep requirements fresh
CREATE OR REPLACE FUNCTION trg_tpp_recompute() RETURNS trigger AS $$
BEGIN
  PERFORM recompute_template_requirements(NEW.template_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_tpp_recompute_del() RETURNS trigger AS $$
BEGIN
  PERFORM recompute_template_requirements(OLD.template_id);
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='t_program_template_participants_aiud') THEN
    CREATE TRIGGER t_program_template_participants_aiud
    AFTER INSERT OR UPDATE ON program_template_participants
    FOR EACH ROW EXECUTE PROCEDURE trg_tpp_recompute();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='t_program_template_participants_ad') THEN
    CREATE TRIGGER t_program_template_participants_ad
    AFTER DELETE ON program_template_participants
    FOR EACH ROW EXECUTE PROCEDURE trg_tpp_recompute_del();
  END IF;
END $$;

-- Seed defaults for org_settings (safe upserts)
INSERT INTO org_settings(key, value) VALUES ('staff_threshold_per_wpu','{"staff_threshold_per_wpu":5}') ON CONFLICT (key) DO NOTHING;
INSERT INTO org_settings(key, value) VALUES ('default_bus_capacity','{"default_bus_capacity":10}') ON CONFLICT (key) DO NOTHING;

-- End 0001
