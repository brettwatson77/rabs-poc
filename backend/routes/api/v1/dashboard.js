/**
 * dashboard.js - API Routes for Enhanced Dashboard
 * 
 * Provides endpoints for financial metrics, timeline cards, and timesheet exports
 * with support for SCHADS calculations and supervision multipliers.
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../middleware/auth');
const { pool } = require('../../../database');
const logger = require('../../../utils/logger');

/**
 * Helper – validate & parse start/end query params
 */
function parseDateRange(req, res) {
  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ success: false, message: 'Both start and end dates are required' });
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate) || isNaN(endDate)) {
    res.status(400).json({ success: false, message: 'Invalid date format' });
    return null;
  }
  return { startDate, endDate };
}

/**
 * @route   GET /api/v1/dashboard/metrics
 * @desc    Get KPI metrics for the dashboard
 * @access  Private
 */
router.get('/metrics', isAuthenticated, async (req, res) => {
  try {
    /* ------------------------------------------------------------------
     * SIMPLE, NON-TGL IMPLEMENTATION
     * ------------------------------------------------------------------
     * Use the core tables that already exist (participants, programs,
     * vehicles, staff).  More sophisticated KPIs can replace these once
     * The Great Loom architecture is live.
     * ---------------------------------------------------------------- */

    const [
      participantCount,
      programCount,
      vehicleCount
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM participants'),
      pool.query('SELECT COUNT(*) FROM programs'),
      pool.query("SELECT COUNT(*) FROM vehicles WHERE status = 'active'")
    ]);

    const data = {
      totalParticipants : parseInt(participantCount.rows[0].count, 10),
      totalPrograms     : parseInt(programCount.rows[0].count, 10),
      vehiclesInUse     : parseInt(vehicleCount.rows[0].count, 10),
      totalServiceHours : 0,   // Placeholder until TGL provides real data
      totalRevenue      : 0    // Placeholder until billing engine ready
    };

    return res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/v1/dashboard/master-cards
 * @desc    Get master cards with P&L calculations
 * @access  Admin
 */
router.get('/master-cards', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    /* --------------------------------------------------------------
     * SIMPLE PLACEHOLDER IMPLEMENTATION
     * --------------------------------------------------------------
     * Full P&L logic relies on TGL tables that are not yet available.
     * For now, return an empty array so the Finance page does not hang.
     * ------------------------------------------------------------ */
    return res.json({
      success: true,
      count  : 0,
      data   : []
    });
  } catch (error) {
    logger.error('Error fetching master cards with P&L:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/v1/dashboard/financials
 * @desc    Provide placeholder financial data for one period
 * @access  Admin
 *
 * Finance page calls this endpoint with ?start=<date>&period=<period>
 * We ignore start date for now (no real calculations yet) and simply
 * return the same placeholder block used in /financials/all.
 */
router.get('/financials', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const { period = 'day' } = req.query;            // day | week | fortnight | month

    const [
      participantRes,
      programRes,
      vehicleRes,
      staffRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM participants'),
      pool.query('SELECT COUNT(*) FROM programs'),
      pool.query("SELECT COUNT(*) FROM vehicles WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM staff')
    ]);

    const base = {
      totalParticipants : parseInt(participantRes.rows[0].count, 10),
      totalPrograms     : parseInt(programRes.rows[0].count, 10),
      vehiclesInUse     : parseInt(vehicleRes.rows[0].count, 10),
      totalStaff        : parseInt(staffRes.rows[0].count, 10),
      totalRevenue      : 0,
      totalCosts        : 0,
      profitLoss        : 0
    };

    return res.json({
      success: true,
      data: { [period]: base }
    });
  } catch (err) {
    logger.error('Error generating placeholder financials (single period):', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/v1/dashboard/financials/all
 * @desc    Provide placeholder financial data for all periods
 * @access  Admin
 *
 * The Finance page expects this endpoint during early-stage development.
 * Until the full billing engine is in place, return static / derived values
 * so the UI can render without 404 errors.
 */
router.get('/financials/all', isAuthenticated, hasRole('admin'), async (_req, res) => {
  try {
    /* --------------------------------------------------------------
     * Very lightweight query set – counts only.
     * Replace with real calculations once rate_line_items + TGL live.
     * ------------------------------------------------------------ */
    const [
      participantRes,
      programRes,
      vehicleRes,
      staffRes
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM participants'),
      pool.query('SELECT COUNT(*) FROM programs'),
      pool.query("SELECT COUNT(*) FROM vehicles WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM staff')
    ]);

    const base = {
      totalParticipants : parseInt(participantRes.rows[0].count, 10),
      totalPrograms     : parseInt(programRes.rows[0].count, 10),
      vehiclesInUse     : parseInt(vehicleRes.rows[0].count, 10),
      totalStaff        : parseInt(staffRes.rows[0].count, 10),
      totalRevenue      : 0,   // Placeholder
      totalCosts        : 0,   // Placeholder
      profitLoss        : 0    // Placeholder
    };

    /* Return same structure for each period so the frontend tabs work */
    return res.json({
      success: true,
      data: {
        day       : base,
        week      : base,
        fortnight : base,
        month     : base
      }
    });
  } catch (err) {
    logger.error('Error generating placeholder financials:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/v1/dashboard/timeline
 * @desc    Placeholder timeline endpoint expected by Dashboard page.
 *          Returns the five timeline columns with empty arrays so the
 *          React component renders without crashing or 404-spinning.
 * @access  Private
 */
router.get('/timeline', isAuthenticated, async (_req, res) => {
  try {
    /* --------------------------------------------------------------
     * Future implementation will pull real card data once The Great
     * Loom is operational.  For now, simply return empty buckets so
     * the Dashboard UI can mount and the developer can continue work
     * without white-screen errors.
     * ------------------------------------------------------------ */
    return res.json({
      success: true,
      data   : {
        earlier : [],
        before  : [],
        now     : [],
        next    : [],
        later   : []
      }
    });
  } catch (err) {
    logger.error('Error fetching placeholder timeline:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/v1/dashboard/supervision-stats
 * @desc    Get supervision multiplier statistics
 * @access  Admin
 */
router.get('/supervision-stats', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    /* ------------------------------------------------------------------
     * SIMPLE IMPLEMENTATION (non-TGL)
     * ------------------------------------------------------------------
     * Use data we already have in the `participants` table to provide
     * meaningful supervision statistics so the Finance page can render.
     * ---------------------------------------------------------------- */

    const statsQuery = `
      SELECT
        COUNT(*)                                   AS total_instances,
        SUM(CASE WHEN supervision_multiplier > 1
                 THEN 1 ELSE 0 END)               AS instances_with_multiplier_impact,
        COALESCE(
          AVG(CASE WHEN supervision_multiplier > 1
                   THEN supervision_multiplier - 1
                   ELSE NULL END), 0)             AS avg_multiplier_impact
      FROM participants
    `;

    const result = await pool.query(statsQuery);

    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching supervision statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
