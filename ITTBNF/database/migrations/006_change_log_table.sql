-- database/migrations/006_change_log_table.sql
--
-- Migration to create the comprehensive change_log table for tracking all
-- participant and program changes throughout the system.
--
-- This table provides a complete audit trail of all changes, both permanent
-- and temporary, with support for billing impact tracking.

BEGIN;

-- Drop the table if it exists
DROP TABLE IF EXISTS change_log CASCADE;
CREATE TABLE change_log (
    -- Unique identifier for the change entry
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- When the change was recorded in the system
    change_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Type of change, e.g. PROGRAM_JOIN, PROGRAM_LEAVE, PROGRAM_CANCEL
    change_type TEXT NOT NULL,

    -- Free-form description of the change
    description TEXT NOT NULL,

    -- ID of the participant this change relates to (no FK for sandbox)
    participant_id UUID,

    -- Billing impact flags
    billing_impact BOOLEAN NOT NULL DEFAULT FALSE,
    billing_status TEXT NOT NULL DEFAULT 'NA'  -- BILLED / NOT_BILLED / PENDING / NA
);

-- Create comment
COMMENT ON TABLE change_log IS 'Comprehensive audit trail of all participant and program changes';
CREATE INDEX idx_change_log_participant_date ON change_log (participant_id, change_date);
CREATE INDEX idx_change_log_billing_impact ON change_log (billing_impact) WHERE billing_impact = TRUE;

CREATE INDEX idx_change_log_participant_type ON change_log (participant_id, change_type);
CREATE INDEX idx_change_log_billing_status ON change_log (billing_status) WHERE billing_status != 'NA';

-- Add trigger to automatically update change_date on any update
CREATE OR REPLACE FUNCTION update_change_log_change_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.change_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_change_log_change_date
BEFORE UPDATE ON change_log
FOR EACH ROW
EXECUTE FUNCTION update_change_log_change_date();

COMMIT;
