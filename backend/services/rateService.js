// backend/services/rateService.js
const db = require('../database');

/**
 * Get all rate line items from the database
 * @returns {Promise<Array>} Array of rate line item objects
 */
const getAllRateLineItems = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM rate_line_items ORDER BY program_id, support_number', [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get a single rate line item by ID
 * @param {number} id - Rate line item ID
 * @returns {Promise<Object>} Rate line item object
 */
const getRateLineItemById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM rate_line_items WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
};

/**
 * Create a new rate line item
 * @param {Object} itemData - Rate line item data
 * @returns {Promise<Object>} Created rate line item object
 */
const createRateLineItem = (itemData) => {
  return new Promise((resolve, reject) => {
    // Validate required fields
    if (!itemData.program_id || !itemData.support_number || itemData.unit_price === undefined) {
      reject(new Error('Missing required data: program_id, support_number, and unit_price are required'));
      return;
    }
    
    const {
      program_id,
      support_number,
      description = null,
      unit_price,
      gst_code = 'P2',
      claim_type = 'Service',
      in_kind_funding_program = null
    } = itemData;
    
    db.run(
      `INSERT INTO rate_line_items 
       (program_id, support_number, description, unit_price, gst_code, claim_type, in_kind_funding_program)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [program_id, support_number, description, unit_price, gst_code, claim_type, in_kind_funding_program],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        getRateLineItemById(this.lastID)
          .then(item => resolve(item))
          .catch(err => reject(err));
      }
    );
  });
};

/**
 * Update an existing rate line item
 * @param {number} id - Rate line item ID
 * @param {Object} itemData - Updated rate line item data
 * @returns {Promise<Object>} Updated rate line item object
 */
const updateRateLineItem = (id, itemData) => {
  return new Promise((resolve, reject) => {
    getRateLineItemById(id)
      .then(item => {
        if (!item) {
          resolve(null);
          return;
        }
        
        const updates = [];
        const values = [];
        
        Object.keys(itemData).forEach(key => {
          if (['program_id', 'support_number', 'description', 'unit_price', 'gst_code', 'claim_type', 'in_kind_funding_program'].includes(key)) {
            updates.push(`${key} = ?`);
            values.push(itemData[key]);
          }
        });
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        const query = `UPDATE rate_line_items SET ${updates.join(', ')} WHERE id = ?`;
        
        db.run(query, values, function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          
          getRateLineItemById(id)
            .then(updatedItem => resolve(updatedItem))
            .catch(err => reject(err));
        });
      })
      .catch(err => reject(err));
  });
};

/**
 * Delete a rate line item
 * @param {number} id - Rate line item ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
const deleteRateLineItem = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM rate_line_items WHERE id = ?', [id], function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
};

module.exports = {
  getAllRateLineItems,
  getRateLineItemById,
  createRateLineItem,
  updateRateLineItem,
  deleteRateLineItem
};
