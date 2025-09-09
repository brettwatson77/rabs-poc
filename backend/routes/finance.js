/**
 * Finance API Routes
 * 
 * Endpoints for financial operations:
 * - GET /finance/billing - Get billing data
 * - GET /finance/billing-codes - Get active billing codes for Wizard
 * - GET /finance/rates - Get billing rates with filters
 * - POST /finance/rates - Create new billing rate
 * - PATCH /finance/rates/:id - Update billing rate
 * - POST /finance/rates/import - Import rates from CSV
 * - POST /finance/export - Export billing data
 * - POST /finance/billing - Create billing entry
 * - POST /finance/billing/bulk - Create multiple billing entries
 */

const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');

// Helper functions for numeric handling and rounding
const toNumber = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Helper: ensure payment_diamonds has required columns
// ---------------------------------------------------------------------------
const ensurePaymentDiamondsColumns = async (pool) => {
  try {
    // Add program_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE payment_diamonds 
      ADD COLUMN IF NOT EXISTS program_id UUID NULL
    `);
    
    // Add hours column if it doesn't exist
    await pool.query(`
      ALTER TABLE payment_diamonds 
      ADD COLUMN IF NOT EXISTS hours NUMERIC(6,2) NULL
    `);
    
    console.log('[FINANCE] Ensured payment_diamonds has program_id and hours columns');
  } catch (err) {
    // Ignore errors if columns already exist or other issues
    console.error('[FINANCE] Note: payment_diamonds column check:', err.message);
  }
};

// ---------------------------------------------------------------------------
// Internal: one-time live schema audit for billing_rates
// ---------------------------------------------------------------------------
let schemaAudited = false;
let cachedColumns = [];
const auditBillingRatesSchema = async (pool) => {
  if (schemaAudited) return cachedColumns;

  /* --------------------------------------------------------------------- */
  /* 1. Idempotent DDL – ensure table & new columns exist                  */
  /* --------------------------------------------------------------------- */
  try {
    await pool.query(`
      /* --------------------------------------------------------------- */
      /* Create table (minimal) if missing                               */
      /* --------------------------------------------------------------- */
      CREATE TABLE IF NOT EXISTS billing_rates (
        id            uuid PRIMARY KEY,
        code          text NOT NULL,
        description   text NOT NULL,
        active        boolean NOT NULL DEFAULT true,
        base_rate     numeric(10,2) NOT NULL DEFAULT 0,
        ratio_1_1     numeric(10,2) NULL,
        ratio_1_2     numeric(10,2) NULL,
        ratio_1_3     numeric(10,2) NULL,
        ratio_1_4     numeric(10,2) NULL,
        /* New column – group 1:5 support                                */
        ratio_1_5     numeric(10,2),
        /* New flag – single-rate (1:1 only)                             */
        single_rate   boolean NOT NULL DEFAULT false,
        created_at    timestamp with time zone NOT NULL DEFAULT now(),
        updated_at    timestamp with time zone NOT NULL DEFAULT now()
      );

      /* --------------------------------------------------------------- */
      /* Add missing columns (idempotent)                               */
      /* --------------------------------------------------------------- */
      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS single_rate boolean NOT NULL DEFAULT false;

      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS ratio_1_5 numeric(10,2);

      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS ratio_1_1 numeric(10,2);
      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS ratio_1_2 numeric(10,2);
      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS ratio_1_3 numeric(10,2);
      ALTER TABLE billing_rates
        ADD COLUMN IF NOT EXISTS ratio_1_4 numeric(10,2);

      /* --------------------------------------------------------------- */
      /* Relax uniqueness on code                                       */
      /* --------------------------------------------------------------- */
      DO $$
      DECLARE
        con  record;
      BEGIN
        /* Drop any UNIQUE constraints on code                           */
        FOR con IN
          SELECT conname
          FROM   pg_constraint
          WHERE  conrelid = 'billing_rates'::regclass
            AND  contype  = 'u'
            AND  conkey   = (SELECT array_agg(attnum)
                             FROM pg_attribute
                             WHERE attrelid = 'billing_rates'::regclass
                               AND attname  = 'code')
        LOOP
          EXECUTE format('ALTER TABLE billing_rates DROP CONSTRAINT IF EXISTS %I', con.conname);
        END LOOP;
      END $$;

      /* Re-create non-unique index if not present                       */
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname='public'
            AND tablename='billing_rates'
            AND indexname='idx_billing_rates_code'
        ) THEN
          CREATE INDEX idx_billing_rates_code ON billing_rates(code);
        END IF;
      END $$;
    `);
  } catch (ddlErr) {
    console.error('❌ [FINANCE] billing_rates DDL error:', ddlErr.message);
  }

  try {
    const { rows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'billing_rates'
          AND table_schema = 'public'
        ORDER BY ordinal_position
    `);
    cachedColumns = rows.map(r => r.column_name);
    console.log('[FINANCE] billing_rates columns:', cachedColumns.join(', '));
    schemaAudited = true;
  } catch (err) {
    console.error('❌ [FINANCE] Failed auditing billing_rates schema:', err.message);
  }
  return cachedColumns;
};

