/**
 * Availability Controller
 * 
 * Manages vehicle blackouts and staff unavailabilities for the RABS system.
 * Provides endpoints for creating, updating, and querying availability data.
 * Integrates with the Loom system for resource allocation and conflict detection.
 */

const db = require('../database');
const { validationResult } = require('express-validator');
const { isValidUUID } = require('../utils/validators');
const { formatDateForDb } = require('../utils/dateUtils');
const logger = require('../utils/logger');

/**
 * Validate time range (ensure start_time < end_time)
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {boolean} - True if valid, false otherwise
 */
const validateTimeRange = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return start < end;
};

/**
 * Check for overlapping blackouts for a vehicle
 * @param {string} vehicleId - Vehicle UUID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {string} [excludeId] - Blackout ID to exclude (for updates)
 * @returns {Promise<boolean>} - True if overlapping blackouts exist
 */
const checkOverlappingVehicleBlackouts = async (vehicleId, startTime, endTime, excludeId = null) => {
  try {
    const query = `
      SELECT COUNT(*) as overlap_count
      FROM vehicle_blackouts
      WHERE vehicle_id = $1
      AND $2 < end_time
      AND $3 > start_time
      ${excludeId ? 'AND id != $4' : ''}
    `;
    
    const params = excludeId 
      ? [vehicleId, startTime, endTime, excludeId]
      : [vehicleId, startTime, endTime];
    
    const result = await db.query(query, params);
    return parseInt(result.rows[0].overlap_count) > 0;
  } catch (error) {
    logger.error('Error checking overlapping vehicle blackouts:', error);
    throw error;
  }
};

/**
 * Check for overlapping unavailabilities for a staff member
 * @param {string} staffId - Staff UUID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {string} [excludeId] - Unavailability ID to exclude (for updates)
 * @returns {Promise<boolean>} - True if overlapping unavailabilities exist
 */
const checkOverlappingStaffUnavailabilities = async (staffId, startTime, endTime, excludeId = null) => {
  try {
    const query = `
      SELECT COUNT(*) as overlap_count
      FROM staff_unavailabilities
      WHERE staff_id = $1
      AND $2 < end_time
      AND $3 > start_time
      ${excludeId ? 'AND id != $4' : ''}
    `;
    
    const params = excludeId 
      ? [staffId, startTime, endTime, excludeId]
      : [staffId, startTime, endTime];
    
    const result = await db.query(query, params);
    return parseInt(result.rows[0].overlap_count) > 0;
  } catch (error) {
    logger.error('Error checking overlapping staff unavailabilities:', error);
    throw error;
  }
};

