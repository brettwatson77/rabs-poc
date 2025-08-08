/**
 * projectorService.js
 * 
 * The Projector Service (aka "The Weaver") is the heart of The Great Loom architecture.
 * It reads from Rules tables (the Unwoven Future) and projects concrete instances
 * into the Loom window (the operational schedule).
 * 
 * This service runs periodically to maintain the rolling projection window,
 * preserving overrides and ensuring the Loom always contains the specified
 * number of weeks of future events.
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Main function to project rules into the Loom window
 * @param {Object} options - Configuration options
 * @param {boolean} options.fullRebuild - Whether to rebuild the entire Loom (default: false)
 * @param {Date} options.fromDate - Start date for projection (default: today)
 * @param {number} options.weeks - Number of weeks to project (default: from config)
 * @returns {Promise<Object>} - Results of the projection
 */
async function projectLoom(options = {}) {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Get configuration
    const config = await getConfiguration(client);
    const loomDurationWeeks = options.weeks || parseInt(config.LOOM_DURATION_WEEKS, 10) || 6;
    const qualityAuditPercentage = parseInt(config.QUALITY_AUDIT_PERCENTAGE, 10) || 5;
    
    // Calculate date range
    const fromDate = options.fromDate || new Date();
    const dateRange = calculateDateRange(fromDate, loomDurationWeeks);
    
    console.log(`Projecting Loom from ${dateRange.start} to ${dateRange.end} (${loomDurationWeeks} weeks)`);
    
    // If doing a full rebuild, clear the Loom window first (preserving overrides)
    if (options.fullRebuild) {
      await clearLoomWindow(client, dateRange, { preserveOverrides: true });
    }
    
    // Get all active rules
    const programRules = await getProgramRules(client);
    const participantRules = await getParticipantRules(client);
    const staffRules = await getStaffRules(client);
    const programExceptions = await getProgramExceptions(client, dateRange);
    
    // Track stats for return value
    const stats = {
      programsProcessed: 0,
      instancesCreated: 0,
      participantsProjected: 0,
      staffProjected: 0,
      exceptionsApplied: 0,
      overridesPreserved: 0,
      auditsTagged: 0,
    };
    
    // Process each program rule
    for (const program of programRules) {
      // Generate all dates for this program in the date range
      const instanceDates = generateInstanceDates(program, dateRange, programExceptions);
      
      // For each date, create or update a Loom instance
      for (const date of instanceDates) {
        // Skip if exception type is 'cancelled'
        const exception = programExceptions.find(e => 
          e.program_id === program.id && 
          e.exception_date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
        );
        
        if (exception && exception.exception_type === 'cancelled') {
          stats.exceptionsApplied++;
          continue;
        }
        
        // Create hash of the source rule for change detection
        const ruleHash = createRuleHash(program, date, exception);
        
        // Check if instance already exists and is overridden
        const existingInstance = await getLoomInstance(client, program.id, date);
        
        // If instance exists and is overridden, preserve the override
        if (existingInstance && existingInstance.is_overridden) {
          // Update only non-overridden fields
          await updateLoomInstance(client, existingInstance.id, {
            projection_hash: ruleHash,
            projected_at: new Date(),
          });
          stats.overridesPreserved++;
          continue;
        }
        
        // Create or update the Loom instance
        const instanceData = {
          id: existingInstance?.id || uuidv4(),
          source_rule_id: program.id,
          instance_date: date.toISOString().split('T')[0],
          start_time: exception?.start_time || program.start_time,
          end_time: exception?.end_time || program.end_time,
          venue_id: exception?.venue_id || program.venue_id,
          transport_required: program.transport_required,
          staffing_ratio: program.staffing_ratio,
          projection_hash: ruleHash,
          projected_at: new Date(),
          is_overridden: false,
        };
        
        // Randomly flag for quality audit based on configured percentage
        if (Math.random() * 100 < qualityAuditPercentage) {
          instanceData.quality_audit_flag = true;
          stats.auditsTagged++;
        }
        
        const instanceId = existingInstance?.id || 
          await createLoomInstance(client, instanceData);
          
        if (!existingInstance) {
          stats.instancesCreated++;
        }
        
        // Project participants for this instance
        const projectedParticipants = await projectParticipants(
          client, 
          instanceId, 
          program.id, 
          date, 
          participantRules
        );
        stats.participantsProjected += projectedParticipants;
        
        // Project staff for this instance
        const projectedStaff = await projectStaff(
          client, 
          instanceId, 
          program.id, 
          date, 
          staffRules
        );
        stats.staffProjected += projectedStaff;
      }
      
      stats.programsProcessed++;
    }
    
    // Clean up expired instances outside the Loom window
    const cleanupResult = await cleanupExpiredInstances(client, dateRange);
    
    // Generate event cards for all instances in the Loom
    await generateEventCards(client, dateRange);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    return {
      success: true,
      dateRange,
      stats,
      cleanupResult,
    };
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error in projectLoom:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Get configuration from the database
 * @param {Object} client - Database client
 * @returns {Promise<Object>} - Configuration object
 */
async function getConfiguration(client) {
  const { rows } = await client.query('SELECT key, value FROM tgl_config');
  
  // Convert to object
  return rows.reduce((config, row) => {
    config[row.key] = row.value;
    return config;
  }, {});
}

/**
 * Calculate the date range for the Loom window
 * @param {Date} fromDate - Start date
 * @param {number} weeks - Number of weeks
 * @returns {Object} - Date range object with start and end dates
 */
function calculateDateRange(fromDate, weeks) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + (weeks * 7) - 1);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Clear the Loom window for the specified date range
 * @param {Object} client - Database client
 * @param {Object} dateRange - Date range object with start and end dates
 * @param {Object} options - Options
 * @param {boolean} options.preserveOverrides - Whether to preserve overridden instances
 * @returns {Promise<void>}
 */
