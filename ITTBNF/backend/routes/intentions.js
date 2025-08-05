/**
 * Intention Routes
 * 
 * Routes for operator intents and temporal exceptions
 * Implements the "from this date forward" pattern and one-off exceptions
 */

const express = require('express');
const router = express.Router();
const intentionController = require('../controllers/intentionController');
const { pool } = require('../database');
const { formatDateForDb, parseDbDate, isValidDate } = require('../utils/dateUtils');
const logger = require('../utils/logger');

// ---------------------- INTENT ROUTES ----------------------

/**
 * @route   POST /api/v1/intentions/intents
 * @desc    Create a new operator intent
 * @access  Private
 */
router.post('/intents', intentionController.createIntent);

/**
 * @route   GET /api/v1/intentions/intents
 * @desc    Get all intents with optional filtering
 * @access  Private
 */
router.get('/intents', intentionController.getIntents);

/**
 * @route   GET /api/v1/intentions/intents/:id
 * @desc    Get a single intent by ID
 * @access  Private
 */
router.get('/intents/:id', intentionController.getIntentById);

/**
 * @route   PUT /api/v1/intentions/intents/:id
 * @desc    Update an existing intent
 * @access  Private
 */
router.put('/intents/:id', intentionController.updateIntent);

/**
 * @route   DELETE /api/v1/intentions/intents/:id
 * @desc    Delete an intent
 * @access  Private
 */
router.delete('/intents/:id', intentionController.deleteIntent);

/**
 * @route   GET /api/v1/intentions/intents/active/:date
 * @desc    Get all intents active on a specific date
 * @access  Private
 */
router.get('/intents/active/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format (use YYYY-MM-DD)'
      });
    }
    
    // Query for intents active on the specified date
    const query = `
      SELECT i.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name,
        s.first_name || ' ' || s.last_name as staff_name,
        v.name as venue_name
      FROM tgl_operator_intents i
      LEFT JOIN programs p ON i.program_id = p.id
      LEFT JOIN participants part ON i.participant_id = part.id
      LEFT JOIN staff s ON i.staff_id = s.id
      LEFT JOIN venues v ON i.venue_id = v.id
      WHERE i.start_date <= $1 
      AND (i.end_date IS NULL OR i.end_date >= $1)
      ORDER BY i.intent_type, p.name
    `;
    
    const { rows } = await pool.query(query, [date]);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    logger.error(`Error fetching active intents: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active intents',
      error: error.message
    });
  }
});

// ---------------------- EXCEPTION ROUTES ----------------------

/**
 * @route   POST /api/v1/intentions/exceptions
 * @desc    Create a new temporal exception
 * @access  Private
 */
router.post('/exceptions', intentionController.createException);

/**
 * @route   GET /api/v1/intentions/exceptions
 * @desc    Get all exceptions with optional filtering
 * @access  Private
 */
router.get('/exceptions', intentionController.getExceptions);

/**
 * @route   GET /api/v1/intentions/exceptions/:id
 * @desc    Get a single exception by ID
 * @access  Private
 */
router.get('/exceptions/:id', intentionController.getExceptionById);

/**
 * @route   DELETE /api/v1/intentions/exceptions/:id
 * @desc    Delete an exception
 * @access  Private
 */
router.delete('/exceptions/:id', intentionController.deleteException);

/**
 * @route   GET /api/v1/intentions/exceptions/date/:date
 * @desc    Get all exceptions for a specific date
 * @access  Private
 */
router.get('/exceptions/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format (use YYYY-MM-DD)'
      });
    }
    
    // Query for exceptions on the specified date
    const query = `
      SELECT e.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name
      FROM tgl_temporal_exceptions e
      LEFT JOIN programs p ON e.program_id = p.id
      LEFT JOIN participants part ON e.participant_id = part.id
      WHERE e.exception_date = $1
      ORDER BY e.exception_type, p.name
    `;
    
    const { rows } = await pool.query(query, [date]);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    logger.error(`Error fetching exceptions by date: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exceptions by date',
      error: error.message
    });
  }
});

// ---------------------- HELPER ROUTES ----------------------

/**
 * @route   GET /api/v1/intentions/summary/:program_id/:date
 * @desc    Get summary of intents and exceptions for a program on a date
 * @access  Private
 */
router.get('/summary/:program_id/:date', async (req, res) => {
  try {
    const { program_id, date } = req.params;
    
    // Validate date format
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format (use YYYY-MM-DD)'
      });
    }
    
    const client = await pool.connect();
    
    try {
      // Get program details
      const programQuery = `
        SELECT p.*, v.name as venue_name
        FROM programs p
        LEFT JOIN venues v ON p.venue_id = v.id
        WHERE p.id = $1
      `;
      
      const programResult = await client.query(programQuery, [program_id]);
      
      if (programResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Program not found'
        });
      }
      
      const program = programResult.rows[0];
      
      // Get active intents for this program on this date
      const intentsQuery = `
        SELECT i.*, 
          part.first_name || ' ' || part.last_name as participant_name,
          s.first_name || ' ' || s.last_name as staff_name,
          v.name as venue_name
        FROM tgl_operator_intents i
        LEFT JOIN participants part ON i.participant_id = part.id
        LEFT JOIN staff s ON i.staff_id = s.id
        LEFT JOIN venues v ON i.venue_id = v.id
        WHERE i.program_id = $1
        AND i.start_date <= $2
        AND (i.end_date IS NULL OR i.end_date >= $2)
        ORDER BY i.intent_type, i.created_at
      `;
      
      const intentsResult = await client.query(intentsQuery, [program_id, date]);
      
      // Get exceptions for this program on this date
      const exceptionsQuery = `
        SELECT e.*, 
          part.first_name || ' ' || part.last_name as participant_name
        FROM tgl_temporal_exceptions e
        LEFT JOIN participants part ON e.participant_id = part.id
        WHERE e.program_id = $1
        AND e.exception_date = $2
        ORDER BY e.exception_type, e.created_at
      `;
      
      const exceptionsResult = await client.query(exceptionsQuery, [program_id, date]);
      
      // Get instance if it exists in the current window
      const instanceQuery = `
        SELECT i.*, 
          COUNT(a.id) as participant_count,
          COUNT(s.id) as staff_count,
          COUNT(v.id) as vehicle_count
        FROM tgl_loom_instances i
        LEFT JOIN tgl_loom_participant_allocations a ON i.id = a.instance_id AND a.status = 'CONFIRMED'
        LEFT JOIN tgl_loom_staff_shifts s ON i.id = s.instance_id
        LEFT JOIN tgl_loom_vehicle_runs v ON i.id = v.instance_id
        WHERE i.program_id = $1
        AND i.date = $2
        GROUP BY i.id
      `;
      
      const instanceResult = await client.query(instanceQuery, [program_id, date]);
      
      // Return the summary
      res.json({
        success: true,
        data: {
          program,
          intents: {
            count: intentsResult.rows.length,
            items: intentsResult.rows
          },
          exceptions: {
            count: exceptionsResult.rows.length,
            items: exceptionsResult.rows
          },
          instance: instanceResult.rows.length > 0 ? instanceResult.rows[0] : null
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(`Error fetching program summary: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch program summary',
      error: error.message
    });
  }
});

module.exports = router;