/**
 * Get all blackouts for a vehicle
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getVehicleBlackouts = async (req, res) => {
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vehicle ID format'
    });
  }
  
  try {
    const query = `
      SELECT vb.*, v.make, v.model, v.registration
      FROM vehicle_blackouts vb
      JOIN vehicles v ON vb.vehicle_id = v.id
      WHERE vb.vehicle_id = $1
      ORDER BY vb.start_time ASC
    `;
    
    const result = await db.query(query, [id]);
    
    return res.status(200).json({
      success: true,
      blackouts: result.rows
    });
  } catch (error) {
    logger.error('Error fetching vehicle blackouts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle blackouts',
      error: error.message
    });
  }
};

/**
 * Create a new vehicle blackout
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createVehicleBlackout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  const { id } = req.params;
  const { start_time, end_time, reason, notes } = req.body;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid vehicle ID format'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    // Check if vehicle exists
    const vehicleCheck = await db.query('SELECT id FROM vehicles WHERE id = $1', [id]);
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check for overlapping blackouts
    const hasOverlap = await checkOverlappingVehicleBlackouts(id, start_time, end_time);
    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'This blackout overlaps with an existing blackout period'
      });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    // Insert blackout
    const query = `
      INSERT INTO vehicle_blackouts (vehicle_id, start_time, end_time, reason, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.query(query, [id, start_time, end_time, reason, notes || null]);
    
    // Check for affected loom instances and log conflicts
    await checkAndLogVehicleConflicts(id, start_time, end_time);
    
    // Commit transaction
    await db.query('COMMIT');
    
    return res.status(201).json({
      success: true,
      blackout: result.rows[0],
      message: 'Vehicle blackout created successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    
    logger.error('Error creating vehicle blackout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create vehicle blackout',
      error: error.message
    });
  }
};

/**
 * Update a vehicle blackout
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateVehicleBlackout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  const { id } = req.params;
  const { start_time, end_time, reason, notes } = req.body;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid blackout ID format'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    // Check if blackout exists
    const blackoutCheck = await db.query('SELECT id, vehicle_id FROM vehicle_blackouts WHERE id = $1', [id]);
    if (blackoutCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blackout not found'
      });
    }
    
    const vehicleId = blackoutCheck.rows[0].vehicle_id;
    
    // Check for overlapping blackouts
    const hasOverlap = await checkOverlappingVehicleBlackouts(vehicleId, start_time, end_time, id);
    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'This blackout overlaps with an existing blackout period'
      });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    // Update blackout
    const query = `
      UPDATE vehicle_blackouts
      SET start_time = $1, end_time = $2, reason = $3, notes = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await db.query(query, [start_time, end_time, reason, notes || null, id]);
    
    // Check for affected loom instances and log conflicts
    await checkAndLogVehicleConflicts(vehicleId, start_time, end_time);
    
    // Commit transaction
    await db.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      blackout: result.rows[0],
      message: 'Vehicle blackout updated successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    
    logger.error('Error updating vehicle blackout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update vehicle blackout',
      error: error.message
    });
  }
};

/**
 * Delete a vehicle blackout
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const deleteVehicleBlackout = async (req, res) => {
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid blackout ID format'
    });
  }
  
  try {
    // Check if blackout exists
    const blackoutCheck = await db.query('SELECT id FROM vehicle_blackouts WHERE id = $1', [id]);
    if (blackoutCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blackout not found'
      });
    }
    
    // Delete blackout
    await db.query('DELETE FROM vehicle_blackouts WHERE id = $1', [id]);
    
    return res.status(200).json({
      success: true,
      message: 'Vehicle blackout deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting vehicle blackout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle blackout',
      error: error.message
    });
  }
};

/**
 * Check vehicle availability for a date range
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const checkVehicleAvailability = async (req, res) => {
  const { start_time, end_time, vehicle_ids } = req.query;
  
  // Validate required parameters
  if (!start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    let query;
    let params;
    
    if (vehicle_ids) {
      // Convert comma-separated string to array
      const vehicleIdArray = vehicle_ids.split(',');
      
      // Validate each UUID
      for (const id of vehicleIdArray) {
        if (!isValidUUID(id)) {
          return res.status(400).json({
            success: false,
            message: `Invalid vehicle ID format: ${id}`
          });
        }
      }
      
      // Query for specific vehicles
      query = `
        SELECT v.id, v.make, v.model, v.registration,
               CASE WHEN vb.id IS NULL THEN true ELSE false END AS available,
               vb.id AS blackout_id, vb.reason, vb.start_time, vb.end_time
        FROM vehicles v
        LEFT JOIN vehicle_blackouts vb ON v.id = vb.vehicle_id
          AND $1 < vb.end_time AND $2 > vb.start_time
        WHERE v.id = ANY($3::uuid[])
        ORDER BY v.make, v.model
      `;
      params = [start_time, end_time, vehicleIdArray];
    } else {
      // Query for all vehicles
      query = `
        SELECT v.id, v.make, v.model, v.registration,
               CASE WHEN vb.id IS NULL THEN true ELSE false END AS available,
               vb.id AS blackout_id, vb.reason, vb.start_time, vb.end_time
        FROM vehicles v
        LEFT JOIN vehicle_blackouts vb ON v.id = vb.vehicle_id
          AND $1 < vb.end_time AND $2 > vb.start_time
        WHERE v.active = true
        ORDER BY v.make, v.model
      `;
      params = [start_time, end_time];
    }
    
    const result = await db.query(query, params);
    
    // Process results to group by vehicle
    const vehicleMap = new Map();
    
    result.rows.forEach(row => {
      const vehicleId = row.id;
      
      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          id: vehicleId,
          make: row.make,
          model: row.model,
          registration: row.registration,
          available: row.blackout_id === null,
          blackouts: row.blackout_id ? [{
            id: row.blackout_id,
            reason: row.reason,
            start_time: row.start_time,
            end_time: row.end_time
          }] : []
        });
      } else if (row.blackout_id) {
        const vehicle = vehicleMap.get(vehicleId);
        vehicle.available = false;
        vehicle.blackouts.push({
          id: row.blackout_id,
          reason: row.reason,
          start_time: row.start_time,
          end_time: row.end_time
        });
      }
    });
    
    return res.status(200).json({
      success: true,
      vehicles: Array.from(vehicleMap.values())
    });
  } catch (error) {
    logger.error('Error checking vehicle availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check vehicle availability',
      error: error.message
    });
  }
};

/**
 * Get all unavailabilities for a staff member
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getStaffUnavailabilities = async (req, res) => {
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid staff ID format'
    });
  }
  
  try {
    const query = `
      SELECT su.*, s.first_name, s.last_name
      FROM staff_unavailabilities su
      JOIN staff s ON su.staff_id = s.id
      WHERE su.staff_id = $1
      ORDER BY su.start_time ASC
    `;
    
    const result = await db.query(query, [id]);
    
    return res.status(200).json({
      success: true,
      unavailabilities: result.rows
    });
  } catch (error) {
    logger.error('Error fetching staff unavailabilities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff unavailabilities',
      error: error.message
    });
  }
};

/**
 * Create a new staff unavailability
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createStaffUnavailability = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  const { id } = req.params;
  const { start_time, end_time, reason, notes } = req.body;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid staff ID format'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    // Check if staff exists
    const staffCheck = await db.query('SELECT id FROM staff WHERE id = $1', [id]);
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    // Check for overlapping unavailabilities
    const hasOverlap = await checkOverlappingStaffUnavailabilities(id, start_time, end_time);
    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'This unavailability overlaps with an existing unavailability period'
      });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    // Insert unavailability
    const query = `
      INSERT INTO staff_unavailabilities (staff_id, start_time, end_time, reason, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await db.query(query, [id, start_time, end_time, reason, notes || null]);
    
    // Check for affected loom instances and log conflicts
    await checkAndLogStaffConflicts(id, start_time, end_time);
    
    // Commit transaction
    await db.query('COMMIT');
    
    return res.status(201).json({
      success: true,
      unavailability: result.rows[0],
      message: 'Staff unavailability created successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    
    logger.error('Error creating staff unavailability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create staff unavailability',
      error: error.message
    });
  }
};

/**
 * Update a staff unavailability
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateStaffUnavailability = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  
  const { id } = req.params;
  const { start_time, end_time, reason, notes } = req.body;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid unavailability ID format'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    // Check if unavailability exists
    const unavailabilityCheck = await db.query('SELECT id, staff_id FROM staff_unavailabilities WHERE id = $1', [id]);
    if (unavailabilityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unavailability not found'
      });
    }
    
    const staffId = unavailabilityCheck.rows[0].staff_id;
    
    // Check for overlapping unavailabilities
    const hasOverlap = await checkOverlappingStaffUnavailabilities(staffId, start_time, end_time, id);
    if (hasOverlap) {
      return res.status(409).json({
        success: false,
        message: 'This unavailability overlaps with an existing unavailability period'
      });
    }
    
    // Begin transaction
    await db.query('BEGIN');
    
    // Update unavailability
    const query = `
      UPDATE staff_unavailabilities
      SET start_time = $1, end_time = $2, reason = $3, notes = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    const result = await db.query(query, [start_time, end_time, reason, notes || null, id]);
    
    // Check for affected loom instances and log conflicts
    await checkAndLogStaffConflicts(staffId, start_time, end_time);
    
    // Commit transaction
    await db.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      unavailability: result.rows[0],
      message: 'Staff unavailability updated successfully'
    });
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    
    logger.error('Error updating staff unavailability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update staff unavailability',
      error: error.message
    });
  }
};

/**
 * Delete a staff unavailability
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const deleteStaffUnavailability = async (req, res) => {
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid unavailability ID format'
    });
  }
  
  try {
    // Check if unavailability exists
    const unavailabilityCheck = await db.query('SELECT id FROM staff_unavailabilities WHERE id = $1', [id]);
    if (unavailabilityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unavailability not found'
      });
    }
    
    // Delete unavailability
    await db.query('DELETE FROM staff_unavailabilities WHERE id = $1', [id]);
    
    return res.status(200).json({
      success: true,
      message: 'Staff unavailability deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting staff unavailability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete staff unavailability',
      error: error.message
    });
  }
};

/**
 * Check staff availability for a date range
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const checkStaffAvailability = async (req, res) => {
  const { start_time, end_time, staff_ids } = req.query;
  
  // Validate required parameters
  if (!start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required'
    });
  }
  
  // Validate time range
  if (!validateTimeRange(start_time, end_time)) {
    return res.status(400).json({
      success: false,
      message: 'End time must be after start time'
    });
  }
  
  try {
    let query;
    let params;
    
    if (staff_ids) {
      // Convert comma-separated string to array
      const staffIdArray = staff_ids.split(',');
      
      // Validate each UUID
      for (const id of staffIdArray) {
        if (!isValidUUID(id)) {
          return res.status(400).json({
            success: false,
            message: `Invalid staff ID format: ${id}`
          });
        }
      }
      
      // Query for specific staff members
      query = `
        SELECT s.id, s.first_name, s.last_name, s.position,
               CASE WHEN su.id IS NULL THEN true ELSE false END AS available,
               su.id AS unavailability_id, su.reason, su.start_time, su.end_time
        FROM staff s
        LEFT JOIN staff_unavailabilities su ON s.id = su.staff_id
          AND $1 < su.end_time AND $2 > su.start_time
        WHERE s.id = ANY($3::uuid[])
        ORDER BY s.last_name, s.first_name
      `;
      params = [start_time, end_time, staffIdArray];
    } else {
      // Query for all active staff
      query = `
        SELECT s.id, s.first_name, s.last_name, s.position,
               CASE WHEN su.id IS NULL THEN true ELSE false END AS available,
               su.id AS unavailability_id, su.reason, su.start_time, su.end_time
        FROM staff s
        LEFT JOIN staff_unavailabilities su ON s.id = su.staff_id
          AND $1 < su.end_time AND $2 > su.start_time
        WHERE s.active = true
        ORDER BY s.last_name, s.first_name
      `;
      params = [start_time, end_time];
    }
    
    const result = await db.query(query, params);
    
    // Process results to group by staff member
    const staffMap = new Map();
    
    result.rows.forEach(row => {
      const staffId = row.id;
      
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          id: staffId,
          first_name: row.first_name,
          last_name: row.last_name,
          position: row.position,
          available: row.unavailability_id === null,
          unavailabilities: row.unavailability_id ? [{
            id: row.unavailability_id,
            reason: row.reason,
            start_time: row.start_time,
            end_time: row.end_time
          }] : []
        });
      } else if (row.unavailability_id) {
        const staff = staffMap.get(staffId);
        staff.available = false;
        staff.unavailabilities.push({
          id: row.unavailability_id,
          reason: row.reason,
          start_time: row.start_time,
          end_time: row.end_time
        });
      }
    });
    
    return res.status(200).json({
      success: true,
      staff: Array.from(staffMap.values())
    });
  } catch (error) {
    logger.error('Error checking staff availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check staff availability',
      error: error.message
    });
  }
};

/**
 * Check and log vehicle conflicts with loom instances
 * @param {string} vehicleId - Vehicle UUID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 */