async function clearLoomWindow(client, dateRange, options = {}) {
  const { preserveOverrides } = options;
  
  let query = `
    DELETE FROM loom_instances
    WHERE instance_date BETWEEN $1 AND $2
  `;
  
  if (preserveOverrides) {
    query += ' AND is_overridden = FALSE';
  }
  
  await client.query(query, [
    dateRange.start.toISOString().split('T')[0],
    dateRange.end.toISOString().split('T')[0]
  ]);
}

/**
 * Get all active program rules
 * @param {Object} client - Database client
 * @returns {Promise<Array>} - Array of program rules
 */
async function getProgramRules(client) {
  const { rows } = await client.query(`
    SELECT * FROM rules_programs
    WHERE active = TRUE
  `);
  
  return rows;
}

/**
 * Get all participant rules
 * @param {Object} client - Database client
 * @returns {Promise<Array>} - Array of participant rules
 */
async function getParticipantRules(client) {
  const { rows } = await client.query(`
    SELECT * FROM rules_participant_schedule
    WHERE (end_date IS NULL OR end_date >= CURRENT_DATE)
  `);
  
  return rows;
}

/**
 * Get all staff rules
 * @param {Object} client - Database client
 * @returns {Promise<Array>} - Array of staff rules
 */
async function getStaffRules(client) {
  const { rows } = await client.query(`
    SELECT * FROM rules_staff_roster
    WHERE (end_date IS NULL OR end_date >= CURRENT_DATE)
  `);
  
  return rows;
}

/**
 * Get program exceptions for the date range
 * @param {Object} client - Database client
 * @param {Object} dateRange - Date range object with start and end dates
 * @returns {Promise<Array>} - Array of program exceptions
 */
async function getProgramExceptions(client, dateRange) {
  const { rows } = await client.query(`
    SELECT * FROM rules_program_exceptions
    WHERE exception_date BETWEEN $1 AND $2
  `, [
    dateRange.start.toISOString().split('T')[0],
    dateRange.end.toISOString().split('T')[0]
  ]);
  
  return rows;
}

/**
 * Generate all instance dates for a program in the date range
 * @param {Object} program - Program rule
 * @param {Object} dateRange - Date range object with start and end dates
 * @param {Array} exceptions - Array of program exceptions
 * @returns {Array<Date>} - Array of dates
 */
function generateInstanceDates(program, dateRange, exceptions) {
  const dates = [];
  const currentDate = new Date(dateRange.start);
  
  // Iterate through each day in the date range
  while (currentDate <= dateRange.end) {
    // Check if the day of the week matches
    if (currentDate.getDay() === program.day_of_week) {
      // Check for 'added' exceptions on this date
      const addedException = exceptions.find(e => 
        e.program_id === program.id && 
        e.exception_date.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0] &&
        e.exception_type === 'added'
      );
      
      // Add the date if it's a regular occurrence or an 'added' exception
      if (program.is_recurring || addedException) {
        dates.push(new Date(currentDate));
      }
    } else {
      // Check for 'added' exceptions on non-matching days
      const addedException = exceptions.find(e => 
        e.program_id === program.id && 
        e.exception_date.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0] &&
        e.exception_type === 'added'
      );
      
      if (addedException) {
        dates.push(new Date(currentDate));
      }
    }
    
    // Move to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

