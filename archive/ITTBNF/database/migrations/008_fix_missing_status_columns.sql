-- Migration: 008_fix_missing_status_columns.sql
-- Purpose: Add missing status and action columns that are causing server errors
-- Date: 2025-08-02

-- First, add status column to program_participants table
-- This fixes dashboard.js errors on lines 51, 120, 170
ALTER TABLE program_participants 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'completed'));

-- Add index for performance on status column
CREATE INDEX IF NOT EXISTS idx_program_participants_status ON program_participants(status);

-- Add status column to tgl_loom_instances table
-- This fixes loom instance status tracking
ALTER TABLE tgl_loom_instances 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled', 'completed', 'draft'));

-- Add index for performance on loom instances status
CREATE INDEX IF NOT EXISTS idx_tgl_loom_instances_status ON tgl_loom_instances(status);

-- Add status column to pending_enrollment_changes table
-- This fixes recalculation service errors
ALTER TABLE pending_enrollment_changes 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled'));

-- Add index for performance on pending changes status
CREATE INDEX IF NOT EXISTS idx_pending_enrollment_changes_status ON pending_enrollment_changes(status);

-- Add action column to tgl_loom_audit_log table
-- This fixes audit logging errors
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS action VARCHAR(100) NOT NULL DEFAULT 'system_event';

-- Add index for performance on audit log action
CREATE INDEX IF NOT EXISTS idx_tgl_loom_audit_log_action ON tgl_loom_audit_log(action);

-- Create program_enrollments table if it doesn't exist
-- This is needed by the recalculation service
CREATE TABLE IF NOT EXISTS program_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL,
    program_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_program_enrollments_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_program_enrollments_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Create index on participant_id and program_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_program_enrollments_participant ON program_enrollments(participant_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_dates ON program_enrollments(start_date, end_date);

-- Create pending_enrollment_changes table if it doesn't exist
-- This is needed by the recalculation service
CREATE TABLE IF NOT EXISTS pending_enrollment_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL,
    program_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('add', 'remove')),
    effective_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pending_changes_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_changes_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Create index on effective_date for quick lookups
CREATE INDEX IF NOT EXISTS idx_pending_changes_effective_date ON pending_enrollment_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_enrollment_changes(status);

-- Add category column to tgl_loom_audit_log
-- This helps with filtering and organizing audit logs
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'system';

-- Add severity column to tgl_loom_audit_log
-- This helps with filtering critical vs informational logs
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'));

-- Add timestamp column to tgl_loom_audit_log if it doesn't exist
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add related_entity_id column to tgl_loom_audit_log
-- This allows linking logs to specific entities (participants, programs, etc.)
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS related_entity_id UUID;

-- Add related_entity_type column to tgl_loom_audit_log
ALTER TABLE tgl_loom_audit_log 
ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50);

-- Create composite index for efficient audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON tgl_loom_audit_log(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity_timestamp ON tgl_loom_audit_log(severity, timestamp);
