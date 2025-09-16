-- Migration: Add participant plan flag columns
-- Date: 2025-09-15
-- Description: Adds boolean flags for behavior support plan, restrictive practices, and mealtime management plan

-- Check if has_behavior_support_plan exists (may already exist in some environments)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_behavior_support_plan BOOLEAN NOT NULL DEFAULT false;

-- Add restrictive practices flag
ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_restrictive_practices BOOLEAN NOT NULL DEFAULT false;

-- Add mealtime management plan flag
ALTER TABLE participants ADD COLUMN IF NOT EXISTS has_mealtime_management_plan BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the columns
COMMENT ON COLUMN participants.has_behavior_support_plan IS 'Boolean flag indicating if participant has a behavior support plan';
COMMENT ON COLUMN participants.has_restrictive_practices IS 'Boolean flag indicating if participant has restrictive practices in place';
COMMENT ON COLUMN participants.has_mealtime_management_plan IS 'Boolean flag indicating if participant has a mealtime management plan';

-- Update migrations table to record this migration
INSERT INTO migrations (name, applied_at) 
VALUES ('012_add_participant_plan_flags', NOW())
ON CONFLICT (name) DO NOTHING;
