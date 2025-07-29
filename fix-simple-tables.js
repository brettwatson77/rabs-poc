/**
 * fix-simple-tables.js
 * 
 * This script adds missing columns to the simple tables (vehicles, venues, participants)
 * based on the simple-tables check report. This will make the simple pages work
 * and give us quick wins to build momentum.
 */

require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

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

// Create a new pool
const pool = new Pool(dbConfig);

// Column definitions with proper data types
const columnsToAdd = {
  vehicles: [
    { name: 'vehicle_type', type: 'TEXT', default: null },
    { name: 'wheelchair_access', type: 'BOOLEAN', default: 'FALSE' },
    { name: 'status', type: 'TEXT', default: "'active'" },
    { name: 'rego_expiry', type: 'DATE', default: null },
    { name: 'insurance_expiry', type: 'DATE', default: null }
  ],
  venues: [
    { name: 'venue_type', type: 'TEXT', default: null },
    { name: 'booking_lead_time', type: 'INTEGER', default: '0' },
    { name: 'status', type: 'TEXT', default: "'active'" },
    { name: 'amenities', type: 'JSONB', default: "'{}'" },
    { name: 'accessibility', type: 'JSONB', default: "'{}'" }
  ],
  participants: [
    { name: 'plan_management_type', type: 'TEXT', default: "'agency_managed'" },
    { name: 'support_needs', type: 'JSONB', default: "'[]'" }
  ]
};

/**
 * Check if a column exists in a table
 * @param {Object} client - Database client
 * @param {string} tableName - Table name
 * @param {string} columnName - Column name
 * @returns {Promise<boolean>} True if column exists
 */
async function columnExists(client, tableName, columnName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    )
  `;
  
  const result = await client.query(query, [tableName, columnName]);
  return result.rows[0].exists;
}

/**
 * Add a column to a table if it doesn't exist
 * @param {Object} client - Database client
 * @param {string} tableName - Table name
 * @param {Object} column - Column definition
 * @returns {Promise<boolean>} True if column was added
 */
async function addColumnIfNotExists(client, tableName, column) {
  try {
    const exists = await columnExists(client, tableName, column.name);
    
    if (exists) {
      logger.info(`Column '${column.name}' already exists in table '${tableName}'`);
      return false;
    }
    
    let query = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`;
    
    if (column.default !== null) {
      query += ` DEFAULT ${column.default}`;
    }
    
    await client.query(query);
    logger.success(`Added column '${column.name}' (${column.type}) to table '${tableName}'`);
    return true;
  } catch (error) {
    logger.error(`Error adding column '${column.name}' to table '${tableName}': ${error.message}`);
    return false;
  }
}

/**
 * Add sample data to new columns
 * @param {Object} client - Database client
 * @param {string} tableName - Table name
 * @param {Object} column - Column definition
 * @returns {Promise<boolean>} True if data was added
 */
