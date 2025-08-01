-- database/migrations/005_loom_persistence_layers.sql
--
-- Migration to add persistence layers for the Loom system
-- This implements the layered persistence model with:
-- 1. tgl_operator_intents - Persistent future plans that survive window changes
-- 2. tgl_temporal_exceptions - One-off changes for specific dates
-- 3. Settings for loom auto-roll configuration

BEGIN;

-- Intent and exception type enums
CREATE TYPE tgl_intent_type AS ENUM (
  'participant_enrollment',    -- Sarah joins Centre-Based Wednesday from Oct 7
  'participant_departure',     -- John leaves Saturday Adventure from Dec 15
  'program_transfer',          -- John moves from Saturday to Sunday program
  'staff_assignment',          -- Mark assigned as lead for Bowling Tuesdays
  'venue_change',              -- Bowling moves to new venue from Oct 1
  'program_modification',      -- Centre-Based hours change from 9-3 to 9-4
  'billing_code_change',       -- Billing code changes for participant
  'resource_requirement'       -- Need wheelchair accessible vehicle
);

CREATE TYPE tgl_exception_type AS ENUM (
  'participant_absence',       -- John absent on Nov 6
  'staff_absence',            -- Mark sick on Oct 12
  'venue_unavailable',        -- Bowling alley closed Oct 31
  'program_cancellation',     -- No Bowling on Christmas Day
  'program_reschedule',       -- One-time schedule change
  'transport_change',         -- Different pickup arrangement
  'billing_exception',        -- One-time billing override
  'note'                      -- General note/comment for a date
);

-- Operator intents - persistent future plans that survive window changes
CREATE TABLE tgl_operator_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_type tgl_intent_type NOT NULL,
  
  -- Date range this intent applies to (null end_date = indefinite)
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Related entities (nullable depending on intent type)
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
  staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Flexible metadata storage for type-specific details
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- For program_modification, what fields are changed
  modified_fields JSONB,
  
  -- For billing_code_change
  billing_codes JSONB,
  
  -- Audit fields
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Validation: end_date must be after start_date if provided
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date)
);

-- Temporal exceptions - one-off changes for specific dates
CREATE TABLE tgl_temporal_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type tgl_exception_type NOT NULL,
  
  -- The specific date this exception applies to
  exception_date DATE NOT NULL,
  
  -- Related entities (nullable depending on exception type)
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL,
  staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
  venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- For linking to a specific loom instance if within window
  loom_instance_id UUID REFERENCES tgl_loom_instances(id) ON DELETE SET NULL,
  
  -- Flexible metadata storage for exception-specific details
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- For billing_exception
  billing_override JSONB,
  
  -- Reason for the exception
  reason TEXT,
  
  -- Audit fields
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add settings for loom auto-roll configuration
INSERT INTO settings (key, value, description)
VALUES 
  ('loom_window_weeks', '4', 'Size of the loom window in weeks (2-16)'),
  ('loom_auto_roll_enabled', 'true', 'Whether the daily roll happens automatically'),
  ('loom_auto_roll_time', '00:05', 'Time of day for the auto-roll (Sydney time)'),
  ('loom_verification_time', '09:00', 'Time to verify successful roll and retry if needed')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Add field to track if an instance was manually modified
ALTER TABLE tgl_loom_instances ADD COLUMN IF NOT EXISTS 
  manually_modified BOOLEAN NOT NULL DEFAULT FALSE;

-- Add field to track if a participant allocation was manually added
ALTER TABLE tgl_loom_participant_allocations ADD COLUMN IF NOT EXISTS
  manually_added BOOLEAN NOT NULL DEFAULT FALSE;

-- Add field to track if a staff shift was manually assigned
ALTER TABLE tgl_loom_staff_shifts ADD COLUMN IF NOT EXISTS
  manually_assigned BOOLEAN NOT NULL DEFAULT FALSE;

-- Add field to track if a vehicle run was manually configured
ALTER TABLE tgl_loom_vehicle_runs ADD COLUMN IF NOT EXISTS
  manually_configured BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes for efficient querying
CREATE INDEX idx_operator_intents_date_range ON tgl_operator_intents (start_date, end_date);
CREATE INDEX idx_operator_intents_program ON tgl_operator_intents (program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_operator_intents_participant ON tgl_operator_intents (participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_operator_intents_type ON tgl_operator_intents (intent_type);

CREATE INDEX idx_temporal_exceptions_date ON tgl_temporal_exceptions (exception_date);
CREATE INDEX idx_temporal_exceptions_program ON tgl_temporal_exceptions (program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_temporal_exceptions_participant ON tgl_temporal_exceptions (participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_temporal_exceptions_type ON tgl_temporal_exceptions (exception_type);
CREATE INDEX idx_temporal_exceptions_instance ON tgl_temporal_exceptions (loom_instance_id) WHERE loom_instance_id IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers to automatically update the updated_at column
CREATE TRIGGER update_operator_intents_modtime
BEFORE UPDATE ON tgl_operator_intents
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_temporal_exceptions_modtime
BEFORE UPDATE ON tgl_temporal_exceptions
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMIT;
