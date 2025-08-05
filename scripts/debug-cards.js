/**
 * Cards Debug Script
 * 
 * This script helps diagnose why cards aren't showing in the UI by:
 * 1. Verifying loom instances exist in database for specific dates
 * 2. Verifying time slots exist for those instances
 * 3. Checking what API endpoints the frontend should be calling
 * 4. Testing the actual API endpoints to see if they return data
 * 5. Checking if the backend programService.js getCardsByDate function works
 * 6. Identifying the exact problem preventing cards from appearing
 * 
 * Usage: node scripts/debug-cards.js [date]
 * Example: node scripts/debug-cards.js 2025-08-06
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Helper to print section headers
const printHeader = (text) => {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
  console.log('='.repeat(80));
};

// Helper to print success/error messages
const printSuccess = (text) => console.log(`${colors.green}✓ ${text}${colors.reset}`);
const printError = (text) => console.log(`${colors.red}✗ ${text}${colors.reset}`);
const printWarning = (text) => console.log(`${colors.yellow}! ${text}${colors.reset}`);
const printInfo = (text) => console.log(`${colors.blue}ℹ ${text}${colors.reset}`);

/**
 * Check if server is running
 */
async function checkServerRunning() {
  try {
    printInfo('Checking if server is running...');
    const { stdout } = await execPromise('ps aux | grep "[n]ode server.js"');
    if (stdout) {
      printSuccess('Server is running');
      return true;
    } else {
      printWarning('Server does not appear to be running');
      return false;
    }
  } catch (error) {
    printWarning('Could not determine if server is running');
    return false;
  }
}

/**
 * Check database connection
 */
