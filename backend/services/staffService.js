// backend/services/staffService.js
const { getDbConnection } = require('../database');

/**
 * Get all staff members from the database
 * @returns {Promise<Array>} Array of staff objects
 */
const getAllStaff = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM staff', [], (err, result) => {
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
 * Get a single staff member by ID
 * @param {string} id - Staff ID (e.g., 'S1', 'S2')
 * @returns {Promise<Object>} Staff object
 */
const getStaffById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM staff WHERE id = ?', [id], (err, result) => {
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
 * Create a new staff member
 * @param {Object} staffData - Staff data
 * @returns {Promise<Object>} Created staff object
 */
const createStaff = async (staffData) => {
  // Validate required fields
  if (!staffData.id || !staffData.first_name || !staffData.last_name) {
    throw new Error('Missing required staff data: id, first_name, and last_name are required');
  }

  let db;
  try {
    db = await getDbConnection();

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

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO staff 
         (id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes],
        function(err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // Fetch and return the newly created staff member
    return await getStaffById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing staff member
 * @param {string} id - Staff ID
 * @param {Object} staffData - Updated staff data
 * @returns {Promise<Object>} Updated staff object
 */
const updateStaff = async (id, staffData) => {
  // First check if the staff member exists
  const existingStaff = await getStaffById(id);
  if (!existingStaff) {
    return null;
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

  if (updates.length === 0) {
    return existingStaff; // Nothing to update
  }

  // Add updated_at timestamp
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE staff SET ${updates.join(', ')} WHERE id = ?`;

  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run(query, values, function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

    if (changes === 0) {
      return null;
    }

    // Get the updated staff member
    return await getStaffById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a staff member
 * @param {string} id - Staff ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteStaff = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run('DELETE FROM staff WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
    return changes > 0;
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
};