async function addSampleData(client, tableName, column) {
  try {
    // Only add sample data for specific columns and tables
    if (tableName === 'vehicles') {
      if (column.name === 'vehicle_type') {
        await client.query(`
          UPDATE vehicles 
          SET vehicle_type = CASE 
            WHEN description ILIKE '%bus%' THEN 'bus'
            WHEN description ILIKE '%van%' THEN 'van'
            WHEN description ILIKE '%car%' THEN 'car'
            ELSE 'other'
          END
        `);
        logger.info(`Added sample data to 'vehicle_type' column`);
      }
      else if (column.name === 'wheelchair_access') {
        await client.query(`
          UPDATE vehicles 
          SET wheelchair_access = (random() > 0.5)
        `);
        logger.info(`Added sample data to 'wheelchair_access' column`);
      }
      else if (column.name === 'status') {
        await client.query(`
          UPDATE vehicles 
          SET status = CASE 
            WHEN random() > 0.8 THEN 'maintenance'
            WHEN random() > 0.9 THEN 'out-of-service'
            ELSE 'active'
          END
        `);
        logger.info(`Added sample data to 'status' column`);
      }
      else if (column.name === 'rego_expiry' || column.name === 'insurance_expiry') {
        // Set expiry dates between 3 months ago and 18 months in future
        await client.query(`
          UPDATE vehicles 
          SET ${column.name} = CURRENT_DATE + (random() * 540 - 90)::integer
        `);
        logger.info(`Added sample data to '${column.name}' column`);
      }
    }
    else if (tableName === 'venues') {
      if (column.name === 'venue_type') {
        await client.query(`
          UPDATE venues 
          SET venue_type = CASE 
            WHEN name ILIKE '%center%' OR name ILIKE '%centre%' THEN 'center'
            WHEN name ILIKE '%park%' THEN 'outdoor'
            WHEN name ILIKE '%hall%' THEN 'community'
            ELSE 'other'
          END
        `);
        logger.info(`Added sample data to 'venue_type' column`);
      }
      else if (column.name === 'booking_lead_time') {
        await client.query(`
          UPDATE venues 
          SET booking_lead_time = (random() * 14 + 1)::integer
        `);
        logger.info(`Added sample data to 'booking_lead_time' column`);
      }
      else if (column.name === 'status') {
        await client.query(`
          UPDATE venues 
          SET status = CASE 
            WHEN random() > 0.9 THEN 'unavailable'
            ELSE 'available'
          END
        `);
        logger.info(`Added sample data to 'status' column`);
      }
      else if (column.name === 'amenities') {
        await client.query(`
          UPDATE venues 
          SET amenities = jsonb_build_object(
            'wifi', random() > 0.3,
            'parking', random() > 0.2,
            'kitchen', random() > 0.5,
            'bathroom', true,
            'projector', random() > 0.6,
            'air_conditioning', random() > 0.4
          )
        `);
        logger.info(`Added sample data to 'amenities' column`);
      }
      else if (column.name === 'accessibility') {
        await client.query(`
          UPDATE venues 
          SET accessibility = jsonb_build_object(
            'wheelchair_accessible', random() > 0.2,
            'accessible_bathroom', random() > 0.3,
            'elevator', random() > 0.5,
            'accessible_parking', random() > 0.4,
            'hearing_loop', random() > 0.7
          )
        `);
        logger.info(`Added sample data to 'accessibility' column`);
      }
    }
    else if (tableName === 'participants') {
      if (column.name === 'plan_management_type') {
        await client.query(`
          UPDATE participants 
          SET plan_management_type = CASE 
            WHEN random() > 0.7 THEN 'agency_managed'
            WHEN random() > 0.5 THEN 'plan_managed'
            WHEN random() > 0.2 THEN 'self_managed'
            ELSE 'ndia_managed'
          END
        `);
        logger.info(`Added sample data to 'plan_management_type' column`);
      }
      else if (column.name === 'support_needs') {
        await client.query(`
          UPDATE participants 
          SET support_needs = CASE
            WHEN random() > 0.8 THEN '["mobility", "communication", "personal_care"]'::jsonb
            WHEN random() > 0.6 THEN '["mobility", "communication"]'::jsonb
            WHEN random() > 0.4 THEN '["communication"]'::jsonb
            WHEN random() > 0.2 THEN '["mobility"]'::jsonb
            ELSE '[]'::jsonb
          END
        `);
        logger.info(`Added sample data to 'support_needs' column`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error adding sample data to column '${column.name}' in table '${tableName}': ${error.message}`);
    return false;
  }
}

/**
 * Main function to add missing columns
 */
async function addMissingColumns() {
  logger.info('Starting to add missing columns to simple tables...');
  logger.info(`Connecting to PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    logger.info('Transaction started');
    
    // Track statistics
    const stats = {
      total: 0,
      added: 0,
      skipped: 0,
      failed: 0
    };
    
    // Process each table
    for (const [tableName, columns] of Object.entries(columnsToAdd)) {
      logger.info(`Processing table: ${tableName}`);
      
      // Add each column
      for (const column of columns) {
        stats.total++;
        const added = await addColumnIfNotExists(client, tableName, column);
        
        if (added) {
          stats.added++;
          // Add sample data for the new column
          await addSampleData(client, tableName, column);
        } else {
          stats.skipped++;
        }
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    logger.success('Transaction committed successfully');
    
    // Log statistics
    logger.info('Column addition statistics:');
    logger.info(`  Total columns processed: ${stats.total}`);
    logger.info(`  Columns added: ${stats.added}`);
    logger.info(`  Columns skipped (already exist): ${stats.skipped}`);
    logger.info(`  Columns failed: ${stats.failed}`);
    
    if (stats.added > 0) {
      logger.success(`Successfully added ${stats.added} new columns to simple tables`);
    } else {
      logger.info('No new columns were added (all already exist)');
    }
  } catch (err) {
    // Rollback the transaction on error
    await client.query('ROLLBACK');
    logger.error(`Transaction rolled back due to error: ${err.message}`);
    throw err;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Run the script
 */
addMissingColumns()
  .then(() => {
    logger.success('Column addition process completed successfully');
    pool.end();
  })
  .catch(err => {
    logger.error(`Unhandled error: ${err.message}`);
    pool.end();
    process.exit(1);
  });
