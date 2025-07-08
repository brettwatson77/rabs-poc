// backend/services/venueService.js
const { getDbConnection } = require('../database');

/**
 * Get all venues from the database
 * @returns {Promise<Array>} Array of venue objects
 */
const getAllVenues = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM venues', [], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    return rows;
  } finally {
    if (db) db.close();
  }
};

/**
 * Get a single venue by ID
 * @param {number} id - Venue ID
 * @returns {Promise<Object>} Venue object
 */
const getVenueById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM venues WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    return row;
  } finally {
    if (db) db.close();
  }
};

/**
 * Create a new venue
 * @param {Object} venueData - Venue data
 * @returns {Promise<Object>} Created venue object
 */
const createVenue = async (venueData) => {
  // Validate required fields
  if (!venueData.name || !venueData.address || !venueData.suburb || !venueData.postcode) {
    throw new Error('Missing required venue data: name, address, suburb, and postcode are required');
  }

  const {
    name,
    address,
    suburb,
    state = 'NSW',
    postcode,
    is_main_centre = 0,
    notes = null,
    latitude = null,
    longitude = null
  } = venueData;

  let db;
  try {
    db = await getDbConnection();
    const lastID = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO venues 
         (name, address, suburb, state, postcode, is_main_centre, notes, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, address, suburb, state, postcode, is_main_centre, notes, latitude, longitude],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
    // Fetch and return the newly created venue
    return await getVenueById(lastID);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing venue
 * @param {number} id - Venue ID
 * @param {Object} venueData - Updated venue data
 * @returns {Promise<Object>} Updated venue object
 */
const updateVenue = async (id, venueData) => {
  // Ensure venue exists
  const existingVenue = await getVenueById(id);
  if (!existingVenue) return null;

  // Build update query
  const updates = [];
  const values = [];

  Object.keys(venueData).forEach(key => {
    if (['name', 'address', 'suburb', 'state', 'postcode', 'is_main_centre', 'notes', 'latitude', 'longitude'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(venueData[key]);
    }
  });

  if (updates.length === 0) return existingVenue;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE venues SET ${updates.join(', ')} WHERE id = ?`;

  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

    if (changes === 0) return null;

    return await getVenueById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a venue
 * @param {number} id - Venue ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteVenue = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const deleted = await new Promise((resolve, reject) => {
      db.run('DELETE FROM venues WHERE id = ?', [id], function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
    return deleted;
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue
};
