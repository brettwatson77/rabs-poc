/**
 * Test Fixed APIs
 * 
 * This script tests all the fixed APIs to ensure they're working correctly.
 * 
 * Usage: node scripts/test-fixed-apis.js
 */

const axios = require('axios');
const util = require('util');

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
  if (error && error.response) {
    const { status, statusText, data } = error.response;
    log(`Status: ${status} ${statusText}`, colors.red);
    log(`Response data: ${util.inspect(data, { colors: true, depth: 2 })}`, colors.red);
  } else if (error) {
    log(`Error: ${error.message}`, colors.red);
  }
}

// Test all APIs
async function testAllApis() {
  const API_BASE_URL = 'http://localhost:3009';
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  log('\n' + '='.repeat(80), colors.bright);
  log('TESTING ALL FIXED APIS', colors.bright);
  log('='.repeat(80), colors.bright);
  
  // Test Dashboard Cards API
  log('\nTesting Dashboard Cards API...', colors.blue);
  try {
    const dashboardResponse = await axios.get(`${API_BASE_URL}/api/v1/dashboard/cards`, {
      params: { date: today }
    });
    successLog(`Dashboard Cards API returned status ${dashboardResponse.status}`);
    log(`Response data: ${util.inspect(dashboardResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Dashboard Cards API request failed', error);
  }
  
  // Test Roster API
  log('\nTesting Roster API...', colors.blue);
  try {
    const rosterResponse = await axios.get(`${API_BASE_URL}/api/v1/roster`, {
      params: { date: today }
    });
    successLog(`Roster API returned status ${rosterResponse.status}`);
    log(`Response data: ${util.inspect(rosterResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Roster API request failed', error);
  }
  
  // Test Roster Metrics API
  log('\nTesting Roster Metrics API...', colors.blue);
  try {
    const metricsResponse = await axios.get(`${API_BASE_URL}/api/v1/roster/metrics`, {
      params: { date: today }
    });
    successLog(`Roster Metrics API returned status ${metricsResponse.status}`);
    log(`Response data: ${util.inspect(metricsResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Roster Metrics API request failed', error);
  }
  
  // Test Loom Instances API
  log('\nTesting Loom Instances API...', colors.blue);
  try {
    const loomResponse = await axios.get(`${API_BASE_URL}/api/v1/loom/instances`, {
      params: { startDate: today, endDate: tomorrowStr }
    });
    successLog(`Loom Instances API returned status ${loomResponse.status}`);
    log(`Response data: ${util.inspect(loomResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Loom Instances API request failed', error);
  }
  
  // Test specific date (2025-08-06) that should have data
  const specificDate = '2025-08-06';
  log(`\nTesting APIs with specific date: ${specificDate}...`, colors.magenta);
  
  // Test Dashboard Cards with specific date
  log('\nTesting Dashboard Cards API with specific date...', colors.blue);
  try {
    const dashboardSpecificResponse = await axios.get(`${API_BASE_URL}/api/v1/dashboard/cards`, {
      params: { date: specificDate }
    });
    successLog(`Dashboard Cards API returned status ${dashboardSpecificResponse.status}`);
    log(`Response data: ${util.inspect(dashboardSpecificResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Dashboard Cards API request failed for specific date', error);
  }
  
  // Test Roster with specific date
  log('\nTesting Roster API with specific date...', colors.blue);
  try {
    const rosterSpecificResponse = await axios.get(`${API_BASE_URL}/api/v1/roster`, {
      params: { date: specificDate }
    });
    successLog(`Roster API returned status ${rosterSpecificResponse.status}`);
    log(`Response data: ${util.inspect(rosterSpecificResponse.data, { colors: true, depth: 2 })}`, colors.green);
  } catch (error) {
    errorLog('Roster API request failed for specific date', error);
  }
}

// Run the tests
testAllApis().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
