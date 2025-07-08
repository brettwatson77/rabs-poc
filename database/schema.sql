-- RABS-POC Database Schema

PRAGMA foreign_keys = ON;

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT NOT NULL,
    suburb TEXT NOT NULL,
    state TEXT DEFAULT 'NSW',
    postcode TEXT NOT NULL,
    latitude REAL,                -- Decimal degrees (optional)
    longitude REAL,               -- Decimal degrees (optional)
    ndis_number TEXT UNIQUE,
    is_plan_managed BOOLEAN NOT NULL DEFAULT 0,  -- 0 for agency-managed, 1 for plan-managed
    contact_phone TEXT,
    contact_email TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,  -- S1, S2, etc.
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    address TEXT,
    suburb TEXT,
    state TEXT DEFAULT 'NSW',
    postcode TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    contracted_hours INTEGER DEFAULT 30,  -- Contracted hours per fortnight (0–80)
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff availability (weekly grid)
CREATE TABLE IF NOT EXISTS staff_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    start_time TEXT NOT NULL,      -- 24-hour format: HH:MM
    end_time TEXT NOT NULL,        -- 24-hour format: HH:MM
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE (staff_id, day_of_week, start_time, end_time)
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,  -- V1, V2, etc.
    description TEXT,
    seats INTEGER NOT NULL DEFAULT 10,  -- Including driver
    registration TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    suburb TEXT NOT NULL,
    state TEXT DEFAULT 'NSW',
    postcode TEXT NOT NULL,
    latitude REAL,                -- Decimal degrees (optional)
    longitude REAL,               -- Decimal degrees (optional)
    is_main_centre BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    day_of_week INTEGER NOT NULL,  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    start_time TEXT NOT NULL,      -- 24-hour format: HH:MM
    end_time TEXT NOT NULL,        -- 24-hour format: HH:MM
    is_weekend BOOLEAN DEFAULT 0,
    is_centre_based BOOLEAN DEFAULT 1,
    venue_id INTEGER,
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Rate line-items (replaces the old single-row rates table)
CREATE TABLE IF NOT EXISTS rate_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    support_number TEXT NOT NULL,   -- NDIS billing code, e.g., 04_102_0136_6_1
    description TEXT,
    unit_price REAL NOT NULL,
    gst_code TEXT DEFAULT 'P2',
    claim_type TEXT DEFAULT 'Service',
    in_kind_funding_program TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    UNIQUE (program_id, support_number)
);

-- Program Instances (specific dates when programs run)
CREATE TABLE IF NOT EXISTS program_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    date TEXT NOT NULL,            -- YYYY-MM-DD
    start_time TEXT NOT NULL,      -- 24-hour format: HH:MM
    end_time TEXT NOT NULL,        -- 24-hour format: HH:MM
    venue_id INTEGER,
    activity_description TEXT,     -- For weekend programs with AI-generated activities
    notes TEXT,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    UNIQUE (program_id, date)
);

-- Program enrollments (which participants are enrolled in which programs)
CREATE TABLE IF NOT EXISTS program_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    program_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,      -- YYYY-MM-DD
    end_date TEXT,                 -- YYYY-MM-DD, NULL if ongoing
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    UNIQUE (participant_id, program_id, start_date)
);

-- Pending enrollment changes (future-dated add/remove actions)
CREATE TABLE IF NOT EXISTS pending_enrollment_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    program_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('add','remove')),
    effective_date TEXT NOT NULL,   -- YYYY-MM-DD
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processed','cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    program_instance_id INTEGER NOT NULL,
    status TEXT NOT NULL,          -- 'confirmed', 'attended', 'cancelled', 'no-show'
    pickup_required BOOLEAN DEFAULT 1,
    dropoff_required BOOLEAN DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (program_instance_id) REFERENCES program_instances(id) ON DELETE CASCADE,
    UNIQUE (participant_id, program_instance_id)
);

-- Staff assignments
CREATE TABLE IF NOT EXISTS staff_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id TEXT NOT NULL,
    program_instance_id INTEGER NOT NULL,
    role TEXT DEFAULT 'support',   -- 'support', 'driver', 'lead', etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (program_instance_id) REFERENCES program_instances(id) ON DELETE CASCADE,
    UNIQUE (staff_id, program_instance_id)
);

-- Vehicle assignments
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL,
    program_instance_id INTEGER NOT NULL,
    driver_staff_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (program_instance_id) REFERENCES program_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_staff_id) REFERENCES staff(id),
    UNIQUE (vehicle_id, program_instance_id)
);

-- Routes (calculated for each vehicle assignment)
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_assignment_id INTEGER NOT NULL,
    route_type TEXT NOT NULL,      -- 'pickup', 'dropoff'
    estimated_duration INTEGER,    -- in minutes
    estimated_distance REAL,       -- in kilometers
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_assignment_id) REFERENCES vehicle_assignments(id) ON DELETE CASCADE
);

-- Route stops (individual stops for each route)
CREATE TABLE IF NOT EXISTS route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    stop_order INTEGER NOT NULL,
    participant_id INTEGER,        -- NULL for venue stops
    venue_id INTEGER,              -- NULL for participant stops
    address TEXT NOT NULL,
    suburb TEXT NOT NULL,
    state TEXT DEFAULT 'NSW',
    postcode TEXT NOT NULL,
    estimated_arrival_time TEXT,   -- 24-hour format: HH:MM
    notes TEXT,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id),
    FOREIGN KEY (venue_id) REFERENCES venues(id)
);

-- Billing records
CREATE TABLE IF NOT EXISTS billing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    program_instance_id INTEGER NOT NULL,
    line_item_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'unbilled', -- 'unbilled', 'billed', 'paid'
    billing_period_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (program_instance_id) REFERENCES program_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (line_item_id) REFERENCES rate_line_items(id),
    FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id),
    UNIQUE (participant_id, program_instance_id, line_item_id)
);

-- Billing periods
CREATE TABLE IF NOT EXISTS billing_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,      -- YYYY-MM-DD
    end_date TEXT NOT NULL,        -- YYYY-MM-DD
    description TEXT,
    status TEXT DEFAULT 'open',    -- 'open', 'closed', 'processed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (start_date, end_date)
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,      -- 'cancellation', 'no-show', 'enrollment', 'attendance', etc.
    participant_id INTEGER,
    staff_id TEXT,
    program_instance_id INTEGER,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (program_instance_id) REFERENCES program_instances(id)
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) 
VALUES 
    ('current_date', date('now'), 'The current date used for simulation'),
    ('google_maps_enabled', '0', 'Whether to use Google Maps API (1) or fallback routing (0)'),
    ('max_ride_time', '60', 'Maximum ride time in minutes from last pickup to venue'),
    ('preferred_participant_per_bus', '4', 'Preferred number of participants per bus'),
    ('ndis_registration_number', '', 'Provider registration number for NDIS bulk upload'),
    ('abn', '', 'Provider ABN for NDIS bulk upload');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_program_enrollments_participant ON program_enrollments(participant_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_program_instance ON attendance(program_instance_id);
CREATE INDEX IF NOT EXISTS idx_program_instances_program ON program_instances(program_id);
CREATE INDEX IF NOT EXISTS idx_program_instances_date ON program_instances(date);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff ON staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_program_instance ON staff_assignments(program_instance_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_program_instance ON vehicle_assignments(program_instance_id);
CREATE INDEX IF NOT EXISTS idx_routes_vehicle_assignment ON routes(vehicle_assignment_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_participant ON billing_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_program_instance ON billing_records(program_instance_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_billing_period ON billing_records(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_participant ON activity_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_program_instance ON activity_log(program_instance_id);
