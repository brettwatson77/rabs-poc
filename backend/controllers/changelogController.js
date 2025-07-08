// backend/controllers/changelogController.js
const { getWeeklyChangeLog: getWeeklyChangeLogService } = require('../services/changelogService');

/**
 * Get all pending enrollment changes that fall within a given date range.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getWeeklyChangeLog = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate that date range is provided
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required.',
      });
    }

    const weeklyLog = await getWeeklyChangeLogService(startDate, endDate);

    res.status(200).json({
      success: true,
      data: weeklyLog,
    });
  } catch (error) {
    console.error('Error fetching weekly change log:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly change log.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  getWeeklyChangeLog,
};
