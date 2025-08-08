// backend/database.js
const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'rabspocdb',
};

// Create PostgreSQL connection pool
const pool = new Pool(pgConfig);

// Log database connection on startup
console.log(`Using PostgreSQL database: ${pgConfig.database} at ${pgConfig.host}:${pgConfig.port}`);

/**
 * Gets a PostgreSQL database connection from the pool
 * @returns {Promise<Object>} A promise that resolves with the database client
 */
const getDbConnection = async () => {
  return pool;
};

/**
 * Closes database connections and pools on application shutdown
 */
const closeAllConnections = async () => {
  console.log('Closing PostgreSQL connection pool');
  await pool.end();
};

// Handle application shutdown gracefully
process.on('SIGINT', async () => {
  await closeAllConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeAllConnections();
  process.exit(0);
});

// Export the pool and getDbConnection function
module.exports = {
  getDbConnection,
  pool
};
