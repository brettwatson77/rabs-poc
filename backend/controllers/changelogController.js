/**
 * backend/controllers/changeLogController.js
 * 
 * API controller for the change logging system that provides endpoints
 * for retrieving change history and logging different types of changes.
 */

const changeLogger = require('../services/changeLogger');
const { pool } = require('../database');
const logger = require('../utils/logger');

/**
 * Get participant change history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getParticipantChangeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const changeTypes = req.query.change_types ? req.query.change_types.split(',') : [];
    
    // Get participant details
    const { rows: participantRows } = await pool.query(
      'SELECT id, first_name, last_name FROM participants WHERE id = $1',
      [id]
    );
    
    if (participantRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }
    
    const participant = participantRows[0];
    
    // Get change history
    const changes = await changeLogger.getParticipantChangeHistory(id, {
      limit,
      offset,
      start_date: startDate,
      end_date: endDate,
      change_types: changeTypes
    });
    
    // Format changes for display
    const formattedChanges = changes.map(changeLogger.formatChangeForDisplay);
    
    res.json({
      success: true,
      participant: {
        id: participant.id,
        name: `${participant.first_name} ${participant.last_name}`
      },
      total_changes: formattedChanges.length,
      changes: formattedChanges
    });
  } catch (error) {
    logger.error('Error getting participant change history', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get participant change history',
      error: error.message
    });
  }
};

/**
 * Get changes for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDailyChanges = async (req, res) => {
  try {
    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const changeTypes = req.query.change_types ? req.query.change_types.split(',') : [];
    const changeCategories = req.query.change_categories ? req.query.change_categories.split(',') : [];
    
    // Get changes for the date
    const changes = await changeLogger.getDailyChanges(date, {
      limit,
      offset,
      change_types: changeTypes,
      change_categories: changeCategories
    });
    
    // Format changes for display
    const formattedChanges = changes.map(changeLogger.formatChangeForDisplay);
    
    res.json({
      success: true,
      date,
      total_changes: formattedChanges.length,
      changes: formattedChanges
    });
  } catch (error) {
    logger.error('Error getting daily changes', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get daily changes',
      error: error.message
    });
  }
};

/**
 * Get changes for a program instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProgramInstanceChanges = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Program instance ID is required'
      });
    }
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const changeTypes = req.query.change_types ? req.query.change_types.split(',') : [];
    
    // Get program instance details
    const { rows: instanceRows } = await pool.query(
      'SELECT id, program_id, program_name, date FROM tgl_loom_instances WHERE id = $1',
      [id]
    );
    
    if (instanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Program instance not found'
      });
    }
    
    const instance = instanceRows[0];
    
    // Get changes for the program instance
    const changes = await changeLogger.getProgramInstanceChanges(id, {
      limit,
      offset,
      change_types: changeTypes
    });
    
    // Format changes for display
    const formattedChanges = changes.map(changeLogger.formatChangeForDisplay);
    
    res.json({
      success: true,
      instance: {
        id: instance.id,
        program_id: instance.program_id,
        program_name: instance.program_name,
        date: instance.date
      },
      total_changes: formattedChanges.length,
      changes: formattedChanges
    });
  } catch (error) {
    logger.error('Error getting program instance changes', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get program instance changes',
      error: error.message
    });
  }
};

/**
 * Get changes with billing impact
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getBillingImpactChanges = async (req, res) => {
  try {
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const billingStatus = req.query.billing_status;
    
    // Get changes with billing impact
    const changes = await changeLogger.getBillingImpactChanges({
      start_date: startDate,
      end_date: endDate,
      billing_status: billingStatus,
      limit,
      offset
    });
    
    // Format changes for display
    const formattedChanges = changes.map(changeLogger.formatChangeForDisplay);
    
    res.json({
      success: true,
      total_changes: formattedChanges.length,
      changes: formattedChanges
    });
  } catch (error) {
    logger.error('Error getting billing impact changes', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to get billing impact changes',
      error: error.message
    });
  }
};

/**
 * Log a participant joining a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logProgramJoin = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      program_id, 
      effective_date, 
      changed_by, 
      reason,
      program_name,
      days_of_week,
      start_time,
      end_time,
      venue_name,
      billing_codes
    } = req.body;
    
    // Validate required fields
    if (!id || !program_id || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: participant_id, program_id, effective_date, changed_by, reason'
      });
    }
    
    // Log the program join
    const result = await changeLogger.logProgramJoin(
      id,
      program_id,
      new Date(effective_date),
      changed_by,
      reason,
      {
        program_name,
        days_of_week,
        start_time,
        end_time,
        venue_name,
        billing_codes
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log program join',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Program join logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging program join', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log program join',
      error: error.message
    });
  }
};

/**
 * Log a participant leaving a program
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logProgramLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      program_id, 
      effective_date, 
      changed_by, 
      reason,
      program_name,
      days_of_week
    } = req.body;
    
    // Validate required fields
    if (!id || !program_id || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: participant_id, program_id, effective_date, changed_by, reason'
      });
    }
    
    // Log the program leave
    const result = await changeLogger.logProgramLeave(
      id,
      program_id,
      new Date(effective_date),
      changed_by,
      reason,
      {
        program_name,
        days_of_week
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log program leave',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Program leave logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging program leave', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log program leave',
      error: error.message
    });
  }
};

/**
 * Log a participant cancelling attendance for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logProgramCancel = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      program_instance_id, 
      effective_date, 
      changed_by, 
      reason,
      is_billed,
      is_short_notice,
      cancellation_hours
    } = req.body;
    
    // Validate required fields
    if (!id || !program_instance_id || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: participant_id, program_instance_id, effective_date, changed_by, reason'
      });
    }
    
    // Log the program cancellation
    const result = await changeLogger.logProgramCancel(
      id,
      program_instance_id,
      new Date(effective_date),
      changed_by,
      reason,
      is_billed || false,
      {
        is_short_notice,
        cancellation_hours
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log program cancellation',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Program cancellation logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging program cancellation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log program cancellation',
      error: error.message
    });
  }
};

/**
 * Log a program being rescheduled
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logProgramReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      effective_date, 
      changed_by, 
      reason,
      new_date,
      new_start_time,
      new_end_time,
      new_venue_id,
      billing_impact
    } = req.body;
    
    // Validate required fields
    if (!id || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: program_instance_id, effective_date, changed_by, reason'
      });
    }
    
    // Log the program reschedule
    const result = await changeLogger.logProgramReschedule(
      id,
      new Date(effective_date),
      changed_by,
      reason,
      {
        new_date,
        new_start_time,
        new_end_time,
        new_venue_id
      },
      {
        billing_impact
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log program reschedule',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Program reschedule logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging program reschedule', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log program reschedule',
      error: error.message
    });
  }
};

/**
 * Log a staff change (assign, unassign, replace)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logStaffChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      staff_id, 
      change_type, 
      effective_date, 
      changed_by, 
      reason,
      replacement_staff_id,
      replacement_staff_name
    } = req.body;
    
    // Validate required fields
    if (!id || !staff_id || !change_type || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: program_instance_id, staff_id, change_type, effective_date, changed_by, reason'
      });
    }
    
    // Validate change type
    const validChangeTypes = ['ASSIGN', 'UNASSIGN', 'REPLACE', 'STAFF_ASSIGN', 'STAFF_UNASSIGN', 'STAFF_REPLACE'];
    if (!validChangeTypes.includes(change_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid change_type. Must be one of: ${validChangeTypes.join(', ')}`
      });
    }
    
    // If change type is REPLACE, validate replacement_staff_id
    if ((change_type === 'REPLACE' || change_type === 'STAFF_REPLACE') && !replacement_staff_id) {
      return res.status(400).json({
        success: false,
        message: 'replacement_staff_id is required for REPLACE change type'
      });
    }
    
    // Log the staff change
    const result = await changeLogger.logStaffChange(
      staff_id,
      id,
      change_type,
      new Date(effective_date),
      changed_by,
      reason,
      {
        replacement_staff_id,
        replacement_staff_name
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log staff change',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Staff change logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging staff change', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log staff change',
      error: error.message
    });
  }
};

/**
 * Log a vehicle change (assign, unassign)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logVehicleChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      vehicle_id, 
      change_type, 
      effective_date, 
      changed_by, 
      reason,
      run_type
    } = req.body;
    
    // Validate required fields
    if (!id || !vehicle_id || !change_type || !effective_date || !changed_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: program_instance_id, vehicle_id, change_type, effective_date, changed_by, reason'
      });
    }
    
    // Validate change type
    const validChangeTypes = ['ASSIGN', 'UNASSIGN', 'VEHICLE_ASSIGN', 'VEHICLE_UNASSIGN'];
    if (!validChangeTypes.includes(change_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid change_type. Must be one of: ${validChangeTypes.join(', ')}`
      });
    }
    
    // Log the vehicle change
    const result = await changeLogger.logVehicleChange(
      vehicle_id,
      id,
      change_type,
      new Date(effective_date),
      changed_by,
      reason,
      {
        run_type
      }
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log vehicle change',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Vehicle change logged successfully',
      change_id: result.change_id
    });
  } catch (error) {
    logger.error('Error logging vehicle change', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to log vehicle change',
      error: error.message
    });
  }
};

/**
 * Update billing status for a change
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateBillingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      billing_status, 
      updated_by, 
      reason
    } = req.body;
    
    // Validate required fields
    if (!id || !billing_status || !updated_by || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: change_id, billing_status, updated_by, reason'
      });
    }
    
    // Validate billing status
    const validBillingStatuses = ['BILLED', 'NOT_BILLED', 'PENDING', 'NA'];
    if (!validBillingStatuses.includes(billing_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid billing_status. Must be one of: ${validBillingStatuses.join(', ')}`
      });
    }
    
    // Update billing status
    const result = await changeLogger.updateBillingStatus(
      id,
      billing_status,
      updated_by,
      reason
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update billing status',
        error: result.error || result.message
      });
    }
    
    res.json({
      success: true,
      message: 'Billing status updated successfully',
      change: result.change
    });
  } catch (error) {
    logger.error('Error updating billing status', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update billing status',
      error: error.message
    });
  }
};

module.exports = {
  // Get change history
  getParticipantChangeHistory,
  getDailyChanges,
  getProgramInstanceChanges,
  getBillingImpactChanges,
  
  // Log changes
  logProgramJoin,
  logProgramLeave,
  logProgramCancel,
  logProgramReschedule,
  logStaffChange,
  logVehicleChange,
  
  // Update billing status
  updateBillingStatus
};
