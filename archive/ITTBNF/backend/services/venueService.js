// backend/services/venueService.js
/**
 * Venue data-access layer (PostgreSQL only).
 * Legacy SQLite wrapper has been removed – all calls go through the
 * central pooled connection exported in `backend/database.js`.
 */

const { pool } = require('../database');

/**
 * Get all venues from the database
 * @returns {Promise<Array>} Array of venue objects
 */
const getAllVenues = async () => {
  try {
    const { rows } = await pool.query('SELECT * FROM venues ORDER BY name');
    return rows;
  } catch (error) {
    console.error('Error retrieving venues:', error);
    throw error;
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
  // Map incoming payload to actual columns.  Provide sensible defaults so
  // callers aren’t forced to supply every optional field.
  const {
    name,
    address,
    suburb = null,
    state = 'NSW',
    postcode = null,
    capacity = null,
    // Accept legacy `description`, otherwise use explicit `facilities`
    facilities = venueData.description || null,
    location_lat = venueData.latitude || null,
    location_lng = venueData.longitude || null
  } = venueData;
  
  try {
    const result = await pool.query(
      `INSERT INTO venues 
        (name, address, suburb, state, postcode, capacity, facilities, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        address,
        suburb,
        state,
        postcode,
        capacity,
        facilities,
        location_lat,
        location_lng
      ]
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
  // Align payload with actual PostgreSQL column names.
  // Accept legacy keys (description / latitude / longitude) for backward-compatibility.
  const {
    name,
    address,
    suburb        = null,
    state         = null,
    postcode      = null,
    capacity      = null,
    facilities    = venueData.description ?? null,
    location_lat  = venueData.latitude  ?? null,
    location_lng  = venueData.longitude ?? null
  } = venueData;
  
  try {
    const result = await pool.query(
      `UPDATE venues 
         SET name          = $1,
             address       = $2,
             suburb        = $3,
             state         = $4,
             postcode      = $5,
             capacity      = $6,
             facilities    = $7,
             location_lat  = $8,
             location_lng  = $9,
             updated_at    = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        name,
        address,
        suburb,
        state,
        postcode,
        capacity,
        facilities,
        location_lat,
        location_lng,
        id
      ]
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
