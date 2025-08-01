// backend/services/staffService.js
const { pool } = require('../database');

/**
 * Get all staff members from the database
 * @returns {Promise<Array>} Array of staff objects
 */
const getAllStaff = async () => {
  const res = await pool.query('SELECT * FROM staff');
  return res.rows;
};

/**
 * Get a single staff member by ID
 * @param {string} id - Staff ID (e.g., 'S1', 'S2')
 * @returns {Promise<Object>} Staff object
 */
const getStaffById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM staff WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error(`Error fetching staff ${id}:`, err.message);
    throw err;
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

  try {
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

    const result = await pool.query(
      `INSERT INTO staff 
       (id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, first_name, last_name, address, suburb, state, postcode, contact_phone, contact_email, notes]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error creating staff:', err.message);
    throw err;
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

  // Build dynamic update lists with PostgreSQL-style placeholders
  const fieldsAllowed = [
    'first_name',
    'last_name',
    'address',
    'suburb',
    'state',
    'postcode',
    'contact_phone',
    'contact_email',
    'notes'
  ];

  const setFragments = [];
  const values = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(staffData)) {
    if (fieldsAllowed.includes(key)) {
      setFragments.push(`${key} = $${paramIdx++}`);
      values.push(value);
    }
  }

  if (setFragments.length === 0) return existingStaff; // nothing to update

  // updated_at timestamp
  setFragments.push(`updated_at = CURRENT_TIMESTAMP`);

  // add staff id for WHERE clause
  values.push(id);

  const query = `
    UPDATE staff
    SET ${setFragments.join(', ')}
    WHERE id = $${paramIdx}
    RETURNING *`;

  try {
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error updating staff:', err.message);
    throw err;
  }
};

/**
 * Delete a staff member
 * @param {string} id - Staff ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteStaff = async (id) => {
  try {
    const result = await pool.query('DELETE FROM staff WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  } catch (err) {
    console.error('Error deleting staff:', err.message);
    throw err;
  }
};

/**
 * TEMPORARY stub so frontend widget doesn't crash.
 * Once `staff_assignments` table exists, implement real logic.
 */
const getStaffHours = async (from, to) => {
  return []; // return empty list so React component renders nothing
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffHours
};
