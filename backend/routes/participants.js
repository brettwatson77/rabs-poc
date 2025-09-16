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
 * Helper to build WHERE clauses for supervision_multiplier filters
 * @param {Object} query - Request query parameters
 * @returns {Object} Object with where clause and params array
 */
function buildSupervisionMultiplierFilter(query) {
  const { supervision_multiplier_op, value } = query;
  const whereFragments = [];
  const params = [];
  
  if (supervision_multiplier_op && value) {
    let paramIndex = params.length + 1;
    
    switch (supervision_multiplier_op) {
      case 'eq':
        whereFragments.push(`supervision_multiplier = $${paramIndex}`);
        params.push(parseFloat(value));
        break;
      case 'gte':
        whereFragments.push(`supervision_multiplier >= $${paramIndex}`);
        params.push(parseFloat(value));
        break;
      case 'lte':
        whereFragments.push(`supervision_multiplier <= $${paramIndex}`);
        params.push(parseFloat(value));
        break;
      case 'between':
        const [min, max] = value.split(',').map(v => parseFloat(v.trim()));
        if (!isNaN(min) && !isNaN(max)) {
          whereFragments.push(`supervision_multiplier BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
          params.push(min, max);
        }
        break;
    }
  }
  
  return { whereFragments, params };
}

/**
 * @route   GET /api/v1/participants
 * @desc    Get all participants with optional filters
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Build WHERE clause for supervision_multiplier filters
    const { whereFragments, params } = buildSupervisionMultiplierFilter(req.query);
    
    // Construct the full query
    let query = 'SELECT * FROM participants';
    
    if (whereFragments.length > 0) {
      query += ' WHERE ' + whereFragments.join(' AND ');
    }
    
    query += ' ORDER BY last_name, first_name';
    
    // Execute the query
    const result = await pool.query(query, params);
    
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
 * @desc    Get participant by ID with addresses
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get participant data
      const participantResult = await client.query(
        'SELECT * FROM participants WHERE id = $1',
        [id]
      );
      
      if (participantResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Participant not found'
        });
      }
      
      const participant = participantResult.rows[0];
      
      // Get addresses (both primary and secondary if they exist)
      const addressesResult = await client.query(
        'SELECT * FROM participant_addresses WHERE participant_id = $1 AND is_active = true',
        [id]
      );
      
      // Format addresses as object with primary/secondary keys
      const addresses = {};
      let secondaryAddress = null;
      
      addressesResult.rows.forEach(addr => {
        if (addr.kind === 'primary') {
          addresses.primary = addr;
        } else if (addr.kind === 'secondary') {
          addresses.secondary = addr;
          // Create flattened secondary address fields for backward compatibility
          secondaryAddress = {
            secondary_address_line1: addr.line1,
            secondary_address_line2: addr.line2,
            secondary_address_suburb: addr.suburb,
            secondary_address_state: addr.state,
            secondary_address_postcode: addr.postcode,
            secondary_address_country: addr.country
          };
        }
      });
      
      await client.query('COMMIT');
      
      // Include addresses in response
      const response = {
        ...participant,
        addresses: Object.keys(addresses).length > 0 ? addresses : null,
        ...(secondaryAddress || {}) // Include flattened secondary_* fields if they exist
      };
      
      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Validate if invoices_email is required based on plan management type
 * @param {Object} body - Request body
 * @returns {Object|null} Error object if validation fails, null otherwise
 */
function validateInvoicesEmail(body) {
  const requiresInvoiceEmail = ['plan_managed', 'self_managed', 'self_funded'];
  const planType = body.plan_management_type;
  
  if (planType && requiresInvoiceEmail.includes(planType)) {
    if (!body.invoices_email) {
      return {
        status: 422,
        error: `Invoices email is required when plan management type is ${planType}`
      };
    }
  }
  
  return null;
}

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
    const { secondary_address, ...bodyFields } = req.body || {};

    // ---------------------------------------------------------------------
    // Normalise deprecated value -> enum value used in DB
    // ---------------------------------------------------------------------
    if (
      bodyFields &&
      typeof bodyFields.plan_management_type === 'string' &&
      bodyFields.plan_management_type.trim() === 'fee_for_service'
    ) {
      bodyFields.plan_management_type = 'self_funded';
    }
    
    // ---------------------------------------------------------------------
    // Map legacy `status` string → boolean `active`
    // ---------------------------------------------------------------------
    if (typeof bodyFields.status === 'string') {
      bodyFields.active =
        bodyFields.status.trim().toLowerCase() === 'active';
      delete bodyFields.status;
    }

    // ---------------------------------------------------------------------
    // Normalize empty-string dates to NULL to avoid Postgres date parsing
    // ---------------------------------------------------------------------
    {
      const dateFields = ['date_of_birth', 'ndis_plan_start', 'ndis_plan_end'];
      dateFields.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(bodyFields, f)) {
          if (bodyFields[f] === '' || bodyFields[f] === undefined) {
            bodyFields[f] = null;
          }
        }
      });
    }
    
    // Validate invoices_email if plan_management_type requires it
    const validationError = validateInvoicesEmail(bodyFields);
    if (validationError) {
      return res.status(validationError.status).json({
        success: false,
        error: validationError.error
      });
    }

    // Whitelist of updatable columns (expanded with new fields)
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
      'has_communication_needs',
      'plan_management_type',
      // Active flag (replaces legacy status)
      'active',
      // Plan-level flags
      'has_behavior_support_plan',
      'has_restrictive_practices',
      'has_mealtime_management_plan',
      // New fields
      'secondary_email',
      'secondary_email_include_comms',
      'secondary_email_include_billing',
      'invoices_email',
      'emergency_contact_relationship',
      'emergency_contact_phone_allow_sms',
      'emergency_contact_email',
      'emergency_contact_email_include_comms',
      'emergency_contact_email_include_billing'
    ];

    const fields = Object.keys(bodyFields || {}).filter((k) =>
      allowedFields.includes(k)
    );

    if (fields.length === 0 && !secondary_address) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields supplied for update'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update main participant record if there are fields to update
      let participantResult = null;
      if (fields.length > 0) {
        // Build dynamic UPDATE query
        const setFragments = fields.map((f, idx) => `${f} = $${idx + 2}`);
        const values = fields.map((f) => bodyFields[f]);

        const updateSql = `
          UPDATE participants
          SET ${setFragments.join(', ')},
              updated_at = NOW()
          WHERE id = $1
          RETURNING *`;

        participantResult = await client.query(updateSql, [id, ...values]);

        if (participantResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Participant not found' });
        }
      } else {
        // Verify participant exists
        const checkResult = await client.query('SELECT id FROM participants WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Participant not found' });
        }
        participantResult = checkResult;
      }
      
      // Handle secondary address if provided
      if (secondary_address && typeof secondary_address === 'object') {
        const addressFields = ['line1', 'line2', 'suburb', 'state', 'postcode', 'country', 'latitude', 'longitude'];
        const filteredAddress = {};
        
        // Filter valid fields
        addressFields.forEach(field => {
          if (secondary_address[field] !== undefined) {
            filteredAddress[field] = secondary_address[field];
          }
        });
        
        if (Object.keys(filteredAddress).length > 0) {
          // Upsert secondary address with ON CONFLICT DO UPDATE
          const addressFields = Object.keys(filteredAddress);
          const placeholders = addressFields.map((_, i) => `$${i + 3}`);
          const updateFragments = addressFields.map(f => `${f} = EXCLUDED.${f}`);
          
          const upsertSql = `
            INSERT INTO participant_addresses
              (participant_id, kind, ${addressFields.join(', ')}, updated_at)
            VALUES
              ($1, $2, ${placeholders.join(', ')}, NOW())
            ON CONFLICT (participant_id, kind)
            DO UPDATE SET
              ${updateFragments.join(', ')},
              updated_at = NOW()
            RETURNING *`;
          
          await client.query(
            upsertSql,
            [id, 'secondary', ...addressFields.map(f => filteredAddress[f])]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated participant with addresses for response
      const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * ---------------------------------------------------------------------------
 * PUT /api/v1/participants/:id
 * ---------------------------------------------------------------------------
 * Full update of a participant record (upsert-style without inserts).
 * Only whitelisted fields are allowed to be updated.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { secondary_address, ...bodyFields } = req.body || {};

    // ---------------------------------------------------------------------
    // Normalise deprecated value -> enum value used in DB
    // ---------------------------------------------------------------------
    if (
      bodyFields &&
      typeof bodyFields.plan_management_type === 'string' &&
      bodyFields.plan_management_type.trim() === 'fee_for_service'
    ) {
      bodyFields.plan_management_type = 'self_funded';
    }
    
    // ---------------------------------------------------------------------
    // Map legacy `status` string → boolean `active`
    // ---------------------------------------------------------------------
    if (typeof bodyFields.status === 'string') {
      bodyFields.active =
        bodyFields.status.trim().toLowerCase() === 'active';
      delete bodyFields.status;
    }

    // ---------------------------------------------------------------------
    // Normalize empty-string dates to NULL to avoid Postgres date parsing
    // ---------------------------------------------------------------------
    {
      const dateFields = ['date_of_birth', 'ndis_plan_start', 'ndis_plan_end'];
      dateFields.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(bodyFields, f)) {
          if (bodyFields[f] === '' || bodyFields[f] === undefined) {
            bodyFields[f] = null;
          }
        }
      });
    }
    
    // Validate invoices_email if plan_management_type requires it
    const validationError = validateInvoicesEmail(bodyFields);
    if (validationError) {
      return res.status(validationError.status).json({
        success: false,
        error: validationError.error
      });
    }

    // Whitelist of ALL updatable columns for full update (removed support_level, added new fields)
    const allowed = [
      'first_name',
      'last_name',
      'ndis_number',
      'date_of_birth',
      'gender',
      'phone',
      'email',
      'address',
      'suburb',
      'state',
      'postcode',
      'emergency_contact_name',
      'emergency_contact_phone',
      // 'support_level', // Removed as requested
      'plan_management_type',
      'notes',
      'supervision_multiplier',
      'has_wheelchair_access',
      'has_dietary_requirements',
      'has_medical_requirements',
      'has_behavioral_support',
      'has_visual_impairment',
      'has_hearing_impairment',
      'has_cognitive_support',
      'has_communication_needs',
      // Plan-level flags
      'has_behavior_support_plan',
      'has_restrictive_practices',
      'has_mealtime_management_plan',
      // Boolean active flag (replaces legacy status)
      'active',
      // New fields
      'secondary_email',
      'secondary_email_include_comms',
      'secondary_email_include_billing',
      'invoices_email',
      'emergency_contact_relationship',
      'emergency_contact_phone_allow_sms',
      'emergency_contact_email',
      'emergency_contact_email_include_comms',
      'emergency_contact_email_include_billing'
    ];

    const bodyKeys = Object.keys(bodyFields || {});
    const fields = bodyKeys.filter((k) => allowed.includes(k));

    if (fields.length === 0 && !secondary_address) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields supplied for update'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update main participant record if there are fields to update
      let participantResult = null;
      if (fields.length > 0) {
        // Build dynamic UPDATE statement
        const setFragments = fields.map((f, idx) => `${f} = $${idx + 2}`);
        const values = fields.map((f) => bodyFields[f]);

        const sql = `
          UPDATE participants
          SET ${setFragments.join(', ')},
              updated_at = NOW()
          WHERE id = $1
          RETURNING *`;

        participantResult = await client.query(sql, [id, ...values]);

        if (participantResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Participant not found' });
        }
      } else {
        // Verify participant exists
        const checkResult = await client.query('SELECT id FROM participants WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, error: 'Participant not found' });
        }
        participantResult = checkResult;
      }
      
      // Handle secondary address if provided
      if (secondary_address && typeof secondary_address === 'object') {
        const addressFields = ['line1', 'line2', 'suburb', 'state', 'postcode', 'country', 'latitude', 'longitude'];
        const filteredAddress = {};
        
        // Filter valid fields
        addressFields.forEach(field => {
          if (secondary_address[field] !== undefined) {
            filteredAddress[field] = secondary_address[field];
          }
        });
        
        if (Object.keys(filteredAddress).length > 0) {
          // Upsert secondary address with ON CONFLICT DO UPDATE
          const addressFields = Object.keys(filteredAddress);
          const placeholders = addressFields.map((_, i) => `$${i + 3}`);
          const updateFragments = addressFields.map(f => `${f} = EXCLUDED.${f}`);
          
          const upsertSql = `
            INSERT INTO participant_addresses
              (participant_id, kind, ${addressFields.join(', ')}, updated_at)
            VALUES
              ($1, $2, ${placeholders.join(', ')}, NOW())
            ON CONFLICT (participant_id, kind)
            DO UPDATE SET
              ${updateFragments.join(', ')},
              updated_at = NOW()
            RETURNING *`;
          
          await client.query(
            upsertSql,
            [id, 'secondary', ...addressFields.map(f => filteredAddress[f])]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // Get updated participant with addresses for response
      const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
