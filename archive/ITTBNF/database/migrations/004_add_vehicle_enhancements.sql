-- 004_add_vehicle_enhancements.sql
-- Enhances the vehicles table with additional fields to support more detailed vehicle information
-- This migration adds support for fuel type, make/model, registration details, and accessibility information

-- Start transaction to ensure all changes are applied atomically
BEGIN;

-- Add columns for vehicle details
ALTER TABLE vehicles 
  -- Registration and identification
  ADD COLUMN IF NOT EXISTS vin_number TEXT,
  ADD COLUMN IF NOT EXISTS engine_number TEXT,
  ADD COLUMN IF NOT EXISTS registration_expiry DATE,
  
  -- Operational details
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS max_height NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS wheelchair_accessible BOOLEAN DEFAULT FALSE;

-- (make, model, active, status already exist in the current schema)

-- Add comment to document the table
COMMENT ON TABLE vehicles IS 'Stores vehicle information including make, model, fuel type, and accessibility features';

-- Add comments to document the new columns
COMMENT ON COLUMN vehicles.fuel_type IS 'Type of fuel: Diesel, Petrol, Electric, Hybrid, etc.';
COMMENT ON COLUMN vehicles.make IS 'Vehicle manufacturer (e.g., Toyota, Renault)';
COMMENT ON COLUMN vehicles.model IS 'Vehicle model (e.g., Hiace, Koleos)';
COMMENT ON COLUMN vehicles.year IS 'Year the vehicle was manufactured';
COMMENT ON COLUMN vehicles.vin_number IS 'Vehicle Identification Number';
COMMENT ON COLUMN vehicles.engine_number IS 'Engine serial number';
COMMENT ON COLUMN vehicles.registration_expiry IS 'Date when vehicle registration expires';
COMMENT ON COLUMN vehicles.location IS 'Where the vehicle is typically parked/stored';
COMMENT ON COLUMN vehicles.max_height IS 'Maximum vehicle height in meters';
COMMENT ON COLUMN vehicles.wheelchair_accessible IS 'Whether the vehicle has wheelchair access';

-- Create an index on fuel_type for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type ON vehicles(fuel_type);

-- Create an index on make and model for faster searches
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);

-- Commit the transaction
COMMIT;
