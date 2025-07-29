/**
 * dashboardFinanceService.js
 * 
 * Provides financial metrics for the dashboard in multiple time periods:
 * - Day
 * - Week
 * - Fortnight
 * - Month
 * 
 * Includes revenue calculations, staff costs using SCHADS award rates,
 * and basic P&L functionality that integrates with the existing billing system.
 */

const { getDbConnection } = require('../database');
const { pool } = require('../database'); // For PostgreSQL (TGL architecture)

/**
 * Get financial metrics for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} period - 'day', 'week', 'fortnight', 'month'
 * @returns {Promise<Object>} Financial metrics
 */
async function getFinancialMetrics(startDate, endDate, period = 'day') {
  try {
    // Get revenue, staff costs, and admin costs in parallel
    const [revenue, staffCosts, adminPercentage] = await Promise.all([
      calculateRevenue(startDate, endDate),
      calculateStaffCosts(startDate, endDate),
      getAdminPercentage()
    ]);

    // Calculate admin costs based on percentage of revenue
    const adminCosts = revenue * (adminPercentage / 100);
    
    // Calculate profit/loss
    const totalCosts = staffCosts + adminCosts;
    const profitLoss = revenue - totalCosts;
    const profitMargin = revenue > 0 ? (profitLoss / revenue) * 100 : 0;

    return {
      period,
      startDate,
      endDate,
      revenue,
      staffCosts,
      adminCosts,
      totalCosts,
      profitLoss,
      profitMargin,
      metrics: {
        participantsServed: await countParticipantsServed(startDate, endDate),
        staffHours: await calculateTotalStaffHours(startDate, endDate),
        programHours: await calculateProgramHours(startDate, endDate),
        averageRevenuePerParticipant: await calculateAvgRevenuePerParticipant(startDate, endDate)
      }
    };
  } catch (error) {
    console.error('Error calculating financial metrics:', error);
    throw error;
  }
}

/**
 * Calculate revenue for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Total revenue
 */
async function calculateRevenue(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      // TGL architecture query (PostgreSQL)
      const query = `
        SELECT COALESCE(SUM(rli.unit_price), 0) as total_revenue
        FROM loom_participant_attendance lpa
        JOIN loom_instances li ON lpa.instance_id = li.id
        JOIN rules_programs rp ON li.program_id = rp.id
        JOIN rate_line_items rli ON rp.id = rli.program_id
        LEFT JOIN payment_diamonds pd ON lpa.id = pd.attendance_id
        WHERE li.date BETWEEN $1 AND $2
        AND (lpa.status = 'confirmed' OR lpa.status = 'cancelled')
        AND (pd.id IS NULL OR pd.status != 'paid')
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      return parseFloat(result.rows[0].total_revenue) || 0;
    } catch (pgError) {
      // Fall back to SQLite query (legacy system)
      const db = await getDbConnection();
      
      const query = `
        WITH date_range_instances AS (
          SELECT id, program_id, date, start_time, end_time
          FROM program_instances
          WHERE date BETWEEN ? AND ?
        ),
        attendances AS (
          SELECT 
            p.id AS participant_id,
            dri.id AS program_instance_id,
            dri.program_id,
            COALESCE(att.status, 'confirmed') AS status,
            rli.unit_price
          FROM program_enrollments pe
          JOIN participants p ON pe.participant_id = p.id
          JOIN date_range_instances dri ON pe.program_id = dri.program_id
          LEFT JOIN attendance att ON p.id = att.participant_id AND dri.id = att.program_instance_id
          JOIN rate_line_items rli ON dri.program_id = rli.program_id
          WHERE pe.start_date <= dri.date AND (pe.end_date IS NULL OR pe.end_date >= dri.date)
          AND (att.status IS NULL OR att.status = 'confirmed' OR att.status = 'cancelled')
        )
        SELECT COALESCE(SUM(unit_price), 0) as total_revenue
        FROM attendances
      `;
      
      return new Promise((resolve, reject) => {
        db.get(query, [startDate, endDate], (err, row) => {
          if (err) return reject(err);
          resolve(parseFloat(row.total_revenue) || 0);
        });
      });
    }
  } catch (error) {
    console.error('Error calculating revenue:', error);
    throw error;
  }
}

/**
 * Calculate staff costs for a specific date range using SCHADS award rates
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Total staff costs
 */
async function calculateStaffCosts(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      // TGL architecture query (PostgreSQL)
      const query = `
        SELECT 
          s.id,
          s.schads_level,
          EXTRACT(EPOCH FROM (lsa.end_time - lsa.start_time)) / 3600 as hours_worked
        FROM loom_staff_assignments lsa
        JOIN staff s ON lsa.staff_id = s.id
        JOIN loom_instances li ON lsa.instance_id = li.id
        WHERE li.date BETWEEN $1 AND $2
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      
      // Calculate costs based on SCHADS award rates
      return result.rows.reduce((total, row) => {
        const hourlyRate = getSchadsRate(row.schads_level);
        return total + (hourlyRate * row.hours_worked);
      }, 0);
    } catch (pgError) {
      // Fall back to SQLite query (legacy system)
      const db = await getDbConnection();
      
      const query = `
        SELECT 
          s.id,
          s.schads_level,
          (julianday(sa.end_time) - julianday(sa.start_time)) * 24 as hours_worked
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN program_instances pi ON sa.program_instance_id = pi.id
        WHERE pi.date BETWEEN ? AND ?
      `;
      
      return new Promise((resolve, reject) => {
        db.all(query, [startDate, endDate], (err, rows) => {
          if (err) return reject(err);
          
          // Calculate costs based on SCHADS award rates
          const totalCost = rows.reduce((total, row) => {
            const hourlyRate = getSchadsRate(row.schads_level);
            return total + (hourlyRate * row.hours_worked);
          }, 0);
          
          resolve(totalCost);
        });
      });
    }
  } catch (error) {
    console.error('Error calculating staff costs:', error);
    throw error;
  }
}

