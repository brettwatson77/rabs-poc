// backend/services/venueService.js
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
    console.error(`Error fetching venue with ID ${id}:`, error);
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
    console.error(`Error updating venue with ID ${id}:`, error);
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
    console.error(`Error deleting venue with ID ${id}:`, error);
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
