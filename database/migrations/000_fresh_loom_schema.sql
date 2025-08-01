-- database/migrations/000_fresh_loom_schema.sql
--
-- Complete fresh schema for RABS with Loom system
-- This is a "nuclear option" migration that drops and recreates all tables
-- with consistent UUID primary keys and proper relationships

-- Start transaction
BEGIN;

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS tgl_temporal_exceptions CASCADE;
DROP TABLE IF EXISTS tgl_operator_intents CASCADE;
DROP TABLE IF EXISTS tgl_loom_audit_log CASCADE;
DROP TABLE IF EXISTS tgl_loom_vehicle_runs CASCADE;
DROP TABLE IF EXISTS tgl_loom_staff_shifts CASCADE;
DROP TABLE IF EXISTS tgl_loom_participant_allocations CASCADE;
DROP TABLE IF EXISTS tgl_loom_instances CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS program_participants CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS billing_codes CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Drop existing enum types if they exist
DROP TYPE IF EXISTS tgl_intent_type CASCADE;
DROP TYPE IF EXISTS tgl_exception_type CASCADE;
DROP TYPE IF EXISTS allocation_status CASCADE;
DROP TYPE IF EXISTS cancellation_type CASCADE;
DROP TYPE IF EXISTS staff_role CASCADE;
DROP TYPE IF EXISTS staff_shift_status CASCADE;
DROP TYPE IF EXISTS loom_instance_status CASCADE;

-- Create enum types
CREATE TYPE tgl_intent_type AS ENUM (
  'participant_enrollment',    -- Sarah joins Centre-Based Wednesday from Oct 7
  'participant_departure',     -- John leaves Saturday Adventure from Dec 15
  'program_transfer',          -- John moves from Saturday to Sunday program
  'staff_assignment',          -- Mark assigned as lead for Bowling Tuesdays
  'venue_change',              -- Bowling moves to new venue from Oct 1
  'program_modification',      -- Centre-Based hours change from 9-3 to 9-4
  'billing_code_change',       -- Billing code changes for participant
  'resource_requirement'       -- Need wheelchair accessible vehicle
);

CREATE TYPE tgl_exception_type AS ENUM (
  'participant_absence',       -- John absent on Nov 6
  'staff_absence',             -- Mark sick on Oct 12
  'venue_unavailable',         -- Bowling alley closed Oct 31
  'program_cancellation',      -- No Bowling on Christmas Day
  'program_reschedule',        -- One-time schedule change
  'transport_change',          -- Different pickup arrangement
  'billing_exception',         -- One-time billing override
  'note'                       -- General note/comment for a date
);

CREATE TYPE allocation_status AS ENUM (
  'planned',
  'attended',
  'cancelled',
  'no_show'
);

CREATE TYPE cancellation_type AS ENUM (
  'participant_request',
  'medical',
  'program_change',
  'staff_shortage',
  'venue_issue',
  'transportation_issue',
  'weather',
  'other'
);

CREATE TYPE staff_role AS ENUM (
  'lead',
  'support',
  'specialist',
  'driver'
);

CREATE TYPE staff_shift_status AS ENUM (
  'planned',
  'confirmed',
  'completed',
  'sick',
  'cancelled'
);

CREATE TYPE loom_instance_status AS ENUM (
  'draft',
  'planned',
  'staffed',
  'transport_assigned',
  'ready',
  'in_progress',
  'completed',
  'cancelled',
  'needs_attention'
);

-- Create function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create core tables with UUID primary keys

-- Settings table for configuration
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

-- Billing codes table
CREATE TABLE billing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  ndis_number VARCHAR(50),
  address TEXT,
  suburb VARCHAR(100),
  state VARCHAR(50),
  postcode VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(100),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  photo_url TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8)
);

-- Staff table
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  suburb VARCHAR(100),
  state VARCHAR(50),
  postcode VARCHAR(10),
  qualifications TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  photo_url TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8)
);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  registration VARCHAR(20) NOT NULL,
  capacity INTEGER NOT NULL,
  wheelchair_capacity INTEGER NOT NULL DEFAULT 0,
  make VARCHAR(50),
  model VARCHAR(50),
  year INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8)
);

-- Venues table
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  suburb VARCHAR(100),
  state VARCHAR(50),
  postcode VARCHAR(10),
  capacity INTEGER,
  facilities TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8)
);

-- Programs table
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  day_of_week INTEGER,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  capacity INTEGER,
  recurring BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Program participants (many-to-many relationship)
