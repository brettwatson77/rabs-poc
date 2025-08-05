/**
 * Final Cards Fix Script
 * 
 * This script fixes the date issue with the loom instance:
 * 1. Updates the existing instance from August 5th to August 6th
 * 2. Updates both date and instance_date columns to 2025-08-06
 * 3. Verifies the change worked
 * 4. Tests the API endpoints to make sure cards appear
 * 
 * Usage: node scripts/final-cards-fix.js
 */

const { Pool } = require('pg');
const axios = require('axios');
const http = require('http');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// API configuration
const API_BASE_URL = 'http://localhost:3009/api/v1';

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Update loom instance date
 */
async function updateInstanceDate() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`\n${colors.bright}Updating loom instance date...${colors.reset}`);
    
    // The specific instance ID from the API response
    const instanceId = '96d47877-b99f-42a3-ae66-61f374149ef6';
    
    // Get current date values
    const currentResult = await client.query(`
      SELECT date, instance_date
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instanceId]);
    
    if (currentResult.rows.length === 0) {
      throw new Error(`Instance ${instanceId} not found!`);
    }
    
    const currentDate = currentResult.rows[0].date;
    const currentInstanceDate = currentResult.rows[0].instance_date;
    
    console.log(`${colors.yellow}Current date: ${currentDate}${colors.reset}`);
    console.log(`${colors.yellow}Current instance_date: ${currentInstanceDate}${colors.reset}`);
    
    // Update both date columns to August 6th
    const newDate = new Date('2025-08-06');
    
    const updateResult = await client.query(`
      UPDATE tgl_loom_instances
      SET date = $1, instance_date = $2
      WHERE id = $3
      RETURNING date, instance_date
    `, [newDate, newDate, instanceId]);
    
    if (updateResult.rows.length === 0) {
      throw new Error(`Failed to update instance ${instanceId}`);
    }
    
    console.log(`${colors.green}✅ Updated date to: ${updateResult.rows[0].date}${colors.reset}`);
    console.log(`${colors.green}✅ Updated instance_date to: ${updateResult.rows[0].instance_date}${colors.reset}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return true;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error updating instance date:${colors.reset}`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify update worked
 */
async function verifyUpdate() {
  try {
    console.log(`\n${colors.bright}Verifying update...${colors.reset}`);
    
    // The specific instance ID from the API response
    const instanceId = '96d47877-b99f-42a3-ae66-61f374149ef6';
    
    const result = await pool.query(`
      SELECT id, date, instance_date, program_id, program_name
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instanceId]);
    
    if (result.rows.length === 0) {
      console.log(`${colors.red}❌ Instance ${instanceId} not found!${colors.reset}`);
      return false;
    }
    
    const instance = result.rows[0];
    
    // Check if dates are August 6th
    const date = new Date(instance.date);
    const instanceDate = new Date(instance.instance_date);
    
    const isDateCorrect = date.getDate() === 6 && date.getMonth() === 7; // August is 7 (0-based)
    const isInstanceDateCorrect = instanceDate.getDate() === 6 && instanceDate.getMonth() === 7;
    
    if (isDateCorrect && isInstanceDateCorrect) {
      console.log(`${colors.green}✅ Verification successful!${colors.reset}`);
      console.log(`${colors.green}✅ Instance ${instanceId} has correct dates:${colors.reset}`);
      console.log(`   - date: ${instance.date}`);
      console.log(`   - instance_date: ${instance.instance_date}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Verification failed!${colors.reset}`);
      console.log(`   - date: ${instance.date} (correct: ${isDateCorrect})`);
      console.log(`   - instance_date: ${instance.instance_date} (correct: ${isInstanceDateCorrect})`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error verifying update:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Test API endpoint
 */
async function testApiEndpoint() {
  console.log(`\n${colors.bright}Testing API endpoint...${colors.reset}`);
  
  try {
    // Test loom instances API
    console.log(`${colors.yellow}Testing /api/v1/loom/instances endpoint...${colors.reset}`);
    
    const response = await axios.get(`${API_BASE_URL}/loom/instances`, {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-12'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (response.status === 200 && response.data.success && response.data.data.length > 0) {
      console.log(`${colors.green}✅ API endpoint returned data successfully!${colors.reset}`);
      console.log(`${colors.green}✅ Found ${response.data.data.length} instances${colors.reset}`);
      
      // Check if the instance has the correct date
      const instance = response.data.data[0];
      console.log(`${colors.yellow}Instance details:${colors.reset}`);
      console.log(`   - ID: ${instance.id}`);
      console.log(`   - Program: ${instance.program_name}`);
      console.log(`   - Date: ${instance.date}`);
      console.log(`   - Instance Date: ${instance.instance_date}`);
      
      // Check if the date is August 6th
      const date = new Date(instance.date);
      const instanceDate = new Date(instance.instance_date);
      
      const isDateCorrect = date.getDate() === 6 && date.getMonth() === 7; // August is 7 (0-based)
      const isInstanceDateCorrect = instanceDate.getDate() === 6 && instanceDate.getMonth() === 7;
      
      if (isDateCorrect && isInstanceDateCorrect) {
        console.log(`${colors.green}✅ API returned correct dates!${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.red}❌ API returned incorrect dates!${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ API endpoint returned no data or error!${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error testing API endpoint:${colors.reset}`, error.message);
    
    // Check if server is running
    console.log(`${colors.yellow}Checking if server is running...${colors.reset}`);
    
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3009', (res) => {
          resolve(res.statusCode);
        });
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.setTimeout(3000, () => {
          req.abort();
          reject(new Error('Request timed out'));
        });
      });
      
      console.log(`${colors.yellow}Server is running but API endpoint failed.${colors.reset}`);
    } catch (serverError) {
      console.log(`${colors.red}❌ Server is not running! Please start the server:${colors.reset}`);
      console.log(`   node server.js`);
    }
    
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}FINAL CARDS FIX${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // 1. Update instance date
    await updateInstanceDate();
    
    // 2. Verify update
    const verified = await verifyUpdate();
    
    if (!verified) {
      console.log(`${colors.red}❌ Update verification failed!${colors.reset}`);
      process.exit(1);
    }
    
    // 3. Test API endpoint
    const apiWorks = await testApiEndpoint();
    
    // Summary
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}SUMMARY${colors.reset}`);
    console.log('*'.repeat(80));
    
    if (verified && apiWorks) {
      console.log(`${colors.green}${colors.bright}✅ SUCCESS! All fixes applied successfully!${colors.reset}`);
      console.log(`\n${colors.bright}${colors.magenta}DEMO READY!${colors.reset} Your cards should now appear on:`);
      console.log(`1. ${colors.cyan}Master Schedule - August 6th, 2025${colors.reset}`);
      console.log(`2. ${colors.cyan}Dashboard - August 6th, 2025${colors.reset}`);
      console.log(`3. ${colors.cyan}Roster - August 6th, 2025${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ Some fixes were not successful.${colors.reset}`);
      console.log(`${colors.yellow}Please check the logs for details.${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`1. ${colors.cyan}Restart the server${colors.reset}`);
    console.log(`2. ${colors.cyan}Check Master Schedule on August 6th, 2025${colors.reset}`);
    console.log(`3. ${colors.cyan}Check Dashboard for time slot cards${colors.reset}`);
    console.log(`4. ${colors.cyan}Check Roster for staff assignments${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