async function checkDatabaseConnection() {
  try {
    printInfo('Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    client.release();
    
    const dbTime = new Date(result.rows[0].now).toLocaleString();
    printSuccess(`Database connection successful. Server time: ${dbTime}`);
    return true;
  } catch (error) {
    printError(`Database connection failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if loom instances exist for a specific date
 */
async function checkLoomInstances(date) {
  try {
    printInfo(`Checking for loom instances on ${date}...`);
    
    // First check the date column
    let result = await pool.query(`
      SELECT id, program_id, date, instance_date, start_time, end_time, venue_id, status
      FROM tgl_loom_instances
      WHERE date = $1
    `, [date]);
    
    // If no results, try instance_date column
    if (result.rows.length === 0) {
      result = await pool.query(`
        SELECT id, program_id, date, instance_date, start_time, end_time, venue_id, status
        FROM tgl_loom_instances
        WHERE instance_date = $1
      `, [date]);
    }
    
    if (result.rows.length === 0) {
      printError(`No loom instances found for date ${date}`);
      return [];
    }
    
    printSuccess(`Found ${result.rows.length} loom instances for date ${date}`);
    
    // Get program details for each instance
    for (let i = 0; i < result.rows.length; i++) {
      const instance = result.rows[i];
      const programResult = await pool.query(`
        SELECT name, program_type
        FROM programs
        WHERE id = $1
      `, [instance.program_id]);
      
      if (programResult.rows.length > 0) {
        instance.program_name = programResult.rows[0].name;
        instance.program_type = programResult.rows[0].program_type;
      }
      
      // Get venue details
      if (instance.venue_id) {
        const venueResult = await pool.query(`
          SELECT name
          FROM venues
          WHERE id = $1
        `, [instance.venue_id]);
        
        if (venueResult.rows.length > 0) {
          instance.venue_name = venueResult.rows[0].name;
        }
      }
    }
    
    // Print instance details
    result.rows.forEach((instance, index) => {
      console.log(`\n${colors.bright}Instance ${index + 1}:${colors.reset}`);
      console.log(`  ID: ${instance.id}`);
      console.log(`  Program: ${instance.program_name || 'Unknown'} (${instance.program_type || 'Unknown'})`);
      console.log(`  Date: ${instance.date || instance.instance_date}`);
      console.log(`  Time: ${instance.start_time} - ${instance.end_time}`);
      console.log(`  Venue: ${instance.venue_name || 'Unknown'}`);
      console.log(`  Status: ${instance.status}`);
    });
    
    return result.rows;
  } catch (error) {
    printError(`Error checking loom instances: ${error.message}`);
    return [];
  }
}

/**
 * Check if time slots exist for a specific instance
 */
async function checkTimeSlots(instances) {
  try {
    printInfo('Checking for time slots...');
    
    let totalTimeSlots = 0;
    
    for (const instance of instances) {
      const result = await pool.query(`
        SELECT id, instance_id, start_time, end_time, label, card_type
        FROM tgl_loom_time_slots
        WHERE instance_id = $1
        ORDER BY start_time
      `, [instance.id]);
      
      if (result.rows.length === 0) {
        printWarning(`No time slots found for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
      } else {
        printSuccess(`Found ${result.rows.length} time slots for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
        
        // Print time slot details
        console.log(`\n${colors.bright}Time Slots for ${instance.program_name || 'Unknown program'}:${colors.reset}`);
        result.rows.forEach((slot, index) => {
          console.log(`  ${index + 1}. ${slot.label || slot.card_type}: ${slot.start_time} - ${slot.end_time} (${slot.card_type})`);
        });
        
        totalTimeSlots += result.rows.length;
      }
    }
    
    if (totalTimeSlots === 0) {
      printError('No time slots found for any instances');
      return false;
    }
    
    printSuccess(`Found a total of ${totalTimeSlots} time slots`);
    return true;
  } catch (error) {
    printError(`Error checking time slots: ${error.message}`);
    return false;
  }
}

/**
 * Check participant allocations for instances
 */
async function checkParticipantAllocations(instances) {
  try {
    printInfo('Checking for participant allocations...');
    
    // First check if the table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tgl_loom_participant_allocations'
      )
    `);
    
    if (!tableResult.rows[0].exists) {
      printWarning('tgl_loom_participant_allocations table does not exist');
      return false;
    }
    
    // Check the column name - could be instance_id or loom_instance_id
    const columnResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'tgl_loom_participant_allocations'
      AND column_name LIKE '%instance%'
    `);
    
    if (columnResult.rows.length === 0) {
      printWarning('Could not find instance column in tgl_loom_participant_allocations table');
      return false;
    }
    
    const instanceColumn = columnResult.rows[0].column_name;
    printInfo(`Using column ${instanceColumn} to query participant allocations`);
    
    let totalAllocations = 0;
    
    for (const instance of instances) {
      const query = `
        SELECT id, participant_id, status
        FROM tgl_loom_participant_allocations
        WHERE ${instanceColumn} = $1
      `;
      
      const result = await pool.query(query, [instance.id]);
      
      if (result.rows.length === 0) {
        printWarning(`No participant allocations found for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
      } else {
        printSuccess(`Found ${result.rows.length} participant allocations for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
        totalAllocations += result.rows.length;
      }
    }
    
    if (totalAllocations === 0) {
      printWarning('No participant allocations found for any instances');
      return false;
    }
    
    printSuccess(`Found a total of ${totalAllocations} participant allocations`);
    return true;
  } catch (error) {
    printWarning(`Error checking participant allocations: ${error.message}`);
    return false;
  }
}

/**
 * Check staff shifts for instances
 */
async function checkStaffShifts(instances) {
  try {
    printInfo('Checking for staff shifts...');
    
    // First check if the table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tgl_loom_staff_shifts'
      )
    `);
    
    if (!tableResult.rows[0].exists) {
      printWarning('tgl_loom_staff_shifts table does not exist');
      return false;
    }
    
    let totalShifts = 0;
    
    for (const instance of instances) {
      const result = await pool.query(`
        SELECT id, staff_id, role, start_time, end_time, status
        FROM tgl_loom_staff_shifts
        WHERE instance_id = $1
      `, [instance.id]);
      
      if (result.rows.length === 0) {
        printWarning(`No staff shifts found for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
      } else {
        printSuccess(`Found ${result.rows.length} staff shifts for instance ${instance.id} (${instance.program_name || 'Unknown program'})`);
        totalShifts += result.rows.length;
      }
    }
    
    if (totalShifts === 0) {
      printWarning('No staff shifts found for any instances');
      return false;
    }
    
    printSuccess(`Found a total of ${totalShifts} staff shifts`);
    return true;
  } catch (error) {
    printWarning(`Error checking staff shifts: ${error.message}`);
    return false;
  }
}

/**
 * Check API endpoints in the codebase
 */
async function checkApiEndpoints() {
  try {
    printInfo('Checking API endpoints in the codebase...');
    
    // Check if the server.js file exists
    const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
    if (!fs.existsSync(serverPath)) {
      printWarning('Could not find server.js file');
      return [];
    }
    
    // Check route files
    const routesDir = path.join(__dirname, '..', 'backend', 'routes');
    if (!fs.existsSync(routesDir)) {
      printWarning('Could not find routes directory');
      return [];
    }
    
    // Look for route files related to loom, cards, or dashboard
    const routeFiles = fs.readdirSync(routesDir).filter(file => 
      file.includes('loom') || 
      file.includes('card') || 
      file.includes('dashboard') ||
      file.includes('program')
    );
    
    if (routeFiles.length === 0) {
      printWarning('Could not find relevant route files');
      return [];
    }
    
    printSuccess(`Found ${routeFiles.length} relevant route files: ${routeFiles.join(', ')}`);
    
    // Check for API endpoints in route files
    const endpoints = [];
    
    for (const file of routeFiles) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Look for route definitions
      const routeRegex = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        
        // Only include relevant endpoints
        if (path.includes('cards') || path.includes('loom') || path.includes('program')) {
          endpoints.push({ method, path, file });
        }
      }
    }
    
    if (endpoints.length === 0) {
      printWarning('Could not find relevant API endpoints');
      return [];
    }
    
    printSuccess(`Found ${endpoints.length} relevant API endpoints`);
    
    // Print endpoint details
    console.log(`\n${colors.bright}API Endpoints:${colors.reset}`);
    endpoints.forEach((endpoint, index) => {
      console.log(`  ${index + 1}. ${endpoint.method} ${endpoint.path} (${endpoint.file})`);
    });
    
    return endpoints;
  } catch (error) {
    printError(`Error checking API endpoints: ${error.message}`);
    return [];
  }
}

/**
 * Test API endpoints
 */
async function testApiEndpoints(endpoints, date) {
  try {
    printInfo(`Testing API endpoints for date ${date}...`);
    
    const results = [];
    
    for (const endpoint of endpoints) {
      // Skip non-GET endpoints
      if (endpoint.method !== 'GET') {
        continue;
      }
      
      // Replace path parameters
      let url = endpoint.path.replace(':date', date);
      
      // Add query parameters for loom instances
      if (url.includes('loom/instances')) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 7);
        
        url += `?start=${date}&end=${endDate.toISOString().split('T')[0]}`;
      }
      
      try {
        printInfo(`Testing ${endpoint.method} ${url}...`);
        const response = await axios.get(`${API_BASE_URL}${url}`);
        
        if (response.status === 200) {
          const dataCount = Array.isArray(response.data) ? response.data.length : 
                           (response.data.cards ? response.data.cards.length : 'N/A');
          
          printSuccess(`${endpoint.method} ${url} - Status: ${response.status}, Data count: ${dataCount}`);
          
          results.push({
            endpoint: url,
            status: response.status,
            dataCount,
            data: response.data
          });
        } else {
          printWarning(`${endpoint.method} ${url} - Status: ${response.status}`);
        }
      } catch (error) {
        printError(`${endpoint.method} ${url} - Error: ${error.message}`);
      }
    }
    
    return results;
  } catch (error) {
    printError(`Error testing API endpoints: ${error.message}`);
    return [];
  }
}

/**
 * Check frontend API calls
 */
async function checkFrontendApiCalls() {
  try {
    printInfo('Checking frontend API calls...');
    
    // Check MasterSchedule.jsx
    const masterSchedulePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'MasterSchedule.jsx');
    if (!fs.existsSync(masterSchedulePath)) {
      printWarning('Could not find MasterSchedule.jsx file');
      return [];
    }
    
    // Check Dashboard.jsx
    const dashboardPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Dashboard.jsx');
    if (!fs.existsSync(dashboardPath)) {
      printWarning('Could not find Dashboard.jsx file');
      return [];
    }
    
    // Check Roster.jsx
    const rosterPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Roster.jsx');
    if (!fs.existsSync(rosterPath)) {
      printWarning('Could not find Roster.jsx file');
      return [];
    }
    
    // Read files
    const masterScheduleContent = fs.readFileSync(masterSchedulePath, 'utf8');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    const rosterContent = fs.readFileSync(rosterPath, 'utf8');
    
    // Look for API calls
    const apiCalls = [];
    
    // Check MasterSchedule.jsx
    const masterScheduleApiCalls = extractApiCalls(masterScheduleContent, 'MasterSchedule.jsx');
    apiCalls.push(...masterScheduleApiCalls);
    
    // Check Dashboard.jsx
    const dashboardApiCalls = extractApiCalls(dashboardContent, 'Dashboard.jsx');
    apiCalls.push(...dashboardApiCalls);
    
    // Check Roster.jsx
    const rosterApiCalls = extractApiCalls(rosterContent, 'Roster.jsx');
    apiCalls.push(...rosterApiCalls);
    
    if (apiCalls.length === 0) {
      printWarning('Could not find API calls in frontend files');
      return [];
    }
    
    printSuccess(`Found ${apiCalls.length} API calls in frontend files`);
    
    // Print API call details
    console.log(`\n${colors.bright}Frontend API Calls:${colors.reset}`);
    apiCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.file}: ${call.endpoint}`);
    });
    
    return apiCalls;
  } catch (error) {
    printError(`Error checking frontend API calls: ${error.message}`);
    return [];
  }
}

/**
 * Extract API calls from file content
 */
function extractApiCalls(content, file) {
  const apiCalls = [];
  
  // Look for axios calls
  const axiosRegex = /axios\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = axiosRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2];
    
    // Only include relevant endpoints
    if (endpoint.includes('cards') || 
        endpoint.includes('loom') || 
        endpoint.includes('program') ||
        endpoint.includes('dashboard')) {
      apiCalls.push({ method, endpoint, file });
    }
  }
  
  // Look for api.get, api.post, etc.
  const apiRegex = /api\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
  
  while ((match = apiRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2];
    
    // Only include relevant endpoints
    if (endpoint.includes('cards') || 
        endpoint.includes('loom') || 
        endpoint.includes('program') ||
        endpoint.includes('dashboard')) {
      apiCalls.push({ method, endpoint, file });
    }
  }
  
  return apiCalls;
}

