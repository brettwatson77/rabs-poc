/**
 * Program Service
 * 
 * Core service for RABS program management.
 * Handles program creation, instance generation, and related operations.
 */

const { pool } = require('../database');
const { formatDateForDb, parseDbDate, addDays, addWeeks, getTodaySydney, isSameDay } = require('../utils/dateUtils');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new program with all related records
 * 
 * @param {Object} programData - Program data including participants and time slots
 * @returns {Object} - Created program with ID
 */
async function createProgram(programData) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Extract program data
    const {
      name,
      program_type = 'community_access',
      start_date,
      end_date = null,
      repeat_pattern = 'weekly',
      days_of_week = [],
      venue_id = null,
      start_time,
      end_time,
      time_slots = [],
      notes = null,
      staff_assignment_mode = 'auto',
      additional_staff_count = 0,
      participants = [],
      created_by = 'system'
    } = programData;
    
    // For one-off programs, set end_date = start_date
    const effectiveEndDate = repeat_pattern === 'none' ? start_date : end_date;
    
    // For one-off programs, ensure days_of_week includes the day of the start_date
    let effectiveDaysOfWeek = days_of_week;
    if (repeat_pattern === 'none' && (!days_of_week || days_of_week.length === 0)) {
      const startDateObj = new Date(start_date);
      effectiveDaysOfWeek = [startDateObj.getDay()];
    }
    
    // Insert program record
    const programResult = await client.query(
      `INSERT INTO programs (
        name, program_type, start_date, end_date, repeat_pattern,
        days_of_week, venue_id, start_time, end_time, time_slots,
        notes, staff_assignment_mode, additional_staff_count, 
        recurring, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        name,
        program_type,
        start_date,
        effectiveEndDate,
        repeat_pattern,
        JSON.stringify(effectiveDaysOfWeek),
        venue_id,
        start_time,
        end_time,
        JSON.stringify(time_slots),
        notes,
        staff_assignment_mode,
        additional_staff_count,
        repeat_pattern !== 'none', // recurring = true for any pattern except 'none'
        created_by
      ]
    );
    
    const programId = programResult.rows[0].id;
    
    // Process participants and their billing codes
    if (participants && participants.length > 0) {
      await processBillingCodes(client, programId, participants, start_date, effectiveEndDate);
    }
    
    // Get current loom window size
    const settingsResult = await client.query(
      'SELECT value FROM settings WHERE key = $1',
      ['loom_window_weeks']
    );
    
    const windowWeeks = settingsResult.rows.length > 0 
      ? parseInt(settingsResult.rows[0].value, 10) 
      : 8; // Default to 8 weeks
    
    // Calculate window end date
    const today = getTodaySydney();
    const windowEndDate = addWeeks(today, windowWeeks);
    
    // Generate instances for the program within the loom window
    await generateInstances(client, programId, today, windowEndDate);
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Program created: ${programId} (${name})`);
    
    return {
      id: programId,
      name,
      program_type,
      start_date,
      end_date: effectiveEndDate,
      repeat_pattern,
      days_of_week: effectiveDaysOfWeek
    };
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Error creating program: ${error.message}`, { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update an existing program
 * 
 * @param {String} programId - Program ID
 * @param {Object} programData - Updated program data
 * @returns {Object} - Updated program
 */
async function updateProgram(programId, programData) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Get current program data
    const currentProgram = await client.query(
      'SELECT * FROM programs WHERE id = $1',
      [programId]
    );
    
    if (currentProgram.rows.length === 0) {
      throw new Error(`Program not found: ${programId}`);
    }
    
    const current = currentProgram.rows[0];
    
    // Extract program data with defaults from current values
    const {
      name = current.name,
      program_type = current.program_type,
      start_date = current.start_date,
      end_date = current.end_date,
      repeat_pattern = current.repeat_pattern,
      days_of_week = current.days_of_week,
      venue_id = current.venue_id,
      start_time = current.start_time,
      end_time = current.end_time,
      time_slots = current.time_slots,
      notes = current.notes,
      staff_assignment_mode = current.staff_assignment_mode,
      additional_staff_count = current.additional_staff_count,
      active = current.active,
      participants = []
    } = programData;
    
    // For one-off programs, set end_date = start_date
    const effectiveEndDate = repeat_pattern === 'none' ? start_date : end_date;
    
    // Update program record
    await client.query(
      `UPDATE programs SET
        name = $1, program_type = $2, start_date = $3, end_date = $4,
        repeat_pattern = $5, days_of_week = $6, venue_id = $7,
        start_time = $8, end_time = $9, time_slots = $10,
        notes = $11, staff_assignment_mode = $12, additional_staff_count = $13,
        recurring = $14, active = $15, updated_at = NOW()
      WHERE id = $16`,
      [
        name,
        program_type,
        start_date,
        effectiveEndDate,
        repeat_pattern,
        JSON.stringify(days_of_week),
        venue_id,
        start_time,
        end_time,
        JSON.stringify(time_slots),
        notes,
        staff_assignment_mode,
        additional_staff_count,
        repeat_pattern !== 'none', // recurring = true for any pattern except 'none'
        active,
        programId
      ]
    );
    
    // If participants provided, update them
    if (participants && participants.length > 0) {
      // First, deactivate existing billing codes
      await client.query(
        `UPDATE participant_billing_codes 
         SET is_active = false, end_date = CURRENT_DATE
         WHERE program_id = $1 AND is_active = true`,
        [programId]
      );
      
      // Then process new billing codes
      await processBillingCodes(client, programId, participants, start_date, effectiveEndDate);
    }
    
    // Check if we need to regenerate instances
    const needsRegeneration = 
      start_date !== current.start_date ||
      JSON.stringify(end_date) !== JSON.stringify(current.end_date) ||
      repeat_pattern !== current.repeat_pattern ||
      JSON.stringify(days_of_week) !== JSON.stringify(current.days_of_week);
    
    if (needsRegeneration) {
      // Delete future instances
      const today = getTodaySydney();
      const todayFormatted = formatDateForDb(today);
      
      // Delete future schedule entries
      await client.query(
        `DELETE FROM schedule 
         WHERE program_id = $1 AND scheduled_date >= $2`,
        [programId, todayFormatted]
      );
      
      // Delete future loom instances
      await client.query(
        `DELETE FROM tgl_loom_instances 
         WHERE program_id = $1 AND date >= $2`,
        [programId, todayFormatted]
      );
      
      // Get current loom window size
      const settingsResult = await client.query(
        'SELECT value FROM settings WHERE key = $1',
        ['loom_window_weeks']
      );
      
      const windowWeeks = settingsResult.rows.length > 0 
        ? parseInt(settingsResult.rows[0].value, 10) 
        : 8; // Default to 8 weeks
      
      // Calculate window end date
      const windowEndDate = addWeeks(today, windowWeeks);
      
      // Regenerate instances
      await generateInstances(client, programId, today, windowEndDate);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Program updated: ${programId} (${name})`);
    
    return {
      id: programId,
      name,
      program_type,
      start_date,
      end_date: effectiveEndDate,
      repeat_pattern,
      days_of_week
    };
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Error updating program: ${error.message}`, { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a program by ID
 * 
 * @param {String} programId - Program ID
 * @returns {Object} - Program data with participants and time slots
 */
async function getProgramById(programId) {
  try {
    // Get program data
    const programResult = await pool.query(
      `SELECT p.*, v.name as venue_name
       FROM programs p
       LEFT JOIN venues v ON p.venue_id = v.id
       WHERE p.id = $1`,
      [programId]
    );
    
    if (programResult.rows.length === 0) {
      return null;
    }
    
    const program = programResult.rows[0];
    
    // Get participants
    const participantsResult = await pool.query(
      `SELECT pp.*, p.first_name, p.last_name
       FROM program_participants pp
       JOIN participants p ON pp.participant_id = p.id
       WHERE pp.program_id = $1 AND pp.status = 'active'`,
      [programId]
    );
    
    // Get billing codes
    const billingResult = await pool.query(
      `SELECT pbc.*, bc.code, bc.description, bc.rate
       FROM participant_billing_codes pbc
       LEFT JOIN billing_codes bc ON pbc.billing_code = bc.code
       WHERE pbc.program_id = $1 AND pbc.is_active = true`,
      [programId]
    );
    
    // Group billing codes by participant
    const participantBilling = {};
    
    for (const billing of billingResult.rows) {
      if (!participantBilling[billing.participant_id]) {
        participantBilling[billing.participant_id] = [];
      }
      
      participantBilling[billing.participant_id].push({
        id: billing.id,
        code: billing.billing_code,
        description: billing.description,
        hours: billing.hours,
        rate: billing.rate
      });
    }
    
    // Build participants with billing
    const participants = participantsResult.rows.map(p => ({
      id: p.participant_id,
      name: `${p.first_name} ${p.last_name}`,
      enrollment_date: p.start_date,
      end_date: p.end_date,
      billing: {
        codes: participantBilling[p.participant_id] || []
      }
    }));
    
    // Return complete program data
    return {
      ...program,
      participants,
      days_of_week: program.days_of_week || [],
      time_slots: program.time_slots || []
    };
  } catch (error) {
    logger.error(`Error getting program ${programId}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Get all programs with optional filtering
 * 
 * @param {Object} filters - Optional filters (active, windowStart, windowEnd)
 * @returns {Array} - List of programs
 */
