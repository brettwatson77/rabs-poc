/**
 * Settings API Routes
 * 
 * Endpoints for system settings management:
 * - GET /settings - Get all settings
 * - GET /settings/:key - Get specific setting
 * - PUT /settings/:key - Update setting
 * - DELETE /settings/:key - Delete setting
 * - POST /settings/bulk - Bulk update settings
 */

const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const logger = require('../logger');

// GET /settings - Get all settings
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { category } = req.query;
    
    let query = `
      SELECT key, value, description, category, is_system
      FROM settings
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (category) {
      query += ` AND category = $${paramIndex++}`;
      queryParams.push(category);
    }
    
    query += ` ORDER BY category, key`;
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      message: error.message
    });
  }
});

// GET /settings/:key - Get specific setting
router.get('/:key', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { key } = req.params;
    
    const query = `
      SELECT key, value, description, category, is_system
      FROM settings
      WHERE key = $1
    `;
    
    const result = await pool.query(query, [key]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
        message: `No setting found with key: ${key}`
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch setting',
      message: error.message
    });
  }
});

// PUT /settings/:key - Update setting
router.put('/:key', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { key } = req.params;
    const { value, description, category } = req.body;
    
    // Check if setting exists
    const checkResult = await pool.query('SELECT key, is_system FROM settings WHERE key = $1', [key]);
    
    if (checkResult.rowCount === 0) {
      // Setting doesn't exist, create it
      const insertQuery = `
        INSERT INTO settings (key, value, description, category, is_system)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING key, value, description, category, is_system
      `;
      
      const insertResult = await pool.query(insertQuery, [
        key,
        value,
        description || null,
        category || 'general',
        false // New settings created via API are not system settings
      ]);
      
      return res.status(201).json({
        success: true,
        data: insertResult.rows[0],
        message: 'Setting created successfully'
      });
    }
    
    // Check if it's a system setting that shouldn't be modified
    if (checkResult.rows[0].is_system && req.body.value === undefined) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify system setting',
        message: 'This is a system setting and cannot be modified'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (value !== undefined) {
      updates.push(`value = $${paramIndex++}`);
      values.push(value);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    
    // If no fields to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        message: 'Request must include at least one field to update'
      });
    }
    
    const query = `
      UPDATE settings
      SET ${updates.join(', ')}
      WHERE key = $${paramIndex}
      RETURNING key, value, description, category, is_system
    `;
    
    values.push(key);
    
    const result = await pool.query(query, values);
    
    // Emit log entry via central logger (persists + SSE broadcast)
    try {
      await logger.logEvent({
        severity: 'INFO',
        category: 'SYSTEM',
        message: `Setting updated: ${key}`,
        details: { key, changes: req.body },
      });
    } catch (logErr) {
      console.error('Failed to write setting update log:', logErr);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting',
      message: error.message
    });
  }
});

/**
 * ---------------------------------------------------------------------------
 * GET /api/v1/settings/org
 * ---------------------------------------------------------------------------
 * Returns organisation-level operational defaults. If a key is missing (or its
 * value cannot be parsed as a number) the hard coded fallback is used.
 * Shape: { loom_window_days, staff_threshold_per_wpu, default_bus_capacity }
 */
router.get('/org', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Keys we care about and their hard-coded defaults
    const DEFAULTS = {
      loom_window_days: 14,
      staff_threshold_per_wpu: 5,
      vehicle_trigger_every_n_participants: 10,
      default_bus_capacity: 10,
    };

    const keys = Object.keys(DEFAULTS);

    // Fetch only the keys we need in a single query
    const result = await pool.query(
      `SELECT key, value
         FROM settings
        WHERE key = ANY($1)`,
      [keys]
    );

    // Build response map starting with defaults
    const data = { ...DEFAULTS };

    // Overwrite with DB values when present & numeric
    result.rows.forEach((row) => {
      const n = Number(row.value);
      data[row.key] = Number.isFinite(n) ? n : DEFAULTS[row.key];
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching org settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch organisation settings',
      message: error.message,
    });
  }
});

// DELETE /settings/:key - Delete setting
router.delete('/:key', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { key } = req.params;
    
    // Check if setting exists and if it's a system setting
    const checkResult = await pool.query('SELECT key, is_system FROM settings WHERE key = $1', [key]);
    
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
        message: `No setting found with key: ${key}`
      });
    }
    
    // Prevent deletion of system settings
    if (checkResult.rows[0].is_system) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete system setting',
        message: 'This is a system setting and cannot be deleted'
      });
    }
    
    const query = 'DELETE FROM settings WHERE key = $1 RETURNING key';
    const result = await pool.query(query, [key]);
    
    // Log deletion via logger
    try {
      await logger.logEvent({
        severity: 'INFO',
        category: 'SYSTEM',
        message: `Setting deleted: ${key}`,
        details: { key },
      });
    } catch (logErr) {
      console.error('Failed to write setting deletion log:', logErr);
    }
    
    res.json({
      success: true,
      data: { key: result.rows[0].key },
      message: 'Setting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete setting',
      message: error.message
    });
  }
});

// POST /settings/bulk - Bulk update settings
router.post('/bulk', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { settings } = req.body;
    
    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request must include a non-empty array of settings'
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = {
        updated: [],
        created: [],
        skipped: [],
        failed: []
      };
      
      // Process each setting
      for (const setting of settings) {
        const { key, value, description, category } = setting;
        
        if (!key) {
          results.failed.push({
            setting,
            reason: 'Missing key'
          });
          continue;
        }
        
        try {
          // Check if setting exists
          const checkResult = await client.query(
            'SELECT key, is_system FROM settings WHERE key = $1',
            [key]
          );
          
          if (checkResult.rowCount === 0) {
            // Create new setting
            const insertResult = await client.query(
              `INSERT INTO settings (key, value, description, category, is_system)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING key, value, description, category, is_system`,
              [
                key,
                value,
                description || null,
                category || 'general',
                false // New settings created via API are not system settings
              ]
            );
            
            results.created.push(insertResult.rows[0]);
          } else {
            // Check if it's a system setting
            if (checkResult.rows[0].is_system) {
              results.skipped.push({
                key,
                reason: 'System setting cannot be modified'
              });
              continue;
            }
            
            // Update existing setting
            const updateResult = await client.query(
              `UPDATE settings
               SET value = $2,
                   description = COALESCE($3, description),
                   category = COALESCE($4, category)
               WHERE key = $1
               RETURNING key, value, description, category, is_system`,
              [
                key,
                value,
                description,
                category
              ]
            );
            
            results.updated.push(updateResult.rows[0]);
          }
        } catch (settingError) {
          results.failed.push({
            key,
            reason: settingError.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      // Log bulk update via logger
      try {
        await logger.logEvent({
          severity: 'INFO',
          category: 'SYSTEM',
          message: `Bulk settings update: ${results.updated.length} updated, ${results.created.length} created`,
          details: { results },
        });
      } catch (logErr) {
        console.error('Failed to write bulk settings log:', logErr);
      }
      
      res.json({
        success: true,
        data: results,
        message: `Settings updated: ${results.updated.length} updated, ${results.created.length} created, ${results.skipped.length} skipped, ${results.failed.length} failed`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing bulk settings update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk settings update',
      message: error.message
    });
  }
});

module.exports = router;

/**
 * ---------------------------------------------------------------------------
 * PUT /api/v1/settings/org
 * ---------------------------------------------------------------------------
 * Upsert organisation-level numeric settings. Accepts JSON body with any of:
 *   { loom_window_days, staff_threshold_per_wpu, default_bus_capacity }
 * All values must be finite positive numbers. Each key is stored individually
 * in the settings table (category = 'org'). On success returns the full org
 * map (merged with defaults).
 */
router.put('/org', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Allowed keys + defaults
    const DEFAULTS = {
      loom_window_days: 14,
      staff_threshold_per_wpu: 5,
      vehicle_trigger_every_n_participants: 10,
      default_bus_capacity: 10,
    };
    const allowedKeys = Object.keys(DEFAULTS);

    // Validate body
    const payloadKeys = Object.keys(req.body || {});
    if (payloadKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must include at least one setting',
      });
    }

    // Filter & validate numeric inputs
    const updates = {};
    for (const k of payloadKeys) {
      if (!allowedKeys.includes(k)) continue; // ignore unknown keys
      const num = Number(req.body[k]);
      if (!Number.isFinite(num) || num <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid value for ${k}. Must be a positive number`,
        });
      }
      updates[k] = String(num); // store as string (settings table uses text)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid keys supplied',
      });
    }

    // Upsert each key inside a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(updates)) {
        await client.query(
          `INSERT INTO settings (key, value, category, is_system)
           VALUES ($1, $2, 'org', false)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, value]
        );
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Return merged map (same logic as GET)
    const result = await pool.query(
      `SELECT key, value
         FROM settings
        WHERE key = ANY($1)`,
      [allowedKeys]
    );

    const data = { ...DEFAULTS };
    result.rows.forEach((row) => {
      const n = Number(row.value);
      data[row.key] = Number.isFinite(n) ? n : DEFAULTS[row.key];
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating org settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update organisation settings',
      message: error.message,
    });
  }
});
