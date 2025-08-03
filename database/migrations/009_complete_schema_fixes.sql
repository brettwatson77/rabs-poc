-- Migration: 009_complete_schema_fixes.sql
-- Purpose: Fix ALL remaining schema issues causing server errors
-- Date: 2025-08-02

-- ============================================================================
-- 1. Fix vehicles table - missing status column
-- ============================================================================

-- Add status column to vehicles table (fixes dashboard.js errors)
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'maintenance', 'inactive', 'retired', 'pending'));

-- Add index for performance on vehicle status
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);

-- ============================================================================
-- 2. Fix tgl_loom_audit_log table - missing details column
-- ============================================================================

-- Add details column to tgl_loom_audit_log (fixes loom configuration updates)
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

-- Add index for JSON querying on details
CREATE INDEX IF NOT EXISTS idx_tgl_loom_audit_log_details_gin ON tgl_loom_audit_log USING GIN (details);

-- ============================================================================
-- 3. Fix staff table - add status for consistency
-- ============================================================================

-- Add status column to staff table for consistency
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'leave', 'inactive', 'terminated', 'pending'));

-- Add index for performance on staff status
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);

-- ============================================================================
-- 4. Fix programs table - add status for consistency
-- ============================================================================

-- Add status column to programs table for consistency
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'cancelled', 'completed', 'draft', 'pending'));

-- Add index for performance on program status
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);

-- ============================================================================
-- 5. Add message column to tgl_loom_audit_log for human-readable messages
-- ============================================================================

-- Add message column to tgl_loom_audit_log for human-readable messages
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS message TEXT;

-- ============================================================================
-- 6. Add status to venues table for consistency
-- ============================================================================

-- Add status column to venues table for consistency
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'inactive', 'maintenance', 'closed'));

-- Add index for performance on venue status
CREATE INDEX IF NOT EXISTS idx_venues_status ON venues(status);

-- ============================================================================
-- 7. Fix any other tables that dashboard might query
-- ============================================================================

-- Add status to cards table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cards') THEN
        ALTER TABLE cards 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
        
        CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
    END IF;
END $$;

-- Add status to events table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events') THEN
        ALTER TABLE events 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
        
        CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    END IF;
END $$;

-- ============================================================================
-- 8. Add data_json column to tgl_loom_instances for flexible data storage
-- ============================================================================

-- Add data_json column to tgl_loom_instances for flexible data storage
ALTER TABLE tgl_loom_instances 
ADD COLUMN IF NOT EXISTS data_json JSONB DEFAULT '{}';

-- Add index for JSON querying
CREATE INDEX IF NOT EXISTS idx_tgl_loom_instances_data_gin ON tgl_loom_instances USING GIN (data_json);

-- ============================================================================
-- 9. Add metadata columns to all core tables for better tracking
-- ============================================================================

-- Add metadata columns to participants table
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add metadata columns to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add metadata columns to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add metadata columns to venues table
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add metadata columns to programs table
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 10. Add user_id to audit log for tracking who made changes
-- ============================================================================

-- Add user_id column to tgl_loom_audit_log
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index for efficient user activity queries
CREATE INDEX IF NOT EXISTS idx_tgl_loom_audit_log_user ON tgl_loom_audit_log(user_id);

-- ============================================================================
-- 11. Add missing fields to tgl_settings table
-- ============================================================================

-- Add description column to tgl_settings
ALTER TABLE tgl_settings 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add category column to tgl_settings for grouping
ALTER TABLE tgl_settings 
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general';

-- Create index for efficient settings queries by category
CREATE INDEX IF NOT EXISTS idx_tgl_settings_category ON tgl_settings(category);
