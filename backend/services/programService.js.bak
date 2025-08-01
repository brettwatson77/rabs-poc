// backend/services/programService.js
const { getDbConnection } = require('../database');

/**
 * Get all programs from the database
 * @returns {Promise<Array>} Array of program objects
 */
const getAllPrograms = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM programs', [], (err, result) => {
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
 * Get a single program by ID
 * @param {number} id - Program ID
 * @returns {Promise<Object>} Program object
 */
const getProgramById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM programs WHERE id = ?', [id], (err, result) => {
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
 * Create a new program
 * @param {Object} programData - Program data
 * @returns {Promise<Object>} Created program object
 */
const createProgram = async (programData) => {
  // Validate required fields
  if (
    !programData.name ||
    programData.day_of_week === undefined ||
    !programData.start_time ||
    !programData.end_time
  ) {
    throw new Error(
      'Missing required program data: name, day_of_week, start_time, and end_time are required'
    );
  }

  const {
    name,
    description = null,
    day_of_week,
    start_time,
    end_time,
    is_weekend = 0,
    is_centre_based = 1,
    venue_id = null,
    active = 1,
  } = programData;

  let db;
  try {
    db = await getDbConnection();

    const lastID = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO programs 
         (name, description, day_of_week, start_time, end_time, is_weekend, is_centre_based, venue_id, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description,
          day_of_week,
          start_time,
          end_time,
          is_weekend,
          is_centre_based,
          venue_id,
          active,
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    return await getProgramById(lastID);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing program
 * @param {number} id - Program ID
 * @param {Object} programData - Updated program data
 * @returns {Promise<Object>} Updated program object
 */
const updateProgram = async (id, programData) => {
  // Ensure the program exists
  const existing = await getProgramById(id);
  if (!existing) return null;

  // Build dynamic update query
  const updates = [];
  const values = [];

  Object.keys(programData).forEach((key) => {
    if (
      [
        'name',
        'description',
        'day_of_week',
        'start_time',
        'end_time',
        'is_weekend',
        'is_centre_based',
        'venue_id',
        'active',
      ].includes(key)
    ) {
      updates.push(`${key} = ?`);
      values.push(programData[key]);
    }
  });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE programs SET ${updates.join(', ')} WHERE id = ?`;

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
    return await getProgramById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a program
 * @param {number} id - Program ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteProgram = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const deleted = await new Promise((resolve, reject) => {
      db.run('DELETE FROM programs WHERE id = ?', [id], function (err) {
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
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram
};
