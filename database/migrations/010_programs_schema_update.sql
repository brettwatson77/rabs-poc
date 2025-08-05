-- Migration: 010_programs_schema_update.sql
-- Description: Update programs table to support the real RABS workflow
-- 
-- This migration enhances the programs table to support:
-- 1. Proper repeating patterns (weekly, fortnightly, monthly)
-- 2. Multiple days of week (for programs that run on multiple days)
-- 3. Time slots for dashboard cards (pickups, activities, dropoffs)
-- 4. Staff assignment modes (auto vs manual)
-- 5. Start/end dates for program lifecycle

BEGIN;

-- Step 1: Add missing columns that the program creation needs
ALTER TABLE programs 
  -- Program type (community_access, training, etc.)
  ADD COLUMN program_type VARCHAR(50) DEFAULT 'community_access',
  
  -- Start/end dates (for one-off vs recurring)
  ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN end_date DATE, -- NULL = no end date
  
  -- Repeating pattern (none, weekly, fortnightly, monthly)
  ADD COLUMN repeat_pattern VARCHAR(20) DEFAULT 'weekly',
  
  -- Time slots array (for dashboard cards)
  ADD COLUMN time_slots JSONB DEFAULT '[]',
  
  -- Program notes
  ADD COLUMN notes TEXT,
  
  -- Staff assignment settings
  ADD COLUMN staff_assignment_mode VARCHAR(20) DEFAULT 'auto',
  ADD COLUMN additional_staff_count INTEGER DEFAULT 0,
  
  -- Created by
  ADD COLUMN created_by TEXT;

-- Step 2: Convert day_of_week to days_of_week JSONB
-- First add the new column
ALTER TABLE programs ADD COLUMN days_of_week JSONB DEFAULT '[]';

-- Then migrate existing data
UPDATE programs 
SET days_of_week = CASE 
  WHEN day_of_week IS NOT NULL THEN json_build_array(day_of_week)::jsonb
  ELSE '[]'::jsonb
END;

-- Step 3: Add constraints and documentation
COMMENT ON COLUMN programs.program_type IS 'Type of program (community_access, training, etc.)';
COMMENT ON COLUMN programs.start_date IS 'Date when program starts';
COMMENT ON COLUMN programs.end_date IS 'Date when program ends (NULL = no end date)';
COMMENT ON COLUMN programs.repeat_pattern IS 'How program repeats: none (one-off), weekly, fortnightly, monthly';
COMMENT ON COLUMN programs.days_of_week IS 'Array of days this program runs on (0=Sunday, 1=Monday, etc.)';
COMMENT ON COLUMN programs.time_slots IS 'Array of time slots with activities for dashboard cards';
COMMENT ON COLUMN programs.staff_assignment_mode IS 'How staff are assigned: auto (by loom) or manual (fixed)';
COMMENT ON COLUMN programs.additional_staff_count IS 'Extra staff beyond the 1:4 ratio';

-- Step 4: Add constraints to ensure data integrity
ALTER TABLE programs
  ADD CONSTRAINT valid_program_dates CHECK (end_date IS NULL OR end_date > start_date),
  ADD CONSTRAINT valid_repeat_pattern CHECK (repeat_pattern IN ('none', 'weekly', 'fortnightly', 'monthly')),
  ADD CONSTRAINT valid_staff_assignment_mode CHECK (staff_assignment_mode IN ('auto', 'manual'));

-- Step 5: Create index for faster date-based lookups
CREATE INDEX idx_programs_dates ON programs (start_date, end_date);
CREATE INDEX idx_programs_active ON programs (active);

-- Step 6: Mark day_of_week as deprecated (keep for backward compatibility)
COMMENT ON COLUMN programs.day_of_week IS 'DEPRECATED: Use days_of_week JSONB array instead';
COMMENT ON COLUMN programs.recurring IS 'DEPRECATED: Use repeat_pattern instead (none = false, anything else = true)';

-- Update recurring field based on repeat_pattern for consistency
UPDATE programs SET recurring = (repeat_pattern != 'none');

COMMIT;
