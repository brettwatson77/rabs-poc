// backend/services/venueService.js
const db = require('../database');

/**
 * Get all venues from the database
 * @returns {Promise<Array>} Array of venue objects
 */
const getAllVenues = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM venues', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single venue by ID
 * @param {number} id - Venue ID
 * @returns {Promise<Object>} Venue object
 */
const getVenueById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM venues WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new venue
 * @param {Object} venueData - Venue data
 * @returns {Promise<Object>} Created venue object
 */
const createVenue = (venueData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!venueData.name || !venueData.address || !venueData.suburb || !venueData.postcode) {
      reject(new Error('Missing required venue data: name, address, suburb, and postcode are required'));
      return;
    }
    
    const {
      name,
      address,
      suburb,
      state = 'NSW',
      postcode,
      is_main_centre = 0,
      notes = null
    } = venueData;
    
    db.run(
      `INSERT INTO venues 
       (name, address, suburb, state, postcode, is_main_centre, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, address, suburb, state, postcode, is_main_centre, notes],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Get the newly created venue
        getVenueById(this.lastID)
          .then(venue => resolve(venue))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing venue
 * @param {number} id - Venue ID
 * @param {Object} venueData - Updated venue data
 * @returns {Promise<Object>} Updated venue object
 */
const updateVenue = (id, venueData) => {
  return new Promise((resolve, reject) => {
    // First check if the venue exists
    getVenueById(id)
      .then(venue => {
        if (!venue) {
          resolve(null);
          return;
        }
        
        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];
        
        Object.keys(venueData).forEach(key => {
          // Only update valid fields
          if (['name', 'address', 'suburb', 'state', 'postcode', 'is_main_centre', 'notes'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(venueData[key]);
          }
        });
        
        // Add updated_at timestamp
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add the ID to the values array
        values.push(id);
        
        const query = `UPDATE venues SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          // Get the updated venue
          getVenueById(id)
            .then(updatedVenue => resolve(updatedVenue))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a venue
 * @param {number} id - Venue ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteVenue = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM venues WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      // Check if any row was deleted
      resolve(this.changes > 0);
    });
  });
};

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue
};
