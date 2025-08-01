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
    is_plan_managed = 0,
    contact_phone = null,
    contact_email = null,
    notes = null,
    plan_management_type = 'agency_managed',
    support_needs = '[]',
    supervision_multiplier = 1.0
    /* ---- NEW BOOLEAN FLAG FIELDS (default false) ---- */
    ,
    has_wheelchair_access = false,
    has_dietary_requirements = false,
    has_medical_requirements = false,
    has_behavioral_support = false,
    has_visual_impairment = false,
    has_hearing_impairment = false,
    has_cognitive_support = false,
    has_communication_needs = false
  } = participantData;

  try {
    const result = await pool.query(
      `INSERT INTO participants 
       (first_name, last_name, address, suburb, state, postcode, ndis_number, is_plan_managed, 
        contact_phone, contact_email, notes, plan_management_type, support_needs, supervision_multiplier,
        has_wheelchair_access, has_dietary_requirements, has_medical_requirements, has_behavioral_support,
        has_visual_impairment, has_hearing_impairment, has_cognitive_support, has_communication_needs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        first_name,
        last_name,
        address,
        suburb,
        state,
        postcode,
        ndis_number,
        is_plan_managed,
        contact_phone,
        contact_email,
        notes,
        plan_management_type,
        support_needs,
        supervision_multiplier,
        /* ---- boolean flag values ---- */
        has_wheelchair_access,
        has_dietary_requirements,
        has_medical_requirements,
        has_behavioral_support,
        has_visual_impairment,
        has_hearing_impairment,
        has_cognitive_support,
        has_communication_needs
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
    is_plan_managed,
    contact_phone,
    contact_email,
    notes,
    plan_management_type,
    support_needs,
    supervision_multiplier
    ,
    has_wheelchair_access,
    has_dietary_requirements,
    has_medical_requirements,
    has_behavioral_support,
    has_visual_impairment,
    has_hearing_impairment,
    has_cognitive_support,
    has_communication_needs
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
    
    if (is_plan_managed !== undefined) {
      fields.push(`is_plan_managed = $${paramIndex++}`);
      values.push(is_plan_managed);
    }
    
    if (contact_phone !== undefined) {
      fields.push(`contact_phone = $${paramIndex++}`);
      values.push(contact_phone);
    }
    
    if (contact_email !== undefined) {
      fields.push(`contact_email = $${paramIndex++}`);
      values.push(contact_email);
    }
    
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (plan_management_type !== undefined) {
      fields.push(`plan_management_type = $${paramIndex++}`);
      values.push(plan_management_type);
    }
    
    if (support_needs !== undefined) {
      fields.push(`support_needs = $${paramIndex++}`);
      values.push(support_needs);
    }
    
    if (supervision_multiplier !== undefined) {
      fields.push(`supervision_multiplier = $${paramIndex++}`);
      values.push(supervision_multiplier);
    }
    
    /* ---- boolean flag fields ---- */
    if (has_wheelchair_access !== undefined) {
      fields.push(`has_wheelchair_access = $${paramIndex++}`);
      values.push(has_wheelchair_access);
    }
    if (has_dietary_requirements !== undefined) {
      fields.push(`has_dietary_requirements = $${paramIndex++}`);
      values.push(has_dietary_requirements);
    }
    if (has_medical_requirements !== undefined) {
      fields.push(`has_medical_requirements = $${paramIndex++}`);
      values.push(has_medical_requirements);
    }
    if (has_behavioral_support !== undefined) {
      fields.push(`has_behavioral_support = $${paramIndex++}`);
      values.push(has_behavioral_support);
    }
    if (has_visual_impairment !== undefined) {
      fields.push(`has_visual_impairment = $${paramIndex++}`);
      values.push(has_visual_impairment);
    }
    if (has_hearing_impairment !== undefined) {
      fields.push(`has_hearing_impairment = $${paramIndex++}`);
      values.push(has_hearing_impairment);
    }
    if (has_cognitive_support !== undefined) {
      fields.push(`has_cognitive_support = $${paramIndex++}`);
      values.push(has_cognitive_support);
    }
    if (has_communication_needs !== undefined) {
      fields.push(`has_communication_needs = $${paramIndex++}`);
      values.push(has_communication_needs);
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
