/**
 * Templates Router
 * 
 * Implements the Wall (rules/templates) API for the RABS system.
 * This router handles program templates, slots, and participant assignments.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

// Import the syncRethread utility
const { syncRethread } = require('../routes/util_syncRethread');
// Import billing generator utility
const { generateBilling } = require('../routes/util_generateBilling');

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
  // -------------------------------------------------------------------
  // Organisation-level numeric defaults.  These values are used across
  // the templates router to calculate staffing / vehicle requirements.
  // -------------------------------------------------------------------
  const DEFAULTS = {
    loom_window_days: 14,
    staff_threshold_per_wpu: 5,
    vehicle_trigger_every_n_participants: 10,
    default_bus_capacity: 10, // kept for legacy fall-back paths
  };

  try {
    const keys = Object.keys(DEFAULTS);
    const { rows } = await pool.query(
      `SELECT key, value
         FROM settings
        WHERE key = ANY($1)`,
      [keys]
    );

    // Start with defaults and overwrite with any valid numeric DB values
    const merged = { ...DEFAULTS };
    rows.forEach((r) => {
      const num = Number(r.value);
      if (Number.isFinite(num) && num > 0) merged[r.key] = num;
    });

    return merged;
  } catch (err) {
    console.warn('Error loading org settings:', err.message);
    // fall back to defaults if query fails
    return { ...DEFAULTS };
  }
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
    
    // Log rule draft creation
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Rule draft created',
      entity: 'rule',
      entity_id: result.rows[0].id
    });
    
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

// GET /templates/rules/:id/slots - Fetch all slots for a rule (ordered)
router.get('/rules/:id/slots', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    // Validate the rule exists first
    const ruleCheck = await pool.query(
      'SELECT id FROM rules_programs WHERE id = $1',
      [id]
    );

    if (ruleCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Fetch slots ordered by seq then start_time
    const slotResult = await pool.query(
      `SELECT 
         id, rule_id, seq, slot_type, start_time, end_time, 
         route_run_number, label
       FROM rules_program_slots
       WHERE rule_id = $1
       ORDER BY seq ASC, start_time ASC`,
      [id]
    );

    res.json({
      success: true,
      data: slotResult.rows
    });
  } catch (err) {
    console.error('Error fetching rule slots:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch slots'
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
    'anchor_date',
    'recurrence_pattern',
    'day_of_week',
    'week_in_cycle',
    'venue_id',
    'auto_assign_staff',
    'auto_assign_vehicles',
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
  // Normalise payload: allow body.slots, raw array body, or single object
  let slots = req.body.slots || req.body;
  if (slots && !Array.isArray(slots)) {
    slots = [slots];
  }

  if (!Array.isArray(slots) || slots.length === 0) {
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
      // Determine the next sequence starting point (max(seq)+1)
      const { rows: seqRows } = await client.query(
        `SELECT COALESCE(MAX(seq), 0) AS maxseq
           FROM rules_program_slots
          WHERE rule_id = $1`,
        [id]
      );
      let nextSeq = seqRows[0]?.maxseq || 0;

      // Determine latest end_time for chronological validation
      let lastEndTime = null;
      const { rows: endRows } = await client.query(
        `SELECT end_time FROM rules_program_slots
          WHERE rule_id = $1
          ORDER BY seq DESC
          LIMIT 1`,
        [id]
      );
      if (endRows.length) lastEndTime = endRows[0].end_time; // time string
      
      for (const slot of slots) {
        // Always auto-assign seq in order
        const seqVal = ++nextSeq;

        // Validate time fields
        if (!slot.start_time || !slot.end_time) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'start_time and end_time required'
          });
        }
        if (slot.end_time <= slot.start_time) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'Slot end must be after start'
          });
        }
        if (lastEndTime && slot.start_time < lastEndTime) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: 'Slots must be chronological (new start must be >= previous end)'
          });
        }
        const result = await client.query(`
          INSERT INTO rules_program_slots
          (id, rule_id, seq, slot_type, start_time, end_time, route_run_number, label)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [
          uuidv4(),
          id,
          seqVal,
          slot.slot_type,
          slot.start_time,
          slot.end_time,
          slot.route_run_number || null,
          slot.label || null
        ]);
        
        insertedSlots.push(result.rows[0]);
        lastEndTime = slot.end_time; // advance pointer
      }
      
      await client.query('COMMIT');
      
      // Log slots added
      await logger.logEvent({
        severity: 'INFO',
        category: 'WIZARD',
        message: 'Slots added',
        entity: 'rule',
        entity_id: id,
        details: { count: insertedSlots.length }
      });
      
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
    // Ensure new preference columns exist then insert with defaults
    await pool.query(`
      ALTER TABLE rules_program_participants
        ADD COLUMN IF NOT EXISTS pickup_address_pref  text DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS dropoff_address_pref text DEFAULT 'primary'
    `);

    const result = await pool.query(`
      INSERT INTO rules_program_participants
        (id, rule_id, participant_id, pickup_address_pref, dropoff_address_pref)
      VALUES ($1, $2, $3, 'primary', 'primary')
      RETURNING *
    `, [uuidv4(), id, participant_id]);
    
    // Log participant added
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Participant added to rule',
      entity: 'rule_participant',
      entity_id: result.rows[0].id,
      details: {
        rule_id: id,
        participant_id: participant_id
      }
    });
    
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

// DELETE /templates/rules/:id/participants/:rppId - remove participant & cascade billing
router.delete('/rules/:id/participants/:rppId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id: ruleId, rppId } = req.params;

  const client = await pool.connect();
  try {
    // Validate rule exists
    if (!(await ruleExists(pool, ruleId))) {
      client.release();
      return res
        .status(404)
        .json({ success: false, error: 'Rule not found' });
    }

    // Validate participant belongs to rule
    const chk = await pool.query(
      `SELECT id FROM rules_program_participants
        WHERE id = $1 AND rule_id = $2`,
      [rppId, ruleId]
    );
    if (chk.rowCount === 0) {
      client.release();
      return res
        .status(404)
        .json({ success: false, error: 'Participant not found in rule' });
    }

    await client.query('BEGIN');

    // Cascade delete billing lines (support both possible FK columns)
    // ------------------------------------------------------------------
    // Detect which FK column(s) exist so we don't reference a missing one
    // ------------------------------------------------------------------
    const { rows: colRows } = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'rules_program_participant_billing'
          AND column_name IN ('rule_participant_id','rpp_id')`
    );
    const hasRuleParticipantId = colRows.some(
      (r) => r.column_name === 'rule_participant_id'
    );
    const hasRppId = colRows.some((r) => r.column_name === 'rpp_id');

    if (hasRuleParticipantId) {
      await client.query(
        `DELETE FROM rules_program_participant_billing
          WHERE rule_participant_id = $1`,
        [rppId]
      );
    }

    if (hasRppId) {
      await client.query(
        `DELETE FROM rules_program_participant_billing
          WHERE rpp_id = $1`,
        [rppId]
      );
    }

    // Delete participant link
    await client.query(
      `DELETE FROM rules_program_participants
        WHERE id = $1 AND rule_id = $2`,
      [rppId, ruleId]
    );

    await client.query('COMMIT');
    
    // Log participant removed
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Participant removed from rule',
      entity: 'rule_participant',
      entity_id: rppId,
      details: { rule_id: ruleId }
    });
    
    res.json({ success: true, data: { id: rppId, deleted: true } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting participant:', err);
    res
      .status(500)
      .json({ success: false, error: 'Failed to delete participant' });
  } finally {
    client.release();
  }
});

// PATCH /templates/rules/:id/participants/:rppId  - update pickup/dropoff prefs
router.patch('/rules/:id/participants/:rppId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id: ruleId, rppId } = req.params;
  const { pickup_address_pref, dropoff_address_pref } = req.body || {};

  // Quick validation of provided values
  const validVals = ['primary', 'secondary', 'none'];
  const venueRegex =
    /^venue:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/;
  if (
    pickup_address_pref !== undefined &&
    !validVals.includes(pickup_address_pref) &&
    !venueRegex.test(pickup_address_pref)
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid pickup_address_pref' });
  }
  if (
    dropoff_address_pref !== undefined &&
    !validVals.includes(dropoff_address_pref) &&
    !venueRegex.test(dropoff_address_pref)
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid dropoff_address_pref' });
  }

  if (
    pickup_address_pref === undefined &&
    dropoff_address_pref === undefined
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'No fields to update' });
  }

  try {
    // Ensure columns exist (idempotent)
    await pool.query(`
      ALTER TABLE rules_program_participants
        ADD COLUMN IF NOT EXISTS pickup_address_pref text DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS dropoff_address_pref text DEFAULT 'primary',
        ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
    `);

    // Validate rule & link existence
    if (!(await ruleExists(pool, ruleId))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    const chk = await pool.query(
      `SELECT id FROM rules_program_participants
        WHERE id = $1 AND rule_id = $2`,
      [rppId, ruleId]
    );
    if (chk.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: 'Participant link not found' });
    }

    // Build dynamic update
    const updates = [];
    const vals = [rppId];
    let idx = 2;
    if (pickup_address_pref !== undefined) {
      updates.push(`pickup_address_pref = $${idx++}`);
      vals.push(pickup_address_pref);
    }
    if (dropoff_address_pref !== undefined) {
      updates.push(`dropoff_address_pref = $${idx++}`);
      vals.push(dropoff_address_pref);
    }

    const upd = await pool.query(
      `UPDATE rules_program_participants
          SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, rule_id, participant_id, pickup_address_pref, dropoff_address_pref`,
      vals
    );

    res.json({ success: true, data: upd.rows[0] });
  } catch (err) {
    console.error('Error updating pickup/dropoff prefs:', err);
    res
      .status(500)
      .json({ success: false, error: 'Failed to update preferences' });
  }
});

// ---------------------------------------------------------------------------
//  Billing lines (view / delete) for a participant during wizard staging
// ---------------------------------------------------------------------------

// GET /templates/rules/:id/participants/:rppId/billing - list staged lines
router.get('/rules/:id/participants/:rppId/billing', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rppId } = req.params;

  try {
    const result = await pool.query(
      `SELECT b.id,
              b.rule_participant_id,
              b.billing_code_id,
              b.hours,
              b.ratio_label,
              b.unit_price,
              (b.unit_price * b.hours) AS amount,
              br.code,
              br.description
         FROM rules_program_participant_billing b
         JOIN billing_rates br ON br.id = b.billing_code_id
        WHERE b.rule_participant_id = $1
        ORDER BY b.created_at ASC`,
      [rppId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching participant billing lines:', err);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch billing lines' });
  }
});

// DELETE /templates/rules/:id/participants/:rppId/billing/:lineId - delete staged line
router.delete(
  '/rules/:id/participants/:rppId/billing/:lineId',
  async (req, res) => {
    const pool = req.app.locals.pool;
    const { rppId, lineId } = req.params;

    try {
      const del = await pool.query(
        `DELETE FROM rules_program_participant_billing
          WHERE id = $1
            AND rule_participant_id = $2
          RETURNING id`,
        [lineId, rppId]
      );

      if (del.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: 'Billing line not found' });
      }

      // Log billing line removed
      await logger.logEvent({
        severity: 'INFO',
        category: 'WIZARD',
        message: 'Billing line removed',
        entity: 'billing_line',
        entity_id: lineId
      });
      
      res.json({ success: true, data: { id: lineId, deleted: true } });
    } catch (err) {
      console.error('Error deleting participant billing line:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete billing line' });
    }
  }
);

// POST /templates/rules/:id/participants/:rppId/billing - Add billing for a participant
router.post('/rules/:id/participants/:rppId/billing', async (req, res) => {
  const pool = req.app.locals.pool;
  const { rppId } = req.params;

  // Normalise body -> lines array
  let lines = req.body.lines || req.body; // allow raw array
  if (lines && !Array.isArray(lines)) {
    lines = [lines];
  }

  // Empty payload → succeed with empty array
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.json({ success: true, data: [] });
  }

  // Validate rows
  const validLines = lines.filter(
    (l) =>
      l &&
      typeof l.billing_code === 'string' &&
      l.billing_code.trim() !== '' &&
      !isNaN(parseFloat(l.hours)) &&
      parseFloat(l.hours) > 0
  );

  if (validLines.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid billing lines supplied'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    // -------------------------------------------------------------------
    // Ensure table exists & detect schema
    // -------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS rules_program_participant_billing (
        id uuid PRIMARY KEY,
        rule_participant_id uuid,
        billing_code_id uuid,
        hours numeric(6,2),
        created_at timestamp DEFAULT now()
      );
      
      ALTER TABLE rules_program_participant_billing 
      ADD COLUMN IF NOT EXISTS ratio_label text;
      
      ALTER TABLE rules_program_participant_billing 
      ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
    `);

    const colRes = await client.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_name = 'rules_program_participant_billing'
           AND table_schema = 'public'
    `);
    const cols = colRes.rows.map(r => r.column_name);
    const hasRpp = cols.includes('rpp_id');
    const hasRulePart = cols.includes('rule_participant_id');
    const hasBillingId = cols.includes('billing_code_id');

    console.log('[TEMPLATES] Billing insert detected columns:', cols);

    /* -----------------------------------------------------------------
     * Inline FK audit / repair (idempotent)
     * Ensures billing_code_id -> billing_rates(id)
     * Some DBs still have FK to billing_codes which breaks inserts
     * ----------------------------------------------------------------*/
    try {
      // 1. find existing FK constraints on this column
      const fkQry = `
        SELECT c.conname,
               pg_get_constraintdef(c.oid, true) AS def
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = 'rules_program_participant_billing'
           AND c.contype = 'f'
           AND EXISTS (
               SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = c.conrelid
                  AND a.attnum = ANY (c.conkey)
                  AND a.attname = 'billing_code_id'
           )
      `;
      const { rows: fkRows } = await client.query(fkQry);

      let dropped = false;
      for (const r of fkRows) {
        if (r.def.includes('REFERENCES public.billing_codes')) {
          await client.query(
            `ALTER TABLE public.rules_program_participant_billing
               DROP CONSTRAINT IF EXISTS ${r.conname}`
          );
          console.log(
            `[TEMPLATES] Dropped outdated FK ${r.conname} (→ billing_codes)`
          );
          dropped = true;
        } else if (r.def.includes('REFERENCES public.billing_rates')) {
          // Correct FK already present – nothing to do
          dropped = false;
        }
      }

      // 2. (Re)create correct FK if missing
      if (dropped || fkRows.length === 0) {
        await client.query(`
          ALTER TABLE public.rules_program_participant_billing
          ADD CONSTRAINT rules_program_participant_billing_billing_code_id_fkey
          FOREIGN KEY (billing_code_id)
          REFERENCES public.billing_rates(id)
        `);
        console.log(
          '[TEMPLATES] Added FK billing_code_id → billing_rates(id)'
        );
      }
    } catch (fkErr) {
      console.warn('FK audit/repair failed in-route:', fkErr.message);
    }

    for (const line of validLines) {
      //-----------------------------------------------------------------
      // 1. Derive rateId (UUID) and ratioLabel from incoming value
      //-----------------------------------------------------------------
      const raw = (line.billing_code || '').trim();
      let rateId = null;
      let codePart = null;
      let ratioLabel = '1:1'; // Default to 1:1 if not specified
      
      // Check for option_id format: uuid-ratio (e.g. "uuid-1:2")
      const optionMatch = raw.match(
        /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})-(.+)$/
      );
      
      if (optionMatch) {
        rateId = optionMatch[1];
        ratioLabel = optionMatch[2]; // Extract ratio part (e.g. "1:2")
      } else {
        // Try to extract just UUID
        const uuidMatch = raw.match(
          /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/
        );
        if (uuidMatch) {
          rateId = uuidMatch[1];
        } else {
          codePart = raw.split(':')[0].trim();
        }
      }

      let bcId = null;
      let unitPrice = 0;

      if (rateId) {
        // Direct UUID mode - fetch the rate record to get the appropriate rate column
        const rateCheck = await client.query(
          `SELECT id, code, description, base_rate, 
                  ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4, ratio_1_5 
             FROM billing_rates 
            WHERE id = $1 
            LIMIT 1`,
          [rateId]
        );
        
        if (rateCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Billing rate '${rateId}' not found`
          });
        }
        
        bcId = rateCheck.rows[0].id;
        
        // Map ratio label to column name
        const colMap = { 
          '1:1': 'ratio_1_1',
          '1:2': 'ratio_1_2',
          '1:3': 'ratio_1_3',
          '1:4': 'ratio_1_4',
          '1:5': 'ratio_1_5' 
        };
        const col = colMap[ratioLabel] || 'ratio_1_1';
        
        // Get unit price from the appropriate column
        unitPrice = parseFloat(rateCheck.rows[0][col] || 0) || 0;
      } else {
        // Fallback: lookup by code string (most-recent first)
        const codeLookup = await client.query(
          `SELECT id, base_rate
             FROM billing_rates
            WHERE code = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1`,
          [codePart]
        );
        
        if (codeLookup.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Billing code '${codePart}' not found`
          });
        }
        
        bcId = codeLookup.rows[0].id;
        unitPrice = parseFloat(codeLookup.rows[0].base_rate || 0) || 0;
      }

      if (hasRpp) {
        // Mode A – original schema
        const result = await client.query(
          `INSERT INTO rules_program_participant_billing
            (id, rpp_id, billing_code, hours)
           VALUES ($1, $2, $3, $4)
           RETURNING id, rpp_id AS link_id, billing_code, hours`,
          [uuidv4(), rppId, line.billing_code.trim(), parseFloat(line.hours)]
        );
        inserted.push(result.rows[0]);
      } else if (hasRulePart && hasBillingId) {
        // Mode B – newer schema with FK to billing_rates
        const result = await client.query(
          `INSERT INTO rules_program_participant_billing
            (id, rule_participant_id, billing_code_id, hours, ratio_label, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, rule_participant_id AS link_id, billing_code_id, hours, ratio_label, unit_price`,
          [uuidv4(), rppId, bcId, parseFloat(line.hours), ratioLabel, unitPrice]
        );
        inserted.push(result.rows[0]);
      } else {
        // Unsupported / unknown schema variant
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Unsupported billing table schema'
        });
      }
    }

    await client.query('COMMIT');
    
    // Log billing lines added
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Billing lines added',
      entity: 'rule_participant',
      entity_id: rppId,
      details: { count: inserted.length }
    });
    
    res.json({ success: true, data: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inserting billing lines:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to add billing lines'
    });
  } finally {
    client.release();
  }
});

