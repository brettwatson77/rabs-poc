/**
 * Finance API Routes
 * 
 * Endpoints for financial operations:
 * - GET /finance/billing - Get billing data
 * - GET /finance/reports - Get financial reports
 * - POST /finance/export - Export billing data
 * - GET /finance/rates - Get billing rates
 * - PUT /finance/rates/:id - Update billing rate
 */

const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Internal: one-time live schema audit for billing_rates
// ---------------------------------------------------------------------------
let schemaAudited = false;
let cachedColumns = [];
const auditBillingRatesSchema = async (pool) => {
  if (schemaAudited) return cachedColumns;
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
    const { 
      start_date, 
      end_date, 
      participant_id,
      program_id,
      status
    } = req.query;
    
    // Build query with optional filters
    let query = `
      SELECT b.id, b.participant_id, b.program_id, b.loom_instance_id,
             b.date, b.hours, b.rate_code, b.rate_amount, b.support_ratio,
             b.weekend_multiplier, b.total_amount, b.status, b.notes,
             p.first_name || ' ' || p.last_name AS participant_name,
             prog.title AS program_title
      FROM billing b
      LEFT JOIN participants p ON b.participant_id = p.id
      LEFT JOIN programs prog ON b.program_id = prog.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (start_date) {
      query += ` AND b.date >= $${paramIndex++}`;
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ` AND b.date <= $${paramIndex++}`;
      queryParams.push(end_date);
    }
    
    if (participant_id) {
      query += ` AND b.participant_id = $${paramIndex++}`;
      queryParams.push(participant_id);
    }
    
    if (program_id) {
      query += ` AND b.program_id = $${paramIndex++}`;
      queryParams.push(program_id);
    }
    
    if (status) {
      query += ` AND b.status = $${paramIndex++}`;
      queryParams.push(status);
    }
    
    query += ` ORDER BY b.date DESC, p.last_name ASC`;
    
    const result = await pool.query(query, queryParams);
    
    // Calculate totals
    let totalAmount = 0;
    let totalHours = 0;
    
    result.rows.forEach(row => {
      totalAmount += parseFloat(row.total_amount || 0);
      totalHours += parseFloat(row.hours || 0);
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

        // Summary of billing by program
        result = await pool.query(`
          SELECT 
router.get('/billing-codes', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    // Confirm column list from live DB
    await auditBillingRatesSchema(pool);

    const result = await pool.query(`
      SELECT id, code, description, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4,
             active, updated_at
        FROM billing_rates
       WHERE active = true
    ORDER BY code ASC`);

    // Flatten to variant list for wizard (one entry per ratio column that has a >0 value)
    const flattened = [];
    const ratioCols = [
      { col: 'ratio_1_1', label: '1:1' },
      { col: 'ratio_1_2', label: '1:2' },
      { col: 'ratio_1_3', label: '1:3' },
      { col: 'ratio_1_4', label: '1:4' },
    ];

    result.rows.forEach((r) => {
      ratioCols.forEach(({ col, label }) => {
        const rate = parseFloat(r[col]);
        if (!isNaN(rate) && rate > 0) {
          flattened.push({
            id: r.id,
            code: r.code,
            ratio: label,
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
          message: 'Valid report types are: participant_summary, program_summary, rate_code_summary, monthly_trend'
        });
    }
    
    // Calculate overall totals
    let totalAmount = 0;
    let totalHours = 0;
    
    result.rows.forEach(row => {
      totalAmount += parseFloat(row.total_amount || 0);
      totalHours += parseFloat(row.total_hours || 0);
    });
    
    res.json({
      success: true,
      report_type,
      data: result.rows,
      count: result.rowCount,
      summary: {
        total_amount: totalAmount.toFixed(2),
        total_hours: totalHours.toFixed(2),
        date_range: {
          start_date,
          end_date
        }
      }
    });
  } catch (error) {
    console.error('Error generating financial report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate financial report',
      message: error.message
    });
  }
});

// POST /finance/export - Export billing data
router.post('/export', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      start_date, 
      end_date, 
      participant_ids,
      format = 'csv',
      include_details = true
    } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'start_date and end_date are required'
      });
    }
    
    // Build query with optional filters
    let query = `
      SELECT 
        b.id, b.date, b.hours, b.rate_code, b.rate_amount, 
        b.support_ratio, b.weekend_multiplier, b.total_amount, b.status,
        p.first_name || ' ' || p.last_name AS participant_name,
        p.ndis_number,
        prog.title AS program_title
    `;
    
    // Add detailed fields if requested
    if (include_details) {
      query += `,
        p.id AS participant_id,
        prog.id AS program_id,
        b.loom_instance_id,
        b.notes,
        p.date_of_birth,
        p.ndis_plan_start,
        p.ndis_plan_end
      `;
    }
    
    query += `
      FROM billing b
      JOIN participants p ON b.participant_id = p.id
      JOIN programs prog ON b.program_id = prog.id
      WHERE b.date BETWEEN $1 AND $2
    `;
    
    const queryParams = [start_date, end_date];
    let paramIndex = 3;
    
    if (participant_ids && participant_ids.length > 0) {
      query += ` AND b.participant_id = ANY($${paramIndex++})`;
      queryParams.push(participant_ids);
    }
    
    query += ` ORDER BY b.date ASC, p.last_name ASC`;
    
    const result = await pool.query(query, queryParams);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No billing data found',
        message: 'No billing data found for the specified criteria'
      });
    }
    
    // In a real implementation, we would generate the actual file here
    // For this example, we'll just return the data that would be exported
    
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
            start_date, 
            end_date, 
            record_count: result.rowCount 
          }
        ]
      );
    } catch (logError) {
      console.error('Failed to log to system_logs:', logError);
    }
    
    res.json({
      success: true,
      format,
      data: {
        records: result.rows,
        count: result.rowCount,
        export_date: new Date().toISOString(),
        criteria: {
          start_date,
          end_date,
          participant_ids: participant_ids || 'all'
        }
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

// GET /finance/rates - Get billing rates
router.get('/rates', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { active_only } = req.query;
    
    let query = `
      SELECT id, code, description, amount, support_category, 
             is_active, effective_date, end_date
      FROM billing_rates
    `;
    
    if (active_only === 'true') {
      query += ` WHERE is_active = true`;
    }
    
    query += ` ORDER BY code ASC`;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
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
// GET /finance/billing-codes - Thin list of active billing codes (Wizard v2)
// ---------------------------------------------------------------------------
router.get('/billing-codes', async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const result = await pool.query(
    await auditBillingRatesSchema(pool);

    const result = await pool.query(
      `SELECT id, code, description, base_rate,
              ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4,
              active, updated_at
         FROM billing_rates
        WHERE active = true
     ORDER BY code ASC`
    );

    // Flatten to variant list for wizard (one entry per ratio that exists)
    const flattened = [];
    const ratioKeys = [
      { col: 'ratio_1_1', label: '1:1' },
      { col: 'ratio_1_2', label: '1:2' },
      { col: 'ratio_1_3', label: '1:3' },
      { col: 'ratio_1_4', label: '1:4' },
    ];

    result.rows.forEach(r => {
      ratioKeys.forEach(({ col, label }) => {
        const rate = parseFloat(r[col]);
        if (!isNaN(rate) && rate > 0) {
          flattened.push({
            id: r.id,
            code: r.code,
            ratio: label,
            label: `${r.code} — ${r.description} (${label})`,
            rate_cents: Math.round(rate * 100),
            updated_at: r.updated_at
          });
        }
      });
    });

    res.json({ success: true, data: flattened, count: flattened.length });
    console.error('Error fetching billing codes:', error);
    res.status(500).json({
    // Never 500 – empty friendly response
    res.json({ success: true, data: [], count: 0 });
});

// PUT /finance/rates/:id - Update billing rate
// ---------------------------------------------------------------------------
// GET /finance/rates - List with filters
// ---------------------------------------------------------------------------
router.get('/rates', async (req, res) => {
    const pool = req.app.locals.pool;
    const { id } = req.params;
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
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4,
             ${hasCol('updated_at') ? 'updated_at' : 'created_at AS updated_at'}
      FROM billing_rates`;

    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY code ASC';

    const { rows } = await pool.query(sql, params);

    const data = rows.map(r => {
      const ratios = [];
      [['ratio_1_1', '1:1'], ['ratio_1_2', '1:2'],
       ['ratio_1_3', '1:3'], ['ratio_1_4', '1:4']].forEach(
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
        ratios
      };
    });

    res.json({ success: true, data, count: data.length });
    console.error('Error updating billing rate:', error);
    console.error('Error fetching billing rates:', error);
      success: false,
      error: 'Failed to update billing rate',
      error: 'Failed to fetch billing rates',
    });
  }
});

// Helper functions for NDIS billing calculations
// ---------------------------------------------------------------------------
// POST /finance/rates - Create new billing rate
// ---------------------------------------------------------------------------
router.post('/rates', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    await auditBillingRatesSchema(pool);

    const {
      code,
      description,
      active = true,
      base_rate = 0,
      ratio_1_1 = 0,
      ratio_1_2 = 0,
      ratio_1_3 = 0,
      ratio_1_4 = 0
    } = req.body;

    if (!code || !description) {
      return res.status(400).json({ success: false, error: 'code and description are required' });
    }

    try {
      const insertSQL = `
        INSERT INTO billing_rates
            (id, code, description, active, base_rate,
             ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `;
      const { rows } = await pool.query(insertSQL, [
        uuid.v4(), code, description, active,
        base_rate, ratio_1_1, ratio_1_2, ratio_1_3, ratio_1_4
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
    console.error('Error creating billing rate:', err);
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
    const allowed = ['description', 'active', 'base_rate',
                     'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4'];
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
    console.error('Error patching billing rate:', err);
    res.status(500).json({ success: false, error: 'Failed to update billing rate', message: err.message });
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
        ratio_1_4: parseFloat(cols[idxR14]||0)||0
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
             ratio_1_1,ratio_1_2,ratio_1_3,ratio_1_4)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
          uuid.v4(), code, description, payload.active, payload.base_rate,
          payload.ratio_1_1, payload.ratio_1_2, payload.ratio_1_3, payload.ratio_1_4
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


/**
 * Calculate billing amount based on rate, hours, and adjustments
 * 
 * @param {number} rateAmount - Base rate amount
 * @param {number} hours - Number of hours
 * @param {number} supportRatio - Support ratio (e.g., 1.0, 1.2, etc.)
 * @param {number} weekendMultiplier - Weekend/holiday multiplier (e.g., 1.0, 1.5, 2.0)
 * @returns {number} - Total billing amount
 */
function calculateBillingAmount(rateAmount, hours, supportRatio = 1.0, weekendMultiplier = 1.0) {
  // Apply support ratio adjustment
  const adjustedRate = rateAmount * supportRatio;
  
  // Apply weekend/holiday multiplier
  const finalRate = adjustedRate * weekendMultiplier;
  
  // Calculate total amount
  return finalRate * hours;
}

/**
 * Determine support ratio based on participant needs and staff allocation
 * 
 * @param {number} participantCount - Number of participants
 * @param {number} staffCount - Number of staff
 * @returns {number} - Support ratio
 */
function calculateSupportRatio(participantCount, staffCount) {
  if (participantCount <= 0 || staffCount <= 0) {
    return 1.0; // Default ratio
  }
  
  // Calculate ratio: staff to participants
  const ratio = staffCount / participantCount;
  
  // Common NDIS support ratios: 1:1, 1:2, 1:3, 1:4, 1:5
  if (ratio >= 1.0) {
    return 1.0; // 1:1 support
  } else if (ratio >= 0.5) {
    return 0.5; // 1:2 support
  } else if (ratio >= 0.33) {
    return 0.33; // 1:3 support
  } else if (ratio >= 0.25) {
    return 0.25; // 1:4 support
  } else {
    return 0.2; // 1:5 support or lower
  }
}

/**
 * Determine weekend/holiday multiplier based on date
 * 
 * @param {Date} date - The date to check
 * @returns {number} - Weekend/holiday multiplier
 */
function getWeekendHolidayMultiplier(date) {
  const day = date.getDay();
  
  // Weekend rates (Saturday = 6, Sunday = 0)
  if (day === 6) {
    return 1.5; // Saturday rate
  } else if (day === 0) {
    return 2.0; // Sunday rate
  }
  
  // TODO: Add holiday checking logic here
  // For now, just return weekday rate
  return 1.0; // Weekday rate
}

module.exports = router;