const checkAndLogVehicleConflicts = async (vehicleId, startTime, endTime) => {
  try {
    // Find affected loom instances
    const query = `
      SELECT li.id, li.program_id, li.instance_date, p.title,
             lvr.id as run_id, lvr.start_time, lvr.end_time
      FROM tgl_loom_instances li
      JOIN programs p ON li.program_id = p.id
      JOIN tgl_loom_vehicle_runs lvr ON li.id = lvr.loom_instance_id
      WHERE lvr.vehicle_id = $1
      AND DATE(li.instance_date) + lvr.start_time::time >= $2::date
      AND DATE(li.instance_date) + lvr.end_time::time <= $3::date
    `;
    
    const result = await db.query(query, [vehicleId, startTime, endTime]);
    
    if (result.rows.length > 0) {
      // Log conflicts to audit log
      const logQuery = `
        INSERT INTO tgl_loom_audit_log (action_type, entity_type, entity_id, previous_state, new_state)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      for (const row of result.rows) {
        const logData = {
          message: `Vehicle maintenance conflict detected`,
          program: row.title,
          instance_date: row.instance_date,
          run_id: row.run_id,
          run_time: `${row.start_time}-${row.end_time}`,
          maintenance_period: `${startTime} to ${endTime}`
        };
        
        await db.query(logQuery, [
          'VEHICLE_BLACKOUT_CONFLICT',
          'VEHICLE_RUN',
          row.run_id,
          JSON.stringify({ vehicle_id: vehicleId }),
          JSON.stringify(logData)
        ]);
      }
      
      // Flag affected instances as needing attention
      const updateQuery = `
        UPDATE tgl_loom_instances
        SET status = 'needs_attention',
            updated_at = NOW()
        WHERE id IN (SELECT DISTINCT li.id
                     FROM tgl_loom_instances li
                     JOIN tgl_loom_vehicle_runs lvr ON li.id = lvr.loom_instance_id
                     WHERE lvr.vehicle_id = $1
                     AND DATE(li.instance_date) + lvr.start_time::time >= $2::date
                     AND DATE(li.instance_date) + lvr.end_time::time <= $3::date)
      `;
      
      await db.query(updateQuery, [vehicleId, startTime, endTime]);
    }
  } catch (error) {
    logger.error('Error checking vehicle conflicts:', error);
    throw error;
  }
};

/**
 * Check and log staff conflicts with loom instances
 * @param {string} staffId - Staff UUID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 */
const checkAndLogStaffConflicts = async (staffId, startTime, endTime) => {
  try {
    // Find affected loom instances
    const query = `
      SELECT li.id, li.program_id, li.instance_date, p.title,
             lss.id as shift_id, lss.role, lss.start_time, lss.end_time
      FROM tgl_loom_instances li
      JOIN programs p ON li.program_id = p.id
      JOIN tgl_loom_staff_shifts lss ON li.id = lss.loom_instance_id
      WHERE lss.staff_id = $1
      AND DATE(li.instance_date) + lss.start_time::time >= $2::date
      AND DATE(li.instance_date) + lss.end_time::time <= $3::date
    `;
    
    const result = await db.query(query, [staffId, startTime, endTime]);
    
    if (result.rows.length > 0) {
      // Log conflicts to audit log
      const logQuery = `
        INSERT INTO tgl_loom_audit_log (action_type, entity_type, entity_id, previous_state, new_state)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      for (const row of result.rows) {
        const logData = {
          message: `Staff unavailability conflict detected`,
          program: row.title,
          instance_date: row.instance_date,
          shift_id: row.shift_id,
          shift_role: row.role,
          shift_time: `${row.start_time}-${row.end_time}`,
          unavailability_period: `${startTime} to ${endTime}`
        };
        
        await db.query(logQuery, [
          'STAFF_UNAVAILABILITY_CONFLICT',
          'STAFF_SHIFT',
          row.shift_id,
          JSON.stringify({ staff_id: staffId }),
          JSON.stringify(logData)
        ]);
      }
      
      // Flag affected instances as needing attention
      const updateQuery = `
        UPDATE tgl_loom_instances
        SET status = 'needs_attention',
            updated_at = NOW()
        WHERE id IN (SELECT DISTINCT li.id
                     FROM tgl_loom_instances li
                     JOIN tgl_loom_staff_shifts lss ON li.id = lss.loom_instance_id
                     WHERE lss.staff_id = $1
                     AND DATE(li.instance_date) + lss.start_time::time >= $2::date
                     AND DATE(li.instance_date) + lss.end_time::time <= $3::date)
      `;
      
      await db.query(updateQuery, [staffId, startTime, endTime]);
    }
  } catch (error) {
    logger.error('Error checking staff conflicts:', error);
    throw error;
  }
};

