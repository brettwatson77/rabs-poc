/**
 * backend/services/loomLogger.js
 * 
 * Comprehensive logging service for the loom system that captures
 * operational issues, resource constraints, optimization warnings,
 * and system errors for real-time monitoring and troubleshooting.
 */

const { pool } = require('../database');
const { formatDateForDb } = require('../utils/dateUtils');

// Constants for log severity levels
const SEVERITY = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Constants for log categories
const CATEGORY = {
  RESOURCE: 'RESOURCE',
  OPTIMIZATION: 'OPTIMIZATION',
  CONSTRAINT: 'CONSTRAINT',
  SYSTEM: 'SYSTEM',
  OPERATIONAL: 'OPERATIONAL',
  FINANCIAL: 'FINANCIAL'
};

// In-memory storage for recent logs (for dashboard display)
// Limited to last 1000 entries to prevent memory issues
const recentLogs = [];
const MAX_RECENT_LOGS = 1000;

// WebSocket connections for live updates
let wsConnections = [];

/**
 * Create a new log entry with standard structure
 * @param {String} severity - Log severity level
 * @param {String} category - Log category
 * @param {String} message - Human readable message
 * @param {Object} details - Technical details
 * @param {Array} affected_entities - Affected participants, staff, etc.
 * @param {Boolean} resolution_required - Whether resolution is required
 * @param {Array} resolution_suggestions - Suggested resolution actions
 * @returns {Object} Structured log entry
 */
const createLogEntry = (
  severity, 
  category, 
  message, 
  details = {}, 
  affected_entities = [], 
  resolution_required = false,
  resolution_suggestions = []
) => {
  const timestamp = new Date();
  
  return {
    timestamp,
    timestamp_iso: timestamp.toISOString(),
    severity,
    category,
    message,
    details,
    affected_entities,
    resolution_required,
    resolution_suggestions
  };
};

/**
 * Add log to in-memory storage and persist to database if needed
 * @param {Object} logEntry - The log entry to store
 * @param {Boolean} persist - Whether to persist to database
 */
