/**
 * Loom Roller Service
 * 
 * Handles the automatic daily rolling of the loom window.
 * Runs via node-cron at 00:05 Sydney time each night.
 * 
 * Core responsibilities:
 * 1. Calculate new window dates
 * 2. Generate instances for new end date
 * 3. Apply operator intents and exceptions
 * 4. Assign staff and vehicles
 * 5. Clean up instances outside window
 */

const { pool } = require('../database');
const cron = require('node-cron');
const { 
  formatDateForDb, 
  parseDbDate, 
  addDays, 
  addWeeks, 
  isSameDay,
  getTodaySydney
} = require('../utils/dateUtils');
const logger = require('../utils/logger');

/**
 * Main entry point for the daily roll process
 * Called by cron job at 00:05 Sydney time
 */
async function dailyRoll() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    logger.info('Starting daily loom roll process');
    
    // Get current window size from settings
    const settingsResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    if (!settingsResult.rows.length) {
      throw new Error('Loom window size setting not found');
    }
    
    const windowWeeks = parseInt(settingsResult.rows[0].value, 10);
    if (isNaN(windowWeeks) || windowWeeks < 2 || windowWeeks > 16) {
      throw new Error(`Invalid window size: ${windowWeeks}. Must be between 2-16 weeks.`);
    }
    
    // Calculate today and window end date
    const today = getTodaySydney();
    const windowEndDate = addWeeks(today, windowWeeks);
    
    logger.info(`Loom window: ${formatDateForDb(today)} to ${formatDateForDb(windowEndDate)} (${windowWeeks} weeks)`);
    
    // Generate instances for the new end date
    const newInstancesCount = await generateMissingInstances(client, windowEndDate);
    logger.info(`Generated ${newInstancesCount} new instances for ${formatDateForDb(windowEndDate)}`);
    
    // Apply operator intents for the new date
    const intentsApplied = await applyOperatorIntents(client, windowEndDate);
    logger.info(`Applied ${intentsApplied} operator intents for ${formatDateForDb(windowEndDate)}`);
    
    // Apply temporal exceptions for the new date
    const exceptionsApplied = await applyTemporalExceptions(client, windowEndDate);
    logger.info(`Applied ${exceptionsApplied} temporal exceptions for ${formatDateForDb(windowEndDate)}`);
    
    // Assign staff and vehicles for new instances
    const resourcesAssigned = await assignResources(client, windowEndDate);
    logger.info(`Assigned resources to ${resourcesAssigned} instances for ${formatDateForDb(windowEndDate)}`);
    
    // Clean up instances that have rolled out of the window
    const purgedCount = await purgeOldInstances(client, today);
    logger.info(`Purged ${purgedCount} instances outside the current window`);
    
    // Log roll completion to audit log
    await client.query(
      'INSERT INTO tgl_loom_audit_log (action, details, status) VALUES ($1, $2, $3)',
      [
        'DAILY_ROLL', 
        JSON.stringify({
          date: formatDateForDb(today),
          windowEnd: formatDateForDb(windowEndDate),
          newInstances: newInstancesCount,
          intentsApplied,
          exceptionsApplied,
          resourcesAssigned,
          purgedCount
        }),
        'SUCCESS'
      ]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    logger.info('Daily loom roll completed successfully');
    
    return {
      success: true,
      date: formatDateForDb(today),
      windowEnd: formatDateForDb(windowEndDate),
      stats: {
        newInstances: newInstancesCount,
        intentsApplied,
        exceptionsApplied,
        resourcesAssigned,
        purgedCount
      }
    };
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    logger.error(`Daily roll failed: ${error.message}`, { error });
    
    // Log failure to audit log
    try {
      await client.query(
        'INSERT INTO tgl_loom_audit_log (action, details, status) VALUES ($1, $2, $3)',
        ['DAILY_ROLL', JSON.stringify({ error: error.message }), 'ERROR']
      );
    } catch (logError) {
      logger.error(`Failed to log roll failure: ${logError.message}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Generate missing loom instances for a specific date
 * @param {Object} client - Database client within transaction
 * @param {Date} date - Date to generate instances for
 * @returns {Number} Count of instances created
 */
async function generateMissingInstances(client, date) {
  const formattedDate = formatDateForDb(date);
  let instancesCreated = 0;
  
  // Get all active programs
  const programsResult = await client.query(
    `SELECT id, name, start_time, end_time, days_of_week, venue_id, capacity
     FROM programs 
     WHERE is_active = true
     AND start_date <= $1
     AND (end_date IS NULL OR end_date >= $1)`,
    [formattedDate]
  );
  
  // Get day of week for target date (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = date.getDay();
  
  for (const program of programsResult.rows) {
    // Check if program runs on this day of week
    const daysArray = program.days_of_week.split(',').map(d => parseInt(d.trim(), 10));
    
    if (!daysArray.includes(dayOfWeek)) {
      continue; // Program doesn't run on this day
    }
    
    // Check if instance already exists
    const existingResult = await client.query(
      `SELECT id FROM tgl_loom_instances 
       WHERE program_id = $1 AND date = $2`,
      [program.id, formattedDate]
    );
    
    if (existingResult.rows.length > 0) {
      continue; // Instance already exists
    }
    
    // Create new instance
    const instanceResult = await client.query(
      `INSERT INTO tgl_loom_instances 
       (program_id, date, start_time, end_time, venue_id, capacity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        program.id, 
        formattedDate, 
        program.start_time, 
        program.end_time, 
        program.venue_id, 
        program.capacity, 
        'GENERATED'
      ]
    );
    
    const instanceId = instanceResult.rows[0].id;
    instancesCreated++;
    
    // Get default participant allocations from program_participants
    const participantsResult = await client.query(
      `SELECT participant_id, billing_code_id, hours
       FROM program_participants
       WHERE program_id = $1 AND is_active = true`,
      [program.id]
    );
    
    // Create participant allocations
    for (const participant of participantsResult.rows) {
      await client.query(
        `INSERT INTO tgl_loom_participant_allocations
         (instance_id, participant_id, billing_code_id, hours, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          instanceId,
          participant.participant_id,
          participant.billing_code_id,
          participant.hours,
          'CONFIRMED'
        ]
      );
    }
  }
  
  return instancesCreated;
}

/**
 * Apply operator intents for a specific date
 * @param {Object} client - Database client within transaction
 * @param {Date} date - Date to apply intents for
 * @returns {Number} Count of intents applied
 */
async function applyOperatorIntents(client, date) {
  const formattedDate = formatDateForDb(date);
  let intentsApplied = 0;
  
  // Get all operator intents that apply to this date
  const intentsResult = await client.query(
    `SELECT id, intent_type, program_id, participant_id, staff_id, vehicle_id,
            venue_id, start_time, end_time, billing_code_id, hours, details
     FROM tgl_operator_intents
     WHERE start_date <= $1
     AND (end_date IS NULL OR end_date >= $1)`,
    [formattedDate]
  );
  
  for (const intent of intentsResult.rows) {
    switch (intent.intent_type) {
      case 'ADD_PARTICIPANT':
        // Find instances for this program on this date
        const instancesResult = await client.query(
          `SELECT id FROM tgl_loom_instances
           WHERE program_id = $1 AND date = $2`,
          [intent.program_id, formattedDate]
        );
        
        if (instancesResult.rows.length === 0) continue;
        
        const instanceId = instancesResult.rows[0].id;
        
        // Check if participant already allocated
        const existingAllocation = await client.query(
          `SELECT id FROM tgl_loom_participant_allocations
           WHERE instance_id = $1 AND participant_id = $2`,
          [instanceId, intent.participant_id]
        );
        
        if (existingAllocation.rows.length === 0) {
          // Add participant to instance
          await client.query(
            `INSERT INTO tgl_loom_participant_allocations
             (instance_id, participant_id, billing_code_id, hours, status, intent_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              instanceId,
              intent.participant_id,
              intent.billing_code_id,
              intent.hours,
              'CONFIRMED',
              intent.id
            ]
          );
          
          intentsApplied++;
        }
        break;
        
      case 'REMOVE_PARTICIPANT':
        // Find allocations for this participant on this date
        const allocationsResult = await client.query(
          `SELECT a.id
           FROM tgl_loom_participant_allocations a
           JOIN tgl_loom_instances i ON a.instance_id = i.id
           WHERE i.program_id = $1 AND i.date = $2 AND a.participant_id = $3`,
          [intent.program_id, formattedDate, intent.participant_id]
        );
        
        if (allocationsResult.rows.length > 0) {
          // Remove participant from instance
          await client.query(
            `DELETE FROM tgl_loom_participant_allocations
             WHERE id = $1`,
            [allocationsResult.rows[0].id]
          );
          
          intentsApplied++;
        }
        break;
        
      case 'MODIFY_TIME':
        // Update instance time
        const timeUpdateResult = await client.query(
          `UPDATE tgl_loom_instances
           SET start_time = $1, end_time = $2, modified_by_intent = true
           WHERE program_id = $3 AND date = $4`,
          [intent.start_time, intent.end_time, intent.program_id, formattedDate]
        );
        
        if (timeUpdateResult.rowCount > 0) {
          intentsApplied++;
        }
        break;
        
      case 'CHANGE_VENUE':
        // Update instance venue
        const venueUpdateResult = await client.query(
          `UPDATE tgl_loom_instances
           SET venue_id = $1, modified_by_intent = true
           WHERE program_id = $2 AND date = $3`,
          [intent.venue_id, intent.program_id, formattedDate]
        );
        
        if (venueUpdateResult.rowCount > 0) {
          intentsApplied++;
        }
        break;
        
      case 'ASSIGN_STAFF':
        // Find instances for this program on this date
        const staffInstancesResult = await client.query(
          `SELECT id FROM tgl_loom_instances
           WHERE program_id = $1 AND date = $2`,
          [intent.program_id, formattedDate]
        );
        
        if (staffInstancesResult.rows.length === 0) continue;
        
        const staffInstanceId = staffInstancesResult.rows[0].id;
        
        // Add or update staff shift
        await client.query(
          `INSERT INTO tgl_loom_staff_shifts
           (instance_id, staff_id, role, start_time, end_time, intent_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (instance_id, staff_id) 
           DO UPDATE SET role = $3, start_time = $4, end_time = $5, intent_id = $6`,
          [
            staffInstanceId,
            intent.staff_id,
            intent.details?.role || 'SUPPORT',
            intent.start_time,
            intent.end_time,
            intent.id
          ]
        );
        
        intentsApplied++;
        break;
        
      default:
        logger.warn(`Unknown intent type: ${intent.intent_type}`);
    }
  }
  
  return intentsApplied;
}

