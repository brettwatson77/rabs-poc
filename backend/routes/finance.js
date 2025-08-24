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

// GET /finance/reports - Get financial reports
router.get('/reports', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { report_type, start_date, end_date } = req.query;
    
    if (!report_type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'report_type, start_date, and end_date are required'
      });
    }
    
    let result;
    
    switch (report_type) {
      case 'participant_summary':
        // Summary of billing by participant
        result = await pool.query(`
          SELECT 
            p.id AS participant_id,
            p.first_name || ' ' || p.last_name AS participant_name,
            COUNT(b.id) AS billing_count,
            SUM(b.hours) AS total_hours,
            SUM(b.total_amount) AS total_amount
          FROM billing b
          JOIN participants p ON b.participant_id = p.id
          WHERE b.date BETWEEN $1 AND $2
          GROUP BY p.id, p.first_name, p.last_name
          ORDER BY total_amount DESC
        `, [start_date, end_date]);
        break;
        
      case 'program_summary':
        // Summary of billing by program
        result = await pool.query(`
          SELECT 
            prog.id AS program_id,
            prog.title AS program_title,
            COUNT(b.id) AS billing_count,
            SUM(b.hours) AS total_hours,
            SUM(b.total_amount) AS total_amount
          FROM billing b
          JOIN programs prog ON b.program_id = prog.id
          WHERE b.date BETWEEN $1 AND $2
          GROUP BY prog.id, prog.title
          ORDER BY total_amount DESC
        `, [start_date, end_date]);
        break;
        
      case 'rate_code_summary':
        // Summary by NDIS rate code
        result = await pool.query(`
          SELECT 
            b.rate_code,
            COUNT(b.id) AS billing_count,
            SUM(b.hours) AS total_hours,
            SUM(b.total_amount) AS total_amount
          FROM billing b
          WHERE b.date BETWEEN $1 AND $2
          GROUP BY b.rate_code
          ORDER BY total_amount DESC
        `, [start_date, end_date]);
        break;
        
      case 'monthly_trend':
        // Monthly billing trends
        result = await pool.query(`
          SELECT 
            TO_CHAR(b.date, 'YYYY-MM') AS month,
            COUNT(b.id) AS billing_count,
            SUM(b.hours) AS total_hours,
            SUM(b.total_amount) AS total_amount
          FROM billing b
          WHERE b.date BETWEEN $1 AND $2
          GROUP BY TO_CHAR(b.date, 'YYYY-MM')
          ORDER BY month ASC
        `, [start_date, end_date]);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid report type',
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
      `SELECT id, code, description
         FROM billing_rates
        WHERE is_active = true
     ORDER BY code ASC`
    );

    // Always 200 even if empty – wizard handles empty state
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching billing codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing codes',
      message: error.message
    });
  }
});

// PUT /finance/rates/:id - Update billing rate
router.put('/rates/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const {
      code,
      description,
      amount,
      support_category,
      is_active,
      effective_date,
      end_date
    } = req.body;
    
    // Check if rate exists
    const checkResult = await pool.query('SELECT id FROM billing_rates WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Billing rate not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      values.push(code);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    
    if (amount !== undefined) {
      updates.push(`amount = $${paramIndex++}`);
      values.push(amount);
    }
    
    if (support_category !== undefined) {
      updates.push(`support_category = $${paramIndex++}`);
      values.push(support_category);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }
    
    if (effective_date !== undefined) {
      updates.push(`effective_date = $${paramIndex++}`);
      values.push(effective_date);
    }
    
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(end_date);
    }
    
    // If no fields to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const query = `
      UPDATE billing_rates
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, code, description, amount, support_category, 
                is_active, effective_date, end_date
    `;
    
    values.push(id);
    
    const result = await pool.query(query, values);
    
    // Log the rate change
    try {
      await pool.query(
        `INSERT INTO system_logs (id, severity, category, message, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          uuid.v4(),
          'INFO',
          'FINANCIAL',
          `Billing rate updated: ${result.rows[0].code}`,
          { 
            rate_id: id,
            changes: req.body
          }
        ]
      );
    } catch (logError) {
      console.error('Failed to log to system_logs:', logError);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Billing rate updated successfully'
    });
  } catch (error) {
    console.error('Error updating billing rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update billing rate',
      message: error.message
    });
  }
});

// Helper functions for NDIS billing calculations

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
