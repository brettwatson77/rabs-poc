-- database/migrations/007_vehicle_staff_availability.sql
--
-- Migration to add vehicle maintenance scheduling and staff unavailability management
-- Also enhances participant allocations to support multiple billing codes per participant

BEGIN;

-- ============================================================================
-- VEHICLE BLACKOUTS TABLE
-- For tracking vehicle maintenance, repairs, and other unavailability periods
-- ============================================================================
DROP TABLE IF EXISTS vehicle_blackouts CASCADE;

CREATE TABLE vehicle_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure end_time is after start_time
  CONSTRAINT valid_blackout_timerange CHECK (end_time > start_time)
);

COMMENT ON TABLE vehicle_blackouts IS 'Tracks periods when vehicles are unavailable (maintenance, repairs, etc.)';

-- Create indexes for performance
CREATE INDEX idx_vehicle_blackouts_vehicle ON vehicle_blackouts(vehicle_id);
CREATE INDEX idx_vehicle_blackouts_timerange ON vehicle_blackouts(start_time, end_time);
-- Active blackout index (removed NOW() predicate for immutability)
CREATE INDEX idx_vehicle_blackouts_active ON vehicle_blackouts(vehicle_id, start_time, end_time);

-- ============================================================================
-- STAFF UNAVAILABILITIES TABLE
-- For tracking staff leave, sickness, training, and other unavailability periods
-- ============================================================================
DROP TABLE IF EXISTS staff_unavailabilities CASCADE;

CREATE TABLE staff_unavailabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure end_time is after start_time
  CONSTRAINT valid_unavailability_timerange CHECK (end_time > start_time)
);

COMMENT ON TABLE staff_unavailabilities IS 'Tracks periods when staff are unavailable (sick leave, annual leave, training, etc.)';

-- Create indexes for performance
CREATE INDEX idx_staff_unavailabilities_staff ON staff_unavailabilities(staff_id);
CREATE INDEX idx_staff_unavailabilities_timerange ON staff_unavailabilities(start_time, end_time);
-- Active unavailability index (removed NOW() predicate for immutability)
CREATE INDEX idx_staff_unavailabilities_active ON staff_unavailabilities(staff_id, start_time, end_time);

-- ============================================================================
-- ENHANCE PARTICIPANT ALLOCATIONS
-- Add support for multiple billing codes per participant with individual hours
-- ============================================================================

-- Add billing_codes JSONB column to store multiple codes with their hours
ALTER TABLE tgl_loom_participant_allocations
ADD COLUMN billing_codes JSONB DEFAULT '[]'::jsonb;

-- Add hours column for total participant hours
ALTER TABLE tgl_loom_participant_allocations
ADD COLUMN hours NUMERIC(5,2) DEFAULT 0;

-- Make billing_code_id nullable for backward compatibility
ALTER TABLE tgl_loom_participant_allocations
ALTER COLUMN billing_code_id DROP NOT NULL;

COMMENT ON COLUMN tgl_loom_participant_allocations.billing_codes IS 'Array of billing code objects with code, hours, and rate';
COMMENT ON COLUMN tgl_loom_participant_allocations.hours IS 'Total hours for this participant allocation';

-- Create index for JSONB billing_codes
CREATE INDEX idx_participant_allocations_billing_codes ON tgl_loom_participant_allocations USING GIN(billing_codes);

-- ============================================================================
-- SAFETY: Ensure the timestamp update helper exists
-- ============================================================================

-- Create function if it doesn't exist to keep updated_at current
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Create trigger for vehicle_blackouts
CREATE TRIGGER update_vehicle_blackouts_modtime
BEFORE UPDATE ON vehicle_blackouts
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create trigger for staff_unavailabilities
CREATE TRIGGER update_staff_unavailabilities_modtime
BEFORE UPDATE ON staff_unavailabilities
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMIT;
