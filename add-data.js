/**
 * add-data.js - Sample Data Insertion Script
 * 
 * This script adds sample data to the PostgreSQL database with explicit UUID generation
 * to ensure the revolutionary UI has proper data to showcase.
 */

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

// PostgreSQL connection config from .env
const config = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'rabspocdb'
};

console.log('🚀 REVOLUTIONARY SAMPLE DATA INSERTION');
console.log('-------------------------------------');
console.log('Connecting to PostgreSQL...');

async function addSampleData() {
  const client = new Client(config);
  
  try {
    // Connect to the database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Clear existing data
    console.log('Clearing existing data (only existing tables)...');
    const tablesToTruncate = [
      'staff',
      'participants',
      'vehicles',
      'venues',
      'financial_records'
    ];

    const existingTables = [];
    for (const tableName of tablesToTruncate) {
      const existsRes = await client.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public'
              AND table_name = $1
        )`,
        [tableName]
      );
      if (existsRes.rows[0].exists) {
        existingTables.push(tableName);
      }
    }

    if (existingTables.length) {
      await client.query(`TRUNCATE ${existingTables.join(', ')} CASCADE`);
      console.log(`✅ Truncated tables: ${existingTables.join(', ')}`);
    } else {
      console.log('⚠️  No matching tables found to truncate – continuing.');
    }
    
    // Add staff with SCHADS levels
    console.log('\n👨‍💼 Adding staff data...');
    const staffData = [
      { id: uuidv4(), first_name: 'John', last_name: 'Smith', contact_phone: '0412345678', contact_email: 'john@example.com', contracted_hours: 38, schads_level: 2, base_rate: 32.54 },
      { id: uuidv4(), first_name: 'Sarah', last_name: 'Jones', contact_phone: '0423456789', contact_email: 'sarah@example.com', contracted_hours: 40, schads_level: 3, base_rate: 34.85 },
      { id: uuidv4(), first_name: 'Michael', last_name: 'Brown', contact_phone: '0434567890', contact_email: 'michael@example.com', contracted_hours: 20, schads_level: 4, base_rate: 36.88 },
      { id: uuidv4(), first_name: 'Emma', last_name: 'Wilson', contact_phone: '0445678901', contact_email: 'emma@example.com', contracted_hours: 38, schads_level: 3, base_rate: 34.85 },
      { id: uuidv4(), first_name: 'David', last_name: 'Taylor', contact_phone: '0456789012', contact_email: 'david@example.com', contracted_hours: 40, schads_level: 5, base_rate: 39.03 },
      { id: uuidv4(), first_name: 'Lisa', last_name: 'Anderson', contact_phone: '0467890123', contact_email: 'lisa@example.com', contracted_hours: 30, schads_level: 6, base_rate: 43.26 },
      { id: uuidv4(), first_name: 'James', last_name: 'Thomas', contact_phone: '0478901234', contact_email: 'james@example.com', contracted_hours: 38, schads_level: 7, base_rate: 46.71 },
      { id: uuidv4(), first_name: 'Jessica', last_name: 'White', contact_phone: '0489012345', contact_email: 'jessica@example.com', contracted_hours: 40, schads_level: 8, base_rate: 50.15 }
    ];
    
    for (const staff of staffData) {
      await client.query(`
        INSERT INTO staff (id, first_name, last_name, contact_phone, contact_email, contracted_hours, schads_level, base_rate)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [staff.id, staff.first_name, staff.last_name, staff.contact_phone, staff.contact_email, staff.contracted_hours, staff.schads_level, staff.base_rate]);
    }
    console.log(`✅ Added ${staffData.length} staff members with SCHADS levels`);
    
    // Add participants with supervision multipliers
    console.log('\n👥 Adding participants data...');
    const participantsData = [
      { 
        id: uuidv4(), 
        first_name: 'Alex', 
        last_name: 'Taylor', 
        ndis_number: 'NDIS1234567', 
        contact_phone: '0456789012', 
        supervision_multiplier: 1.0, 
        plan_management_type: 'agency',
        support_needs: JSON.stringify({"mobility": false, "communication": false, "medical": false, "behavioral": false, "personal_care": false})
      },
      { 
        id: uuidv4(), 
        first_name: 'Jessica', 
        last_name: 'Martin', 
        ndis_number: 'NDIS2345678', 
        contact_phone: '0467890123', 
        supervision_multiplier: 1.25, 
        plan_management_type: 'plan',
        support_needs: JSON.stringify({"mobility": true, "communication": false, "medical": false, "behavioral": false, "personal_care": false})
      },
      { 
        id: uuidv4(), 
        first_name: 'David', 
        last_name: 'Clark', 
        ndis_number: 'NDIS3456789', 
        contact_phone: '0478901234', 
        supervision_multiplier: 1.5, 
        plan_management_type: 'self',
        support_needs: JSON.stringify({"mobility": true, "communication": true, "medical": false, "behavioral": false, "personal_care": true})
      },
      { 
        id: uuidv4(), 
        first_name: 'Olivia', 
        last_name: 'Walker', 
        ndis_number: 'NDIS4567890', 
        contact_phone: '0489012345', 
        supervision_multiplier: 2.0, 
        plan_management_type: 'ndia',
        support_needs: JSON.stringify({"mobility": true, "communication": true, "medical": true, "behavioral": true, "personal_care": true})
      },
      { 
        id: uuidv4(), 
        first_name: 'William', 
        last_name: 'Green', 
        ndis_number: 'NDIS5678901', 
        contact_phone: '0490123456', 
        supervision_multiplier: 1.0, 
        plan_management_type: 'agency',
        support_needs: JSON.stringify({"mobility": false, "communication": true, "medical": false, "behavioral": false, "personal_care": false})
      },
      { 
        id: uuidv4(), 
        first_name: 'Sophia', 
        last_name: 'Adams', 
        ndis_number: 'NDIS6789012', 
        contact_phone: '0401234567', 
        supervision_multiplier: 1.75, 
        plan_management_type: 'plan',
        support_needs: JSON.stringify({"mobility": true, "communication": false, "medical": true, "behavioral": true, "personal_care": false})
      },
      { 
        id: uuidv4(), 
        first_name: 'Ethan', 
        last_name: 'Baker', 
        ndis_number: 'NDIS7890123', 
        contact_phone: '0412345678', 
        supervision_multiplier: 2.25, 
        plan_management_type: 'self',
        support_needs: JSON.stringify({"mobility": true, "communication": true, "medical": true, "behavioral": true, "personal_care": true})
      },
      { 
        id: uuidv4(), 
        first_name: 'Ava', 
        last_name: 'Carter', 
        ndis_number: 'NDIS8901234', 
        contact_phone: '0423456789', 
        supervision_multiplier: 1.5, 
        plan_management_type: 'ndia',
        support_needs: JSON.stringify({"mobility": false, "communication": false, "medical": true, "behavioral": true, "personal_care": true})
      }
    ];
    
    for (const participant of participantsData) {
      await client.query(`
        INSERT INTO participants (id, first_name, last_name, ndis_number, contact_phone, supervision_multiplier, plan_management_type, support_needs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [participant.id, participant.first_name, participant.last_name, participant.ndis_number, participant.contact_phone, participant.supervision_multiplier, participant.plan_management_type, participant.support_needs]);
    }
    console.log(`✅ Added ${participantsData.length} participants with supervision multipliers`);
    
    // Add vehicles with types and status
    console.log('\n🚗 Adding vehicles data...');
    const vehiclesData = [
      { id: uuidv4(), description: 'Toyota HiAce', registration: 'ABC123', seats: 12, vehicle_type: 'Van', wheelchair_access: false, status: 'Available' },
      { id: uuidv4(), description: 'Ford Transit', registration: 'DEF456', seats: 15, vehicle_type: 'Bus', wheelchair_access: false, status: 'Available' },
      { id: uuidv4(), description: 'Mercedes Sprinter', registration: 'GHI789', seats: 10, vehicle_type: 'WAV', wheelchair_access: true, status: 'Available' },
      { id: uuidv4(), description: 'Toyota Coaster', registration: 'JKL012', seats: 20, vehicle_type: 'Bus', wheelchair_access: false, status: 'In Use' },
      { id: uuidv4(), description: 'Volkswagen Crafter', registration: 'MNO345', seats: 12, vehicle_type: 'WAV', wheelchair_access: true, status: 'Maintenance' },
      { id: uuidv4(), description: 'Toyota Commuter', registration: 'PQR678', seats: 14, vehicle_type: 'Van', wheelchair_access: false, status: 'Available' },
      { id: uuidv4(), description: 'Mitsubishi Rosa', registration: 'STU901', seats: 25, vehicle_type: 'Bus', wheelchair_access: false, status: 'Out of Service' },
      { id: uuidv4(), description: 'Ford Kuga', registration: 'VWX234', seats: 5, vehicle_type: 'Car', wheelchair_access: false, status: 'Available' }
    ];
    
    for (const vehicle of vehiclesData) {
      await client.query(`
        INSERT INTO vehicles (id, description, registration, seats, vehicle_type, wheelchair_access, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [vehicle.id, vehicle.description, vehicle.registration, vehicle.seats, vehicle.vehicle_type, vehicle.wheelchair_access, vehicle.status]);
    }
    console.log(`✅ Added ${vehiclesData.length} vehicles with types and status`);
    
    // Add venues with amenities and accessibility
    console.log('\n🏢 Adding venues data...');
    const venuesData = [
      { 
        id: uuidv4(), 
        name: 'Main Centre', 
        address: '123 Main St', 
        suburb: 'Brisbane', 
        postcode: '4000', 
        venue_type: 'main', 
        capacity: 50,
        booking_lead_time: 48,
        amenities: JSON.stringify({"kitchen": true, "parking": true, "wifi": true, "outdoor_space": true, "air_conditioning": true, "projector": true, "bathroom": true}),
        accessibility: JSON.stringify({"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": true, "elevator": true}),
        status: 'active'
      },
      { 
        id: uuidv4(), 
        name: 'Community Hall', 
        address: '456 Park Ave', 
        suburb: 'Brisbane', 
        postcode: '4000', 
        venue_type: 'community', 
        capacity: 30,
        booking_lead_time: 72,
        amenities: JSON.stringify({"kitchen": true, "parking": true, "wifi": false, "outdoor_space": true, "air_conditioning": false, "projector": false, "bathroom": true}),
        accessibility: JSON.stringify({"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": false, "low_sensory_area": false, "elevator": false}),
        status: 'active'
      },
      { 
        id: uuidv4(), 
        name: 'Partner Location', 
        address: '789 River Rd', 
        suburb: 'Brisbane', 
        postcode: '4000', 
        venue_type: 'partner', 
        capacity: 25,
        booking_lead_time: 96,
        amenities: JSON.stringify({"kitchen": false, "parking": true, "wifi": true, "outdoor_space": false, "air_conditioning": true, "projector": true, "bathroom": true}),
        accessibility: JSON.stringify({"wheelchair_access": true, "accessible_bathroom": false, "hearing_loop": false, "low_sensory_area": true, "elevator": false}),
        status: 'active'
      },
      { 
        id: uuidv4(), 
        name: 'Recreation Center', 
        address: '101 Beach Blvd', 
        suburb: 'Gold Coast', 
        postcode: '4217', 
        venue_type: 'community', 
        capacity: 40,
        booking_lead_time: 48,
        amenities: JSON.stringify({"kitchen": true, "parking": true, "wifi": true, "outdoor_space": true, "air_conditioning": true, "projector": true, "bathroom": true}),
        accessibility: JSON.stringify({"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": false, "elevator": true}),
        status: 'active'
      },
      { 
        id: uuidv4(), 
        name: 'Training Facility', 
        address: '202 Mountain View', 
        suburb: 'Brisbane', 
        postcode: '4000', 
        venue_type: 'main', 
        capacity: 35,
        booking_lead_time: 24,
        amenities: JSON.stringify({"kitchen": true, "parking": true, "wifi": true, "outdoor_space": false, "air_conditioning": true, "projector": true, "bathroom": true}),
        accessibility: JSON.stringify({"wheelchair_access": true, "accessible_bathroom": true, "hearing_loop": true, "low_sensory_area": true, "elevator": true}),
        status: 'under_maintenance'
      }
    ];
    
    for (const venue of venuesData) {
      await client.query(`
        INSERT INTO venues (id, name, address, suburb, postcode, venue_type, capacity, booking_lead_time, amenities, accessibility, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [venue.id, venue.name, venue.address, venue.suburb, venue.postcode, venue.venue_type, venue.capacity, venue.booking_lead_time, venue.amenities, venue.accessibility, venue.status]);
    }
    console.log(`✅ Added ${venuesData.length} venues with amenities and accessibility`);
    
    // Add financial data for dashboard
    console.log('\n📊 Adding financial data...');
    
    // Check if financial_records table exists
    const financialTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'financial_records'
      )
    `);
    
    if (!financialTableCheck.rows[0].exists) {
      console.log('Creating financial_records table...');
      await client.query(`
        CREATE TABLE financial_records (
          id UUID PRIMARY KEY,
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
    }
    
    // Add sample financial records
    const financialData = [
      { id: uuidv4(), date: '2025-07-27', program_name: 'Monday Centre-Based', participant_count: 8, virtual_participant_count: 10.5, revenue: 2400.00, staff_costs: 1200.00, admin_costs: 432.00 },
      { id: uuidv4(), date: '2025-07-27', program_name: 'Swimming Program', participant_count: 6, virtual_participant_count: 9.0, revenue: 1800.00, staff_costs: 950.00, admin_costs: 324.00 },
      { id: uuidv4(), date: '2025-07-26', program_name: 'Weekend Outing', participant_count: 10, virtual_participant_count: 12.0, revenue: 3000.00, staff_costs: 1500.00, admin_costs: 540.00 },
      { id: uuidv4(), date: '2025-07-25', program_name: 'Friday Social', participant_count: 12, virtual_participant_count: 13.5, revenue: 3600.00, staff_costs: 1800.00, admin_costs: 648.00 },
      { id: uuidv4(), date: '2025-07-24', program_name: 'Art Therapy', participant_count: 7, virtual_participant_count: 8.75, revenue: 2100.00, staff_costs: 1050.00, admin_costs: 378.00 },
      { id: uuidv4(), date: '2025-07-23', program_name: 'Music Group', participant_count: 9, virtual_participant_count: 11.25, revenue: 2700.00, staff_costs: 1350.00, admin_costs: 486.00 },
      { id: uuidv4(), date: '2025-07-22', program_name: 'Cooking Class', participant_count: 8, virtual_participant_count: 10.0, revenue: 2400.00, staff_costs: 1200.00, admin_costs: 432.00 },
      { id: uuidv4(), date: '2025-07-21', program_name: 'Monday Centre-Based', participant_count: 10, virtual_participant_count: 12.5, revenue: 3000.00, staff_costs: 1500.00, admin_costs: 540.00 },
      { id: uuidv4(), date: '2025-07-20', program_name: 'Weekend Outing', participant_count: 14, virtual_participant_count: 17.5, revenue: 4200.00, staff_costs: 2100.00, admin_costs: 756.00 },
      { id: uuidv4(), date: '2025-07-19', program_name: 'Saturday Program', participant_count: 12, virtual_participant_count: 15.0, revenue: 3600.00, staff_costs: 1800.00, admin_costs: 648.00 },
      // Add more periods for week/fortnight/month views
      { id: uuidv4(), date: '2025-07-18', program_name: 'Friday Social', participant_count: 11, virtual_participant_count: 13.0, revenue: 3300.00, staff_costs: 1650.00, admin_costs: 594.00 },
      { id: uuidv4(), date: '2025-07-17', program_name: 'Art Therapy', participant_count: 8, virtual_participant_count: 10.0, revenue: 2400.00, staff_costs: 1200.00, admin_costs: 432.00 },
      { id: uuidv4(), date: '2025-07-16', program_name: 'Music Group', participant_count: 10, virtual_participant_count: 12.5, revenue: 3000.00, staff_costs: 1500.00, admin_costs: 540.00 },
      { id: uuidv4(), date: '2025-07-15', program_name: 'Cooking Class', participant_count: 9, virtual_participant_count: 11.25, revenue: 2700.00, staff_costs: 1350.00, admin_costs: 486.00 },
      { id: uuidv4(), date: '2025-07-14', program_name: 'Monday Centre-Based', participant_count: 11, virtual_participant_count: 13.75, revenue: 3300.00, staff_costs: 1650.00, admin_costs: 594.00 },
      { id: uuidv4(), date: '2025-07-13', program_name: 'Weekend Outing', participant_count: 13, virtual_participant_count: 16.25, revenue: 3900.00, staff_costs: 1950.00, admin_costs: 702.00 },
      { id: uuidv4(), date: '2025-07-12', program_name: 'Saturday Program', participant_count: 10, virtual_participant_count: 12.5, revenue: 3000.00, staff_costs: 1500.00, admin_costs: 540.00 },
      { id: uuidv4(), date: '2025-07-11', program_name: 'Friday Social', participant_count: 9, virtual_participant_count: 11.25, revenue: 2700.00, staff_costs: 1350.00, admin_costs: 486.00 },
      { id: uuidv4(), date: '2025-07-10', program_name: 'Art Therapy', participant_count: 6, virtual_participant_count: 7.5, revenue: 1800.00, staff_costs: 900.00, admin_costs: 324.00 },
      { id: uuidv4(), date: '2025-07-09', program_name: 'Music Group', participant_count: 8, virtual_participant_count: 10.0, revenue: 2400.00, staff_costs: 1200.00, admin_costs: 432.00 }
    ];
    
    for (const record of financialData) {
      await client.query(`
        INSERT INTO financial_records (id, date, program_name, participant_count, virtual_participant_count, revenue, staff_costs, admin_costs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [record.id, record.date, record.program_name, record.participant_count, record.virtual_participant_count, record.revenue, record.staff_costs, record.admin_costs]);
    }
    console.log(`✅ Added ${financialData.length} financial records`);
    
    // Create master_cards view
    console.log('\n🔄 Creating master_cards view...');
    await client.query(`
      DROP VIEW IF EXISTS master_cards;
      CREATE VIEW master_cards AS
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
    console.log('✅ Created master_cards view');
    
    // Add settings
    console.log('\n⚙️ Adding settings...');
    const settingsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'settings'
      )
    `);
    
    if (!settingsTableCheck.rows[0].exists) {
      console.log('Creating settings table...');
      await client.query(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Add admin percentage setting
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('admin_expense_percentage', '18.0')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `);
    console.log('✅ Added admin expense percentage setting');
    
    console.log('\n🎉 REVOLUTIONARY SAMPLE DATA ADDED SUCCESSFULLY! 🎉');
    console.log('Your frontend is ready to showcase all revolutionary features!');
    console.log('\nYou can now run the backend with:');
    console.log('cd backend && node server.js');
    console.log('\nAnd the frontend with:');
    console.log('cd frontend && npm start');
    
  } catch (err) {
    console.error('❌ Data insertion failed:', err);
  } finally {
    await client.end();
  }
}

// Run the script
addSampleData();
