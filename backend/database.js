// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define the path to the database file
const DB_PATH = path.join(__dirname, '..', 'data', 'rabs-poc.db');

/**
 * Creates and returns a new database connection.
 * This function is used to ensure that each database operation gets its own connection,
 * preventing file locking issues, especially when the database needs to be reset.
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database connection object.
 */
const getDbConnection = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error connecting to database:', err.message);
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

// Export the function to get a new database connection
module.exports = { getDbConnection };