/**
 * Get SCHADS award hourly rate based on level
 * @param {number|string} level - SCHADS level (1-8)
 * @returns {number} Hourly rate
 */
function getSchadsRate(level) {
  // SCHADS Social and Community Services Employee rates as of July 2025
  // These would typically come from a database or config, but hardcoded for POC
  const rates = {
    1: 28.41,
    2: 32.54,
    3: 34.85,
    4: 36.88,
    5: 39.03,
    6: 43.26,
    7: 46.71,
    8: 50.15
  };
  
  // Default to level 3 if invalid level provided
  return rates[level] || rates[3];
}

/**
 * Get admin expense percentage from settings
 * @returns {Promise<number>} Admin expense percentage
 */
async function getAdminPercentage() {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      const query = `
        SELECT value::numeric as percentage
        FROM settings
        WHERE key = 'admin_expense_percentage'
      `;
      
      const result = await pool.query(query);
      return result.rows.length > 0 ? parseFloat(result.rows[0].percentage) : 15; // Default 15%
    } catch (pgError) {
      // Fall back to SQLite
      const db = await getDbConnection();
      
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT value as percentage FROM settings WHERE key = 'admin_expense_percentage'`,
          [],
          (err, row) => {
            if (err) return reject(err);
            resolve(row ? parseFloat(row.percentage) : 15); // Default 15%
          }
        );
      });
    }
  } catch (error) {
    console.error('Error getting admin percentage:', error);
    return 15; // Default 15% if error
  }
}

/**
 * Count unique participants served in a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Count of unique participants
 */
async function countParticipantsServed(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      const query = `
        SELECT COUNT(DISTINCT participant_id) as count
        FROM loom_participant_attendance lpa
        JOIN loom_instances li ON lpa.instance_id = li.id
        WHERE li.date BETWEEN $1 AND $2
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      return parseInt(result.rows[0].count) || 0;
    } catch (pgError) {
      // Fall back to SQLite
      const db = await getDbConnection();
      
      return new Promise((resolve, reject) => {
        db.get(
          `
          SELECT COUNT(DISTINCT a.participant_id) as count
          FROM attendance a
          JOIN program_instances pi ON a.program_instance_id = pi.id
          WHERE pi.date BETWEEN ? AND ?
          `,
          [startDate, endDate],
          (err, row) => {
            if (err) return reject(err);
            resolve(parseInt(row.count) || 0);
          }
        );
      });
    }
  } catch (error) {
    console.error('Error counting participants served:', error);
    throw error;
  }
}

/**
 * Calculate total staff hours in a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Total staff hours
 */
