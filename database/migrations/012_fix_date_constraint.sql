-- Migration: 012_fix_date_constraint.sql
-- Purpose: Fix the programs date constraint to allow end_date = start_date for one-off programs
-- Date: 2025-08-04

BEGIN;

-- Step 1: Drop the existing constraint that doesn't allow end_date = start_date
ALTER TABLE programs DROP CONSTRAINT IF EXISTS valid_program_dates;

-- Step 2: Add a new constraint that allows end_date IS NULL OR end_date >= start_date
ALTER TABLE programs
  ADD CONSTRAINT valid_program_dates CHECK (end_date IS NULL OR end_date >= start_date);

-- Step 3: Add a comment explaining the constraint
COMMENT ON CONSTRAINT valid_program_dates ON programs IS 
  'Ensures program dates are valid: NULL end_date for ongoing programs, or end_date >= start_date for one-off/fixed-end programs';

-- Log the change
INSERT INTO system_logs (
  severity, 
  category, 
  message, 
  details
) VALUES (
  'info', 
  'database_migration', 
  'Fixed program date constraint', 
  'Updated valid_program_dates constraint to allow end_date = start_date for one-off programs'
);

COMMIT;
