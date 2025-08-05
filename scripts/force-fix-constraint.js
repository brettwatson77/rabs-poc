/**
 * Force Fix Date Constraint Script
 * 
 * This script forcefully fixes the date constraint issue in the programs table
 * by explicitly dropping and recreating the constraint with the correct logic.
 * 
 * The issue: The current constraint requires end_date > start_date
 * The fix: Change to end_date >= start_date to allow one-off programs
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
  magenta: '\x1b[35m',
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
    log.header('DATABASE CONSTRAINT FORCE-FIX UTILITY');
    log.info(`Using PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port} with user '${dbConfig.user}'`);
    
    // Test connection
    log.info('Testing PostgreSQL connection...');
    const timeResult = await client.query('SELECT NOW() as now');
    const serverTime = timeResult.rows[0].now;
    log.success(`Connection successful! Server time: ${serverTime}`);
    
    // Start transaction
    log.info('Starting transaction...');
    await client.query('BEGIN');
    
    // Step 1: Check if the constraint exists
    log.info('Checking if constraint exists...');
    const constraintCheck = await client.query(`
      SELECT constraint_name, constraint_definition
      FROM information_schema.table_constraints tc
      JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
      JOIN pg_namespace nsp ON nsp.oid = pgc.connamespace
      JOIN pg_class cls ON pgc.conrelid = cls.oid
      LEFT JOIN pg_constraint_check pgcc ON pgc.oid = pgcc.constraint_oid
      WHERE tc.constraint_name = 'valid_program_dates'
        AND tc.table_name = 'programs'
        AND tc.constraint_schema = 'public'
    `);
    
    if (constraintCheck.rows.length === 0) {
      log.warning('Constraint "valid_program_dates" not found. Creating new constraint...');
    } else {
      // Step 2: Drop the existing constraint
      log.info('Found existing constraint. Dropping it...');
      await client.query(`
        ALTER TABLE programs DROP CONSTRAINT IF EXISTS valid_program_dates;
      `);
      log.success('Existing constraint dropped successfully');
    }
    
    // Step 3: Create the new constraint with the correct logic
    log.info('Adding new constraint that allows end_date >= start_date...');
    await client.query(`
      ALTER TABLE programs ADD CONSTRAINT valid_program_dates 
      CHECK (end_date IS NULL OR end_date >= start_date);
    `);
    log.success('New constraint added successfully');
    
    // Step 4: Verify the constraint was updated correctly
    const verifyConstraint = await client.query(`
      SELECT constraint_name, pg_get_constraintdef(pgc.oid) as constraint_definition
      FROM pg_constraint pgc
      JOIN pg_namespace nsp ON nsp.oid = pgc.connamespace
      JOIN pg_class cls ON pgc.conrelid = cls.oid
      WHERE pgc.conname = 'valid_program_dates'
        AND cls.relname = 'programs'
        AND nsp.nspname = 'public'
    `);
    
    if (verifyConstraint.rows.length === 0) {
      log.error('Verification failed: Constraint not found after creation!');
      throw new Error('Constraint creation verification failed');
    }
    
    const constraintDefinition = verifyConstraint.rows[0].constraint_definition;
    log.success(`Constraint verified: ${constraintDefinition}`);
    
    // Check if the constraint has the correct logic
    if (constraintDefinition.includes('>=')) {
      log.success('✨ Constraint has the correct logic (>= instead of >)');
    } else {
      log.error('Constraint still has incorrect logic. Expected >= but found different logic.');
      throw new Error('Constraint logic verification failed');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    log.success('Transaction committed successfully');
    
    // Log to system_logs if available
    try {
      await client.query(`
        INSERT INTO system_logs (level, message, source, metadata)
        VALUES ('info', 'Program date constraint fixed', 'force-fix-constraint.js', $1)
      `, [JSON.stringify({
        old_constraint: constraintCheck.rows.length > 0 ? constraintCheck.rows[0].constraint_definition : 'not found',
        new_constraint: constraintDefinition,
        executed_by: dbConfig.user,
        timestamp: new Date()
      })]);
    } catch (logError) {
      log.warning('Could not log to system_logs table (might not exist yet)');
    }
    
    // Step 5: Show all current constraints for the programs table
    log.header('CURRENT PROGRAMS TABLE CONSTRAINTS');
    const allConstraints = await client.query(`
      SELECT constraint_name, pg_get_constraintdef(pgc.oid) as constraint_definition
      FROM pg_constraint pgc
      JOIN pg_namespace nsp ON nsp.oid = pgc.connamespace
      JOIN pg_class cls ON pgc.conrelid = cls.oid
      WHERE cls.relname = 'programs'
        AND nsp.nspname = 'public'
      ORDER BY constraint_name
    `);
    
    allConstraints.rows.forEach(constraint => {
      console.log(`- ${constraint.constraint_name}: ${constraint.constraint_definition}`);
    });
    
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
