// backend/services/vehicleService.js
const { getDbConnection } = require('../database');

/**
 * Get all vehicles from the database
 * @returns {Promise<Array>} Array of vehicle objects
 */
const getAllVehicles = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM vehicles', [], (err, result) => {
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
 * Get a single vehicle by ID
 * @param {string} id - Vehicle ID (e.g., 'V1', 'V2')
 * @returns {Promise<Object>} Vehicle object
 */
const getVehicleById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM vehicles WHERE id = ?', [id], (err, result) => {
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
    notes = null
  } = vehicleData;

  let db;
  try {
    db = await getDbConnection();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO vehicles 
         (id, description, seats, registration, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [id, description, seats, registration, notes],
        function (err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    // Fetch and return the newly created vehicle
    return await getVehicleById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing vehicle
 * @param {string} id - Vehicle ID
 * @param {Object} vehicleData - Updated vehicle data
 * @returns {Promise<Object>} Updated vehicle object
 */
const updateVehicle = async (id, vehicleData) => {
  // Ensure vehicle exists
  const existingVehicle = await getVehicleById(id);
  if (!existingVehicle) return null;

  // Build update query
  const updates = [];
  const values = [];

  Object.keys(vehicleData).forEach(key => {
    if (['description', 'seats', 'registration', 'notes'].includes(key)) {
      updates.push(`${key} = ?`);
      values.push(vehicleData[key]);
    }
  });

  // No valid updates
  if (updates.length === 0) return existingVehicle;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`;

  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });

    if (changes === 0) return null;

    return await getVehicleById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a vehicle
 * @param {string} id - Vehicle ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteVehicle = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const deleted = await new Promise((resolve, reject) => {
      db.run('DELETE FROM vehicles WHERE id = ?', [id], function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      });
    });
    return deleted;
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