CREATE TABLE program_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  billing_code_id UUID REFERENCES billing_codes(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, participant_id)
);

-- Schedule table (for manual scheduling)
CREATE TABLE schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Loom system tables

-- Loom instances table
CREATE TABLE tgl_loom_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  status loom_instance_status NOT NULL DEFAULT 'draft',
  participants_count INTEGER NOT NULL DEFAULT 0,
  staff_count INTEGER NOT NULL DEFAULT 0,
  manually_modified BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, instance_date)
);

-- Loom participant allocations
CREATE TABLE tgl_loom_participant_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  billing_code_id UUID REFERENCES billing_codes(id) ON DELETE SET NULL,
  allocation_status allocation_status NOT NULL DEFAULT 'planned',
  cancellation_type cancellation_type,
  manually_added BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Loom staff shifts
CREATE TABLE tgl_loom_staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role staff_role NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status staff_shift_status NOT NULL DEFAULT 'planned',
  manually_assigned BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Loom vehicle runs
CREATE TABLE tgl_loom_vehicle_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  route_data JSONB NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  estimated_duration INTEGER NOT NULL, -- in minutes
  estimated_distance INTEGER NOT NULL, -- in meters
  manually_configured BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Loom audit log
CREATE TABLE tgl_loom_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  user_id VARCHAR(100),
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Persistence layer tables

-- Operator intents - persistent future plans that survive window changes
CREATE TABLE tgl_operator_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_type tgl_intent_type NOT NULL,
  
  -- Date range this intent applies to (null end_date = indefinite)
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Related entities (nullable depending on intent type)
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- Flexible metadata storage for type-specific details
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- For program_modification, what fields are changed
  modified_fields JSONB,
  
  -- For billing_code_change
  billing_codes JSONB,
  
  -- Audit fields
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Validation: end_date must be after start_date if provided
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date)
);

-- Temporal exceptions - one-off changes for specific dates
CREATE TABLE tgl_temporal_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type tgl_exception_type NOT NULL,
  
  -- The specific date this exception applies to
  exception_date DATE NOT NULL,
  
  -- Related entities (nullable depending on exception type)
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  
  -- For linking to a specific loom instance if within window
  loom_instance_id UUID REFERENCES tgl_loom_instances(id) ON DELETE SET NULL,
  
  -- Flexible metadata storage for exception-specific details
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- For billing_exception
  billing_override JSONB,
  
  -- Reason for the exception
  reason TEXT,
  
  -- Audit fields
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance

-- Participants indexes
CREATE INDEX idx_participants_name ON participants(last_name, first_name);
CREATE INDEX idx_participants_ndis ON participants(ndis_number);
CREATE INDEX idx_participants_location ON participants(location_lat, location_lng);

-- Staff indexes
CREATE INDEX idx_staff_name ON staff(last_name, first_name);
CREATE INDEX idx_staff_location ON staff(location_lat, location_lng);

-- Vehicles indexes
CREATE INDEX idx_vehicles_registration ON vehicles(registration);
CREATE INDEX idx_vehicles_location ON vehicles(location_lat, location_lng);

-- Venues indexes
CREATE INDEX idx_venues_name ON venues(name);
CREATE INDEX idx_venues_location ON venues(location_lat, location_lng);

-- Programs indexes
CREATE INDEX idx_programs_day_time ON programs(day_of_week, start_time);
CREATE INDEX idx_programs_venue ON programs(venue_id);

-- Program participants indexes
CREATE INDEX idx_program_participants_program ON program_participants(program_id);
CREATE INDEX idx_program_participants_participant ON program_participants(participant_id);
CREATE INDEX idx_program_participants_dates ON program_participants(start_date, end_date);

-- Schedule indexes
CREATE INDEX idx_schedule_program ON schedule(program_id);
CREATE INDEX idx_schedule_date ON schedule(scheduled_date);

-- Loom instances indexes
CREATE INDEX idx_loom_instances_program ON tgl_loom_instances(program_id);
CREATE INDEX idx_loom_instances_date ON tgl_loom_instances(instance_date);
CREATE INDEX idx_loom_instances_status ON tgl_loom_instances(status);

-- Loom participant allocations indexes
CREATE INDEX idx_loom_participant_allocations_instance ON tgl_loom_participant_allocations(loom_instance_id);
CREATE INDEX idx_loom_participant_allocations_participant ON tgl_loom_participant_allocations(participant_id);
CREATE INDEX idx_loom_participant_allocations_status ON tgl_loom_participant_allocations(allocation_status);

