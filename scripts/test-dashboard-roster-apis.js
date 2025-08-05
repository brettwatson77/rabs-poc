/**
 * Dashboard & Roster API Test Script
 * 
 * This script tests all API endpoints used by the Dashboard and Roster pages
 * to diagnose why they're not loading properly. It specifically checks for:
 * 
 * 1. Date format mismatches (like we found in Master Schedule)
 * 2. Missing or malformed data in API responses
 * 3. Server errors or authentication issues
 * 
 * Usage: node scripts/test-dashboard-roster-apis.js
 */

const axios = require('axios');
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

// API base URL
const API_BASE_URL = process.env.API_URL || 'http://localhost:3009';

/**
 * Format date for API requests (YYYY-MM-DD)
 */
function formatDateForApi(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Test a single API endpoint
 */
async function testEndpoint(endpoint, params = {}, method = 'get', data = null) {
  console.log(`\n${colors.bright}${colors.blue}TESTING ENDPOINT: ${endpoint}${colors.reset}`);
  console.log(`${colors.yellow}Method:${colors.reset} ${method.toUpperCase()}`);
  
  if (Object.keys(params).length > 0) {
    console.log(`${colors.yellow}Params:${colors.reset}`, params);
  }
  
  if (data) {
    console.log(`${colors.yellow}Data:${colors.reset}`, data);
  }
  
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`${colors.yellow}URL:${colors.reset} ${url}`);
    
    const config = { params, timeout: 5000 };
    let response;
    
    if (method.toLowerCase() === 'get') {
      response = await axios.get(url, config);
    } else if (method.toLowerCase() === 'post') {
      response = await axios.post(url, data, config);
    }
    
    if (response.status === 200 && response.data.success) {
      console.log(`${colors.green}✓ SUCCESS${colors.reset} (Status: ${response.status})`);
      
      // Check if data exists and has expected structure
      if (!response.data.data) {
        console.log(`${colors.yellow}⚠ WARNING:${colors.reset} Response has no data property`);
      } else if (Array.isArray(response.data.data) && response.data.data.length === 0) {
        console.log(`${colors.yellow}⚠ WARNING:${colors.reset} Response data array is empty`);
      }
      
      // Analyze the response data
      analyzeResponseData(response.data.data, endpoint);
      
      return { success: true, data: response.data.data };
    } else {
      console.log(`${colors.red}✗ ERROR${colors.reset} (Status: ${response.status})`);
      console.log(`${colors.red}Message:${colors.reset} ${response.data.message || 'No error message provided'}`);
      return { success: false, error: response.data.message };
    }
  } catch (error) {
    console.log(`${colors.red}✗ ERROR${colors.reset}`);
    
    if (error.response) {
      // Server responded with error status
      console.log(`${colors.red}Status:${colors.reset} ${error.response.status}`);
      console.log(`${colors.red}Message:${colors.reset} ${error.response.data?.message || 'No error message provided'}`);
      return { success: false, error: error.response.data?.message, status: error.response.status };
    } else if (error.request) {
      // Request made but no response received
      console.log(`${colors.red}Error:${colors.reset} No response received from server`);
      console.log(`${colors.yellow}Is the server running?${colors.reset} Try: node server.js`);
      return { success: false, error: 'No response from server' };
    } else {
      // Error setting up request
      console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Analyze response data for common issues
 */
function analyzeResponseData(data, endpoint) {
  if (!data) {
    console.log(`${colors.yellow}⚠ WARNING:${colors.reset} No data to analyze`);
    return;
  }
  
  // Check for date format issues
  if (Array.isArray(data)) {
    console.log(`${colors.cyan}Array data with ${data.length} items${colors.reset}`);
    
    if (data.length > 0) {
      // Sample the first item
      const sample = data[0];
      console.log(`${colors.cyan}Sample item:${colors.reset}`, JSON.stringify(sample, null, 2).substring(0, 500) + (JSON.stringify(sample, null, 2).length > 500 ? '...' : ''));
      
      // Check for date fields
      checkDateFields(sample);
    }
  } else if (typeof data === 'object') {
    console.log(`${colors.cyan}Object data with ${Object.keys(data).length} keys${colors.reset}`);
    
    // For timeline data, check each category
    if (endpoint.includes('/dashboard/timeline') && data.now) {
      console.log(`${colors.cyan}Timeline data detected${colors.reset}`);
      ['earlier', 'before', 'now', 'next', 'later'].forEach(timeframe => {
        if (Array.isArray(data[timeframe]) && data[timeframe].length > 0) {
          console.log(`${colors.cyan}${timeframe}:${colors.reset} ${data[timeframe].length} items`);
          checkDateFields(data[timeframe][0]);
        }
      });
    } else {
      // For other objects, check all top-level properties
      console.log(`${colors.cyan}Keys:${colors.reset} ${Object.keys(data).join(', ')}`);
      checkDateFields(data);
    }
  }
}

/**
 * Check for date fields and their formats
 */
function checkDateFields(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  const dateFields = ['date', 'start_date', 'end_date', 'instance_date', 'start_time', 'end_time'];
  const dateFieldsFound = [];
  
  for (const field of dateFields) {
    if (obj[field]) {
      dateFieldsFound.push({ field, value: obj[field] });
    }
  }
  
  if (dateFieldsFound.length > 0) {
    console.log(`${colors.yellow}Date fields found:${colors.reset}`);
    dateFieldsFound.forEach(({ field, value }) => {
      const format = value.includes('T') ? 'ISO STRING' : 'SIMPLE DATE';
      const formatColor = format === 'ISO STRING' ? colors.magenta : colors.green;
      console.log(`  ${colors.cyan}${field}:${colors.reset} ${value} ${formatColor}(${format})${colors.reset}`);
    });
  } else {
    console.log(`${colors.yellow}No standard date fields found${colors.reset}`);
  }
  
  // Recursively check nested objects that might contain arrays of items with dates
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object' && !dateFields.includes(key)) {
      if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
        console.log(`${colors.yellow}Checking nested array:${colors.reset} ${key} (${obj[key].length} items)`);
        checkDateFields(obj[key][0]);
      } else if (!Array.isArray(obj[key])) {
        console.log(`${colors.yellow}Checking nested object:${colors.reset} ${key}`);
        checkDateFields(obj[key]);
      }
    }
  }
}

