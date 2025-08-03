// backend/services/vehicleService.js
/**
 * Vehicle data access layer (PostgreSQL only).
 * Legacy SQLite wrapper logic has been removed—this service now
 * uses the central pooled connection exported from `backend/database.js`.
 */

const { pool } = require('../database');

/**
 * Get all vehicles from the database
 * @returns {Promise<Array>} Array of vehicle objects
 */
const getAllVehicles = async () => {
  try {
    const { rows } = await pool.query('SELECT * FROM vehicles ORDER BY name');
    return rows;
  } catch (error) {
    console.error('Error retrieving vehicles:', error);
    throw error;
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
  const {
    name,
    registration,
    capacity,
    wheelchair_capacity = 0,
    make = null,
    model = null,
    year = null,
    active = true,
    notes = null,
    status = 'active',
    location_lat = null,
    location_lng = null
  } = vehicleData;
  
  if (!name || capacity === undefined) {
    throw new Error('Missing required vehicle data: name and capacity are required');
  }

  try {
    const result = await pool.query(
      `INSERT INTO vehicles 
       (name, registration, capacity, wheelchair_capacity, make, model, year, active, notes, status, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name,
        registration,
        capacity,
        wheelchair_capacity,
        make,
        model,
        year,
        active,
        notes,
        status,
        location_lat,
        location_lng
      ]
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
    name,
    registration,
    capacity,
    wheelchair_capacity,
    make,
    model,
    year,
    active,
    notes,
    status,
    location_lat,
    location_lng
  } = vehicleData;
  
  try {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    // Only include fields that are provided
    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (registration !== undefined) {
      fields.push(`registration = $${paramIndex++}`);
      values.push(registration);
    }
    
    if (capacity !== undefined) {
      fields.push(`capacity = $${paramIndex++}`);
      values.push(capacity);
    }
    
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (wheelchair_capacity !== undefined) {
      fields.push(`wheelchair_capacity = $${paramIndex++}`);
      values.push(wheelchair_capacity);
    }
    
    if (make !== undefined) {
      fields.push(`make = $${paramIndex++}`);
      values.push(make);
    }

    if (model !== undefined) {
      fields.push(`model = $${paramIndex++}`);
      values.push(model);
    }

    if (year !== undefined) {
      fields.push(`year = $${paramIndex++}`);
      values.push(year);
    }

    if (active !== undefined) {
      fields.push(`active = $${paramIndex++}`);
      values.push(active);
    }
    
    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    
    if (location_lat !== undefined) {
      fields.push(`location_lat = $${paramIndex++}`);
      values.push(location_lat);
    }

    if (location_lng !== undefined) {
      fields.push(`location_lng = $${paramIndex++}`);
      values.push(location_lng);
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
