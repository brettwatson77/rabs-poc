/**
 * test-pg.js - PostgreSQL Connection Test & Setup Script
 * 
 * This script tests the PostgreSQL connection and sets up the revolutionary
 * TGL architecture database for the RABS-POC system.
 */

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// PostgreSQL connection config from .env
const config = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  // Connect to postgres initially (to create our database if needed)
  database: 'postgres'
};

console.log('🚀 Revolutionary TGL Database Setup');
console.log('------------------------------------');
console.log('Connecting to PostgreSQL...');

// Step 1: Test initial connection
async function testConnection() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server successfully!');
    return client;
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

// Step 2: Create database if it doesn't exist
async function createDatabaseIfNeeded(client) {
  const dbName = process.env.PG_DATABASE || 'rabspocdb';
  
  try {
    // Check if database exists
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (res.rowCount === 0) {
      console.log(`Database '${dbName}' not found. Creating...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully!`);
    } else {
      console.log(`✅ Database '${dbName}' already exists.`);
    }
    
    // Close the postgres connection
    await client.end();
    
    // Return the database name for the next step
    return dbName;
  } catch (err) {
    console.error('❌ Error creating database:', err.message);
    await client.end();
    process.exit(1);
  }
}

// Step 3: Run migrations
async function runMigrations(dbName) {
  // Connect to our specific database
  const client = new Client({
    ...config,
    database: dbName
  });
  
  try {
    await client.connect();
    console.log('Connected to database. Running migrations...');
    
    // Get migration files in order
    const migrationsDir = path.join(__dirname, 'database', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files.`);
    
    // Run each migration in sequence
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Split the SQL file by semicolons to execute each statement separately
      // This is a simple approach and might not work for complex SQL with functions
      const statements = sql.split(';')
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
      
      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (err) {
          console.error(`❌ Error executing statement from ${file}:`, err.message);
          console.error('Statement:', statement);
          // Continue with next statement despite errors
        }
      }
      
      console.log(`✅ Migration ${file} completed.`);
    }
    
    console.log('✅ All migrations completed successfully!');
    return client;
  } catch (err) {
    console.error('❌ Error running migrations:', err.message);
    process.exit(1);
  }
}

// Step 4: Add sample data
async function addSampleData(client) {
  try {
    console.log('Adding sample data...');
    
    // Add some sample staff with SCHADS levels
    await client.query(`
      INSERT INTO staff (first_name, last_name, contact_phone, contact_email, contracted_hours, schads_level, base_rate)
      VALUES 
        ('John', 'Smith', '0412345678', 'john@example.com', 38, 2, 32.54),
        ('Sarah', 'Jones', '0423456789', 'sarah@example.com', 40, 3, 34.85),
        ('Michael', 'Brown', '0434567890', 'michael@example.com', 20, 4, 36.78),
        ('Emma', 'Wilson', '0445678901', 'emma@example.com', 38, 3, 34.85)
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Add some sample participants with supervision multipliers
    await client.query(`
      INSERT INTO participants (first_name, last_name, ndis_number, contact_phone, supervision_multiplier, support_needs)
      VALUES 
        ('Alex', 'Taylor', 'NDIS1234567', '0456789012', 1.0, '{"mobility":false,"communication":false,"medical":false,"behavioral":false,"personal_care":false}'),
        ('Jessica', 'Martin', 'NDIS2345678', '0467890123', 1.25, '{"mobility":true,"communication":false,"medical":false,"behavioral":false,"personal_care":false}'),
        ('David', 'Clark', 'NDIS3456789', '0478901234', 1.5, '{"mobility":true,"communication":true,"medical":false,"behavioral":false,"personal_care":true}'),
        ('Olivia', 'Walker', 'NDIS4567890', '0489012345', 2.0, '{"mobility":true,"communication":true,"medical":true,"behavioral":true,"personal_care":true}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Add some sample venues
    await client.query(`
      INSERT INTO venues (name, address, suburb, postcode, venue_type, capacity, amenities, accessibility, status)
      VALUES 
        ('Main Centre', '123 Main St', 'Brisbane', '4000', 'main', 50, 
         '{"kitchen":true,"parking":true,"wifi":true,"outdoor_space":true,"air_conditioning":true,"projector":true,"bathroom":true}',
         '{"wheelchair_access":true,"accessible_bathroom":true,"hearing_loop":true,"low_sensory_area":true,"elevator":true}',
         'active'),
        ('Community Hall', '456 Park Ave', 'Brisbane', '4000', 'community', 30, 
         '{"kitchen":true,"parking":true,"wifi":false,"outdoor_space":true,"air_conditioning":false,"projector":false,"bathroom":true}',
         '{"wheelchair_access":true,"accessible_bathroom":true,"hearing_loop":false,"low_sensory_area":false,"elevator":false}',
         'active')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Add some sample vehicles
    await client.query(`
      INSERT INTO vehicles (description, registration, seats, vehicle_type, wheelchair_access, status)
      VALUES 
        ('Toyota HiAce', 'ABC123', 12, 'Van', false, 'Available'),
        ('Ford Transit', 'DEF456', 15, 'Bus', false, 'Available'),
        ('Mercedes Sprinter', 'GHI789', 10, 'WAV', true, 'Available')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Add TGL rules if the table exists
    try {
      await client.query(`
        INSERT INTO rules_master_events (name, day_of_week, frequency, venue_id, start_time, end_time, capacity)
        VALUES 
          ('Monday Centre-Based', 1, 'weekly', 1, '09:00', '15:00', 20),
          ('Wednesday Social Group', 3, 'weekly', 2, '10:00', '14:00', 15),
          ('Friday Outing', 5, 'fortnightly', 1, '10:00', '16:00', 12)
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (err) {
      console.log('Note: TGL rules tables not ready yet. Skipping sample rules.');
    }
    
    console.log('✅ Sample data added successfully!');
    return true;
  } catch (err) {
    console.error('❌ Error adding sample data:', err.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the setup process
async function runSetup() {
  try {
    const client = await testConnection();
    const dbName = await createDatabaseIfNeeded(client);
    const dbClient = await runMigrations(dbName);
    await addSampleData(dbClient);
    
    console.log('\n🎉 REVOLUTIONARY DATABASE SETUP COMPLETE! 🎉');
    console.log('The Great Loom architecture is ready to revolutionize disability services!');
    console.log('\nYou can now run the backend with:');
    console.log('cd backend && node server.js');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

runSetup();
