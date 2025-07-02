// backend/services/participantService.js
const db = require('../database');

/**
 * Get all participants from the database
 * @returns {Promise<Array>} Array of participant objects
 */
const getAllParticipants = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM participants', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single participant by ID
 * @param {number} id - Participant ID
 * @returns {Promise<Object>} Participant object
 */
const getParticipantById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM participants WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new participant
 * @param {Object} participantData - Participant data
 * @returns {Promise<Object>} Created participant object
 */
const createParticipant = (participantData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!participantData.first_name || !participantData.last_name || 
        !participantData.address || !participantData.suburb || !participantData.postcode) {
      reject(new Error('Missing required participant data: first_name, last_name, address, suburb, and postcode are required'));
      return;
    }
    
    const {
      first_name,
      last_name,
      address,
      suburb,
      state = 'NSW',
      postcode,
      ndis_number = null,
      is_plan_managed = 0,
      contact_phone = null,
      contact_email = null,
      notes = null
    } = participantData;
    
    db.run(
      `INSERT INTO participants 
       (first_name, last_name, address, suburb, state, postcode, ndis_number, is_plan_managed, contact_phone, contact_email, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, address, suburb, state, postcode, ndis_number, is_plan_managed, contact_phone, contact_email, notes],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Get the newly created participant
        getParticipantById(this.lastID)
          .then(participant => resolve(participant))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing participant
 * @param {number} id - Participant ID
 * @param {Object} participantData - Updated participant data
 * @returns {Promise<Object>} Updated participant object
 */
const updateParticipant = (id, participantData) => {
  return new Promise((resolve, reject) => {
    // First check if the participant exists
    getParticipantById(id)
      .then(participant => {
        if (!participant) {
          resolve(null);
          return;
        }
        
        // Build the update query dynamically based on provided fields
        const updates = [];
        const values = [];
        
        Object.keys(participantData).forEach(key => {
          // Only update valid fields
          if (['first_name', 'last_name', 'address', 'suburb', 'state', 
               'postcode', 'ndis_number', 'is_plan_managed', 'contact_phone', 'contact_email', 'notes'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(participantData[key]);
          }
        });
        
        // Add updated_at timestamp
        updates.push('updated_at = CURRENT_TIMESTAMP');
        
        // Add the ID to the values array
        values.push(id);
        
        const query = `UPDATE participants SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          // Get the updated participant
          getParticipantById(id)
            .then(updatedParticipant => resolve(updatedParticipant))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a participant
 * @param {number} id - Participant ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteParticipant = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM participants WHERE id = ?', [id], function(err) {
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
  getAllParticipants,
  getParticipantById,
  createParticipant,
  updateParticipant,
  deleteParticipant
};
