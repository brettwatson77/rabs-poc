-- 000_operational_base.sql
-- Creates the base operational tables required by the TGL architecture
-- These tables should be created BEFORE running the TGL core schema

-- =============================================================================
-- OPERATIONAL BASE TABLES
-- =============================================================================

-- Staff table with SCHADS integration
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT,
    suburb TEXT,
    state TEXT,
    postcode TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    contact_phone TEXT,
    contact_email TEXT,
    contracted_hours INTEGER DEFAULT 0,
    availability JSON, -- JSON object with availability patterns
    notes TEXT,
    schads_level INTEGER DEFAULT 3, -- 1-8 SCHADS award levels
    base_rate NUMERIC(10, 2), -- Base hourly rate (derived from SCHADS level)
    apply_penalty_rates BOOLEAN DEFAULT TRUE, -- Whether to apply weekend/holiday rates
    casual_loading BOOLEAN DEFAULT FALSE, -- Whether to apply casual loading (25%)
    payroll_id TEXT, -- External payroll system identifier
    shift_notes_completed BOOLEAN DEFAULT FALSE, -- Whether staff has completed notes for shifts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for staff name searches
CREATE INDEX idx_staff_name ON staff (last_name, first_name);

-- Participants table with supervision multipliers
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT,
    suburb TEXT,
    state TEXT,
    postcode TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    ndis_number TEXT,
    is_plan_managed BOOLEAN DEFAULT FALSE,
    contact_phone TEXT,
    contact_email TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    supervision_multiplier NUMERIC(3, 2) DEFAULT 1.0, -- Supervision adjustment factor (1.0, 1.25, 1.5, etc.)
    mobility_requirements TEXT, -- Wheelchair, walker, etc.
    dietary_requirements TEXT,
    medical_requirements TEXT,
    behavior_support_plan BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for participant name searches
CREATE INDEX idx_participant_name ON participants (last_name, first_name);

-- Vehicles table
CREATE TABLE vehicles (
    id TEXT PRIMARY KEY, -- Custom ID like "V1", "V2", etc.
    description TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 10,
    wheelchair_capacity INTEGER DEFAULT 0,
    registration TEXT,
    registration_expiry DATE,
    service_due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    suburb TEXT,
    state TEXT,
    postcode TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    is_main_centre BOOLEAN DEFAULT FALSE,
    capacity INTEGER,
    facilities TEXT, -- JSON or comma-separated list of facilities
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for venue name searches
CREATE INDEX idx_venue_name ON venues (name);

-- Settings table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('admin_expense_percentage', '18'),
    ('default_staff_ratio', '4'),
    ('default_route_minutes', '60'),
    ('default_activity_hours', '3');

-- =============================================================================
-- TRIGGERS & FUNCTIONS
-- =============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_operational_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_staff_timestamp
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_operational_timestamp();

CREATE TRIGGER update_participants_timestamp
BEFORE UPDATE ON participants
FOR EACH ROW EXECUTE FUNCTION update_operational_timestamp();

CREATE TRIGGER update_vehicles_timestamp
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_operational_timestamp();

CREATE TRIGGER update_venues_timestamp
BEFORE UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION update_operational_timestamp();

CREATE TRIGGER update_settings_timestamp
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_operational_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE staff IS 'Staff members with SCHADS award integration';
COMMENT ON TABLE participants IS 'Participants with supervision multiplier support';
COMMENT ON TABLE vehicles IS 'Vehicles with capacity information';
COMMENT ON TABLE venues IS 'Activity venues and centers';
COMMENT ON TABLE settings IS 'System-wide configuration settings';
COMMENT ON COLUMN participants.supervision_multiplier IS 'Factor that increases perceived supervision need (1.0 normal, 1.5 wheelchair, etc.)';
COMMENT ON COLUMN staff.schads_level IS 'SCHADS award level (1-8) determining base pay rate';
