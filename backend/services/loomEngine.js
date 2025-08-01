/**
 * backend/services/loomEngine.js
 *
 * The Loom Engine is the core of the dynamic resource allocation system.
 * It manages a sliding window of program instances, automatically allocating
 * participants, staff, and vehicles based on rules and availability.
 * 
 * The Loom concept:
 * - A sliding window of time (2-16 weeks) from "now"
 * - Automatically generates program instances within this window
 * - Dynamically allocates resources (staff, vehicles)
 * - Handles changes (cancellations, illness) with rebalancing
 * - Maintains billing records based on allocation status
 */

const { pool } = require('../database');
const { formatDateForDb } = require('../utils/dateUtils');
const logger = require('../utils/logger');

// Import related services for integration
const participantService = require('./participantService');
const staffService = require('./staffService');
const vehicleService = require('./vehicleService');
const routeOptimizationService = require('./routeOptimizationService');

/**
 * Get the current loom window size setting
 * @returns {Promise<number>} The window size in weeks
 */
const getLoomWindowSize = async () => {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (result.rows.length === 0) {
      // Default to 4 weeks if not set
      return 4;
    }
    
    return parseInt(result.rows[0].value, 10);
  } catch (error) {
    logger.error('Error getting loom window size:', error);
    throw error;
  }
};

/**
 * Set the loom window size setting
 * @param {number} weeks - The new window size in weeks
 * @returns {Promise<void>}
 */
const setLoomWindowSize = async (weeks) => {
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['loom_window_weeks', weeks.toString()]
    );
  } catch (error) {
    logger.error('Error setting loom window size:', error);
    throw error;
  }
};

/**
 * Calculate the date range for the loom window
 * @param {number} weekCount - Number of weeks in the window
 * @returns {Object} Object with start and end dates
 */
const calculateLoomDateRange = (weekCount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (weekCount * 7));
  
  return {
    startDate: today,
    endDate: endDate
  };
};

/**
 * Generate program instances for the loom window
 * @param {number} weekCount - Number of weeks to generate
 * @returns {Promise<Object>} Result of the generation operation
 */
