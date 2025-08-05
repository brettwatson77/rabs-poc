const { pool } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Log severity levels
 */
const SEVERITY = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Log categories
 */
const CATEGORY = {
  RESOURCE: 'RESOURCE',
  OPTIMIZATION: 'OPTIMIZATION',
  CONSTRAINT: 'CONSTRAINT',
  SYSTEM: 'SYSTEM',
  OPERATIONAL: 'OPERATIONAL',
  FINANCIAL: 'FINANCIAL'
};

/**
 * Helper function to create a new log entry in the database
 * @param {string} severity - Log severity level
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} details - Additional structured details
 * @param {Array} affectedEntities - Array of affected entities
 * @param {boolean} resolutionRequired - Whether resolution is required
 * @param {Array} resolutionSuggestions - Array of resolution suggestions
 * @returns {Promise<Object>} - Created log entry
 */
const createLogEntry = async (
  severity,
  category,
  message,
  details = {},
  affectedEntities = [],
  resolutionRequired = false,
  resolutionSuggestions = []
) => {
  try {
    const timestamp = new Date();
    const id = uuidv4();
    
    const query = `
      INSERT INTO system_logs (
        id, 
        timestamp, 
        severity, 
        category, 
        message, 
        details, 
        affected_entities, 
        resolution_required, 
        resolution_suggestions
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *
    `;
    
    const values = [
      id,
      timestamp,
      severity,
      category,
      message,
      JSON.stringify(details),
      JSON.stringify(affectedEntities),
      resolutionRequired,
      JSON.stringify(resolutionSuggestions)
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating log entry:', error);
    throw error;
  }
};

/**
 * Helper function to log resource allocation issues
 * @param {string} resourceType - Type of resource (STAFF, VEHICLE, etc.)
 * @param {number} required - Required amount
 * @param {number} available - Available amount
 * @param {Array} affectedPrograms - Programs affected by the shortage
 * @returns {Promise<Object>} - Created log entry
 */
const logResourceIssue = async (resourceType, required, available, affectedPrograms = []) => {
  const shortage = required - available;
  const isShortage = shortage > 0;
  
  if (!isShortage) return null; // Only log if there's an actual shortage
  
  const severity = shortage > required * 0.2 ? SEVERITY.ERROR : SEVERITY.WARN;
  const message = `${resourceType} SHORTAGE: Need ${required}, have ${available} (shortage of ${shortage})`;
  
  const details = {
    resourceType,
    required,
    available,
    shortage,
    date: new Date().toISOString().split('T')[0]
  };
  
  const affectedEntities = affectedPrograms.map(program => ({
    type: 'PROGRAM',
    id: program.id,
    name: program.name,
    unassigned_shifts: program.unassigned_shifts || 1
  }));
  
  const resolutionRequired = true;
  const resolutionSuggestions = [
    'Contact casual staff pool immediately',
    'Review staff availability for the day',
    'Prioritize programs by participant needs'
  ];
  
  return await createLogEntry(
    severity,
    CATEGORY.RESOURCE,
    message,
    details,
    affectedEntities,
    resolutionRequired,
    resolutionSuggestions
  );
};

/**
 * Helper function to log optimization issues (e.g., bus run duration)
 * @param {Object} run - Run details
 * @param {Array} affectedParticipants - Participants affected by the issue
 * @returns {Promise<Object>} - Created log entry
 */
const logOptimizationIssue = async (run, affectedParticipants = []) => {
  const { 
    id, 
    vehicle_id, 
    vehicle_name, 
    target_duration, 
    actual_duration, 
    destination,
    pickup_count,
    distance_km
  } = run;
  
  const difference = actual_duration - target_duration;
  const severity = difference > 30 ? SEVERITY.WARN : SEVERITY.INFO;
  const message = `Bus run to ${destination} exceeds target duration by ${difference} minutes (target: ${target_duration}, actual: ${actual_duration})`;
  
  const details = {
    run_id: id,
    vehicle_id,
    vehicle_name,
    target_duration,
    actual_duration,
    difference,
    destination,
    pickup_count,
    distance_km
  };
  
  const affectedEntities = affectedParticipants.map(participant => ({
    type: 'PARTICIPANT',
    id: participant.id,
    name: `${participant.first_name} ${participant.last_name.charAt(0)}.`
  }));
  
  const resolutionRequired = difference > 45;
  const resolutionSuggestions = [
    'Review program timing to accommodate longer travel',
    'Consider closer pickup points for distant participants'
  ];
  
  return await createLogEntry(
    severity,
    CATEGORY.OPTIMIZATION,
    message,
    details,
    affectedEntities,
    resolutionRequired,
    resolutionSuggestions
  );
};

/**
 * Helper function to log supervision multiplier conflicts
 * @param {Object} program - Program details
 * @param {Array} participants - Participants with supervision multipliers
 * @returns {Promise<Object>} - Created log entry
 */
const logSupervisionConflict = async (program, participants = []) => {
  const totalSupervisionLoad = participants.reduce((sum, p) => sum + (p.supervision_multiplier || 1), 0);
  const currentStaff = program.staff_count || 1;
  const requiredStaff = Math.ceil(totalSupervisionLoad / 3); // Assume 1 staff can handle 3 supervision units
  const shortage = requiredStaff - currentStaff;
  
  if (shortage <= 0) return null; // Only log if there's a shortage
  
  const severity = SEVERITY.ERROR;
  const message = `Supervision multiplier conflict: ${participants.length} participants require ${totalSupervisionLoad.toFixed(2)} supervision units`;
  
  const details = {
    program_id: program.id,
    program_name: program.name,
    total_participants: participants.length,
    total_supervision_load: totalSupervisionLoad,
    current_staff: currentStaff,
    required_staff: requiredStaff,
    shortage
  };
  
  const affectedEntities = participants.map(p => ({
    type: 'PARTICIPANT',
    id: p.id,
    name: `${p.first_name} ${p.last_name.charAt(0)}.`,
    supervision_multiplier: p.supervision_multiplier || 1
  }));
  
  const resolutionRequired = true;
  const resolutionSuggestions = [
    'Add additional support staff',
    'Review participant groupings',
    'Check supervision multiplier accuracy'
  ];
  
  return await createLogEntry(
    severity,
    CATEGORY.CONSTRAINT,
    message,
    details,
    affectedEntities,
    resolutionRequired,
    resolutionSuggestions
  );
};

/**
 * Helper function to log system operational events
 * @param {string} message - Event message
 * @param {Object} details - Event details
 * @returns {Promise<Object>} - Created log entry
 */
const logSystemEvent = async (message, details = {}) => {
  return await createLogEntry(
    SEVERITY.INFO,
    CATEGORY.OPERATIONAL,
    message,
    details,
    [],
    false,
    []
  );
};

/**
 * Helper function to log system errors
 * @param {string} message - Error message
 * @param {Object} details - Error details
 * @param {boolean} isCritical - Whether the error is critical
 * @returns {Promise<Object>} - Created log entry
 */
const logSystemError = async (message, details = {}, isCritical = false) => {
  return await createLogEntry(
    isCritical ? SEVERITY.CRITICAL : SEVERITY.ERROR,
    CATEGORY.SYSTEM,
    message,
    details,
    [],
    true,
    [
      'Check database connection',
      'Verify table structure',
      'Review SQL queries'
    ]
  );
};

/**
 * Get logs with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLogs = async (req, res) => {
  try {
    // Extract query parameters with defaults
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const severity = req.query.severity || 'ALL';
    const category = req.query.category || 'ALL';
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const resolutionRequired = req.query.resolutionRequired === 'true' ? true : null;
    
    // Build the query with filters
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const values = [];
    let paramIndex = 1;
    
    if (severity !== 'ALL') {
      query += ` AND severity = $${paramIndex++}`;
      values.push(severity);
    }
    
    if (category !== 'ALL') {
      query += ` AND category = $${paramIndex++}`;
      values.push(category);
    }
    
    if (startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      values.push(new Date(startDate));
    }
    
    if (endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      values.push(new Date(endDate));
    }
    
    if (resolutionRequired !== null) {
      query += ` AND resolution_required = $${paramIndex++}`;
      values.push(resolutionRequired);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY timestamp DESC';
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);
    
    // Execute the query
    const result = await pool.query(query, values);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM system_logs WHERE 1=1
      ${severity !== 'ALL' ? ' AND severity = $1' : ''}
      ${category !== 'ALL' ? ` AND category = $${severity !== 'ALL' ? 2 : 1}` : ''}
    `;
    
    const countValues = [];
    if (severity !== 'ALL') countValues.push(severity);
    if (category !== 'ALL') countValues.push(category);
    
    const countResult = await pool.query(countQuery, countValues);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Format the response
    const logs = result.rows.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      timestamp_iso: log.timestamp.toISOString(),
      severity: log.severity,
      category: log.category,
      message: log.message,
      details: log.details,
      affected_entities: log.affected_entities,
      resolution_required: log.resolution_required,
      resolution_suggestions: log.resolution_suggestions
    }));
    
    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
};

/**
 * Create a new log entry via API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createLog = async (req, res) => {
  try {
    const {
      severity,
      category,
      message,
      details,
      affected_entities,
      resolution_required,
      resolution_suggestions
    } = req.body;
    
    // Validate required fields
    if (!severity || !category || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: severity, category, message'
      });
    }
    
    // Create the log entry
    const log = await createLogEntry(
      severity,
      category,
      message,
      details || {},
      affected_entities || [],
      resolution_required || false,
      resolution_suggestions || []
    );
    
    res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create log',
      error: error.message
    });
  }
};

/**
 * Clear all logs (for development/testing only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const clearLogs = async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'Clearing logs is only allowed in development environment'
      });
    }
    
    await pool.query('DELETE FROM system_logs');
    
    res.status(200).json({
      success: true,
      message: 'All logs cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear logs',
      error: error.message
    });
  }
};

/**
 * Log the daily loom roll completion
 * @param {Object} data - Roll data
 * @returns {Promise<Object>} - Created log entry
 */
const logLoomRollComplete = async (data) => {
  const {
    date,
    instances_created,
    participants_allocated,
    staff_assigned,
    vehicles_assigned
  } = data;
  
  return await createLogEntry(
    SEVERITY.INFO,
    CATEGORY.OPERATIONAL,
    'Daily loom roll completed successfully',
    {
      date: date || new Date().toISOString().split('T')[0],
      instances_created: instances_created || 0,
      participants_allocated: participants_allocated || 0,
      staff_assigned: staff_assigned || 0,
      vehicles_assigned: vehicles_assigned || 0
    },
    [],
    false,
    []
  );
};

module.exports = {
  // API endpoints
  getLogs,
  createLog,
  clearLogs,
  
  // Helper functions for other parts of the system
  logResourceIssue,
  logOptimizationIssue,
  logSupervisionConflict,
  logSystemEvent,
  logSystemError,
  logLoomRollComplete,
  
  // Constants
  SEVERITY,
  CATEGORY
};
