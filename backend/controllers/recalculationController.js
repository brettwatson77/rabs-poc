// backend/controllers/recalculationController.js
const recalculationService = require('../services/recalculationService');

/**
 * Controller to trigger the recalculation process based on the simulated date.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const triggerRecalculation = async (req, res) => {
  try {
    // Extract the simulatedDate from the request body
    const { simulatedDate } = req.body;

    // Validate that the simulatedDate was provided
    if (!simulatedDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: simulatedDate is required'
      });
    }

    // Call the service to process pending changes and recalculate resources
    const result = await recalculationService.triggerRecalculation(simulatedDate);

    // Send a success response back to the client
    res.status(200).json({
      success: true,
      message: 'Recalculation process triggered successfully.',
      data: result
    });

  } catch (error) {
    console.error('Error triggering recalculation:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during the recalculation process.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  triggerRecalculation
};