/**
 * Create a hash of the rule for change detection
 * @param {Object} program - Program rule
 * @param {Date} date - Instance date
 * @param {Object} exception - Program exception (if any)
 * @returns {string} - Hash string
 */
function createRuleHash(program, date, exception) {
  const hashInput = JSON.stringify({
    program_id: program.id,
    date: date.toISOString().split('T')[0],
    start_time: exception?.start_time || program.start_time,
    end_time: exception?.end_time || program.end_time,
    venue_id: exception?.venue_id || program.venue_id,
    transport_required: program.transport_required,
    staffing_ratio: program.staffing_ratio,
    updated_at: program.updated_at,
    exception: exception ? {
      id: exception.id,
      type: exception.exception_type,
      updated_at: exception.updated_at
    } : null
  });
  
  return crypto.createHash('md5').update(hashInput).digest('hex');
}

/**
 * Get a Loom instance by program ID and date
 * @param {Object} client - Database client
 * @param {string} programId - Program ID
 * @param {Date} date - Instance date
 * @returns {Promise<Object|null>} - Loom instance or null
 */
async function getLoomInstance(client, programId, date) {
  const { rows } = await client.query(`
    SELECT * FROM loom_instances
    WHERE source_rule_id = $1 AND instance_date = $2
  `, [
    programId,
    date.toISOString().split('T')[0]
  ]);
  
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Create a new Loom instance
 * @param {Object} client - Database client
 * @param {Object} data - Instance data
 * @returns {Promise<string>} - Instance ID
 */
async function createLoomInstance(client, data) {
  const { rows } = await client.query(`
    INSERT INTO loom_instances (
      id, source_rule_id, instance_date, start_time, end_time,
      venue_id, transport_required, staffing_ratio, projection_hash,
      projected_at, is_overridden, quality_audit_flag
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `, [
    data.id,
    data.source_rule_id,
    data.instance_date,
    data.start_time,
    data.end_time,
    data.venue_id,
    data.transport_required,
    data.staffing_ratio,
    data.projection_hash,
    data.projected_at,
    data.is_overridden,
    data.quality_audit_flag || false
  ]);
  
  return rows[0].id;
}

/**
 * Update an existing Loom instance
 * @param {Object} client - Database client
 * @param {string} id - Instance ID
 * @param {Object} data - Data to update
 * @returns {Promise<void>}
 */
async function updateLoomInstance(client, id, data) {
  // Build the SET clause dynamically based on provided data
  const updates = [];
  const values = [id];
  let paramIndex = 2;
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updates.length === 0) {
    return; // Nothing to update
  }
  
  const query = `
    UPDATE loom_instances
    SET ${updates.join(', ')}
    WHERE id = $1
  `;
  
  await client.query(query, values);
}

/**
 * Project participants for a Loom instance
 * @param {Object} client - Database client
 * @param {string} instanceId - Loom instance ID
 * @param {string} programId - Program ID
 * @param {Date} date - Instance date
 * @param {Array} participantRules - Array of participant rules
 * @returns {Promise<number>} - Number of participants projected
 */
async function projectParticipants(client, instanceId, programId, date, participantRules) {
  // Get existing participant attendance records (to preserve overrides)
  const { rows: existingAttendance } = await client.query(`
    SELECT * FROM loom_participant_attendance
    WHERE loom_instance_id = $1
  `, [instanceId]);
  
  // Find applicable participant rules for this program and date
  const applicableRules = participantRules.filter(rule => {
    return rule.program_id === programId &&
           new Date(rule.start_date) <= date &&
           (!rule.end_date || new Date(rule.end_date) >= date);
  });
  
  let count = 0;
  
  // Process each applicable rule
  for (const rule of applicableRules) {
    // Check if there's an existing record that's overridden
    const existing = existingAttendance.find(a => 
      a.participant_id === rule.participant_id && a.is_overridden
    );
    
    if (existing) {
      // Preserve the override
      continue;
    }
    
    // Create or update the attendance record
    await client.query(`
      INSERT INTO loom_participant_attendance (
        id, loom_instance_id, participant_id, source_rule_id,
        status, pickup_required, dropoff_required, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (loom_instance_id, participant_id)
      DO UPDATE SET
        source_rule_id = $4,
        status = $5,
        pickup_required = $6,
        dropoff_required = $7,
        notes = $8,
        updated_at = CURRENT_TIMESTAMP
    `, [
      uuidv4(),
      instanceId,
      rule.participant_id,
      rule.id,
      'confirmed',
      rule.pickup_required,
      rule.dropoff_required,
      rule.notes
    ]);
    
    count++;
  }
  
  return count;
}

