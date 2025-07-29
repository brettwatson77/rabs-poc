/**
 * fix-tables.js - Fix PostgreSQL Table Structure
 * 
 * This script fixes table structure issues in the PostgreSQL database:
 * 1. Adds missing columns to vehicles table (vehicle_type, wheelchair_access, status)
 * 2. Adds missing columns to other tables if needed
 * 3. Inserts sample data properly
 * 4. Handles tables that exist but are missing columns
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
  database: process.env.PG_DATABASE || 'rabspocdb'
};

console.log('🔧 REVOLUTIONARY DATABASE FIX SCRIPT');
console.log('-----------------------------------');
console.log('Connecting to PostgreSQL...');

async function fixTables() {
  const client = new Client(config);
  
  try {
    // Connect to the database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Check and fix vehicles table
    console.log('\n🚗 Checking vehicles table...');
    const vehiclesExists = await checkTableExists(client, 'vehicles');
    
    if (vehiclesExists) {
      console.log('✅ Vehicles table exists');
      
      // Check for missing columns
      const columns = await getTableColumns(client, 'vehicles');
      console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
      
      // Add missing columns
      if (!columns.includes('vehicle_type')) {
        console.log('Adding vehicle_type column...');
        await client.query(`ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT DEFAULT 'Van'`);
        console.log('✅ Added vehicle_type column');
      }
      
      if (!columns.includes('wheelchair_access')) {
        console.log('Adding wheelchair_access column...');
        await client.query(`ALTER TABLE vehicles ADD COLUMN wheelchair_access BOOLEAN DEFAULT FALSE`);
        console.log('✅ Added wheelchair_access column');
      }
      
      if (!columns.includes('status')) {
        console.log('Adding status column...');
        await client.query(`ALTER TABLE vehicles ADD COLUMN status TEXT DEFAULT 'Available'`);
        console.log('✅ Added status column');
      }
      
      if (!columns.includes('rego_expiry')) {
        console.log('Adding rego_expiry column...');
        await client.query(`ALTER TABLE vehicles ADD COLUMN rego_expiry DATE`);
        console.log('✅ Added rego_expiry column');
      }
      
      if (!columns.includes('insurance_expiry')) {
        console.log('Adding insurance_expiry column...');
        await client.query(`ALTER TABLE vehicles ADD COLUMN insurance_expiry DATE`);
        console.log('✅ Added insurance_expiry column');
      }
    } else {
      console.log('Creating vehicles table...');
      await client.query(`
        CREATE TABLE vehicles (
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
      console.log('✅ Created vehicles table');
    }
    
    // Check and fix participants table
    console.log('\n👥 Checking participants table...');
    const participantsExists = await checkTableExists(client, 'participants');
    
    if (participantsExists) {
      console.log('✅ Participants table exists');
      
      // Check for missing columns
      const columns = await getTableColumns(client, 'participants');
      console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
      
      // Add missing columns
      if (!columns.includes('supervision_multiplier')) {
        console.log('Adding supervision_multiplier column...');
        await client.query(`ALTER TABLE participants ADD COLUMN supervision_multiplier NUMERIC(3, 2) DEFAULT 1.0`);
        console.log('✅ Added supervision_multiplier column');
      }
      
      if (!columns.includes('plan_management_type')) {
        console.log('Adding plan_management_type column...');
        await client.query(`ALTER TABLE participants ADD COLUMN plan_management_type TEXT DEFAULT 'agency'`);
        console.log('✅ Added plan_management_type column');
      }
      
      if (!columns.includes('support_needs')) {
        console.log('Adding support_needs column...');
        await client.query(`ALTER TABLE participants ADD COLUMN support_needs JSONB DEFAULT '{"mobility": false, "communication": false, "medical": false, "behavioral": false, "personal_care": false}'`);
        console.log('✅ Added support_needs column');
      }
    } else {
      console.log('Creating participants table...');
      await client.query(`
        CREATE TABLE participants (
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
      console.log('✅ Created participants table');
    }
    
    // Check and fix staff table
    console.log('\n👨‍💼 Checking staff table...');
    const staffExists = await checkTableExists(client, 'staff');
    
    if (staffExists) {
      console.log('✅ Staff table exists');
      
      // Check for missing columns
      const columns = await getTableColumns(client, 'staff');
      console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
      
      // Add missing columns
      if (!columns.includes('schads_level')) {
        console.log('Adding schads_level column...');
        await client.query(`ALTER TABLE staff ADD COLUMN schads_level INTEGER DEFAULT 3`);
        console.log('✅ Added schads_level column');
      }
      
      if (!columns.includes('base_rate')) {
        console.log('Adding base_rate column...');
        await client.query(`ALTER TABLE staff ADD COLUMN base_rate NUMERIC(10, 2) DEFAULT 34.85`);
        console.log('✅ Added base_rate column');
      }
    } else {
      console.log('Creating staff table...');
      await client.query(`
        CREATE TABLE staff (
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
      console.log('✅ Created staff table');
    }
    
    // Check and fix venues table
    console.log('\n🏢 Checking venues table...');
    const venuesExists = await checkTableExists(client, 'venues');
    
    if (venuesExists) {
      console.log('✅ Venues table exists');
      
      // Check for missing columns
      const columns = await getTableColumns(client, 'venues');
      console.log(`Found ${columns.length} columns: ${columns.join(', ')}`);
      
      // Add missing columns
      if (!columns.includes('venue_type')) {
        console.log('Adding venue_type column...');
        await client.query(`ALTER TABLE venues ADD COLUMN venue_type TEXT DEFAULT 'community'`);
        console.log('✅ Added venue_type column');
      }
      
      if (!columns.includes('capacity')) {
        console.log('Adding capacity column...');
        await client.query(`ALTER TABLE venues ADD COLUMN capacity INTEGER DEFAULT 20`);
        console.log('✅ Added capacity column');
      }
      
      if (!columns.includes('amenities')) {
        console.log('Adding amenities column...');
        await client.query(`ALTER TABLE venues ADD COLUMN amenities JSONB DEFAULT '{"kitchen": false, "parking": false, "wifi": false, "outdoor_space": false, "air_conditioning": false, "projector": false, "bathroom": false}'`);
        console.log('✅ Added amenities column');
      }
      
      if (!columns.includes('accessibility')) {
        console.log('Adding accessibility column...');
        await client.query(`ALTER TABLE venues ADD COLUMN accessibility JSONB DEFAULT '{"wheelchair_access": false, "accessible_bathroom": false, "hearing_loop": false, "low_sensory_area": false, "elevator": false}'`);
        console.log('✅ Added accessibility column');
      }
    } else {
      console.log('Creating venues table...');
      await client.query(`
        CREATE TABLE venues (
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
      console.log('✅ Created venues table');
    }
    
    // Add sample data
    console.log('\n📊 Adding sample data...');
    
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
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Sample vehicles added');
    
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
      ON CONFLICT DO NOTHING
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
      ON CONFLICT DO NOTHING
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
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Sample venues added');
    
    // Create financial_records table if it doesn't exist
    const financialRecordsExists = await checkTableExists(client, 'financial_records');
    if (!financialRecordsExists) {
      console.log('Creating financial_records table...');
      await client.query(`
        CREATE TABLE financial_records (
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
      `);
      console.log('✅ Financial records table created with sample data');
      
      // Create master_cards view
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
    }
    
    // Create settings table if it doesn't exist
    const settingsExists = await checkTableExists(client, 'settings');
    if (!settingsExists) {
      console.log('Creating settings table...');
      await client.query(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add admin percentage setting
      await client.query(`
        INSERT INTO settings (key, value)
        VALUES ('admin_expense_percentage', '18.0')
      `);
      console.log('✅ Settings table created with admin percentage');
    } else {
      // Ensure admin percentage setting exists
      await client.query(`
        INSERT INTO settings (key, value)
        VALUES ('admin_expense_percentage', '18.0')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);
      console.log('✅ Admin percentage setting updated');
    }
    
    console.log('\n🎉 DATABASE FIX COMPLETE! 🎉');
    console.log('All tables have been checked and fixed with proper columns.');
    console.log('Sample data has been added.');
    console.log('\nYou can now run the backend with:');
    console.log('cd backend && node server.js');
    
  } catch (err) {
    console.error('❌ Fix failed:', err);
  } finally {
    await client.end();
  }
}

// Helper function to check if a table exists
async function checkTableExists(client, tableName) {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = $1
    )
  `, [tableName]);
  
  return res.rows[0].exists;
}

// Helper function to get columns for a table
async function getTableColumns(client, tableName) {
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
  `, [tableName]);
  
  return res.rows.map(row => row.column_name);
}

// Run the fix
fixTables();
