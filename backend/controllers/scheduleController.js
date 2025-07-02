// backend/controllers/scheduleController.js
const scheduleService = require('../services/scheduleService');

// Get schedule for a date range
const getSchedule = async (req, res) => {
  try {
    // Extract startDate and endDate from query parameters
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: startDate and endDate are required'
      });
    }
    
    // Call the service to get the schedule
    const schedule = await scheduleService.getSchedule(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getSchedule
};
