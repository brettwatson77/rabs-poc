// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Check if we should use PostgreSQL
const usePostgres = process.env.USE_POSTGRES === 'true';

// Define the path to the SQLite database file
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'rabs-poc.db');

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'rabspocdb',
};

// Create PostgreSQL connection pool if enabled
const pgPool = usePostgres ? new Pool(pgConfig) : null;

// Log database connection type on startup
if (usePostgres) {
  console.log(`Using PostgreSQL database: ${pgConfig.database} at ${pgConfig.host}:${pgConfig.port}`);
} else {
  console.log(`Using SQLite database at: ${DB_PATH}`);
}

/**
 * Gets a PostgreSQL database connection from the pool
 * @returns {Promise<Object>} A promise that resolves with the database client
 */
const getPgConnection = async () => {
  try {
    const client = await pgPool.connect();

    /**
     * Replace `?` placeholders with PostgreSQL-style `$1`, `$2`, …
     * Keeps the services written for SQLite working.
     */
    const convertPlaceholders = (sql = '') => {
      let index = 0;
      return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
      });
    };

    /**
     * Wrap the pg client to emulate the subset of sqlite3 API that our
     * legacy services expect (`run`, `all`, `get`, `each`, `close`).
     */
    const wrapPgClient = (pgClient) => {
      return {
        /** sqlite3-style .run(sql, params?, cb) */
        run: (sql, params = [], cb = () => {}) => {
          if (typeof params === 'function') {
            cb = params;
            params = [];
          }
          pgClient.query(convertPlaceholders(sql), params)
            .then(() => cb(null))
            .catch(cb);
        },

        /** sqlite3-style .all(sql, params?, cb) -> rows */
        all: (sql, params = [], cb = () => {}) => {
          if (typeof params === 'function') {
            cb = params;
            params = [];
          }
          pgClient.query(convertPlaceholders(sql), params)
            .then(res => cb(null, res.rows))
            .catch(cb);
        },

        /** sqlite3-style .get(sql, params?, cb) -> first row */
        get: (sql, params = [], cb = () => {}) => {
          if (typeof params === 'function') {
            cb = params;
            params = [];
          }
          pgClient.query(convertPlaceholders(sql), params)
            .then(res => cb(null, res.rows[0] || null))
            .catch(cb);
        },

        /** sqlite3-style .each(sql, params?, cb, doneCb) */
        each: (sql, params = [], rowCb = () => {}, doneCb = () => {}) => {
          if (typeof params === 'function') {
            doneCb = rowCb;
            rowCb = params;
            params = [];
          }
          pgClient.query(convertPlaceholders(sql), params)
            .then(res => {
              res.rows.forEach(rowCb);
              doneCb(null, res.rows.length);
            })
            .catch(doneCb);
        },

        /** mimic sqlite3 .close() */
        close: (cb = () => {}) => {
          pgClient.release();
          cb(null);
        }
      };
    };

    return wrapPgClient(client);
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err.message);
    throw err;
  }
};

/**
 * Gets a SQLite database connection
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database connection object
 */
const getSqliteConnection = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error connecting to SQLite database:', err.message);
        return reject(err);
      }
      
      // Enable foreign keys for this connection
      db.run('PRAGMA foreign_keys = ON;', (fkErr) => {
        if (fkErr) {
          console.error('Error enabling foreign keys:', fkErr.message);
          return reject(fkErr);
        }
        resolve(db);
      });
    });
  });
};

/**
 * Creates and returns a new database connection based on configuration.
 * This function abstracts the database type (PostgreSQL or SQLite) from the rest of the application.
 * @returns {Promise<Object>} A promise that resolves with the appropriate database connection object
 */
const getDbConnection = async () => {
  if (usePostgres) {
    return getPgConnection();
  } else {
    return getSqliteConnection();
  }
};

/**
 * Closes database connections and pools on application shutdown
 */
const closeAllConnections = async () => {
  if (usePostgres && pgPool) {
    console.log('Closing PostgreSQL connection pool');
    await pgPool.end();
  }
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

// Expose a pg Pool so legacy services can `const { pool } = require('../database')`
// For SQLite fallback we expose null to avoid breaking require destructuring.
const pool = usePostgres ? pgPool : null;

// Export helpers expected by services
module.exports = {
  getDbConnection,
  usePostgres,
  pool
};
