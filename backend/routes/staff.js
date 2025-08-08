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
 * Helpers & shared config
 */
const allowedKeys = [
  'first_name','last_name','email','phone','role','employment_type',
  'contract_hours','hourly_rate','start_date','address','suburb','state',
  'postcode','emergency_contact_name','emergency_contact_phone','photo_url',
  'status','notes'
];

let staffColumns = null; // cached array of column names

async function getStaffColumns () {
  if (staffColumns) return staffColumns;
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'staff'`
  );
  staffColumns = result.rows.map(r => r.column_name);
  return staffColumns;
}

/**
 * @route   POST /api/v1/staff
 * @desc    Create a new staff member
 * @access  Public
 */
router.post('/', async (req, res, next) => {
  try {
    const columns = await getStaffColumns();

    // filter incoming body
    const payloadKeys = Object.keys(req.body || {});
    const validKeys = payloadKeys
      .filter(k => allowedKeys.includes(k) && columns.includes(k));

    // basic required field check if columns exist
    if (columns.includes('first_name') && columns.includes('last_name')) {
      if (!req.body.first_name || !req.body.last_name) {
        return res.status(400).json({
          success: false,
          error: 'first_name and last_name are required'
        });
      }
    }

    if (validKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided'
      });
    }

    // Build dynamic INSERT
    const colNames = validKeys.map(k => `"${k}"`).join(', ');
    const placeholders = validKeys.map((_, idx) => `$${idx + 1}`).join(', ');
    const values = validKeys.map(k => req.body[k]);

    const insertSql = `INSERT INTO staff (${colNames}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(insertSql, values);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/staff/:id
 * @desc    Update an existing staff member
 * @access  Public
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const columns = await getStaffColumns();

    const payloadKeys = Object.keys(req.body || {});
    const validKeys = payloadKeys
      .filter(k => allowedKeys.includes(k) && columns.includes(k));

    if (validKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided'
      });
    }

    const setClauses = validKeys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
    const values = validKeys.map(k => req.body[k]);
    values.push(id); // for WHERE clause

    const updateSql = `UPDATE staff SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(updateSql, values);

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