const hasCol = (name) => cachedColumns.includes(name);

// GET /finance/billing - Get billing data
router.get('/billing', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Ensure payment_diamonds has required columns
    await ensurePaymentDiamondsColumns(pool);
    
    const { 
      start_date, 
      end_date, 
      participant_id,
      program_id,
      status,
      management
    } = req.query;
    
    // Build query with optional filters
    let query = `
      SELECT 
        pd.id,
        pd.participant_id,
        COALESCE(pd.invoice_date, pd.created_at::date) AS date,
        pd.hours,
        pd.quantity,
        pd.support_item_number AS rate_code,
        pd.unit_price,
        pd.total_amount,
        pd.status,
        p.first_name || ' ' || p.last_name AS participant_name,
        p.plan_management_type AS management,
        rp.name AS program_name
      FROM payment_diamonds pd
      JOIN participants p ON pd.participant_id = p.id
      LEFT JOIN rules_programs rp ON pd.program_id = rp.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (start_date) {
      query += ` AND COALESCE(pd.invoice_date, pd.created_at::date) >= $${paramIndex++}`;
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ` AND COALESCE(pd.invoice_date, pd.created_at::date) <= $${paramIndex++}`;
      queryParams.push(end_date);
    }
    
    if (participant_id) {
      query += ` AND pd.participant_id = $${paramIndex++}`;
      queryParams.push(participant_id);
    }
    
    if (program_id) {
      query += ` AND pd.program_id = $${paramIndex++}`;
      queryParams.push(program_id);
    }
    
    if (status) {
      query += ` AND pd.status = $${paramIndex++}`;
      queryParams.push(status);
    }
    
    if (management) {
      query += ` AND p.plan_management_type = $${paramIndex++}`;
      queryParams.push(management);
    }
    
    query += ` ORDER BY date DESC, participant_name ASC`;
    
    const result = await pool.query(query, queryParams);
    
    // Calculate totals
    let totalAmount = 0;
    let totalHours = 0;
    
    result.rows.forEach(row => {
      totalAmount += toNumber(row.total_amount);
      totalHours += toNumber(row.hours);
    });
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      summary: {
        total_amount: totalAmount.toFixed(2),
        total_hours: totalHours.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing data',
      message: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /finance/billing - Create billing entry
// ---------------------------------------------------------------------------
router.post('/billing', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Ensure payment_diamonds has required columns
    await ensurePaymentDiamondsColumns(pool);
    
    const { 
      participant_id, 
      program_id, 
      date, 
      hours, 
      quantity = 1, 
      rate_code, 
      unit_price, 
      notes,
      override_management
    } = req.body;
    
    // Validate required fields
    if (!participant_id || !date || !rate_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'participant_id, date, and rate_code are required'
      });
    }
    
    // Get participant management type
    const participantResult = await pool.query(
      'SELECT plan_management_type FROM participants WHERE id = $1',
      [participant_id]
    );
    
    if (participantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }
    
    const validMgmt = ['agency_managed','plan_managed','self_managed','self_funded'];
    const participantMgmt = participantResult.rows[0].plan_management_type;
    const overrideApplied = validMgmt.includes(override_management);
    const management = overrideApplied ? override_management : participantMgmt;
    
    // Parse numeric values
    const hoursNum = toNumber(hours);
    const quantityNum = toNumber(quantity);
    const unitPriceNum = toNumber(unit_price);
    
    // Calculate total amount
    const totalAmount = round2(unitPriceNum * hoursNum * quantityNum);
    
    // Prepare notes with program info if provided
    let finalNotes = notes || '';
    if (program_id) {
      try {
        const programResult = await pool.query(
          'SELECT name FROM programs WHERE id = $1',
          [program_id]
        );
        if (programResult.rows.length > 0) {
          const programName = programResult.rows[0].name;
          finalNotes = finalNotes ? `${finalNotes}\nProgram: ${programName}` : `Program: ${programName}`;
        }
      } catch (err) {
        console.error('Error fetching program name:', err);
      }
    }
    
    // Insert into payment_diamonds
    const billingId = uuid.v4();
    const insertResult = await pool.query(
      `INSERT INTO payment_diamonds (
        id, 
        participant_id,
        program_id,
        support_item_number, 
        unit_price,
        hours,
        quantity, 
        total_amount, 
        gst_code, 
        status, 
        invoice_date,
        history_shift_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [
        billingId,
        participant_id,
        program_id || null,
        rate_code,
        unitPriceNum,
        hoursNum,
        quantityNum,
        totalAmount,
        'FRE', // GST-free
        'pending',
        date,
        null // No history shift for manual entries
      ]
    );
    
    // Log the creation
    await pool.query(
      `INSERT INTO system_logs (
        id, 
        severity, 
        category, 
        message, 
        details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        uuid.v4(),
        'INFO',
        'FINANCIAL',
        `Billing entry created: ${rate_code}`,
        {
          billing_id: billingId,
          participant_id,
          date,
          amount: totalAmount,
          notes: finalNotes,
          override_applied: overrideApplied,
          ...(overrideApplied && { override_management })
        }
      ]
    );
    
    console.log(`[FINANCE] Created billing entry: ${billingId} for participant ${participant_id}, rate ${rate_code}, amount $${totalAmount}`);
    
    // Return created entry with management
    const createdEntry = {
      ...insertResult.rows[0],
      management,
      notes: finalNotes
    };
    
    res.status(201).json({
      success: true,
      data: createdEntry
    });
  } catch (error) {
    console.error('Error creating billing entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing entry',
      message: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /finance/billing/bulk - Create multiple billing entries
// ---------------------------------------------------------------------------
router.post('/billing/bulk', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Ensure payment_diamonds has required columns
    await ensurePaymentDiamondsColumns(pool);
    
    const { 
      dates, 
      participant_ids, 
      program_id, 
      rate_code, 
      unit_price, 
      hours, 
      quantity = 1, 
      notes 
    } = req.body;
    
    // Validate required fields
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid dates array'
      });
    }
    
    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid participant_ids array'
      });
    }
    
    if (!rate_code) {
      return res.status(400).json({
        success: false,
        error: 'rate_code is required'
      });
    }
    
    // Parse numeric values
    const hoursNum = toNumber(hours);
    const quantityNum = toNumber(quantity);
    const unitPriceNum = toNumber(unit_price);
    
    // Calculate total amount per entry
    const totalAmount = round2(unitPriceNum * hoursNum * quantityNum);
    
    // Prepare program info if provided
    let programName = '';
    if (program_id) {
      try {
        const programResult = await pool.query(
          'SELECT name FROM programs WHERE id = $1',
          [program_id]
        );
        if (programResult.rows.length > 0) {
          programName = programResult.rows[0].name;
        }
      } catch (err) {
        console.error('Error fetching program name:', err);
      }
    }
    
    // Create entries for each participant x date combination
    const insertedIds = [];
    const managementTypes = {};
    
    for (const participantId of participant_ids) {
      // Get participant management type
      const participantResult = await pool.query(
        'SELECT plan_management_type, first_name, last_name FROM participants WHERE id = $1',
        [participantId]
      );
      
      if (participantResult.rows.length === 0) {
        continue; // Skip if participant not found
      }
      
      const participant = participantResult.rows[0];
      const management = participant.plan_management_type;
      const participantName = `${participant.first_name} ${participant.last_name}`;
      
      // Track management types for reporting
      if (!managementTypes[management]) {
        managementTypes[management] = 0;
      }
      
      for (const date of dates) {
        // Prepare notes with program info
        let finalNotes = notes || '';
        if (programName) {
          finalNotes = finalNotes ? `${finalNotes}\nProgram: ${programName}` : `Program: ${programName}`;
        }
        
        // Insert into payment_diamonds
        const billingId = uuid.v4();
        await pool.query(
          `INSERT INTO payment_diamonds (
            id, 
            participant_id,
            program_id,
            support_item_number, 
            unit_price,
            hours,
            quantity, 
            total_amount, 
            gst_code, 
            status, 
            invoice_date,
            history_shift_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            billingId,
            participantId,
            program_id || null,
            rate_code,
            unitPriceNum,
            hoursNum,
            quantityNum,
            totalAmount,
            'FRE', // GST-free
            'pending',
            date,
            null // No history shift for manual entries
          ]
        );
        
        insertedIds.push(billingId);
        managementTypes[management]++;
      }
    }
    
    // Log the bulk creation
    await pool.query(
      `INSERT INTO system_logs (
        id, 
        severity, 
        category, 
        message, 
        details
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        uuid.v4(),
        'INFO',
        'FINANCIAL',
        `Bulk billing entries created: ${insertedIds.length}`,
        {
          count: insertedIds.length,
          dates_count: dates.length,
          participants_count: participant_ids.length,
          rate_code,
          management_breakdown: managementTypes
        }
      ]
    );
    
    console.log(`[FINANCE] Created ${insertedIds.length} bulk billing entries for ${participant_ids.length} participants across ${dates.length} dates`);
    
    res.status(201).json({
      success: true,
      count: insertedIds.length,
      example_ids: insertedIds.slice(0, 5),
      management_breakdown: managementTypes
    });
  } catch (error) {
    console.error('Error creating bulk billing entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bulk billing entries',
      message: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// GET /finance/billing-codes - Thin list of active billing codes (Wizard v2)
// ---------------------------------------------------------------------------
router.get('/billing-codes', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    // Confirm column list from live DB
    await auditBillingRatesSchema(pool);

    const result = await pool.query(`
      SELECT id, code, description, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4, ratio_1_5,
             single_rate,
             active, updated_at
        FROM billing_rates
       WHERE active = true
    ORDER BY code ASC`);

    // Flatten to variant list for wizard (one entry per ratio column that has a >0 value)
    const flattened = [];
    const ratioColsAll = [
      { col: 'ratio_1_1', label: '1:1' },
      { col: 'ratio_1_2', label: '1:2' },
      { col: 'ratio_1_3', label: '1:3' },
      { col: 'ratio_1_4', label: '1:4' },
      { col: 'ratio_1_5', label: '1:5' },
    ];

    result.rows.forEach((r) => {
      const colsToUse = r.single_rate ? ratioColsAll.slice(0, 1) /* only 1:1 */ : ratioColsAll;
      colsToUse.forEach(({ col, label }) => {
        const rate = parseFloat(r[col]);
        if (!isNaN(rate) && rate > 0) {
          flattened.push({
            id: r.id,
            code: r.code,
            ratio: label,
            option_id: `${r.id}-${label}`,
            label: `${r.code} — ${r.description} (${label})`,
            rate_cents: Math.round(rate * 100),
            updated_at: r.updated_at,
          });
        }
      });
    });

    res.json({ success: true, data: flattened, count: flattened.length });
  } catch (error) {
    // Never 500 – return empty list so Wizard shows friendly empty state
    console.error('Error fetching billing codes:', error);
    res.json({ success: true, data: [], count: 0 });
  }
});

// ---------------------------------------------------------------------------
// GET /finance/rates - List with filters
// ---------------------------------------------------------------------------
router.get('/rates', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const {
      code,
      active_only = 'false',
      updated_since
    } = req.query;

    const clauses = [];
    const params = [];
    let idx = 1;

    if (code) {
      clauses.push(`LOWER(code) LIKE $${idx++}`);
      params.push(`%${code.toLowerCase()}%`);
    }
    if (active_only === 'true') {
      clauses.push(`active = true`);
    }
    if (updated_since) {
      clauses.push(`updated_at >= $${idx++}`);
      params.push(updated_since);
    }

    let sql = `
      SELECT id, code, description, active, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4, ratio_1_5, single_rate,
             ${hasCol('updated_at') ? 'updated_at' : 'created_at AS updated_at'}
      FROM billing_rates`;

    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY code ASC';

    const { rows } = await pool.query(sql, params);

    const data = rows.map(r => {
      const ratios = [];
      [['ratio_1_1', '1:1'], ['ratio_1_2', '1:2'],
       ['ratio_1_3', '1:3'], ['ratio_1_4', '1:4'], ['ratio_1_5','1:5']].forEach(
        ([col, label]) => {
          const val = parseFloat(r[col]);
          if (!isNaN(val) && val > 0) ratios.push({ ratio: label, rate: val });
        }
      );
      return {
        id: r.id,
        code: r.code,
        description: r.description,
        active: r.active,
        updated_at: r.updated_at,
        base_rate: parseFloat(r.base_rate),
        ratios,
        single_rate: r.single_rate
      };
    });

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('Error fetching billing rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing rates',
      message: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// GET /finance/rates/:id - Fetch a single billing rate (normalized shape)
// ---------------------------------------------------------------------------
router.get('/rates/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id required' });
    }

    const sql = `
      SELECT id, code, description, active, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4, ratio_1_5, single_rate,
             ${hasCol('updated_at') ? 'updated_at' : 'created_at AS updated_at'}
        FROM billing_rates
       WHERE id = $1
       LIMIT 1`;

    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Rate not found' });
    }

    const r = rows[0];
    const ratios = [];
    [
      ['ratio_1_1', '1:1'],
      ['ratio_1_2', '1:2'],
      ['ratio_1_3', '1:3'],
      ['ratio_1_4', '1:4'],
      ['ratio_1_5', '1:5']
    ].forEach(([col, label]) => {
      const val = parseFloat(r[col]);
      if (!isNaN(val) && val > 0) {
        ratios.push({ ratio: label, rate_cents: Math.round(val * 100) });
      }
    });

    const payload = {
      id: r.id,
      code: r.code,
      description: r.description,
      active: r.active,
      updated_at: r.updated_at,
      base_rate: parseFloat(r.base_rate),
      ratios,
      single_rate: r.single_rate
    };

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Error fetching billing rate by id:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing rate',
      message: err.message
    });
  }
});

// ---------------------------------------------------------------------------
// POST /finance/rates - Create new billing rate
// ---------------------------------------------------------------------------
router.post('/rates', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    // -------------------------------------------------------------------
    // Diagnostics – log raw payload for visibility in server console
    // -------------------------------------------------------------------
    console.log('[FINANCE] POST /api/v1/finance/rates payload:', req.body);

    const {
      code,
      description,
      active = true,
      base_rate = 0,
      ratio_1_1 = 0,
      ratio_1_2 = 0,
      ratio_1_3 = 0,
      ratio_1_4 = 0,
      ratio_1_5 = 0,
      single_rate = false
    } = req.body;

    if (!code || !description) {
      return res.status(400).json({ success: false, error: 'code and description are required' });
    }

    try {
      const insertSQL = `
        INSERT INTO billing_rates
            (id, code, description, active, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4, ratio_1_5, single_rate)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `;
      const { rows } = await pool.query(insertSQL, [
        uuid.v4(),        // $1 id
        code,             // $2
        description,      // $3
        active,           // $4
        base_rate,        // $5
        ratio_1_1,        // $6
        ratio_1_2,        // $7
        ratio_1_3,        // $8
        ratio_1_4,        // $9
        ratio_1_5,        // $10
        single_rate       // $11
      ]);
      const r = rows[0];
      await pool.query(`INSERT INTO system_logs (id,severity,category,message,details)
                       VALUES ($1,'INFO','FINANCIAL',$2,$3)`, [
        uuid.v4(),
        `Billing rate created: ${code}`,
        { id: r.id }
      ]);
      res.status(201).json({ success: true, data: r });
    } catch (e) {
      if (e.code === '23505') { // unique_violation
        return res.status(409).json({ success: false, error: 'Duplicate code' });
      }
      throw e;
    }
  } catch (err) {
    console.error('[FINANCE] Error creating billing rate:', err);
    res.status(500).json({ success: false, error: 'Failed to create billing rate', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /finance/rates/:id - Update billing rate
// ---------------------------------------------------------------------------
router.patch('/rates/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const { id } = req.params;

    // -------------------------------------------------------------------
    // Diagnostics – log incoming id & diff payload
    // -------------------------------------------------------------------
    console.log('[FINANCE] PATCH /api/v1/finance/rates/:id payload:', { id, body: req.body });

    const allowed = ['description', 'active', 'base_rate',
                     'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4',
                     'ratio_1_5', 'single_rate'];
    const updates = [];
    const values = [];
    let idx = 1;
    allowed.forEach(col => {
      if (req.body[col] !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(req.body[col]);
      }
    });
    if (!updates.length) {
      return res.status(400).json({ success: false, error: 'No updatable fields supplied' });
    }
    values.push(id);
    const sql = `UPDATE billing_rates SET ${updates.join(', ')}
                 WHERE id = $${idx}
                 RETURNING *`;
    const { rows } = await pool.query(sql, values);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Rate not found' });

    await pool.query(`INSERT INTO system_logs (id,severity,category,message,details)
                     VALUES ($1,'INFO','FINANCIAL',$2,$3)`, [
      uuid.v4(),
      `Billing rate updated: ${rows[0].code}`,
      { id }
    ]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[FINANCE] Error patching billing rate:', err);
    res.status(500).json({ success: false, error: 'Failed to update billing rate', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /finance/rates/:id - Remove billing rate
// ---------------------------------------------------------------------------
router.delete('/rates/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id required' });
    }

    const { rows } = await pool.query(
      'DELETE FROM billing_rates WHERE id = $1 RETURNING *',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Rate not found' });
    }

    // Log deletion
    try {
      await pool.query(
        `INSERT INTO system_logs (id, severity, category, message, details)
         VALUES ($1, 'INFO', 'FINANCIAL', $2, $3)`,
        [uuid.v4(), `Billing rate deleted: ${rows[0].code}`, { id }]
      );
    } catch (logErr) {
      console.error('[FINANCE] Failed to log deletion:', logErr.message);
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[FINANCE] Error deleting billing rate:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete billing rate',
      message: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /finance/rates/import - CSV import with dry-run
// ---------------------------------------------------------------------------
router.post('/rates/import', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const dryRun = (req.query.dryRun ?? 'true') !== 'false';
    let csvText = req.body.csvText;
    const filePath = req.body.filePath;
    if (!csvText && filePath) {
      const abs = path.resolve(__dirname, '..', '..', filePath);
      csvText = fs.readFileSync(abs, 'utf8');
    }
    if (!csvText) return res.status(400).json({ success: false, error: 'csvText or filePath required' });

    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return res.json({ success: true, dryRun, rows: [] });

    // simple CSV parse (handles quotes)
    const parseLine = (l) => {
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (ch === '"') {
          if (inQ && l[i+1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };

    const headerTokens = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const mapIdx = (variants) => {
      for (const v of variants) {
        const ix = headerTokens.indexOf(v);
        if (ix !== -1) return ix;
      }
      return -1;
    };
    const idxCode = mapIdx(['code', 'ndiscode']);
    const idxDesc = mapIdx(['description', 'desc']);
    const idxBase = mapIdx(['baserate', 'base']);
    const idxR11 = mapIdx(['ratio11','r11','ratio_11','ratio_1_1']);
    const idxR12 = mapIdx(['ratio12','r12','ratio_1_2']);
    const idxR13 = mapIdx(['ratio13','r13','ratio_1_3']);
    const idxR14 = mapIdx(['ratio14','r14','ratio_1_4']);
    /* New: ratio 1:5 and single-rate flag */
    const idxR15 = mapIdx(['ratio15','r15','ratio_1_5']);
    const idxSingle = mapIdx(['single_rate','singlerate','single','is_single','issingle']);
    const idxActive = mapIdx(['active','isactive']);

    const preview = [];
    let createCnt=0, updateCnt=0, skipCnt=0;

    for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
      const cols = parseLine(lines[lineIdx]);
      const code = cols[idxCode]?.trim();
      const description = cols[idxDesc]?.trim();
      if (!code || !description) {
        skipCnt++; preview.push({ line: lineIdx+1, action:'skip', reason:'missing code/description' });
        continue;
      }
      const existing = await pool.query('SELECT id FROM billing_rates WHERE code = $1', [code]);
      const payload = {
        description,
        active: idxActive===-1?true: (cols[idxActive].toLowerCase().startsWith('t')),
        base_rate: parseFloat(cols[idxBase]||0)||0,
        ratio_1_1: parseFloat(cols[idxR11]||0)||0,
        ratio_1_2: parseFloat(cols[idxR12]||0)||0,
        ratio_1_3: parseFloat(cols[idxR13]||0)||0,
        ratio_1_4: parseFloat(cols[idxR14]||0)||0,
        ratio_1_5: parseFloat(cols[idxR15]||0)||0,
        single_rate: idxSingle === -1 
          ? false 
          : /^(t|true|y|yes|1)$/i.test((cols[idxSingle]||'').trim())
      };
      if (dryRun) {
        preview.push({ line: lineIdx+1, action: existing.rowCount? 'update':'create', payload });
        continue;
      }
      if (existing.rowCount) {
        // update
        const setParts=[]; const vals=[]; let k=1;
        Object.entries(payload).forEach(([c,v])=>{ setParts.push(`${c}=$${k++}`); vals.push(v); });
        vals.push(existing.rows[0].id);
        await pool.query(`UPDATE billing_rates SET ${setParts.join(', ')} WHERE id=$${k}`, vals);
        updateCnt++;
      } else {
        await pool.query(`INSERT INTO billing_rates
            (id,code,description,active,base_rate,
             ratio_1_1,ratio_1_2,ratio_1_3,ratio_1_4,ratio_1_5,single_rate)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
          uuid.v4(), code, description, payload.active, payload.base_rate,
          payload.ratio_1_1, payload.ratio_1_2, payload.ratio_1_3, payload.ratio_1_4,
          payload.ratio_1_5, payload.single_rate
        ]);
        createCnt++;
      }
    }

    if (!dryRun) {
      await pool.query(`INSERT INTO system_logs (id,severity,category,message)
                       VALUES ($1,'INFO','FINANCIAL',$2)`, [
        uuid.v4(), `Billing rate import committed: +${createCnt}/~${updateCnt}`
      ]);
    }

    res.json({
      success:true,
      dryRun,
      detectedHeaders: headerTokens,
      summary: { create: createCnt, update: updateCnt, skip: skipCnt },
      rows: preview
    });
  } catch (err) {
    console.error('Error importing billing rates:', err);
    res.json({ success:true, dryRun:true, error:'importFailed', rows:[] });
  }
});

