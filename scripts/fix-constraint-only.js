/**
 * Fix Constraint Only Script
 * 
 * This script only fixes the date constraint issue without running the full migrations.
 * It drops the existing valid_program_dates constraint and adds a new one that allows
 * end_date = start_date for one-off programs.
 * 
 * Usage: node scripts/fix-constraint-only.js
 */

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
    return false;
  } finally {
    client.release();
  }
}

/**
 * Fix the date constraint issue
 * @returns {Promise<void>}
 */
async function fixDateConstraint() {
  console.log('\n🔧 Fixing date constraint issue...');
  
  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Check if constraint exists
    const checkConstraintQuery = `
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'valid_program_dates' 
      AND conrelid = 'programs'::regclass;
    `;
    
    const constraintCheck = await client.query(checkConstraintQuery);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✅ Found existing valid_program_dates constraint, dropping it...');
      
      // Step 2: Drop the existing constraint
      await client.query('ALTER TABLE programs DROP CONSTRAINT valid_program_dates');
      console.log('✅ Existing constraint dropped successfully');
    } else {
      console.log('⚠️ No existing valid_program_dates constraint found');
    }
    
    // Step 3: Add the new constraint
    console.log('✅ Adding new constraint that allows end_date >= start_date...');
    await client.query(`
      ALTER TABLE programs
      ADD CONSTRAINT valid_program_dates 
      CHECK (end_date IS NULL OR end_date >= start_date)
    `);
    
    // Step 4: Add a comment explaining the constraint
    await client.query(`
      COMMENT ON CONSTRAINT valid_program_dates ON programs IS 
      'Ensures program dates are valid: NULL end_date for ongoing programs, or end_date >= start_date for one-off/fixed-end programs'
    `);
    
    // Step 5: Log the change if system_logs table exists
    try {
      await client.query(`
        INSERT INTO system_logs (
          severity, 
          category, 
          message, 
          details
        ) VALUES (
          'info', 
          'database_migration', 
          'Fixed program date constraint', 
          'Updated valid_program_dates constraint to allow end_date = start_date for one-off programs'
        )
      `);
    } catch (error) {
      console.log('⚠️ Could not log to system_logs table (might not exist yet)');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Date constraint fixed successfully!');
    
    // Step 6: Show current table structure
    console.log('\n📊 Current programs table constraints:');
    const constraintsQuery = `
      SELECT con.conname as constraint_name, 
             pg_get_constraintdef(con.oid) as constraint_definition
      FROM pg_constraint con 
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'programs' 
      AND nsp.nspname = 'public';
    `;
    
    const constraints = await client.query(constraintsQuery);
    constraints.rows.forEach(row => {
      console.log(`- ${row.constraint_name}: ${row.constraint_definition}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing date constraint:');
    console.error(error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      console.error('\n❌ Cannot proceed due to connection failure.');
      process.exit(1);
    }
    
    // Fix constraint
    await fixDateConstraint();
    
    console.log('\n✨ Constraint fix completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Try creating a program again with end_date = start_date');
    console.log('2. Verify the program is created successfully');
    
  } catch (error) {
    console.error('\n❌ Fix failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run the script
main();
