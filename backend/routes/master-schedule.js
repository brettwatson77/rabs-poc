/**
 * Master Schedule Routes
 * 
 * Endpoints for the Master Schedule view, showing program/event cards (loom instances)
 * generated from Wall templates + Calendar entries
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
 * @route   GET /api/v1/master-schedule/instances
 * @desc    Get loom instances (program cards) for a date range
 * @access  Public
 */
router.get('/instances', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: startDate, endDate'
      });
    }
    
    // Get loom instances with program and venue details
    const result = await pool.query(
      `SELECT li.*, 
              p.name as program_name, 
              p.staff_ratio,
              v.name as venue_name,
              v.address as venue_address,
              COUNT(pp.participant_id) as participant_count
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       LEFT JOIN program_participants pp ON p.id = pp.program_id
       WHERE li.date BETWEEN $1 AND $2
       GROUP BY li.id, p.name, p.staff_ratio, v.name, v.address
       ORDER BY li.date, li.id`,
      [startDate, endDate]
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
 * @route   GET /api/v1/master-schedule/instances/:id
 * @desc    Get detailed information for a specific loom instance
 * @access  Public
 */
router.get('/instances/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get basic instance info
    const instanceResult = await pool.query(
      `SELECT li.*, 
              p.name as program_name, 
              p.staff_ratio,
              v.name as venue_name,
              v.address as venue_address
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       WHERE li.id = $1`,
      [id]
    );
    
    if (instanceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program instance not found'
      });
    }
    
    const instance = instanceResult.rows[0];
    
    // Get participants assigned to this program
    const participantsResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.photo_url, 
              bc.name as billing_code_name, bc.ndis_number
       FROM participants p
       JOIN program_participants pp ON p.id = pp.participant_id
       LEFT JOIN billing_codes bc ON pp.billing_code_id = bc.id
       WHERE pp.program_id = $1`,
      [instance.program_id]
    );
    
    // Get time slots for this program
    const timeSlotsResult = await pool.query(
      `SELECT * FROM tgl_loom_time_slots 
       WHERE program_id = $1
       ORDER BY start_time`,
      [instance.program_id]
    );
    
    // Get calendar entries (intentions) affecting this instance
    const intentionsResult = await pool.query(
      `SELECT * FROM tgl_operator_intents
       WHERE date = $1 AND metadata->>'program_id' = $2
       ORDER BY created_at DESC`,
      [instance.date, instance.program_id.toString()]
    );
    
    // Combine all data
    const responseData = {
      ...instance,
      participants: participantsResult.rows,
      timeSlots: timeSlotsResult.rows,
      intentions: intentionsResult.rows
    };
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/master-schedule/generate
 * @desc    Trigger loom generation for a date range
 * @access  Public
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { startDate, endDate, programId } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: startDate, endDate'
      });
    }
    
    // Log the regeneration request
    await pool.query(
      `INSERT INTO system_logs (level, message, source, details)
       VALUES ($1, $2, $3, $4)`,
      ['info', 'Loom regeneration triggered', 'master-schedule', { 
        startDate, 
        endDate, 
        programId: programId || 'all',
        triggeredBy: req.body.triggeredBy || 'api'
      }]
    );
    
    // If programId is provided, regenerate only that program's instances
    let result;
    if (programId) {
      // Delete existing instances for this program in the date range
      await pool.query(
        `DELETE FROM tgl_loom_instances 
         WHERE date BETWEEN $1 AND $2 AND program_id = $3`,
        [startDate, endDate, programId]
      );
      
      // Get program details
      const programResult = await pool.query(
        `SELECT * FROM programs WHERE id = $1`,
        [programId]
      );
      
      if (programResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Program not found'
        });
      }
      
      const program = programResult.rows[0];
      
      // Generate new instances based on program template
      result = await generateProgramInstances(program, startDate, endDate);
    } else {
      // Regenerate all programs in the date range
      
      // Delete existing instances in the date range
      await pool.query(
        `DELETE FROM tgl_loom_instances 
         WHERE date BETWEEN $1 AND $2`,
        [startDate, endDate]
      );
      
      // Get all active programs
      const programsResult = await pool.query(
        `SELECT * FROM programs 
         WHERE (end_date IS NULL OR end_date >= $1)`,
        [startDate]
      );
      
      // Generate instances for each program
      const generatedInstances = [];
      for (const program of programsResult.rows) {
        const instances = await generateProgramInstances(program, startDate, endDate);
        generatedInstances.push(...instances);
      }
      
      result = generatedInstances;
    }
    
    res.status(201).json({
      success: true,
      message: 'Loom instances generated successfully',
      data: {
        instanceCount: result.length,
        dateRange: { startDate, endDate },
        programId: programId || 'all'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/master-schedule/calendar
 * @desc    Get calendar view with instances
 * @access  Public
 */
router.get('/calendar', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: year, month'
      });
    }
    
    // Calculate start and end dates for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
    
    // Get all loom instances for the month
    const instancesResult = await pool.query(
      `SELECT li.id, li.date, li.program_id, li.status,
              p.name as program_name,
              v.name as venue_name,
              COUNT(pp.participant_id) as participant_count
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       LEFT JOIN program_participants pp ON p.id = pp.program_id
       WHERE li.date BETWEEN $1 AND $2
       GROUP BY li.id, li.date, li.program_id, li.status, p.name, v.name
       ORDER BY li.date, p.name`,
      [startDate, endDate]
    );
    
    // Get calendar entries (intentions) for the month
    const intentionsResult = await pool.query(
      `SELECT * FROM tgl_operator_intents
       WHERE date BETWEEN $1 AND $2
       ORDER BY date, created_at`,
      [startDate, endDate]
    );
    
    // Group instances by date
    const calendarData = {};
    instancesResult.rows.forEach(instance => {
      const dateStr = instance.date.toISOString().split('T')[0];
      if (!calendarData[dateStr]) {
        calendarData[dateStr] = {
          date: dateStr,
          instances: [],
          intentions: []
        };
      }
      calendarData[dateStr].instances.push(instance);
    });
    
    // Add intentions to dates
    intentionsResult.rows.forEach(intention => {
      const dateStr = intention.date.toISOString().split('T')[0];
      if (!calendarData[dateStr]) {
        calendarData[dateStr] = {
          date: dateStr,
          instances: [],
          intentions: []
        };
      }
      calendarData[dateStr].intentions.push(intention);
    });
    
    res.json({
      success: true,
      data: Object.values(calendarData),
      meta: {
        year: parseInt(year),
        month: parseInt(month),
        startDate,
        endDate
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to generate program instances
 * @param {Object} program - Program template
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Generated instances
 */
async function generateProgramInstances(program, startDate, endDate) {
  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get days of week for the program (e.g., [1, 3, 5] for Mon, Wed, Fri)
  const daysOfWeek = program.days_of_week || [];
  
  // Generate instances for each applicable date in the range
  const instances = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if this day of week matches the program schedule
    if (daysOfWeek.includes(dayOfWeek)) {
      // Create instance for this date
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        const result = await pool.query(
          `INSERT INTO tgl_loom_instances 
           (program_id, date, status, metadata)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [program.id, dateStr, 'active', {}]
        );
        
        instances.push(result.rows[0]);
      } catch (error) {
        console.error(`Error creating instance for ${dateStr}:`, error);
        // Continue with next date even if this one fails
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return instances;
}

module.exports = router;
