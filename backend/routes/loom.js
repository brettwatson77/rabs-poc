/**
 * Loom API Routes
 * 
 * Endpoints for the loom system:
 * - GET /loom/instances - Get loom instances
 * - POST /loom/instances - Create instance
 * - PUT /loom/instances/:id - Update instance
 * - DELETE /loom/instances/:id - Delete instance
 * - POST /loom/generate - Generate instances from programs
 * - GET /loom/window - Get loom window settings
 */

const express = require('express');
const router = express.Router();

// GET /loom/instances - Get loom instances
router.get('/instances', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      start_date, 
      end_date, 
      program_id,
      status
    } = req.query;
    
    // Build query with optional filters
    let query = `
      SELECT li.*, 
             p.title as program_title, 
             p.program_type,
             v.name as venue_name
      FROM loom_instances li
      LEFT JOIN programs p ON li.program_id = p.id
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (start_date) {
      query += ` AND li.date >= $${paramIndex++}`;
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ` AND li.date <= $${paramIndex++}`;
      queryParams.push(end_date);
    }
    
    if (program_id) {
      query += ` AND li.program_id = $${paramIndex++}`;
      queryParams.push(program_id);
    }
    
    if (status) {
      query += ` AND li.status = $${paramIndex++}`;
      queryParams.push(status);
    }
    
    query += ` ORDER BY li.date ASC, li.start_time ASC`;
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching loom instances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loom instances',
      message: error.message
    });
  }
});

// POST /loom/instances - Create instance
router.post('/instances', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const {
      program_id,
      date,
      start_time,
      end_time,
      status,
      notes,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!program_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'program_id, date, start_time, and end_time are required'
      });
    }
    
    const query = `
      INSERT INTO loom_instances (
        program_id, date, start_time, end_time, status, notes, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, program_id, date, start_time, end_time, status, notes, metadata, created_at, updated_at
    `;
    
    const values = [
      program_id,
      date,
      start_time,
      end_time,
      status || 'scheduled', // Default status
      notes || null,
      metadata || {}
    ];
    
    const result = await pool.query(query, values);
    
    // After creating the instance, we should generate time slots if needed
    // This could be moved to a service function
    if (result.rows[0]) {
      const instanceId = result.rows[0].id;
      // Generate time slots based on instance type
      // This is a placeholder - implement actual time slot generation logic
      // based on your application's requirements
    }
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Loom instance created successfully'
    });
  } catch (error) {
    console.error('Error creating loom instance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create loom instance',
      message: error.message
    });
  }
});

// PUT /loom/instances/:id - Update instance
router.put('/instances/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      program_id,
      date,
      start_time,
      end_time,
      status,
      notes,
      metadata
    } = req.body;
    
    // Check if instance exists
    const checkResult = await pool.query('SELECT id FROM loom_instances WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Loom instance not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (program_id !== undefined) {
      updates.push(`program_id = $${paramIndex++}`);
      values.push(program_id);
    }
    
    if (date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(date);
    }
    
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      values.push(start_time);
    }
    
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      values.push(end_time);
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(metadata);
    }
    
    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`);
    
    // If no fields to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const query = `
      UPDATE loom_instances
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, program_id, date, start_time, end_time, status, notes, metadata, created_at, updated_at
    `;
    
    values.push(id);
    
    const result = await pool.query(query, values);
    
    // If the time has changed, we might need to update time slots
    // This would be implemented based on your application logic
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Loom instance updated successfully'
    });
  } catch (error) {
    console.error('Error updating loom instance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update loom instance',
      message: error.message
    });
  }
});

// DELETE /loom/instances/:id - Delete instance
router.delete('/instances/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if instance exists
      const checkResult = await client.query('SELECT id FROM loom_instances WHERE id = $1', [id]);
      if (checkResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Loom instance not found'
        });
      }
      
      // Delete related time slots first (if they exist)
      await client.query('DELETE FROM time_slots WHERE loom_instance_id = $1', [id]);
      
      // Delete the instance
      const result = await client.query('DELETE FROM loom_instances WHERE id = $1 RETURNING id', [id]);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: { id: result.rows[0].id },
        message: 'Loom instance deleted successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting loom instance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete loom instance',
      message: error.message
    });
  }
});

// POST /loom/generate - Generate instances from programs
router.post('/generate', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      start_date, 
      end_date,
      program_ids
    } = req.body;
    
    // Validate required fields
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'start_date and end_date are required'
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Build query to get eligible programs
      let programQuery = `
        SELECT id, title, program_type, day_of_week, start_time, end_time, 
               recurring, venue_id, metadata
        FROM programs
        WHERE is_active = true
      `;
      
      const queryParams = [];
      let paramIndex = 1;
      
      // Filter by specific program IDs if provided
      if (program_ids && program_ids.length > 0) {
        programQuery += ` AND id = ANY($${paramIndex++})`;
        queryParams.push(program_ids);
      }
      
      const programsResult = await client.query(programQuery, queryParams);
      const programs = programsResult.rows;
      
      if (programs.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'No eligible programs found'
        });
      }
      
      // Parse dates
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      // Initialize results
      const generatedInstances = [];
      const skippedInstances = [];
      
      // Generate instances for each program
      for (const program of programs) {
        // Calculate all dates between start and end date that match the program's day of week
        const dates = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          if (currentDate.getDay() === program.day_of_week) {
            dates.push(new Date(currentDate));
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // For each valid date, create a loom instance
        for (const date of dates) {
          // Format date as YYYY-MM-DD
          const formattedDate = date.toISOString().split('T')[0];
          
          // Check if instance already exists for this program and date
          const existingResult = await client.query(
            `SELECT id FROM loom_instances 
             WHERE program_id = $1 AND date = $2`,
            [program.id, formattedDate]
          );
          
          if (existingResult.rowCount > 0) {
            skippedInstances.push({
              program_id: program.id,
              date: formattedDate,
              reason: 'Instance already exists'
            });
            continue;
          }
          
          // Create new instance
          const insertResult = await client.query(
            `INSERT INTO loom_instances (
              program_id, date, start_time, end_time, status, metadata
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, program_id, date, start_time, end_time, status`,
            [
              program.id,
              formattedDate,
              program.start_time,
              program.end_time,
              'scheduled',
              program.metadata || {}
            ]
          );
          
          generatedInstances.push(insertResult.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          generated: generatedInstances,
          skipped: skippedInstances,
          total_generated: generatedInstances.length,
          total_skipped: skippedInstances.length
        },
        message: `Successfully generated ${generatedInstances.length} loom instances`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error generating loom instances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate loom instances',
      message: error.message
    });
  }
});

// GET /loom/window - Get loom window settings
router.get('/window', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get loom window settings from settings table
    const query = `
      SELECT value
      FROM settings
      WHERE key = 'loom_window'
    `;
    
    const result = await pool.query(query);
    
    // If no settings found, return default values
    if (result.rowCount === 0) {
      return res.json({
        success: true,
        data: {
          days_before: 7,
          days_after: 30,
          auto_generate: true,
          last_generated: null
        },
        message: 'Using default loom window settings'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0].value,
      message: 'Loom window settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching loom window settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loom window settings',
      message: error.message
    });
  }
});

module.exports = router;
