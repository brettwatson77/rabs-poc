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
    notes = null,
    supervision_multiplier = 1.0,
    // Map to actual database column names
    mobility_needs = participantData.mobility_requirements ?? null,
    allergies = participantData.dietary_requirements ?? null,
    medication_needs = participantData.medical_requirements ?? null,
    has_behavior_support_plan = participantData.behavior_support_plan ?? false,

    /* ----- NEW BOOLEAN FLAG FIELDS (003 migration) ------------------------ */
    has_wheelchair_access      = false,
    has_dietary_requirements   = false,
    has_medical_requirements   = false,
    has_behavioral_support     = false,
    has_visual_impairment      = false,
    has_hearing_impairment     = false,
    has_cognitive_support      = false,
    has_communication_needs    = false,

    /* Plan-management enum coming from the UI */
    plan_management_type = participantData.plan_management_type ?? 'agency_managed',
    
    // Additional fields from schema
    emergency_contact_name = null,
    emergency_contact_phone = null
  } = participantData;

  try {
    const result = await pool.query(
      `INSERT INTO participants 
       (first_name, last_name, address, suburb, state, postcode, ndis_number,
        phone, email, notes, supervision_multiplier,
        mobility_needs, allergies, medication_needs, has_behavior_support_plan,
        has_wheelchair_access, has_dietary_requirements, has_medical_requirements, has_behavioral_support,
        has_visual_impairment, has_hearing_impairment, has_cognitive_support, has_communication_needs,
        plan_management_type, emergency_contact_name, emergency_contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11,
               $12, $13, $14, $15,
               $16, $17, $18, $19,
               $20, $21, $22, $23,
               $24, $25, $26)
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
        supervision_multiplier,
        mobility_needs,
        allergies,
        medication_needs,
        has_behavior_support_plan,
        has_wheelchair_access,
        has_dietary_requirements,
        has_medical_requirements,
        has_behavioral_support,
        has_visual_impairment,
        has_hearing_impairment,
        has_cognitive_support,
        has_communication_needs,
        plan_management_type,
        emergency_contact_name,
        emergency_contact_phone
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
    supervision_multiplier,
    // Map to actual database column names
    mobility_needs = participantData.mobility_requirements,
    allergies = participantData.dietary_requirements,
    medication_needs = participantData.medical_requirements,
    has_behavior_support_plan = participantData.behavior_support_plan,
    plan_management_type,
    emergency_contact_name,
    emergency_contact_phone,

    /* NEW FLAGS ------------------------------------------------------------ */
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
    
    if (phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    
    if (plan_management_type !== undefined) {
      fields.push(`plan_management_type = $${paramIndex++}`);
      values.push(plan_management_type);
    }

    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (supervision_multiplier !== undefined) {
      fields.push(`supervision_multiplier = $${paramIndex++}`);
      values.push(supervision_multiplier);
    }
    
    if (mobility_needs !== undefined) {
      fields.push(`mobility_needs = $${paramIndex++}`);
      values.push(mobility_needs);
    }
    
    if (allergies !== undefined) {
      fields.push(`allergies = $${paramIndex++}`);
      values.push(allergies);
    }
    
    if (medication_needs !== undefined) {
      fields.push(`medication_needs = $${paramIndex++}`);
      values.push(medication_needs);
    }
    
    if (has_behavior_support_plan !== undefined) {
      fields.push(`has_behavior_support_plan = $${paramIndex++}`);
      values.push(has_behavior_support_plan);
    }
    
    if (emergency_contact_name !== undefined) {
      fields.push(`emergency_contact_name = $${paramIndex++}`);
      values.push(emergency_contact_name);
    }
    
    if (emergency_contact_phone !== undefined) {
      fields.push(`emergency_contact_phone = $${paramIndex++}`);
      values.push(emergency_contact_phone);
    }
    
    /* --------- Support-flag booleans ------------------------------------- */
    const flagMap = {
      has_wheelchair_access,
      has_dietary_requirements,
      has_medical_requirements,
      has_behavioral_support,
      has_visual_impairment,
      has_hearing_impairment,
      has_cognitive_support,
      has_communication_needs
    };
    for (const [col, val] of Object.entries(flagMap)) {
      if (val !== undefined) {
        fields.push(`${col} = $${paramIndex++}`);
        values.push(val);
      }
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