/**
 * Check programService.js getCardsByDate function
 */
async function checkProgramService() {
  try {
    printInfo('Checking programService.js getCardsByDate function...');
    
    // Check if the file exists
    const programServicePath = path.join(__dirname, '..', 'backend', 'services', 'programService.js');
    if (!fs.existsSync(programServicePath)) {
      printWarning('Could not find programService.js file');
      return false;
    }
    
    // Read file
    const content = fs.readFileSync(programServicePath, 'utf8');
    
    // Check for getCardsByDate function
    if (!content.includes('getCardsByDate')) {
      printWarning('Could not find getCardsByDate function in programService.js');
      return false;
    }
    
    printSuccess('Found getCardsByDate function in programService.js');
    
    // Extract and analyze the function
    const functionRegex = /async\s+function\s+getCardsByDate\s*\([^)]*\)\s*{([^}]*)}/s;
    const match = functionRegex.exec(content);
    
    if (!match) {
      printWarning('Could not extract getCardsByDate function code');
      return false;
    }
    
    const functionCode = match[0];
    
    // Check what tables the function queries
    const tableQueries = {
      tgl_loom_instances: functionCode.includes('tgl_loom_instances'),
      tgl_loom_time_slots: functionCode.includes('tgl_loom_time_slots'),
      programs: functionCode.includes('programs'),
      venues: functionCode.includes('venues')
    };
    
    console.log(`\n${colors.bright}getCardsByDate function queries:${colors.reset}`);
    Object.entries(tableQueries).forEach(([table, queried]) => {
      if (queried) {
        console.log(`  ${colors.green}✓ ${table}${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ ${table}${colors.reset}`);
      }
    });
    
    // Check if function uses date or instance_date
    if (functionCode.includes('date =')) {
      printInfo('Function uses date column');
    } else if (functionCode.includes('instance_date =')) {
      printInfo('Function uses instance_date column');
    } else {
      printWarning('Could not determine which date column the function uses');
    }
    
    return true;
  } catch (error) {
    printError(`Error checking programService.js: ${error.message}`);
    return false;
  }
}

