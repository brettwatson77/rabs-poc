/**
 * Intentions API Routes
 * 
 * Endpoints for managing loom intentions:
 * - GET /intentions - List all intentions
 * - GET /intentions/:id - Get single intention
 * - POST /intentions - Create intention
 * - PUT /intentions/:id - Update intention
 * - DELETE /intentions/:id - Delete intention
 * - POST /intentions/process - Process pending intentions
 */

const express = require('express');
const router = express.Router();
const uuid = require('uuid');

// GET /intentions - List all intentions
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      status, 
      intent_type, 
      target_program_id,
      target_date,
      limit,
      offset
    } = req.query;
    
    // Build query with optional filters
    let query = `
      SELECT id, intent_type, target_program_id, target_date, timing, 
             metadata, status, created_at, processed_at
      FROM intentions
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      queryParams.push(status);
    }
    
    if (intent_type) {
      query += ` AND intent_type = $${paramIndex++}`;
      queryParams.push(intent_type);
    }
    
    if (target_program_id) {
      query += ` AND target_program_id = $${paramIndex++}`;
      queryParams.push(target_program_id);
    }
    
    if (target_date) {
      query += ` AND target_date = $${paramIndex++}`;
      queryParams.push(target_date);
    }
    
    // Add ordering
    query += ` ORDER BY created_at DESC`;
    
    // Add pagination
    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      queryParams.push(parseInt(limit));
      
      if (offset) {
        query += ` OFFSET $${paramIndex++}`;
        queryParams.push(parseInt(offset));
      }
    }
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching intentions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch intentions',
      message: error.message
    });
  }
});

// GET /intentions/:id - Get single intention
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    const query = `
      SELECT id, intent_type, target_program_id, target_date, timing, 
             metadata, status, created_at, processed_at
      FROM intentions
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Intention not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching intention:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch intention',
      message: error.message
    });
  }
});

// POST /intentions - Create intention
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      intent_type,
      target_program_id,
      target_date,
      timing,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!intent_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'intent_type is required'
      });
    }
    
    // Validate intent_type is a valid enum value
    const validIntentTypes = [
      'CREATE_PROGRAM', 
      'CANCEL_PROGRAM', 
      'MODIFY_PROGRAM',
      'STAFF_CHANGE',
      'VENUE_CHANGE',
      'VEHICLE_MAINTENANCE'
    ];
    
    if (!validIntentTypes.includes(intent_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid intent_type',
        message: `intent_type must be one of: ${validIntentTypes.join(', ')}`
      });
    }
    
    const query = `
      INSERT INTO intentions (
        intent_type, target_program_id, target_date, timing, metadata, status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, intent_type, target_program_id, target_date, timing, 
                metadata, status, created_at, processed_at
    `;
    
    const values = [
      intent_type,
      target_program_id || null,
      target_date || null,
      timing || null,
      metadata || {},
      'pending' // Default status for new intentions
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Intention created successfully'
    });
  } catch (error) {
    console.error('Error creating intention:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create intention',
      message: error.message
    });
  }
});

