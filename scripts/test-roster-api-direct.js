/**
 * Test Roster Service Directly
 * 
 * This script calls the rosterService functions directly (bypassing the API routes)
 * to determine if the issue is in the service logic or the API routing.
 */

// Import the roster service directly
const rosterService = require('../backend/services/rosterService');
const { Pool } = require('pg');

// Test parameters
const startDate = '2025-08-05';
const endDate = '2025-08-12';
const singleDate = '2025-08-06';

// Helper functions
const log = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
};

// Function to test the getRoster function
async function testGetRoster() {
  try {
    log('\nTesting getRoster(startDate, endDate)...');
    log(`Parameters: startDate=${startDate}, endDate=${endDate}`);
    
    // rosterService expects a single object parameter
    const result = await rosterService.getRoster({ startDate, endDate });
    log('✅ SUCCESS: getRoster returned data successfully');
    log(`Result: ${JSON.stringify(result, null, 2).substring(0, 500)}...`);
    
    return { success: true, data: result };
  } catch (error) {
    log(`❌ ERROR in getRoster: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    
    // Try to provide more context about the error
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      log('This appears to be a database schema issue - a column is missing or misnamed');
    } else if (error.message.includes('not a function')) {
      log('This appears to be a function reference issue - check if the function exists');
    }
    
    return { success: false, error };
  }
}

// Function to test the getRosterForDate function
async function testGetRosterForDate() {
  try {
    log('\nTesting getRosterForDate(date)...');
    log(`Parameter: date=${singleDate}`);
    
    let result;
    if (typeof rosterService.getRosterForDate === 'function') {
      // Newer API provides a dedicated function
      result = await rosterService.getRosterForDate(singleDate);
    } else {
      // Fallback to generic getRoster with { date }
      result = await rosterService.getRoster({ date: singleDate });
    }
    log('✅ SUCCESS: getRosterForDate returned data successfully');
    log(`Result: ${JSON.stringify(result, null, 2).substring(0, 500)}...`);
    
    return { success: true, data: result };
  } catch (error) {
    log(`❌ ERROR in getRosterForDate: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    
    return { success: false, error };
  }
}

// Function to test the getRosterMetrics function if it exists
async function testGetRosterMetrics() {
  try {
    if (typeof rosterService.getRosterMetrics !== 'function') {
      log('\nSkipping getRosterMetrics - function does not exist in the service');
      return { success: false, error: 'Function does not exist' };
    }
    
    log('\nTesting getRosterMetrics(startDate, endDate)...');
    log(`Parameters: startDate=${startDate}, endDate=${endDate}`);
    
    const result = await rosterService.getRosterMetrics(startDate, endDate);
    log('✅ SUCCESS: getRosterMetrics returned data successfully');
    log(`Result: ${JSON.stringify(result, null, 2).substring(0, 500)}...`);
    
    return { success: true, data: result };
  } catch (error) {
    log(`❌ ERROR in getRosterMetrics: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    
    return { success: false, error };
  }
}

// Function to inspect the roster service module
function inspectRosterService() {
  log('\nInspecting rosterService module...');
  
  // Get all function names
  const functionNames = Object.keys(rosterService).filter(key => 
    typeof rosterService[key] === 'function'
  );
  
  log(`Available functions: ${functionNames.join(', ')}`);
  
  // Check for specific functions
  const hasGetRoster = typeof rosterService.getRoster === 'function';
  const hasGetRosterForDate = typeof rosterService.getRosterForDate === 'function';
  const hasGetRosterMetrics = typeof rosterService.getRosterMetrics === 'function';
  
  log(`getRoster function exists: ${hasGetRoster}`);
  log(`getRosterForDate function exists: ${hasGetRosterForDate}`);
  log(`getRosterMetrics function exists: ${hasGetRosterMetrics}`);
  
  return { functionNames, hasGetRoster, hasGetRosterForDate, hasGetRosterMetrics };
}

// Main function
async function main() {
  log('\n================================================================================');
  log('TEST ROSTER SERVICE DIRECTLY');
  log('================================================================================\n');
  
  try {
    // Inspect the roster service
    inspectRosterService();
    
    // Test the getRoster function
    const rosterResult = await testGetRoster();
    
    // Test the getRosterForDate function
    const rosterForDateResult = await testGetRosterForDate();
    
    // Test the getRosterMetrics function
    const metricsResult = await testGetRosterMetrics();
    
    // Summary
    log('\n================================================================================');
    log('TEST SUMMARY');
    log('================================================================================\n');
    
    log(`getRoster: ${rosterResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    log(`getRosterForDate: ${rosterForDateResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    log(`getRosterMetrics: ${metricsResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // Conclusion
    log('\n================================================================================');
    log('CONCLUSION');
    log('================================================================================\n');
    
    if (rosterResult.success && rosterForDateResult.success) {
      log('✅ The roster service functions work correctly when called directly.');
      log('The issue is likely in the API routing or controller layer, not the service.');
    } else {
      log('❌ The roster service functions fail when called directly.');
      log('The issue is in the service implementation, not the API routing.');
    }
    
    log('\nCheck the logs above for specific error details.');
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    console.error(error);
  } finally {
    // Close any open resources
    if (global.pool) {
      await global.pool.end();
    }
    
    // Exit process to ensure it doesn't hang
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
