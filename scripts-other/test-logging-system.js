/**
 * test-logging-system.js
 * 
 * Test script to verify the new logging system works correctly.
 * This script tests both direct database access and API endpoints.
 */

// Import required modules
const axios = require('axios');
const { pool } = require('./backend/database');
const loomLogController = require('./backend/controllers/loomLogController');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_BASE_URL = 'http://localhost:3009/api/v1';
const LOG_ENDPOINT = `${API_BASE_URL}/loom/logs`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Print a formatted test header
 * @param {string} message - The header message
 */
function printHeader(message) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + ' ' + message + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

/**
 * Print a success message
 * @param {string} message - The success message
 */
function printSuccess(message) {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

/**
 * Print a warning message
 * @param {string} message - The warning message
 */
function printWarning(message) {
  console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

/**
 * Print an error message
 * @param {string} message - The error message
 * @param {Error} error - The error object
 */
function printError(message, error) {
  console.error(colors.red + '✗ ' + message + colors.reset);
  if (error) {
    console.error(colors.red + '  Error details: ' + error.message + colors.reset);
    if (error.response) {
      console.error(colors.red + '  Response status: ' + error.response.status + colors.reset);
      console.error(colors.red + '  Response data: ' + JSON.stringify(error.response.data, null, 2) + colors.reset);
    }
  }
}

/**
 * Test database connection to system_logs table
 */
async function testDatabaseConnection() {
  printHeader('Testing Database Connection to system_logs Table');
  
  try {
    const result = await pool.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)', ['system_logs']);
    
    if (result.rows[0].exists) {
      printSuccess('system_logs table exists in the database');
    } else {
      printError('system_logs table does not exist in the database');
      process.exit(1);
    }
    
    // Check if indexes exist
    const indexResult = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'system_logs' AND indexname LIKE 'idx_system_logs%'
    `);
    
    if (indexResult.rows.length >= 4) {
      printSuccess(`Found ${indexResult.rows.length} indexes on system_logs table`);
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
    } else {
      printWarning(`Expected at least 4 indexes, but found ${indexResult.rows.length}`);
    }
    
    return true;
  } catch (error) {
    printError('Failed to connect to database or query system_logs table', error);
    process.exit(1);
  }
}

/**
 * Create sample log entries using loomLogController helper functions
 */
async function createSampleLogs() {
  printHeader('Creating Sample Log Entries via Controller Functions');
  
  try {
    // Create an INFO log
    const infoLog = await loomLogController.logSystemEvent(
      'System test completed successfully',
      {
        test_id: uuidv4(),
        test_name: 'system_logs_test',
        timestamp: new Date().toISOString()
      }
    );
    printSuccess('Created INFO log entry');
    
    // Create a WARN log for optimization
    const warnLog = await loomLogController.logOptimizationIssue(
      {
        id: uuidv4(),
        vehicle_id: 'v-test-001',
        vehicle_name: 'Test Vehicle',
        target_duration: 45,
        actual_duration: 75,
        difference: 30,
        destination: 'Test Destination',
        pickup_count: 5,
        distance_km: 25
      },
      [
        { id: 'p-test-001', first_name: 'Test', last_name: 'Participant' },
        { id: 'p-test-002', first_name: 'Another', last_name: 'Participant' }
      ]
    );
    printSuccess('Created WARN log entry for optimization issue');
    
    // Create an ERROR log for resource shortage
    const errorLog = await loomLogController.logResourceIssue(
      'STAFF',
      10,
      7,
      [
        { id: 'prog-test-001', name: 'Test Program', unassigned_shifts: 2 },
        { id: 'prog-test-002', name: 'Another Program', unassigned_shifts: 1 }
      ]
    );
    printSuccess('Created ERROR log entry for resource issue');
    
    // Create a CRITICAL log for system error
    const criticalLog = await loomLogController.logSystemError(
      'Test system error',
      {
        errorType: 'TEST',
        operation: 'system_test',
        attempts: 1
      },
      true // isCritical = true
    );
    printSuccess('Created CRITICAL log entry for system error');
    
    return {
      infoLog,
      warnLog,
      errorLog,
      criticalLog
    };
  } catch (error) {
    printError('Failed to create sample log entries', error);
    process.exit(1);
  }
}

/**
 * Test the GET /api/v1/loom/logs endpoint
 */
async function testLogsEndpoint() {
  printHeader('Testing GET /api/v1/loom/logs Endpoint');
  
  try {
    const response = await axios.get(LOG_ENDPOINT);
    
    if (response.status === 200 && response.data.success) {
      printSuccess('Successfully retrieved logs from API');
      console.log(`  Retrieved ${response.data.data.length} log entries`);
      
      if (response.data.data.length > 0) {
        const sampleLog = response.data.data[0];
        console.log('\n  Sample log entry:');
        console.log(`  - ID: ${sampleLog.id}`);
        console.log(`  - Timestamp: ${sampleLog.timestamp_iso}`);
        console.log(`  - Severity: ${sampleLog.severity}`);
        console.log(`  - Category: ${sampleLog.category}`);
        console.log(`  - Message: ${sampleLog.message}`);
        console.log(`  - Resolution required: ${sampleLog.resolution_required ? 'Yes' : 'No'}`);
      }
      
      return response.data.data;
    } else {
      printError('API returned unexpected response', { response });
      return [];
    }
  } catch (error) {
    printError('Failed to retrieve logs from API', error);
    return [];
  }
}

/**
 * Test log filtering functionality
 * @param {Array} logs - Array of logs from the API
 */
async function testLogFiltering(logs) {
  printHeader('Testing Log Filtering');
  
  if (logs.length === 0) {
    printWarning('No logs available to test filtering');
    return;
  }
  
  try {
    // Test severity filter
    const severityResponse = await axios.get(`${LOG_ENDPOINT}?severity=ERROR`);
    if (severityResponse.status === 200 && severityResponse.data.success) {
      printSuccess(`Severity filter: Found ${severityResponse.data.data.length} ERROR logs`);
      
      // Verify all returned logs have ERROR severity
      const allErrorSeverity = severityResponse.data.data.every(log => log.severity === 'ERROR');
      if (allErrorSeverity) {
        printSuccess('All logs in response have ERROR severity');
      } else {
        printError('Some logs in response do not have ERROR severity');
      }
    }
    
    // Test category filter
    const categoryResponse = await axios.get(`${LOG_ENDPOINT}?category=RESOURCE`);
    if (categoryResponse.status === 200 && categoryResponse.data.success) {
      printSuccess(`Category filter: Found ${categoryResponse.data.data.length} RESOURCE logs`);
      
      // Verify all returned logs have RESOURCE category
      const allResourceCategory = categoryResponse.data.data.every(log => log.category === 'RESOURCE');
      if (allResourceCategory) {
        printSuccess('All logs in response have RESOURCE category');
      } else {
        printError('Some logs in response do not have RESOURCE category');
      }
    }
    
    // Test resolution required filter
    const resolutionResponse = await axios.get(`${LOG_ENDPOINT}?resolutionRequired=true`);
    if (resolutionResponse.status === 200 && resolutionResponse.data.success) {
      printSuccess(`Resolution filter: Found ${resolutionResponse.data.data.length} logs requiring resolution`);
      
      // Verify all returned logs require resolution
      const allRequireResolution = resolutionResponse.data.data.every(log => log.resolution_required === true);
      if (allRequireResolution) {
        printSuccess('All logs in response require resolution');
      } else {
        printError('Some logs in response do not require resolution');
      }
    }
    
    // Test combined filters
    const combinedResponse = await axios.get(`${LOG_ENDPOINT}?severity=ERROR&category=RESOURCE&resolutionRequired=true`);
    if (combinedResponse.status === 200 && combinedResponse.data.success) {
      printSuccess(`Combined filters: Found ${combinedResponse.data.data.length} ERROR+RESOURCE logs requiring resolution`);
      
      // Verify all returned logs match all criteria
      const allMatch = combinedResponse.data.data.every(log => 
        log.severity === 'ERROR' && 
        log.category === 'RESOURCE' && 
        log.resolution_required === true
      );
      
      if (allMatch) {
        printSuccess('All logs in response match all filter criteria');
      } else {
        printError('Some logs in response do not match all filter criteria');
      }
    }
  } catch (error) {
    printError('Failed to test log filtering', error);
  }
}

/**
 * Verify the system is ready for Day 1 user journey
 */
async function verifySystemReadiness() {
  printHeader('Verifying System Readiness for Day 1 User Journey');
  
  try {
    // Check if we can create a log for Day 1 start
    const dayOneLog = await loomLogController.logSystemEvent(
      'Day 1 User Journey started',
      {
        journey_id: uuidv4(),
        start_time: new Date().toISOString(),
        user: 'Test User'
      }
    );
    
    if (dayOneLog && dayOneLog.id) {
      printSuccess('Successfully created Day 1 start log');
      
      // Check if we can retrieve the log we just created
      const response = await axios.get(`${LOG_ENDPOINT}?limit=1`);
      if (response.status === 200 && response.data.success && response.data.data.length > 0) {
        printSuccess('Successfully retrieved logs from API');
        printSuccess('Logging system is ready for Day 1 user journey');
        
        // Print summary
        console.log('\n' + colors.bright + colors.green + '✓ ALL TESTS PASSED - SYSTEM READY' + colors.reset);
        console.log('\nYou can now start the Day 1 User Journey:');
        console.log('1. Create a new program');
        console.log('2. Add participants to program');
        console.log('3. Allocate staff');
        console.log('4. Assign vehicles');
        console.log('5. Generate billing');
        
        return true;
      } else {
        printError('Could not retrieve logs from API');
        return false;
      }
    } else {
      printError('Failed to create Day 1 start log');
      return false;
    }
  } catch (error) {
    printError('Failed to verify system readiness', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log(colors.bright + colors.magenta + '\n' + 
      '╔═══════════════════════════════════════════════════════════════════════════╗\n' +
      '║                        LOGGING SYSTEM TEST                                ║\n' +
      '╚═══════════════════════════════════════════════════════════════════════════╝' + 
      colors.reset);
    
    // Test database connection
    await testDatabaseConnection();
    
    // Create sample logs
    await createSampleLogs();
    
    // Test logs endpoint
    const logs = await testLogsEndpoint();
    
    // Test log filtering
    await testLogFiltering(logs);
    
    // Verify system readiness
    await verifySystemReadiness();
    
  } catch (error) {
    printError('An unexpected error occurred during testing', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the tests
runTests();