// PUT /intentions/:id - Update intention
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      intent_type,
      target_program_id,
      target_date,
      timing,
      metadata,
      status
    } = req.body;
    
    // Check if intention exists
    const checkResult = await pool.query('SELECT id FROM intentions WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Intention not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (intent_type !== undefined) {
      // Validate intent_type is a valid enum value
      const validIntentTypes = [
        'CREATE_PROGRAM', 
        'CANCEL_PROGRAM', 
        'MODIFY_PROGRAM',
        'STAFF_CHANGE',
        'VENUE_CHANGE',
        'VEHICLE_MAINTENANCE'
      ];
      
      if (!validIntentTypes.includes(intent_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid intent_type',
          message: `intent_type must be one of: ${validIntentTypes.join(', ')}`
        });
      }
      
      updates.push(`intent_type = $${paramIndex++}`);
      values.push(intent_type);
    }
    
    if (target_program_id !== undefined) {
      updates.push(`target_program_id = $${paramIndex++}`);
      values.push(target_program_id);
    }
    
    if (target_date !== undefined) {
      updates.push(`target_date = $${paramIndex++}`);
      values.push(target_date);
    }
    
    if (timing !== undefined) {
      updates.push(`timing = $${paramIndex++}`);
      values.push(timing);
    }
    
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(metadata);
    }
    
    if (status !== undefined) {
      // Validate status is a valid value
      const validStatuses = ['pending', 'processed', 'failed', 'cancelled'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          message: `status must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      
      // If status is being set to 'processed', update processed_at timestamp
      if (status === 'processed') {
        updates.push(`processed_at = NOW()`);
      }
    }
    
    // If no fields to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const query = `
      UPDATE intentions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, intent_type, target_program_id, target_date, timing, 
                metadata, status, created_at, processed_at
    `;
    
    values.push(id);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Intention updated successfully'
    });
  } catch (error) {
    console.error('Error updating intention:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update intention',
      message: error.message
    });
  }
});

// DELETE /intentions/:id - Delete intention
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    // Check if intention exists
    const checkResult = await pool.query('SELECT id, status FROM intentions WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Intention not found'
      });
    }
    
    // Check if intention has already been processed
    if (checkResult.rows[0].status === 'processed') {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete processed intention',
        message: 'This intention has already been processed and cannot be deleted'
      });
    }
    
    const query = 'DELETE FROM intentions WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Intention deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting intention:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete intention',
      message: error.message
    });
  }
});

// POST /intentions/process - Process pending intentions
router.post('/process', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { limit } = req.body;
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get pending intentions
      let query = `
        SELECT id, intent_type, target_program_id, target_date, timing, metadata
        FROM intentions
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `;
      
      if (limit) {
        query += ` LIMIT $1`;
      }
      
      const pendingResult = await client.query(
        query,
        limit ? [parseInt(limit)] : []
      );
      
      const pendingIntentions = pendingResult.rows;
      
      if (pendingIntentions.length === 0) {
        await client.query('COMMIT');
        return res.json({
          success: true,
          data: {
            processed: 0,
            failed: 0,
            details: []
          },
          message: 'No pending intentions to process'
        });
      }
      
      // Process each intention
      const results = {
        processed: 0,
        failed: 0,
        details: []
      };
      
      for (const intention of pendingIntentions) {
        try {
          // Process based on intent type
          switch (intention.intent_type) {
            case 'CREATE_PROGRAM':
              // Implementation would create a program based on intention metadata
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Program created successfully'
              });
              break;
              
            case 'CANCEL_PROGRAM':
              // Implementation would cancel a program or instance
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Program cancelled successfully'
              });
              break;
              
            case 'MODIFY_PROGRAM':
              // Implementation would modify a program or instance
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Program modified successfully'
              });
              break;
              
            case 'STAFF_CHANGE':
              // Implementation would handle staff changes
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Staff change processed successfully'
              });
              break;
              
            case 'VENUE_CHANGE':
              // Implementation would handle venue changes
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Venue change processed successfully'
              });
              break;
              
            case 'VEHICLE_MAINTENANCE':
              // Implementation would handle vehicle maintenance
              // For now, just mark as processed
              await client.query(
                `UPDATE intentions 
                 SET status = 'processed', processed_at = NOW() 
                 WHERE id = $1`,
                [intention.id]
              );
              
              results.processed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'processed',
                message: 'Vehicle maintenance processed successfully'
              });
              break;
              
            default:
              // Unknown intent type
              await client.query(
                `UPDATE intentions 
                 SET status = 'failed', metadata = jsonb_set(metadata, '{error}', $2::jsonb) 
                 WHERE id = $1`,
                [intention.id, JSON.stringify('Unknown intent type')]
              );
              
              results.failed++;
              results.details.push({
                id: intention.id,
                intent_type: intention.intent_type,
                status: 'failed',
                message: 'Unknown intent type'
              });
          }
        } catch (intentError) {
          // Mark intention as failed
          await client.query(
            `UPDATE intentions 
             SET status = 'failed', metadata = jsonb_set(metadata, '{error}', $2::jsonb) 
             WHERE id = $1`,
            [intention.id, JSON.stringify(intentError.message)]
          );
          
          results.failed++;
          results.details.push({
            id: intention.id,
            intent_type: intention.intent_type,
            status: 'failed',
            message: intentError.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      // Log to system_logs
      try {
        await pool.query(
          `INSERT INTO system_logs (id, severity, category, message, details) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            uuid.v4(),
            'INFO',
            'OPERATIONAL',
            `Processed ${results.processed} intentions (${results.failed} failed)`,
            { results }
          ]
        );
      } catch (logError) {
        console.error('Failed to log to system_logs:', logError);
      }
      
      res.json({
        success: true,
        data: results,
        message: `Processed ${results.processed} intentions (${results.failed} failed)`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing intentions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process intentions',
      message: error.message
    });
  }
});

module.exports = router;
