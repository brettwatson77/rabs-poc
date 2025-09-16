-- 001_tgl_core.sql
-- TGL (The Great Loom) Core Schema Migration
-- Creates the foundational tables for Rules → Loom → History Ribbon architecture

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation
-- CREATE EXTENSION IF NOT EXISTS "pgvector";   -- For vector embeddings in history tags

-- =============================================================================
-- TGL Configuration
-- =============================================================================
CREATE TABLE tgl_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Insert default configuration values
INSERT INTO tgl_config (key, value, description) VALUES
    ('LOOM_DURATION_WEEKS', '6', 'Number of weeks in the projection window'),
    ('HISTORY_RETENTION_DAYS', '730', 'Days to keep detailed history (2 years)'),
    ('PAYMENT_PYTHON_RETENTION_DAYS', '90', 'Days to keep diamonds in Payment Python before fading to History'),
    ('QUALITY_AUDIT_PERCENTAGE', '5', 'Percentage of shifts to flag for quality audits (0-100)');

-- =============================================================================
-- RULES TABLES (The Unwoven Future)
-- =============================================================================

-- Programs/Templates (recurring schedule patterns)
CREATE TABLE rules_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue_id UUID,
    is_recurring BOOLEAN DEFAULT TRUE,
    recurrence_pattern TEXT DEFAULT 'weekly', -- 'weekly', 'fortnightly', 'monthly'
    transport_required BOOLEAN DEFAULT TRUE,
    staffing_ratio TEXT DEFAULT '1:4', -- Staff:Participant ratio
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Program exceptions (holidays, special events)
CREATE TABLE rules_program_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    exception_type TEXT NOT NULL, -- 'cancelled', 'modified', 'added'
    start_time TIME,
    end_time TIME,
    venue_id UUID,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (program_id, exception_date)
);

-- Participant schedule rules (recurring enrollments)
CREATE TABLE rules_participant_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if ongoing
    pickup_required BOOLEAN DEFAULT TRUE,
    dropoff_required BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (participant_id, program_id, start_date)
);

-- Staff roster rules (recurring assignments)
CREATE TABLE rules_staff_roster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL,
    program_id UUID NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'support', -- 'lead', 'support', 'driver'
    start_date DATE NOT NULL,
    end_date DATE, -- NULL if ongoing
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (staff_id, program_id, start_date)
);

-- =============================================================================
-- LOOM TABLES (The Projection Window)
-- =============================================================================

-- Loom instances (concrete projected events)
CREATE TABLE loom_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_rule_id UUID NOT NULL REFERENCES rules_programs(id),
    instance_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue_id UUID,
    transport_required BOOLEAN DEFAULT TRUE,
    staffing_ratio TEXT DEFAULT '1:4',
    is_overridden BOOLEAN DEFAULT FALSE, -- Flag for temporary changes
    override_source TEXT, -- Who made the override
    override_reason TEXT, -- Why the override was made
    quality_audit_flag BOOLEAN DEFAULT FALSE, -- For Quality Agent
    projection_hash TEXT, -- Hash of source rule at projection time
    projected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_rule_id, instance_date)
);

-- Create index for date range queries (critical for Loom window)
CREATE INDEX idx_loom_instances_date ON loom_instances (instance_date);

-- Loom participant attendance
CREATE TABLE loom_participant_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loom_instance_id UUID NOT NULL REFERENCES loom_instances(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    source_rule_id UUID REFERENCES rules_participant_schedule(id),
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'attended', 'cancelled', 'no-show'
    is_overridden BOOLEAN DEFAULT FALSE,
    override_source TEXT,
    override_reason TEXT,
    pickup_required BOOLEAN DEFAULT TRUE,
    dropoff_required BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loom_instance_id, participant_id)
);

-- Loom staff assignments
CREATE TABLE loom_staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loom_instance_id UUID NOT NULL REFERENCES loom_instances(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL,
    source_rule_id UUID REFERENCES rules_staff_roster(id),
    role TEXT NOT NULL DEFAULT 'support', -- 'lead', 'support', 'driver'
    is_overridden BOOLEAN DEFAULT FALSE,
    override_source TEXT,
    override_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loom_instance_id, staff_id)
);

-- Loom vehicle assignments (compatible with Dynamic Resource System)
CREATE TABLE loom_vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loom_instance_id UUID NOT NULL REFERENCES loom_instances(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL,
    driver_staff_id UUID,
    is_overridden BOOLEAN DEFAULT FALSE,
    override_source TEXT,
    override_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loom_instance_id, vehicle_id)
);

-- =============================================================================
-- HISTORY RIBBON TABLES (The Woven Past)
-- =============================================================================

-- History Ribbon main table (immutable completed shifts)
CREATE TABLE history_ribbon_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_loom_id UUID NOT NULL, -- Reference to original loom instance
    program_name TEXT NOT NULL,
    program_description TEXT,
    instance_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue_name TEXT NOT NULL,
    venue_address TEXT,
    participant_count INTEGER NOT NULL,
    staff_count INTEGER NOT NULL,
    vehicle_count INTEGER NOT NULL,
    completion_status TEXT NOT NULL, -- 'completed', 'cancelled', 'partial'
    woven_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived BOOLEAN DEFAULT FALSE -- Set to TRUE after retention period
);

-- Create index for date queries on History Ribbon
CREATE INDEX idx_history_ribbon_date ON history_ribbon_shifts (instance_date);

