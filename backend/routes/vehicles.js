/**
 * Vehicles Routes
 * 
 * Filing Cabinet component - Reference data for vehicles
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
 * @route   GET /api/v1/vehicles
 * @desc    Get all vehicles
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Restore full field set expected by Filing Cabinet UI
    const result = await pool.query(
      `SELECT *
         FROM vehicles
     ORDER BY name`
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*                            Helper / Utility funcs                          */
/* -------------------------------------------------------------------------- */

// Columns that actually exist in the vehicles table (CURRENT_DATABASE.md)
const ALLOWED_KEYS = [
  'name',
  'registration',
  'capacity',
  'wheelchair_capacity',
  'make',
  'model',
  'year',
  'active',
  'notes',
  'status',
  'fuel_type',
  'location',
  'location_lat',
  'location_lng',
  'vin_number',
  'engine_number',
  'registration_expiry',
  'wheelchair_accessible',
  'max_height',
  // New capacity split fields (participants vs staff)
  'capacity_participants',
  'capacity_staff',
];

/**
 * Sanitize incoming body against allowed columns – coercing numeric fields
 */
function sanitizeVehicleBody(body = {}) {
  const cleaned = {};
  ALLOWED_KEYS.forEach((key) => {
    if (body[key] !== undefined) {
      let value = body[key];
      // Coerce numerics
      if (
        [
          'capacity',
          'wheelchair_capacity',
          'capacity_participants',
          'capacity_staff',
          'year',
          'max_height',
        ].includes(key) &&
        value !== null
      ) {
        value = parseInt(value, 10);
        if (Number.isNaN(value)) return;
      }
      cleaned[key] = value;
    }
  });
  return cleaned;
}

/**
 * @route   POST /api/v1/vehicles
 * @desc    Create a new vehicle (schema columns only)
 * @access  Public
 */