/**
 * Helper function for Loom engine to check vehicle availability
 * @param {string} vehicleId - Vehicle UUID
 * @param {Date} date - Date to check
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<boolean>} - True if vehicle is available
 */
const isVehicleAvailable = async (vehicleId, date, startTime, endTime) => {
  try {
    // Convert date and times to timestamp
    const startDateTime = new Date(`${formatDateForDb(date)}T${startTime}:00`);
    const endDateTime = new Date(`${formatDateForDb(date)}T${endTime}:00`);
    
    const query = `
      SELECT COUNT(*) as blackout_count
      FROM vehicle_blackouts
      WHERE vehicle_id = $1
      AND $2 < end_time
      AND $3 > start_time
    `;
    
    const result = await db.query(query, [vehicleId, startDateTime, endDateTime]);
    return parseInt(result.rows[0].blackout_count) === 0;
  } catch (error) {
    logger.error('Error checking vehicle availability:', error);
    throw error;
  }
};

/**
 * Helper function for Loom engine to check staff availability
 * @param {string} staffId - Staff UUID
 * @param {Date} date - Date to check
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<boolean>} - True if staff is available
 */
const isStaffAvailable = async (staffId, date, startTime, endTime) => {
  try {
    // Convert date and times to timestamp
    const startDateTime = new Date(`${formatDateForDb(date)}T${startTime}:00`);
    const endDateTime = new Date(`${formatDateForDb(date)}T${endTime}:00`);
    
    const query = `
      SELECT COUNT(*) as unavailability_count
      FROM staff_unavailabilities
      WHERE staff_id = $1
      AND $2 < end_time
      AND $3 > start_time
    `;
    
    const result = await db.query(query, [staffId, startDateTime, endDateTime]);
    return parseInt(result.rows[0].unavailability_count) === 0;
  } catch (error) {
    logger.error('Error checking staff availability:', error);
    throw error;
  }
};

