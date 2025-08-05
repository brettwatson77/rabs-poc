/**
 * API Testing Script
 * 
 * Tests all critical APIs to identify exactly what's failing.
 * Provides detailed error reporting and response analysis.
 * 
 * Usage: node scripts/test-apis-now.js
 */

const axios = require('axios');
const util = require('util');

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
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

// API base URL
const API_BASE_URL = process.env.API_URL || 'http://localhost:3009';

// Current date and date range for testing
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);

// Format date for API requests (YYYY-MM-DD)
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Deep inspect objects
function inspect(obj, depth = 2) {
  return util.inspect(obj, { colors: true, depth });
}

// Log with timestamp and color
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`${colors.cyan}[${timestamp}]${color} ${message}${colors.reset}`);
}

// Success log with timestamp
function successLog(message) {
  log(`✅ ${message}`, colors.green);
}

// Error log with timestamp
function errorLog(message, error) {
  log(`❌ ${message}`, colors.red);
  if (error) {
    if (error.response) {
      const { status, statusText, data } = error.response;
      log(`Status: ${status} ${statusText}`, colors.red);
      log(`Response data: ${inspect(data)}`, colors.red);
    } else if (error.request) {
      log(`No response received: ${error.message}`, colors.red);
    } else {
      log(`Error: ${error.message}`, colors.red);
    }
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, colors.dim);
    }
  }
}

// Test an API endpoint
async function testAPI(name, url, params = {}) {
  log(`\n${colors.bright}${colors.blue}Testing ${name} API...${colors.reset}`);
  log(`URL: ${url}`, colors.yellow);
  if (Object.keys(params).length > 0) {
    log(`Parameters: ${inspect(params)}`, colors.yellow);
  }
  
  try {
    const response = await axios.get(url, { params });
    
    if (response.status === 200) {
      successLog(`${name} API returned status ${response.status}`);
      
      // Check if the response has the expected structure
      if (response.data && response.data.success === true) {
        successLog(`${name} API response indicates success`);
        
        // Analyze the data
        if (response.data.data) {
          const data = response.data.data;
          
          if (Array.isArray(data)) {
            log(`Response contains array with ${data.length} items`, colors.green);
            if (data.length > 0) {
              log(`First item sample: ${inspect(data[0])}`, colors.green);
            }
          } else if (typeof data === 'object') {
            // Check for common properties based on the API
            if (name.includes('Dashboard')) {
              const cardCount = data.cards ? data.cards.length : 0;
              log(`Dashboard has ${cardCount} cards`, colors.green);
            } else if (name.includes('Roster')) {
              const instanceCount = data.programInstances ? data.programInstances.length : 0;
              log(`Roster has ${instanceCount} program instances`, colors.green);
              
              // Check if there are time slots
              const timeSlotKeys = data.rosterByTimeSlot ? Object.keys(data.rosterByTimeSlot) : [];
              log(`Roster has ${timeSlotKeys.length} time slots`, colors.green);
            } else if (name.includes('Loom')) {
              const instanceCount = data.instances ? data.instances.length : 0;
              log(`Loom has ${instanceCount} instances`, colors.green);
            }
            
            // Show the keys in the response
            const keys = Object.keys(data);
            log(`Response data keys: ${keys.join(', ')}`, colors.green);
          }
        } else {
          log(`Response has no data property`, colors.yellow);
        }
      } else {
        log(`${name} API response indicates failure: ${inspect(response.data)}`, colors.yellow);
      }
      
      return { success: true, data: response.data };
    } else {
      errorLog(`${name} API returned unexpected status ${response.status}`);
      return { success: false, error: response.statusText };
    }
  } catch (error) {
    errorLog(`${name} API request failed`, error);
    return { success: false, error };
  }
}

