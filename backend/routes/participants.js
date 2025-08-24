/**
 * Participants Routes
 * 
 * Filing Cabinet component - Reference data for participants
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
 * @route   GET /api/v1/participants
 * @desc    Get all participants
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Return thin list per spec – id, first_name, last_name, active only
    const result = await pool.query(
      `SELECT id, first_name, last_name, active
         FROM participants
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
 * @route   GET /api/v1/participants/:id
 * @desc    Get participant by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
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
 * PATCH /api/v1/participants/:id
 * ---------------------------------------------------------------------------
 * Dynamically update a participant. Only whitelisted fields are accepted.
 * Body may include any subset of the allowed keys.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Whitelist of updatable columns
    const allowedFields = [
      'first_name',
      'last_name',
      'phone',
      'email',
      'address',
      'suburb',
      'state',
      'postcode',
      'notes',
      'supervision_multiplier',
      'has_wheelchair_access',
      'has_dietary_requirements',
      'has_medical_requirements',
      'has_behavioral_support',
      'has_visual_impairment',
      'has_hearing_impairment',
      'has_cognitive_support',
      'has_communication_needs'
    ];

    const fields = Object.keys(req.body || {}).filter((k) =>
      allowedFields.includes(k)
    );

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields supplied for update'
      });
    }

    // Build dynamic UPDATE query
    const setFragments = fields.map((f, idx) => `${f} = $${idx + 2}`);
    const values = fields.map((f) => req.body[f]);

    const updateSql = `
      UPDATE participants
      SET ${setFragments.join(', ')},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`;

    const result = await pool.query(updateSql, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * ---------------------------------------------------------------------------
 * GET /api/v1/participants/:id/enrollments
 * ---------------------------------------------------------------------------
 * Returns current enrollments for the participant and a list of all available
 * active programs to aid the planner UI.
 */
router.get('/:id/enrollments', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Current enrollments
    const enrollRes = await pool.query(
      `SELECT pp.*, p.name AS program_name, p.day_of_week, p.start_time, p.end_time
       FROM program_participants pp
       JOIN programs p ON pp.program_id = p.id
       WHERE pp.participant_id = $1
         AND pp.status = 'active'`,
      [id]
    );

    // All active programs
    const programsRes = await pool.query(
      `SELECT id, name, day_of_week, start_time, end_time
       FROM programs
       WHERE active = true
       ORDER BY name`
    );

    res.json({
      success: true,
      enrollments: enrollRes.rows,
      availablePrograms: programsRes.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ---------------------------------------------------------------------------
 * POST /api/v1/participants/:id/enrollments
 * ---------------------------------------------------------------------------
 * Accepts array of enrollment changes and inserts them into
 * pending_enrollment_changes for later processing.
 * Body: { changes: [ { program_id, action, effectiveDate } ] }
 */
router.post('/:id/enrollments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { changes } = req.body || {};

    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Body must include changes array with at least one item'
      });
    }

    const insertedIds = [];
    for (const change of changes) {
      const { program_id, action, effectiveDate } = change;

      if (!program_id || !['add', 'remove'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Each change must include program_id and action (add/remove)'
        });
      }

      const effDate =
        effectiveDate && !isNaN(Date.parse(effectiveDate))
          ? effectiveDate
          : new Date().toISOString().split('T')[0];

      const insertRes = await pool.query(
        `INSERT INTO pending_enrollment_changes
         (participant_id, program_id, action, effective_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [id, program_id, action, effDate]
      );

      insertedIds.push(insertRes.rows[0].id);
    }

    res.status(201).json({
      success: true,
      inserted: insertedIds.length,
      ids: insertedIds
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ---------------------------------------------------------------------------
 * POST /api/v1/participants/:id/goals
 * ---------------------------------------------------------------------------
 * Placeholder – not yet implemented.
 */
router.post('/:id/goals', (req, res) => {
  res.status(501).json({ success: false, error: 'Goal creation not implemented yet' });
});

/**
 * ---------------------------------------------------------------------------
 * POST /api/v1/participants/:id/billing-codes
 * ---------------------------------------------------------------------------
 * Placeholder – not yet implemented.
 */
router.post('/:id/billing-codes', (req, res) => {
  res.status(501).json({ success: false, error: 'Billing code creation not implemented yet' });
});

module.exports = router;