/**
 * Get all available vehicles for a date range
 * @param {Date} date - Date to check
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<Array>} - Array of available vehicles
 */
const getAvailableVehicles = async (date, startTime, endTime) => {
  try {
    // Convert date and times to timestamp
    const startDateTime = new Date(`${formatDateForDb(date)}T${startTime}:00`);
    const endDateTime = new Date(`${formatDateForDb(date)}T${endTime}:00`);
    
    const query = `
      SELECT v.id, v.make, v.model, v.registration, v.capacity, v.wheelchair_spots
      FROM vehicles v
      WHERE v.active = true
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_blackouts vb
        WHERE vb.vehicle_id = v.id
        AND $1 < vb.end_time
        AND $2 > vb.start_time
      )
      ORDER BY v.capacity DESC, v.wheelchair_spots DESC
    `;
    
    const result = await db.query(query, [startDateTime, endDateTime]);
    return result.rows;
  } catch (error) {
    logger.error('Error getting available vehicles:', error);
    throw error;
  }
};

/**
 * Get all available staff for a date range
 * @param {Date} date - Date to check
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {Promise<Array>} - Array of available staff
 */
const getAvailableStaff = async (date, startTime, endTime) => {
  try {
    // Convert date and times to timestamp
    const startDateTime = new Date(`${formatDateForDb(date)}T${startTime}:00`);
    const endDateTime = new Date(`${formatDateForDb(date)}T${endTime}:00`);
    
    const query = `
      SELECT s.id, s.first_name, s.last_name, s.position, s.qualifications
      FROM staff s
      WHERE s.active = true
      AND NOT EXISTS (
        SELECT 1
        FROM staff_unavailabilities su
        WHERE su.staff_id = s.id
        AND $1 < su.end_time
        AND $2 > su.start_time
      )
      ORDER BY s.last_name, s.first_name
    `;
    
    const result = await db.query(query, [startDateTime, endDateTime]);
    return result.rows;
  } catch (error) {
    logger.error('Error getting available staff:', error);
    throw error;
  }
};

module.exports = {
  // Vehicle blackout endpoints
  getVehicleBlackouts,
  createVehicleBlackout,
  updateVehicleBlackout,
  deleteVehicleBlackout,
  checkVehicleAvailability,
  
  // Staff unavailability endpoints
  getStaffUnavailabilities,
  createStaffUnavailability,
  updateStaffUnavailability,
  deleteStaffUnavailability,
  checkStaffAvailability,
  
  // Helper functions for Loom engine
  isVehicleAvailable,
  isStaffAvailable,
  getAvailableVehicles,
  getAvailableStaff
};