/**
 * Identify the problem and suggest fixes
 */
function identifyProblem(results) {
  printHeader('PROBLEM IDENTIFICATION');
  
  const {
    instancesExist,
    timeSlotsExist,
    apiEndpointsFound,
    apiResponsesReceived,
    programServiceOk
  } = results;
  
  const problems = [];
  
  if (!instancesExist) {
    problems.push({
      severity: 'critical',
      message: 'No loom instances found in the database for the specified date',
      fix: 'Create loom instances for the program date'
    });
  }
  
  if (!timeSlotsExist) {
    problems.push({
      severity: 'critical',
      message: 'No time slots found for loom instances',
      fix: 'Create time slots for the loom instances'
    });
  }
  
  if (!apiEndpointsFound) {
    problems.push({
      severity: 'critical',
      message: 'No relevant API endpoints found in the codebase',
      fix: 'Implement API endpoints for cards/loom instances'
    });
  }
  
  if (!apiResponsesReceived) {
    problems.push({
      severity: 'critical',
      message: 'API endpoints are not returning data',
      fix: 'Debug API endpoints to ensure they return data'
    });
  }
  
  if (!programServiceOk) {
    problems.push({
      severity: 'critical',
      message: 'programService.js getCardsByDate function has issues',
      fix: 'Fix getCardsByDate function in programService.js'
    });
  }
  
  // If no critical problems found, look for other issues
  if (problems.length === 0) {
    problems.push({
      severity: 'warning',
      message: 'Database and API seem to be working, but cards are not showing in UI',
      fix: 'Check frontend code for rendering issues or incorrect API calls'
    });
  }
  
  // Print problems and fixes
  if (problems.length > 0) {
    console.log(`${colors.bright}Identified Problems:${colors.reset}`);
    problems.forEach((problem, index) => {
      const severityColor = problem.severity === 'critical' ? colors.red : colors.yellow;
      console.log(`\n${severityColor}Problem ${index + 1} (${problem.severity}):${colors.reset}`);
      console.log(`  ${severityColor}${problem.message}${colors.reset}`);
      console.log(`  ${colors.green}Suggested Fix: ${problem.fix}${colors.reset}`);
    });
  } else {
    printSuccess('No problems identified');
  }
  
  // Provide overall recommendation
  printHeader('RECOMMENDATION');
  
  if (instancesExist && timeSlotsExist) {
    console.log(`${colors.green}${colors.bright}Data exists in the database!${colors.reset}`);
    
    if (apiEndpointsFound && apiResponsesReceived) {
      console.log(`${colors.green}${colors.bright}API endpoints are working!${colors.reset}`);
      console.log(`\n${colors.yellow}The issue is likely in the frontend code:${colors.reset}`);
      console.log(`1. Check if frontend is calling the correct API endpoints`);
      console.log(`2. Check if frontend is properly parsing the API response`);
      console.log(`3. Check if frontend is correctly rendering the cards`);
      console.log(`4. Check browser console for JavaScript errors`);
    } else {
      console.log(`\n${colors.yellow}The issue is likely in the API layer:${colors.reset}`);
      console.log(`1. Check if API endpoints are correctly implemented`);
      console.log(`2. Check if programService.js is correctly querying the database`);
      console.log(`3. Check if API is returning the expected data structure`);
    }
  } else {
    console.log(`\n${colors.yellow}The issue is likely in the database:${colors.reset}`);
    console.log(`1. Ensure loom instances exist for the program date`);
    console.log(`2. Ensure time slots exist for the loom instances`);
    console.log(`3. Check if the database tables have the expected structure`);
  }
  
  console.log(`\n${colors.bright}${colors.magenta}Next Steps:${colors.reset}`);
  console.log(`1. Run this script with the specific date: ${colors.cyan}node scripts/debug-cards.js 2025-08-06${colors.reset}`);
  console.log(`2. Check browser console for errors when viewing Master Schedule/Dashboard`);
  console.log(`3. Verify frontend is looking at the correct date (${colors.cyan}2025-08-06${colors.reset})`);
}