async function getPrograms(filters = {}) {
  try {
    const {
      active = true,
      windowStart,
      windowEnd,
      venue_id
    } = filters;
    
    let query = `
      SELECT p.*, v.name as venue_name
      FROM programs p
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Add active filter
    if (active !== null) {
      query += ` AND p.active = $${paramIndex}`;
      params.push(active);
      paramIndex++;
    }
    
    // Add venue filter
    if (venue_id) {
      query += ` AND p.venue_id = $${paramIndex}`;
      params.push(venue_id);
      paramIndex++;
    }
    
    // Add date window filter
    if (windowStart && windowEnd) {
      query += `
        AND (
          -- One-off programs that fall within the window
          (p.repeat_pattern = 'none' AND p.start_date >= $${paramIndex} AND p.start_date <= $${paramIndex + 1})
          OR
          -- Recurring programs that overlap with the window
          (
            p.repeat_pattern != 'none'
            AND p.start_date <= $${paramIndex + 1}
            AND (p.end_date IS NULL OR p.end_date >= $${paramIndex})
          )
        )
      `;
      params.push(windowStart, windowEnd);
      paramIndex += 2;
    }
    
    // Order by name
    query += ` ORDER BY p.name`;
    
    // Execute query
    const result = await pool.query(query, params);
    
    // Count participants for each program
    const programs = [];
    
    for (const program of result.rows) {
      // Get participant count
      const countResult = await pool.query(
        `SELECT COUNT(*) as participant_count
         FROM program_participants
         WHERE program_id = $1 AND status = 'active'`,
        [program.id]
      );
      
      const participantCount = parseInt(countResult.rows[0].participant_count, 10);
      
      programs.push({
        ...program,
        days_of_week: program.days_of_week || [],
        time_slots: program.time_slots || [],
        participant_count: participantCount
      });
    }
    
    return programs;
  } catch (error) {
    logger.error(`Error getting programs: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Delete a program
 * 
 * @param {String} programId - Program ID
 * @returns {Boolean} - Success status
 */
async function deleteProgram(programId) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Check if program exists
    const programResult = await client.query(
      'SELECT id FROM programs WHERE id = $1',
      [programId]
    );
    
    if (programResult.rows.length === 0) {
      throw new Error(`Program not found: ${programId}`);
    }
    
    // Delete related records
    // This relies on ON DELETE CASCADE for related tables
    
    // Delete program record
    await client.query(
      'DELETE FROM programs WHERE id = $1',
      [programId]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info(`Program deleted: ${programId}`);
    
    return true;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Error deleting program: ${error.message}`, { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate instances for a program within a date range
 * 
 * @param {Object} client - Database client (transaction)
 * @param {String} programId - Program ID
 * @param {Date} windowStart - Start date
 * @param {Date} windowEnd - End date
 * @returns {Number} - Count of instances created
 */
async function generateInstances(client, programId, windowStart, windowEnd) {
  try {
    // Get program data
    const programResult = await client.query(
      'SELECT * FROM programs WHERE id = $1',
      [programId]
    );
    
    if (programResult.rows.length === 0) {
      throw new Error(`Program not found: ${programId}`);
    }
    
    const program = programResult.rows[0];
    
    // Format dates for comparison
    const windowStartFormatted = formatDateForDb(windowStart);
    const windowEndFormatted = formatDateForDb(windowEnd);
    
    // Determine effective date range
    const effectiveStart = new Date(Math.max(
      new Date(program.start_date),
      new Date(windowStartFormatted)
    ));
    
    const effectiveEnd = program.end_date 
      ? new Date(Math.min(
          new Date(program.end_date),
          new Date(windowEndFormatted)
        ))
      : new Date(windowEndFormatted);
    
    // Parse days of week
    const daysOfWeek = Array.isArray(program.days_of_week) 
      ? program.days_of_week 
      : JSON.parse(program.days_of_week || '[]');
    
    if (daysOfWeek.length === 0) {
      logger.warn(`Program ${programId} has no days of week defined, skipping instance generation`);
      return 0;
    }
    
    // Generate instances
    let instancesCreated = 0;
    let currentDate = new Date(effectiveStart);
    
    // For one-off programs, just create a single instance
    if (program.repeat_pattern === 'none') {
      const onDate = new Date(program.start_date);
      
      // Only create if within window
      if (onDate >= effectiveStart && onDate <= effectiveEnd) {
        await createInstance(client, program, onDate);
        instancesCreated++;
      }
      
      return instancesCreated;
    }
    
    // For recurring programs, iterate through the date range
    while (currentDate <= effectiveEnd) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if program runs on this day
      if (daysOfWeek.includes(dayOfWeek)) {
        // For fortnightly programs, check if this is the right week
        if (program.repeat_pattern === 'fortnightly') {
          // Calculate weeks since program start
          const programStart = new Date(program.start_date);
          const weeksSinceStart = Math.floor(
            (currentDate - programStart) / (7 * 24 * 60 * 60 * 1000)
          );
          
          // Only create instance on even weeks
          if (weeksSinceStart % 2 !== 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        // For monthly programs, check if this is the same day of month as start date
        if (program.repeat_pattern === 'monthly') {
          const programStart = new Date(program.start_date);
          
          // Only create instance on same day of month
          if (currentDate.getDate() !== programStart.getDate()) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        // Create instance for this date
        await createInstance(client, program, currentDate);
        instancesCreated++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    logger.info(`Generated ${instancesCreated} instances for program ${programId}`);
    
    return instancesCreated;
  } catch (error) {
    logger.error(`Error generating instances: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Create a single program instance for a specific date
 * 
 * @param {Object} client - Database client (transaction)
 * @param {Object} program - Program data
 * @param {Date} date - Instance date
 * @returns {String} - Instance ID
 */
async function createInstance(client, program, date) {
  try {
    const formattedDate = formatDateForDb(date);
    
    // Check if instance already exists
    const existingResult = await client.query(
      `SELECT id FROM schedule 
       WHERE program_id = $1 AND scheduled_date = $2`,
      [program.id, formattedDate]
    );
    
    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id;
    }
    
    // Create schedule entry
    const scheduleResult = await client.query(
      `INSERT INTO schedule 
       (program_id, scheduled_date, start_time, end_time, venue_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        program.id,
        formattedDate,
        program.start_time,
        program.end_time,
        program.venue_id,
        program.notes
      ]
    );
    
    const scheduleId = scheduleResult.rows[0].id;
    
    // Get participants for this program
    const participantsResult = await client.query(
      `SELECT pp.participant_id
       FROM program_participants pp
       WHERE pp.program_id = $1 
       AND pp.status = 'active'
       AND pp.start_date <= $2
       AND (pp.end_date IS NULL OR pp.end_date >= $2)`,
      [program.id, formattedDate]
    );
    
    const participants = participantsResult.rows.map(p => p.participant_id);
    const participantCount = participants.length;
    
    // Create loom instance
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
        participantCount,
        'GENERATED'
      ]
    );
    
    const instanceId = instanceResult.rows[0].id;
    
    // Create participant allocations
    for (const participantId of participants) {
      // Get billing codes for this participant
      const billingResult = await client.query(
        `SELECT billing_code, hours
         FROM participant_billing_codes
         WHERE program_id = $1 AND participant_id = $2 AND is_active = true`,
        [program.id, participantId]
      );
      
      // Use first billing code for allocation
      const billingCode = billingResult.rows.length > 0 ? billingResult.rows[0].billing_code : null;
      const hours = billingResult.rows.length > 0 ? billingResult.rows[0].hours : 0;
      
      await client.query(
        `INSERT INTO tgl_loom_participant_allocations
         (instance_id, participant_id, billing_code_id, hours, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          instanceId,
          participantId,
          billingCode,
          hours,
          'CONFIRMED'
        ]
      );
    }
    
    // Create time slot cards
    const timeSlots = Array.isArray(program.time_slots)
      ? program.time_slots
      : JSON.parse(program.time_slots || '[]');
    
    for (const slot of timeSlots) {
      await client.query(
        `INSERT INTO tgl_loom_time_slots
         (instance_id, start_time, end_time, label, card_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          instanceId,
          slot.start_time,
          slot.end_time,
          slot.label,
          determineCardType(slot.label)
        ]
      );
    }
    
    // Create staff shifts based on participant count
    const staffShifts = calculateStaffShifts(
      participantCount,
      program.additional_staff_count || 0
    );
    
    for (const shift of staffShifts) {
      await client.query(
        `INSERT INTO tgl_loom_staff_shifts
         (instance_id, staff_id, role, start_time, end_time, status, manually_assigned)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          instanceId,
          null, // staff_id is null initially, will be assigned later
          shift.role,
          program.start_time,
          program.end_time,
          'PLANNED',
          program.staff_assignment_mode === 'manual'
        ]
      );
    }
    
    // If any time slot is a bus run, create vehicle runs
    const busSlots = timeSlots.filter(slot => 
      slot.label.toLowerCase().includes('pick') || 
      slot.label.toLowerCase().includes('drop')
    );
    
    if (busSlots.length > 0) {
      for (const busSlot of busSlots) {
        await client.query(
          `INSERT INTO tgl_loom_vehicle_runs
           (instance_id, vehicle_id, start_time, end_time, passenger_count, route_data)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            instanceId,
            null, // vehicle_id is null initially, will be assigned later
            busSlot.start_time,
            busSlot.end_time,
            participantCount,
            JSON.stringify({
              type: busSlot.label.toLowerCase().includes('pick') ? 'PICKUP' : 'DROPOFF',
              stops: []
            })
          ]
        );
      }
    }
    
    return instanceId;
  } catch (error) {
    logger.error(`Error creating instance: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Process participant billing codes for a program
 * 
 * @param {Object} client - Database client (transaction)
 * @param {String} programId - Program ID
 * @param {Array} participants - Participants with billing codes
 * @param {String} startDate - Program start date
 * @param {String} endDate - Program end date
 */
async function processBillingCodes(client, programId, participants, startDate, endDate) {
  try {
    for (const participant of participants) {
      // Check if participant exists
      const participantResult = await client.query(
        'SELECT id FROM participants WHERE id = $1',
        [participant.id]
      );
      
      if (participantResult.rows.length === 0) {
        logger.warn(`Participant not found: ${participant.id}, skipping`);
        continue;
      }
      
      // Add to program_participants if not already there
      const existingResult = await client.query(
        `SELECT id FROM program_participants 
         WHERE program_id = $1 AND participant_id = $2`,
        [programId, participant.id]
      );
      
      if (existingResult.rows.length === 0) {
        await client.query(
          `INSERT INTO program_participants
           (program_id, participant_id, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [programId, participant.id, startDate, endDate, 'active']
        );
      } else {
        // Update existing enrollment
        await client.query(
          `UPDATE program_participants
           SET start_date = $1, end_date = $2, status = 'active'
           WHERE program_id = $3 AND participant_id = $4`,
          [startDate, endDate, programId, participant.id]
        );
      }
      
      // Process billing codes
      if (participant.billing && participant.billing.codes) {
        for (const code of participant.billing.codes) {
          // Validate billing code exists
          const codeResult = await client.query(
            'SELECT code FROM billing_codes WHERE code = $1',
            [code.code]
          );
          
          if (codeResult.rows.length === 0) {
            logger.warn(`Billing code not found: ${code.code}, skipping`);
            continue;
          }
          
          // Add billing code
          await client.query(
            `INSERT INTO participant_billing_codes
             (program_id, participant_id, billing_code, hours, start_date, end_date, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              programId,
              participant.id,
              code.code,
              parseFloat(code.hours) || 0,
              startDate,
              endDate,
              true
            ]
          );
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing billing codes: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Calculate staff shifts needed based on participant count
 * 
 * @param {Number} participantCount - Number of participants
 * @param {Number} additionalStaff - Additional staff count
 * @returns {Array} - Array of staff shift objects
 */
function calculateStaffShifts(participantCount, additionalStaff = 0) {
  const shifts = [];
  
  // Always need one lead
  shifts.push({ role: 'LEAD' });
  
  // Support staff based on 1:4 ratio
  // 1-4 participants: 0 support
  // 5-8 participants: 1 support
  // 9-12 participants: 2 support
  // etc.
  const supportCount = Math.ceil(participantCount / 4) - 1;
  
  for (let i = 0; i < Math.max(0, supportCount); i++) {
    shifts.push({ role: 'SUPPORT' });
  }
  
  // Add additional staff
  for (let i = 0; i < additionalStaff; i++) {
    shifts.push({ role: 'SUPPORT' });
  }
  
  return shifts;
}

/**
 * Determine card type based on time slot label
 * 
 * @param {String} label - Time slot label
 * @returns {String} - Card type
 */
function determineCardType(label) {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes('pick') || lowerLabel.includes('pickup')) {
    return 'PICKUP';
  }
  
  if (lowerLabel.includes('drop') || lowerLabel.includes('dropoff')) {
    return 'DROPOFF';
  }
  
  return 'ACTIVITY';
}

/**
 * Get all dashboard cards for a specific date
 * 
 * @param {String} date - Date string (YYYY-MM-DD)
 * @returns {Array} - Array of card objects
 */
async function getCardsByDate(date) {
  try {
    // Format date
    const formattedDate = formatDateForDb(new Date(date));
    
    // Get all instances for this date
    const instancesResult = await pool.query(
      `SELECT i.id, i.program_id, i.start_time, i.end_time, i.venue_id,
              i.status, i.capacity, p.name as program_name, v.name as venue_name
       FROM tgl_loom_instances i
       JOIN programs p ON i.program_id = p.id
       LEFT JOIN venues v ON i.venue_id = v.id
       WHERE i.date = $1
       ORDER BY i.start_time`,
      [formattedDate]
    );
    
    const cards = [];
    
    for (const instance of instancesResult.rows) {
      // Get time slots
      const timeSlotsResult = await pool.query(
        `SELECT * FROM tgl_loom_time_slots
         WHERE instance_id = $1
         ORDER BY start_time`,
        [instance.id]
      );
      
      // If no time slots, create a default card
      if (timeSlotsResult.rows.length === 0) {
        cards.push({
          id: uuidv4(),
          type: 'PROGRAM',
          instance_id: instance.id,
          program_id: instance.program_id,
          program_name: instance.program_name,
          venue_name: instance.venue_name,
          start_time: instance.start_time,
          end_time: instance.end_time,
          status: instance.status,
          participant_count: instance.capacity || 0
        });
      } else {
        // Create a card for each time slot
        for (const slot of timeSlotsResult.rows) {
          cards.push({
            id: slot.id,
            type: slot.card_type,
            instance_id: instance.id,
            program_id: instance.program_id,
            program_name: instance.program_name,
            venue_name: instance.venue_name,
            start_time: slot.start_time,
            end_time: slot.end_time,
            label: slot.label,
            status: instance.status,
            participant_count: instance.capacity || 0
          });
        }
      }
    }
    
    // Sort cards by start time
    cards.sort((a, b) => {
      if (a.start_time < b.start_time) return -1;
      if (a.start_time > b.start_time) return 1;
      return 0;
    });
    
    return cards;
  } catch (error) {
    logger.error(`Error getting cards for date ${date}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Force regenerate instances for a program
 * 
 * @param {String} programId - Program ID
 * @param {String} windowStart - Start date (YYYY-MM-DD)
 * @param {String} windowEnd - End date (YYYY-MM-DD)
 * @returns {Number} - Count of instances created
 */
async function regenerateInstances(programId, windowStart, windowEnd) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Delete existing instances in the date range
    await client.query(
      `DELETE FROM schedule 
       WHERE program_id = $1 
       AND scheduled_date >= $2 
       AND scheduled_date <= $3`,
      [programId, windowStart, windowEnd]
    );
    
    await client.query(
      `DELETE FROM tgl_loom_instances 
       WHERE program_id = $1 
       AND date >= $2 
       AND date <= $3`,
      [programId, windowStart, windowEnd]
    );
    
    // Generate new instances
    const instanceCount = await generateInstances(
      client,
      programId,
      new Date(windowStart),
      new Date(windowEnd)
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    return instanceCount;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error(`Error regenerating instances: ${error.message}`, { error });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createProgram,
  updateProgram,
  getProgramById,
  getPrograms,
  deleteProgram,
  generateInstances,
  processBillingCodes,
  calculateStaffShifts,
  getCardsByDate,
  regenerateInstances
};
