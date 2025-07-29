/**
 * quick-setup.js - PostgreSQL Quick Setup for Revolutionary UI
 * 
 * This script creates just the essential tables needed for the revolutionary
 * frontend to work properly, with sample data for demo purposes.
 */

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const { Client } = require('pg');

// PostgreSQL connection config from .env
const config = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: 'postgres' // Connect to postgres initially
};

console.log('🚀 REVOLUTIONARY UI DATABASE SETUP');
console.log('----------------------------------');
console.log('Connecting to PostgreSQL...');

async function setupDatabase() {
  let client = new Client(config);
  
  try {
    // Connect to postgres database
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');
    
    // Create our database if it doesn't exist
    const dbName = process.env.PG_DATABASE || 'rabspocdb';
    const dbCheck = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (dbCheck.rowCount === 0) {
      console.log(`Creating database '${dbName}'...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created`);
    } else {
      console.log(`✅ Database '${dbName}' already exists`);
    }
    
    // Close connection to postgres database
    await client.end();
    
    // Connect to our specific database
    client = new Client({
      ...config,
      database: dbName
    });
    await client.connect();
    console.log(`✅ Connected to '${dbName}' database`);
    
    // Enable required extensions
    console.log('Enabling extensions...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension enabled');
    } catch (err) {
      console.error('❌ Failed to enable UUID extension:', err.message);
      console.log('⚠️ You may need to install the uuid-ossp extension with your PostgreSQL installation');
    }
    
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgvector"');
      console.log('✅ pgvector extension enabled');
    } catch (err) {
      console.error('❌ Failed to enable pgvector extension:', err.message);
      console.log('⚠️ For vector search functionality, install pgvector: https://github.com/pgvector/pgvector');
      console.log('⚠️ The system will still work without it, but semantic search will be disabled');
    }
    
    // Create tables
    console.log('Creating essential tables...');
    
    // Staff table with SCHADS integration
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        address TEXT,
        suburb TEXT,
        postcode TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        contracted_hours INTEGER DEFAULT 0,
        notes TEXT,
        schads_level INTEGER DEFAULT 3,
        base_rate NUMERIC(10, 2) DEFAULT 34.85,
        apply_penalty_rates BOOLEAN DEFAULT TRUE,
        timesheet_export_format TEXT DEFAULT 'xero',
        payroll_id TEXT,
        shift_notes_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Staff table created');
    
    // Participants table with supervision multipliers
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        address TEXT,
        suburb TEXT,
        postcode TEXT,
        ndis_number TEXT,
        plan_management_type TEXT DEFAULT 'agency',
        contact_phone TEXT,
        contact_email TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        supervision_multiplier NUMERIC(3, 2) DEFAULT 1.0,
        support_needs JSONB DEFAULT '{"mobility": false, "communication": false, "medical": false, "behavioral": false, "personal_care": false}',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Participants table created');
    
    // Venues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        address TEXT,
        suburb TEXT,
        postcode TEXT,
        venue_type TEXT DEFAULT 'community',
        capacity INTEGER DEFAULT 20,
        booking_lead_time INTEGER DEFAULT 48,
        amenities JSONB DEFAULT '{"kitchen": false, "parking": false, "wifi": false, "outdoor_space": false, "air_conditioning": false, "projector": false, "bathroom": false}',
        accessibility JSONB DEFAULT '{"wheelchair_access": false, "accessible_bathroom": false, "hearing_loop": false, "low_sensory_area": false, "elevator": false}',
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Venues table created');
    
    // Vehicles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        description TEXT NOT NULL,
        registration TEXT,
        seats INTEGER DEFAULT 10,
        vehicle_type TEXT DEFAULT 'Van',
        wheelchair_access BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'Available',
        rego_expiry DATE,
        insurance_expiry DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Vehicles table created');
    
    // Settings table for admin percentage etc.
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Settings table created');
    
    // Insert admin percentage setting
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('admin_expense_percentage', '18.0')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
    
    // Add sample data
    console.log('Adding sample data...');
    
    // Sample staff with SCHADS levels
    await client.query(`
      INSERT INTO staff (first_name, last_name, contact_phone, contact_email, contracted_hours, schads_level, base_rate)
      VALUES 
        ('John', 'Smith', '0412345678', 'john@example.com', 38, 2, 32.54),
        ('Sarah', 'Jones', '0423456789', 'sarah@example.com', 40, 3, 34.85),
        ('Michael', 'Brown', '0434567890', 'michael@example.com', 20, 4, 36.88),
        ('Emma', 'Wilson', '0445678901', 'emma@example.com', 38, 3, 34.85),
        ('David', 'Taylor', '0456789012', 'david@example.com', 40, 5, 39.03),
        ('Lisa', 'Anderson', '0467890123', 'lisa@example.com', 30, 6, 43.26),
        ('James', 'Thomas', '0478901234', 'james@example.com', 38, 7, 46.71),
        ('Jessica', 'White', '0489012345', 'jessica@example.com', 40, 8, 50.15)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Sample staff added');
    
    // Sample participants with supervision multipliers
    await client.query(`
      INSERT INTO participants (first_name, last_name, ndis_number, contact_phone, supervision_multiplier, plan_management_type, support_needs)
      VALUES 
        ('Alex', 'Taylor', 'NDIS1234567', '0456789012', 1.0, 'agency', '{"mobility": false, "communication": false, "medical": false, "behavioral": false, "personal_care": false}'),
        ('Jessica', 'Martin', 'NDIS2345678', '0467890123', 1.25, 'plan', '{"mobility": true, "communication": false, "medical": false, "behavioral": false, "personal_care": false}'),
        ('David', 'Clark', 'NDIS3456789', '0478901234', 1.5, 'self', '{"mobility": true, "communication": true, "medical": false, "behavioral": false, "personal_care": true}'),
        ('Olivia', 'Walker', 'NDIS4567890', '0489012345', 2.0, 'ndia', '{"mobility": true, "communication": true, "medical": true, "behavioral": true, "personal_care": true}'),
        ('William', 'Green', 'NDIS5678901', '0490123456', 1.0, 'agency', '{"mobility": false, "communication": true, "medical": false, "behavioral": false, "personal_care": false}'),
        ('Sophia', 'Adams', 'NDIS6789012', '0401234567', 1.75, 'plan', '{"mobility": true, "communication": false, "medical": true, "behavioral": true, "personal_care": false}'),
        ('Ethan', 'Baker', 'NDIS7890123', '0412345678', 2.25, 'self', '{"mobility": true, "communication": true, "medical": true, "behavioral": true, "personal_care": true}'),
        ('Ava', 'Carter', 'NDIS8901234', '0423456789', 1.5, 'ndia', '{"mobility": false, "communication": false, "medical": true, "behavioral": true, "personal_care": true}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Sample participants added');
    
    // Sample venues with amenities and accessibility
    await client.query(`
      INSERT INTO venues (name, address, suburb, postcode, venue_type, capacity, amenities, accessibility, status)
      VALUES 
        ('Main Centre', '123 Main St', 'Brisbane', '4000', 'main', 50, 
         '{"kitchen": true, "parking": true, "wifi": true, "outdoor_space": true, "air_conditioning": true, "projector": true, "bathroom": true}',
         '{"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": true, "elevator": true}',
         'active'),
        ('Community Hall', '456 Park Ave', 'Brisbane', '4000', 'community', 30, 
         '{"kitchen": true, "parking": true, "wifi": false, "outdoor_space": true, "air_conditioning": false, "projector": false, "bathroom": true}',
         '{"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": false, "low_sensory_area": false, "elevator": false}',
         'active'),
        ('Partner Location', '789 River Rd', 'Brisbane', '4000', 'partner', 25, 
         '{"kitchen": false, "parking": true, "wifi": true, "outdoor_space": false, "air_conditioning": true, "projector": true, "bathroom": true}',
         '{"wheelchair_access": true, "accessible_bathroom": false, "hearing_loop": false, "low_sensory_area": true, "elevator": false}',
         'active'),
        ('Recreation Center', '101 Beach Blvd', 'Gold Coast', '4217', 'community', 40, 
         '{"kitchen": true, "parking": true, "wifi": true, "outdoor_space": true, "air_conditioning": true, "projector": true, "bathroom": true}',
         '{"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": false, "elevator": true}',
         'active'),
        ('Training Facility', '202 Mountain View', 'Brisbane', '4000', 'main', 35, 
         '{"kitchen": true, "parking": true, "wifi": true, "outdoor_space": false, "air_conditioning": true, "projector": true, "bathroom": true}',
         '{"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": true, "elevator": true}',
         'under_maintenance')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Sample venues added');
    
    // Sample vehicles
    await client.query(`
      INSERT INTO vehicles (description, registration, seats, vehicle_type, wheelchair_access, status)
      VALUES 
        ('Toyota HiAce', 'ABC123', 12, 'Van', false, 'Available'),
        ('Ford Transit', 'DEF456', 15, 'Bus', false, 'Available'),
        ('Mercedes Sprinter', 'GHI789', 10, 'WAV', true, 'Available'),
        ('Toyota Coaster', 'JKL012', 20, 'Bus', false, 'In Use'),
        ('Volkswagen Crafter', 'MNO345', 12, 'WAV', true, 'Maintenance'),
        ('Toyota Commuter', 'PQR678', 14, 'Van', false, 'Available'),
        ('Mitsubishi Rosa', 'STU901', 25, 'Bus', false, 'Out of Service'),
        ('Ford Kuga', 'VWX234', 5, 'Car', false, 'Available')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Sample vehicles added');
    
    // Add simple financial data for demo
    console.log('Creating mock financial data tables for dashboard...');
    
    // Simple financial records table for demo
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        date DATE NOT NULL,
        program_name TEXT NOT NULL,
        participant_count INTEGER NOT NULL,
        virtual_participant_count NUMERIC(5, 2),
        revenue NUMERIC(10, 2) NOT NULL,
        staff_costs NUMERIC(10, 2) NOT NULL,
        admin_costs NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add sample financial records
    await client.query(`
      INSERT INTO financial_records (date, program_name, participant_count, virtual_participant_count, revenue, staff_costs, admin_costs)
      VALUES 
        ('2025-07-27', 'Monday Centre-Based', 8, 10.5, 2400.00, 1200.00, 432.00),
        ('2025-07-27', 'Swimming Program', 6, 9.0, 1800.00, 950.00, 324.00),
        ('2025-07-26', 'Weekend Outing', 10, 12.0, 3000.00, 1500.00, 540.00),
        ('2025-07-25', 'Friday Social', 12, 13.5, 3600.00, 1800.00, 648.00),
        ('2025-07-24', 'Art Therapy', 7, 8.75, 2100.00, 1050.00, 378.00),
        ('2025-07-23', 'Music Group', 9, 11.25, 2700.00, 1350.00, 486.00),
        ('2025-07-22', 'Cooking Class', 8, 10.0, 2400.00, 1200.00, 432.00),
        ('2025-07-21', 'Monday Centre-Based', 10, 12.5, 3000.00, 1500.00, 540.00),
        ('2025-07-20', 'Weekend Outing', 14, 17.5, 4200.00, 2100.00, 756.00),
        ('2025-07-19', 'Saturday Program', 12, 15.0, 3600.00, 1800.00, 648.00)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('✅ Sample financial records added');
    
    // Create a simple master cards view for the dashboard
    await client.query(`
      CREATE OR REPLACE VIEW master_cards AS
      SELECT 
        id,
        date,
        program_name,
        participant_count,
        virtual_participant_count,
        revenue,
        staff_costs,
        admin_costs,
        (revenue - staff_costs - admin_costs) as profit_loss,
        CASE 
          WHEN revenue > 0 THEN ((revenue - staff_costs - admin_costs) / revenue * 100)
          ELSE 0 
        END as profit_margin
      FROM financial_records
    `);
    console.log('✅ Master cards view created');
    
    console.log('\n🎉 REVOLUTIONARY DATABASE SETUP COMPLETE! 🎉');
    console.log('Your frontend is ready to showcase all revolutionary features!');
    console.log('\nYou can now run the backend with:');
    console.log('cd backend && node server.js');
    console.log('\nAnd the frontend with:');
    console.log('cd frontend && npm start');
    
  } catch (err) {
    console.error('❌ Setup failed:', err);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

setupDatabase();
