/**
 * run-tgl-migration.js
 * 
 * This script runs the TGL core migration (001_tgl_core.sql) on the PostgreSQL database.
 * It reads the SQL file and executes it against the rabspocdb database.
 */

require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

// Setup logger with timestamps
const logger = {
  info: (msg) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`),
  success: (msg) => console.log(`[${new Date().toISOString()}] SUCCESS: ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] WARNING: ${msg}`)
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

// Path to the migration file
const migrationFilePath = path.join(__dirname, 'database', 'migrations', '001_tgl_core.sql');

/**
 * Split SQL file into individual statements
 * @param {string} sql - SQL content
 * @returns {string[]} Array of SQL statements
 */
function splitSqlStatements(sql) {
  // Remove comments and split by semicolons
  const statements = [];
  let currentStatement = '';
  let inMultilineComment = false;
  let inSingleLineComment = false;
  let inString = false;
  let stringDelimiter = '';
  
  // Split the SQL into lines for easier processing
  const lines = sql.split('\n');
  
  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') {
      continue;
    }
    
    // Skip comment-only lines
    if (line.trim().startsWith('--')) {
      continue;
    }
    
    // Add the line to the current statement
    currentStatement += line + '\n';
    
    // Check if the line ends with a semicolon (statement terminator)
    if (line.trim().endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim() !== '') {
    statements.push(currentStatement.trim());
  }
  
  return statements;
}

/**
 * Execute SQL statements one by one
 * @param {string[]} statements - Array of SQL statements
 * @returns {Promise<void>}
 */
async function executeStatements(statements) {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    logger.info('Transaction started');
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() === '') continue;
      
      try {
        logger.info(`Executing statement ${i + 1}/${statements.length}`);
        await client.query(statement);
        logger.success(`Statement ${i + 1} executed successfully`);
      } catch (err) {
        logger.error(`Error executing statement ${i + 1}: ${err.message}`);
        logger.error(`Statement: ${statement.substring(0, 100)}...`);
        throw err;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    logger.success('Transaction committed successfully');
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
 * Main function to run the migration
 */
async function runMigration() {
  logger.info(`Starting TGL core migration from ${migrationFilePath}`);
  logger.info(`Connecting to PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  
  try {
    // Check if the file exists
    if (!fs.existsSync(migrationFilePath)) {
      throw new Error(`Migration file not found: ${migrationFilePath}`);
    }
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(migrationFilePath, 'utf8');
    logger.info(`Read ${sqlContent.length} bytes from migration file`);
    
    // Split into statements
    const statements = splitSqlStatements(sqlContent);
    logger.info(`Found ${statements.length} SQL statements to execute`);
    
    // Execute the statements
    await executeStatements(statements);
    
    logger.success('TGL core migration completed successfully');
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
    logger.info('Database connection closed');
  }
}

// Run the migration
runMigration().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
