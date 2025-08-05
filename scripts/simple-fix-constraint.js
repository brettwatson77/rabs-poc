/**
 * Simple Fix Date Constraint Script
 * 
 * This script simply drops and recreates the date constraint in the programs table
 * to allow one-off programs where end_date = start_date.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rabspocdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Create a new pool
const pool = new Pool(dbConfig);

// Console styling
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper function to log with colors
const log = {
  info: (msg) => console.log(`${styles.blue}ℹ️ ${msg}${styles.reset}`),
  success: (msg) => console.log(`${styles.green}✅ ${msg}${styles.reset}`),
  error: (msg) => console.log(`${styles.red}❌ ${msg}${styles.reset}`),
  warning: (msg) => console.log(`${styles.yellow}⚠️ ${msg}${styles.reset}`),
  header: (msg) => console.log(`\n${styles.bright}${styles.cyan}${msg}${styles.reset}\n${'='.repeat(80)}`),
};

/**
 * Main function to fix the constraint
 */
async function fixConstraint() {
  const client = await pool.connect();
  
  try {
    log.header('SIMPLE DATABASE CONSTRAINT FIX');
    log.info(`Using PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port} with user '${dbConfig.user}'`);
    
    // Test connection
    log.info('Testing PostgreSQL connection...');
    const timeResult = await client.query('SELECT NOW() as now');
    const serverTime = timeResult.rows[0].now;
    log.success(`Connection successful! Server time: ${serverTime}`);
    
    // Start transaction
    log.info('Starting transaction...');
    await client.query('BEGIN');
    
    // Step 1: Drop the existing constraint (if it exists)
    log.info('Dropping existing constraint...');
    await client.query(`
      ALTER TABLE programs DROP CONSTRAINT IF EXISTS valid_program_dates;
    `);
    log.success('Existing constraint dropped successfully');
    
    // Step 2: Create the new constraint with the correct logic
    log.info('Adding new constraint that allows end_date >= start_date...');
    await client.query(`
      ALTER TABLE programs ADD CONSTRAINT valid_program_dates 
      CHECK (end_date IS NULL OR end_date >= start_date);
    `);
    log.success('New constraint added successfully');
    
    // Commit the transaction
    await client.query('COMMIT');
    log.success('Transaction committed successfully');
    
    // Try to log to system_logs if available
    try {
      await client.query(`
        INSERT INTO system_logs (level, message, source, metadata)
        VALUES ('info', 'Program date constraint fixed', 'simple-fix-constraint.js', $1)
      `, [JSON.stringify({
        action: 'constraint_fix',
        new_logic: 'end_date IS NULL OR end_date >= start_date',
        executed_by: dbConfig.user,
        timestamp: new Date()
      })]);
    } catch (logError) {
      log.warning('Could not log to system_logs table (might not exist yet)');
    }
    
    // Step 3: Show next steps
    log.header('NEXT STEPS');
    console.log(`${styles.bright}1. Try creating a program again with end_date = start_date${styles.reset}`);
    console.log(`${styles.bright}2. The 500 error should be resolved${styles.reset}`);
    console.log(`${styles.bright}3. Run node scripts/check-program-data.js after creating a program to verify all data${styles.reset}`);
    
    log.success('✨ Constraint fix completed successfully!');
    
  } catch (error) {
    // Rollback the transaction in case of error
    await client.query('ROLLBACK');
    log.error(`Error fixing constraint: ${error.message}`);
    log.error('Transaction rolled back');
    log.error(`Database: ${dbConfig.database}, User: ${dbConfig.user}`);
    console.error(error);
  } finally {
    // Release the client back to the pool
    client.release();
    await pool.end();
  }
}

// Run the main function
fixConstraint().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