// Test the Dashboard Cards API
async function testDashboardAPI() {
  const todayFormatted = formatDate(today);
  
  // Test with today's date
  await testAPI(
    'Dashboard Cards', 
    `${API_BASE_URL}/api/v1/dashboard/cards`, 
    { date: todayFormatted }
  );
  
  // Test with tomorrow's date
  await testAPI(
    'Dashboard Cards (Tomorrow)', 
    `${API_BASE_URL}/api/v1/dashboard/cards`, 
    { date: formatDate(tomorrow) }
  );
}

// Test the Roster API
async function testRosterAPI() {
  const todayFormatted = formatDate(today);
  const nextWeekFormatted = formatDate(nextWeek);
  
  // Test with date range
  await testAPI(
    'Roster', 
    `${API_BASE_URL}/api/v1/roster`, 
    { startDate: todayFormatted, endDate: nextWeekFormatted }
  );
  
  // Test with single date
  await testAPI(
    'Roster (Single Day)', 
    `${API_BASE_URL}/api/v1/roster`, 
    { date: todayFormatted }
  );
  
  // Test metrics endpoint
  await testAPI(
    'Roster Metrics', 
    `${API_BASE_URL}/api/v1/roster/metrics`, 
    { startDate: todayFormatted, endDate: nextWeekFormatted }
  );
}

// Test the Loom Instances API
async function testLoomInstancesAPI() {
  const todayFormatted = formatDate(today);
  const nextWeekFormatted = formatDate(nextWeek);
  
  // Test with date range
  await testAPI(
    'Loom Instances', 
    `${API_BASE_URL}/api/v1/loom/instances`, 
    { startDate: todayFormatted, endDate: nextWeekFormatted }
  );
  
  // Test with single date
  await testAPI(
    'Loom Instances (Single Day)', 
    `${API_BASE_URL}/api/v1/loom/instances`, 
    { date: todayFormatted }
  );
}

// Test the specific date that should have data
async function testSpecificDateWithData() {
  // August 6, 2025 - date mentioned in previous conversations
  const specificDate = '2025-08-06';
  
  log(`\n${colors.bright}${colors.magenta}Testing APIs with specific date: ${specificDate}${colors.reset}`);
  
  // Test Dashboard Cards with specific date
  await testAPI(
    'Dashboard Cards (Specific Date)', 
    `${API_BASE_URL}/api/v1/dashboard/cards`, 
    { date: specificDate }
  );
  
  // Test Roster with specific date
  await testAPI(
    'Roster (Specific Date)', 
    `${API_BASE_URL}/api/v1/roster`, 
    { date: specificDate }
  );
  
  // Test Loom Instances with specific date
  await testAPI(
    'Loom Instances (Specific Date)', 
    `${API_BASE_URL}/api/v1/loom/instances`, 
    { date: specificDate }
  );
}

// Test database connection directly (if needed)
async function testDatabaseDirectly() {
  log(`\n${colors.bright}${colors.blue}Testing Database Connection...${colors.reset}`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/system/db-status`);
    
    if (response.status === 200) {
      successLog(`Database connection test returned status ${response.status}`);
      log(`Response: ${inspect(response.data)}`, colors.green);
    } else {
      errorLog(`Database connection test returned unexpected status ${response.status}`);
    }
  } catch (error) {
    errorLog(`Database connection test failed`, error);
    log(`Note: This endpoint might not exist in your API. If so, you can ignore this error.`, colors.yellow);
  }
}

// Main function
async function main() {
  log('\n' + '='.repeat(80), colors.bright);
  log('API TESTING TOOL', colors.bright);
  log('='.repeat(80) + '\n', colors.bright);
  
  // Test all APIs
  await testDashboardAPI();
  await testRosterAPI();
  await testLoomInstancesAPI();
  await testSpecificDateWithData();
  await testDatabaseDirectly();
  
  log('\n' + '='.repeat(80), colors.bright);
  log('TESTING COMPLETE', colors.bright);
  log('='.repeat(80) + '\n', colors.bright);
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