/**
 * Main function
 */
async function main() {
  try {
    // Get date from command line args or use today
    const date = process.argv[2] || new Date().toISOString().split('T')[0];
    
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}RABS CARDS DEBUG UTILITY${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    console.log(`Date: ${colors.cyan}${date}${colors.reset}`);
    console.log(`API Base URL: ${colors.cyan}${API_BASE_URL}${colors.reset}`);
    
    // Check server running
    const serverRunning = await checkServerRunning();
    
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      printError('Cannot proceed without database connection');
      process.exit(1);
    }
    
    // Check loom instances
    printHeader('CHECKING DATABASE');
    const instances = await checkLoomInstances(date);
    const instancesExist = instances.length > 0;
    
    // Check time slots
    const timeSlotsExist = instancesExist && await checkTimeSlots(instances);
    
    // Check participant allocations
    if (instancesExist) {
      await checkParticipantAllocations(instances);
    }
    
    // Check staff shifts
    if (instancesExist) {
      await checkStaffShifts(instances);
    }
    
    // Check API endpoints
    printHeader('CHECKING API');
    const endpoints = await checkApiEndpoints();
    const apiEndpointsFound = endpoints.length > 0;
    
    // Test API endpoints
    let apiResponses = [];
    let apiResponsesReceived = false;
    
    if (serverRunning && apiEndpointsFound) {
      apiResponses = await testApiEndpoints(endpoints, date);
      apiResponsesReceived = apiResponses.length > 0 && apiResponses.some(r => r.dataCount > 0);
    } else if (!serverRunning) {
      printWarning('Cannot test API endpoints because server is not running');
    }
    
    // Check frontend API calls
    printHeader('CHECKING FRONTEND');
    const frontendApiCalls = await checkFrontendApiCalls();
    
    // Check programService.js
    printHeader('CHECKING BACKEND SERVICE');
    const programServiceOk = await checkProgramService();
    
    // Identify the problem
    identifyProblem({
      instancesExist,
      timeSlotsExist,
      apiEndpointsFound,
      apiResponsesReceived,
      programServiceOk
    });
    
    // Summary
    printHeader('SUMMARY');
    console.log(`${colors.bright}Database:${colors.reset}`);
    console.log(`  Loom Instances: ${instancesExist ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  Time Slots: ${timeSlotsExist ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    
    console.log(`\n${colors.bright}API:${colors.reset}`);
    console.log(`  Endpoints Found: ${apiEndpointsFound ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    console.log(`  Responses Received: ${apiResponsesReceived ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    
    console.log(`\n${colors.bright}Backend:${colors.reset}`);
    console.log(`  programService.js: ${programServiceOk ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
    
    console.log(`\n${colors.bright}${colors.magenta}FINAL DIAGNOSIS:${colors.reset}`);
    
    if (!instancesExist) {
      console.log(`${colors.red}No loom instances found in the database for date ${date}${colors.reset}`);
      console.log(`${colors.yellow}This is the root cause of cards not showing in the UI${colors.reset}`);
    } else if (!timeSlotsExist) {
      console.log(`${colors.red}No time slots found for loom instances${colors.reset}`);
      console.log(`${colors.yellow}This is the root cause of cards not showing in the UI${colors.reset}`);
    } else if (!apiResponsesReceived) {
      console.log(`${colors.red}API endpoints are not returning data${colors.reset}`);
      console.log(`${colors.yellow}This is the root cause of cards not showing in the UI${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Data exists in the database and API endpoints are working${colors.reset}`);
      console.log(`${colors.yellow}The issue is likely in the frontend code or API response parsing${colors.reset}`);
      console.log(`${colors.yellow}Check browser console for JavaScript errors${colors.reset}`);
    }
    
  } catch (error) {
    printError(`Fatal error: ${error.message}`);
    console.error(error);
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
