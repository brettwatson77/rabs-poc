// backend/services/participantService.js
const { Pool } = require('pg');
const { getDbConnection } = require('../database');

// Create a direct PostgreSQL pool for fallback
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'rabspocdb'
});

/**
 * Get all participants from the database
 * @returns {Promise<Array>} Array of participant objects
 */
const getAllParticipants = async () => {
  // Try the wrapper first with timeout protection
  try {
    console.log('Attempting to get participants using database wrapper...');
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database wrapper timed out')), 2000);
    });
    
    // Create the wrapper query promise
    const wrapperPromise = (async () => {
      let db;
      try {
        db = await getDbConnection();
        return await new Promise((resolve, reject) => {
          db.all('SELECT * FROM participants', [], (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });
      } finally {
        if (db) db.close();
      }
    })();
    
    // Race the promises
    return await Promise.race([wrapperPromise, timeoutPromise]);
  } catch (error) {
    console.error('Wrapper failed, falling back to direct PostgreSQL:', error.message);
    
    // Fall back to direct PostgreSQL
    try {
      const result = await pool.query('SELECT * FROM participants');
      return result.rows;
    } catch (pgError) {
      console.error('Direct PostgreSQL also failed:', pgError.message);
      throw pgError;
    }
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
  } = participantData;

  try {
    const result = await pool.query(
      `INSERT INTO participants 
       (first_name, last_name, address, suburb, state, postcode, ndis_number, is_plan_managed, 
        contact_phone, contact_email, notes, plan_management_type, support_needs, supervision_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        supervision_multiplier
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
