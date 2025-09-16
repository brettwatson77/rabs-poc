/**
 * backend/controllers/loomController.js
 *
 * Controller for the Loom system API endpoints.
 * Handles HTTP requests and delegates to the loomEngine service.
 */

const loomEngine = require('../services/loomEngine');
const logger = require('../utils/logger');

/**
 * Generate the loom window
 * @route POST /api/v1/loom/generate
 */
const generateWindow = async (req, res) => {
  try {
    const { windowWeeks } = req.body;
    
    // Validate input
    const weeks = parseInt(windowWeeks, 10) || 4;
    if (weeks < 1 || weeks > 16) {
      return res.status(400).json({
        success: false,
        message: 'Window size must be between 1 and 16 weeks'
      });
    }
    
    logger.info(`Generating loom window with size ${weeks} weeks`);
    
    const result = await loomEngine.generateLoomWindow(weeks);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    return res.status(201).json(result);
  } catch (error) {
    logger.error('Error generating loom window:', error);
    return res.status(500).json({
      success: false,
      message: `Error generating loom window: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Resize the loom window
 * @route PATCH /api/v1/loom/resize
 */
const resizeWindow = async (req, res) => {
  try {
    const { windowWeeks } = req.body;
    
    // Validate input
    const weeks = parseInt(windowWeeks, 10);
    if (!weeks || weeks < 1 || weeks > 16) {
      return res.status(400).json({
        success: false,
        message: 'Window size must be between 1 and 16 weeks'
      });
    }
    
    logger.info(`Resizing loom window to ${weeks} weeks`);
    
    const result = await loomEngine.resizeLoomWindow(weeks);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error resizing loom window:', error);
    return res.status(500).json({
      success: false,
      message: `Error resizing loom window: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Get a specific loom instance by ID
 * @route GET /api/v1/loom/instances/:id
 */
const getInstance = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    logger.info(`Getting loom instance details for ID: ${id}`);
    
    const result = await loomEngine.getLoomInstanceDetails(id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error getting loom instance ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error getting loom instance: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Get loom instances within a date range
 * @route GET /api/v1/loom/instances
 */
const getInstances = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    logger.info(`Getting loom instances from ${startDate} to ${endDate}`);
    
    const result = await loomEngine.getLoomInstances(start, end);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error getting loom instances:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting loom instances: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Allocate participants to a loom instance
 * @route POST /api/v1/loom/instances/:id/allocate-participants
 */
const allocateParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    logger.info(`Allocating participants to loom instance ${id}`);
    
    const result = await loomEngine.allocateParticipants(id);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error allocating participants to loom instance ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error allocating participants: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Assign staff to a loom instance
 * @route POST /api/v1/loom/instances/:id/assign-staff
 */
const assignStaff = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    logger.info(`Assigning staff to loom instance ${id}`);
    
    const result = await loomEngine.assignStaff(id);
    
    if (!result.success) {
      // This could be a legitimate case (not enough staff)
      // So we return 200 with the failure info, not 404 or 500
      return res.status(200).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error assigning staff to loom instance ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error assigning staff: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Assign vehicles to a loom instance
 * @route POST /api/v1/loom/instances/:id/assign-vehicles
 */
const assignVehicles = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    logger.info(`Assigning vehicles to loom instance ${id}`);
    
    const result = await loomEngine.assignVehicles(id);
    
    if (!result.success) {
      // This could be a legitimate case (not enough vehicles)
      // So we return 200 with the failure info, not 404 or 500
      return res.status(200).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error assigning vehicles to loom instance ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error assigning vehicles: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Cancel a participant allocation
 * @route PATCH /api/v1/loom/allocations/:id/cancel
 */
const cancelParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Allocation ID is required'
      });
    }
    
    // Validate cancellation type
    if (!type || !['normal', 'short_notice'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid cancellation type (normal or short_notice) is required'
      });
    }
    
    logger.info(`Processing ${type} cancellation for allocation ${id}`);
    
    const result = await loomEngine.handleParticipantCancellation(id, type);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error processing cancellation for allocation ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error processing cancellation: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Report staff sickness for a shift
 * @route PATCH /api/v1/loom/shifts/:id/sick
 */
const reportStaffSickness = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Shift ID is required'
      });
    }
    
    logger.info(`Processing staff sickness for shift ${id}`);
    
    const result = await loomEngine.handleStaffSickness(id);
    
    // Even if no replacement found, this is a valid response (flagged for manual intervention)
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error processing staff sickness for shift ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error processing staff sickness: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Reoptimize a loom instance
 * @route POST /api/v1/loom/instances/:id/reoptimize
 */
const reoptimizeInstance = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    logger.info(`Reoptimizing loom instance ${id}`);
    
    const result = await loomEngine.reoptimizeInstance(id);
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error reoptimizing loom instance ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error reoptimizing instance: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Get the current loom window size
 * @route GET /api/v1/loom/window-size
 */
const getWindowSize = async (req, res) => {
  try {
    logger.info('Getting current loom window size');
    
    const windowSize = await loomEngine.getLoomWindowSize();
    
    return res.status(200).json({
      success: true,
      data: {
        windowWeeks: windowSize
      }
    });
  } catch (error) {
    logger.error('Error getting loom window size:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting window size: ${error.message}`,
      error: error.toString()
    });
  }
};

/**
 * Get current loom window (start and end dates)
 * @route GET /api/v1/loom/window
 */
const getWindow = async (req, res) => {
  try {
    const result = await loomEngine.getLoomWindow();
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error getting loom window:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting loom window: ${error.message}`,
      error: error.toString()
    });
  }
};

module.exports = {
  generateWindow,
  resizeWindow,
  getInstance,
  getInstances,
  allocateParticipants,
  assignStaff,
  assignVehicles,
  cancelParticipant,
  reportStaffSickness,
  reoptimizeInstance,
  getWindowSize,
  getWindow,
  rollNow
};

/**
 * Trigger an immediate loom roll
 * @route POST /api/v1/loom/roll
 */
async function rollNow (req, res) {
  try {
    logger.info('Manual loom roll triggered via API');

    // Delegate to service (must exist).  If not yet implemented, throw.
    if (typeof loomEngine.rollNow !== 'function') {
      throw new Error('loomEngine.rollNow() not implemented');
    }

    const result = await loomEngine.rollNow();

    if (!result || result.success === false) {
      return res.status(500).json({
        success: false,
        message: result?.message || 'Failed to roll loom',
        error: result?.error || null
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Loom rolled successfully',
      data: result.data || {}
    });
  } catch (error) {
    logger.error('Error performing manual loom roll:', error);
    return res.status(500).json({
      success: false,
      message: `Error performing manual roll: ${error.message}`,
      error: error.toString()
    });
  }
}