/**
 * Project staff for a Loom instance
 * @param {Object} client - Database client
 * @param {string} instanceId - Loom instance ID
 * @param {string} programId - Program ID
 * @param {Date} date - Instance date
 * @param {Array} staffRules - Array of staff rules
 * @returns {Promise<number>} - Number of staff projected
 */
async function projectStaff(client, instanceId, programId, date, staffRules) {
  // Get existing staff assignments (to preserve overrides)
  const { rows: existingAssignments } = await client.query(`
    SELECT * FROM loom_staff_assignments
    WHERE loom_instance_id = $1
  `, [instanceId]);
  
  // Find applicable staff rules for this program and date
  const applicableRules = staffRules.filter(rule => {
    return rule.program_id === programId &&
           new Date(rule.start_date) <= date &&
           (!rule.end_date || new Date(rule.end_date) >= date);
  });
  
  let count = 0;
  
  // Process each applicable rule
  for (const rule of applicableRules) {
    // Check if there's an existing assignment that's overridden
    const existing = existingAssignments.find(a => 
      a.staff_id === rule.staff_id && a.is_overridden
    );
    
    if (existing) {
      // Preserve the override
      continue;
    }
    
    // Create or update the staff assignment
    await client.query(`
      INSERT INTO loom_staff_assignments (
        id, loom_instance_id, staff_id, source_rule_id,
        role, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (loom_instance_id, staff_id)
      DO UPDATE SET
        source_rule_id = $4,
        role = $5,
        notes = $6,
        updated_at = CURRENT_TIMESTAMP
    `, [
      uuidv4(),
      instanceId,
      rule.staff_id,
      rule.id,
      rule.role,
      rule.notes
    ]);
    
    count++;
  }
  
  return count;
}

/**
 * Clean up expired instances outside the Loom window
 * @param {Object} client - Database client
 * @param {Object} dateRange - Date range object with start and end dates
 * @returns {Promise<Object>} - Cleanup results
 */
async function cleanupExpiredInstances(client, dateRange) {
  // Get instances outside the date range that are not overridden
  const { rows: expiredInstances } = await client.query(`
    SELECT id FROM loom_instances
    WHERE instance_date < $1 
    AND is_overridden = FALSE
  `, [dateRange.start.toISOString().split('T')[0]]);
  
  if (expiredInstances.length === 0) {
    return { removed: 0 };
  }
  
  // Delete the expired instances
  await client.query(`
    DELETE FROM loom_instances
    WHERE id = ANY($1)
  `, [expiredInstances.map(i => i.id)]);
  
  return { removed: expiredInstances.length };
}

/**
 * Generate event cards for all instances in the Loom
 * @param {Object} client - Database client
 * @param {Object} dateRange - Date range object with start and end dates
 * @returns {Promise<void>}
 */