// POST /finance/export - Export billing data
router.post('/export', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      start_date, 
      end_date,
      type = 'both',
      format = 'csv'
    } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'start_date and end_date are required'
      });
    }
    
    // Query payment_diamonds joined with participants
    const query = `
      SELECT 
        pd.id,
        pd.participant_id,
        COALESCE(pd.invoice_date, pd.created_at::date) AS date,
        pd.hours,
        pd.quantity,
        pd.support_item_number AS rate_code,
        pd.unit_price,
        pd.total_amount,
        pd.status,
        p.first_name || ' ' || p.last_name AS participant_name,
        p.ndis_number,
        p.plan_management_type AS management,
        rp.name AS program_name
      FROM payment_diamonds pd
      JOIN participants p ON pd.participant_id = p.id
      LEFT JOIN rules_programs rp ON pd.program_id = rp.id
      WHERE COALESCE(pd.invoice_date, pd.created_at::date) BETWEEN $1 AND $2
      ORDER BY date ASC, participant_name ASC
    `;
    
    const result = await pool.query(query, [start_date, end_date]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No billing data found',
        message: 'No billing data found for the specified criteria'
      });
    }
    
    // Split records by management type
    const bulkRecords = []; // agency_managed
    const invoiceRecords = []; // plan_managed, self_managed, self_funded
    
    result.rows.forEach(row => {
      // Ensure numeric values are properly formatted
      const formattedRow = {
        ...row,
        unit_price: toNumber(row.unit_price),
        hours: toNumber(row.hours),
        quantity: toNumber(row.quantity),
        total_amount: toNumber(row.total_amount)
      };
      
      if (row.management === 'agency_managed') {
        bulkRecords.push(formattedRow);
      } else {
        invoiceRecords.push(formattedRow);
      }
    });
    
    // Determine what to return based on type
    let responseData = {};
    
    if (type === 'bulk') {
      responseData = {
        bulk: bulkRecords,
        count: bulkRecords.length
      };
    } else if (type === 'invoices') {
      responseData = {
        invoices: invoiceRecords,
        count: invoiceRecords.length
      };
    } else {
      // Default to 'both'
      responseData = {
        bulk: bulkRecords,
        invoices: invoiceRecords,
        count: result.rowCount
      };
    }
    
    // Log the export to system_logs
    try {
      await pool.query(
        `INSERT INTO system_logs (id, severity, category, message, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          uuid.v4(),
          'INFO',
          'FINANCIAL',
          `Billing data exported (${result.rowCount} records)`,
          { 
            format, 
            type,
            start_date, 
            end_date, 
            record_count: result.rowCount,
            bulk_count: bulkRecords.length,
            invoice_count: invoiceRecords.length
          }
        ]
      );
    } catch (logError) {
      console.error('Failed to log to system_logs:', logError);
    }
    
    res.json({
      success: true,
      format,
      type,
      data: responseData,
      export_date: new Date().toISOString(),
      criteria: {
        start_date,
        end_date
      },
      message: `Successfully exported ${result.rowCount} billing records`
    });
  } catch (error) {
    console.error('Error exporting billing data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export billing data',
      message: error.message
    });
  }
});

module.exports = router;
