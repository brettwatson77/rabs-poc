// backend/services/vehicleService.js
const db = require('../database');

/**
 * Get all vehicles from the database
 * @returns {Promise<Array>} Array of vehicle objects
 */
const getAllVehicles = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM vehicles', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single vehicle by ID
 * @param {string} id - Vehicle ID (e.g., 'V1', 'V2')
 * @returns {Promise<Object>} Vehicle object
 */
const getVehicleById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM vehicles WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new vehicle
 * @param {Object} vehicleData - Vehicle data
 * @returns {Promise<Object>} Created vehicle object
 */
const createVehicle = (vehicleData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!vehicleData.id || !vehicleData.seats) {
      reject(new Error('Missing required vehicle data: id and seats are required'));
      return;
    }
    
    const {
      id,
      description = null,
      seats,
      registration = null,
      notes = null
    } = vehicleData;
    
    db.run(
      `INSERT INTO vehicles 
       (id, description, seats, registration, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, description, seats, registration, notes],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Get the newly created vehicle
        getVehicleById(id)
          .then(vehicle => resolve(vehicle))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing vehicle
 * @param {string} id - Vehicle ID
 * @param {Object} vehicleData - Updated vehicle data
 * @returns {Promise<Object>} Updated vehicle object
 */
const updateVehicle = (id, vehicleData) => {
  return new Promise((resolve, reject) => {
    // First check if the vehicle exists
    getVehicleById(id)
      .then(vehicle => {
        if (!vehicle) {
          resolve(null);
          return;
        }
        
        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];
        
        Object.keys(vehicleData).forEach(key => {
          // Only update valid fields
          if (['description', 'seats', 'registration', 'notes'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(vehicleData[key]);
          }
        });
        
        // Add updated_at timestamp
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add the ID to the values array
        values.push(id);
        
        const query = `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          // Get the updated vehicle
          getVehicleById(id)
            .then(updatedVehicle => resolve(updatedVehicle))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a vehicle
 * @param {string} id - Vehicle ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteVehicle = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM vehicles WHERE id = ?', [id], function(err) {
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
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
