/**
 * Program Controller
 * 
 * Handles API endpoints for RABS program creation workflow.
 */

const programService = require('../services/programService');
const logger = require('../utils/logger');
const { isValidDate } = require('../utils/dateUtils');

/**
 * Create a new program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createProgram = async (req, res) => {
  try {
    // Validate required fields
    const { name, start_date, start_time, end_time } = req.body;
    
    const errors = [];
    if (!name) errors.push('Program name is required');
    if (!start_date) errors.push('Start date is required');
    if (!isValidDate(start_date)) errors.push('Invalid start date format (use YYYY-MM-DD)');
    if (!start_time) errors.push('Start time is required');
    if (!end_time) errors.push('End time is required');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    // Set created_by if authenticated user exists
    if (req.user) {
      req.body.created_by = req.user.id;
    } else {
      req.body.created_by = 'system';
    }
    
    // Create program
    const program = await programService.createProgram(req.body);
    
    logger.info(`Program created: ${program.id} (${program.name})`);
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Program created successfully',
      data: program
    });
  } catch (error) {
    logger.error(`Error creating program: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create program',
      error: error.message
    });
  }
};

/**
 * Update an existing program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if program exists
    const existingProgram = await programService.getProgramById(id);
    
    if (!existingProgram) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    // Update program
    const program = await programService.updateProgram(id, req.body);
    
    logger.info(`Program updated: ${id} (${program.name})`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Program updated successfully',
      data: program
    });
  } catch (error) {
    logger.error(`Error updating program: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update program',
      error: error.message
    });
  }
};

/**
 * Get a program by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProgram = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get program
    const program = await programService.getProgramById(id);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    logger.error(`Error getting program: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get program',
      error: error.message
    });
  }
};

/**
 * Get all programs with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPrograms = async (req, res) => {
  try {
    // Extract query parameters
    const { active, windowStart, windowEnd, venue_id } = req.query;
    
    // Build filters
    const filters = {};
    
    if (active !== undefined) {
      filters.active = active === 'true';
    }
    
    if (windowStart && windowEnd) {
      if (!isValidDate(windowStart) || !isValidDate(windowEnd)) {
        return res.status(400).json({
          success: false,
          errors: ['Invalid date format (use YYYY-MM-DD)']
        });
      }
      
      filters.windowStart = windowStart;
      filters.windowEnd = windowEnd;
    }
    
    if (venue_id) {
      filters.venue_id = venue_id;
    }
    
    // Get programs
    const programs = await programService.getPrograms(filters);
    
    // Return success response
    return res.status(200).json({
      success: true,
      count: programs.length,
      data: programs
    });
  } catch (error) {
    logger.error(`Error getting programs: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get programs',
      error: error.message
    });
  }
};

/**
 * Delete a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if program exists
    const existingProgram = await programService.getProgramById(id);
    
    if (!existingProgram) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    // Delete program
    await programService.deleteProgram(id);
    
    logger.info(`Program deleted: ${id}`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Program deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting program: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete program',
      error: error.message
    });
  }
};

/**
 * Force regenerate instances for a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const regenerateInstances = async (req, res) => {
  try {
    const { id } = req.params;
    const { windowStart, windowEnd } = req.body;
    
    // Validate required fields
    const errors = [];
    if (!windowStart) errors.push('Window start date is required');
    if (!windowEnd) errors.push('Window end date is required');
    if (windowStart && !isValidDate(windowStart)) errors.push('Invalid window start date format (use YYYY-MM-DD)');
    if (windowEnd && !isValidDate(windowEnd)) errors.push('Invalid window end date format (use YYYY-MM-DD)');
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    // Check if program exists
    const existingProgram = await programService.getProgramById(id);
    
    if (!existingProgram) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }
    
    // Regenerate instances
    const instanceCount = await programService.regenerateInstances(id, windowStart, windowEnd);
    
    logger.info(`Regenerated ${instanceCount} instances for program ${id}`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Regenerated ${instanceCount} instances`,
      data: {
        program_id: id,
        instance_count: instanceCount,
        window_start: windowStart,
        window_end: windowEnd
      }
    });
  } catch (error) {
    logger.error(`Error regenerating instances: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to regenerate instances',
      error: error.message
    });
  }
};

/**
 * Get dashboard cards for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCardsByDate = async (req, res) => {
  try {
    // Get date from either path param or query param
  const date = req.params.date || req.query.date;
  
  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date parameter is required (YYYY-MM-DD)'
    });
  }
    
    // Validate date
    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        errors: ['Invalid date format (use YYYY-MM-DD)']
      });
    }
    
    // Get cards
    const cards = await programService.getCardsByDate(date);
    
    // Return success response
    return res.status(200).json({
      success: true,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    logger.error(`Error getting cards for date ${req.params.date}: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get cards',
      error: error.message
    });
  }
};

module.exports = {
  createProgram,
  updateProgram,
  getProgram,
  getPrograms,
  deleteProgram,
  regenerateInstances,
  getCardsByDate
};