/** -----------------------------------------------------------------------
 *  Placeholders (Staff & Vehicles)
 *  Tables:
 *    rules_program_staff_placeholders
 *    rules_program_vehicle_placeholders
 *  Endpoints implement simple CRUD for wizard v2.1
 * ----------------------------------------------------------------------*/

// Helper: check rule exists
async function ruleExists(pool, ruleId) {
  const chk = await pool.query(`SELECT id FROM rules_programs WHERE id = $1`, [
    ruleId,
  ]);
  return chk.rowCount > 0;
}

// ------------------------ STAFF PLACEHOLDERS ---------------------------

// GET
router.get('/rules/:id/staff-placeholders', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    if (!(await ruleExists(pool, id))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const result = await pool.query(
      `SELECT id, rule_id, slot_index, mode, staff_id, created_at
         FROM rules_program_staff_placeholders
        WHERE rule_id = $1
        ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching staff placeholders:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch placeholders' });
  }
});

// POST
router.post('/rules/:id/staff-placeholders', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { mode = 'auto', staff_id = null, slot_index = 0 } = req.body || {};

  try {
    if (!(await ruleExists(pool, id))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (!['auto', 'manual', 'open'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Invalid mode' });
    }
    
    if (mode === 'manual' && !staff_id) {
      return res
        .status(400)
        .json({ success: false, error: 'staff_id required for manual mode' });
    }

    const result = await pool.query(
      `INSERT INTO rules_program_staff_placeholders
        (id, rule_id, slot_index, mode, staff_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rule_id, slot_index, mode, staff_id, created_at`,
      [uuidv4(), id, slot_index, mode, mode === 'manual' ? staff_id : null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error inserting staff placeholder:', err);
    res.status(500).json({ success: false, error: 'Failed to add placeholder' });
  }
});

// DELETE
router.delete(
  '/rules/:id/staff-placeholders/:phId',
  async (req, res) => {
    const pool = req.app.locals.pool;
    const { id, phId } = req.params;

    try {
      if (!(await ruleExists(pool, id))) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      const del = await pool.query(
        `DELETE FROM rules_program_staff_placeholders
          WHERE id = $1 AND rule_id = $2
          RETURNING id`,
        [phId, id]
      );

      if (del.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: 'Placeholder not found' });
      }

      res.json({ success: true, data: { id: phId, deleted: true } });
    } catch (err) {
      console.error('Error deleting staff placeholder:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete placeholder' });
    }
  }
);

// ------------------------ VEHICLE PLACEHOLDERS -------------------------

router.get('/rules/:id/vehicle-placeholders', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  try {
    if (!(await ruleExists(pool, id))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // Ensure pc_participant_ids column exists
    await pool.query(`
      ALTER TABLE rules_program_vehicle_placeholders 
      ADD COLUMN IF NOT EXISTS pc_participant_ids uuid[] DEFAULT '{}'::uuid[]
    `);
    /* --------------------------------------------------------------
     * Repair mode CHECK constraint so it also allows 'pc'
     * (older DB may only allow 'auto' & 'manual')
     * ------------------------------------------------------------ */
    try {
      await pool.query(`
        ALTER TABLE rules_program_vehicle_placeholders
        DROP CONSTRAINT IF EXISTS rules_program_vehicle_placeholders_mode_check;
      `);
      await pool.query(`
        ALTER TABLE rules_program_vehicle_placeholders
        ADD CONSTRAINT rules_program_vehicle_placeholders_mode_check
        CHECK (mode IN ('auto','manual','pc'));
      `);
    } catch (e) {
      console.warn(
        '[TEMPLATES] Could not repair vehicle placeholders mode check:',
        e.message
      );
    }

    const result = await pool.query(
      `SELECT id, rule_id, slot_index, mode, vehicle_id, pc_participant_ids, created_at
         FROM rules_program_vehicle_placeholders
        WHERE rule_id = $1
        ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching vehicle placeholders:', err);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch placeholders' });
  }
});

