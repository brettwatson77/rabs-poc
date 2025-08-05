/**
 * Dashboard Routes
 * 
 * Endpoints for the Dashboard view, showing today's programs, staff, and vehicles
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
 * @route   GET /api/v1/dashboard/cards
 * @desc    Get dashboard cards for a specific date
 * @access  Public
 */
router.get('/cards', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    const result = await pool.query(
      `SELECT li.*, p.name as program_name, v.name as venue_name
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       WHERE li.date = $1
       ORDER BY li.id`,
      [date]
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
 * @route   GET /api/v1/dashboard/cards/:id
 * @desc    Get detailed information for a specific card
 * @access  Public
 */
router.get('/cards/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get basic instance info
    const instanceResult = await pool.query(
      `SELECT li.*, p.name as program_name, v.name as venue_name
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       WHERE li.id = $1`,
      [id]
    );
    
    if (instanceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Card not found'
      });
    }
    
    const instance = instanceResult.rows[0];
    
    // Get time slots
    const timeSlotsResult = await pool.query(
      `SELECT * FROM tgl_loom_time_slots 
       WHERE program_id = $1
       ORDER BY start_time`,
      [instance.program_id]
    );
    
    // Get participants
    const participantsResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.photo_url, pp.billing_code_id
       FROM participants p
       JOIN program_participants pp ON p.id = pp.participant_id
       WHERE pp.program_id = $1`,
      [instance.program_id]
    );
    
    // Get staff assignments
    const staffResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.photo_url, sa.role
       FROM staff s
       JOIN tgl_loom_staff_shifts sa ON s.id = sa.staff_id
       WHERE sa.loom_instance_id = $1`,
      [id]
    );
    
    // Get vehicle assignments
    const vehicleResult = await pool.query(
      `SELECT v.id, v.name, v.make, v.model, v.registration, v.fuel_type
       FROM vehicles v
       JOIN tgl_loom_vehicle_runs va ON v.id = va.vehicle_id
       WHERE va.loom_instance_id = $1`,
      [id]
    );
    
    // Combine all data
    const cardData = {
      ...instance,
      time_slots: timeSlotsResult.rows,
      participants: participantsResult.rows,
      staff: staffResult.rows,
      vehicles: vehicleResult.rows
    };
    
    res.json({
      success: true,
      data: cardData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get summary statistics for the dashboard
 * @access  Public
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    // Count programs for the day
    const programsResult = await pool.query(
      `SELECT COUNT(*) as program_count
       FROM tgl_loom_instances
       WHERE date = $1`,
      [date]
    );
    
    // Count active participants for the day
    const participantsResult = await pool.query(
      `SELECT COUNT(DISTINCT pp.participant_id) as participant_count
       FROM program_participants pp
       JOIN tgl_loom_instances li ON pp.program_id = li.program_id
       WHERE li.date = $1`,
      [date]
    );
    
    // Count staff on duty for the day
    const staffResult = await pool.query(
      `SELECT COUNT(DISTINCT sa.staff_id) as staff_count
       FROM tgl_loom_staff_shifts sa
       JOIN tgl_loom_instances li ON sa.loom_instance_id = li.id
       WHERE li.date = $1`,
      [date]
    );
    
    // Count vehicles in use for the day
    const vehicleResult = await pool.query(
      `SELECT COUNT(DISTINCT va.vehicle_id) as vehicle_count
       FROM tgl_loom_vehicle_runs va
       JOIN tgl_loom_instances li ON va.loom_instance_id = li.id
       WHERE li.date = $1`,
      [date]
    );
    
    res.json({
      success: true,
      data: {
        date,
        program_count: parseInt(programsResult.rows[0].program_count),
        participant_count: parseInt(participantsResult.rows[0].participant_count),
        staff_count: parseInt(staffResult.rows[0].staff_count),
        vehicle_count: parseInt(vehicleResult.rows[0].vehicle_count)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/alerts
 * @desc    Get alerts for the dashboard
 * @access  Public
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    // Get programs with insufficient staff (based on participant count and staff ratio)
    const staffingAlertsResult = await pool.query(
      `SELECT li.id, p.name as program_name, 
              COUNT(DISTINCT pp.participant_id) as participant_count,
              COUNT(DISTINCT sa.staff_id) as staff_count,
              p.staff_ratio
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       LEFT JOIN program_participants pp ON p.id = pp.program_id
       LEFT JOIN tgl_loom_staff_shifts sa ON li.id = sa.loom_instance_id
       WHERE li.date = $1
       GROUP BY li.id, p.name, p.staff_ratio
       HAVING COUNT(DISTINCT sa.staff_id) < CEIL(COUNT(DISTINCT pp.participant_id)::float / SUBSTRING(p.staff_ratio FROM '[0-9]+$')::float)`,
      [date]
    );
    
    // Get vehicle maintenance alerts
    const vehicleAlertsResult = await pool.query(
      `SELECT v.id, v.name, v.make, v.model, vb.reason, vb.start_date, vb.end_date
       FROM vehicles v
       JOIN vehicle_blackouts vb ON v.id = vb.vehicle_id
       WHERE $1 BETWEEN vb.start_date AND vb.end_date`,
      [date]
    );
    
    // Get staff unavailability alerts
    const staffAlertsResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, su.reason, su.start_date, su.end_date
       FROM staff s
       JOIN staff_unavailabilities su ON s.id = su.staff_id
       WHERE $1 BETWEEN su.start_date AND su.end_date`,
      [date]
    );
    
    res.json({
      success: true,
      data: {
        staffing_alerts: staffingAlertsResult.rows,
        vehicle_alerts: vehicleAlertsResult.rows,
        staff_alerts: staffAlertsResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
