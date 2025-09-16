-- Migration: 002_add_schads_to_staff.sql
-- Adds SCHADS award level and base rate to staff table for payroll calculations

-- PostgreSQL transaction
BEGIN;

-- Add SCHADS level column (1-8 representing award levels)
ALTER TABLE staff ADD COLUMN schads_level INTEGER DEFAULT 3;

-- Add base hourly rate column
ALTER TABLE staff ADD COLUMN base_rate DECIMAL(10,2) DEFAULT 34.85;

-- Add column to track if penalty rates apply
ALTER TABLE staff ADD COLUMN apply_penalty_rates BOOLEAN DEFAULT TRUE;

-- Add column for timesheet export preferences
ALTER TABLE staff ADD COLUMN timesheet_export_format TEXT DEFAULT 'xero';

-- Add column for payroll ID/number
ALTER TABLE staff ADD COLUMN payroll_id TEXT;

-- Add comments (PostgreSQL only, will be ignored by SQLite)
COMMENT ON COLUMN staff.schads_level IS 'SCHADS award level (1-8)';
COMMENT ON COLUMN staff.base_rate IS 'Base hourly rate in AUD';
COMMENT ON COLUMN staff.apply_penalty_rates IS 'Whether to apply weekend/holiday penalty rates';
COMMENT ON COLUMN staff.timesheet_export_format IS 'Format for timesheet exports (xero, myob, etc.)';
COMMENT ON COLUMN staff.payroll_id IS 'Staff ID in the payroll system';

-- Update existing staff to SCHADS level 3 if NULL
UPDATE staff SET schads_level = 3 WHERE schads_level IS NULL;

-- Update existing staff base rate to match SCHADS level if NULL
UPDATE staff 
SET base_rate = 
    CASE schads_level
        WHEN 1 THEN 28.41
        WHEN 2 THEN 32.54
        WHEN 3 THEN 34.85
        WHEN 4 THEN 36.88
        WHEN 5 THEN 39.03
        WHEN 6 THEN 43.26
        WHEN 7 THEN 46.71
        WHEN 8 THEN 50.15
        ELSE 34.85 -- Default to level 3 if invalid
    END
WHERE base_rate IS NULL;

COMMIT;