router.post('/rules/:id/vehicle-placeholders', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  const { 
    mode = 'auto', 
    vehicle_id = null, 
    slot_index = 0,
    pc_participant_ids = []
  } = req.body || {};

  try {
    if (!(await ruleExists(pool, id))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (!['auto', 'manual', 'pc'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Invalid mode' });
    }
    
    if (mode === 'manual' && !vehicle_id) {
      return res
        .status(400)
        .json({ success: false, error: 'vehicle_id required for manual mode' });
    }

    // Ensure pc_participant_ids column exists
    await pool.query(`
      ALTER TABLE rules_program_vehicle_placeholders 
      ADD COLUMN IF NOT EXISTS pc_participant_ids uuid[] DEFAULT '{}'::uuid[]
    `);

    const result = await pool.query(
      `INSERT INTO rules_program_vehicle_placeholders
        (id, rule_id, slot_index, mode, vehicle_id, pc_participant_ids)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, rule_id, slot_index, mode, vehicle_id, pc_participant_ids, created_at`,
      [
        uuidv4(), 
        id, 
        slot_index, 
        mode, 
        mode === 'manual' ? vehicle_id : null,
        mode === 'pc' ? pc_participant_ids : null
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error inserting vehicle placeholder:', err);
    res.status(500).json({ success: false, error: 'Failed to add placeholder' });
  }
});

// PATCH - Update vehicle placeholder
router.patch('/rules/:id/vehicle-placeholders/:phId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id, phId } = req.params;
  const { 
    mode,
    vehicle_id,
    pc_participant_ids
  } = req.body || {};

  try {
    if (!(await ruleExists(pool, id))) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // Ensure pc_participant_ids column exists
    await pool.query(`
      ALTER TABLE rules_program_vehicle_placeholders 
      ADD COLUMN IF NOT EXISTS pc_participant_ids uuid[] DEFAULT '{}'::uuid[]
    `);

    // Check if placeholder exists
    const checkResult = await pool.query(
      `SELECT id FROM rules_program_vehicle_placeholders
       WHERE id = $1 AND rule_id = $2`,
      [phId, id]
    );

    if (checkResult.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Vehicle placeholder not found' 
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [phId, id];
    let paramIndex = 3;

    if (mode !== undefined) {
      if (!['auto', 'manual', 'pc'].includes(mode)) {
        return res.status(400).json({ success: false, error: 'Invalid mode' });
      }
      updates.push(`mode = $${paramIndex++}`);
      values.push(mode);
    }

    if (vehicle_id !== undefined) {
      updates.push(`vehicle_id = $${paramIndex++}`);
      values.push(vehicle_id);
    }

    if (pc_participant_ids !== undefined) {
      updates.push(`pc_participant_ids = $${paramIndex++}`);
      values.push(pc_participant_ids);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    const result = await pool.query(
      `UPDATE rules_program_vehicle_placeholders
       SET ${updates.join(', ')}
       WHERE id = $1 AND rule_id = $2
       RETURNING id, rule_id, slot_index, mode, vehicle_id, pc_participant_ids, created_at`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating vehicle placeholder:', err);
    res.status(500).json({ success: false, error: 'Failed to update placeholder' });
  }
});

router.delete(
  '/rules/:id/vehicle-placeholders/:phId',
  async (req, res) => {
    const pool = req.app.locals.pool;
    const { id, phId } = req.params;

    try {
      if (!(await ruleExists(pool, id))) {
        return res.status(404).json({ success: false, error: 'Rule not found' });
      }

      const del = await pool.query(
        `DELETE FROM rules_program_vehicle_placeholders
          WHERE id = $1 AND rule_id = $2
          RETURNING id`,
        [phId, id]
      );

      if (del.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, error: 'Placeholder not found' });
      }

      res.json({ success: true, data: { id: phId, deleted: true } });
    } catch (err) {
      console.error('Error deleting vehicle placeholder:', err);
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete placeholder' });
    }
  }
);

// GET /templates/rules/:id/requirements - Get rule requirements
router.get('/rules/:id/requirements', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;
  
  try {
    // Always load org-level thresholds first – needed for normalization
    const settings = await loadSettings(pool);

    /* ------------------------------------------------------------------
     * Always compute requirements live from current DB state
     * -----------------------------------------------------------------*/
    const liveRes = await pool.query(
      `SELECT COUNT(*)::int AS participant_count,
              COALESCE(SUM(p.supervision_multiplier),0)::numeric AS wpu_total
         FROM rules_program_participants rpp
         JOIN participants p ON p.id = rpp.participant_id
        WHERE rpp.rule_id = $1`,
      [id]
    );

    const participantCount = liveRes.rows[0].participant_count || 0;
    const wpuTotal = parseFloat(liveRes.rows[0].wpu_total) || 0;

    // Calculate requirements using live settings (with sane fallbacks)
    const staffDivisor =
      settings.staff_threshold_per_wpu > 0
        ? settings.staff_threshold_per_wpu
        : 5;
    const vehicleDivisor =
      settings.vehicle_trigger_every_n_participants > 0
        ? settings.vehicle_trigger_every_n_participants
        : 10;

    const staffRequired = Math.ceil(wpuTotal / staffDivisor);
    const vehiclesRequired = Math.ceil(participantCount / vehicleDivisor);

    const requirements = {
      participant_count: participantCount,
      wpu_total: wpuTotal,
      staff_required: staffRequired,
      vehicles_required: vehiclesRequired,
      staff_threshold_per_wpu: settings.staff_threshold_per_wpu,
      vehicle_trigger_every_n_participants:
        settings.vehicle_trigger_every_n_participants,
    };
    
    /* ------------------------------------------------------------------
     * Upsert into cache table so other subsystems can read quickly
     * -----------------------------------------------------------------*/
    await pool.query(
      `INSERT INTO rules_program_requirements
        (rule_id, participant_count, wpu_total, staff_required, vehicles_required, computed_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (rule_id) DO UPDATE
         SET participant_count = EXCLUDED.participant_count,
             wpu_total        = EXCLUDED.wpu_total,
             staff_required   = EXCLUDED.staff_required,
             vehicles_required= EXCLUDED.vehicles_required,
             computed_at      = now()`,
      [id, participantCount, wpuTotal, staffRequired, vehiclesRequired]
    );

    // Log requirements calculated (live computation)
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Requirements calculated',
      entity: 'rule',
      entity_id: id,
      details: requirements
    });
    
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

    /* ------------------------------------------------------------------
     * Validation: if there are ZERO organisational vehicles we must
     * ensure every participant is assigned to some personal car.
     * ------------------------------------------------------------------*/
    // 1. Load all vehicle placeholders for this rule
    const { rows: vrows } = await pool.query(
      `SELECT mode, pc_participant_ids
         FROM rules_program_vehicle_placeholders
        WHERE rule_id = $1`,
      [id]
    );

    const orgVehicleCount = vrows.filter((r) => r.mode !== 'pc').length;

    if (orgVehicleCount === 0) {
      // Build set of participant ids assigned to any PC
      const assignedSet = new Set();
      vrows.forEach((r) => {
        if (r.mode === 'pc' && Array.isArray(r.pc_participant_ids)) {
          r.pc_participant_ids.forEach((pid) => assignedSet.add(pid));
        }
      });

      // Fetch all participants linked to this rule
      const { rows: prows } = await pool.query(
        `SELECT participant_id
           FROM rules_program_participants
          WHERE rule_id = $1`,
        [id]
      );

      const missing = prows.filter(
        (p) => !assignedSet.has(p.participant_id)
      );

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `${missing.length} participant(s) are not assigned to a personal car while there are no organisational vehicles`
        });
      }
    }
    
    // Update the rule to active status
    await pool.query(`
      UPDATE rules_programs
      SET active = true
      WHERE id = $1
    `, [id]);
    
    // Call syncRethread with the rule ID
    const summary = await syncRethread({ ruleId: id }, pool);

    /* --------------------------------------------------------------
     * Billing generation—produce payment_diamonds for the same window
     * ------------------------------------------------------------ */
    const settings = await loadSettings(pool);
    const windowDays =
      Number(settings.loom_window_days) && settings.loom_window_days > 0
        ? Number(settings.loom_window_days)
        : 14;

    // Helper to format date → YYYY-MM-DD
    const fmt = (d) => d.toISOString().split('T')[0];
    const tomorrow = (() => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return t;
    })();
    const dateFrom = fmt(tomorrow);
    const end = new Date(tomorrow);
    end.setDate(end.getDate() + windowDays - 1);
    const dateTo = fmt(end);

    const billing = await generateBilling(
      { ruleId: id, dateFrom, dateTo },
      pool
    );
    
    // Log rule finalized
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Rule finalized',
      entity: 'rule',
      entity_id: id,
      details: { summary, billing }
    });
    
    res.json({
      success: true,
      data: { summary, billing }
    });
  } catch (err) {
    console.error('Error finalizing rule:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to finalize rule'
    });
  }
});

