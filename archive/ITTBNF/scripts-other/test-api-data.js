/**
 * test-api-data.js
 * 
 * Quick diagnostic script to check what data structure the venues and participants APIs 
 * actually return, to help debug white screen issues in the frontend.
 * 
 * Usage:
 *   node test-api-data.js
 */

require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');
const util = require('util');

// Setup logger with timestamps and colors
const logger = {
  info: (msg) => console.log(`\x1b[36m[${new Date().toISOString()}] INFO: ${msg}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m[${new Date().toISOString()}] ERROR: ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m[${new Date().toISOString()}] SUCCESS: ${msg}\x1b[0m`),
  warn: (msg) => console.warn(`\x1b[33m[${new Date().toISOString()}] WARNING: ${msg}\x1b[0m`),
  data: (label, data) => {
    console.log(`\x1b[35m[${new Date().toISOString()}] ${label}:\x1b[0m`);
    console.log(util.inspect(data, { colors: true, depth: 10, maxArrayLength: 5 }));
  }
};

// API base URL
const API_BASE_URL = `http://localhost:${process.env.PORT || 3009}/api/v1`;

/**
 * Test a specific API endpoint and analyze its response structure
 * @param {string} endpoint - API endpoint path (without base URL)
 * @param {string} description - Human-readable description of what we're testing
 * @param {Array} expectedFields - Array of field names we expect to find
 * @param {Array} jsonFields - Array of fields that should be JSON objects
 */
async function testEndpoint(endpoint, description, expectedFields = [], jsonFields = []) {
  logger.info(`Testing ${description} (${endpoint})...`);
  
  try {
    const response = await axios.get(`${API_BASE_URL}${endpoint}`, { 
      timeout: 5000,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    logger.success(`API call successful! Status: ${response.status}`);
    
    // Check response structure
    const data = response.data;
    logger.data('Response structure', {
      keys: Object.keys(data),
      dataType: typeof data,
      isArray: Array.isArray(data),
      length: Array.isArray(data) ? data.length : null
    });
    
    // Check for data wrapper patterns
    if (data.data && Array.isArray(data.data)) {
      logger.info(`Found data wrapper with ${data.data.length} items`);
      
      // Show first item
      if (data.data.length > 0) {
        const firstItem = data.data[0];
        logger.data('First item structure', {
          keys: Object.keys(firstItem),
          id: firstItem.id,
          name: firstItem.name || firstItem.first_name
        });
        
        // Check expected fields
        if (expectedFields.length > 0) {
          const missingFields = expectedFields.filter(field => !firstItem.hasOwnProperty(field));
          if (missingFields.length > 0) {
            logger.warn(`Missing expected fields: ${missingFields.join(', ')}`);
          } else {
            logger.success('All expected fields are present');
          }
        }
        
        // Validate JSON fields
        for (const field of jsonFields) {
          if (firstItem[field]) {
            logger.info(`Checking JSON field: ${field}`);
            logger.data(`${field} value`, firstItem[field]);
            
            // Check if it's already a parsed object
            if (typeof firstItem[field] === 'object') {
              logger.success(`${field} is already a parsed object`);
            } else if (typeof firstItem[field] === 'string') {
              // Try parsing if it's a string
              try {
                const parsed = JSON.parse(firstItem[field]);
                logger.warn(`${field} is a string that needs parsing: ${firstItem[field]}`);
                logger.data(`${field} parsed`, parsed);
              } catch (e) {
                logger.error(`${field} is not valid JSON: ${e.message}`);
              }
            } else {
              logger.warn(`${field} is neither object nor string: ${typeof firstItem[field]}`);
            }
          } else {
            logger.warn(`${field} is missing or null`);
          }
        }
      }
    } else if (Array.isArray(data)) {
      logger.info(`Direct array response with ${data.length} items`);
      
      // Show first item
      if (data.length > 0) {
        const firstItem = data[0];
        logger.data('First item structure', {
          keys: Object.keys(firstItem),
          id: firstItem.id,
          name: firstItem.name || firstItem.first_name
        });
        
        // Check expected fields
        if (expectedFields.length > 0) {
          const missingFields = expectedFields.filter(field => !firstItem.hasOwnProperty(field));
          if (missingFields.length > 0) {
            logger.warn(`Missing expected fields: ${missingFields.join(', ')}`);
          } else {
            logger.success('All expected fields are present');
          }
        }
        
        // Validate JSON fields
        for (const field of jsonFields) {
          if (firstItem[field]) {
            logger.info(`Checking JSON field: ${field}`);
            logger.data(`${field} value`, firstItem[field]);
            
            // Check if it's already a parsed object
            if (typeof firstItem[field] === 'object') {
              logger.success(`${field} is already a parsed object`);
            } else if (typeof firstItem[field] === 'string') {
              // Try parsing if it's a string
              try {
                const parsed = JSON.parse(firstItem[field]);
                logger.warn(`${field} is a string that needs parsing: ${firstItem[field]}`);
                logger.data(`${field} parsed`, parsed);
              } catch (e) {
                logger.error(`${field} is not valid JSON: ${e.message}`);
              }
            } else {
              logger.warn(`${field} is neither object nor string: ${typeof firstItem[field]}`);
            }
          } else {
            logger.warn(`${field} is missing or null`);
          }
        }
      }
    } else {
      logger.warn('Unexpected response structure - neither data wrapper nor array');
      logger.data('Full response', data);
    }
    
    return true;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error(`API call timed out after 5 seconds! The endpoint is hanging.`);
    } else if (error.response) {
      logger.error(`API call failed with status ${error.response.status}`);
      logger.data('Error response', error.response.data);
    } else {
      logger.error(`API call failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Main function to run all tests
 */
async function runTests() {
  logger.info('Starting API data structure tests...');
  
  // Test venues endpoint
  await testEndpoint(
    '/venues', 
    'Venues API',
    ['id', 'name', 'address'], 
    ['amenities', 'accessibility']
  );
  
  // Test participants endpoint
  await testEndpoint(
    '/participants', 
    'Participants API',
    ['id', 'first_name', 'last_name'], 
    ['support_needs']
  );
  
  // Test a known working endpoint for comparison
  await testEndpoint(
    '/vehicles', 
    'Vehicles API (known working)',
    ['id', 'description', 'seats'], 
    []
  );
  
  logger.info('All tests completed');
}

// Run the tests
runTests().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
