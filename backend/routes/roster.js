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
    
    // --------------------------------------------------------------
    // 1. Fetch all loom instances for the day with extra fields
    // --------------------------------------------------------------
    const instancesResult = await pool.query(
      `SELECT 
         li.id            AS instance_id,
         li.source_rule_id,
         li.start_time,
         li.end_time,
         rp.name          AS program_name,
         v.name           AS venue_name
       FROM loom_instances li
       JOIN rules_programs rp ON li.source_rule_id = rp.id
       LEFT JOIN venues v      ON rp.venue_id      = v.id
      WHERE li.instance_date = $1`,
      [date]
    );

    const instancesRaw = instancesResult.rows;

    // Guard: quick exit when no instances
    if (instancesRaw.length === 0) {
      const staffResult = await pool.query(
        `SELECT id, first_name, last_name, active
           FROM staff
          ORDER BY last_name, first_name`
      );
      return res.json({
        success: true,
        data: {
          date,
          instances: [],
          shifts: [],
          staff_directory: staffResult.rows,
        },
      });
    }

    // --------------------------------------------------------------
    // 2. Bulk-fetch placeholders for all rule_ids in this date
    // --------------------------------------------------------------
    const ruleIds = [
      ...new Set(instancesRaw.map((r) => r.source_rule_id)),
    ];
    const phRes = await pool.query(
      `SELECT id,
              rule_id,
              slot_index,
              mode,
              staff_id
         FROM rules_program_staff_placeholders
        WHERE rule_id = ANY($1::uuid[])
        ORDER BY slot_index ASC`,
      [ruleIds]
    );
    const placeholders = phRes.rows;

    // Collect staff_ids to name-map later
    const staffIdsSet = new Set(
      placeholders.filter((p) => p.staff_id).map((p) => p.staff_id)
    );

    // --------------------------------------------------------------
    // 3. Bulk staff name lookup for any referenced staff
    // --------------------------------------------------------------
    let staffNameMap = {};
    if (staffIdsSet.size) {
      const staffIdsArr = [...staffIdsSet];
      const sRes = await pool.query(
        `SELECT id,
                first_name,
                last_name
           FROM staff
          WHERE id = ANY($1::uuid[])`,
        [staffIdsArr]
      );
      staffNameMap = sRes.rows.reduce((map, s) => {
        map[s.id] = `${s.first_name || ''} ${s.last_name || ''}`.trim();
        return map;
      }, {});
    }

    // --------------------------------------------------------------
    // 4. Build instances array (with requirements) and shifts array
    // --------------------------------------------------------------
    const shifts = [];
    const instances = [];

    for (const inst of instancesRaw) {
      try {
        // participant count for requirements
        const pcRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt
             FROM rules_program_participants
            WHERE rule_id = $1`,
          [inst.source_rule_id]
        );
        const participantCount = pcRes.rows[0]?.cnt || 0;
        const staffRequired = Math.ceil(participantCount / staffThreshold);
        const vehiclesRequired = Math.ceil(participantCount / busCapacity);

        instances.push({
          instance_id: inst.instance_id,
          program_name: inst.program_name,
          staff_required: staffRequired,
          vehicles_required: vehiclesRequired,
          start_time: inst.start_time,
          end_time: inst.end_time,
          venue_name: inst.venue_name,
        });

        // Filter placeholders for this rule
        const phForRule = placeholders.filter(
          (p) => p.rule_id === inst.source_rule_id
        );

        if (phForRule.length > 0) {
          phForRule.forEach((p, idx) => {
            const status =
              p.mode === 'manual' && p.staff_id
                ? 'assigned'
                : p.mode === 'open' || (p.mode === 'manual' && !p.staff_id)
                ? 'open'
                : 'auto';
            shifts.push({
              shift_id: p.id || `${inst.instance_id}-${idx}`,
              instance_id: inst.instance_id,
              rule_id: inst.source_rule_id,
              program_name: inst.program_name,
              venue_name: inst.venue_name,
              start_time: inst.start_time,
              end_time: inst.end_time,
              status,
              staff_id: p.staff_id || null,
              staff_name: p.staff_id ? staffNameMap[p.staff_id] || null : null,
            });
          });
        } else {
          // No placeholders – synthesise auto shifts
          for (let i = 0; i < staffRequired; i++) {
            shifts.push({
              shift_id: `${inst.instance_id}-auto-${i}`,
              instance_id: inst.instance_id,
              rule_id: inst.source_rule_id,
              program_name: inst.program_name,
              venue_name: inst.venue_name,
              start_time: inst.start_time,
              end_time: inst.end_time,
              status: 'auto',
              staff_id: null,
              staff_name: null,
            });
          }
        }
      } catch (innerErr) {
        console.error(
          `Roster processing error for instance ${inst.instance_id}:`,
          innerErr.message
        );
      }
    }
    
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
        shifts,                    // include built shift objects
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