const storeLog = async (logEntry, persist = true) => {
  // Add to in-memory storage (for dashboard)
  recentLogs.unshift(logEntry);
  
  // Trim if exceeding max size
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.length = MAX_RECENT_LOGS;
  }
  
  // Broadcast to connected WebSockets
  broadcastLog(logEntry);
  
  // Persist to database if required
  if (persist) {
    try {
      await pool.query(`
        INSERT INTO tgl_loom_audit_log (
          timestamp,
          severity,
          category,
          message,
          details,
          affected_entities,
          resolution_required,
          resolution_suggestions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        logEntry.timestamp,
        logEntry.severity,
        logEntry.category,
        logEntry.message,
        JSON.stringify(logEntry.details),
        JSON.stringify(logEntry.affected_entities),
        logEntry.resolution_required,
        JSON.stringify(logEntry.resolution_suggestions)
      ]);
    } catch (error) {
      console.error('Failed to persist log entry to database:', error);
      
      // Create a system error log about the logging failure
      // but don't try to persist it (to avoid infinite recursion)
      const errorLog = createLogEntry(
        SEVERITY.ERROR,
        CATEGORY.SYSTEM,
        'Failed to persist log entry to database',
        { original_log: logEntry, error: error.message },
        [],
        true,
        ['Check database connection', 'Verify tgl_loom_audit_log table exists']
      );
      
      // Only add to in-memory storage
      recentLogs.unshift(errorLog);
      if (recentLogs.length > MAX_RECENT_LOGS) {
        recentLogs.length = MAX_RECENT_LOGS;
      }
      
      // Broadcast the error
      broadcastLog(errorLog);
    }
  }
};

/**
 * Broadcast log to all connected WebSockets
 * @param {Object} logEntry - The log entry to broadcast
 */
const broadcastLog = (logEntry) => {
  // Filter out closed connections
  wsConnections = wsConnections.filter(ws => ws.readyState === 1);
  
  // Broadcast to all connected clients
  wsConnections.forEach(ws => {
    try {
      ws.send(JSON.stringify({
        type: 'NEW_LOG',
        data: logEntry
      }));
    } catch (error) {
      console.error('WebSocket broadcast error:', error);
    }
  });
};

/**
 * Register a WebSocket connection for live updates
 * @param {WebSocket} ws - The WebSocket connection
 */
const registerWebSocket = (ws) => {
  wsConnections.push(ws);
  
  // Send recent logs on connection
  ws.send(JSON.stringify({
    type: 'INITIAL_LOGS',
    data: recentLogs.slice(0, 50) // Send last 50 logs
  }));
};

/**
 * Log a resource shortage (staff, vehicles, etc.)
 * @param {String} resourceType - Type of resource (STAFF, VEHICLE, etc.)
 * @param {Number} required - Number of resources required
 * @param {Number} available - Number of resources available
 * @param {Object} context - Additional context (date, program, etc.)
 * @param {Array} affected - Affected entities (participants, programs)
 * @returns {Object} The created log entry
 */
const logResourceShortage = async (resourceType, required, available, context, affected = []) => {
  const shortage = required - available;
  const message = `${resourceType} SHORTAGE: Need ${required}, have ${available} (shortage of ${shortage})`;
  
  let suggestions = [];
  
  switch (resourceType) {
    case 'STAFF':
      suggestions = [
        'Add casual staff to the roster',
        'Reschedule participants to different programs',
        'Check staff availability for the affected date',
        'Reduce program capacity temporarily'
      ];
      break;
    case 'VEHICLE':
      suggestions = [
        'Rent additional vehicles',
        'Reschedule transport runs',
        'Use external transport providers',
        'Check vehicle maintenance schedule'
      ];
      break;
    case 'VENUE_CAPACITY':
      suggestions = [
        'Find alternative venue',
        'Split program into multiple sessions',
        'Reduce participant numbers',
        'Check venue booking calendar'
      ];
      break;
    default:
      suggestions = [
        'Review resource allocation',
        'Check resource availability',
        'Consider alternative resources'
      ];
  }
  
  const logEntry = createLogEntry(
    shortage > 0 ? SEVERITY.ERROR : SEVERITY.WARN,
    CATEGORY.RESOURCE,
    message,
    {
      resourceType,
      required,
      available,
      shortage,
      ...context
    },
    affected,
    shortage > 0, // Resolution required if actual shortage
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log an optimization warning (bus runs exceeding targets, etc.)
 * @param {String} optimizationType - Type of optimization (BUS_RUN, STAFF_ALLOCATION, etc.)
 * @param {Object} target - Target values
 * @param {Object} actual - Actual values
 * @param {Object} context - Additional context
 * @param {Array} affected - Affected entities
 * @returns {Object} The created log entry
 */
const logOptimizationWarning = async (optimizationType, target, actual, context, affected = []) => {
  let message = '';
  let suggestions = [];
  let severity = SEVERITY.WARN;
  
  switch (optimizationType) {
    case 'BUS_RUN_DURATION':
      const durationDiff = actual.duration - target.duration;
      message = `Bus run duration exceeds target by ${durationDiff} minutes`;
      
      if (durationDiff > 30) {
        severity = SEVERITY.ERROR;
        suggestions = [
          'Review pickup/dropoff sequence',
          'Split into multiple runs',
          'Adjust program start/end times',
          'Consider geographic zones for participants'
        ];
      } else {
        suggestions = [
          'Review route optimization',
          'Check for traffic patterns',
          'Consider minor schedule adjustments'
        ];
      }
      break;
    
    case 'STAFF_UTILIZATION':
      const utilizationDiff = target.utilization - actual.utilization;
      message = `Staff utilization below target by ${Math.round(utilizationDiff * 100)}%`;
      
      suggestions = [
        'Review staff allocation algorithm',
        'Check for scheduling gaps',
        'Consider consolidating programs',
        'Adjust staff hours'
      ];
      break;
      
    case 'VEHICLE_UTILIZATION':
      const capacityDiff = target.capacity - actual.capacity;
      message = `Vehicle utilization below target by ${Math.round(capacityDiff * 100)}%`;
      
      suggestions = [
        'Consolidate transport runs',
        'Use smaller vehicles where appropriate',
        'Review pickup/dropoff grouping',
        'Adjust vehicle allocation strategy'
      ];
      break;
      
    default:
      message = `Optimization warning for ${optimizationType}`;
      suggestions = [
        'Review optimization parameters',
        'Check algorithm constraints',
        'Consider manual adjustment'
      ];
  }
  
  const logEntry = createLogEntry(
    severity,
    CATEGORY.OPTIMIZATION,
    message,
    {
      optimizationType,
      target,
      actual,
      difference: calculateDifference(target, actual),
      ...context
    },
    affected,
    severity === SEVERITY.ERROR, // Resolution required only for severe cases
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a constraint violation (capacity exceeded, conflicts, etc.)
 * @param {String} constraintType - Type of constraint (CAPACITY, QUALIFICATION, etc.)
 * @param {String} message - Description of the violation
 * @param {Object} details - Constraint details
 * @param {Array} affected - Affected entities
 * @returns {Object} The created log entry
 */
const logConstraintViolation = async (constraintType, message, details, affected = []) => {
  let suggestions = [];
  
  switch (constraintType) {
    case 'SUPERVISION_RATIO':
      suggestions = [
        'Add additional support staff',
        'Reduce participant numbers',
        'Review supervision multipliers',
        'Check staff qualifications'
      ];
      break;
      
    case 'VENUE_CAPACITY':
      suggestions = [
        'Find larger venue',
        'Split into multiple sessions',
        'Reduce participant numbers',
        'Check venue capacity settings'
      ];
      break;
      
    case 'VEHICLE_CAPACITY':
      suggestions = [
        'Assign larger vehicle',
        'Split into multiple runs',
        'Review wheelchair requirements',
        'Check vehicle capacity settings'
      ];
      break;
      
    case 'QUALIFICATION':
      suggestions = [
        'Find qualified staff',
        'Review required qualifications',
        'Check staff certification records',
        'Consider training opportunities'
      ];
      break;
      
    case 'TIME_CONFLICT':
      suggestions = [
        'Adjust program times',
        'Reassign staff/vehicles',
        'Review scheduling algorithm',
        'Check for double-bookings'
      ];
      break;
      
    default:
      suggestions = [
        'Review constraint parameters',
        'Check for configuration issues',
        'Consider manual resolution'
      ];
  }
  
  const logEntry = createLogEntry(
    SEVERITY.ERROR,
    CATEGORY.CONSTRAINT,
    message,
    {
      constraintType,
      ...details
    },
    affected,
    true, // Constraint violations always require resolution
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a system error (data issues, failures, etc.)
 * @param {String} errorType - Type of error
 * @param {String} message - Error message
 * @param {Object} details - Error details
 * @param {Boolean} isCritical - Whether the error is critical
 * @returns {Object} The created log entry
 */
const logSystemError = async (errorType, message, details, isCritical = false) => {
  let suggestions = [];
  
  switch (errorType) {
    case 'DATABASE':
      suggestions = [
        'Check database connection',
        'Verify table structure',
        'Review SQL queries',
        'Check for database locks'
      ];
      break;
      
    case 'DATA_INTEGRITY':
      suggestions = [
        'Validate data inputs',
        'Check for missing required fields',
        'Review data validation rules',
        'Run integrity check on affected tables'
      ];
      break;
      
    case 'PROCESSING':
      suggestions = [
        'Review processing logic',
        'Check for edge cases',
        'Verify input parameters',
        'Monitor system resources'
      ];
      break;
      
    case 'CONFIGURATION':
      suggestions = [
        'Review configuration settings',
        'Check for invalid values',
        'Verify system defaults',
        'Restore from backup if needed'
      ];
      break;
      
    default:
      suggestions = [
        'Review error logs',
        'Check system status',
        'Contact system administrator'
      ];
  }
  
  const logEntry = createLogEntry(
    isCritical ? SEVERITY.CRITICAL : SEVERITY.ERROR,
    CATEGORY.SYSTEM,
    message,
    {
      errorType,
      ...details
    },
    [],
    true, // System errors always require resolution
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log an operational alert (weather, cancellations, emergencies)
 * @param {String} alertType - Type of alert
 * @param {String} message - Alert message
 * @param {Object} details - Alert details
 * @param {Array} affected - Affected entities
 * @returns {Object} The created log entry
 */
const logOperationalAlert = async (alertType, message, details, affected = []) => {
  let severity = SEVERITY.INFO;
  let suggestions = [];
  let requiresResolution = false;
  
  switch (alertType) {
    case 'WEATHER':
      severity = SEVERITY.WARN;
      requiresResolution = true;
      suggestions = [
        'Review outdoor activities',
        'Prepare indoor alternatives',
        'Monitor weather updates',
        'Consider rescheduling if severe'
      ];
      break;
      
    case 'CANCELLATION':
      severity = SEVERITY.INFO;
      requiresResolution = false;
      suggestions = [
        'Update affected participants',
        'Reallocate resources',
        'Review financial impact',
        'Consider makeup sessions'
      ];
      break;
      
    case 'EMERGENCY':
      severity = SEVERITY.CRITICAL;
      requiresResolution = true;
      suggestions = [
        'Follow emergency protocols',
        'Contact emergency services if needed',
        'Notify management immediately',
        'Document all actions taken'
      ];
      break;
      
    case 'STAFF_ABSENCE':
      severity = SEVERITY.WARN;
      requiresResolution = true;
      suggestions = [
        'Find replacement staff',
        'Check casual availability',
        'Review impact on programs',
        'Adjust staffing if needed'
      ];
      break;
      
    default:
      severity = SEVERITY.INFO;
      suggestions = [
        'Monitor situation',
        'Update relevant stakeholders',
        'Document for records'
      ];
  }
  
  const logEntry = createLogEntry(
    severity,
    CATEGORY.OPERATIONAL,
    message,
    {
      alertType,
      ...details
    },
    affected,
    requiresResolution,
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a financial or billing issue
 * @param {String} issueType - Type of financial issue
 * @param {String} message - Issue message
 * @param {Object} details - Financial details
 * @param {Array} affected - Affected entities
 * @returns {Object} The created log entry
 */
const logFinancialIssue = async (issueType, message, details, affected = []) => {
  let severity = SEVERITY.WARN;
  let suggestions = [];
  
  switch (issueType) {
    case 'FUNDING_EXHAUSTED':
      severity = SEVERITY.ERROR;
      suggestions = [
        'Review participant NDIS plan',
        'Contact support coordinator',
        'Check billing calculations',
        'Consider service adjustments'
      ];
      break;
      
    case 'BILLING_CODE_MISMATCH':
      severity = SEVERITY.WARN;
      suggestions = [
        'Verify correct NDIS codes',
        'Check participant plan',
        'Review program categorization',
        'Update billing templates'
      ];
      break;
      
    case 'BUDGET_EXCEEDED':
      severity = SEVERITY.ERROR;
      suggestions = [
        'Review cost calculations',
        'Check staff allocations',
        'Optimize resource usage',
        'Adjust program parameters'
      ];
      break;
      
    case 'MISSING_AUTHORIZATION':
      severity = SEVERITY.WARN;
      suggestions = [
        'Contact participant/guardian',
        'Check authorization records',
        'Review communication logs',
        'Follow up with support coordinator'
      ];
      break;
      
    default:
      suggestions = [
        'Review financial records',
        'Check billing system',
        'Verify calculations'
      ];
  }
  
  const logEntry = createLogEntry(
    severity,
    CATEGORY.FINANCIAL,
    message,
    {
      issueType,
      ...details
    },
    affected,
    true, // Financial issues generally require resolution
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a supervision multiplier conflict
 * @param {Object} program - Program details
 * @param {Array} participants - Participants with their supervision multipliers
 * @param {Object} staffing - Current and required staffing
 * @returns {Object} The created log entry
 */
const logSupervisionMultiplierConflict = async (program, participants, staffing) => {
  const totalParticipants = participants.length;
  const totalSupervisionLoad = participants.reduce((sum, p) => sum + (p.supervision_multiplier || 1), 0);
  
  const message = `Supervision multiplier conflict: ${totalParticipants} participants require ${totalSupervisionLoad.toFixed(2)} supervision units`;
  
  const details = {
    program_id: program.id,
    program_name: program.name,
    date: program.date,
    total_participants: totalParticipants,
    total_supervision_load: totalSupervisionLoad,
    current_staff: staffing.current,
    required_staff: staffing.required,
    shortage: staffing.required - staffing.current
  };
  
  const affected = participants.map(p => ({
    type: 'PARTICIPANT',
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    supervision_multiplier: p.supervision_multiplier || 1
  }));
  
  const suggestions = [
    'Add additional support staff',
    'Review participant groupings',
    'Check supervision multiplier accuracy',
    'Consider program modifications for high-support participants'
  ];
  
  const logEntry = createLogEntry(
    SEVERITY.ERROR,
    CATEGORY.CONSTRAINT,
    message,
    details,
    affected,
    true,
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a specific staff shortage scenario
 * @param {String} date - The date of the shortage
 * @param {Number} requiredStaff - Number of staff required
 * @param {Number} availableStaff - Number of staff available
 * @param {Array} unassignedShifts - Details of unassigned shifts
 * @returns {Object} The created log entry
 */
const logStaffShortageScenario = async (date, requiredStaff, availableStaff, unassignedShifts) => {
  const shortage = requiredStaff - availableStaff;
  
  // Create a detailed message about the shortage
  const message = `STAFF SHORTAGE: Need ${requiredStaff} staff for ${date}, only ${availableStaff} available (${shortage} short). ${unassignedShifts.length} shifts unassigned.`;
  
  // Group unassigned shifts by program for better analysis
  const programGroups = {};
  unassignedShifts.forEach(shift => {
    if (!programGroups[shift.program_name]) {
      programGroups[shift.program_name] = [];
    }
    programGroups[shift.program_name].push(shift);
  });
  
  // Create affected entities list
  const affected = [];
  Object.entries(programGroups).forEach(([program, shifts]) => {
    affected.push({
      type: 'PROGRAM',
      name: program,
      unassigned_shifts: shifts.length,
      time: shifts[0].time // Use time of first shift for reference
    });
  });
  
  const suggestions = [
    'Contact casual staff pool immediately',
    'Review staff availability for the day',
    'Prioritize programs by participant needs',
    'Consider consolidating programs if appropriate',
    'Check if any staff can work additional hours'
  ];
  
  const logEntry = createLogEntry(
    SEVERITY.ERROR,
    CATEGORY.RESOURCE,
    message,
    {
      date,
      required_staff: requiredStaff,
      available_staff: availableStaff,
      shortage,
      unassigned_shifts: unassignedShifts,
      program_impact: Object.keys(programGroups).length,
      program_groups: programGroups
    },
    affected,
    true,
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Log a bus run optimization warning for long distance trips
 * @param {Object} run - Bus run details
 * @param {Number} targetDuration - Target duration in minutes
 * @param {Number} actualDuration - Actual duration in minutes
 * @param {String} destination - Destination name (e.g., "Blue Mountains")
 * @returns {Object} The created log entry
 */
const logBusRunOptimizationWarning = async (run, targetDuration, actualDuration, destination) => {
  const durationDiff = actualDuration - targetDuration;
  
  // Create message about the optimization warning
  const message = `Bus run to ${destination} exceeds target duration by ${durationDiff} minutes (target: ${targetDuration}, actual: ${actualDuration})`;
  
  const suggestions = [
    'Review program timing to accommodate longer travel',
    'Consider closer pickup points for distant participants',
    'Check if multiple vehicles could improve efficiency',
    'Evaluate if program location could be changed'
  ];
  
  // Determine if this is a warning or error based on the difference
  const severity = durationDiff > 30 ? SEVERITY.ERROR : SEVERITY.WARN;
  
  const logEntry = createLogEntry(
    severity,
    CATEGORY.OPTIMIZATION,
    message,
    {
      run_id: run.id,
      vehicle_id: run.vehicle_id,
      vehicle_name: run.vehicle_name,
      date: run.date,
      target_duration: targetDuration,
      actual_duration: actualDuration,
      difference: durationDiff,
      destination,
      pickup_count: run.pickup_count,
      distance_km: run.distance_km
    },
    run.participants.map(p => ({
      type: 'PARTICIPANT',
      id: p.id,
      name: p.name
    })),
    severity === SEVERITY.ERROR, // Only require resolution for significant overages
    suggestions
  );
  
  await storeLog(logEntry, true);
  return logEntry;
};

/**
 * Get recent logs for dashboard display
 * @param {Number} limit - Maximum number of logs to return
 * @param {String} severity - Filter by severity (optional)
 * @param {String} category - Filter by category (optional)
 * @returns {Array} Array of recent logs
 */
const getRecentLogs = (limit = 100, severity = null, category = null) => {
  let filteredLogs = [...recentLogs];
  
  // Apply filters if provided
  if (severity) {
    filteredLogs = filteredLogs.filter(log => log.severity === severity);
  }
  
  if (category) {
    filteredLogs = filteredLogs.filter(log => log.category === category);
  }
  
  // Return limited number of logs
  return filteredLogs.slice(0, limit);
};

/**
 * Get historical logs from database
 * @param {Object} filters - Query filters
 * @param {Number} limit - Maximum number of logs to return
 * @param {Number} offset - Offset for pagination
 * @returns {Array} Array of historical logs
 */
const getHistoricalLogs = async (filters = {}, limit = 100, offset = 0) => {
  try {
    // Build query conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.endDate);
    }
    
    if (filters.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(filters.severity);
    }
    
    if (filters.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }
    
    if (filters.resolution_required !== undefined) {
      conditions.push(`resolution_required = $${paramIndex++}`);
      params.push(filters.resolution_required);
    }
    
    // Build the WHERE clause
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // Execute query
    const { rows } = await pool.query(`
      SELECT *
      FROM tgl_loom_audit_log
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);
    
    // Parse JSON fields
    return rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      affected_entities: typeof row.affected_entities === 'string' ? JSON.parse(row.affected_entities) : row.affected_entities,
      resolution_suggestions: typeof row.resolution_suggestions === 'string' ? JSON.parse(row.resolution_suggestions) : row.resolution_suggestions
    }));
  } catch (error) {
    console.error('Error fetching historical logs:', error);
    return [];
  }
};