/**
 * Test all Dashboard API endpoints
 */
async function testDashboardApis() {
  console.log('\n' + '*'.repeat(80));
  console.log(`${colors.bright}${colors.green}TESTING DASHBOARD APIs${colors.reset}`);
  console.log('*'.repeat(80));
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Test timeline endpoint
  const timelineResult = await testEndpoint(
    '/api/v1/dashboard/timeline',
    { date: formatDateForApi(tomorrow) }
  );
  
  // Test financials endpoint
  const financialsResult = await testEndpoint(
    '/api/v1/dashboard/financials/all',
    { date: formatDateForApi(tomorrow) }
  );
  
  // Test metrics endpoint
  const metricsResult = await testEndpoint(
    '/api/v1/dashboard/metrics',
    { date: formatDateForApi(tomorrow) }
  );
  
  // Summarize results
  console.log('\n' + '-'.repeat(80));
  console.log(`${colors.bright}DASHBOARD API SUMMARY:${colors.reset}`);
  console.log('-'.repeat(80));
  console.log(`Timeline API: ${timelineResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(`Financials API: ${financialsResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(`Metrics API: ${metricsResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(colors.reset);
  
  return {
    timeline: timelineResult,
    financials: financialsResult,
    metrics: metricsResult
  };
}

/**
 * Test all Roster API endpoints
 */
async function testRosterApis() {
  console.log('\n' + '*'.repeat(80));
  console.log(`${colors.bright}${colors.green}TESTING ROSTER APIs${colors.reset}`);
  console.log('*'.repeat(80));
  
  const today = new Date();
  const weekLater = new Date(today);
  weekLater.setDate(today.getDate() + 7);
  
  // Test main roster endpoint
  const rosterResult = await testEndpoint(
    '/api/v1/roster',
    {
      startDate: formatDateForApi(today),
      endDate: formatDateForApi(weekLater)
    }
  );
  
  // Test staff endpoint (used by roster)
  const staffResult = await testEndpoint('/api/v1/staff');
  
  // Test roster metrics endpoint
  const rosterMetricsResult = await testEndpoint(
    '/api/v1/roster/metrics',
    {
      startDate: formatDateForApi(today),
      endDate: formatDateForApi(weekLater)
    }
  );
  
  // Summarize results
  console.log('\n' + '-'.repeat(80));
  console.log(`${colors.bright}ROSTER API SUMMARY:${colors.reset}`);
  console.log('-'.repeat(80));
  console.log(`Main Roster API: ${rosterResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(`Staff API: ${staffResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(`Roster Metrics API: ${rosterMetricsResult.success ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(colors.reset);
  
  return {
    roster: rosterResult,
    staff: staffResult,
    metrics: rosterMetricsResult
  };
}

/**
 * Test loom instances API (for comparison with other APIs)
 */
async function testLoomInstancesApi() {
  console.log('\n' + '*'.repeat(80));
  console.log(`${colors.bright}${colors.green}TESTING LOOM INSTANCES API (REFERENCE)${colors.reset}`);
  console.log('*'.repeat(80));
  
  const today = new Date();
  const weekLater = new Date(today);
  weekLater.setDate(today.getDate() + 7);
  
  // Test loom instances endpoint
  const instancesResult = await testEndpoint(
    '/api/v1/loom/instances',
    {
      startDate: formatDateForApi(today),
      endDate: formatDateForApi(weekLater)
    }
  );
  
  return {
    instances: instancesResult
  };
}

/**
 * Generate fix recommendations based on test results
 */
function generateFixRecommendations(results) {
  console.log('\n' + '*'.repeat(80));
  console.log(`${colors.bright}${colors.green}FIX RECOMMENDATIONS${colors.reset}`);
  console.log('*'.repeat(80));
  
  // Check for date format issues
  const dateFormatIssues = [];
  let hasDateFormatIssues = false;
  
  // Check if any API failed
  const failedApis = [];
  
  // Dashboard APIs
  if (!results.dashboard.timeline.success) {
    failedApis.push('Dashboard Timeline');
  }
  if (!results.dashboard.financials.success) {
    failedApis.push('Dashboard Financials');
  }
  if (!results.dashboard.metrics.success) {
    failedApis.push('Dashboard Metrics');
  }
  
  // Roster APIs
  if (!results.roster.roster.success) {
    failedApis.push('Roster Main');
  }
  if (!results.roster.staff.success) {
    failedApis.push('Roster Staff');
  }
  if (!results.roster.metrics.success) {
    failedApis.push('Roster Metrics');
  }
  
  // If any APIs failed, recommend checking server logs
  if (failedApis.length > 0) {
    console.log(`${colors.red}⚠ FAILED APIs:${colors.reset} ${failedApis.join(', ')}`);
    console.log(`${colors.yellow}Recommendation:${colors.reset} Check server logs for errors related to these endpoints.`);
    console.log(`Run the server with: ${colors.cyan}node server.js${colors.reset} and watch for error messages.`);
  } else {
    console.log(`${colors.green}✓ All APIs returned successfully${colors.reset}`);
  }
  
  // Create Dashboard fix script if needed
  console.log(`\n${colors.bright}DASHBOARD FIX SCRIPT:${colors.reset}`);
  console.log(`Create a file named ${colors.cyan}scripts/fix-dashboard.js${colors.reset} with this content:`);
  console.log(`
/**
 * Fix Dashboard Date Format Issues
 * 
 * This script updates the Dashboard controllers to handle date formats consistently.
 * It ensures that dates are properly formatted in API responses.
 */

const fs = require('fs');
const path = require('path');

// Path to dashboard controller
const dashboardControllerPath = path.join(__dirname, '..', 'backend', 'controllers', 'dashboardController.js');

// Read the current controller file
let controllerContent = fs.readFileSync(dashboardControllerPath, 'utf8');

// Add date format helper function if it doesn't exist
if (!controllerContent.includes('formatDateForResponse')) {
  const helperFunction = \`
// Format dates consistently for API responses
const formatDateForResponse = (date) => {
  if (!date) return null;
  // Convert to YYYY-MM-DD format for consistency with frontend
  return new Date(date).toISOString().split('T')[0];
};
\`;

  // Add helper function after imports
  controllerContent = controllerContent.replace(
    /(const.*require.*\\n)+/,
    '$&\\n' + helperFunction
  );
}

// Update timeline endpoint to format dates
controllerContent = controllerContent.replace(
  /(exports\.getTimeline = async \(req, res\) => {[\\s\\S]*?)(return res\.json\({[\\s\\S]*?data: {[\\s\\S]*?}[\\s\\S]*?}\);)/g,
  '$1// Format dates before sending response\\n  Object.keys(timelineData).forEach(key => {\\n    if (Array.isArray(timelineData[key])) {\\n      timelineData[key] = timelineData[key].map(item => ({\\n        ...item,\\n        date: formatDateForResponse(item.date),\\n        instance_date: formatDateForResponse(item.instance_date)\\n      }));\\n    }\\n  });\\n\\n  $2'
);

// Write updated controller back to file
fs.writeFileSync(dashboardControllerPath, controllerContent);

console.log('✅ Dashboard controller updated to format dates consistently');
  `);
  
  // Create Roster fix script if needed
  console.log(`\n${colors.bright}ROSTER FIX SCRIPT:${colors.reset}`);
  console.log(`Create a file named ${colors.cyan}scripts/fix-roster.js${colors.reset} with this content:`);
  console.log(`
/**
 * Fix Roster Date Format Issues
 * 
 * This script updates the Roster controller to handle date formats consistently.
 * It ensures that dates are properly formatted in API responses.
 */

const fs = require('fs');
const path = require('path');

// Path to roster controller
const rosterControllerPath = path.join(__dirname, '..', 'backend', 'controllers', 'rosterController.js');

// Read the current controller file
let controllerContent = fs.readFileSync(rosterControllerPath, 'utf8');

// Add date format helper function if it doesn't exist
if (!controllerContent.includes('formatDateForResponse')) {
  const helperFunction = \`
// Format dates consistently for API responses
const formatDateForResponse = (date) => {
  if (!date) return null;
  // Convert to YYYY-MM-DD format for consistency with frontend
  return new Date(date).toISOString().split('T')[0];
};
\`;

  // Add helper function after imports
  controllerContent = controllerContent.replace(
    /(const.*require.*\\n)+/,
    '$&\\n' + helperFunction
  );
}

// Update getRoster endpoint to format dates
controllerContent = controllerContent.replace(
  /(exports\.getRoster = async \(req, res\) => {[\\s\\S]*?)(return res\.json\({[\\s\\S]*?data: shifts[\\s\\S]*?}\);)/g,
  '$1// Format dates before sending response\\n  shifts = shifts.map(shift => ({\\n    ...shift,\\n    date: formatDateForResponse(shift.date),\\n    start_time: shift.start_time,\\n    end_time: shift.end_time\\n  }));\\n\\n  $2'
);

// Write updated controller back to file
fs.writeFileSync(rosterControllerPath, controllerContent);

console.log('✅ Roster controller updated to format dates consistently');
  `);
  
  // Create frontend fix script for Roster and Dashboard
  console.log(`\n${colors.bright}FRONTEND FIX SCRIPT:${colors.reset}`);
  console.log(`Create a file named ${colors.cyan}scripts/fix-frontend-dates.js${colors.reset} with this content:`);
  console.log(`
/**
 * Fix Frontend Date Handling
 * 
 * This script updates the Dashboard.jsx and Roster.jsx files to handle
 * both simple dates and ISO date strings, similar to the fix we applied
 * to MasterSchedule.jsx.
 */

const fs = require('fs');
const path = require('path');

// Paths to frontend files
const dashboardPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Dashboard.jsx');
const rosterPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Roster.jsx');

// Fix Dashboard.jsx
console.log('Fixing Dashboard.jsx...');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Add date helper function to Dashboard
if (!dashboardContent.includes('handleDateFormats')) {
  const helperFunction = \`
  // Helper function to handle both date formats (YYYY-MM-DD and ISO strings)
  const handleDateFormats = (dateStr1, dateStr2) => {
    if (!dateStr1 || !dateStr2) return false;
    
    // Exact match
    if (dateStr1 === dateStr2) return true;
    
    // Check if dateStr1 is contained within dateStr2 (for ISO strings)
    if (typeof dateStr2 === 'string' && dateStr2.includes(dateStr1)) {
      return true;
    }
    
    // Check if dateStr2 is contained within dateStr1
    if (typeof dateStr1 === 'string' && dateStr1.includes(dateStr2)) {
      return true;
    }
    
    return false;
  };
\`;

  // Add helper function before the return statement
  dashboardContent = dashboardContent.replace(
    /(return \\()/,
    helperFunction + '\\n\\n  $1'
  );
}

// Save Dashboard changes
fs.writeFileSync(dashboardPath, dashboardContent);
console.log('✅ Dashboard.jsx updated');

// Fix Roster.jsx
console.log('Fixing Roster.jsx...');
let rosterContent = fs.readFileSync(rosterPath, 'utf8');

// Add date helper function to Roster
if (!rosterContent.includes('handleDateFormats')) {
  const helperFunction = \`
  // Helper function to handle both date formats (YYYY-MM-DD and ISO strings)
  const handleDateFormats = (dateStr1, dateStr2) => {
    if (!dateStr1 || !dateStr2) return false;
    
    // Exact match
    if (dateStr1 === dateStr2) return true;
    
    // Check if dateStr1 is contained within dateStr2 (for ISO strings)
    if (typeof dateStr2 === 'string' && dateStr2.includes(dateStr1)) {
      return true;
    }
    
    // Check if dateStr2 is contained within dateStr1
    if (typeof dateStr1 === 'string' && dateStr1.includes(dateStr2)) {
      return true;
    }
    
    return false;
  };
\`;

  // Add helper function before the return statement
  rosterContent = rosterContent.replace(
    /(return \\()/,
    helperFunction + '\\n\\n  $1'
  );
  
  // Update the date comparison in shiftsByDay calculation
  rosterContent = rosterContent.replace(
    /const dateStr = shift\.date;/,
    'const dateStr = shift.date;\\n        // Use our helper to handle both date formats'
  );
}

// Save Roster changes
fs.writeFileSync(rosterPath, rosterContent);
console.log('✅ Roster.jsx updated');

console.log('\\n✅ All frontend files updated to handle both date formats');
  `);
  
  console.log(`\n${colors.bright}${colors.green}NEXT STEPS:${colors.reset}`);
  console.log(`1. ${colors.yellow}Run the fix scripts${colors.reset} in this order:`);
  console.log(`   a. ${colors.cyan}node scripts/fix-dashboard.js${colors.reset}`);
  console.log(`   b. ${colors.cyan}node scripts/fix-roster.js${colors.reset}`);
  console.log(`   c. ${colors.cyan}node scripts/fix-frontend-dates.js${colors.reset}`);
  console.log(`2. ${colors.yellow}Restart your server${colors.reset} to apply backend changes`);
  console.log(`3. ${colors.yellow}Refresh your browser${colors.reset} to load the updated frontend code`);
  console.log(`4. ${colors.yellow}Test all pages${colors.reset} to ensure they're working properly`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}DASHBOARD & ROSTER API TEST${colors.reset}`);
    console.log('*'.repeat(80));
    
    // Test Dashboard APIs
    const dashboardResults = await testDashboardApis();
    
    // Test Roster APIs
    const rosterResults = await testRosterApis();
    
    // Test Loom Instances API for comparison
    const loomResults = await testLoomInstancesApi();
    
    // Generate fix recommendations
    generateFixRecommendations({
      dashboard: dashboardResults,
      roster: rosterResults,
      loom: loomResults
    });
    
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
