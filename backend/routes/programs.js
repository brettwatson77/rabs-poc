/**
 * Programs Routes
 * 
 * Wall component - Program templates that generate loom instances
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rabspocdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * @route   GET /api/v1/programs
 * @desc    Get all program templates
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM programs ORDER BY name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/programs/:id
 * @desc    Get program template by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM programs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/programs
 * @desc    Create a new program template
 * @access  Public
 */
router.post('/', async (req, res, next) => {
  try {
    const { 
      name, 
      venue_id, 
      repeat_pattern, 
      days_of_week, 
      start_date, 
      end_date,
      staff_ratio 
    } = req.body;
    
    // Validate required fields
    if (!name || !venue_id || !start_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, venue_id, start_date'
      });
    }
    
    // Insert program
    const result = await pool.query(
      `INSERT INTO programs 
       (name, venue_id, repeat_pattern, days_of_week, start_date, end_date, staff_ratio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, venue_id, repeat_pattern, days_of_week, start_date, end_date || start_date, staff_ratio || '1:4']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/programs/:programId/time-slots
 * @desc    Get time slots for a program
 * @access  Public
 */
router.get('/:programId/time-slots', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const result = await pool.query(
      'SELECT * FROM tgl_loom_time_slots WHERE program_id = $1 ORDER BY start_time',
      [programId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/programs/:programId/time-slots
 * @desc    Create a new time slot for a program
 * @access  Public
 */
router.post('/:programId/time-slots', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { start_time, end_time, segment_type } = req.body;
    
    // Validate required fields
    if (!start_time || !end_time || !segment_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: start_time, end_time, segment_type'
      });
    }
    
    // Insert time slot
    const result = await pool.query(
      `INSERT INTO tgl_loom_time_slots 
       (program_id, start_time, end_time, segment_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [programId, start_time, end_time, segment_type]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/programs/:programId/participants
 * @desc    Get participants for a program
 * @access  Public
 */
router.get('/:programId/participants', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const result = await pool.query(
      `SELECT pp.*, p.first_name, p.last_name, p.photo_url 
       FROM program_participants pp
       JOIN participants p ON pp.participant_id = p.id
       WHERE pp.program_id = $1`,
      [programId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/programs/:programId/participants
 * @desc    Add a participant to a program
 * @access  Public
 */
router.post('/:programId/participants', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { participant_id, billing_code_id } = req.body;
    
    // Validate required fields
    if (!participant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: participant_id'
      });
    }
    
    // Insert program participant
    const result = await pool.query(
      `INSERT INTO program_participants 
       (program_id, participant_id, billing_code_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [programId, participant_id, billing_code_id]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
