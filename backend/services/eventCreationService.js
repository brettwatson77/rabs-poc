/**
 * eventCreationService.js
 * 
 * Implements the Workflow #1 approach for event creation:
 * 1. Create event (program details, time, location)
 * 2. Add participants
 * 3. Auto-allocate staff, vehicles, and routes
 * 
 * This service bridges the Rules and Loom layers of the TGL architecture,
 * creating both the recurring rule pattern and the concrete loom instances.
 */

const { pool } = require('../database');
const logger = require('../utils/logger');
const eventCardService = require('./eventCardService');
const dynamicResourceService = require('./dynamicResourceService');
const routeOptimizationService = require('./routeOptimizationService');

/**
 * Creates a new program rule with time slots
 * @param {Object} programData - Program details
 * @returns {Promise<Object>} Created program rule
 */
async function createProgramRule(programData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create the program rule in rules_programs
    const programQuery = `
      INSERT INTO rules_programs (
        name, description, program_type, default_location_id, 
        default_duration_minutes, default_capacity, 
        recurrence_pattern, time_slots, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `;
    
    // Generate appropriate time slots based on program type
    const timeSlots = generateTimeSlotsForProgramType(
      programData.program_type, 
      programData.default_duration_minutes
    );
    
    const programValues = [
      programData.name,
      programData.description || '',
      programData.program_type,
      programData.default_location_id,
      programData.default_duration_minutes,
      programData.default_capacity || 8,
      programData.recurrence_pattern || '{}',
      JSON.stringify(timeSlots)
    ];
    
    const programResult = await client.query(programQuery, programValues);
    const programId = programResult.rows[0].id;
    
    // Create rate line items if provided
    if (programData.rate_items && programData.rate_items.length > 0) {
      const rateQuery = `
        INSERT INTO rules_rate_items (
          program_id, item_name, unit_price, ndis_code, 
          gst_code, billing_unit, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;
      
      for (const rate of programData.rate_items) {
        await client.query(rateQuery, [
          programId,
          rate.item_name,
          rate.unit_price,
          rate.ndis_code || null,
          rate.gst_code || 'GST_FREE',
          rate.billing_unit || 'EACH',
        ]);
      }
    }
    
    // Create staff ratio rules
    const ratioQuery = `
      INSERT INTO rules_staff_ratios (
        program_id, min_participants, max_participants, 
        required_staff, required_qualifications, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `;
    
    // Default 1:4 ratio with breakpoints
    await client.query(ratioQuery, [programId, 1, 4, 1, '[]']);
    await client.query(ratioQuery, [programId, 5, 8, 2, '[]']);
    await client.query(ratioQuery, [programId, 9, 12, 3, '[]']);
    await client.query(ratioQuery, [programId, 13, 16, 4, '[]']);
    
    await client.query('COMMIT');
    
    // Return the complete program rule
    return {
      id: programId,
      ...programData,
      time_slots: timeSlots
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating program rule:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generates appropriate time slots based on program type
 * @param {string} programType - Type of program
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Array} Array of time slot objects
 */
function generateTimeSlotsForProgramType(programType, durationMinutes) {
  const slots = [];
  
  switch (programType.toUpperCase()) {
    case 'CENTRE_BASED':
      // Centre-based programs have pickup → activity → dropoff
      slots.push({
        slot_type: 'PICKUP',
        duration_minutes: 60,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'ACTIVITY',
        duration_minutes: durationMinutes || 180, // 3 hours default
        requires_vehicle: false,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'DROPOFF',
        duration_minutes: 60,
        requires_vehicle: true,
        requires_staff: true
      });
      break;
      
    case 'MULTI_ACTIVITY':
      // Multi-activity has pickup → activityA → activityB → dropoff
      slots.push({
        slot_type: 'PICKUP',
        duration_minutes: 60,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'ACTIVITY_A',
        duration_minutes: Math.floor(durationMinutes / 2) || 90,
        requires_vehicle: false,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'ACTIVITY_B',
        duration_minutes: Math.floor(durationMinutes / 2) || 90,
        requires_vehicle: false,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'DROPOFF',
        duration_minutes: 60,
        requires_vehicle: true,
        requires_staff: true
      });
      break;
      
    case 'OUTING':
      // Outings have pickup → travel → activity → travel → dropoff
      slots.push({
        slot_type: 'PICKUP',
        duration_minutes: 45,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'TRAVEL_TO',
        duration_minutes: 30,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'ACTIVITY',
        duration_minutes: durationMinutes || 120,
        requires_vehicle: false,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'TRAVEL_FROM',
        duration_minutes: 30,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'DROPOFF',
        duration_minutes: 45,
        requires_vehicle: true,
        requires_staff: true
      });
      break;
      
    case 'DIRECT_TRANSPORT':
      // Direct transport just has pickup → dropoff
      slots.push({
        slot_type: 'PICKUP',
        duration_minutes: 30,
        requires_vehicle: true,
        requires_staff: true
      });
      
      slots.push({
        slot_type: 'DROPOFF',
        duration_minutes: 30,
        requires_vehicle: true,
        requires_staff: true
      });
      break;
      
    default:
      // Generic single activity
      slots.push({
        slot_type: 'ACTIVITY',
        duration_minutes: durationMinutes || 120,
        requires_vehicle: false,
        requires_staff: true
      });
  }
  
  return slots;
}

/**
 * Creates a concrete loom instance from a program rule
 * @param {Object} instanceData - Instance details
 * @returns {Promise<Object>} Created loom instance
 */
async function createLoomInstance(instanceData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get the program rule
    const programQuery = `
      SELECT * FROM rules_programs WHERE id = $1
    `;
    
    const programResult = await client.query(programQuery, [instanceData.program_id]);
    if (programResult.rows.length === 0) {
      throw new Error(`Program rule ${instanceData.program_id} not found`);
    }
    
    const programRule = programResult.rows[0];
    
    // Create the loom instance
    const instanceQuery = `
      INSERT INTO loom_instances (
        program_id, date, start_time, end_time, location_id,
        time_slots, capacity, notes, created_at,
        needs_card_regeneration, override_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
      RETURNING id
    `;
    
    // Use rule time slots or override if provided
    const timeSlots = instanceData.time_slots || programRule.time_slots;
    
    const instanceValues = [
      instanceData.program_id,
      instanceData.date,
      instanceData.start_time || '09:00:00',
      instanceData.end_time || '15:00:00',
      instanceData.location_id || programRule.default_location_id,
      timeSlots,
      instanceData.capacity || programRule.default_capacity,
      instanceData.notes || '',
      true, // needs_card_regeneration
      'NONE' // override_status
    ];
    
    const instanceResult = await client.query(instanceQuery, instanceValues);
    const instanceId = instanceResult.rows[0].id;
    
    await client.query('COMMIT');
    
    // Return the created instance
    return {
      id: instanceId,
      program_id: instanceData.program_id,
      date: instanceData.date,
      start_time: instanceData.start_time || '09:00:00',
      end_time: instanceData.end_time || '15:00:00',
      location_id: instanceData.location_id || programRule.default_location_id,
      time_slots: timeSlots,
      capacity: instanceData.capacity || programRule.default_capacity,
      notes: instanceData.notes || '',
      needs_card_regeneration: true,
      override_status: 'NONE'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating loom instance:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Adds participants to a loom instance
 * @param {number} instanceId - Loom instance ID
 * @param {Array<number>} participantIds - Array of participant IDs
 * @returns {Promise<Array>} Added participant records
 */
async function addParticipantsToInstance(instanceId, participantIds) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if instance exists
    const instanceQuery = `
      SELECT * FROM loom_instances WHERE id = $1
    `;
    
    const instanceResult = await client.query(instanceQuery, [instanceId]);
    if (instanceResult.rows.length === 0) {
      throw new Error(`Loom instance ${instanceId} not found`);
    }
    
    const instance = instanceResult.rows[0];
    
    // Check capacity
    const currentCountQuery = `
      SELECT COUNT(*) as count FROM loom_participant_attendance
      WHERE instance_id = $1
    `;
    
    const countResult = await client.query(currentCountQuery, [instanceId]);
    const currentCount = parseInt(countResult.rows[0].count);
    
    if (currentCount + participantIds.length > instance.capacity) {
      throw new Error(`Adding ${participantIds.length} participants would exceed capacity of ${instance.capacity}`);
    }
    
    // Get participant details including supervision multipliers
    const participantsQuery = `
      SELECT id, first_name, last_name, supervision_multiplier, special_needs
      FROM participants
      WHERE id = ANY($1)
    `;
    
    const participantsResult = await client.query(participantsQuery, [participantIds]);
    const participants = participantsResult.rows;
    
    // Add participants to instance
    const attendanceQuery = `
      INSERT INTO loom_participant_attendance (
        instance_id, participant_id, status, notes, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (instance_id, participant_id) 
      DO UPDATE SET status = $3, notes = $4, updated_at = NOW()
      RETURNING *
    `;
    
    const addedRecords = [];
    
    for (const participant of participants) {
      const result = await client.query(attendanceQuery, [
        instanceId,
        participant.id,
        'CONFIRMED',
        ''
      ]);
      
      addedRecords.push({
        ...result.rows[0],
        participant_name: `${participant.first_name} ${participant.last_name}`,
        supervision_multiplier: participant.supervision_multiplier || 1.0,
        special_needs: participant.special_needs
      });
    }
    
    // Mark instance for card regeneration
    await client.query(`
      UPDATE loom_instances
      SET needs_card_regeneration = true
      WHERE id = $1
    `, [instanceId]);
    
    await client.query('COMMIT');
    
    // Return the added records
    return addedRecords;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error adding participants to instance:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Auto-allocates staff and vehicles based on participants
 * Implements the core of Workflow #1
 * @param {number} instanceId - Loom instance ID
 * @returns {Promise<Object>} Allocation results
 */
async function autoAllocateResources(instanceId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get instance details
    const instanceQuery = `
      SELECT li.*, rp.name as program_name, rp.program_type
      FROM loom_instances li
      JOIN rules_programs rp ON li.program_id = rp.id
      WHERE li.id = $1
    `;
    
    const instanceResult = await client.query(instanceQuery, [instanceId]);
    if (instanceResult.rows.length === 0) {
      throw new Error(`Loom instance ${instanceId} not found`);
    }
    
    const instance = instanceResult.rows[0];
    
    // Get participants with supervision multipliers
    const participantsQuery = `
      SELECT lpa.*, p.first_name, p.last_name, 
             p.supervision_multiplier, p.special_needs,
             p.latitude, p.longitude
      FROM loom_participant_attendance lpa
      JOIN participants p ON lpa.participant_id = p.id
      WHERE lpa.instance_id = $1
    `;
    
    const participantsResult = await client.query(participantsQuery, [instanceId]);
    const participants = participantsResult.rows;
    
    // Calculate virtual participant count using supervision multipliers
    const actualParticipantCount = participants.length;
    const virtualParticipantCount = participants.reduce(
      (sum, p) => sum + (parseFloat(p.supervision_multiplier) || 1.0),
      0
    );
    
    // Get staff ratio rules
    const ratioQuery = `
      SELECT * FROM rules_staff_ratios
      WHERE program_id = $1
      ORDER BY min_participants
    `;
    
    const ratioResult = await client.query(ratioQuery, [instance.program_id]);
    const ratioRules = ratioResult.rows;
    
    // Determine required staff count based on virtual count
    let requiredStaffCount = 1; // Default minimum
    
    for (const rule of ratioRules) {
      if (virtualParticipantCount >= rule.min_participants && 
          virtualParticipantCount <= rule.max_participants) {
        requiredStaffCount = rule.required_staff;
        break;
      } else if (virtualParticipantCount > rule.max_participants && 
                rule.max_participants === ratioRules[ratioRules.length - 1].max_participants) {
        // If beyond the last rule, calculate based on the ratio of the last rule
        const ratio = rule.max_participants / rule.required_staff;
        requiredStaffCount = Math.ceil(virtualParticipantCount / ratio);
        break;
      }
    }
    
    // Find available staff
    const staffQuery = `
      SELECT s.*, sa.day_of_week, sa.start_time, sa.end_time
      FROM staff s
      JOIN staff_availability sa ON s.id = sa.staff_id
      WHERE sa.day_of_week = EXTRACT(DOW FROM $1::date)
      AND sa.start_time <= $2::time
      AND sa.end_time >= $3::time
      AND s.id NOT IN (
        SELECT staff_id FROM loom_staff_assignments
        JOIN loom_instances ON loom_staff_assignments.instance_id = loom_instances.id
        WHERE loom_instances.date = $1::date
        AND (
          (loom_instances.start_time <= $2::time AND loom_instances.end_time >= $2::time)
          OR
          (loom_instances.start_time <= $3::time AND loom_instances.end_time >= $3::time)
          OR
          (loom_instances.start_time >= $2::time AND loom_instances.end_time <= $3::time)
        )
      )
      ORDER BY s.contracted_hours - (
        SELECT COALESCE(SUM(
          EXTRACT(EPOCH FROM (lsa.end_time - lsa.start_time)) / 3600
        ), 0)
        FROM loom_staff_assignments lsa
        JOIN loom_instances li ON lsa.instance_id = li.id
        WHERE lsa.staff_id = s.id
        AND li.date >= date_trunc('week', $1::date)
        AND li.date < date_trunc('week', $1::date) + interval '14 days'
      ) DESC
      LIMIT $4
    `;
    
    const staffResult = await client.query(staffQuery, [
      instance.date,
      instance.start_time,
      instance.end_time,
      requiredStaffCount
    ]);
    
    const availableStaff = staffResult.rows;
    
    if (availableStaff.length < requiredStaffCount) {
      logger.warn(`Only ${availableStaff.length} staff available for instance ${instanceId}, needed ${requiredStaffCount}`);
    }
    
    // Clear existing staff assignments
    await client.query(`
      DELETE FROM loom_staff_assignments
      WHERE instance_id = $1
    `, [instanceId]);
    
    // Assign staff
    const staffAssignments = [];
    const timeSlots = JSON.parse(instance.time_slots);
    
    for (let i = 0; i < availableStaff.length; i++) {
      const staff = availableStaff[i];
      const isLead = i === 0; // First staff is lead
      
      for (const slot of timeSlots) {
        // Skip slots that don't require staff
        if (!slot.requires_staff) continue;
        
        // Calculate slot times
        const slotStartTime = calculateSlotTime(instance.start_time, slot, 'start', timeSlots);
        const slotEndTime = calculateSlotTime(instance.start_time, slot, 'end', timeSlots);
        
        const assignmentQuery = `
          INSERT INTO loom_staff_assignments (
            instance_id, staff_id, assignment_type, role,
            start_time, end_time, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING *
        `;
        
        const result = await client.query(assignmentQuery, [
          instanceId,
          staff.id,
          slot.slot_type,
          isLead ? 'LEAD' : 'SUPPORT',
          slotStartTime,
          slotEndTime,
          ''
        ]);
        
        staffAssignments.push({
          ...result.rows[0],
          staff_name: `${staff.first_name} ${staff.last_name}`
        });
      }
    }
    
    // Determine if vehicles are needed
    const needsVehicle = timeSlots.some(slot => slot.requires_vehicle);
    
    let vehicleAssignments = [];
    let routeOptimization = null;
    
    if (needsVehicle && participants.length > 0) {
      // Find available vehicles with enough capacity
      const vehicleQuery = `
        SELECT v.*
        FROM vehicles v
        WHERE v.seats >= $1
        AND v.id NOT IN (
          SELECT vehicle_id FROM loom_vehicle_assignments
          JOIN loom_instances ON loom_vehicle_assignments.instance_id = loom_instances.id
          WHERE loom_instances.date = $2::date
          AND (
            (loom_instances.start_time <= $3::time AND loom_instances.end_time >= $3::time)
            OR
            (loom_instances.start_time <= $4::time AND loom_instances.end_time >= $4::time)
            OR
            (loom_instances.start_time >= $3::time AND loom_instances.end_time <= $4::time)
          )
        )
        ORDER BY v.seats ASC
        LIMIT 1
      `;
      
      // Need seats for participants + staff for vehicle slots
      const requiredSeats = actualParticipantCount + 1; // +1 for driver minimum
      
      const vehicleResult = await client.query(vehicleQuery, [
        requiredSeats,
        instance.date,
        instance.start_time,
        instance.end_time
      ]);
      
      if (vehicleResult.rows.length > 0) {
        const vehicle = vehicleResult.rows[0];
        
        // Clear existing vehicle assignments
        await client.query(`
          DELETE FROM loom_vehicle_assignments
          WHERE instance_id = $1
        `, [instanceId]);
        
        // Assign vehicle
        const assignmentQuery = `
          INSERT INTO loom_vehicle_assignments (
            instance_id, vehicle_id, assignment_type, driver_staff_id,
            start_time, end_time, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING *
        `;
        
        // Find a staff member assigned to vehicle slots
        let driverStaffId = null;
        for (const assignment of staffAssignments) {
          const slot = timeSlots.find(s => s.slot_type === assignment.assignment_type);
          if (slot && slot.requires_vehicle) {
            driverStaffId = assignment.staff_id;
            break;
          }
        }
        
        const result = await client.query(assignmentQuery, [
          instanceId,
          vehicle.id,
          'PRIMARY',
          driverStaffId,
          instance.start_time,
          instance.end_time,
          ''
        ]);
        
        vehicleAssignments.push({
          ...result.rows[0],
          vehicle_registration: vehicle.registration,
          vehicle_capacity: vehicle.seats
        });
        
        // Optimize routes if we have participants with addresses
        if (participants.some(p => p.latitude && p.longitude)) {
          try {
            // Call route optimization service
            routeOptimization = await routeOptimizationService.optimizeRoutes({
              instanceId,
              vehicleId: vehicle.id,
              participants: participants.map(p => ({
                id: p.participant_id,
                name: `${p.first_name} ${p.last_name}`,
                latitude: p.latitude,
                longitude: p.longitude
              })),
              centerLatitude: 0, // TODO: Get from venue
              centerLongitude: 0
            });
            
            // Store route stops
            if (routeOptimization.stops) {
              // Clear existing stops
              await client.query(`
                DELETE FROM route_stops
                WHERE instance_id = $1
              `, [instanceId]);
              
              // Add new stops
              const stopQuery = `
                INSERT INTO route_stops (
                  instance_id, stop_number, participant_id,
                  latitude, longitude, estimated_time, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
              `;
              
              for (let i = 0; i < routeOptimization.stops.length; i++) {
                const stop = routeOptimization.stops[i];
                await client.query(stopQuery, [
                  instanceId,
                  i + 1,
                  stop.participant_id,
                  stop.latitude,
                  stop.longitude,
                  stop.estimated_time
                ]);
              }
            }
          } catch (routeError) {
            logger.error(`Route optimization failed for instance ${instanceId}:`, routeError);
            // Continue without route optimization
          }
        }
      } else {
        logger.warn(`No suitable vehicle available for instance ${instanceId}, needed ${requiredSeats} seats`);
      }
    }
    
    // Mark instance for card regeneration
    await client.query(`
      UPDATE loom_instances
      SET needs_card_regeneration = true
      WHERE id = $1
    `, [instanceId]);
    
    await client.query('COMMIT');
    
    // Generate cards
    try {
      await eventCardService.generateCardsForInstance(instanceId);
    } catch (cardError) {
      logger.error(`Card generation failed for instance ${instanceId}:`, cardError);
      // Continue without card generation
    }
    
    // Return the allocation results
    return {
      instance_id: instanceId,
      program_name: instance.program_name,
      date: instance.date,
      participants: {
        actual_count: actualParticipantCount,
        virtual_count: virtualParticipantCount,
        details: participants
      },
      staff: {
        required_count: requiredStaffCount,
        actual_count: availableStaff.length,
        assignments: staffAssignments
      },
      vehicles: {
        required: needsVehicle,
        assignments: vehicleAssignments
      },
      routes: routeOptimization,
      time_slots: timeSlots
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error auto-allocating resources:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper function to calculate slot start/end times
 * @param {string} baseTime - Base time for the instance
 * @param {Object} slot - Time slot object
 * @param {string} position - 'start' or 'end'
 * @param {Array} allSlots - All time slots
 * @returns {string} Calculated time
 */
function calculateSlotTime(baseTime, slot, position, allSlots) {
  // Parse base time
  const [hours, minutes] = baseTime.split(':').map(Number);
  const baseDate = new Date(2000, 0, 1, hours, minutes); // Dummy date
  
  if (position === 'start') {
    // For start time, find all slots that come before this one
    const slotIndex = allSlots.findIndex(s => s.slot_type === slot.slot_type);
    let offsetMinutes = 0;
    
    for (let i = 0; i < slotIndex; i++) {
      offsetMinutes += allSlots[i].duration_minutes;
    }
    
    const newTime = new Date(baseDate.getTime() + offsetMinutes * 60000);
    return `${newTime.getHours().toString().padStart(2, '0')}:${newTime.getMinutes().toString().padStart(2, '0')}`;
  } else {
    // For end time, add this slot's duration
    const slotIndex = allSlots.findIndex(s => s.slot_type === slot.slot_type);
    let offsetMinutes = 0;
    
    for (let i = 0; i <= slotIndex; i++) {
      offsetMinutes += allSlots[i].duration_minutes;
    }
    
    const newTime = new Date(baseDate.getTime() + offsetMinutes * 60000);
    return `${newTime.getHours().toString().padStart(2, '0')}:${newTime.getMinutes().toString().padStart(2, '0')}`;
  }
}

/**
 * Complete workflow for creating an event with participants and auto-allocation
 * @param {Object} eventData - Complete event data
 * @returns {Promise<Object>} Created event with allocations
 */
async function createEventWithParticipants(eventData) {
  try {
    // 1. Create program rule if it doesn't exist
    let programId = eventData.program_id;
    
    if (!programId && eventData.program) {
      const program = await createProgramRule(eventData.program);
      programId = program.id;
    }
    
    if (!programId) {
      throw new Error('Program ID or program details are required');
    }
    
    // 2. Create loom instance
    const instanceData = {
      program_id: programId,
      date: eventData.date,
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      location_id: eventData.location_id,
      capacity: eventData.capacity,
      notes: eventData.notes,
      time_slots: eventData.time_slots
    };
    
    const instance = await createLoomInstance(instanceData);
    
    // 3. Add participants if provided
    if (eventData.participant_ids && eventData.participant_ids.length > 0) {
      await addParticipantsToInstance(instance.id, eventData.participant_ids);
    }
    
    // 4. Auto-allocate resources
    const allocation = await autoAllocateResources(instance.id);
    
    return {
      instance,
      allocation
    };
  } catch (error) {
    logger.error('Error in createEventWithParticipants workflow:', error);
    throw error;
  }
}

module.exports = {
  createProgramRule,
  createLoomInstance,
  addParticipantsToInstance,
  autoAllocateResources,
  createEventWithParticipants,
  generateTimeSlotsForProgramType
};