-- History Ribbon participants (who attended)
CREATE TABLE history_ribbon_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_shift_id UUID NOT NULL REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    participant_name TEXT NOT NULL, -- Denormalized for immutability
    attendance_status TEXT NOT NULL, -- 'attended', 'cancelled', 'no-show'
    pickup_provided BOOLEAN,
    dropoff_provided BOOLEAN,
    notes TEXT
);

-- History Ribbon staff (who worked)
CREATE TABLE history_ribbon_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_shift_id UUID NOT NULL REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL,
    staff_name TEXT NOT NULL, -- Denormalized for immutability
    role TEXT NOT NULL,
    hours_worked NUMERIC(5,2) NOT NULL,
    notes TEXT
);

-- Vector tags for history items (searchable metadata)
CREATE TABLE history_ribbon_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_shift_id UUID NOT NULL REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE,
    tag_key TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    embedding vector(768), -- For semantic search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX idx_history_ribbon_tags_embedding ON history_ribbon_tags USING ivfflat (embedding vector_cosine_ops);

-- Pinned artifacts (notes, incidents, etc.)
CREATE TABLE history_pinned_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_shift_id UUID NOT NULL REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL, -- 'note', 'incident', 'photo', 'feedback', etc.
    title TEXT NOT NULL,
    content TEXT,
    severity TEXT, -- For incidents: 'low', 'medium', 'high', 'critical'
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    embedding vector(768) -- For semantic search
);

-- Create index for artifact type queries
CREATE INDEX idx_history_pinned_artifacts_type ON history_pinned_artifacts (artifact_type);

-- =============================================================================
-- PAYMENT PYTHON TABLES (Financial Lifecycle)
-- =============================================================================

-- Payment diamonds (financial lifecycle tracking)
CREATE TABLE payment_diamonds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_shift_id UUID NOT NULL REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    support_item_number TEXT NOT NULL, -- NDIS code
    unit_price NUMERIC(10,2) NOT NULL,
    quantity NUMERIC(6,2) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    gst_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed' (red), 'invoiced' (yellow), 'paid' (green)
    invoice_number TEXT,
    invoice_date DATE,
    payment_date DATE,
    retention_end_date DATE, -- When diamond fades to History
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for financial status queries
CREATE INDEX idx_payment_diamonds_status ON payment_diamonds (status);

-- =============================================================================
-- EVENT CARD MAPPING TABLE (For UI Decomposition)
-- =============================================================================

-- Maps loom instances to UI cards (dashboard, roster, etc.)
CREATE TABLE event_card_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loom_instance_id UUID NOT NULL REFERENCES loom_instances(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL, -- 'pickup', 'activity', 'dropoff', 'roster'
    card_order INTEGER NOT NULL, -- Order in the sequence
    display_title TEXT NOT NULL,
    display_subtitle TEXT,
    display_time_start TIMESTAMP WITH TIME ZONE NOT NULL,
    display_time_end TIMESTAMP WITH TIME ZONE NOT NULL,
    card_color TEXT, -- CSS color or theme key
    card_icon TEXT, -- Icon identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for loom instance queries
CREATE INDEX idx_event_card_map_loom ON event_card_map (loom_instance_id);

-- =============================================================================
-- TRIGGERS & FUNCTIONS
-- =============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_rules_programs_timestamp
BEFORE UPDATE ON rules_programs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_rules_program_exceptions_timestamp
BEFORE UPDATE ON rules_program_exceptions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_rules_participant_schedule_timestamp
BEFORE UPDATE ON rules_participant_schedule
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_rules_staff_roster_timestamp
BEFORE UPDATE ON rules_staff_roster
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_loom_instances_timestamp
BEFORE UPDATE ON loom_instances
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_loom_participant_attendance_timestamp
BEFORE UPDATE ON loom_participant_attendance
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_loom_staff_assignments_timestamp
BEFORE UPDATE ON loom_staff_assignments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_loom_vehicle_assignments_timestamp
BEFORE UPDATE ON loom_vehicle_assignments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_payment_diamonds_timestamp
BEFORE UPDATE ON payment_diamonds
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Function to set retention_end_date when payment status changes to 'paid'
CREATE OR REPLACE FUNCTION set_diamond_retention_date()
RETURNS TRIGGER AS $$
DECLARE
    retention_days INTEGER;
BEGIN
    IF NEW.status = 'paid' AND (OLD.status != 'paid' OR OLD.status IS NULL) THEN
        -- Get retention days from config
        SELECT CAST(value AS INTEGER) INTO retention_days
        FROM tgl_config
        WHERE key = 'PAYMENT_PYTHON_RETENTION_DAYS';

        -- Set retention end date
        NEW.retention_end_date := CURRENT_DATE + (retention_days || ' days')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment status changes
CREATE TRIGGER set_payment_diamond_retention
BEFORE UPDATE ON payment_diamonds
FOR EACH ROW EXECUTE FUNCTION set_diamond_retention_date();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE rules_programs IS 'The "Unwoven Future" - rules and intentions for recurring programs';
COMMENT ON TABLE loom_instances IS 'The "Loom of the Present" - concrete instances projected from rules';
COMMENT ON TABLE history_ribbon_shifts IS 'The "Woven Past" - immutable record of completed shifts';
COMMENT ON TABLE payment_diamonds IS 'The "Payment Python" - financial lifecycle tracking';
COMMENT ON TABLE event_card_map IS 'Maps a single logical event to multiple UI cards (bus runs, activity, roster)';
COMMENT ON TABLE tgl_config IS 'Configuration for The Great Loom architecture';
