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
 * ---------------------------------------------------------------------------
 * Helpers – alias mapping & body normalisation
 * ---------------------------------------------------------------------------
 */

// UI → DB column alias mapping
const aliasMap = {
  // UI alias : db column
  role: 'position',
  contract_hours: 'contracted_hours',
  hourly_rate: 'base_pay_rate',
};

/**
 * @route   GET /api/v1/staff
 * @desc    Get all staff members
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Thin list per spec – only id, first_name, last_name, active
    const result = await pool.query(
      `SELECT id, first_name, last_name, active
         FROM staff
     ORDER BY last_name, first_name`
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
 * Helpers & shared config
 */
const allowedKeys = [
  'first_name','last_name','email','phone',
  // mapped aliases
  'role','contract_hours','hourly_rate',
  // db-native
  'position','contracted_hours','base_pay_rate','schads_level','start_date',
  'address','suburb','state','postcode',
  'emergency_contact_name','emergency_contact_phone','photo_url',
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
 * Translate UI body → DB ready arrays
 * returns { keys: [], values: [] }
 */
function normalizeBody (body = {}, columns = []) {
  const keys = [];
  const values = [];

  Object.entries(body).forEach(([rawKey, val]) => {
    if (!allowedKeys.includes(rawKey)) return;

    const dbKey = aliasMap[rawKey] || rawKey; // map if alias exists
    if (!columns.includes(dbKey)) return;

    keys.push(dbKey);
    values.push(val);
  });

  return { keys, values };
}

/**
 * @route   POST /api/v1/staff
 * @desc    Create a new staff member
 * @access  Public
 */
router.post('/', async (req, res, next) => {
  try {
    const columns = await getStaffColumns();

    const { keys: validKeys, values } = normalizeBody(req.body, columns);

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

    const { keys: validKeys, values } = normalizeBody(req.body, columns);

    if (validKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided'
      });
    }

    const setClauses = validKeys.map((k, idx) => `"${k}" = $${idx + 1}`).join(', ');
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
 * ---------------------------------------------------------------------------
 * Unavailabilities sub-resource
 * ---------------------------------------------------------------------------
 */

// GET all unavailabilities
router.get('/:id/unavailabilities', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM staff_unavailabilities
        WHERE staff_id = $1
        ORDER BY start_time DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST new unavailability
router.post('/:id/unavailabilities', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, reason, notes = null } = req.body || {};
    if (!start_time || !end_time || !reason) {
      return res.status(400).json({ success: false, error: 'start_time, end_time and reason are required' });
    }
    const insertSql = `
      INSERT INTO staff_unavailabilities
        (staff_id, start_time, end_time, reason, notes)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`;
    const result = await pool.query(insertSql, [id, start_time, end_time, reason, notes]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE unavailability
router.delete('/:id/unavailabilities/:unavailId', async (req, res, next) => {
  try {
    const { id, unavailId } = req.params;
    const delSql = `
      DELETE FROM staff_unavailabilities
       WHERE id = $1 AND staff_id = $2
     RETURNING *`;
    const result = await pool.query(delSql, [unavailId, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Unavailability not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

/**
 * ---------------------------------------------------------------------------
 * Utilization endpoint
 * ---------------------------------------------------------------------------
 */

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

router.get('/:id/utilization', async (req, res, next) => {
  try {
    const { id } = req.params;
    let { start, end } = req.query;

    const today = new Date();
    if (!start || !end) {
      const mon = mondayOf(today);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      start = mon.toISOString().substring(0,10);
      end   = sun.toISOString().substring(0,10);
    }

    // hours worked in window
    const hoursSql = `
      SELECT
        COALESCE(SUM(EXTRACT(EPOCH FROM (ls.end_time - ls.start_time)))/3600.0,0) AS hours
      FROM tgl_loom_staff_shifts ls
      JOIN tgl_loom_instances li ON li.id = ls.loom_instance_id
      WHERE ls.staff_id=$1
        AND li.instance_date BETWEEN $2 AND $3
        AND ls.status IN ('planned','confirmed','completed')
    `;
    const hoursRes = await pool.query(hoursSql, [id, start, end]);
    const hours = parseFloat(hoursRes.rows[0].hours || 0);

    // contracted hours
    const staffRes = await pool.query('SELECT contracted_hours FROM staff WHERE id = $1', [id]);
    const contracted = staffRes.rows[0] ? parseFloat(staffRes.rows[0].contracted_hours || 0) : 0;
    const utilization = contracted > 0 ? hours / contracted : 0;

    res.json({
      success: true,
      data: { hours, contracted_hours: contracted, utilization, start, end }
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Weekly utilization summary for ALL staff
// ---------------------------------------------------------------------------
router.get('/utilization/summary', async (req, res, next) => {
  try {
    let { start, end } = req.query;
    const today = new Date();
    if (!start || !end) {
      const mon = mondayOf(today);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      start = mon.toISOString().substring(0, 10);
      end = sun.toISOString().substring(0, 10);
    }

    const sql = `
      SELECT 
        ls.staff_id, 
        COALESCE(SUM(EXTRACT(EPOCH FROM (ls.end_time - ls.start_time)))/3600.0,0) AS hours
      FROM tgl_loom_staff_shifts ls
      JOIN tgl_loom_instances li ON li.id = ls.loom_instance_id
      WHERE li.instance_date BETWEEN $1 AND $2
        AND ls.status IN ('planned','confirmed','completed')
      GROUP BY ls.staff_id
    `;
    const result = await pool.query(sql, [start, end]);
    res.json({ success: true, data: result.rows, range: { start, end } });
  } catch (err) { next(err); }
});

/**
 * @route   DELETE /api/v1/staff/:id
 * @desc    Delete a staff member
 * @access  Public
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM staff WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
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