router.post('/', async (req, res, next) => {
  try {
    const data = sanitizeVehicleBody(req.body);

    // Generate default name if not supplied
    if (!data.name) {
      const parts = [];
      if (data.year) parts.push(data.year);
      if (data.make) parts.push(data.make);
      if (data.model) parts.push(data.model);
      data.name = parts.join(' ') || 'Unnamed Vehicle';
    }

    if (!data.registration) {
      return res.status(400).json({ success: false, error: 'registration is required' });
    }

    // Build dynamic insert
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const result = await pool.query(
      `INSERT INTO vehicles (${columns.join(',')}) VALUES (${placeholders.join(
        ','
      )}) RETURNING *`,
      values
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT/PATCH /api/v1/vehicles/:id
 * @desc    Update vehicle
 * @access  Public
 */
async function updateVehicle(req, res, next) {
  try {
    const { id } = req.params;
    const data = sanitizeVehicleBody(req.body);
    if (Object.keys(data).length === 0) {
      // Check if request contains non-schema fields but is not empty
      if (req.body && Object.keys(req.body).length > 0) {
        // Fetch current vehicle data instead of updating
        const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
      }
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    const sets = Object.keys(data).map((k, i) => `${k} = $${i + 1}`);
    const values = [...Object.values(data), id];

    const result = await pool.query(
      `UPDATE vehicles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${
        values.length
      } RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

router.put('/:id', updateVehicle);
router.patch('/:id', updateVehicle);

/**
 * @route   DELETE /api/v1/vehicles/:id
 * @desc    Delete vehicle
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*                             Bookings (Vehicle Runs)                        */
/* -------------------------------------------------------------------------- */

/**
 * @route   GET /api/v1/vehicles/bookings
 * @desc    List vehicle bookings (tgl_loom_vehicle_runs) over date range
 * @query   start_date, end_date (YYYY-MM-DD)
 */
router.get('/bookings', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ success: false, error: 'start_date and end_date are required' });
    }

    const result = await pool.query(
      `SELECT vr.vehicle_id,
              li.date AS start_date,
              li.date AS end_date,
              vr.start_time,
              vr.end_time,
              li.program_id,
              p.name as program_name,
              vr.time_slot_id,
              NULL::int AS driver_id,
              NULL::text AS purpose
       FROM tgl_loom_vehicle_runs vr
       JOIN tgl_loom_instances li ON vr.loom_instance_id = li.id
       JOIN programs p ON li.program_id = p.id
       WHERE li.date BETWEEN $1 AND $2
       ORDER BY li.date, vr.start_time`,
      [start_date, end_date]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/vehicles/:id/bookings
 * @desc    Stub endpoint for vehicle booking (no persistence)
 * @access  Public
 */
router.post('/:id/bookings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_date } = req.body || {};
    
    if (!start_date) {
      return res.status(400).json({ 
        success: false, 
        error: 'start_date is required' 
      });
    }
    
    // Return success with the request body for frontend compatibility
    res.status(201).json({ 
      success: true, 
      data: { 
        vehicle_id: id, 
        ...req.body, 
        id: null, 
        created: true 
      } 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/vehicles/:id/maintenance
 * @desc    Add maintenance record (maps to vehicle blackout)
 * @access  Public
 */
router.post('/:id/maintenance', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      date, 
      type, 
      description, 
      odometer, 
      cost, 
      performed_by, 
      parts_replaced, 
      notes 
    } = req.body || {};
    
    if (!date) {
      return res.status(400).json({ 
        success: false, 
        error: 'date is required' 
      });
    }
    
    // Build reason from type and description
    const reason = `${type || 'maintenance'}: ${description || ''}`.trim();
    
    // Build notes by concatenating fields
    const noteLines = [];
    if (odometer) noteLines.push(`Odometer: ${odometer}`);
    if (cost) noteLines.push(`Cost: ${cost}`);
    if (performed_by) noteLines.push(`Performed by: ${performed_by}`);
    if (parts_replaced) noteLines.push(`Parts replaced: ${parts_replaced}`);
    if (notes) noteLines.push(`Notes: ${notes}`);
    
    const combinedNotes = noteLines.length > 0 ? noteLines.join('\n') : null;
    
    // Set start and end times for the full day
    const startTs = `${date} 00:00:00+00`;
    const endTs = `${date} 23:59:59+00`;
    
    const result = await pool.query(
      `INSERT INTO vehicle_blackouts
       (vehicle_id, start_time, end_time, reason, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, startTs, endTs, reason, combinedNotes]
    );
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*                              Blackout End-points                           */
/* -------------------------------------------------------------------------- */

/**
 * Helper to build blackout where clause by date
 */
function blackoutDateFilter(start, end) {
  return `
    (vb.start_time::date, vb.end_time::date) OVERLAPS ($1::date, $2::date)
  `;
}

// GET /blackouts?start_date&end_date&vehicle_id
router.get('/blackouts', async (req, res, next) => {
  try {
    const { start_date, end_date, vehicle_id } = req.query;
    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ success: false, error: 'start_date and end_date are required' });
    }

    const params = [start_date, end_date];
    let where = blackoutDateFilter(start_date, end_date);
    if (vehicle_id) {
      params.push(vehicle_id);
      where += ` AND vb.vehicle_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT vb.*,
              v.name,
              v.registration
       FROM vehicle_blackouts vb
       JOIN vehicles v ON vb.vehicle_id = v.id
       WHERE ${where}
       ORDER BY vb.start_time`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /:id/blackouts
router.get('/:id/blackouts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM vehicle_blackouts WHERE vehicle_id = $1 ORDER BY start_time',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /:id/blackouts
router.post('/:id/blackouts', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, reason, notes } = req.body;
    if (!start_date || !reason) {
      return res
        .status(400)
        .json({ success: false, error: 'start_date and reason are required' });
    }

    const startTs = `${start_date} 00:00:00+00`;
    const endTs = `${end_date || start_date} 23:59:59+00`;

    const result = await pool.query(
      `INSERT INTO vehicle_blackouts
       (vehicle_id, start_time, end_time, reason, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, startTs, endTs, reason, notes || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /blackouts/:blackoutId
router.delete('/blackouts/:blackoutId', async (req, res, next) => {
  try {
    const { blackoutId } = req.params;
    const result = await pool.query(
      'DELETE FROM vehicle_blackouts WHERE id = $1 RETURNING id',
      [blackoutId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Blackout not found' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/vehicles/:id
 * @desc    Get vehicle by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
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
