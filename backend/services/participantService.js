// backend/services/participantService.js
const { pool } = require('../database');

/**
 * Get all participants from the database
 * @returns {Promise<Array>} Array of participant objects
 */
const getAllParticipants = async () => {
  try {
    const result = await pool.query('SELECT * FROM participants');
    return result.rows;
  } catch (error) {
    console.error('Error fetching participants:', error.message);
    throw error;
  }
};

/**
 * Get a single participant by ID
 * @param {string} id - Participant ID
 * @returns {Promise<Object>} Participant object
 */
const getParticipantById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching participant with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new participant
 * @param {Object} participantData - Participant data
 * @returns {Promise<Object>} Created participant object
 */
const createParticipant = async (participantData) => {
  // Validate required fields
  if (
    !participantData.first_name ||
    !participantData.last_name ||
    !participantData.address ||
    !participantData.suburb ||
    !participantData.postcode
  ) {
    throw new Error(
      'Missing required participant data: first_name, last_name, address, suburb, and postcode are required'
    );
  }

  const {
    first_name,
    last_name,
    address,
    suburb,
    state = 'NSW',
    postcode,
    ndis_number = null,
    // accept either modern or legacy names
    phone = participantData.phone ?? participantData.contact_phone ?? null,
    email = participantData.email ?? participantData.contact_email ?? null,
    is_plan_managed = participantData.is_plan_managed ?? false,
    notes = null,
    supervision_multiplier = 1.0,
    mobility_requirements = null,
    dietary_requirements = null,
    medical_requirements = null,
    behavior_support_plan = false
  } = participantData;

  try {
    const result = await pool.query(
      `INSERT INTO participants 
       (first_name, last_name, address, suburb, state, postcode, ndis_number,
        contact_phone, contact_email, notes, is_plan_managed, supervision_multiplier,
        mobility_requirements, dietary_requirements, medical_requirements, behavior_support_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12,
               $13, $14, $15, $16)
       RETURNING *`,
      [
        first_name,
        last_name,
        address,
        suburb,
        state,
        postcode,
        ndis_number,
        phone,
        email,
        notes,
        is_plan_managed,
        supervision_multiplier,
        mobility_requirements,
        dietary_requirements,
        medical_requirements,
        behavior_support_plan
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating participant:', error);
    throw error;
  }
};

/**
 * Update an existing participant
 * @param {string} id - Participant ID
 * @param {Object} participantData - Updated participant data
 * @returns {Promise<Object>} Updated participant object
 */
const updateParticipant = async (id, participantData) => {
  // Ensure participant exists
  const existing = await getParticipantById(id);
  if (!existing) return null;

  // Extract fields to update
  const {
    first_name,
    last_name,
    address,
    suburb,
    state,
    postcode,
    ndis_number,
    phone,
    email,
    notes,
    is_plan_managed,
    supervision_multiplier
    ,
    mobility_requirements,
    dietary_requirements,
    medical_requirements,
    behavior_support_plan
  } = participantData;
  
  try {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    // Only include fields that are provided
    if (first_name !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(first_name);
    }
    
    if (last_name !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(last_name);
    }
    
    if (address !== undefined) {
      fields.push(`address = $${paramIndex++}`);
      values.push(address);
    }
    
    if (suburb !== undefined) {
      fields.push(`suburb = $${paramIndex++}`);
      values.push(suburb);
    }
    
    if (state !== undefined) {
      fields.push(`state = $${paramIndex++}`);
      values.push(state);
    }
    
    if (postcode !== undefined) {
      fields.push(`postcode = $${paramIndex++}`);
      values.push(postcode);
    }
    
    if (ndis_number !== undefined) {
      fields.push(`ndis_number = $${paramIndex++}`);
      values.push(ndis_number);
    }
    
    if (phone !== undefined) {
      fields.push(`contact_phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (email !== undefined) {
      fields.push(`contact_email = $${paramIndex++}`);
      values.push(email);
    }
    
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (is_plan_managed !== undefined) {
      fields.push(`is_plan_managed = $${paramIndex++}`);
      values.push(is_plan_managed);
    }
    
    if (supervision_multiplier !== undefined) {
      fields.push(`supervision_multiplier = $${paramIndex++}`);
      values.push(supervision_multiplier);
    }
    
    if (mobility_requirements !== undefined) {
      fields.push(`mobility_requirements = $${paramIndex++}`);
      values.push(mobility_requirements);
    }
    if (dietary_requirements !== undefined) {
      fields.push(`dietary_requirements = $${paramIndex++}`);
      values.push(dietary_requirements);
    }
    if (medical_requirements !== undefined) {
      fields.push(`medical_requirements = $${paramIndex++}`);
      values.push(medical_requirements);
    }
    if (behavior_support_plan !== undefined) {
      fields.push(`behavior_support_plan = $${paramIndex++}`);
      values.push(behavior_support_plan);
    }
    
    // Add updated_at timestamp
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // If no fields to update, return existing
    if (fields.length === 0) return existing;
    
    // Add ID to values array
    values.push(id);
    
    const query = `
      UPDATE participants 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating participant with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a participant
 * @param {string} id - Participant ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteParticipant = async (id) => {
  try {
    const result = await pool.query('DELETE FROM participants WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting participant with ID ${id}:`, error);
    throw error;
  }
};

module.exports = {
  getAllParticipants,
  getParticipantById,
  createParticipant,
  updateParticipant,
  deleteParticipant
};
