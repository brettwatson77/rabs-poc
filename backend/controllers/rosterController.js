// backend/controllers/rosterController.js
const rosterService = require('../services/rosterService');

/**
 * Get roster and route sheet data for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRoster = async (req, res) => {
  try {
    // Extract parameters from query string
    const { startDate, endDate, date } = req.query;

    /* --------------------------------------------------------------------
     * Validation:
     *  • Accept EITHER a single `date`
     *  • OR a `startDate` AND `endDate` pair for range requests
     * ------------------------------------------------------------------ */
    if (!date && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required parameters: provide `date` or both `startDate` and `endDate`'
      });
    }
    
    // Call the service to get the roster data
    const rosterParams = date
      ? { date }
      : { startDate, endDate };

    const roster = await rosterService.getRoster(rosterParams);
    
    res.status(200).json({
      success: true,
      data: roster
    });
  } catch (error) {
    console.error(`Error fetching roster for date ${req.query.date}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roster data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get financial metrics for roster period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFinancialMetrics = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;

    // TODO: replace this placeholder with real aggregation once
    // rosterService gains financial calculation helpers
    const metrics = {
      totalStaffCost: 2450.0,
      averageHourlyRate: 28.5,
      totalHours: 86,
      staffUtilization: 75,
      schadsBreakdown: {
        'Level 4': {
          count: 2,
          hours: 32,
          hourlyRate: 26.5,
          totalCost: 848.0
        },
        'Level 5': {
          count: 3,
          hours: 54,
          hourlyRate: 28.5,
          totalCost: 1539.0
        }
      }
    };

    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching roster financial metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching financial metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get timesheet data for roster period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTimesheets = async (req, res) => {
  try {
    const { startDate, endDate, date } = req.query;

    // Placeholder response – implementation will come once timesheet
    // tracking tables/business-logic are available.
    const timesheetData = {
      staff: [],
      dateRange: { startDate, endDate, date },
      totalHours: 0,
      totalCost: 0,
      pendingShiftNotes: 0
    };

    res.status(200).json({
      success: true,
      data: timesheetData
    });
  } catch (error) {
    console.error('Error fetching timesheet data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching timesheet data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


/**
 * Get financial metrics for roster period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRosterMetrics = async (req, res) => {
  try {
    // Extract parameters from query string
    const { startDate, endDate, date } = req.query;

    if (!date && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required parameters: provide `date` or both `startDate` and `endDate`'
      });
    }
    
    // Call the service to get the metrics
    const rosterParams = date
      ? { date }
      : { startDate, endDate };

    const metrics = await rosterService.getRosterMetrics(rosterParams);
    
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error(`Error fetching roster metrics:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roster metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
module.exports = {
  getRoster,
  getFinancialMetrics,
  getTimesheets,
  getRosterMetrics
};

