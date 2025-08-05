/**
 * Intention Controller
 * 
 * Handles CRUD operations for operator intents and temporal exceptions
 * Implements the "from this date forward" pattern for persistent changes
 * and one-off exceptions for specific dates.
 */

const { pool } = require('../database');
const { formatDateForDb, parseDbDate, getTodaySydney, isValidDate } = require('../utils/dateUtils');
const logger = require('../utils/logger');
// Loom services (for immediate intent application when required)
const { createProgramFromIntent } = require('../services/loomRoller');

/**
 * Validate intent data
 * @param {Object} data - Intent data to validate
 * @returns {Object} - { isValid, errors }
 */
const validateIntentData = (data) => {
  const errors = [];
  
  // Check required fields based on intent type
  if (!data.intent_type) {
    errors.push('Intent type is required');
  } else {
    // Validate required fields based on intent type
    switch (data.intent_type) {
      case 'ADD_PARTICIPANT':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.participant_id) errors.push('Participant ID is required');
        if (!data.billing_code_id) errors.push('Billing code ID is required');
        if (!data.hours) errors.push('Hours are required');
        break;
        
      case 'REMOVE_PARTICIPANT':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.participant_id) errors.push('Participant ID is required');
        break;
        
      case 'MODIFY_TIME':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.start_time) errors.push('Start time is required');
        if (!data.end_time) errors.push('End time is required');
        break;
        
      case 'CHANGE_VENUE':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.venue_id) errors.push('Venue ID is required');
        break;
        
      case 'ASSIGN_STAFF':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.staff_id) errors.push('Staff ID is required');
        break;
        
      /* --------------------------------------------------------------
       * New intent type: CREATE_PROGRAM
       * --------------------------------------------------------------
       *  • Used by MasterSchedule to create an entirely new program
       *    via the operator-intent layer instead of a direct insert.
       *  • program_id is expected to be null/undefined for creation.
       *  • start / end date-time fields are mandatory.
       * -------------------------------------------------------------- */
      case 'CREATE_PROGRAM':
        if (!data.start_date) errors.push('Start date is required');
        if (!data.start_time) errors.push('Start time is required');
        if (!data.end_time)   errors.push('End time is required');
        // Note: program_id intentionally NOT required for create
        break;
        
      default:
        errors.push(`Unknown intent type: ${data.intent_type}`);
    }
  }
  
  // Validate dates
  if (!data.start_date) {
    errors.push('Start date is required');
  } else if (!isValidDate(data.start_date)) {
    errors.push('Invalid start date format (use YYYY-MM-DD)');
  } else {
    // Check that start date is today or in the future
    const today = getTodaySydney();
    const startDate = new Date(data.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      errors.push('Start date must be today or in the future');
    }
    
    // If end date is provided, validate it
    if (data.end_date) {
      if (!isValidDate(data.end_date)) {
        errors.push('Invalid end date format (use YYYY-MM-DD)');
      } else {
        const endDate = new Date(data.end_date);
        endDate.setHours(0, 0, 0, 0);
        
        if (endDate <= startDate) {
          errors.push('End date must be after start date');
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate exception data
 * @param {Object} data - Exception data to validate
 * @returns {Object} - { isValid, errors }
 */
const validateExceptionData = (data) => {
  const errors = [];
  
  // Check required fields based on exception type
  if (!data.exception_type) {
    errors.push('Exception type is required');
  } else {
    // Validate required fields based on exception type
    switch (data.exception_type) {
      case 'PARTICIPANT_CANCELLATION':
        if (!data.program_id) errors.push('Program ID is required');
        if (!data.participant_id) errors.push('Participant ID is required');
        break;
        
      case 'PROGRAM_CANCELLATION':
        if (!data.program_id) errors.push('Program ID is required');
        break;
        
      case 'ONE_OFF_CHANGE':
        if (!data.program_id) errors.push('Program ID is required');
        // At least one change field is required
        if (!data.details || (
            !data.details.start_time && 
            !data.details.end_time && 
            !data.details.venue_id
          )) {
          errors.push('At least one change (start_time, end_time, venue_id) is required');
        }
        break;
        
      default:
        errors.push(`Unknown exception type: ${data.exception_type}`);
    }
  }
  
  // Validate exception date
  if (!data.exception_date) {
    errors.push('Exception date is required');
  } else if (!isValidDate(data.exception_date)) {
    errors.push('Invalid exception date format (use YYYY-MM-DD)');
  } else {
    // Check that exception date is today or in the future
    const today = getTodaySydney();
    const exceptionDate = new Date(data.exception_date);
    exceptionDate.setHours(0, 0, 0, 0);
    
    if (exceptionDate < today) {
      errors.push('Exception date must be today or in the future');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check for conflicting intents
 * @param {Object} client - Database client
 * @param {Object} data - Intent data
 * @param {String} excludeId - Intent ID to exclude (for updates)
 * @returns {Promise<Boolean>} - True if conflicts exist
 */
const checkConflictingIntents = async (client, data, excludeId = null) => {
  // Different conflict checks based on intent type
  switch (data.intent_type) {
    case 'ADD_PARTICIPANT':
      // Check if participant is already in this program for the date range
      const addParticipantQuery = `
        SELECT id FROM tgl_operator_intents
        WHERE intent_type = 'ADD_PARTICIPANT'
        AND program_id = $1
        AND participant_id = $2
        AND start_date <= $3
        AND (end_date IS NULL OR end_date >= $4)
        ${excludeId ? 'AND id != $5' : ''}
      `;
      
      const addParams = [
        data.program_id,
        data.participant_id,
        data.end_date || '9999-12-31', // If no end date, check against far future
        data.start_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const addResult = await client.query(addParticipantQuery, addParams);
      return addResult.rows.length > 0;
      
    case 'REMOVE_PARTICIPANT':
      // Check if there's already a removal intent for this participant/program/date
      const removeParticipantQuery = `
        SELECT id FROM tgl_operator_intents
        WHERE intent_type = 'REMOVE_PARTICIPANT'
        AND program_id = $1
        AND participant_id = $2
        AND start_date = $3
        ${excludeId ? 'AND id != $4' : ''}
      `;
      
      const removeParams = [
        data.program_id,
        data.participant_id,
        data.start_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const removeResult = await client.query(removeParticipantQuery, removeParams);
      return removeResult.rows.length > 0;
      
    case 'MODIFY_TIME':
      // Check for overlapping time modifications
      const modifyTimeQuery = `
        SELECT id FROM tgl_operator_intents
        WHERE intent_type = 'MODIFY_TIME'
        AND program_id = $1
        AND start_date <= $2
        AND (end_date IS NULL OR end_date >= $3)
        ${excludeId ? 'AND id != $4' : ''}
      `;
      
      const timeParams = [
        data.program_id,
        data.end_date || '9999-12-31',
        data.start_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const timeResult = await client.query(modifyTimeQuery, timeParams);
      return timeResult.rows.length > 0;
      
    case 'CHANGE_VENUE':
      // Check for overlapping venue changes
      const changeVenueQuery = `
        SELECT id FROM tgl_operator_intents
        WHERE intent_type = 'CHANGE_VENUE'
        AND program_id = $1
        AND start_date <= $2
        AND (end_date IS NULL OR end_date >= $3)
        ${excludeId ? 'AND id != $4' : ''}
      `;
      
      const venueParams = [
        data.program_id,
        data.end_date || '9999-12-31',
        data.start_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const venueResult = await client.query(changeVenueQuery, venueParams);
      return venueResult.rows.length > 0;
      
    case 'ASSIGN_STAFF':
      // Check for overlapping staff assignments
      const assignStaffQuery = `
        SELECT id FROM tgl_operator_intents
        WHERE intent_type = 'ASSIGN_STAFF'
        AND program_id = $1
        AND staff_id = $2
        AND start_date <= $3
        AND (end_date IS NULL OR end_date >= $4)
        ${excludeId ? 'AND id != $5' : ''}
      `;
      
      const staffParams = [
        data.program_id,
        data.staff_id,
        data.end_date || '9999-12-31',
        data.start_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const staffResult = await client.query(assignStaffQuery, staffParams);
      return staffResult.rows.length > 0;
      
    default:
      return false;
  }
};

/**
 * Check for conflicting exceptions
 * @param {Object} client - Database client
 * @param {Object} data - Exception data
 * @param {String} excludeId - Exception ID to exclude (for updates)
 * @returns {Promise<Boolean>} - True if conflicts exist
 */
const checkConflictingExceptions = async (client, data, excludeId = null) => {
  switch (data.exception_type) {
    case 'PARTICIPANT_CANCELLATION':
      // Check if participant is already cancelled for this date/program
      const participantQuery = `
        SELECT id FROM tgl_temporal_exceptions
        WHERE exception_type = 'PARTICIPANT_CANCELLATION'
        AND program_id = $1
        AND participant_id = $2
        AND exception_date = $3
        ${excludeId ? 'AND id != $4' : ''}
      `;
      
      const participantParams = [
        data.program_id,
        data.participant_id,
        data.exception_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const participantResult = await client.query(participantQuery, participantParams);
      return participantResult.rows.length > 0;
      
    case 'PROGRAM_CANCELLATION':
      // Check if program is already cancelled for this date
      const programQuery = `
        SELECT id FROM tgl_temporal_exceptions
        WHERE exception_type = 'PROGRAM_CANCELLATION'
        AND program_id = $1
        AND exception_date = $2
        ${excludeId ? 'AND id != $3' : ''}
      `;
      
      const programParams = [
        data.program_id,
        data.exception_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const programResult = await client.query(programQuery, programParams);
      return programResult.rows.length > 0;
      
    case 'ONE_OFF_CHANGE':
      // Check if there's already a one-off change for this program/date
      const oneOffQuery = `
        SELECT id FROM tgl_temporal_exceptions
        WHERE exception_type = 'ONE_OFF_CHANGE'
        AND program_id = $1
        AND exception_date = $2
        ${excludeId ? 'AND id != $3' : ''}
      `;
      
      const oneOffParams = [
        data.program_id,
        data.exception_date,
        ...(excludeId ? [excludeId] : [])
      ];
      
      const oneOffResult = await client.query(oneOffQuery, oneOffParams);
      return oneOffResult.rows.length > 0;
      
    default:
      return false;
  }
};

/**
 * Log an audit entry for intent/exception operations
 * @param {Object} client - Database client
 * @param {String} action - Action performed
 * @param {String} entityType - 'INTENT' or 'EXCEPTION'
 * @param {String} entityId - ID of the entity
 * @param {Object} details - Additional details
 */
const logAuditEntry = async (client, action, entityType, entityId, details = {}) => {
  try {
    await client.query(
      `INSERT INTO tgl_loom_audit_log (action, details, status)
       VALUES ($1, $2, $3)`,
      [
        `${action}_${entityType}`,
        JSON.stringify({
          id: entityId,
          ...details
        }),
        'SUCCESS'
      ]
    );
  } catch (error) {
    logger.error(`Failed to log audit entry: ${error.message}`, { error });
  }
};

// ---------------------- INTENT CONTROLLER METHODS ----------------------

/**
 * Create a new operator intent
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createIntent = async (req, res) => {
  const client = await pool.connect();

  try {
    // 1. Validate the request data
    const validation = validateIntentData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        errors: validation.errors 
      });
    }

    // 2. Start transaction
    await client.query('BEGIN');

    // 3. Check for conflicts (except for CREATE_PROGRAM which is always new)
    if (req.body.intent_type !== 'CREATE_PROGRAM') {
      const hasConflicts = await checkConflictingIntents(client, req.body);
      if (hasConflicts) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Conflicting intent exists for the specified date range'
        });
      }
    }

    // 4. Extract all fields from request body
    const {
      intent_type,
      program_id,
      participant_id,
      staff_id,
      vehicle_id,
      venue_id,
      start_date,
      end_date,
      start_time,
      end_time,
      days_of_week,
      notes,
      participants,
      // Additional fields from MasterSchedule.jsx
      name,
      type,
      repeatPattern,
      timeSlots,
      staffAssignment
    } = req.body;

    // 5. Prepare metadata - store ALL complex program creation fields
    const metadataObj = {
      // Basic program info
      name,
      type,
      notes,
      
      // Time information
      start_time,
      end_time,
      
      // Repeating pattern info
      repeatPattern,
      days_of_week: days_of_week || [],
      
      // Complex time slots array with activities
      timeSlots,
      
      // Staff assignment strategy
      staffAssignment,
      
      // For other intent types
      billing_code_id: req.body.billing_code_id || null,
      hours: req.body.hours || null,
      details: req.body.details || null
    };

    // 6. Insert the intent with only columns that actually exist in the database
    const result = await client.query(
      `INSERT INTO tgl_operator_intents (
        intent_type, program_id, participant_id, staff_id, vehicle_id,
        venue_id, start_date, end_date, metadata, billing_codes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        intent_type,
        program_id || null,
        participant_id || null,
        staff_id || null,
        vehicle_id || null,
        venue_id || null,
        start_date,
        end_date || null,
        JSON.stringify(metadataObj),
        participants ? JSON.stringify(participants) : null,
        'system' // No user system, use 'system' as creator
      ]
    );

    const intentId = result.rows[0].id;

    /* ------------------------------------------------------------------
     * 7.  Immediate processing for CREATE_PROGRAM intents
     *     – Create the actual program record right away so users
     *       see cards and roster shifts without waiting for nightly roll.
     * ------------------------------------------------------------------ */
    if (intent_type === 'CREATE_PROGRAM') {
      try {
        await createProgramFromIntent(client, intentId, req.body);
        logger.info(`Created program immediately for intent ${intentId}`);
      } catch (programError) {
        // Non-fatal – the daily loom roll can still process it later
        logger.warn(
          `Failed to create program for intent ${intentId}: ${programError.message}`
        );
      }
    }

    // 7. Log the action
    await logAuditEntry(client, 'CREATE', 'INTENT', intentId, {
      intent_type,
      program_id: program_id || null,
      start_date,
      end_date: end_date || null
    });

    // 8. Commit transaction
    await client.query('COMMIT');

    // 9. Return success response
    return res.status(201).json({
      success: true,
      message: 'Intent created successfully',
      data: {
        id: intentId,
        intent_type,
        program_id: program_id || null,
        start_date,
        end_date: end_date || null
      }
    });
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error creating intent: ${error.message}`, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create intent',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get all intents with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getIntents = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const {
      program_id,
      participant_id,
      staff_id,
      intent_type,
      start_date,
      end_date,
      active_on
    } = req.query;
    
    // Build the query
    let query = `
      SELECT i.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name,
        s.first_name || ' ' || s.last_name as staff_name,
        v.name as venue_name
      FROM tgl_operator_intents i
      LEFT JOIN programs p ON i.program_id = p.id
      LEFT JOIN participants part ON i.participant_id = part.id
      LEFT JOIN staff s ON i.staff_id = s.id
      LEFT JOIN venues v ON i.venue_id = v.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (program_id) {
      query += ` AND i.program_id = $${paramIndex}`;
      params.push(program_id);
      paramIndex++;
    }
    
    if (participant_id) {
      query += ` AND i.participant_id = $${paramIndex}`;
      params.push(participant_id);
      paramIndex++;
    }
    
    if (staff_id) {
      query += ` AND i.staff_id = $${paramIndex}`;
      params.push(staff_id);
      paramIndex++;
    }
    
    if (intent_type) {
      query += ` AND i.intent_type = $${paramIndex}`;
      params.push(intent_type);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND i.start_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND (i.end_date IS NULL OR i.end_date <= $${paramIndex})`;
      params.push(end_date);
      paramIndex++;
    }
    
    // Filter for intents active on a specific date
    if (active_on) {
      query += ` AND i.start_date <= $${paramIndex} AND (i.end_date IS NULL OR i.end_date >= $${paramIndex})`;
      params.push(active_on);
      paramIndex++;
    }
    
    // Order by start date (newest first)
    query += ` ORDER BY i.start_date DESC, i.created_at DESC`;
    
    // Execute the query
    const { rows } = await pool.query(query, params);
    
    // Return the results
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    logger.error(`Error fetching intents: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch intents',
      error: error.message
    });
  }
};

/**
 * Get a single intent by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getIntentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Query for the intent with related data
    const query = `
      SELECT i.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name,
        s.first_name || ' ' || s.last_name as staff_name,
        v.name as venue_name
      FROM tgl_operator_intents i
      LEFT JOIN programs p ON i.program_id = p.id
      LEFT JOIN participants part ON i.participant_id = part.id
      LEFT JOIN staff s ON i.staff_id = s.id
      LEFT JOIN venues v ON i.venue_id = v.id
      WHERE i.id = $1
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Intent not found'
      });
    }
    
    // Return the intent
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    logger.error(`Error fetching intent: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch intent',
      error: error.message
    });
  }
};

/**
 * Update an existing intent
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateIntent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Check if intent exists
    const checkResult = await client.query(
      'SELECT * FROM tgl_operator_intents WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Intent not found'
      });
    }
    
    const existingIntent = checkResult.rows[0];
    
    // Merge existing data with updates
    const updatedData = {
      ...existingIntent,
      ...req.body
    };
    
    // Validate the updated data
    const validation = validateIntentData(updatedData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check for conflicts
    const hasConflicts = await checkConflictingIntents(client, updatedData, id);
    if (hasConflicts) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Conflicting intent exists for the specified date range'
      });
    }
    
    // Prepare data for update
    const {
      intent_type,
      program_id,
      participant_id,
      staff_id,
      vehicle_id,
      venue_id,
      start_date,
      end_date,
      start_time,
      end_time,
      billing_code_id,
      hours,
      details
    } = updatedData;
    
    // Update the intent
    await client.query(
      `UPDATE tgl_operator_intents
       SET intent_type = $1,
           program_id = $2,
           participant_id = $3,
           staff_id = $4,
           vehicle_id = $5,
           venue_id = $6,
           start_date = $7,
           end_date = $8,
           start_time = $9,
           end_time = $10,
           billing_code_id = $11,
           hours = $12,
           details = $13,
           updated_at = NOW()
       WHERE id = $14`,
      [
        intent_type,
        program_id,
        participant_id || null,
        staff_id || null,
        vehicle_id || null,
        venue_id || null,
        start_date,
        end_date || null,
        start_time || null,
        end_time || null,
        billing_code_id || null,
        hours || null,
        details ? JSON.stringify(details) : null,
        id
      ]
    );
    
    // Log the action
    await logAuditEntry(client, 'UPDATE', 'INTENT', id, {
      intent_type,
      program_id,
      start_date,
      end_date
    });
    
    // If dates changed, reapply intents to affected dates
    if (start_date !== existingIntent.start_date || 
        end_date !== existingIntent.end_date) {
      
      // Get current window
      const today = getTodaySydney();
      const settingsResult = await client.query(
        'SELECT value FROM settings WHERE key = $1',
        ['loom_window_weeks']
      );
      
      if (settingsResult.rows.length > 0) {
        const windowWeeks = parseInt(settingsResult.rows[0].value, 10) || 4;
        const windowEnd = addWeeks(today, windowWeeks);
        
        // Import loomRoller functions
        const { applyOperatorIntents } = require('../services/loomRoller');
        
        // Determine date range to reapply
        const startReapply = new Date(Math.min(
          new Date(start_date),
          existingIntent.start_date ? new Date(existingIntent.start_date) : new Date(9999, 11, 31)
        ));
        
        const endReapply = new Date(Math.max(
          new Date(end_date || '9999-12-31'),
          existingIntent.end_date ? new Date(existingIntent.end_date) : new Date(start_date)
        ));
        
        // Only reapply for dates within the current window
        let currentDate = new Date(Math.max(startReapply, today));
        
        while (currentDate <= Math.min(endReapply, windowEnd)) {
          await applyOperatorIntents(client, currentDate);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return success response
    res.json({
      success: true,
      message: 'Intent updated successfully',
      data: {
        id,
        intent_type,
        program_id,
        start_date,
        end_date
      }
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    logger.error(`Error updating intent: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to update intent',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Delete an intent
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteIntent = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Check if intent exists
    const checkResult = await client.query(
      'SELECT * FROM tgl_operator_intents WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Intent not found'
      });
    }
    
    const existingIntent = checkResult.rows[0];
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete the intent
    await client.query(
      'DELETE FROM tgl_operator_intents WHERE id = $1',
      [id]
    );
    
    // Log the action
    await logAuditEntry(client, 'DELETE', 'INTENT', id, {
      intent_type: existingIntent.intent_type,
      program_id: existingIntent.program_id
    });
    
    // Reapply intents for affected dates in the current window
    const today = getTodaySydney();
    const settingsResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (settingsResult.rows.length > 0) {
      const windowWeeks = parseInt(settingsResult.rows[0].value, 10) || 4;
      const windowEnd = addWeeks(today, windowWeeks);
      
      // Import loomRoller functions
      const { applyOperatorIntents } = require('../services/loomRoller');
      
      // Only reapply for dates within the current window
      const startReapply = new Date(Math.max(new Date(existingIntent.start_date), today));
      const endReapply = existingIntent.end_date 
        ? new Date(Math.min(new Date(existingIntent.end_date), windowEnd))
        : windowEnd;
      
      let currentDate = new Date(startReapply);
      
      while (currentDate <= endReapply) {
        await applyOperatorIntents(client, currentDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return success response
    res.json({
      success: true,
      message: 'Intent deleted successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    logger.error(`Error deleting intent: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete intent',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// ---------------------- EXCEPTION CONTROLLER METHODS ----------------------

/**
 * Create a new temporal exception
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createException = async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Validate request data
    const validation = validateExceptionData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    // Check for conflicts
    const hasConflicts = await checkConflictingExceptions(client, req.body);
    if (hasConflicts) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Conflicting exception exists for the specified date'
      });
    }
    
    // Prepare data for insertion
    const {
      exception_type,
      program_id,
      participant_id,
      exception_date,
      details
    } = req.body;
    
    // Insert the exception
    const result = await client.query(
      `INSERT INTO tgl_temporal_exceptions (
        exception_type, program_id, participant_id, exception_date, 
        details, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [
        exception_type,
        program_id,
        participant_id || null,
        exception_date,
        details ? JSON.stringify(details) : null,
        req.user?.id || null // If authentication is implemented
      ]
    );
    
    const exceptionId = result.rows[0].id;
    
    // Log the action
    await logAuditEntry(client, 'CREATE', 'EXCEPTION', exceptionId, {
      exception_type,
      program_id,
      exception_date
    });
    
    // Apply the exception if it's for a date in the current window
    const today = getTodaySydney();
    const exceptionDateObj = new Date(exception_date);
    
    // Get window size from settings
    const settingsResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (settingsResult.rows.length > 0) {
      const windowWeeks = parseInt(settingsResult.rows[0].value, 10) || 4;
      const windowEnd = addWeeks(today, windowWeeks);
      
      // Only apply if the exception date is within the current window
      if (exceptionDateObj >= today && exceptionDateObj <= windowEnd) {
        // Import and use the applyTemporalExceptions function from loomRoller
        const { applyTemporalExceptions } = require('../services/loomRoller');
        await applyTemporalExceptions(client, exceptionDateObj);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Exception created successfully',
      data: {
        id: exceptionId,
        exception_type,
        program_id,
        exception_date
      }
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    logger.error(`Error creating exception: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create exception',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get all exceptions with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getExceptions = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const {
      program_id,
      participant_id,
      exception_type,
      exception_date,
      start_date,
      end_date
    } = req.query;
    
    // Build the query
    let query = `
      SELECT e.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name
      FROM tgl_temporal_exceptions e
      LEFT JOIN programs p ON e.program_id = p.id
      LEFT JOIN participants part ON e.participant_id = part.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add filters if provided
    if (program_id) {
      query += ` AND e.program_id = $${paramIndex}`;
      params.push(program_id);
      paramIndex++;
    }
    
    if (participant_id) {
      query += ` AND e.participant_id = $${paramIndex}`;
      params.push(participant_id);
      paramIndex++;
    }
    
    if (exception_type) {
      query += ` AND e.exception_type = $${paramIndex}`;
      params.push(exception_type);
      paramIndex++;
    }
    
    if (exception_date) {
      query += ` AND e.exception_date = $${paramIndex}`;
      params.push(exception_date);
      paramIndex++;
    }
    
    // Date range filter
    if (start_date) {
      query += ` AND e.exception_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND e.exception_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    // Order by exception date (newest first)
    query += ` ORDER BY e.exception_date DESC, e.created_at DESC`;
    
    // Execute the query
    const { rows } = await pool.query(query, params);
    
    // Return the results
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    logger.error(`Error fetching exceptions: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exceptions',
      error: error.message
    });
  }
};

/**
 * Get a single exception by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getExceptionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Query for the exception with related data
    const query = `
      SELECT e.*, 
        p.name as program_name,
        part.first_name || ' ' || part.last_name as participant_name
      FROM tgl_temporal_exceptions e
      LEFT JOIN programs p ON e.program_id = p.id
      LEFT JOIN participants part ON e.participant_id = part.id
      WHERE e.id = $1
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }
    
    // Return the exception
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    logger.error(`Error fetching exception: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exception',
      error: error.message
    });
  }
};

/**
 * Delete an exception
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteException = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    // Check if exception exists
    const checkResult = await client.query(
      'SELECT * FROM tgl_temporal_exceptions WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }
    
    const existingException = checkResult.rows[0];
    
    // Start transaction
    await client.query('BEGIN');
    
    // Delete the exception
    await client.query(
      'DELETE FROM tgl_temporal_exceptions WHERE id = $1',
      [id]
    );
    
    // Log the action
    await logAuditEntry(client, 'DELETE', 'EXCEPTION', id, {
      exception_type: existingException.exception_type,
      program_id: existingException.program_id,
      exception_date: existingException.exception_date
    });
    
    // Reapply intents for the affected date if it's in the current window
    const today = getTodaySydney();
    const exceptionDate = new Date(existingException.exception_date);
    
    const settingsResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (settingsResult.rows.length > 0) {
      const windowWeeks = parseInt(settingsResult.rows[0].value, 10) || 4;
      const windowEnd = addWeeks(today, windowWeeks);
      
      // Only reapply if the exception date is within the current window
      if (exceptionDate >= today && exceptionDate <= windowEnd) {
        // Import loomRoller functions
        const { generateMissingInstances, applyOperatorIntents } = require('../services/loomRoller');
        
        // Regenerate the instance for this date
        await generateMissingInstances(client, exceptionDate);
        
        // Apply any intents for this date
        await applyOperatorIntents(client, exceptionDate);
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return success response
    res.json({
      success: true,
      message: 'Exception deleted successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    logger.error(`Error deleting exception: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete exception',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Export all controller functions
module.exports = {
  // Intent methods
  createIntent,
  getIntents,
  getIntentById,
  updateIntent,
  deleteIntent,
  
  // Exception methods
  createException,
  getExceptions,
  getExceptionById,
  deleteException
};
