-- Migration: 011_time_slots_table.sql
-- Description: Create time slots table for dashboard cards and fix missing columns
-- 
-- This migration adds support for time-based dashboard cards by:
-- 1. Creating the tgl_loom_time_slots table to store card definitions
-- 2. Adding card_type enum for different card purposes (pickup, activity, dropoff)
-- 3. Adding proper indexes and constraints

BEGIN;

-- Step 1: Create card type enum
CREATE TYPE tgl_card_type AS ENUM (
  'PICKUP',
  'ACTIVITY',
  'DROPOFF',
  'PROGRAM'
);

-- Step 2: Create time slots table for dashboard cards
CREATE TABLE tgl_loom_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT NOT NULL,
  card_type tgl_card_type NOT NULL DEFAULT 'ACTIVITY',
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 3: Add indexes for performance
CREATE INDEX idx_time_slots_instance ON tgl_loom_time_slots(instance_id);
CREATE INDEX idx_time_slots_card_type ON tgl_loom_time_slots(card_type);

-- Step 4: Add trigger for updated_at
CREATE TRIGGER update_time_slots_updated_at
BEFORE UPDATE ON tgl_loom_time_slots
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Step 5: Add missing columns to vehicle_runs table for bus cards
ALTER TABLE tgl_loom_vehicle_runs
  ALTER COLUMN route_data SET DEFAULT '{}',
  ALTER COLUMN estimated_duration DROP NOT NULL,
  ALTER COLUMN estimated_distance DROP NOT NULL;

-- Step 6: Update audit log table to add status column if missing
-- (This fixes the "column status does not exist" error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tgl_loom_audit_log' AND column_name = 'status'
  ) THEN
    ALTER TABLE tgl_loom_audit_log ADD COLUMN status VARCHAR(20);
  END IF;
END $$;

COMMENT ON TABLE tgl_loom_time_slots IS 'Stores time slots for dashboard cards';
COMMENT ON COLUMN tgl_loom_time_slots.card_type IS 'Type of card: PICKUP, ACTIVITY, DROPOFF, PROGRAM';
COMMENT ON COLUMN tgl_loom_time_slots.label IS 'Display label for the card';
COMMENT ON COLUMN tgl_loom_time_slots.details IS 'Additional card-specific details as JSON';

COMMIT;