/**
 * Apply temporal exceptions for a specific date
 * @param {Object} client - Database client within transaction
 * @param {Date} date - Date to apply exceptions for
 * @returns {Number} Count of exceptions applied
 */
async function applyTemporalExceptions(client, date) {
  const formattedDate = formatDateForDb(date);
  let exceptionsApplied = 0;
  
  // Get all temporal exceptions for this date
  const exceptionsResult = await client.query(
    `SELECT id, exception_type, program_id, participant_id, details
     FROM tgl_temporal_exceptions
     WHERE exception_date = $1`,
    [formattedDate]
  );
  
  for (const exception of exceptionsResult.rows) {
    switch (exception.exception_type) {
      case 'PARTICIPANT_CANCELLATION':
        // Find allocations for this participant on this date
        const allocationsResult = await client.query(
          `SELECT a.id
           FROM tgl_loom_participant_allocations a
           JOIN tgl_loom_instances i ON a.instance_id = i.id
           WHERE i.program_id = $1 AND i.date = $2 AND a.participant_id = $3`,
          [exception.program_id, formattedDate, exception.participant_id]
        );
        
        if (allocationsResult.rows.length > 0) {
          // Update allocation status to CANCELLED
          await client.query(
            `UPDATE tgl_loom_participant_allocations
             SET status = 'CANCELLED', exception_id = $1
             WHERE id = $2`,
            [exception.id, allocationsResult.rows[0].id]
          );
          
          exceptionsApplied++;
        }
        break;
        
      case 'PROGRAM_CANCELLATION':
        // Cancel entire program instance
        const programCancelResult = await client.query(
          `UPDATE tgl_loom_instances
           SET status = 'CANCELLED', exception_id = $1
           WHERE program_id = $2 AND date = $3`,
          [exception.id, exception.program_id, formattedDate]
        );
        
        if (programCancelResult.rowCount > 0) {
          exceptionsApplied++;
        }
        break;
        
      case 'ONE_OFF_CHANGE':
        // Apply one-off changes to instance
        const details = exception.details || {};
        const updateFields = [];
        const updateValues = [exception.id, exception.program_id, formattedDate];
        let paramIndex = 4;
        
        if (details.start_time) {
          updateFields.push(`start_time = $${paramIndex}`);
          updateValues.push(details.start_time);
          paramIndex++;
        }
        
        if (details.end_time) {
          updateFields.push(`end_time = $${paramIndex}`);
          updateValues.push(details.end_time);
          paramIndex++;
        }
        
        if (details.venue_id) {
          updateFields.push(`venue_id = $${paramIndex}`);
          updateValues.push(details.venue_id);
          paramIndex++;
        }
        
        if (updateFields.length > 0) {
          updateFields.push(`exception_id = $1`);
          
          const oneOffResult = await client.query(
            `UPDATE tgl_loom_instances
             SET ${updateFields.join(', ')}
             WHERE program_id = $2 AND date = $3`,
            updateValues
          );
          
          if (oneOffResult.rowCount > 0) {
            exceptionsApplied++;
          }
        }
        break;
        
      default:
        logger.warn(`Unknown exception type: ${exception.exception_type}`);
    }
  }
  
  return exceptionsApplied;
}

