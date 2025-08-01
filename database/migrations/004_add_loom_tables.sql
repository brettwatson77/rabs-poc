-- 004_add_loom_tables.sql
-- Add Loom system tables to support dynamic resource allocation

-- Create enum types for status fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loom_instance_status') THEN
        CREATE TYPE loom_instance_status AS ENUM ('pending', 'generated', 'finalised');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allocation_status') THEN
        CREATE TYPE allocation_status AS ENUM ('planned', 'cancelled', 'complete');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cancellation_type') THEN
        CREATE TYPE cancellation_type AS ENUM ('normal', 'short_notice');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE staff_role AS ENUM ('lead', 'support', 'driver');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_shift_status') THEN
        CREATE TYPE staff_shift_status AS ENUM ('planned', 'confirmed', 'replaced', 'flagged');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_run_status') THEN
        CREATE TYPE vehicle_run_status AS ENUM ('planned', 'confirmed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loom_actor') THEN
        CREATE TYPE loom_actor AS ENUM ('loom_engine', 'human');
    END IF;
END$$;

-- Table 1: Loom Instances (program instances within the loom window)
CREATE TABLE IF NOT EXISTS tgl_loom_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id INTEGER NOT NULL,
    instance_date DATE NOT NULL,
    status loom_instance_status NOT NULL DEFAULT 'pending',
    optimisation_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Index for faster lookups by program and date
CREATE INDEX IF NOT EXISTS idx_loom_instances_program_date ON tgl_loom_instances(program_id, instance_date);
CREATE INDEX IF NOT EXISTS idx_loom_instances_date ON tgl_loom_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_loom_instances_status ON tgl_loom_instances(status);

-- Table 2: Loom Participant Allocations
CREATE TABLE IF NOT EXISTS tgl_loom_participant_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_instance_id UUID NOT NULL,
    participant_id INTEGER NOT NULL,
    billing_code VARCHAR(50) NOT NULL,
    planned_rate DECIMAL(10, 2) NOT NULL,
    allocation_status allocation_status NOT NULL DEFAULT 'planned',
    cancellation_type cancellation_type,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loom_instance FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
    CONSTRAINT fk_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Indexes for participant allocations
CREATE INDEX IF NOT EXISTS idx_loom_participant_allocations_instance ON tgl_loom_participant_allocations(loom_instance_id);
CREATE INDEX IF NOT EXISTS idx_loom_participant_allocations_participant ON tgl_loom_participant_allocations(participant_id);
CREATE INDEX IF NOT EXISTS idx_loom_participant_allocations_status ON tgl_loom_participant_allocations(allocation_status);

-- Table 3: Loom Staff Shifts
CREATE TABLE IF NOT EXISTS tgl_loom_staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_instance_id UUID NOT NULL,
    staff_id TEXT NOT NULL,
    role staff_role NOT NULL,
    start_ts TIMESTAMP WITH TIME ZONE NOT NULL,
    end_ts TIMESTAMP WITH TIME ZONE NOT NULL,
    status staff_shift_status NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loom_instance_shift FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Indexes for staff shifts
CREATE INDEX IF NOT EXISTS idx_loom_staff_shifts_instance ON tgl_loom_staff_shifts(loom_instance_id);
CREATE INDEX IF NOT EXISTS idx_loom_staff_shifts_staff ON tgl_loom_staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_loom_staff_shifts_status ON tgl_loom_staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_loom_staff_shifts_timerange ON tgl_loom_staff_shifts(start_ts, end_ts);

-- Table 4: Loom Vehicle Runs
CREATE TABLE IF NOT EXISTS tgl_loom_vehicle_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_instance_id UUID NOT NULL,
    vehicle_id TEXT NOT NULL,
    route_data JSONB NOT NULL,
    seats_used INTEGER NOT NULL DEFAULT 0,
    status vehicle_run_status NOT NULL DEFAULT 'planned',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loom_instance_vehicle FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
    CONSTRAINT fk_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- Indexes for vehicle runs
CREATE INDEX IF NOT EXISTS idx_loom_vehicle_runs_instance ON tgl_loom_vehicle_runs(loom_instance_id);
CREATE INDEX IF NOT EXISTS idx_loom_vehicle_runs_vehicle ON tgl_loom_vehicle_runs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_loom_vehicle_runs_status ON tgl_loom_vehicle_runs(status);

-- Table 5: Loom Audit Log
CREATE TABLE IF NOT EXISTS tgl_loom_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_instance_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    actor loom_actor NOT NULL DEFAULT 'loom_engine',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_loom_instance_audit FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_loom_audit_log_instance ON tgl_loom_audit_log(loom_instance_id);
CREATE INDEX IF NOT EXISTS idx_loom_audit_log_created_at ON tgl_loom_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_loom_audit_log_action ON tgl_loom_audit_log(action);

-- Add trigger to update timestamps automatically
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at timestamps
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tgl_loom_instances_timestamp') THEN
        CREATE TRIGGER update_tgl_loom_instances_timestamp
        BEFORE UPDATE ON tgl_loom_instances
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tgl_loom_participant_allocations_timestamp') THEN
        CREATE TRIGGER update_tgl_loom_participant_allocations_timestamp
        BEFORE UPDATE ON tgl_loom_participant_allocations
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tgl_loom_staff_shifts_timestamp') THEN
        CREATE TRIGGER update_tgl_loom_staff_shifts_timestamp
        BEFORE UPDATE ON tgl_loom_staff_shifts
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tgl_loom_vehicle_runs_timestamp') THEN
        CREATE TRIGGER update_tgl_loom_vehicle_runs_timestamp
        BEFORE UPDATE ON tgl_loom_vehicle_runs
        FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    END IF;
END$$;

-- Add a settings table entry for loom window size if not exists
INSERT INTO settings (key, value)
VALUES ('loom_window_weeks', '4')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE tgl_loom_instances IS 'Program instances within the loom window';
COMMENT ON TABLE tgl_loom_participant_allocations IS 'Participants assigned to loom instances';
COMMENT ON TABLE tgl_loom_staff_shifts IS 'Staff shifts for each loom instance';
COMMENT ON TABLE tgl_loom_vehicle_runs IS 'Vehicle assignments and routes for loom instances';
COMMENT ON TABLE tgl_loom_audit_log IS 'Change tracking and audit trail for loom operations';
