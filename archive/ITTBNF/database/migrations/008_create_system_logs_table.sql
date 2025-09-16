-- Migration: 008_create_system_logs_table.sql
-- Creates the system_logs table for storing application events, errors, and operational logs
-- with structured data support and efficient indexing for the loom system

-- Create the system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  category TEXT NOT NULL CHECK (category IN ('RESOURCE', 'OPTIMIZATION', 'CONSTRAINT', 'SYSTEM', 'OPERATIONAL', 'FINANCIAL')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  affected_entities JSONB DEFAULT '[]',
  resolution_required BOOLEAN NOT NULL DEFAULT FALSE,
  resolution_suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs (severity);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs (category);
CREATE INDEX IF NOT EXISTS idx_system_logs_resolution_required ON system_logs (resolution_required) WHERE resolution_required = TRUE;
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp_severity ON system_logs (timestamp DESC, severity);

-- Add table and column comments
COMMENT ON TABLE system_logs IS 'Stores system events, errors, and operational logs with structured data';
COMMENT ON COLUMN system_logs.id IS 'Unique identifier for the log entry';
COMMENT ON COLUMN system_logs.timestamp IS 'When the event occurred';
COMMENT ON COLUMN system_logs.severity IS 'Log severity level: INFO, WARN, ERROR, CRITICAL';
COMMENT ON COLUMN system_logs.category IS 'Log category: RESOURCE, OPTIMIZATION, CONSTRAINT, SYSTEM, OPERATIONAL, FINANCIAL';
COMMENT ON COLUMN system_logs.message IS 'Human-readable log message';
COMMENT ON COLUMN system_logs.details IS 'Additional structured details as JSON';
COMMENT ON COLUMN system_logs.affected_entities IS 'Array of entities affected by this event';
COMMENT ON COLUMN system_logs.resolution_required IS 'Whether this log requires operator resolution';
COMMENT ON COLUMN system_logs.resolution_suggestions IS 'Suggested actions for resolution';