// DELETE /templates/rules/:id/slots/:slotId - Remove a slot from a rule
router.delete('/rules/:id/slots/:slotId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id, slotId } = req.params;

  try {
    // Ensure slot belongs to rule for safety
    const check = await pool.query(
      // Fetch both id and seq so we can cascade-delete all subsequent slots
      `SELECT id, seq 
         FROM rules_program_slots 
        WHERE id = $1 
          AND rule_id = $2`,
      [slotId, id]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found for this rule'
      });
    }

    const seqToDelete = check.rows[0].seq;
    const del = await pool.query(
      `DELETE FROM rules_program_slots
        WHERE rule_id = $1
          AND seq >= $2`,
      [id, seqToDelete]
    );
    
    // Log slots deleted
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Slots deleted from sequence',
      entity: 'rule',
      entity_id: id,
      details: {
        rule_id: id,
        from_seq: seqToDelete,
        deleted_count: del.rowCount
      }
    });

    return res.json({
      success: true,
      data: { cascade: true, deleted_count: del.rowCount }
    });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete slot'
    });
  }
});

/* ---------------------------------------------------------------------------
 * DELETE /templates/rules/:id
 * Permanently delete a rule and all related staging artefacts
 * -------------------------------------------------------------------------*/
router.delete('/rules/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate rule exists
    const chk = await client.query(
      `SELECT id FROM rules_programs WHERE id = $1`,
      [id]
    );
    if (chk.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // 2. Delete event_card_map rows via loom_instances join
    await client.query(
      `DELETE FROM event_card_map
        WHERE loom_instance_id IN (
          SELECT id FROM loom_instances WHERE source_rule_id = $1
        )`,
      [id]
    );

    // 3. Delete loom_instances
    await client.query(
      `DELETE FROM loom_instances WHERE source_rule_id = $1`,
      [id]
    );

    // 4. Gather participant link ids (needed for staged billing variants)
    const { rows: rppRows } = await client.query(
      `SELECT id FROM rules_program_participants WHERE rule_id = $1`,
      [id]
    );
    const rppIds = rppRows.map((r) => r.id);

    if (rppIds.length) {
      // Determine column presence for billing table
      const { rows: colRows } = await client.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_name = 'rules_program_participant_billing'
            AND column_name IN ('rule_participant_id','rpp_id')`
      );
      const hasRuleParticipantId = colRows.some(
        (r) => r.column_name === 'rule_participant_id'
      );
      const hasRppId = colRows.some((r) => r.column_name === 'rpp_id');

      if (hasRuleParticipantId) {
        await client.query(
          `DELETE FROM rules_program_participant_billing
            WHERE rule_participant_id = ANY($1::uuid[])`,
          [rppIds]
        );
      }
      if (hasRppId) {
        await client.query(
          `DELETE FROM rules_program_participant_billing
            WHERE rpp_id = ANY($1::uuid[])`,
          [rppIds]
        );
      }
    }

    // 5. Delete participants links
    await client.query(
      `DELETE FROM rules_program_participants WHERE rule_id = $1`,
      [id]
    );

    // 6. Delete slots
    await client.query(
      `DELETE FROM rules_program_slots WHERE rule_id = $1`,
      [id]
    );

    // 7. Delete placeholders
    await client.query(
      `DELETE FROM rules_program_staff_placeholders WHERE rule_id = $1`,
      [id]
    );
    await client.query(
      `DELETE FROM rules_program_vehicle_placeholders WHERE rule_id = $1`,
      [id]
    );

    // 8. Delete cached requirements (table may not exist)
    try {
      await client.query(
        `DELETE FROM rules_program_requirements WHERE rule_id = $1`,
        [id]
      );
    } catch (_) {
      // ignore if table missing
    }

    // 9. Delete generated billing diamonds
    await client.query(
      `DELETE FROM payment_diamonds WHERE program_id = $1`,
      [id]
    );

    // 10. Finally delete rule
    await client.query(`DELETE FROM rules_programs WHERE id = $1`, [id]);

    await client.query('COMMIT');

    // Log deletion
    await logger.logEvent({
      severity: 'INFO',
      category: 'WIZARD',
      message: 'Rule deleted',
      entity: 'rule',
      entity_id: id,
    });

    res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting rule:', err);
    res
      .status(500)
      .json({ success: false, error: 'Failed to delete rule' });
  } finally {
    client.release();
  }
});

module.exports = router;
