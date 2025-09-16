/**
 * Database Connection Module
 * 
 * Centralizes PostgreSQL connection pool management for the entire application.
 * Uses environment variables for configuration with sensible defaults.
 */

const { Pool } = require('pg');

// Create a single database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rabspocdb',
  port: process.env.DB_PORT || 5432,
  max: 20,                         // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,        // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000,   // How long to wait for a connection
});

// Log connection events for debugging
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1); // Exit in case of fatal connection errors
});

// Simple query method to check connection
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
