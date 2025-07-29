// backend/services/vehicleService.js
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
 * Get all vehicles from the database
 * @returns {Promise<Array>} Array of vehicle objects
 */
const getAllVehicles = async () => {
  // Try the wrapper first with timeout protection
  try {
    console.log('Attempting to get vehicles using database wrapper...');
    
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
          db.all('SELECT * FROM vehicles', [], (err, result) => {
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
      const result = await pool.query('SELECT * FROM vehicles');
      return result.rows;
    } catch (pgError) {
      console.error('Direct PostgreSQL also failed:', pgError.message);
      throw pgError;
    }
  }
};

/**
 * Get a single vehicle by ID
 * @param {string} id - Vehicle ID
 * @returns {Promise<Object>} Vehicle object
 */
const getVehicleById = async (id) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`Error fetching vehicle with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new vehicle
 * @param {Object} vehicleData - Vehicle data
 * @returns {Promise<Object>} Created vehicle object
 */
const createVehicle = async (vehicleData) => {
  // Validate required fields
  if (!vehicleData.id || !vehicleData.seats) {
    throw new Error('Missing required vehicle data: id and seats are required');
  }

  const {
    id,
    description = null,
    seats,
    registration = null,
    notes = null,
    vehicle_type = null,
    wheelchair_access = false,
    status = 'active',
    rego_expiry = null,
    insurance_expiry = null
  } = vehicleData;

  try {
    const result = await pool.query(
      `INSERT INTO vehicles 
       (id, description, seats, registration, notes, vehicle_type, wheelchair_access, status, rego_expiry, insurance_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, description, seats, registration, notes, vehicle_type, wheelchair_access, status, rego_expiry, insurance_expiry]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating vehicle:', error);
    throw error;
  }
};

/**
 * Update an existing vehicle
 * @param {string} id - Vehicle ID
 * @param {Object} vehicleData - Updated vehicle data
 * @returns {Promise<Object>} Updated vehicle object
 */
const updateVehicle = async (id, vehicleData) => {
  // First check if vehicle exists
  const existingVehicle = await getVehicleById(id);
  if (!existingVehicle) return null;
  
  // Extract fields to update
  const {
    description,
    seats,
    registration,
    notes,
    vehicle_type,
    wheelchair_access,
    status,
    rego_expiry,
    insurance_expiry
  } = vehicleData;
  
  try {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    // Only include fields that are provided
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    
    if (seats !== undefined) {
      fields.push(`seats = $${paramIndex++}`);
      values.push(seats);
    }
    
    if (registration !== undefined) {
      fields.push(`registration = $${paramIndex++}`);
      values.push(registration);
    }
    
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (vehicle_type !== undefined) {
      fields.push(`vehicle_type = $${paramIndex++}`);
      values.push(vehicle_type);
    }
    
    if (wheelchair_access !== undefined) {
      fields.push(`wheelchair_access = $${paramIndex++}`);
      values.push(wheelchair_access);
    }
    
    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    
    if (rego_expiry !== undefined) {
      fields.push(`rego_expiry = $${paramIndex++}`);
      values.push(rego_expiry);
    }
    
    if (insurance_expiry !== undefined) {
      fields.push(`insurance_expiry = $${paramIndex++}`);
      values.push(insurance_expiry);
    }
    
    // Add updated_at timestamp
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // If no fields to update, return existing
    if (fields.length === 0) return existingVehicle;
    
    // Add ID to values array
    values.push(id);
    
    const query = `
      UPDATE vehicles 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating vehicle with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a vehicle
 * @param {string} id - Vehicle ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteVehicle = async (id) => {
  try {
    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting vehicle with ID ${id}:`, error);
    throw error;
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