/**
 * Assign staff and vehicles to instances for a specific date
 * @param {Object} client - Database client within transaction
 * @param {Date} date - Date to assign resources for
 * @returns {Number} Count of instances with resources assigned
 */
async function assignResources(client, date) {
  const formattedDate = formatDateForDb(date);
  let resourcesAssigned = 0;
  
  // Get all instances for this date that need resource assignment
  const instancesResult = await client.query(
    `SELECT i.id, i.program_id, i.start_time, i.end_time, i.venue_id,
            p.name as program_name
     FROM tgl_loom_instances i
     JOIN programs p ON i.program_id = p.id
     WHERE i.date = $1 AND i.status = 'GENERATED'`,
    [formattedDate]
  );
  
  for (const instance of instancesResult.rows) {
    // Count participants for this instance
    const participantsResult = await client.query(
      `SELECT COUNT(*) as participant_count
       FROM tgl_loom_participant_allocations
       WHERE instance_id = $1 AND status = 'CONFIRMED'`,
      [instance.id]
    );
    
    const participantCount = parseInt(participantsResult.rows[0].participant_count, 10);
    
    if (participantCount === 0) {
      // No participants, no need for staff or vehicles
      continue;
    }
    
    // Calculate required staff based on 1 lead + 1 support per 5 participants rule
    const requiredSupport = Math.max(0, Math.ceil((participantCount - 5) / 5));
    const totalStaffNeeded = 1 + requiredSupport; // 1 lead + support staff
    
    // Check existing staff assignments
    const existingStaffResult = await client.query(
      `SELECT staff_id, role
       FROM tgl_loom_staff_shifts
       WHERE instance_id = $1`,
      [instance.id]
    );
    
    const existingStaff = existingStaffResult.rows;
    const hasLead = existingStaff.some(s => s.role === 'LEAD');
    const supportCount = existingStaff.filter(s => s.role === 'SUPPORT').length;
    
    // Assign lead if needed
    if (!hasLead) {
      // Find available lead staff
      const leadResult = await client.query(
        `SELECT s.id
         FROM staff s
         LEFT JOIN tgl_loom_staff_shifts ss ON 
           ss.staff_id = s.id AND 
           ss.start_time < $3 AND 
           ss.end_time > $2 AND
           EXISTS (
             SELECT 1 FROM tgl_loom_instances i 
             WHERE i.id = ss.instance_id AND i.date = $1
           )
         WHERE s.is_active = true
         AND s.can_lead = true
         AND ss.id IS NULL
         ORDER BY s.last_assigned_date ASC NULLS FIRST
         LIMIT 1`,
        [formattedDate, instance.start_time, instance.end_time]
      );
      
      if (leadResult.rows.length > 0) {
        const leadId = leadResult.rows[0].id;
        
        // Assign lead
        await client.query(
          `INSERT INTO tgl_loom_staff_shifts
           (instance_id, staff_id, role, start_time, end_time)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            instance.id,
            leadId,
            'LEAD',
            instance.start_time,
            instance.end_time
          ]
        );
        
        // Update last assigned date
        await client.query(
          `UPDATE staff SET last_assigned_date = $1 WHERE id = $2`,
          [formattedDate, leadId]
        );
      } else {
        logger.warn(`No available lead staff for instance ${instance.id} (${instance.program_name} on ${formattedDate})`);
        
        // Flag instance as needing attention
        await client.query(
          `UPDATE tgl_loom_instances
           SET status = 'NEEDS_ATTENTION', status_reason = 'No available lead staff'
           WHERE id = $1`,
          [instance.id]
        );
      }
    }
    
    // Assign support staff if needed
    if (supportCount < requiredSupport) {
      const additionalSupport = requiredSupport - supportCount;
      
      // Find available support staff
      const supportResult = await client.query(
        `SELECT s.id
         FROM staff s
         LEFT JOIN tgl_loom_staff_shifts ss ON 
           ss.staff_id = s.id AND 
           ss.start_time < $4 AND 
           ss.end_time > $3 AND
           EXISTS (
             SELECT 1 FROM tgl_loom_instances i 
             WHERE i.id = ss.instance_id AND i.date = $1
           )
         WHERE s.is_active = true
         AND ss.id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM tgl_loom_staff_shifts 
           WHERE instance_id = $2 AND staff_id = s.id
         )
         ORDER BY s.last_assigned_date ASC NULLS FIRST
         LIMIT $5`,
        [formattedDate, instance.id, instance.start_time, instance.end_time, additionalSupport]
      );
      
      for (const staff of supportResult.rows) {
        // Assign support staff
        await client.query(
          `INSERT INTO tgl_loom_staff_shifts
           (instance_id, staff_id, role, start_time, end_time)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            instance.id,
            staff.id,
            'SUPPORT',
            instance.start_time,
            instance.end_time
          ]
        );
        
        // Update last assigned date
        await client.query(
          `UPDATE staff SET last_assigned_date = $1 WHERE id = $2`,
          [formattedDate, staff.id]
        );
      }
      
      if (supportResult.rows.length < additionalSupport) {
        logger.warn(`Insufficient support staff for instance ${instance.id} (${instance.program_name} on ${formattedDate})`);
        
        // Flag instance if no lead was already assigned
        const currentStatus = await client.query(
          `SELECT status FROM tgl_loom_instances WHERE id = $1`,
          [instance.id]
        );
        
        if (currentStatus.rows[0].status !== 'NEEDS_ATTENTION') {
          await client.query(
            `UPDATE tgl_loom_instances
             SET status = 'NEEDS_ATTENTION', status_reason = 'Insufficient support staff'
             WHERE id = $1`,
            [instance.id]
          );
        }
      }
    }
    
    // Assign vehicle if needed (for programs that require transport)
    const programDetails = await client.query(
      `SELECT requires_transport FROM programs WHERE id = $1`,
      [instance.program_id]
    );
    
    if (programDetails.rows[0].requires_transport) {
      // Check if vehicle already assigned
      const existingVehicleResult = await client.query(
        `SELECT id FROM tgl_loom_vehicle_runs WHERE instance_id = $1`,
        [instance.id]
      );
      
      if (existingVehicleResult.rows.length === 0) {
        // Find available vehicle with sufficient capacity
        const vehicleResult = await client.query(
          `SELECT v.id, v.capacity
           FROM vehicles v
           LEFT JOIN tgl_loom_vehicle_runs vr ON 
             vr.vehicle_id = v.id AND 
             vr.start_time < $3 AND 
             vr.end_time > $2 AND
             EXISTS (
               SELECT 1 FROM tgl_loom_instances i 
               WHERE i.id = vr.instance_id AND i.date = $1
             )
           WHERE v.is_active = true
           AND vr.id IS NULL
           AND v.capacity >= $4
           ORDER BY v.capacity ASC
           LIMIT 1`,
          [formattedDate, instance.start_time, instance.end_time, participantCount]
        );
        
        if (vehicleResult.rows.length > 0) {
          const vehicleId = vehicleResult.rows[0].id;
          
          // Assign vehicle
          await client.query(
            `INSERT INTO tgl_loom_vehicle_runs
             (instance_id, vehicle_id, start_time, end_time, passenger_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              instance.id,
              vehicleId,
              instance.start_time,
              instance.end_time,
              participantCount
            ]
          );
        } else {
          logger.warn(`No available vehicle with sufficient capacity for instance ${instance.id} (${instance.program_name} on ${formattedDate})`);
          
          // Flag instance if not already flagged
          const currentStatus = await client.query(
            `SELECT status FROM tgl_loom_instances WHERE id = $1`,
            [instance.id]
          );
          
          if (currentStatus.rows[0].status !== 'NEEDS_ATTENTION') {
            await client.query(
              `UPDATE tgl_loom_instances
               SET status = 'NEEDS_ATTENTION', status_reason = 'No available vehicle with sufficient capacity'
               WHERE id = $1`,
              [instance.id]
            );
          }
        }
      }
    }
    
    // Mark instance as confirmed if all resources assigned and not already flagged
    const finalStatus = await client.query(
      `SELECT status FROM tgl_loom_instances WHERE id = $1`,
      [instance.id]
    );
    
    if (finalStatus.rows[0].status === 'GENERATED') {
      await client.query(
        `UPDATE tgl_loom_instances SET status = 'CONFIRMED' WHERE id = $1`,
        [instance.id]
      );
    }
    
    resourcesAssigned++;
  }
  
  return resourcesAssigned;
}

/**
 * Remove instances that have rolled out of the window
 * @param {Object} client - Database client within transaction
 * @param {Date} today - Current date
 * @returns {Number} Count of instances purged
 */
async function purgeOldInstances(client, today) {
  const formattedDate = formatDateForDb(today);
  
  // Delete instances before today
  const purgeResult = await client.query(
    `DELETE FROM tgl_loom_instances
     WHERE date < $1
     RETURNING id`,
    [formattedDate]
  );
  
  return purgeResult.rowCount;
}

/**
 * Manual trigger for daily roll (for testing or recovery)
 */
async function triggerManualRoll() {
  return await dailyRoll();
}

/**
 * Verify that the daily roll happened correctly
 * Called by verification job at 09:00
 */
async function verifyDailyRoll() {
  const client = await pool.connect();
  
  try {
    // Check if today's instances exist
    const today = getTodaySydney();
    const formattedDate = formatDateForDb(today);
    
    // Get active programs that should run today
    const dayOfWeek = today.getDay();
    
    const programsResult = await client.query(
      `SELECT COUNT(*) as program_count
       FROM programs 
       WHERE is_active = true
       AND start_date <= $1
       AND (end_date IS NULL OR end_date >= $1)
       AND days_of_week LIKE $2`,
      [formattedDate, `%${dayOfWeek}%`]
    );
    
    const expectedPrograms = parseInt(programsResult.rows[0].program_count, 10);
    
    // Check actual instances
    const instancesResult = await client.query(
      `SELECT COUNT(*) as instance_count
       FROM tgl_loom_instances
       WHERE date = $1`,
      [formattedDate]
    );
    
    const actualInstances = parseInt(instancesResult.rows[0].instance_count, 10);
    
    // Check last roll audit log
    const auditResult = await client.query(
      `SELECT status, created_at
       FROM tgl_loom_audit_log
       WHERE action = 'DAILY_ROLL'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    const lastRoll = auditResult.rows[0] || {};
    const lastRollStatus = lastRoll.status;
    const lastRollTime = lastRoll.created_at;
    
    // Determine if verification passed
    const verificationPassed = 
      actualInstances >= expectedPrograms && 
      lastRollStatus === 'SUCCESS' &&
      lastRollTime && 
      new Date(lastRollTime) > new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Log verification result
    await client.query(
      'INSERT INTO tgl_loom_audit_log (action, details, status) VALUES ($1, $2, $3)',
      [
        'ROLL_VERIFICATION', 
        JSON.stringify({
          date: formattedDate,
          expectedPrograms,
          actualInstances,
          lastRollStatus,
          lastRollTime
        }),
        verificationPassed ? 'SUCCESS' : 'WARNING'
      ]
    );
    
    if (!verificationPassed) {
      logger.warn(`Daily roll verification failed: expected ${expectedPrograms} programs, found ${actualInstances} instances`);
    } else {
      logger.info(`Daily roll verification passed: ${actualInstances} instances for ${formattedDate}`);
    }
    
    return {
      success: verificationPassed,
      date: formattedDate,
      expectedPrograms,
      actualInstances,
      lastRollStatus,
      lastRollTime
    };
  } catch (error) {
    logger.error(`Roll verification failed: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

/**
 * Initialize cron jobs for daily roll and verification
 */
function initCronJobs() {
  // Daily roll at 00:05 Sydney time
  cron.schedule('5 0 * * *', async () => {
    logger.info('Running scheduled daily loom roll');
    await dailyRoll();
  }, {
    timezone: 'Australia/Sydney'
  });
  
  // Verification job at 09:00 Sydney time
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily roll verification check');
    await verifyDailyRoll();
  }, {
    timezone: 'Australia/Sydney'
  });
  
  logger.info('Loom roller cron jobs initialized');
}

module.exports = {
  dailyRoll,
  triggerManualRoll,
  verifyDailyRoll,
  initCronJobs,
  // Export internal functions for testing
  generateMissingInstances,
  applyOperatorIntents,
  applyTemporalExceptions,
  assignResources,
  purgeOldInstances
};
