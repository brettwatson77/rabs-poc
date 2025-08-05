/**
 * Direct Database Check Script
 * 
 * This script directly compares what's in the database vs what the API returns
 * to identify why the API is still returning August 5th when the database 
 * should have August 6th dates.
 * 
 * Usage: node scripts/direct-db-check.js
 */

const { Pool } = require('pg');
const axios = require('axios');

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
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

/**
 * Format date for display
 */
function formatDate(date) {
  if (!date) return 'null';
  const d = new Date(date);
  return d.toISOString();
}

/**
 * Check database directly
 */
async function checkDatabase() {
  try {
    console.log(`\n${colors.bright}${colors.blue}CHECKING DATABASE DIRECTLY${colors.reset}`);
    
    // The specific instance ID from the API response
    const instanceId = '96d47877-b99f-42a3-ae66-61f374149ef6';
    
    // Get all columns for this instance
    const result = await pool.query(`
      SELECT *
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instanceId]);
    
    if (result.rows.length === 0) {
      console.log(`${colors.red}Instance ${instanceId} not found in database!${colors.reset}`);
      return null;
    }
    
    const instance = result.rows[0];
    
    console.log(`${colors.green}Found instance in database:${colors.reset}`);
    console.log(`${colors.yellow}ID:${colors.reset} ${instance.id}`);
    console.log(`${colors.yellow}Program ID:${colors.reset} ${instance.program_id}`);
    console.log(`${colors.yellow}Date:${colors.reset} ${formatDate(instance.date)}`);
    console.log(`${colors.yellow}Instance Date:${colors.reset} ${formatDate(instance.instance_date)}`);
    console.log(`${colors.yellow}Start Time:${colors.reset} ${instance.start_time}`);
    console.log(`${colors.yellow}End Time:${colors.reset} ${instance.end_time}`);
    console.log(`${colors.yellow}Status:${colors.reset} ${instance.status}`);
    console.log(`${colors.yellow}Created At:${colors.reset} ${formatDate(instance.created_at)}`);
    console.log(`${colors.yellow}Updated At:${colors.reset} ${formatDate(instance.updated_at)}`);
    
    // Get program name
    const programResult = await pool.query(`
      SELECT name
      FROM programs
      WHERE id = $1
    `, [instance.program_id]);
    
    if (programResult.rows.length > 0) {
      console.log(`${colors.yellow}Program Name:${colors.reset} ${programResult.rows[0].name}`);
    }
    
    return instance;
  } catch (error) {
    console.error(`${colors.red}Error checking database:${colors.reset}`, error.message);
    return null;
  }
}

/**
 * Check the API response
 */
async function checkApi() {
  try {
    console.log(`\n${colors.bright}${colors.blue}CHECKING API RESPONSE${colors.reset}`);
    
    console.log(`${colors.yellow}Making API call to:${colors.reset} ${API_BASE_URL}/loom/instances?startDate=2025-08-06&endDate=2025-08-12`);
    
    const response = await axios.get(`${API_BASE_URL}/loom/instances`, {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-12'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (response.status !== 200 || !response.data.success) {
      console.log(`${colors.red}API returned error:${colors.reset}`, response.data);
      return null;
    }
    
    if (!response.data.data || response.data.data.length === 0) {
      console.log(`${colors.red}API returned no instances!${colors.reset}`);
      return null;
    }
    
    const instance = response.data.data[0];
    
    console.log(`${colors.green}API returned instance:${colors.reset}`);
    console.log(`${colors.yellow}ID:${colors.reset} ${instance.id}`);
    console.log(`${colors.yellow}Program ID:${colors.reset} ${instance.program_id}`);
    console.log(`${colors.yellow}Date:${colors.reset} ${formatDate(instance.date)}`);
    console.log(`${colors.yellow}Instance Date:${colors.reset} ${formatDate(instance.instance_date)}`);
    console.log(`${colors.yellow}Start Time:${colors.reset} ${instance.start_time}`);
    console.log(`${colors.yellow}End Time:${colors.reset} ${instance.end_time}`);
    console.log(`${colors.yellow}Status:${colors.reset} ${instance.status}`);
    console.log(`${colors.yellow}Program Name:${colors.reset} ${instance.program_name}`);
    console.log(`${colors.yellow}Created At:${colors.reset} ${formatDate(instance.created_at)}`);
    console.log(`${colors.yellow}Updated At:${colors.reset} ${formatDate(instance.updated_at)}`);
    
    return instance;
  } catch (error) {
    console.error(`${colors.red}Error checking API:${colors.reset}`, error.message);
    
    // Check if server is running
    console.log(`${colors.yellow}Is the server running? Try:${colors.reset} node server.js`);
    
    return null;
  }
}

/**
 * Check the loom engine service directly
 */
async function checkLoomEngineCode() {
  try {
    console.log(`\n${colors.bright}${colors.blue}CHECKING LOOM ENGINE CODE${colors.reset}`);
    
    const fs = require('fs');
    const path = require('path');
    
    const loomEnginePath = path.join(__dirname, '..', 'backend', 'services', 'loomEngine.js');
    
    if (!fs.existsSync(loomEnginePath)) {
      console.log(`${colors.red}Loom engine file not found at:${colors.reset} ${loomEnginePath}`);
      return false;
    }
    
    const loomEngineCode = fs.readFileSync(loomEnginePath, 'utf8');
    
    // Look for the getLoomInstances function
    const getLoomInstancesMatch = loomEngineCode.match(/async\s+function\s+getLoomInstances\s*\([^)]*\)\s*\{[\s\S]*?\}/);
    
    if (!getLoomInstancesMatch) {
      console.log(`${colors.red}Could not find getLoomInstances function in loom engine!${colors.reset}`);
      return false;
    }
    
    const getLoomInstancesCode = getLoomInstancesMatch[0];
    
    console.log(`${colors.green}Found getLoomInstances function:${colors.reset}`);
    
    // Check what date column it's using
    if (getLoomInstancesCode.includes('instance_date')) {
      console.log(`${colors.yellow}Function is using:${colors.reset} instance_date column`);
    }
    
    if (getLoomInstancesCode.includes('date')) {
      console.log(`${colors.yellow}Function is using:${colors.reset} date column`);
    }
    
    // Check the query used
    const queryMatch = getLoomInstancesCode.match(/`([^`]*)`/g);
    
    if (queryMatch) {
      console.log(`${colors.green}Found SQL query:${colors.reset}`);
      
      // Extract the WHERE clause to see what date column is used
      const whereClauseMatch = queryMatch[0].match(/WHERE\s+([^;]*)/i);
      
      if (whereClauseMatch) {
        console.log(`${colors.yellow}WHERE clause:${colors.reset} ${whereClauseMatch[1]}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking loom engine code:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Compare database and API results
 */
function compareResults(dbInstance, apiInstance) {
  if (!dbInstance || !apiInstance) {
    console.log(`${colors.red}Cannot compare results - missing data!${colors.reset}`);
    return;
  }
  
  console.log(`\n${colors.bright}${colors.blue}COMPARING DATABASE VS API${colors.reset}`);
  
  // Compare date fields
  const dbDate = new Date(dbInstance.date);
  const apiDate = new Date(apiInstance.date);
  
  const dbInstanceDate = new Date(dbInstance.instance_date);
  const apiInstanceDate = new Date(apiInstance.instance_date);
  
  console.log(`${colors.bright}Date comparison:${colors.reset}`);
  console.log(`${colors.yellow}DB date:${colors.reset} ${formatDate(dbInstance.date)} (${dbDate.getDate()}/${dbDate.getMonth() + 1})`);
  console.log(`${colors.yellow}API date:${colors.reset} ${formatDate(apiInstance.date)} (${apiDate.getDate()}/${apiDate.getMonth() + 1})`);
  console.log(`${colors.yellow}Match:${colors.reset} ${dbDate.getTime() === apiDate.getTime() ? colors.green + 'YES' : colors.red + 'NO'}`);
  
  console.log(`\n${colors.bright}Instance date comparison:${colors.reset}`);
  console.log(`${colors.yellow}DB instance_date:${colors.reset} ${formatDate(dbInstance.instance_date)} (${dbInstanceDate.getDate()}/${dbInstanceDate.getMonth() + 1})`);
  console.log(`${colors.yellow}API instance_date:${colors.reset} ${formatDate(apiInstance.instance_date)} (${apiInstanceDate.getDate()}/${apiInstanceDate.getMonth() + 1})`);
  console.log(`${colors.yellow}Match:${colors.reset} ${dbInstanceDate.getTime() === apiInstanceDate.getTime() ? colors.green + 'YES' : colors.red + 'NO'}`);
  
  // Check if dates are August 6th
  const isDbDateAug6 = dbDate.getDate() === 6 && dbDate.getMonth() === 7; // August is 7 (0-based)
  const isApiDateAug6 = apiDate.getDate() === 6 && apiDate.getMonth() === 7;
  const isDbInstanceDateAug6 = dbInstanceDate.getDate() === 6 && dbInstanceDate.getMonth() === 7;
  const isApiInstanceDateAug6 = apiInstanceDate.getDate() === 6 && apiInstanceDate.getMonth() === 7;
  
  console.log(`\n${colors.bright}August 6th check:${colors.reset}`);
  console.log(`${colors.yellow}DB date is August 6th:${colors.reset} ${isDbDateAug6 ? colors.green + 'YES' : colors.red + 'NO'}`);
  console.log(`${colors.yellow}API date is August 6th:${colors.reset} ${isApiDateAug6 ? colors.green + 'YES' : colors.red + 'NO'}`);
  console.log(`${colors.yellow}DB instance_date is August 6th:${colors.reset} ${isDbInstanceDateAug6 ? colors.green + 'YES' : colors.red + 'NO'}`);
  console.log(`${colors.yellow}API instance_date is August 6th:${colors.reset} ${isApiInstanceDateAug6 ? colors.green + 'YES' : colors.red + 'NO'}`);
  
  // Check for timezone issues
  console.log(`\n${colors.bright}Timezone analysis:${colors.reset}`);
  
  // Calculate timezone offset in hours
  const dbDateOffset = dbDate.getTimezoneOffset() / -60;
  const apiDateOffset = apiDate.getTimezoneOffset() / -60;
  
  console.log(`${colors.yellow}DB date timezone offset:${colors.reset} ${dbDateOffset} hours`);
  console.log(`${colors.yellow}API date timezone offset:${colors.reset} ${apiDateOffset} hours`);
  
  // Check if dates are off by timezone
  const hoursDiff = Math.abs((dbDate.getTime() - apiDate.getTime()) / (1000 * 60 * 60));
  console.log(`${colors.yellow}Hours difference between dates:${colors.reset} ${hoursDiff}`);
  
  if (Math.abs(hoursDiff - Math.abs(dbDateOffset)) < 1) {
    console.log(`${colors.bgYellow}${colors.bright}${colors.red} TIMEZONE ISSUE DETECTED! ${colors.reset}`);
    console.log(`${colors.yellow}The dates appear to be off by the timezone offset.${colors.reset}`);
    console.log(`${colors.yellow}This suggests the API is returning UTC dates while the database has local dates.${colors.reset}`);
  }
  
  // Provide recommendation
  console.log(`\n${colors.bright}${colors.blue}RECOMMENDATION${colors.reset}`);
  
  if (isDbDateAug6 && !isApiDateAug6) {
    console.log(`${colors.bgYellow}${colors.bright}${colors.red} TIMEZONE CONVERSION ISSUE ${colors.reset}`);
    console.log(`${colors.yellow}The database has August 6th but the API is returning August 5th.${colors.reset}`);
    console.log(`${colors.yellow}This is likely due to timezone conversion in the API.${colors.reset}`);
    console.log(`\n${colors.bright}Try these fixes:${colors.reset}`);
    console.log(`1. ${colors.cyan}Update the database to use August 7th${colors.reset} (to account for timezone conversion)`);
    console.log(`2. ${colors.cyan}Fix the loomEngine.js to handle timezone conversion properly${colors.reset}`);
  } else if (!isDbDateAug6 && !isApiDateAug6) {
    console.log(`${colors.bgRed}${colors.bright}${colors.white} DATABASE NOT UPDATED ${colors.reset}`);
    console.log(`${colors.yellow}Neither the database nor API has August 6th dates.${colors.reset}`);
    console.log(`${colors.yellow}The database update may have failed.${colors.reset}`);
    console.log(`\n${colors.bright}Try this fix:${colors.reset}`);
    console.log(`1. ${colors.cyan}Manually update the database with this SQL:${colors.reset}`);
    console.log(`   UPDATE tgl_loom_instances SET date = '2025-08-06', instance_date = '2025-08-06' WHERE id = '96d47877-b99f-42a3-ae66-61f374149ef6';`);
  } else if (isDbDateAug6 && isApiDateAug6) {
    console.log(`${colors.bgGreen}${colors.bright}${colors.white} DATES MATCH CORRECTLY ${colors.reset}`);
    console.log(`${colors.green}Both database and API show August 6th dates.${colors.reset}`);
    console.log(`${colors.yellow}If cards still aren't showing, the issue may be elsewhere.${colors.reset}`);
    console.log(`\n${colors.bright}Try these checks:${colors.reset}`);
    console.log(`1. ${colors.cyan}Verify the frontend is looking at the correct date${colors.reset}`);
    console.log(`2. ${colors.cyan}Check browser console for JavaScript errors${colors.reset}`);
    console.log(`3. ${colors.cyan}Restart the server and clear browser cache${colors.reset}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}DIRECT DATABASE VS API CHECK${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    console.log(`API: ${colors.cyan}${API_BASE_URL}/loom/instances${colors.reset}`);
    
    // 1. Check database directly
    const dbInstance = await checkDatabase();
    
    // 2. Check API response
    const apiInstance = await checkApi();
    
    // 3. Check loom engine code
    await checkLoomEngineCode();
    
    // 4. Compare results
    compareResults(dbInstance, apiInstance);
    
    console.log('\n' + '*'.repeat(80));
    
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
