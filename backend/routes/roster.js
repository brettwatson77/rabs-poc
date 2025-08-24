/**
 * Roster Routes
 * 
 * Endpoints for roster management:
 * - GET /api/v1/roster/day - Get roster for a specific day
 */

const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/v1/roster/day
 * @desc    Get roster for a specific day with instances and staff directory
 * @access  Public
 * @query   date - Date in YYYY-MM-DD format
 * @returns { date, instances, staff_directory }
 */
router.get('/day', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { date } = req.query;
    
    // Validate date parameter
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'date parameter is required (YYYY-MM-DD format)'
      });
    }
    
    // Fetch settings for staff and vehicle calculations
    const settingsResult = await pool.query(`
      SELECT key, value FROM settings
      WHERE key IN ('staff_threshold_per_wpu', 'default_bus_capacity')
    `);
    
    // Extract settings with fallbacks
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    // Use fallbacks if settings not found
    const staffThreshold = Number(settings.staff_threshold_per_wpu) || 5;
    const busCapacity = Number(settings.default_bus_capacity) || 10;
    
    // Fetch instances for the day
    const instancesResult = await pool.query(`
      SELECT li.id as instance_id, 
             li.source_rule_id, 
             rp.name as program_name
      FROM loom_instances li
      JOIN rules_programs rp ON li.source_rule_id = rp.id
      WHERE li.instance_date = $1
    `, [date]);
    
    // Process each instance to add required data
    const instancesPromises = instancesResult.rows.map(async (instance) => {
      // Count participants for this instance
      const participantsResult = await pool.query(`
        SELECT COUNT(*) as participant_count
        FROM rules_participant_schedule
        WHERE program_id = $1
          AND start_date <= $2
          AND (end_date IS NULL OR end_date >= $2)
      `, [instance.source_rule_id, date]);
      
      const participantCount = parseInt(participantsResult.rows[0].participant_count) || 0;
      
      // Calculate staff and vehicle requirements
      const staffRequired = Math.ceil(participantCount / staffThreshold);
      const vehiclesRequired = Math.ceil(participantCount / busCapacity);
      
      return {
        instance_id: instance.instance_id,
        program_name: instance.program_name,
        staff_required: staffRequired,
        vehicles_required: vehiclesRequired,
        assignments: {
          staff: [],
          vehicles: []
        }
      };
    });
    
    // Wait for all instance processing to complete
    const instances = await Promise.all(instancesPromises);
    
    // Fetch staff directory
    const staffResult = await pool.query(`
      SELECT id, first_name, last_name, active
      FROM staff
      ORDER BY last_name, first_name
    `);
    
    // Return the complete roster data
    res.json({
      success: true,
      data: {
        date,
        instances,
        staff_directory: staffResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching roster day:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roster day',
      message: error.message
    });
  }
});

module.exports = router;
