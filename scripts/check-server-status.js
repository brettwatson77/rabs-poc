/**
 * Server Status Checker
 * 
 * This script checks if the server is running and tests all critical API endpoints.
 * It provides a detailed report of what's working and what's not.
 */

const axios = require('axios');
const chalk = require('chalk'); // For colored console output

// Configuration
const BASE_URL = 'http://localhost:3009';
const TEST_DATE = '2025-08-06';
const TIMEOUT = 5000; // 5 seconds timeout for requests

// Helper function to format endpoint results
const formatResult = (endpoint, status, data, error = null) => {
  const statusText = status ? chalk.green('✓ WORKING') : chalk.red('✗ FAILED');
  const endpointText = chalk.blue(endpoint);
  
  console.log(`\n${endpointText}: ${statusText}`);
  
  if (status) {
    if (data) {
      if (typeof data === 'object') {
        console.log(chalk.gray('Response:'), JSON.stringify(data, null, 2).substring(0, 300) + (JSON.stringify(data, null, 2).length > 300 ? '...' : ''));
      } else {
        console.log(chalk.gray('Response:'), data.substring(0, 300) + (data.length > 300 ? '...' : ''));
      }
    }
  } else {
    if (error) {
      if (error.response) {
        console.log(chalk.red('Status:'), error.response.status);
        console.log(chalk.red('Message:'), error.message);
        if (error.response.data) {
          console.log(chalk.red('Response:'), error.response.data);
        }
      } else if (error.request) {
        console.log(chalk.red('Error:'), 'No response received. Server might be down.');
      } else {
        console.log(chalk.red('Error:'), error.message);
      }
    }
  }
};

// Test an endpoint
const testEndpoint = async (endpoint, params = {}, method = 'get') => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(chalk.yellow(`Testing ${method.toUpperCase()} ${url}`), params ? `with params: ${JSON.stringify(params)}` : '');
    
    const response = await axios({
      method,
      url,
      params,
      timeout: TIMEOUT
    });
    
    formatResult(endpoint, true, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    formatResult(endpoint, false, null, error);
    return { success: false, error };
  }
};

// Main function
const checkServerStatus = async () => {
  console.log(chalk.bold.yellow('\n============================================'));
  console.log(chalk.bold.yellow('           SERVER STATUS CHECKER'));
  console.log(chalk.bold.yellow('============================================\n'));
  
  console.log(chalk.bold('Testing server at:'), BASE_URL);
  console.log(chalk.bold('Test date:'), TEST_DATE);
  console.log(chalk.bold('Timeout:'), `${TIMEOUT}ms`);
  
  const results = {
    serverHealth: false,
    dashboard: false,
    roster: false,
    loomInstances: false,
    participants: false,
    staff: false,
    vehicles: false,
    venues: false,
    programs: false
  };
  
  // Test server health
  const healthResult = await testEndpoint('/');
  results.serverHealth = healthResult.success;
  
  // Test API version
  await testEndpoint('/api/v1');
  
  // Test Dashboard API
  const dashboardResult = await testEndpoint('/api/v1/dashboard/cards', { date: TEST_DATE });
  results.dashboard = dashboardResult.success;
  
  // Test Roster API
  const rosterResult = await testEndpoint('/api/v1/roster', { startDate: TEST_DATE, endDate: '2025-08-13' });
  results.roster = rosterResult.success;
  
  // Test Roster Metrics API
  await testEndpoint('/api/v1/roster/metrics', { startDate: TEST_DATE, endDate: '2025-08-13' });
  
  // Test Loom Instances API
  const loomResult = await testEndpoint('/api/v1/loom/instances', { startDate: TEST_DATE, endDate: '2025-08-13' });
  results.loomInstances = loomResult.success;
  
  // Test resource APIs
  results.participants = (await testEndpoint('/api/v1/participants')).success;
  results.staff = (await testEndpoint('/api/v1/staff')).success;
  results.vehicles = (await testEndpoint('/api/v1/vehicles')).success;
  results.venues = (await testEndpoint('/api/v1/venues')).success;
  results.programs = (await testEndpoint('/api/v1/programs')).success;
  
  // Test other important endpoints
  await testEndpoint('/api/v1/finance/metrics', { startDate: TEST_DATE, endDate: '2025-08-13' });
  await testEndpoint('/api/v1/planner');
  
  // Summary
  console.log(chalk.bold.yellow('\n============================================'));
  console.log(chalk.bold.yellow('               SUMMARY'));
  console.log(chalk.bold.yellow('============================================\n'));
  
  Object.entries(results).forEach(([key, value]) => {
    const status = value ? chalk.green('✓ WORKING') : chalk.red('✗ FAILED');
    console.log(`${chalk.bold(key.padEnd(20))}: ${status}`);
  });
  
  // Overall status
  const overallStatus = Object.values(results).every(Boolean);
  console.log('\n' + chalk.bold('Overall Status:'), overallStatus ? 
    chalk.green.bold('✓ SERVER IS HEALTHY') : 
    chalk.red.bold('✗ SERVER HAS ISSUES'));
  
  console.log(chalk.bold.yellow('\n============================================\n'));
  
  // Recommendations
  if (!overallStatus) {
    console.log(chalk.bold('Recommendations:'));
    
    if (!results.serverHealth) {
      console.log(chalk.red('- Server might not be running. Check if it started correctly.'));
    }
    
    if (!results.dashboard) {
      console.log(chalk.red('- Dashboard API is not working. Check dashboard routes and controller.'));
    }
    
    if (!results.roster) {
      console.log(chalk.red('- Roster API is not working. Check roster routes, controller, and service.'));
      console.log(chalk.red('  Possible issues: SQL column name mismatch (instance_id vs loom_instance_id).'));
    }
    
    if (!results.loomInstances && results.serverHealth) {
      console.log(chalk.red('- Loom Instances API is not working. Check loom routes and controller.'));
    }
    
    console.log(chalk.yellow('\nTry these commands:'));
    console.log(chalk.yellow('1. Check server logs for errors'));
    console.log(chalk.yellow('2. Restart the server: cd backend && node server.js'));
    console.log(chalk.yellow('3. Run the fix script: node scripts/fix-api-routes-emergency.js'));
  }
};

// Run the check
checkServerStatus().catch(error => {
  console.error(chalk.red('Error running status check:'), error);
});
