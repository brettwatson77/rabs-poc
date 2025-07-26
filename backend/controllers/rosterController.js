// backend/controllers/rosterController.js
const rosterService = require('../services/rosterService');

/**
 * Get roster and route sheet data for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRoster = async (req, res) => {
  try {
    // Extract date from query parameters
    const { date } = req.query;
    
    // Validate required parameters
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: date is required'
      });
    }
    
    // Call the service to get the roster data
    const roster = await rosterService.getRoster(date);
    
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

module.exports = {
  getRoster
};
