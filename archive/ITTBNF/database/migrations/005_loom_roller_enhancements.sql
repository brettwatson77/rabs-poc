-- database/migrations/005_loom_roller_enhancements.sql
-- Migration to add required fields and tables for the loom roller service

-- Start transaction
BEGIN;

-- 1. Add missing fields to existing tables
-- Add fields to tgl_loom_instances
ALTER TABLE tgl_loom_instances 
  ADD COLUMN IF NOT EXISTS modified_by_intent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exception_id UUID,
  ADD COLUMN IF NOT EXISTS intent_id UUID,
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Add fields to tgl_loom_participant_allocations
ALTER TABLE tgl_loom_participant_allocations 
  ADD COLUMN IF NOT EXISTS intent_id UUID,
  ADD COLUMN IF NOT EXISTS exception_id UUID;

-- Add fields to tgl_loom_staff_shifts
ALTER TABLE tgl_loom_staff_shifts 
  ADD COLUMN IF NOT EXISTS intent_id UUID;

-- Add last_assigned_date and can_lead to staff
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS last_assigned_date DATE,
  ADD COLUMN IF NOT EXISTS can_lead BOOLEAN DEFAULT FALSE;

-- Add requires_transport to programs
ALTER TABLE programs 
  ADD COLUMN IF NOT EXISTS requires_transport BOOLEAN DEFAULT FALSE;

-- 2. Add window settings to settings table
INSERT INTO settings (key, value, description)
VALUES 
  ('loom_window_weeks', '4', 'Number of weeks in the loom active window (2-16)'),
  ('auto_roll_enabled', 'true', 'Whether automatic daily rolling is enabled')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Create tgl_operator_intents table for persistent operator intentions
CREATE TABLE IF NOT EXISTS tgl_operator_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intent_type TEXT NOT NULL, -- ADD_PARTICIPANT, REMOVE_PARTICIPANT, MODIFY_TIME, CHANGE_VENUE, ASSIGN_STAFF
  program_id UUID REFERENCES programs(id),
  participant_id UUID REFERENCES participants(id),
  staff_id UUID REFERENCES staff(id),
  vehicle_id UUID REFERENCES vehicles(id),
  venue_id UUID REFERENCES venues(id),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  billing_code_id UUID REFERENCES billing_codes(id),
  hours NUMERIC(5,2),
  details JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create tgl_temporal_exceptions table for one-off exceptions
CREATE TABLE IF NOT EXISTS tgl_temporal_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exception_type TEXT NOT NULL, -- PARTICIPANT_CANCELLATION, PROGRAM_CANCELLATION, ONE_OFF_CHANGE
  program_id UUID REFERENCES programs(id),
  participant_id UUID REFERENCES participants(id),
  exception_date DATE NOT NULL,
  details JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add performance indexes
-- Index on dates for window queries
CREATE INDEX IF NOT EXISTS idx_loom_instances_date ON tgl_loom_instances(date);

-- Index on intent date ranges
CREATE INDEX IF NOT EXISTS idx_operator_intents_dates ON tgl_operator_intents(start_date, end_date);

-- Index on exception dates
CREATE INDEX IF NOT EXISTS idx_temporal_exceptions_date ON tgl_temporal_exceptions(exception_date);

-- Index on staff availability (for staff assignment queries)
CREATE INDEX IF NOT EXISTS idx_staff_shifts_time_range ON tgl_loom_staff_shifts(staff_id, start_time, end_time);

-- Index on vehicle availability (for vehicle assignment queries)
CREATE INDEX IF NOT EXISTS idx_vehicle_runs_time_range ON tgl_loom_vehicle_runs(vehicle_id, start_time, end_time);

-- Add foreign key constraints for new reference columns
ALTER TABLE tgl_loom_instances 
  ADD CONSTRAINT IF NOT EXISTS fk_instance_exception 
  FOREIGN KEY (exception_id) REFERENCES tgl_temporal_exceptions(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS fk_instance_intent 
  FOREIGN KEY (intent_id) REFERENCES tgl_operator_intents(id) ON DELETE SET NULL;

ALTER TABLE tgl_loom_participant_allocations 
  ADD CONSTRAINT IF NOT EXISTS fk_allocation_exception 
  FOREIGN KEY (exception_id) REFERENCES tgl_temporal_exceptions(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS fk_allocation_intent 
  FOREIGN KEY (intent_id) REFERENCES tgl_operator_intents(id) ON DELETE SET NULL;

ALTER TABLE tgl_loom_staff_shifts 
  ADD CONSTRAINT IF NOT EXISTS fk_shift_intent 
  FOREIGN KEY (intent_id) REFERENCES tgl_operator_intents(id) ON DELETE SET NULL;

-- Commit transaction
COMMIT;
