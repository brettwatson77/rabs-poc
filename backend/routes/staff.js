/**
 * Staff Routes
 * 
 * Filing Cabinet component - Reference data for staff
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
 * @route   GET /api/v1/staff
 * @desc    Get all staff members
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM staff ORDER BY last_name, first_name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/staff/:id
 * @desc    Get staff member by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM staff WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
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

module.exports = router;
