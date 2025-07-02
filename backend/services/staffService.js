// backend/services/staffService.js
const db = require('../database');

/**
 * Get all staff members from the database
 * @returns {Promise<Array>} Array of staff objects
 */
const getAllStaff = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM staff', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single staff member by ID
 * @param {string} id - Staff ID (e.g., 'S1', 'S2')
 * @returns {Promise<Object>} Staff object
 */
const getStaffById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM staff WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new staff member
 * @param {Object} staffData - Staff data
 * @returns {Promise<Object>} Created staff object
 */
const createStaff = (staffData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!staffData.id || !staffData.first_name || !staffData.last_name) {
      reject(new Error('Missing required staff data: id, first_name, and last_name are required'));
      return;
    }
    
    const {
      id,
      first_name,
      last_name,
      address = null,
      suburb = null,
      state = 'NSW',
      postcode = null,
      contact_phone = null,
      contact_email = null,
      notes = null
    } = staffData;
    
    db.run(
      `INSERT INTO staff 
       (id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Get the newly created staff member
        getStaffById(id)
          .then(staff => resolve(staff))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing staff member
 * @param {string} id - Staff ID
 * @param {Object} staffData - Updated staff data
 * @returns {Promise<Object>} Updated staff object
 */
const updateStaff = (id, staffData) => {
  return new Promise((resolve, reject) => {
    // First check if the staff member exists
    getStaffById(id)
      .then(staff => {
        if (!staff) {
          resolve(null);
          return;
        }
        
        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];
        
        Object.keys(staffData).forEach(key => {
          // Only update valid fields
          if (['first_name', 'last_name', 'address', 'suburb', 'state', 
               'postcode', 'contact_phone', 'contact_email', 'notes'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(staffData[key]);
          }
        });
        
        // Add updated_at timestamp
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add the ID to the values array
        values.push(id);
        
        const query = `UPDATE staff SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          // Get the updated staff member
          getStaffById(id)
            .then(updatedStaff => resolve(updatedStaff))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a staff member
 * @param {string} id - Staff ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteStaff = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM staff WHERE id = ?', [id], function(err) {
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
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
};