/**
 * Calculate difference between target and actual values
 * Helper function for optimization warnings
 * @param {Object} target - Target values
 * @param {Object} actual - Actual values
 * @returns {Object} Calculated differences
 */
const calculateDifference = (target, actual) => {
  const diff = {};
  
  // Calculate differences for all numeric properties
  Object.keys(target).forEach(key => {
    if (typeof target[key] === 'number' && typeof actual[key] === 'number') {
      diff[key] = actual[key] - target[key];
      
      // Add percentage difference if meaningful
      if (target[key] !== 0) {
        diff[`${key}_percent`] = (diff[key] / target[key]) * 100;
      }
    }
  });
  
  return diff;
};

/**
 * Clear recent logs (for testing or memory management)
 */
const clearRecentLogs = () => {
  recentLogs.length = 0;
};

module.exports = {
  // Constants
  SEVERITY,
  CATEGORY,
  
  // Core logging functions
  logResourceShortage,
  logOptimizationWarning,
  logConstraintViolation,
  logSystemError,
  logOperationalAlert,
  logFinancialIssue,
  
  // Specific scenario loggers
  logSupervisionMultiplierConflict,
  logStaffShortageScenario,
  logBusRunOptimizationWarning,
  
  // Retrieval functions
  getRecentLogs,
  getHistoricalLogs,
  
  // WebSocket support
  registerWebSocket,
  
  // Utility functions
  clearRecentLogs
};
