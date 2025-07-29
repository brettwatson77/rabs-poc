-- Migration: 002_enhance_existing_schema.sql
-- Enhances existing SQLite schema with SCHADS columns, supervision multipliers, and other improvements

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- -------------------------------------------------------------------------
-- 1. Add SCHADS columns to staff table
-- -------------------------------------------------------------------------
ALTER TABLE staff ADD COLUMN schads_level INTEGER DEFAULT 3;
ALTER TABLE staff ADD COLUMN base_rate DECIMAL(10,2) DEFAULT 34.85;
ALTER TABLE staff ADD COLUMN apply_penalty_rates BOOLEAN DEFAULT 1;
ALTER TABLE staff ADD COLUMN timesheet_export_format TEXT DEFAULT 'xero';
ALTER TABLE staff ADD COLUMN payroll_id TEXT;

-- -------------------------------------------------------------------------
-- 2. Add supervision multiplier to participants table
-- -------------------------------------------------------------------------
ALTER TABLE participants ADD COLUMN supervision_multiplier DECIMAL(3,2) DEFAULT 1.0;

-- -------------------------------------------------------------------------
-- 3. Add shift notes completion tracking for timesheet exports
-- -------------------------------------------------------------------------
ALTER TABLE staff_assignments ADD COLUMN shift_notes_completed BOOLEAN DEFAULT 0;
ALTER TABLE staff_assignments ADD COLUMN shift_notes TEXT;

-- -------------------------------------------------------------------------
-- 4. Add time slots JSON column to program_instances
-- -------------------------------------------------------------------------
ALTER TABLE program_instances ADD COLUMN time_slots TEXT DEFAULT '["pickup", "activity", "dropoff"]';

-- -------------------------------------------------------------------------
-- 5. Add admin expense percentage to settings
-- -------------------------------------------------------------------------
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_expense_percentage', '18.0');

-- -------------------------------------------------------------------------
-- 6. Create event_card_map table for card decomposition
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_card_map (
    card_id TEXT PRIMARY KEY,
    instance_id INTEGER NOT NULL,
    card_type TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    location_coordinates TEXT,
    notes TEXT,
    metadata TEXT, -- JSON string with participants, staff, vehicle IDs
    FOREIGN KEY (instance_id) REFERENCES program_instances(id) ON DELETE CASCADE
);

-- Create index for faster card lookups by instance
CREATE INDEX IF NOT EXISTS idx_event_card_map_instance_id ON event_card_map(instance_id);
CREATE INDEX IF NOT EXISTS idx_event_card_map_card_type ON event_card_map(card_type);

-- -------------------------------------------------------------------------
-- 7. Update existing staff with SCHADS rates based on level
-- -------------------------------------------------------------------------
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

-- -------------------------------------------------------------------------
-- 8. Create quality_agent_flags table for spot audits
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quality_agent_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    flag_type TEXT NOT NULL, -- 'SPOT_AUDIT', 'QUALITY_CONCERN', etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,
    FOREIGN KEY (instance_id) REFERENCES program_instances(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- 9. Add needs_card_regeneration flag to program_instances
-- -------------------------------------------------------------------------
ALTER TABLE program_instances ADD COLUMN needs_card_regeneration BOOLEAN DEFAULT 1;

-- -------------------------------------------------------------------------
-- 10. Create traffic_delay_records for delay tracking
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS traffic_delay_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    delay_minutes INTEGER NOT NULL,
    affected_card_type TEXT NOT NULL,
    affected_run_index INTEGER,
    notification_sent BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES program_instances(id) ON DELETE CASCADE
);