async function generateEventCards(client, dateRange) {
  // Clear existing cards for the date range
  await client.query(`
    DELETE FROM event_card_map
    WHERE loom_instance_id IN (
      SELECT id FROM loom_instances
      WHERE instance_date BETWEEN $1 AND $2
    )
  `, [
    dateRange.start.toISOString().split('T')[0],
    dateRange.end.toISOString().split('T')[0]
  ]);
  
  // Get all instances in the date range
  const { rows: instances } = await client.query(`
    SELECT 
      li.*,
      rp.name AS program_name,
      v.name AS venue_name
    FROM loom_instances li
    JOIN rules_programs rp ON li.source_rule_id = rp.id
    LEFT JOIN venues v ON li.venue_id = v.id
    WHERE li.instance_date BETWEEN $1 AND $2
  `, [
    dateRange.start.toISOString().split('T')[0],
    dateRange.end.toISOString().split('T')[0]
  ]);
  
  // For each instance, generate cards
  for (const instance of instances) {
    // Check if transport is required
    if (instance.transport_required) {
      // Generate pickup card (1 hour before activity)
      const pickupStart = new Date(`${instance.instance_date}T${instance.start_time}`);
      pickupStart.setHours(pickupStart.getHours() - 1);
      const pickupEnd = new Date(`${instance.instance_date}T${instance.start_time}`);
      
      await client.query(`
        INSERT INTO event_card_map (
          id, loom_instance_id, card_type, card_order,
          display_title, display_subtitle, 
          display_time_start, display_time_end,
          card_color, card_icon
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        uuidv4(),
        instance.id,
        'pickup',
        1,
        `${instance.program_name} Pickup`,
        'Transport to venue',
        pickupStart.toISOString(),
        pickupEnd.toISOString(),
        'blue',
        'bus'
      ]);
      
      // Generate dropoff card (1 hour after activity)
      const dropoffStart = new Date(`${instance.instance_date}T${instance.end_time}`);
      const dropoffEnd = new Date(`${instance.instance_date}T${instance.end_time}`);
      dropoffEnd.setHours(dropoffEnd.getHours() + 1);
      
      await client.query(`
        INSERT INTO event_card_map (
          id, loom_instance_id, card_type, card_order,
          display_title, display_subtitle, 
          display_time_start, display_time_end,
          card_color, card_icon
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        uuidv4(),
        instance.id,
        'dropoff',
        3,
        `${instance.program_name} Dropoff`,
        'Transport from venue',
        dropoffStart.toISOString(),
        dropoffEnd.toISOString(),
        'orange',
        'bus'
      ]);
    }
    
    // Generate activity card
    const activityStart = new Date(`${instance.instance_date}T${instance.start_time}`);
    const activityEnd = new Date(`${instance.instance_date}T${instance.end_time}`);
    
    await client.query(`
      INSERT INTO event_card_map (
        id, loom_instance_id, card_type, card_order,
        display_title, display_subtitle, 
        display_time_start, display_time_end,
        card_color, card_icon
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      uuidv4(),
      instance.id,
      'activity',
      2,
      instance.program_name,
      instance.venue_name || 'No venue',
      activityStart.toISOString(),
      activityEnd.toISOString(),
      'green',
      'calendar'
    ]);
    
    // Generate roster cards (one per staff)
    const { rows: staffAssignments } = await client.query(`
      SELECT 
        lsa.*,
        s.first_name || ' ' || s.last_name AS staff_name
      FROM loom_staff_assignments lsa
      JOIN staff s ON lsa.staff_id = s.id
      WHERE lsa.loom_instance_id = $1
    `, [instance.id]);
    
    let cardOrder = 4;
    for (const staff of staffAssignments) {
      await client.query(`
        INSERT INTO event_card_map (
          id, loom_instance_id, card_type, card_order,
          display_title, display_subtitle, 
          display_time_start, display_time_end,
          card_color, card_icon
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        uuidv4(),
        instance.id,
        'roster',
        cardOrder,
        `${staff.staff_name} (${staff.role})`,
        instance.program_name,
        activityStart.toISOString(),
        activityEnd.toISOString(),
        'purple',
        'user'
      ]);
      
      cardOrder++;
    }
  }
}

/**
 * Move completed instances from Loom to History Ribbon
 * @param {Date} cutoffDate - Date before which instances are considered completed
 * @returns {Promise<Object>} - Results of the operation
 */