-- Loom staff shifts indexes
CREATE INDEX idx_loom_staff_shifts_instance ON tgl_loom_staff_shifts(loom_instance_id);
CREATE INDEX idx_loom_staff_shifts_staff ON tgl_loom_staff_shifts(staff_id);
CREATE INDEX idx_loom_staff_shifts_status ON tgl_loom_staff_shifts(status);
CREATE INDEX idx_loom_staff_shifts_timerange ON tgl_loom_staff_shifts(start_time, end_time);

-- Loom vehicle runs indexes
CREATE INDEX idx_loom_vehicle_runs_instance ON tgl_loom_vehicle_runs(loom_instance_id);
CREATE INDEX idx_loom_vehicle_runs_vehicle ON tgl_loom_vehicle_runs(vehicle_id);
CREATE INDEX idx_loom_vehicle_runs_driver ON tgl_loom_vehicle_runs(driver_id);
CREATE INDEX idx_loom_vehicle_runs_timerange ON tgl_loom_vehicle_runs(start_time, end_time);

-- Operator intents indexes
CREATE INDEX idx_operator_intents_date_range ON tgl_operator_intents(start_date, end_date);
CREATE INDEX idx_operator_intents_program ON tgl_operator_intents(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_operator_intents_participant ON tgl_operator_intents(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_operator_intents_type ON tgl_operator_intents(intent_type);

-- Temporal exceptions indexes
CREATE INDEX idx_temporal_exceptions_date ON tgl_temporal_exceptions(exception_date);
CREATE INDEX idx_temporal_exceptions_program ON tgl_temporal_exceptions(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_temporal_exceptions_participant ON tgl_temporal_exceptions(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_temporal_exceptions_type ON tgl_temporal_exceptions(exception_type);
CREATE INDEX idx_temporal_exceptions_instance ON tgl_temporal_exceptions(loom_instance_id) WHERE loom_instance_id IS NOT NULL;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_participants_modtime
BEFORE UPDATE ON participants
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_staff_modtime
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vehicles_modtime
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_venues_modtime
BEFORE UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_programs_modtime
BEFORE UPDATE ON programs
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_program_participants_modtime
BEFORE UPDATE ON program_participants
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_schedule_modtime
BEFORE UPDATE ON schedule
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_loom_instances_modtime
BEFORE UPDATE ON tgl_loom_instances
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_loom_participant_allocations_modtime
BEFORE UPDATE ON tgl_loom_participant_allocations
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_loom_staff_shifts_modtime
BEFORE UPDATE ON tgl_loom_staff_shifts
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_loom_vehicle_runs_modtime
BEFORE UPDATE ON tgl_loom_vehicle_runs
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_operator_intents_modtime
BEFORE UPDATE ON tgl_operator_intents
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_temporal_exceptions_modtime
BEFORE UPDATE ON tgl_temporal_exceptions
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_billing_codes_modtime
BEFORE UPDATE ON billing_codes
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Insert initial settings for loom configuration
INSERT INTO settings (key, value, description)
VALUES 
  ('loom_window_weeks', '4', 'Size of the loom window in weeks (2-16)'),
  ('loom_auto_roll_enabled', 'true', 'Whether the daily roll happens automatically'),
  ('loom_auto_roll_time', '00:05', 'Time of day for the auto-roll (Sydney time)'),
  ('loom_verification_time', '09:00', 'Time to verify successful roll and retry if needed');

-- Insert some sample billing codes for NDIS
INSERT INTO billing_codes (code, description, rate, active)
VALUES
  ('01_011_0107_1_1', 'Assistance With Self-Care Activities - Standard - Weekday Daytime', 59.81, true),
  ('01_011_0107_1_1_T', 'Assistance With Self-Care Activities - Temporary Transformation Payment - Weekday Daytime', 62.17, true),
  ('01_015_0107_1_1', 'Assistance With Self-Care Activities - Standard - Evening', 65.82, true),
  ('04_104_0125_6_1', 'Community Nursing Care For Complex Care Needs', 105.14, true),
  ('04_300_0104_1_1', 'Assistance With Social And Community Participation - Level 1', 59.81, true),
  ('04_301_0104_1_1', 'Assistance With Social And Community Participation - Level 2', 65.09, true),
  ('04_302_0104_1_1', 'Assistance With Social And Community Participation - Level 3', 68.14, true),
  ('04_599_0104_6_1', 'Provider travel - non-labour costs', 1.00, true);

-- Commit transaction
COMMIT;
