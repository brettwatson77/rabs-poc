/**
 * Templates Router
 * 
 * Implements the Wall (rules/templates) API for the RABS system.
 * This router handles program templates, slots, and participant assignments.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Import the syncRethread utility
const { syncRethread } = require('../routes/util_syncRethread');

/**
 * Helper function to check if a rule is active on a specific date
 * @param {Object} ruleRow - The rule row from the database
 * @param {String} dateStr - The date string in YYYY-MM-DD format
 * @returns {Boolean} - Whether the rule is active on the given date
 */
function isRuleActiveOnDate(ruleRow, dateStr) {
  if (!ruleRow || !dateStr) return false;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  
  // Get day of week (1-7, where 1 is Monday)
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday (0) to 7
  
  // Check if the day of week matches
  if (ruleRow.day_of_week !== dayOfWeek) return false;
  
  // If week_in_cycle is defined, check week parity
  if (ruleRow.week_in_cycle !== null && ruleRow.week_in_cycle !== undefined) {
    // Get ISO week number
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay()) / 7);
    
    // Check if week parity matches (week 1 = odd weeks)
    const isOddWeek = weekNumber % 2 === 1;
    return (ruleRow.week_in_cycle === 1 && isOddWeek) || 
           (ruleRow.week_in_cycle === 2 && !isOddWeek);
  }
  
  // If week_in_cycle is not defined, treat as weekly
  return true;
}

/**
 * Load settings with fallbacks
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Object>} - Settings object with defaults if needed
 */
async function loadSettings(pool) {
  try {
    const result = await pool.query(`
      SELECT value FROM settings WHERE key = 'org'
    `);
    
    if (result.rows.length > 0 && result.rows[0].value) {
      try {
        return JSON.parse(result.rows[0].value);
      } catch (e) {
        console.warn('Failed to parse settings JSON:', e.message);
      }
    }
  } catch (err) {
    console.warn('Error loading settings:', err.message);
  }
  
  // Return defaults if settings not found or error
  return {
    staff_threshold_per_wpu: 5,
    default_bus_capacity: 10
  };
}

// POST /templates/rules - Create a new draft rule
router.post('/rules', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const result = await pool.query(`
      INSERT INTO rules_programs 
      (id, name, day_of_week, start_time, end_time, active) 
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, day_of_week, start_time, end_time, active
    `, [
      uuidv4(),
      'New Program',
      1, // Monday
      '09:30',
      '15:00',
      false // Draft status
    ]);
    
    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        status: 'draft'
      }
    });
  } catch (err) {
    console.error('Error creating draft rule:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create draft rule'
    });
  }
});

// PATCH /templates/rules/:id - Update an existing rule
router.patch('/rules/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const allowedFields = [
    'name', 
    'description', 
    'day_of_week', 
    'start_time', 
    'end_time', 
    'venue_id', 
    'transport_required', 
    'staffing_ratio', 
    'recurrence_pattern', 
    'active'
  ];
  
  // Filter request body to only include allowed fields
  const updates = {};
  let hasUpdates = false;
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
      hasUpdates = true;
    }
  });
  
  if (!hasUpdates) {
    return res.status(400).json({
      success: false,
      error: 'No valid fields to update'
    });
  }
  
  try {
    // Build dynamic query
    const setClauses = [];
    const values = [id];
    let paramCounter = 2;
    
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramCounter}`);
      values.push(value);
      paramCounter++;
    }
    
    const query = `
      UPDATE rules_programs
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating rule:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update rule'
    });
  }
});