async function weaveCompletedToHistory(cutoffDate = new Date()) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find completed instances (before cutoff date)
    const { rows: completedInstances } = await client.query(`
      SELECT 
        li.*,
        rp.name AS program_name,
        rp.description AS program_description,
        v.name AS venue_name,
        v.address AS venue_address,
        (SELECT COUNT(*) FROM loom_participant_attendance WHERE loom_instance_id = li.id) AS participant_count,
        (SELECT COUNT(*) FROM loom_staff_assignments WHERE loom_instance_id = li.id) AS staff_count,
        (SELECT COUNT(*) FROM loom_vehicle_assignments WHERE loom_instance_id = li.id) AS vehicle_count
      FROM loom_instances li
      JOIN rules_programs rp ON li.source_rule_id = rp.id
      LEFT JOIN venues v ON li.venue_id = v.id
      WHERE li.instance_date < $1
    `, [cutoffDate.toISOString().split('T')[0]]);
    
    const stats = {
      instancesWoven: 0,
      participantsArchived: 0,
      staffArchived: 0,
      diamondsCreated: 0
    };
    
    // Process each completed instance
    for (const instance of completedInstances) {
      // Create history ribbon entry
      const historyId = uuidv4();
      await client.query(`
        INSERT INTO history_ribbon_shifts (
          id, original_loom_id, program_name, program_description,
          instance_date, start_time, end_time,
          venue_name, venue_address,
          participant_count, staff_count, vehicle_count,
          completion_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        historyId,
        instance.id,
        instance.program_name,
        instance.program_description,
        instance.instance_date,
        instance.start_time,
        instance.end_time,
        instance.venue_name,
        instance.venue_address,
        instance.participant_count,
        instance.staff_count,
        instance.vehicle_count,
        'completed' // Default status
      ]);
      
      // Archive participants
      const { rows: participants } = await client.query(`
        SELECT 
          lpa.*,
          p.first_name || ' ' || p.last_name AS participant_name
        FROM loom_participant_attendance lpa
        JOIN participants p ON lpa.participant_id = p.id
        WHERE lpa.loom_instance_id = $1
      `, [instance.id]);
      
      for (const participant of participants) {
        await client.query(`
          INSERT INTO history_ribbon_participants (
            id, history_shift_id, participant_id, participant_name,
            attendance_status, pickup_provided, dropoff_provided, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          uuidv4(),
          historyId,
          participant.participant_id,
          participant.participant_name,
          participant.status,
          participant.pickup_required,
          participant.dropoff_required,
          participant.notes
        ]);
        
        // Create payment diamond if attendance status is 'attended' or 'cancelled'
        if (participant.status === 'attended' || participant.status === 'cancelled') {
          // Get rate information
          const { rows: rates } = await client.query(`
            SELECT * FROM rate_line_items
            WHERE program_id = $1
            LIMIT 1
          `, [instance.source_rule_id]);
          
          if (rates.length > 0) {
            const rate = rates[0];
            await client.query(`
              INSERT INTO payment_diamonds (
                id, history_shift_id, participant_id,
                support_item_number, unit_price, quantity, total_amount,
                gst_code, status
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              uuidv4(),
              historyId,
              participant.participant_id,
              rate.support_number,
              rate.unit_price,
              1, // Default quantity
              rate.unit_price, // Total = unit_price * quantity
              rate.gst_code,
              'completed' // Initial status (red)
            ]);
            
            stats.diamondsCreated++;
          }
        }
        
        stats.participantsArchived++;
      }
      
      // Archive staff
      const { rows: staff } = await client.query(`
        SELECT 
          lsa.*,
          s.first_name || ' ' || s.last_name AS staff_name
        FROM loom_staff_assignments lsa
        JOIN staff s ON lsa.staff_id = s.id
        WHERE lsa.loom_instance_id = $1
      `, [instance.id]);
      
      for (const staffMember of staff) {
        // Calculate hours worked based on instance duration
        const startTime = new Date(`${instance.instance_date}T${instance.start_time}`);
        const endTime = new Date(`${instance.instance_date}T${instance.end_time}`);
        const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
        
        await client.query(`
          INSERT INTO history_ribbon_staff (
            id, history_shift_id, staff_id, staff_name,
            role, hours_worked, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          historyId,
          staffMember.staff_id,
          staffMember.staff_name,
          staffMember.role,
          hoursWorked,
          staffMember.notes
        ]);
        
        stats.staffArchived++;
      }
      
      // Add vector tags for searchability
      await client.query(`
        INSERT INTO history_ribbon_tags (
          id, history_shift_id, tag_key, tag_value
        )
        VALUES 
          ($1, $2, 'program', $3),
          ($4, $2, 'venue', $5),
          ($6, $2, 'date', $7)
      `, [
        uuidv4(), historyId, instance.program_name,
        uuidv4(), historyId, instance.venue_name || 'No venue',
        uuidv4(), historyId, instance.instance_date
      ]);
      
      // Delete the Loom instance (cascade will clean up related records)
      await client.query(`
        DELETE FROM loom_instances
        WHERE id = $1
      `, [instance.id]);
      
      stats.instancesWoven++;
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      cutoffDate,
      stats
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in weaveCompletedToHistory:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  projectLoom,
  weaveCompletedToHistory,
  // Export internal functions for testing
  calculateDateRange,
  generateInstanceDates,
  createRuleHash
};