async function calculateTotalStaffHours(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      const query = `
        SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
        FROM loom_staff_assignments lsa
        JOIN loom_instances li ON lsa.instance_id = li.id
        WHERE li.date BETWEEN $1 AND $2
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      return parseFloat(result.rows[0].total_hours) || 0;
    } catch (pgError) {
      // Fall back to SQLite
      const db = await getDbConnection();
      
      return new Promise((resolve, reject) => {
        db.get(
          `
          SELECT SUM((julianday(end_time) - julianday(start_time)) * 24) as total_hours
          FROM staff_assignments sa
          JOIN program_instances pi ON sa.program_instance_id = pi.id
          WHERE pi.date BETWEEN ? AND ?
          `,
          [startDate, endDate],
          (err, row) => {
            if (err) return reject(err);
            resolve(parseFloat(row.total_hours) || 0);
          }
        );
      });
    }
  } catch (error) {
    console.error('Error calculating total staff hours:', error);
    throw error;
  }
}

/**
 * Calculate total program hours in a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Total program hours
 */
async function calculateProgramHours(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      const query = `
        SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
        FROM loom_instances
        WHERE date BETWEEN $1 AND $2
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      return parseFloat(result.rows[0].total_hours) || 0;
    } catch (pgError) {
      // Fall back to SQLite
      const db = await getDbConnection();
      
      return new Promise((resolve, reject) => {
        db.get(
          `
          SELECT SUM((julianday(end_time) - julianday(start_time)) * 24) as total_hours
          FROM program_instances
          WHERE date BETWEEN ? AND ?
          `,
          [startDate, endDate],
          (err, row) => {
            if (err) return reject(err);
            resolve(parseFloat(row.total_hours) || 0);
          }
        );
      });
    }
  } catch (error) {
    console.error('Error calculating program hours:', error);
    throw error;
  }
}

/**
 * Calculate average revenue per participant in a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Average revenue per participant
 */
async function calculateAvgRevenuePerParticipant(startDate, endDate) {
  try {
    const revenue = await calculateRevenue(startDate, endDate);
    const participantCount = await countParticipantsServed(startDate, endDate);
    
    return participantCount > 0 ? revenue / participantCount : 0;
  } catch (error) {
    console.error('Error calculating average revenue per participant:', error);
    throw error;
  }
}

/**
 * Get financial metrics for today
 * @returns {Promise<Object>} Today's financial metrics
 */
async function getDailyFinancials() {
  const today = new Date().toISOString().split('T')[0];
  return getFinancialMetrics(today, today, 'day');
}

/**
 * Get financial metrics for this week
 * @returns {Promise<Object>} This week's financial metrics
 */
async function getWeeklyFinancials() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
  
  return getFinancialMetrics(
    startOfWeek.toISOString().split('T')[0],
    endOfWeek.toISOString().split('T')[0],
    'week'
  );
}

/**
 * Get financial metrics for this fortnight
 * @returns {Promise<Object>} This fortnight's financial metrics
 */
async function getFortnightlyFinancials() {
  // Determine if we're in week A or week B of the fortnight
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const weekNumber = Math.floor((today - startOfYear) / (7 * 24 * 60 * 60 * 1000));
  const isWeekA = weekNumber % 2 === 0;
  
  // Calculate start of fortnight (either this week or last week)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  
  const startOfFortnight = new Date(startOfWeek);
  if (!isWeekA) {
    startOfFortnight.setDate(startOfWeek.getDate() - 7);
  }
  
  // End of fortnight is 13 days after start (2 weeks - 1 day)
  const endOfFortnight = new Date(startOfFortnight);
  endOfFortnight.setDate(startOfFortnight.getDate() + 13);
  
  return getFinancialMetrics(
    startOfFortnight.toISOString().split('T')[0],
    endOfFortnight.toISOString().split('T')[0],
    'fortnight'
  );
}

/**
 * Get financial metrics for this month
 * @returns {Promise<Object>} This month's financial metrics
 */
async function getMonthlyFinancials() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  return getFinancialMetrics(
    startOfMonth.toISOString().split('T')[0],
    endOfMonth.toISOString().split('T')[0],
    'month'
  );
}

/**
 * Get financial metrics for all time periods
 * @returns {Promise<Object>} Financial metrics for all periods
 */
async function getAllFinancials() {
  try {
    const [daily, weekly, fortnightly, monthly] = await Promise.all([
      getDailyFinancials(),
      getWeeklyFinancials(),
      getFortnightlyFinancials(),
      getMonthlyFinancials()
    ]);
    
    return {
      daily,
      weekly,
      fortnightly,
      monthly
    };
  } catch (error) {
    console.error('Error getting all financials:', error);
    throw error;
  }
}

module.exports = {
  getFinancialMetrics,
  getDailyFinancials,
  getWeeklyFinancials,
  getFortnightlyFinancials,
  getMonthlyFinancials,
  getAllFinancials,
  calculateRevenue,
  calculateStaffCosts
};
