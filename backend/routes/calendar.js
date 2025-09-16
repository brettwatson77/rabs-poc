/**
 * Calendar Router
 * 
 * Implements the Calendar API for the RABS system.
 * This router handles program exceptions and calendar-specific operations.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Import the syncRethread utility
const { syncRethread } = require('./util_syncRethread');

// POST /calendar/exception - Create a program exception and trigger syncRethread
router.post('/exception', async (req, res) => {
  const pool = req.app.locals.pool;
  const {
    program_id,
    exception_date,
    exception_type,
    start_time,
    end_time,
    venue_id,
    reason,
    metadata
  } = req.body;
  
  // Validate required fields
  if (!program_id || !exception_date || !exception_type) {
    return res.status(400).json({
      success: false,
      error: 'Required fields: program_id, exception_date, exception_type'
    });
  }
  
  try {
    // First check if the program exists
    const programCheck = await pool.query('SELECT id FROM rules_programs WHERE id = $1', [program_id]);
    
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found'
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    let exceptionId;
    
    try {
      await client.query('BEGIN');
      
      // Try inserting with metadata first
      try {
        const result = await client.query(`
          INSERT INTO rules_program_exceptions
          (id, program_id, exception_date, exception_type, start_time, end_time, venue_id, reason, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          uuidv4(),
          program_id,
          exception_date,
          exception_type,
          start_time || null,
          end_time || null,
          venue_id || null,
          reason || null,
          metadata ? JSON.stringify(metadata) : null
        ]);
        
        exceptionId = result.rows[0].id;
      } catch (err) {
        // If metadata column doesn't exist, retry without it
        if (err.message.includes('column "metadata" of relation "rules_program_exceptions" does not exist')) {
          const result = await client.query(`
            INSERT INTO rules_program_exceptions
            (id, program_id, exception_date, exception_type, start_time, end_time, venue_id, reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [
            uuidv4(),
            program_id,
            exception_date,
            exception_type,
            start_time || null,
            end_time || null,
            venue_id || null,
            reason || null
          ]);
          
          exceptionId = result.rows[0].id;
        } else {
          // If it's another error, rethrow it
          throw err;
        }
      }
      
      // Call syncRethread for just this date
      const summary = await syncRethread({
        dateFrom: exception_date,
        dateTo: exception_date,
        futureOnly: false
      }, pool);
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {
          id: exceptionId,
          summary
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating calendar exception:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar exception'
    });
  }
});

module.exports = router;
