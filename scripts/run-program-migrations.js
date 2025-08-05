/**
 * Run Program Migrations Script
 * 
 * This script runs the necessary migrations for the RABS program creation functionality:
 * 1. 010_programs_schema_update.sql - Updates programs table with new columns
 * 2. 011_time_slots_table.sql - Creates time slots table for dashboard cards
 * 3. Ensures loom_window_weeks setting exists in settings table
 * 
 * Usage: node scripts/run-program-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rabspocdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

console.log(`Using PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port} with user '${dbConfig.user}'`);

// Create database pool
const pool = new Pool(dbConfig);

// Migration paths
const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
const migration010Path = path.join(migrationsDir, '010_programs_schema_update.sql');
const migration011Path = path.join(migrationsDir, '011_time_slots_table.sql');
const migration012Path = path.join(migrationsDir, '012_fix_date_constraint.sql');

/**
 * Test database connection before proceeding
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  console.log('\n🔌 Testing PostgreSQL connection...');
  
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() as now');
    console.log(`✅ Connection successful! Server time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Connection details: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    if (error.message.includes('role')) {
      console.error('\n⚠️ Authentication error: Check that your PostgreSQL user and password are correct in .env file');
    }
    if (error.message.includes('does not exist')) {
      console.error(`\n⚠️ Database '${dbConfig.database}' might not exist. Create it with:`);
      console.error(`   createdb -U ${dbConfig.user} ${dbConfig.database}`);
    }
    return false;
  } finally {
    client.release();
  }
}

/**
 * Execute a SQL file
 * @param {string} filePath - Path to SQL file
 * @param {string} description - Description for logging
 * @returns {Promise<void>}
 */
async function executeSqlFile(filePath, description) {
  console.log(`\n📂 Executing ${description}...`);
  
  try {
    // Read SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Execute SQL
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log(`✅ ${description} executed successfully`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Error executing ${description}:`);
    console.error(error.message);
    console.error(`Database: ${dbConfig.database}, User: ${dbConfig.user}`);
    throw error;
  }
}

/**
 * Check if loom_window_weeks setting exists, add if missing
 * @returns {Promise<void>}
 */
async function ensureLoomWindowSetting() {
  console.log('\n🔍 Checking loom_window_weeks setting...');
  
  const client = await pool.connect();
  try {
    // Check if setting exists
    const result = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (result.rows.length === 0) {
      console.log('⚠️ loom_window_weeks setting not found, adding with default value 8');
      
      // Add setting
      await client.query(
        'INSERT INTO settings (key, value, description) VALUES ($1, $2, $3)',
        ['loom_window_weeks', '8', 'Number of weeks in the loom window']
      );
      
      console.log('✅ loom_window_weeks setting added successfully');
    } else {
      console.log(`✅ loom_window_weeks setting exists with value: ${result.rows[0].value}`);
    }
  } catch (error) {
    console.error('❌ Error checking loom_window_weeks setting:');
    console.error(error.message);
    console.error(`Database: ${dbConfig.database}, User: ${dbConfig.user}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all migrations
 */
async function runMigrations() {
  try {
    console.log('🚀 Starting program migrations...');
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.error('\n❌ Cannot proceed with migrations due to connection failure.');
      process.exit(1);
    }
    
    // Execute migrations
    await executeSqlFile(migration010Path, 'Migration 010: Programs Schema Update');
    await executeSqlFile(migration011Path, 'Migration 011: Time Slots Table');
    await executeSqlFile(migration012Path, 'Migration 012: Fix Program Date Constraint');
    
    // Ensure loom_window_weeks setting exists
    await ensureLoomWindowSetting();
    
    console.log('\n✨ All program migrations completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update frontend to use new program creation endpoints');
    console.log('2. Test creating programs with time slots and participants');
    console.log('3. Verify dashboard cards, roster shifts, and billing entries');
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error(`Connection details: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    process.exit(1);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run migrations
runMigrations();
