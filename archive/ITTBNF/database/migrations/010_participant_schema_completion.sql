-- ============================================================================
--  Participant Schema Completion (NDIS-compliant)
--
--  Key change:
--    • Replace boolean-style “is_plan_managed” with a single ENUM field
--      representing mutually-exclusive plan-management types:
--          - plan_managed
--          - self_managed
--          - agency_managed  (default / most common)
--          - self_funded
--
--  This prevents multiple-checkbox style data-entry errors and keeps the
--  column aligned with genuine NDIS terminology.
-- ============================================================================

-- Add NDIS participant identification fields
ALTER TABLE participants ADD COLUMN IF NOT EXISTS ndis_number VARCHAR(15);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

-- --------------------------------------------------------------------------
-- 1. ENUM TYPE for plan management
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'plan_management_enum'
  ) THEN
    CREATE TYPE plan_management_enum AS ENUM (
      'plan_managed',
      'self_managed',
      'agency_managed',
      'self_funded'
    );
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 2. Add plan_management_type column (replaces funding_type / is_plan_managed)
-- --------------------------------------------------------------------------
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS plan_management_type plan_management_enum
  NOT NULL
  DEFAULT 'agency_managed';

-- --------------------------------------------------------------------------
-- 3. Additional plan manager contact fields (remain the same)
-- --------------------------------------------------------------------------
ALTER TABLE participants ADD COLUMN IF NOT EXISTS plan_manager_name VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS plan_manager_email VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS plan_manager_phone VARCHAR(20);

-- Add support coordination fields
ALTER TABLE participants ADD COLUMN IF NOT EXISTS support_coordinator_name VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS support_coordinator_email VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS support_coordinator_phone VARCHAR(20);

-- Add guardian/emergency contact fields
ALTER TABLE participants ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);

-- Add medical and support needs fields
ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_behavior_support_plan BOOLEAN DEFAULT false;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_medical_plan BOOLEAN DEFAULT false;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS medication_needs TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS mobility_needs TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS communication_needs TEXT;

-- Add consent fields
ALTER TABLE participants ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN DEFAULT false;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS transport_consent BOOLEAN DEFAULT false;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS medication_consent BOOLEAN DEFAULT false;

-- Create index on commonly searched fields
CREATE INDEX IF NOT EXISTS idx_participant_ndis_number ON participants(ndis_number);
CREATE INDEX IF NOT EXISTS idx_participant_plan_management
    ON participants(plan_management_type);

-- Update the schema version
INSERT INTO schema_migrations (version) VALUES ('010_participant_schema_completion')
ON CONFLICT DO NOTHING;
