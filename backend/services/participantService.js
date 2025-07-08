// backend/services/participantService.js
const { getDbConnection } = require('../database');

/**
 * Get all participants from the database
 * @returns {Promise<Array>} Array of participant objects
 */
const getAllParticipants = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM participants', [], (err, result) => {
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
 * Get a single participant by ID
 * @param {number} id - Participant ID
 * @returns {Promise<Object>} Participant object
 */
const getParticipantById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM participants WHERE id = ?', [id], (err, result) => {
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

  let db;
  try {
    db = await getDbConnection();

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
    } = participantData;

    const lastID = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO participants 
         (first_name, last_name, address, suburb, state, postcode, ndis_number, is_plan_managed, contact_phone, contact_email, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    // Fetch and return the newly created participant using separate connection
    return await getParticipantById(lastID);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing participant
 * @param {number} id - Participant ID
 * @param {Object} participantData - Updated participant data
 * @returns {Promise<Object>} Updated participant object
 */
const updateParticipant = async (id, participantData) => {
  // Ensure participant exists
  const existing = await getParticipantById(id);
  if (!existing) return null;

  // Build update query
  const updates = [];
  const values = [];

  Object.keys(participantData).forEach((key) => {
    if (
      [
        'first_name',
        'last_name',
        'address',
        'suburb',
        'state',
        'postcode',
        'ndis_number',
        'is_plan_managed',
        'contact_phone',
        'contact_email',
        'notes',
      ].includes(key)
    ) {
      updates.push(`${key} = ?`);
      values.push(participantData[key]);
    }
  });

  if (updates.length === 0) return existing; // nothing to update

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE participants SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });

    if (changes === 0) return null;

    return await getParticipantById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a participant
 * @param {number} id - Participant ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteParticipant = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const deleted = await new Promise((resolve, reject) => {
      db.run('DELETE FROM participants WHERE id = ?', [id], function (err) {
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
  getAllParticipants,
  getParticipantById,
  createParticipant,
  updateParticipant,
  deleteParticipant
};
