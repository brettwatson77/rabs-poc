// backend/services/rateService.js
const { getDbConnection } = require('../database');

/**
 * Get all rate line items from the database
 * @returns {Promise<Array>} Array of rate line item objects
 */
const getAllRateLineItems = async () => {
  let db;
  try {
    db = await getDbConnection();
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM rate_line_items ORDER BY program_id, support_number',
        [],
        (err, result) => (err ? reject(err) : resolve(result))
      );
    });
    return rows;
  } finally {
    if (db) db.close();
  }
};

/**
 * Get a single rate line item by ID
 * @param {number} id - Rate line item ID
 * @returns {Promise<Object>} Rate line item object
 */
const getRateLineItemById = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM rate_line_items WHERE id = ?', [id], (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });
    return row;
  } finally {
    if (db) db.close();
  }
};

/**
 * Create a new rate line item
 * @param {Object} itemData - Rate line item data
 * @returns {Promise<Object>} Created rate line item object
 */
const createRateLineItem = async (itemData) => {
  // Validate required fields
  if (
    !itemData.program_id ||
    !itemData.support_number ||
    itemData.unit_price === undefined
  ) {
    throw new Error(
      'Missing required data: program_id, support_number, and unit_price are required'
    );
  }

  const {
    program_id,
    support_number,
    description = null,
    unit_price,
    gst_code = 'P2',
    claim_type = 'Service',
    in_kind_funding_program = null,
  } = itemData;

  let db;
  try {
    db = await getDbConnection();
    const lastID = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rate_line_items 
         (program_id, support_number, description, unit_price, gst_code, claim_type, in_kind_funding_program)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          program_id,
          support_number,
          description,
          unit_price,
          gst_code,
          claim_type,
          in_kind_funding_program,
        ],
        function (err) {
          err ? reject(err) : resolve(this.lastID);
        }
      );
    });
    return await getRateLineItemById(lastID);
  } finally {
    if (db) db.close();
  }
};

/**
 * Update an existing rate line item
 * @param {number} id - Rate line item ID
 * @param {Object} itemData - Updated rate line item data
 * @returns {Promise<Object>} Updated rate line item object
 */
const updateRateLineItem = async (id, itemData) => {
  const existing = await getRateLineItemById(id);
  if (!existing) return null;

  const updates = [];
  const values = [];

  Object.keys(itemData).forEach((key) => {
    if (
      [
        'program_id',
        'support_number',
        'description',
        'unit_price',
        'gst_code',
        'claim_type',
        'in_kind_funding_program',
      ].includes(key)
    ) {
      updates.push(`${key} = ?`);
      values.push(itemData[key]);
    }
  });

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  let db;
  try {
    db = await getDbConnection();
    const changes = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE rate_line_items SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function (err) {
          err ? reject(err) : resolve(this.changes);
        }
      );
    });

    if (changes === 0) return null;
    return await getRateLineItemById(id);
  } finally {
    if (db) db.close();
  }
};

/**
 * Delete a rate line item
 * @param {number} id - Rate line item ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteRateLineItem = async (id) => {
  let db;
  try {
    db = await getDbConnection();
    const deleted = await new Promise((resolve, reject) => {
      db.run('DELETE FROM rate_line_items WHERE id = ?', [id], function (err) {
        err ? reject(err) : resolve(this.changes > 0);
      });
    });
    return deleted;
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  getAllRateLineItems,
  getRateLineItemById,
  createRateLineItem,
  updateRateLineItem,
  deleteRateLineItem
};
