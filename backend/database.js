// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define the path to the database file
const DB_PATH = path.join(__dirname, '..', 'data', 'rabs-poc.db');

// Create a new database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1); // Exit with error if we can't connect to the database
  }
  console.log(`Connected to the database: ${DB_PATH}`);
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;', (err) => {
    if (err) {
      console.error('Error enabling foreign keys:', err.message);
    }
  });
});

// Export the database connection
module.exports = db;
