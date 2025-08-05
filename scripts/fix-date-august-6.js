/**
 * Fix August 5th to August 6th Date Script
 * 
 * This script updates all loom instances from August 5th to August 6th
 * to match the expected demo date. After running this script, cards should
 * properly appear on August 6th in the Master Schedule.
 * 
 * Usage: node scripts/fix-date-august-6.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

// Create database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'rabspocdb',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

/**
 * Main function to update dates
 */
async function fixAugust6thDates() {
  console.log('\n' + '*'.repeat(80));
  console.log(`${colors.bright}${colors.green}FIX AUGUST 5TH TO AUGUST 6TH DATES${colors.reset}`);
  console.log('*'.repeat(80) + '\n');

  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`${colors.yellow}Checking for instances with August 5th date...${colors.reset}`);
    
    // First, check how many records will be affected
    const checkResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM tgl_loom_instances 
      WHERE date::date = '2025-08-05'::date OR instance_date::date = '2025-08-05'::date
    `);
    
    const recordCount = parseInt(checkResult.rows[0].count);
    
    if (recordCount === 0) {
      console.log(`${colors.yellow}No instances found with August 5th date.${colors.reset}`);
      console.log(`${colors.yellow}Checking for instances with August 6th date...${colors.reset}`);
      
      const check6thResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM tgl_loom_instances 
        WHERE date::date = '2025-08-06'::date OR instance_date::date = '2025-08-06'::date
      `);
      
      const record6thCount = parseInt(check6thResult.rows[0].count);
      
      if (record6thCount > 0) {
        console.log(`${colors.green}Found ${record6thCount} instances already with August 6th date.${colors.reset}`);
        console.log(`${colors.green}No update needed - cards should already display for August 6th.${colors.reset}`);
      } else {
        console.log(`${colors.red}No instances found for either August 5th or 6th.${colors.reset}`);
        console.log(`${colors.yellow}You may need to create a program for the demo.${colors.reset}`);
      }
      
      await client.query('COMMIT');
      return;
    }
    
    console.log(`${colors.yellow}Found ${recordCount} instances with August 5th date.${colors.reset}`);
    console.log(`${colors.yellow}Updating to August 6th...${colors.reset}`);
    
    // Update the date column
    const updateDateResult = await client.query(`
      UPDATE tgl_loom_instances 
      SET date = date + interval '1 day'
      WHERE date::date = '2025-08-05'::date
      RETURNING id, date
    `);
    
    // Update the instance_date column
    const updateInstanceDateResult = await client.query(`
      UPDATE tgl_loom_instances 
      SET instance_date = instance_date + interval '1 day'
      WHERE instance_date::date = '2025-08-05'::date
      RETURNING id, instance_date
    `);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Show results
    console.log(`\n${colors.bright}${colors.green}UPDATE SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.green}Updated ${updateDateResult.rowCount} records in 'date' column${colors.reset}`);
    console.log(`${colors.green}Updated ${updateInstanceDateResult.rowCount} records in 'instance_date' column${colors.reset}`);
    
    // Verify the update
    console.log(`\n${colors.yellow}Verifying update...${colors.reset}`);
    
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM tgl_loom_instances 
      WHERE date::date = '2025-08-06'::date OR instance_date::date = '2025-08-06'::date
    `);
    
    const verifyCount = parseInt(verifyResult.rows[0].count);
    
    if (verifyCount >= recordCount) {
      console.log(`${colors.green}Verification successful! Found ${verifyCount} instances with August 6th date.${colors.reset}`);
      console.log(`${colors.green}Cards should now display properly in Master Schedule for August 6th.${colors.reset}`);
    } else {
      console.log(`${colors.red}Verification failed. Expected at least ${recordCount} records, found ${verifyCount}.${colors.reset}`);
    }
    
    // Get some sample records to show
    const sampleRecords = await client.query(`
      SELECT id, date, instance_date, program_name
      FROM tgl_loom_instances
      WHERE date::date = '2025-08-06'::date OR instance_date::date = '2025-08-06'::date
      LIMIT 5
    `);
    
    if (sampleRecords.rows.length > 0) {
      console.log(`\n${colors.yellow}Sample records (now with August 6th date):${colors.reset}`);
      sampleRecords.rows.forEach(record => {
        console.log(`${colors.cyan}ID:${colors.reset} ${record.id}`);
        console.log(`${colors.cyan}Program:${colors.reset} ${record.program_name}`);
        console.log(`${colors.cyan}Date:${colors.reset} ${formatDate(record.date)}`);
        console.log(`${colors.cyan}Instance Date:${colors.reset} ${formatDate(record.instance_date)}`);
        console.log('-'.repeat(40));
      });
    }
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error updating dates:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Release client back to pool
    client.release();
  }
  
  console.log(`\n${colors.bright}${colors.green}NEXT STEPS:${colors.reset}`);
  console.log(`1. ${colors.yellow}Restart your server${colors.reset} to clear any cached data`);
  console.log(`2. ${colors.yellow}Refresh the Master Schedule page${colors.reset} in your browser`);
  console.log(`3. ${colors.yellow}Verify cards appear${colors.reset} for August 6th`);
  console.log(`4. ${colors.yellow}Check the Dashboard and Roster pages${colors.reset} to ensure cards appear there too`);
  
  console.log(`\n${colors.bright}${colors.green}DEMO READY!${colors.reset}`);
  
  // Close pool and exit
  await pool.end();
}

// Run the main function
fixAugust6thDates().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