// POST /templates/rules/:id/slots - Add slots to a rule
router.post('/rules/:id/slots', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  let slots = req.body.slots || [];
  
  // If a single slot object was provided, wrap it in an array
  if (!Array.isArray(slots) && typeof slots === 'object') {
    slots = [slots];
  }
  
  if (slots.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No slots provided'
    });
  }
  
  try {
    // First check if the rule exists
    const ruleCheck = await pool.query('SELECT id FROM rules_programs WHERE id = $1', [id]);
    
    if (ruleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const insertedSlots = [];
      
      for (const slot of slots) {
        const result = await client.query(`
          INSERT INTO rules_program_slots
          (id, rule_id, seq, slot_type, start_time, end_time, route_run_number, label)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [
          uuidv4(),
          id,
          slot.seq,
          slot.slot_type,
          slot.start_time,
          slot.end_time,
          slot.route_run_number || null,
          slot.label || null
        ]);
        
        insertedSlots.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: insertedSlots
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error adding slots:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to add slots'
    });
  }
});

// POST /templates/rules/:id/participants - Add a participant to a rule
router.post('/rules/:id/participants', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { participant_id } = req.body;
  
  if (!participant_id) {
    return res.status(400).json({
      success: false,
      error: 'participant_id is required'
    });
  }
  
  try {
    // Check if the rule exists
    const ruleCheck = await pool.query('SELECT id FROM rules_programs WHERE id = $1', [id]);
    
    if (ruleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    // Check if the participant exists
    const participantCheck = await pool.query('SELECT id FROM participants WHERE id = $1', [participant_id]);
    
    if (participantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }
    
    // Insert the participant
    const result = await pool.query(`
      INSERT INTO rules_program_participants
      (id, rule_id, participant_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [
      uuidv4(),
      id,
      participant_id
    ]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding participant:', err);
    
    // Check for unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Participant already added to this program'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add participant'
    });
  }
});

// POST /templates/rules/:id/participants/:rppId/billing - Add billing for a participant
router.post('/rules/:id/participants/:rppId/billing', async (req, res) => {
  // Placeholder endpoint for optional billing functionality
  res.json({
    success: true,
    data: {
      not_implemented: true,
      message: 'Billing functionality is optional in this POC'
    }
  });
});

// GET /templates/rules/:id/requirements - Get rule requirements
router.get('/rules/:id/requirements', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  
  try {
    // First check if requirements already exist in rules_program_requirements
    const requirementsResult = await pool.query(`
      SELECT * FROM rules_program_requirements
      WHERE rule_id = $1
    `, [id]);
    
    if (requirementsResult.rows.length > 0) {
      return res.json({
        success: true,
        data: requirementsResult.rows[0]
      });
    }
    
    // If not, compute them on the fly
    // Load settings for thresholds
    const settings = await loadSettings(pool);
    
    // Count participants
    const participantCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM rules_program_participants
      WHERE rule_id = $1
    `, [id]);
    
    const participantCount = parseInt(participantCountResult.rows[0].count, 10);
    const wpuTotal = participantCount; // In a simple implementation, WPU = participant count
    
    // Calculate required staff and vehicles
    const staffRequired = Math.ceil(wpuTotal / settings.staff_threshold_per_wpu);
    const vehiclesRequired = Math.ceil(participantCount / settings.default_bus_capacity);
    
    const requirements = {
      participant_count: participantCount,
      wpu_total: wpuTotal,
      staff_required: staffRequired,
      vehicles_required: vehiclesRequired
    };
    
    res.json({
      success: true,
      data: requirements
    });
  } catch (err) {
    console.error('Error getting requirements:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get requirements'
    });
  }
});

// POST /templates/rules/:id/finalize - Finalize a rule and trigger syncRethread
router.post('/rules/:id/finalize', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  
  try {
    // First check if the rule exists
    const ruleCheck = await pool.query('SELECT id FROM rules_programs WHERE id = $1', [id]);
    
    if (ruleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
    
    // Update the rule to active status
    await pool.query(`
      UPDATE rules_programs
      SET active = true
      WHERE id = $1
    `, [id]);
    
    // Call syncRethread with the rule ID
    const summary = await syncRethread({ ruleId: id });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('Error finalizing rule:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to finalize rule'
    });
  }
});

module.exports = router;
