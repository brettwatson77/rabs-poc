/**
 * test-venues-endpoint.js
 * 
 * A simple test script to debug what's happening when we try to call the venues endpoint.
 * This helps isolate whether it's the database connection, the wrapper, or something else causing the hang.
 * 
 * Run with: node test-venues-endpoint.js
 */

require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');
const { Pool } = require('pg');
const { getDbConnection } = require('./backend/database');

// Setup logger with timestamps and colors
const logger = {
  info: (msg) => console.log(`\x1b[36m[${new Date().toISOString()}] INFO: ${msg}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m[${new Date().toISOString()}] ERROR: ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m[${new Date().toISOString()}] SUCCESS: ${msg}\x1b[0m`),
  warn: (msg) => console.warn(`\x1b[33m[${new Date().toISOString()}] WARNING: ${msg}\x1b[0m`),
};

// PostgreSQL connection configuration from environment variables
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'rabspocdb'
};

// Create a new pool for direct PostgreSQL access
const pool = new Pool(dbConfig);

// API endpoint to test
const API_URL = 'http://localhost:3009/api/v1/venues';

/**
 * Test 1: Direct API call with timeout
 * Tests if the API endpoint responds or hangs
 */
async function testApiEndpoint() {
  logger.info('TEST 1: Making direct API call to venues endpoint...');
  
  try {
    // Set a timeout to avoid hanging indefinitely
    const response = await axios.get(API_URL, { timeout: 5000 });
    
    logger.success(`API call successful! Status: ${response.status}`);
    logger.info(`Data received: ${JSON.stringify(response.data, null, 2)}`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error('API call timed out after 5 seconds! The endpoint is hanging.');
    } else {
      logger.error(`API call failed: ${error.message}`);
      if (error.response) {
        logger.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    return false;
  }
}

/**
 * Test 2: Direct database query using PostgreSQL client
 * Bypasses the wrapper to test if PostgreSQL connection works
 */
async function testDirectPostgresQuery() {
  logger.info('TEST 2: Testing direct PostgreSQL query...');
  
  const client = await pool.connect();
  try {
    logger.info('PostgreSQL connected successfully');
    
    // Check if venues table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'venues'
      )
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    if (!tableExists) {
      logger.error('The venues table does not exist in the database!');
      return false;
    }
    
    logger.success('Venues table exists, attempting to query data...');
    
    // Query all venues directly
    const result = await client.query('SELECT * FROM venues');
    
    logger.success(`Direct query successful! Found ${result.rows.length} venues`);
    logger.info(`First venue: ${JSON.stringify(result.rows[0], null, 2)}`);
    return true;
  } catch (error) {
    logger.error(`Direct PostgreSQL query failed: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Test 3: Using the database wrapper
 * Tests if the wrapper is causing the issue
 */
async function testDatabaseWrapper() {
  logger.info('TEST 3: Testing database wrapper with venues query...');
  
  try {
    // Set a timeout to avoid hanging indefinitely
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database wrapper timed out after 5 seconds')), 5000);
    });
    
    // Get a connection using the wrapper
    const wrapperPromise = (async () => {
      let db;
      try {
        logger.info('Getting database connection through wrapper...');
        db = await getDbConnection();
        logger.success('Database connection obtained through wrapper');
        
        // Use the wrapper's all() method to query venues
        const rows = await new Promise((resolve, reject) => {
          logger.info('Executing db.all() through wrapper...');
          db.all('SELECT * FROM venues', [], (err, result) => {
            if (err) {
              logger.error(`Wrapper query error: ${err.message}`);
              return reject(err);
            }
            logger.success(`Wrapper query successful! Found ${result.length} venues`);
            resolve(result);
          });
        });
        
        logger.info(`First venue from wrapper: ${JSON.stringify(rows[0], null, 2)}`);
        return rows;
      } finally {
        if (db) {
          logger.info('Closing database connection...');
          db.close();
        }
      }
    })();
    
    // Race the wrapper against the timeout
    const result = await Promise.race([wrapperPromise, timeoutPromise]);
    logger.success('Database wrapper test completed successfully');
    return true;
  } catch (error) {
    logger.error(`Database wrapper test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Inspect the wrapper's convertPlaceholders function
 * Tests if the placeholder conversion might be causing issues
 */
async function testPlaceholderConversion() {
  logger.info('TEST 4: Testing SQL placeholder conversion...');
  
  try {
    // Access the convertPlaceholders function if available
    const databaseModule = require('./backend/database');
    
    // This is a hack to access the potentially private function
    // It may not work if the function is truly private
    let convertPlaceholders;
    for (const key in databaseModule) {
      if (typeof databaseModule[key] === 'function' && 
          databaseModule[key].toString().includes('convertPlaceholders')) {
        convertPlaceholders = databaseModule[key];
        break;
      }
    }
    
    if (!convertPlaceholders) {
      logger.warn('Could not access convertPlaceholders function, implementing our own');
      
      // Implement our own version to test
      convertPlaceholders = (sql) => {
        return sql.replace(/\?/g, (_, i) => `$${i + 1}`);
      };
    }
    
    // Test the conversion
    const sqliteQuery = 'SELECT * FROM venues WHERE id = ? AND name LIKE ?';
    const pgQuery = convertPlaceholders(sqliteQuery);
    
    logger.info(`Original SQLite query: ${sqliteQuery}`);
    logger.info(`Converted PostgreSQL query: ${pgQuery}`);
    
    // Check if conversion looks correct
    const expectedPgQuery = 'SELECT * FROM venues WHERE id = $1 AND name LIKE $2';
    const conversionCorrect = pgQuery === expectedPgQuery;
    
    if (conversionCorrect) {
      logger.success('Placeholder conversion appears to be working correctly');
    } else {
      logger.error(`Placeholder conversion may be incorrect. Expected: ${expectedPgQuery}, Got: ${pgQuery}`);
    }
    
    return conversionCorrect;
  } catch (error) {
    logger.error(`Placeholder conversion test failed: ${error.message}`);
    return false;
  }
}

/**
 * Fix the venues endpoint by creating a temporary direct implementation
 */
async function createDirectVenuesImplementation() {
  logger.info('Creating a direct venues implementation for testing...');
  
  // Define the path to the venueService.js file
  const fs = require('fs');
  const path = require('path');
  const venueServicePath = path.join(__dirname, 'backend', 'services', 'venueService.js');
  const backupPath = `${venueServicePath}.bak`;
  
  try {
    // Backup the original file
    if (fs.existsSync(venueServicePath)) {
      fs.copyFileSync(venueServicePath, backupPath);
      logger.info(`Original venueService.js backed up to ${backupPath}`);
    }
    
    // Create a new implementation using direct PostgreSQL
    const newImplementation = `// backend/services/venueService.js
const { Pool } = require('pg');
const { getDbConnection } = require('../database');

// Create a direct PostgreSQL pool for fallback
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'rabspocdb'
});

/**
 * Get all venues from the database
 * @returns {Promise<Array>} Array of venue objects
 */
const getAllVenues = async () => {
  // Try the wrapper first with timeout protection
  try {
    console.log('Attempting to get venues using database wrapper...');
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database wrapper timed out')), 2000);
    });
    
    // Create the wrapper query promise
    const wrapperPromise = (async () => {
      let db;
      try {
        db = await getDbConnection();
        return await new Promise((resolve, reject) => {
          db.all('SELECT * FROM venues', [], (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });
      } finally {
        if (db) db.close();
      }
    })();
    
    // Race the promises
    return await Promise.race([wrapperPromise, timeoutPromise]);
  } catch (error) {
    console.error('Wrapper failed, falling back to direct PostgreSQL:', error.message);
    
    // Fall back to direct PostgreSQL
    try {
      const result = await pool.query('SELECT * FROM venues');
      return result.rows;
    } catch (pgError) {
      console.error('Direct PostgreSQL also failed:', pgError.message);
      throw pgError;
    }
  }
};

/**
 * Get a single venue by ID
 * @param {string} id - Venue ID
 * @returns {Promise<Object>} Venue object
 */
const getVenueById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(\`Error fetching venue with ID \${id}:\`, error);
    throw error;
  }
};

/**
 * Create a new venue
 * @param {Object} venueData - Venue data
 * @returns {Promise<Object>} Created venue object
 */
const createVenue = async (venueData) => {
  const { name, address, capacity, description, latitude, longitude } = venueData;
  
  try {
    const result = await pool.query(
      'INSERT INTO venues (name, address, capacity, description, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, address, capacity, description, latitude, longitude]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating venue:', error);
    throw error;
  }
};

/**
 * Update a venue
 * @param {string} id - Venue ID
 * @param {Object} venueData - Updated venue data
 * @returns {Promise<Object>} Updated venue object
 */
const updateVenue = async (id, venueData) => {
  const { name, address, capacity, description, latitude, longitude } = venueData;
  
  try {
    const result = await pool.query(
      'UPDATE venues SET name = $1, address = $2, capacity = $3, description = $4, latitude = $5, longitude = $6 WHERE id = $7 RETURNING *',
      [name, address, capacity, description, latitude, longitude, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error(\`Error updating venue with ID \${id}:\`, error);
    throw error;
  }
};

/**
 * Delete a venue
 * @param {string} id - Venue ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteVenue = async (id) => {
  try {
    const result = await pool.query('DELETE FROM venues WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  } catch (error) {
    console.error(\`Error deleting venue with ID \${id}:\`, error);
    throw error;
  }
};

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue
};
`;

    // Write the new implementation
    fs.writeFileSync(venueServicePath, newImplementation);
    logger.success('Created direct PostgreSQL implementation for venueService.js');
    
    return true;
  } catch (error) {
    logger.error(`Failed to create direct implementation: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests and report results
 */
async function runTests() {
  logger.info('Starting venues endpoint tests...');
  
  // Test 1: Direct API call
  const apiResult = await testApiEndpoint();
  
  // Test 2: Direct PostgreSQL query
  const pgResult = await testDirectPostgresQuery();
  
  // Test 3: Database wrapper
  const wrapperResult = await testDatabaseWrapper();
  
  // Test 4: Placeholder conversion
  const placeholderResult = await testPlaceholderConversion();
  
  // Report results
  logger.info('\n===== TEST RESULTS =====');
  logger.info(`API Endpoint: ${apiResult ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Direct PostgreSQL: ${pgResult ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Database Wrapper: ${wrapperResult ? '✅ PASS' : '❌ FAIL'}`);
  logger.info(`Placeholder Conversion: ${placeholderResult ? '✅ PASS' : '❌ FAIL'}`);
  
  // If direct PostgreSQL works but the API or wrapper fails, create a direct implementation
  if (pgResult && (!apiResult || !wrapperResult)) {
    logger.warn('Database works but API/wrapper has issues. Creating direct implementation...');
    await createDirectVenuesImplementation();
    logger.info('Please restart your backend server and try the venues page again.');
  }
  
  // Cleanup
  await pool.end();
  logger.info('Tests completed. Database connections closed.');
}

// Run the tests
runTests().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
