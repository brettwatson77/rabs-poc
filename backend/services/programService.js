// backend/services/programService.js
const db = require('../database');

/**
 * Get all programs from the database
 * @returns {Promise<Array>} Array of program objects
 */
const getAllPrograms = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM programs', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single program by ID
 * @param {number} id - Program ID
 * @returns {Promise<Object>} Program object
 */
const getProgramById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM programs WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new program
 * @param {Object} programData - Program data
 * @returns {Promise<Object>} Created program object
 */
const createProgram = (programData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!programData.name || programData.day_of_week === undefined || 
        !programData.start_time || !programData.end_time) {
      reject(new Error('Missing required program data: name, day_of_week, start_time, and end_time are required'));
      return;
    }
    
    const {
      name,
      description = null,
      day_of_week,
      start_time,
      end_time,
      is_weekend = 0,
      is_centre_based = 1,
      venue_id = null,
      active = 1
    } = programData;
    
    db.run(
      `INSERT INTO programs 
       (name, description, day_of_week, start_time, end_time, is_weekend, is_centre_based, venue_id, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, day_of_week, start_time, end_time, is_weekend, is_centre_based, venue_id, active],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Get the newly created program
        getProgramById(this.lastID)
          .then(program => resolve(program))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing program
 * @param {number} id - Program ID
 * @param {Object} programData - Updated program data
 * @returns {Promise<Object>} Updated program object
 */
const updateProgram = (id, programData) => {
  return new Promise((resolve, reject) => {
    // First check if the program exists
    getProgramById(id)
      .then(program => {
        if (!program) {
          resolve(null);
          return;
        }
        
        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];
        
        Object.keys(programData).forEach(key => {
          // Only update valid fields
          if (['name', 'description', 'day_of_week', 'start_time', 'end_time', 
               'is_weekend', 'is_centre_based', 'venue_id', 'active'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(programData[key]);
          }
        });
        
        // Add updated_at timestamp
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add the ID to the values array
        values.push(id);
        
        const query = `UPDATE programs SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          // Get the updated program
          getProgramById(id)
            .then(updatedProgram => resolve(updatedProgram))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a program
 * @param {number} id - Program ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteProgram = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM programs WHERE id = ?', [id], function(err) {
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
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram
};