const generateLoomWindow = async (weekCount = 4) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Update the loom window size setting
    await client.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['loom_window_weeks', weekCount.toString()]
    );
    
    // Calculate the date range
    const { startDate, endDate } = calculateLoomDateRange(weekCount);
    
    // Get all active programs
    const programsResult = await client.query(
      'SELECT * FROM programs WHERE active = true'
    );
    const programs = programsResult.rows;
    
    // Track generated instances
    const generatedInstances = [];
    
    // For each program, generate instances within the date range
    for (const program of programs) {
      const instances = await generateProgramInstances(client, program, startDate, endDate);
      generatedInstances.push(...instances);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Generated ${generatedInstances.length} loom instances for ${weekCount} week window`);
    
    return {
      success: true,
      message: `Generated ${generatedInstances.length} loom instances`,
      data: {
        instanceCount: generatedInstances.length,
        windowWeeks: weekCount,
        startDate: formatDateForDb(startDate),
        endDate: formatDateForDb(endDate)
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error('Error generating loom window:', error);
    
    return {
      success: false,
      message: `Error generating loom window: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Generate instances for a specific program within a date range
 * @param {Object} client - Database client
 * @param {Object} program - Program object
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of generated instance IDs
 */
const generateProgramInstances = async (client, program, startDate, endDate) => {
  const instances = [];
  const currentDate = new Date(startDate);
  
  // Iterate through each day in the date range
  while (currentDate < endDate) {
    // Check if this day matches the program's day of week (0 = Sunday, 1 = Monday, etc.)
    if (currentDate.getDay() === program.day_of_week) {
      // Check if an instance already exists for this program and date
      const existingResult = await client.query(
        'SELECT id FROM tgl_loom_instances WHERE program_id = $1 AND instance_date = $2',
        [program.id, formatDateForDb(currentDate)]
      );
      
      if (existingResult.rows.length === 0) {
        // Create a new instance
        const result = await client.query(
          `INSERT INTO tgl_loom_instances 
          (program_id, instance_date, status, optimisation_state) 
          VALUES ($1, $2, $3, $4) 
          RETURNING id`,
          [
            program.id,
            formatDateForDb(currentDate),
            'pending',
            JSON.stringify({ created: new Date(), program_name: program.name })
          ]
        );
        
        const instanceId = result.rows[0].id;
        instances.push(instanceId);
        
        // Log the creation
        await client.query(
          `INSERT INTO tgl_loom_audit_log 
          (loom_instance_id, action, before_state, after_state, actor) 
          VALUES ($1, $2, $3, $4, $5)`,
          [
            instanceId,
            'instance_created',
            null,
            JSON.stringify({ program_id: program.id, date: formatDateForDb(currentDate) }),
            'loom_engine'
          ]
        );
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return instances;
};

/**
 * Resize the loom window
 * @param {number} newWeekCount - New window size in weeks
 * @returns {Promise<Object>} Result of the resize operation
 */
const resizeLoomWindow = async (newWeekCount) => {
  if (newWeekCount < 1 || newWeekCount > 16) {
    return {
      success: false,
      message: 'Window size must be between 1 and 16 weeks'
    };
  }
  
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get current window size
    const currentSizeResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    const currentSize = currentSizeResult.rows.length > 0 
      ? parseInt(currentSizeResult.rows[0].value, 10) 
      : 4;
    
    // Calculate date ranges
    const currentRange = calculateLoomDateRange(currentSize);
    const newRange = calculateLoomDateRange(newWeekCount);
    
    if (newWeekCount > currentSize) {
      // Expanding the window - generate new instances
      // Get all active programs
      const programsResult = await client.query(
        'SELECT * FROM programs WHERE active = true'
      );
      const programs = programsResult.rows;
      
      // For each program, generate instances for the expanded range
      for (const program of programs) {
        await generateProgramInstances(client, program, currentRange.endDate, newRange.endDate);
      }
    } else if (newWeekCount < currentSize) {
      // Shrinking the window - remove instances beyond the new end date
      await client.query(
        `DELETE FROM tgl_loom_instances 
        WHERE instance_date > $1`,
        [formatDateForDb(newRange.endDate)]
      );
    }
    
    // Update the window size setting
    await client.query(
      'UPDATE settings SET value = $1 WHERE key = $2',
      [newWeekCount.toString(), 'loom_window_weeks']
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Loom window resized from ${currentSize} to ${newWeekCount} weeks`,
      data: {
        previousSize: currentSize,
        newSize: newWeekCount,
        startDate: formatDateForDb(newRange.startDate),
        endDate: formatDateForDb(newRange.endDate)
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error('Error resizing loom window:', error);
    
    return {
      success: false,
      message: `Error resizing loom window: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Allocate participants to a loom instance based on enrollment rules
 * @param {string} instanceId - UUID of the loom instance
 * @returns {Promise<Object>} Result of the allocation operation
 */
const allocateParticipants = async (instanceId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get instance details
    const instanceResult = await client.query(
      'SELECT * FROM tgl_loom_instances WHERE id = $1',
      [instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Instance with ID ${instanceId} not found`
      };
    }
    
    const instance = instanceResult.rows[0];
    
    // Get program details
    const programResult = await client.query(
      'SELECT * FROM programs WHERE id = $1',
      [instance.program_id]
    );
    
    if (programResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Program with ID ${instance.program_id} not found`
      };
    }
    
    const program = programResult.rows[0];
    
    // Get enrolled participants for this program
    const enrollmentsResult = await client.query(
      `SELECT e.*, p.*, r.code as billing_code, r.rate as billing_rate
      FROM enrollments e
      JOIN participants p ON e.participant_id = p.id
      JOIN rate_line_items r ON r.program_id = e.program_id AND r.is_default = true
      WHERE e.program_id = $1 AND e.active = true`,
      [program.id]
    );
    
    const enrollments = enrollmentsResult.rows;
    const allocations = [];
    
    // For each enrolled participant, create an allocation
    for (const enrollment of enrollments) {
      // Check for existing allocation
      const existingResult = await client.query(
        `SELECT id FROM tgl_loom_participant_allocations 
        WHERE loom_instance_id = $1 AND participant_id = $2`,
        [instanceId, enrollment.participant_id]
      );
      
      if (existingResult.rows.length === 0) {
        // Create new allocation
        const result = await client.query(
          `INSERT INTO tgl_loom_participant_allocations
          (loom_instance_id, participant_id, billing_code, planned_rate, allocation_status)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id`,
          [
            instanceId,
            enrollment.participant_id,
            enrollment.billing_code || 'DEFAULT',
            enrollment.billing_rate || 0,
            'planned'
          ]
        );
        
        allocations.push(result.rows[0].id);
        
        // Log the allocation
        await client.query(
          `INSERT INTO tgl_loom_audit_log
          (loom_instance_id, action, before_state, after_state, actor)
          VALUES ($1, $2, $3, $4, $5)`,
          [
            instanceId,
            'participant_allocated',
            null,
            JSON.stringify({ 
              participant_id: enrollment.participant_id,
              billing_code: enrollment.billing_code || 'DEFAULT',
              planned_rate: enrollment.billing_rate || 0
            }),
            'loom_engine'
          ]
        );
      }
    }
    
    // Update instance status if it was pending
    if (instance.status === 'pending') {
      await client.query(
        'UPDATE tgl_loom_instances SET status = $1 WHERE id = $2',
        ['generated', instanceId]
      );
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Allocated ${allocations.length} participants to instance ${instanceId}`);
    
    return {
      success: true,
      message: `Allocated ${allocations.length} participants to instance`,
      data: {
        instanceId,
        programId: program.id,
        programName: program.name,
        allocations,
        participantCount: allocations.length
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error allocating participants to instance ${instanceId}:`, error);
    
    return {
      success: false,
      message: `Error allocating participants: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Assign staff to a loom instance based on availability and requirements
 * @param {string} instanceId - UUID of the loom instance
 * @returns {Promise<Object>} Result of the staff assignment operation
 */
const assignStaff = async (instanceId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get instance details
    const instanceResult = await client.query(
      'SELECT i.*, p.* FROM tgl_loom_instances i JOIN programs p ON i.program_id = p.id WHERE i.id = $1',
      [instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Instance with ID ${instanceId} not found`
      };
    }
    
    const instance = instanceResult.rows[0];
    
    // Get participant count to determine staff needs
    const participantCountResult = await client.query(
      'SELECT COUNT(*) as count FROM tgl_loom_participant_allocations WHERE loom_instance_id = $1 AND allocation_status = $2',
      [instanceId, 'planned']
    );
    
    const participantCount = parseInt(participantCountResult.rows[0].count, 10);
    
    // Calculate required staff (basic rule: 1 lead + 1 support per 5 participants)
    const requiredSupport = Math.ceil(participantCount / 5);
    const totalStaffNeeded = 1 + requiredSupport; // 1 lead + support staff
    
    // Check if we need a driver (non-centre based programs need a driver)
    const needsDriver = !instance.is_centre_based;
    const totalWithDriver = needsDriver ? totalStaffNeeded + 1 : totalStaffNeeded;
    
    // Get instance date and convert to JS Date
    const instanceDate = new Date(instance.instance_date);
    const dayOfWeek = instanceDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Parse program start and end times
    const [startHour, startMinute] = instance.start_time.split(':').map(Number);
    const [endHour, endMinute] = instance.end_time.split(':').map(Number);
    
    // Create start and end timestamps
    const startTimestamp = new Date(instanceDate);
    startTimestamp.setHours(startHour, startMinute, 0, 0);
    
    const endTimestamp = new Date(instanceDate);
    endTimestamp.setHours(endHour, endMinute, 0, 0);
    
    // Find available staff for this day and time
    const availableStaffResult = await client.query(
      `SELECT s.*, sa.start_time, sa.end_time
      FROM staff s
      JOIN staff_availability sa ON s.id = sa.staff_id
      WHERE sa.day_of_week = $1
      ORDER BY s.contracted_hours - (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_ts - start_ts)) / 3600), 0)
        FROM tgl_loom_staff_shifts
        WHERE staff_id = s.id AND status = 'planned'
      ) DESC`,
      [dayOfWeek]
    );
    
    const availableStaff = availableStaffResult.rows.filter(staff => {
      // Parse availability times
      const [availStartHour, availStartMinute] = staff.start_time.split(':').map(Number);
      const [availEndHour, availEndMinute] = staff.end_time.split(':').map(Number);
      
      // Create availability timestamps
      const availStart = new Date(instanceDate);
      availStart.setHours(availStartHour, availStartMinute, 0, 0);
      
      const availEnd = new Date(instanceDate);
      availEnd.setHours(availEndHour, availEndMinute, 0, 0);
      
      // Check if staff is available during the entire program time
      return availStart <= startTimestamp && availEnd >= endTimestamp;
    });
    
    // Check if we have enough staff
    if (availableStaff.length < totalStaffNeeded) {
      // Not enough staff, flag the instance
      await client.query(
        `UPDATE tgl_loom_instances 
        SET optimisation_state = jsonb_set(optimisation_state, '{staffing_status}', '"insufficient"')
        WHERE id = $1`,
        [instanceId]
      );
      
      await client.query('COMMIT');
      
      return {
        success: false,
        message: `Not enough available staff for instance ${instanceId}. Need ${totalStaffNeeded}, found ${availableStaff.length}`,
        data: {
          instanceId,
          requiredStaff: totalStaffNeeded,
          availableStaff: availableStaff.length
        }
      };
    }
    
    // Assign staff
    const assignedStaff = [];
    
    // Assign lead (first available)
    if (availableStaff.length > 0) {
      const lead = availableStaff.shift(); // Take the first staff member as lead
      
      const leadResult = await client.query(
        `INSERT INTO tgl_loom_staff_shifts
        (loom_instance_id, staff_id, role, start_ts, end_ts, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          instanceId,
          lead.id,
          'lead',
          startTimestamp,
          endTimestamp,
          'planned'
        ]
      );
      
      assignedStaff.push({
        shiftId: leadResult.rows[0].id,
        staffId: lead.id,
        role: 'lead',
        name: `${lead.first_name} ${lead.last_name}`
      });
    }
    
    // Assign support staff
    for (let i = 0; i < requiredSupport && i < availableStaff.length; i++) {
      const support = availableStaff[i];
      
      const supportResult = await client.query(
        `INSERT INTO tgl_loom_staff_shifts
        (loom_instance_id, staff_id, role, start_ts, end_ts, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          instanceId,
          support.id,
          'support',
          startTimestamp,
          endTimestamp,
          'planned'
        ]
      );
      
      assignedStaff.push({
        shiftId: supportResult.rows[0].id,
        staffId: support.id,
        role: 'support',
        name: `${support.first_name} ${support.last_name}`
      });
    }
    
    // Assign driver if needed
    if (needsDriver && availableStaff.length > requiredSupport) {
      const driver = availableStaff[requiredSupport];
      
      const driverResult = await client.query(
        `INSERT INTO tgl_loom_staff_shifts
        (loom_instance_id, staff_id, role, start_ts, end_ts, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          instanceId,
          driver.id,
          'driver',
          startTimestamp,
          endTimestamp,
          'planned'
        ]
      );
      
      assignedStaff.push({
        shiftId: driverResult.rows[0].id,
        staffId: driver.id,
        role: 'driver',
        name: `${driver.first_name} ${driver.last_name}`
      });
    }
    
    // Update instance staffing status
    await client.query(
      `UPDATE tgl_loom_instances 
      SET optimisation_state = jsonb_set(optimisation_state, '{staffing_status}', '"complete"')
      WHERE id = $1`,
      [instanceId]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Assigned ${assignedStaff.length} staff to instance ${instanceId}`);
    
    return {
      success: true,
      message: `Assigned ${assignedStaff.length} staff to instance`,
      data: {
        instanceId,
        assignedStaff,
        staffCount: assignedStaff.length,
        requiredStaff: totalStaffNeeded
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error assigning staff to instance ${instanceId}:`, error);
    
    return {
      success: false,
      message: `Error assigning staff: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Assign vehicles and optimize routes for a loom instance
 * @param {string} instanceId - UUID of the loom instance
 * @returns {Promise<Object>} Result of the vehicle assignment operation
 */
const assignVehicles = async (instanceId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get instance details
    const instanceResult = await client.query(
      'SELECT i.*, p.* FROM tgl_loom_instances i JOIN programs p ON i.program_id = p.id WHERE i.id = $1',
      [instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Instance with ID ${instanceId} not found`
      };
    }
    
    const instance = instanceResult.rows[0];
    
    // Skip vehicle assignment for centre-based programs if no transport needed
    if (instance.is_centre_based) {
      await client.query('COMMIT');
      return {
        success: true,
        message: 'Centre-based program, no vehicles needed',
        data: {
          instanceId,
          vehiclesAssigned: 0,
          isCentreBased: true
        }
      };
    }
    
    // Get participants for this instance
    const participantsResult = await client.query(
      `SELECT pa.*, p.* 
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.loom_instance_id = $1 AND pa.allocation_status = $2`,
      [instanceId, 'planned']
    );
    
    const participants = participantsResult.rows;
    
    // Get available vehicles
    const vehiclesResult = await client.query(
      `SELECT * FROM vehicles 
      WHERE id NOT IN (
        SELECT vehicle_id FROM tgl_loom_vehicle_runs 
        WHERE loom_instance_id IN (
          SELECT id FROM tgl_loom_instances 
          WHERE instance_date = $1
        )
      )`,
      [instance.instance_date]
    );
    
    const availableVehicles = vehiclesResult.rows;
    
    // Calculate how many vehicles we need based on participant count and vehicle capacity
    const totalParticipants = participants.length;
    let remainingParticipants = totalParticipants;
    const vehiclesNeeded = [];
    
    for (const vehicle of availableVehicles) {
      if (remainingParticipants <= 0) break;
      
      // Each vehicle needs 1 seat for driver
      const availableSeats = vehicle.seats - 1;
      vehiclesNeeded.push({
        vehicleId: vehicle.id,
        capacity: availableSeats,
        participants: []
      });
      
      remainingParticipants -= availableSeats;
    }
    
    // Check if we have enough vehicles
    if (remainingParticipants > 0) {
      // Not enough vehicles, flag the instance
      await client.query(
        `UPDATE tgl_loom_instances 
        SET optimisation_state = jsonb_set(optimisation_state, '{vehicle_status}', '"insufficient"')
        WHERE id = $1`,
        [instanceId]
      );
      
      await client.query('COMMIT');
      
      return {
        success: false,
        message: `Not enough vehicles for instance ${instanceId}. Need capacity for ${totalParticipants} participants.`,
        data: {
          instanceId,
          participantCount: totalParticipants,
          availableVehicles: availableVehicles.length,
          availableCapacity: availableVehicles.reduce((sum, v) => sum + v.seats - 1, 0)
        }
      };
    }
    
    // Assign participants to vehicles and create routes
    // This is a simplified version - in a real system, we'd use routeOptimizationService
    // to calculate optimal routes based on addresses
    
    // Simple allocation: distribute participants evenly across vehicles
    let vehicleIndex = 0;
    for (const participant of participants) {
      const vehicle = vehiclesNeeded[vehicleIndex];
      vehicle.participants.push({
        id: participant.participant_id,
        name: `${participant.first_name} ${participant.last_name}`,
        address: participant.address,
        suburb: participant.suburb,
        latitude: participant.latitude,
        longitude: participant.longitude
      });
      
      // Move to next vehicle if this one is full
      if (vehicle.participants.length >= vehicle.capacity) {
        vehicleIndex++;
      }
      
      // Wrap around if needed
      if (vehicleIndex >= vehiclesNeeded.length) {
        vehicleIndex = 0;
      }
    }
    
    // Create vehicle runs for each assigned vehicle
    const vehicleRuns = [];
    
    for (const vehicle of vehiclesNeeded) {
      if (vehicle.participants.length === 0) continue;
      
      // Create a simple route (in reality, this would use routeOptimizationService)
      const route = {
        stops: vehicle.participants.map(p => ({
          participantId: p.id,
          address: p.address,
          suburb: p.suburb,
          latitude: p.latitude,
          longitude: p.longitude
        })),
        estimatedDuration: vehicle.participants.length * 10, // Simple estimate: 10 minutes per stop
        totalDistance: vehicle.participants.length * 5     // Simple estimate: 5 km per stop
      };
      
      // Create the vehicle run
      const runResult = await client.query(
        `INSERT INTO tgl_loom_vehicle_runs
        (loom_instance_id, vehicle_id, route_data, seats_used, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [
          instanceId,
          vehicle.vehicleId,
          JSON.stringify(route),
          vehicle.participants.length,
          'planned'
        ]
      );
      
      vehicleRuns.push({
        runId: runResult.rows[0].id,
        vehicleId: vehicle.vehicleId,
        participantCount: vehicle.participants.length,
        stops: route.stops.length
      });
    }
    
    // Update instance vehicle status
    await client.query(
      `UPDATE tgl_loom_instances 
      SET optimisation_state = jsonb_set(optimisation_state, '{vehicle_status}', '"complete"')
      WHERE id = $1`,
      [instanceId]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Assigned ${vehicleRuns.length} vehicles to instance ${instanceId}`);
    
    return {
      success: true,
      message: `Assigned ${vehicleRuns.length} vehicles to instance`,
      data: {
        instanceId,
        vehicleRuns,
        vehicleCount: vehicleRuns.length,
        participantCount: totalParticipants
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error assigning vehicles to instance ${instanceId}:`, error);
    
    return {
      success: false,
      message: `Error assigning vehicles: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Handle a participant cancellation
 * @param {string} allocationId - UUID of the participant allocation
 * @param {string} type - Type of cancellation ('normal' or 'short_notice')
 * @returns {Promise<Object>} Result of the cancellation operation
 */
const handleParticipantCancellation = async (allocationId, type = 'normal') => {
  if (!['normal', 'short_notice'].includes(type)) {
    return {
      success: false,
      message: `Invalid cancellation type: ${type}. Must be 'normal' or 'short_notice'.`
    };
  }
  
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get allocation details
    const allocationResult = await client.query(
      `SELECT pa.*, i.id as instance_id, i.program_id, p.name as participant_name
      FROM tgl_loom_participant_allocations pa
      JOIN tgl_loom_instances i ON pa.loom_instance_id = i.id
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.id = $1`,
      [allocationId]
    );
    
    if (allocationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Allocation with ID ${allocationId} not found`
      };
    }
    
    const allocation = allocationResult.rows[0];
    const instanceId = allocation.instance_id;
    
    // Update allocation status
    await client.query(
      `UPDATE tgl_loom_participant_allocations
      SET allocation_status = $1, cancellation_type = $2, updated_at = NOW()
      WHERE id = $3`,
      ['cancelled', type, allocationId]
    );
    
    // Log the cancellation
    await client.query(
      `INSERT INTO tgl_loom_audit_log
      (loom_instance_id, action, before_state, after_state, actor)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        instanceId,
        'participant_cancelled',
        JSON.stringify({ allocation_status: 'planned' }),
        JSON.stringify({ 
          allocation_status: 'cancelled',
          cancellation_type: type,
          participant_id: allocation.participant_id,
          participant_name: allocation.participant_name
        }),
        'loom_engine'
      ]
    );
    
    // Get updated participant count
    const participantCountResult = await client.query(
      'SELECT COUNT(*) as count FROM tgl_loom_participant_allocations WHERE loom_instance_id = $1 AND allocation_status = $2',
      [instanceId, 'planned']
    );
    
    const participantCount = parseInt(participantCountResult.rows[0].count, 10);
    
    // Check if we need to rebalance staff based on new participant count
    const staffNeededResult = await client.query(
      'SELECT COUNT(*) as count FROM tgl_loom_staff_shifts WHERE loom_instance_id = $1 AND status = $2',
      [instanceId, 'planned']
    );
    
    const currentStaffCount = parseInt(staffNeededResult.rows[0].count, 10);
    const newStaffNeeded = Math.ceil(participantCount / 5) + 1; // 1 lead + 1 support per 5 participants
    
    let staffingChanged = false;
    
    if (newStaffNeeded < currentStaffCount) {
      // We can reduce staff - remove the most recently assigned support staff
      const extraStaffToRemove = currentStaffCount - newStaffNeeded;
      
      if (extraStaffToRemove > 0) {
        // Find the most recently assigned support staff
        const supportStaffResult = await client.query(
          `SELECT id FROM tgl_loom_staff_shifts
          WHERE loom_instance_id = $1 AND role = $2 AND status = $3
          ORDER BY created_at DESC
          LIMIT $4`,
          [instanceId, 'support', 'planned', extraStaffToRemove]
        );
        
        // Remove them
        for (const staff of supportStaffResult.rows) {
          await client.query(
            'DELETE FROM tgl_loom_staff_shifts WHERE id = $1',
            [staff.id]
          );
        }
        
        staffingChanged = true;
      }
    }
    
    // Rebalance vehicle routes if needed
    // In a real system, this would call routeOptimizationService to recalculate routes
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Processed cancellation for allocation ${allocationId}, type: ${type}`);
    
    return {
      success: true,
      message: `Processed cancellation for participant`,
      data: {
        allocationId,
        instanceId,
        cancellationType: type,
        participantId: allocation.participant_id,
        staffingChanged,
        newParticipantCount: participantCount
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error processing cancellation for allocation ${allocationId}:`, error);
    
    return {
      success: false,
      message: `Error processing cancellation: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Handle staff sickness by finding a replacement or flagging for manual intervention
 * @param {string} shiftId - UUID of the staff shift
 * @returns {Promise<Object>} Result of the staff sickness operation
 */
const handleStaffSickness = async (shiftId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get shift details
    const shiftResult = await client.query(
      `SELECT s.*, i.instance_date, i.program_id, p.start_time, p.end_time, p.day_of_week,
      staff.first_name, staff.last_name
      FROM tgl_loom_staff_shifts s
      JOIN tgl_loom_instances i ON s.loom_instance_id = i.id
      JOIN programs p ON i.program_id = p.id
      JOIN staff ON s.staff_id = staff.id
      WHERE s.id = $1`,
      [shiftId]
    );
    
    if (shiftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Shift with ID ${shiftId} not found`
      };
    }
    
    const shift = shiftResult.rows[0];
    const instanceId = shift.loom_instance_id;
    const staffRole = shift.role;
    
    // Get instance date and convert to JS Date
    const instanceDate = new Date(shift.instance_date);
    const dayOfWeek = instanceDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Parse program start and end times
    const [startHour, startMinute] = shift.start_time.split(':').map(Number);
    const [endHour, endMinute] = shift.end_time.split(':').map(Number);
    
    // Create start and end timestamps
    const startTimestamp = new Date(instanceDate);
    startTimestamp.setHours(startHour, startMinute, 0, 0);
    
    const endTimestamp = new Date(instanceDate);
    endTimestamp.setHours(endHour, endMinute, 0, 0);
    
    // Find available replacement staff for this day and time
    const availableStaffResult = await client.query(
      `SELECT s.*, sa.start_time, sa.end_time
      FROM staff s
      JOIN staff_availability sa ON s.id = sa.staff_id
      WHERE sa.day_of_week = $1
      AND s.id != $2
      AND s.id NOT IN (
        SELECT staff_id FROM tgl_loom_staff_shifts
        WHERE loom_instance_id = $3
      )
      ORDER BY s.contracted_hours - (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_ts - start_ts)) / 3600), 0)
        FROM tgl_loom_staff_shifts
        WHERE staff_id = s.id AND status = 'planned'
      ) DESC`,
      [dayOfWeek, shift.staff_id, instanceId]
    );
    
    const availableStaff = availableStaffResult.rows.filter(staff => {
      // Parse availability times
      const [availStartHour, availStartMinute] = staff.start_time.split(':').map(Number);
      const [availEndHour, availEndMinute] = staff.end_time.split(':').map(Number);
      
      // Create availability timestamps
      const availStart = new Date(instanceDate);
      availStart.setHours(availStartHour, availStartMinute, 0, 0);
      
      const availEnd = new Date(instanceDate);
      availEnd.setHours(availEndHour, availEndMinute, 0, 0);
      
      // Check if staff is available during the entire program time
      return availStart <= startTimestamp && availEnd >= endTimestamp;
    });
    
    // Try to find a replacement
    if (availableStaff.length > 0) {
      // Found a replacement
      const replacement = availableStaff[0];
      
      // Mark current staff as replaced
      await client.query(
        `UPDATE tgl_loom_staff_shifts
        SET status = $1, notes = $2, updated_at = NOW()
        WHERE id = $3`,
        ['replaced', `Sick, replaced by ${replacement.first_name} ${replacement.last_name}`, shiftId]
      );
      
      // Create new shift for replacement staff
      const replacementResult = await client.query(
        `INSERT INTO tgl_loom_staff_shifts
        (loom_instance_id, staff_id, role, start_ts, end_ts, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          instanceId,
          replacement.id,
          staffRole,
          shift.start_ts,
          shift.end_ts,
          'planned',
          `Replacement for ${shift.first_name} ${shift.last_name} (sick)`
        ]
      );
      
      // Log the replacement
      await client.query(
        `INSERT INTO tgl_loom_audit_log
        (loom_instance_id, action, before_state, after_state, actor)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          instanceId,
          'staff_replaced',
          JSON.stringify({ 
            staff_id: shift.staff_id,
            staff_name: `${shift.first_name} ${shift.last_name}`,
            role: staffRole
          }),
          JSON.stringify({ 
            staff_id: replacement.id,
            staff_name: `${replacement.first_name} ${replacement.last_name}`,
            role: staffRole
          }),
          'loom_engine'
        ]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      logger.info(`Replaced sick staff ${shift.staff_id} with ${replacement.id} for shift ${shiftId}`);
      
      return {
        success: true,
        message: `Found replacement for sick staff`,
        data: {
          shiftId,
          instanceId,
          originalStaffId: shift.staff_id,
          originalStaffName: `${shift.first_name} ${shift.last_name}`,
          replacementStaffId: replacement.id,
          replacementStaffName: `${replacement.first_name} ${replacement.last_name}`,
          role: staffRole
        }
      };
    } else {
      // No replacement found, flag for manual intervention
      await client.query(
        `UPDATE tgl_loom_staff_shifts
        SET status = $1, notes = $2, updated_at = NOW()
        WHERE id = $3`,
        ['flagged', 'Sick, no automatic replacement found', shiftId]
      );
      
      // Update instance staffing status
      await client.query(
        `UPDATE tgl_loom_instances 
        SET optimisation_state = jsonb_set(optimisation_state, '{staffing_status}', '"needs_attention"')
        WHERE id = $1`,
        [instanceId]
      );
      
      // Log the flagged shift
      await client.query(
        `INSERT INTO tgl_loom_audit_log
        (loom_instance_id, action, before_state, after_state, actor)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          instanceId,
          'staff_flagged',
          JSON.stringify({ 
            staff_id: shift.staff_id,
            staff_name: `${shift.first_name} ${shift.last_name}`,
            role: staffRole,
            status: 'planned'
          }),
          JSON.stringify({ 
            staff_id: shift.staff_id,
            staff_name: `${shift.first_name} ${shift.last_name}`,
            role: staffRole,
            status: 'flagged',
            reason: 'Sick, no automatic replacement found'
          }),
          'loom_engine'
        ]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      logger.warn(`No replacement found for sick staff ${shift.staff_id} for shift ${shiftId}, flagged for manual intervention`);
      
      return {
        success: false,
        message: `No replacement found for sick staff, flagged for manual intervention`,
        data: {
          shiftId,
          instanceId,
          staffId: shift.staff_id,
          staffName: `${shift.first_name} ${shift.last_name}`,
          role: staffRole,
          status: 'flagged'
        }
      };
    }
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error handling staff sickness for shift ${shiftId}:`, error);
    
    return {
      success: false,
      message: `Error handling staff sickness: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Reoptimize a loom instance by rebuilding allocations
 * @param {string} instanceId - UUID of the loom instance
 * @returns {Promise<Object>} Result of the reoptimization operation
 */
const reoptimizeInstance = async (instanceId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get instance details
    const instanceResult = await client.query(
      'SELECT * FROM tgl_loom_instances WHERE id = $1',
      [instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Instance with ID ${instanceId} not found`
      };
    }
    
    // Log the reoptimization start
    await client.query(
      `INSERT INTO tgl_loom_audit_log
      (loom_instance_id, action, before_state, after_state, actor)
      VALUES ($1, $2, $3, $4, $5)`,
      [
        instanceId,
        'reoptimization_started',
        JSON.stringify(instanceResult.rows[0]),
        null,
        'loom_engine'
      ]
    );
    
    // Clear existing staff and vehicle assignments
    await client.query(
      'DELETE FROM tgl_loom_staff_shifts WHERE loom_instance_id = $1',
      [instanceId]
    );
    
    await client.query(
      'DELETE FROM tgl_loom_vehicle_runs WHERE loom_instance_id = $1',
      [instanceId]
    );
    
    // Reset instance optimization state
    await client.query(
      `UPDATE tgl_loom_instances 
      SET optimisation_state = jsonb_set(
        COALESCE(optimisation_state, '{}')::jsonb,
        '{reoptimized}',
        'true'
      )
      WHERE id = $1`,
      [instanceId]
    );
    
    // Commit transaction to release locks
    await client.query('COMMIT');
    
    // Run the allocation steps
    const participantResult = await allocateParticipants(instanceId);
    
    if (!participantResult.success) {
      return {
        success: false,
        message: `Failed to allocate participants during reoptimization: ${participantResult.message}`,
        error: participantResult.error
      };
    }
    
    const staffResult = await assignStaff(instanceId);
    const vehicleResult = await assignVehicles(instanceId);
    
    logger.info(`Reoptimized instance ${instanceId}`);
    
    return {
      success: true,
      message: `Instance reoptimized successfully`,
      data: {
        instanceId,
        participantResult,
        staffResult,
        vehicleResult
      }
    };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Error reoptimizing instance ${instanceId}:`, error);
    
    return {
      success: false,
      message: `Error reoptimizing instance: ${error.message}`,
      error
    };
  } finally {
    client.release();
  }
};

/**
 * Get all loom instances within a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Result with loom instances
 */
const getLoomInstances = async (startDate, endDate) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as program_name, p.start_time, p.end_time,
      (SELECT COUNT(*) FROM tgl_loom_participant_allocations WHERE loom_instance_id = i.id AND allocation_status = 'planned') as participant_count,
      (SELECT COUNT(*) FROM tgl_loom_staff_shifts WHERE loom_instance_id = i.id AND status = 'planned') as staff_count,
      (SELECT COUNT(*) FROM tgl_loom_vehicle_runs WHERE loom_instance_id = i.id) as vehicle_count
      FROM tgl_loom_instances i
      JOIN programs p ON i.program_id = p.id
      WHERE i.instance_date BETWEEN $1 AND $2
      ORDER BY i.instance_date, p.start_time`,
      [formatDateForDb(startDate), formatDateForDb(endDate)]
    );
    
    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    logger.error('Error getting loom instances:', error);
    return {
      success: false,
      message: `Error getting loom instances: ${error.message}`,
      error
    };
  }
};

/**
 * Get detailed information about a specific loom instance
 * @param {string} instanceId - UUID of the loom instance
 * @returns {Promise<Object>} Result with instance details
 */
const getLoomInstanceDetails = async (instanceId) => {
  try {
    // Get basic instance info
    const instanceResult = await pool.query(
      `SELECT i.*, p.name as program_name, p.start_time, p.end_time, p.is_centre_based
      FROM tgl_loom_instances i
      JOIN programs p ON i.program_id = p.id
      WHERE i.id = $1`,
      [instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      return {
        success: false,
        message: `Instance with ID ${instanceId} not found`
      };
    }
    
    const instance = instanceResult.rows[0];
    
    // Get participants
    const participantsResult = await pool.query(
      `SELECT pa.*, p.first_name, p.last_name
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.loom_instance_id = $1`,
      [instanceId]
    );
    
    // Get staff
    const staffResult = await pool.query(
      `SELECT s.*, staff.first_name, staff.last_name
      FROM tgl_loom_staff_shifts s
      JOIN staff ON s.staff_id = staff.id
      WHERE s.loom_instance_id = $1`,
      [instanceId]
    );
    
    // Get vehicles
    const vehiclesResult = await pool.query(
      `SELECT v.*, vehicles.description
      FROM tgl_loom_vehicle_runs v
      JOIN vehicles ON v.vehicle_id = vehicles.id
      WHERE v.loom_instance_id = $1`,
      [instanceId]
    );
    
    // Get audit log
    const auditResult = await pool.query(
      `SELECT *
      FROM tgl_loom_audit_log
      WHERE loom_instance_id = $1
      ORDER BY created_at DESC`,
      [instanceId]
    );
    
    return {
      success: true,
      data: {
        instance,
        participants: participantsResult.rows,
        staff: staffResult.rows,
        vehicles: vehiclesResult.rows,
        audit: auditResult.rows
      }
    };
  } catch (error) {
    logger.error(`Error getting details for loom instance ${instanceId}:`, error);
    return {
      success: false,
      message: `Error getting instance details: ${error.message}`,
      error
    };
  }
};

module.exports = {
  getLoomWindowSize,
  setLoomWindowSize,
  generateLoomWindow,
  resizeLoomWindow,
  allocateParticipants,
  assignStaff,
  assignVehicles,
  handleParticipantCancellation,
  handleStaffSickness,
  reoptimizeInstance,
  getLoomInstances,
  getLoomInstanceDetails
};
