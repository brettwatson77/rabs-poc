/**
 * Loom Logic Engine
 * 
 * The "brain" of the loom system that handles intelligent resource allocation,
 * card generation, and relationship management.
 * 
 * This engine takes simple program intents and automatically generates all the
 * complex card logic, staff assignments, vehicle routing, and timing dependencies.
 */

const { pool } = require('../database');
const logger = require('../utils/logger');
const { formatDateForDb } = require('../utils/dateUtils');

/**
 * Configuration defaults for the logic engine
 * These can be overridden via the settings table
 */
const DEFAULT_CONFIG = {
  // Staff allocation
  PARTICIPANTS_PER_LEAD: 5,          // Add lead staff when exceeding this number
  PARTICIPANTS_PER_SUPPORT: 5,       // Add support staff for every N participants
  MIN_SUPERVISION_MULTIPLIER: 1.0,   // Default supervision multiplier
  HIGH_SUPPORT_THRESHOLD: 2.5,       // Participants above this need dedicated staff
  
  // Vehicle allocation
  OPTIMAL_BUS_RUN_DURATION: 45,      // Target minutes for a bus run
  MAX_BUS_RUN_DURATION: 90,          // Maximum minutes for a single bus run
  VEHICLE_CAPACITY_BUFFER: 0.9,      // Don't fill vehicles beyond 90% capacity
  
  // Card generation
  MIN_PICKUP_DURATION: 30,           // Minimum minutes for pickup run
  MIN_DROPOFF_DURATION: 30,          // Minimum minutes for dropoff run
  ACTIVITY_PADDING_BEFORE: 15,       // Minutes before activity start
  ACTIVITY_PADDING_AFTER: 15,        // Minutes after activity end
  
  // Cost optimization
  TARGET_PROFIT_MARGIN: 0.15,        // Target 15% profit margin
  ADMIN_COST_PERCENTAGE: 0.18,       // 18% admin cost
  PREFER_CASUAL_STAFF: true,         // Prefer casual staff for short programs
  
  // Timing
  DEFAULT_PICKUP_START_OFFSET: -60,  // Start pickup 60 minutes before program
  DEFAULT_DROPOFF_END_OFFSET: 60     // End dropoff 60 minutes after program
};

/**
 * Load configuration from database or use defaults
 * @returns {Promise<Object>} Configuration object
 */
const loadConfiguration = async () => {
  try {
    const { rows } = await pool.query(`
      SELECT key, value, data_type
      FROM tgl_settings
      WHERE category = 'loom_logic'
    `);
    
    const config = { ...DEFAULT_CONFIG };
    
    rows.forEach(row => {
      let value;
      switch (row.data_type) {
        case 'number':
          value = parseFloat(row.value);
          break;
        case 'boolean':
          value = row.value === 'true';
          break;
        case 'json':
          value = JSON.parse(row.value);
          break;
        default:
          value = row.value;
      }
      
      config[row.key] = value;
    });
    
    return config;
  } catch (error) {
    logger.error('Failed to load loom logic configuration', { error });
    return DEFAULT_CONFIG;
  }
};

/**
 * Calculate required staff based on participant count and supervision multipliers
 * @param {Array} participants Array of participant objects with supervision_multiplier
 * @param {Object} config Configuration object
 * @returns {Object} Staff requirements object
 */
const calculateStaffRequirements = (participants, config) => {
  // Calculate total supervision load
  let totalSupervisionLoad = 0;
  let highSupportParticipants = 0;
  
  participants.forEach(participant => {
    const multiplier = participant.supervision_multiplier || config.MIN_SUPERVISION_MULTIPLIER;
    totalSupervisionLoad += multiplier;
    
    if (multiplier >= config.HIGH_SUPPORT_THRESHOLD) {
      highSupportParticipants++;
    }
  });
  
  // Calculate base staff requirements
  const participantCount = participants.length;
  const needsLead = participantCount > config.PARTICIPANTS_PER_LEAD;
  
  // Calculate support staff (accounting for high-support participants)
  let supportStaffCount = Math.ceil(totalSupervisionLoad / config.PARTICIPANTS_PER_SUPPORT);
  
  // Ensure high-support participants have sufficient staff
  const highSupportStaffNeeded = Math.ceil(highSupportParticipants / 2);
  supportStaffCount = Math.max(supportStaffCount, highSupportStaffNeeded);
  
  // Ensure at least one staff member
  if (supportStaffCount === 0 && !needsLead) {
    supportStaffCount = 1;
  }
  
  return {
    needsLead,
    supportStaffCount,
    totalSupervisionLoad,
    highSupportParticipants,
    totalStaffNeeded: needsLead ? supportStaffCount + 1 : supportStaffCount
  };
};

/**
 * Assign staff to a program instance based on requirements
 * @param {Object} instance Program instance
 * @param {Array} participants Array of participant objects
 * @param {Object} config Configuration object
 * @returns {Promise<Array>} Array of assigned staff objects
 */
const assignStaffToInstance = async (instance, participants, config) => {
  try {
    // Calculate staff requirements
    const requirements = calculateStaffRequirements(participants, config);
    
    // Get available staff for the day and time
    const { rows: availableStaff } = await pool.query(`
      SELECT 
        s.id, 
        s.first_name, 
        s.last_name, 
        s.schads_level,
        s.hourly_rate,
        s.qualifications,
        s.casual_or_permanent,
        s.max_hours_per_week,
        (
          SELECT COUNT(*) 
          FROM tgl_loom_staff_shifts ss
          JOIN tgl_loom_instances i ON ss.instance_id = i.id
          WHERE ss.staff_id = s.id
          AND i.date = $1
        ) as shifts_today
      FROM staff s
      WHERE s.active = true
      ORDER BY 
        shifts_today ASC,
        s.casual_or_permanent ASC
    `, [instance.date]);
    
    if (availableStaff.length === 0) {
      logger.warn(`No available staff for instance ${instance.id} on ${instance.date}`);
      return [];
    }
    
    // Filter staff by qualifications if needed
    const programType = instance.program_type || '';
    let qualifiedStaff = availableStaff;
    
    if (programType.includes('high_support') || requirements.highSupportParticipants > 0) {
      qualifiedStaff = availableStaff.filter(staff => {
        const qualifications = staff.qualifications || [];
        return qualifications.includes('high_support') || qualifications.includes('disability_support');
      });
      
      if (qualifiedStaff.length === 0) {
        logger.warn(`No qualified staff for high support in instance ${instance.id}`);
        qualifiedStaff = availableStaff; // Fallback to all staff if none qualified
      }
    }
    
    // Assign lead staff if needed
    const assignedStaff = [];
    
    if (requirements.needsLead) {
      // Find best lead staff (prefer higher SCHADS level)
      const leadCandidates = qualifiedStaff.filter(staff => {
        const schadsLevel = parseInt(staff.schads_level) || 1;
        return schadsLevel >= 3; // Lead should be at least SCHADS 3
      });
      
      const leadStaff = leadCandidates.length > 0 
        ? leadCandidates[0] 
        : qualifiedStaff[0]; // Fallback to first available
      
      assignedStaff.push({
        staff_id: leadStaff.id,
        first_name: leadStaff.first_name,
        last_name: leadStaff.last_name,
        role: 'LEAD',
        schads_level: leadStaff.schads_level,
        hourly_rate: leadStaff.hourly_rate
      });
      
      // Remove lead from available pool
      qualifiedStaff = qualifiedStaff.filter(staff => staff.id !== leadStaff.id);
    }
    
    // Assign support staff
    for (let i = 0; i < requirements.supportStaffCount; i++) {
      if (qualifiedStaff.length === 0) {
        logger.warn(`Not enough staff available for instance ${instance.id}`);
        break;
      }
      
      const supportStaff = qualifiedStaff[0];
      
      assignedStaff.push({
        staff_id: supportStaff.id,
        first_name: supportStaff.first_name,
        last_name: supportStaff.last_name,
        role: 'SUPPORT',
        schads_level: supportStaff.schads_level,
        hourly_rate: supportStaff.hourly_rate
      });
      
      // Remove from available pool
      qualifiedStaff = qualifiedStaff.filter(staff => staff.id !== supportStaff.id);
    }
    
    return assignedStaff;
  } catch (error) {
    logger.error(`Error assigning staff to instance ${instance.id}`, { error });
    return [];
  }
};

/**
 * Calculate optimal vehicle assignments for a program instance
 * @param {Object} instance Program instance
 * @param {Array} participants Array of participant objects
 * @param {Object} config Configuration object
 * @returns {Promise<Array>} Array of assigned vehicle objects
 */
const assignVehiclesToInstance = async (instance, participants, config) => {
  try {
    // Count participants needing transport
    const pickupCount = participants.filter(p => p.pickup_required).length;
    const dropoffCount = participants.filter(p => p.dropoff_required).length;
    
    if (pickupCount === 0 && dropoffCount === 0) {
      return []; // No transport needed
    }
    
    // Get available vehicles
    const { rows: availableVehicles } = await pool.query(`
      SELECT 
        v.id, 
        v.name,
        v.registration, 
        v.capacity,
        v.wheelchair_capacity,
        (
          SELECT COUNT(*) 
          FROM tgl_loom_vehicle_runs vr
          JOIN tgl_loom_instances i ON vr.instance_id = i.id
          WHERE vr.vehicle_id = v.id
          AND i.date = $1
          AND (
            (i.start_time <= $2 AND i.end_time >= $2) OR
            (i.start_time <= $3 AND i.end_time >= $3) OR
            (i.start_time >= $2 AND i.end_time <= $3)
          )
        ) as runs_at_time
      FROM vehicles v
      WHERE v.active = true
      ORDER BY runs_at_time ASC, v.capacity DESC
    `, [
      instance.date, 
      instance.start_time, 
      instance.end_time
    ]);
    
    if (availableVehicles.length === 0) {
      logger.warn(`No available vehicles for instance ${instance.id} on ${instance.date}`);
      return [];
    }
    
    // Calculate wheelchair requirements
    const wheelchairCount = participants.filter(p => p.requires_wheelchair).length;
    
    // Assign vehicles based on capacity needs
    const assignedVehicles = [];
    let remainingPickups = pickupCount;
    let remainingDropoffs = dropoffCount;
    let remainingWheelchairs = wheelchairCount;
    
    // Sort vehicles by wheelchair capacity first for wheelchair users
    const sortedVehicles = [...availableVehicles].sort((a, b) => {
      if (remainingWheelchairs > 0) {
        return (b.wheelchair_capacity || 0) - (a.wheelchair_capacity || 0);
      }
      return (b.capacity || 0) - (a.capacity || 0);
    });
    
    for (const vehicle of sortedVehicles) {
      if (remainingPickups <= 0 && remainingDropoffs <= 0) break;
      
      const effectiveCapacity = Math.floor((vehicle.capacity || 0) * config.VEHICLE_CAPACITY_BUFFER);
      if (effectiveCapacity <= 0) continue;
      
      // Determine if we need this vehicle for pickups, dropoffs or both
      const useForPickup = remainingPickups > 0;
      const useForDropoff = remainingDropoffs > 0;
      
      if (!useForPickup && !useForDropoff) continue;
      
      // Calculate how many participants this vehicle can take
      const pickupsForVehicle = useForPickup ? Math.min(remainingPickups, effectiveCapacity) : 0;
      const dropoffsForVehicle = useForDropoff ? Math.min(remainingDropoffs, effectiveCapacity) : 0;
      
      // Calculate wheelchair capacity
      const wheelchairsForVehicle = Math.min(
        remainingWheelchairs,
        vehicle.wheelchair_capacity || 0
      );
      
      // Add vehicle to assigned list
      assignedVehicles.push({
        vehicle_id: vehicle.id,
        name: vehicle.name,
        registration: vehicle.registration,
        capacity: vehicle.capacity,
        assigned_pickups: pickupsForVehicle,
        assigned_dropoffs: dropoffsForVehicle,
        assigned_wheelchairs: wheelchairsForVehicle
      });
      
      // Update remaining counts
      remainingPickups -= pickupsForVehicle;
      remainingDropoffs -= dropoffsForVehicle;
      remainingWheelchairs -= wheelchairsForVehicle;
    }
    
    // Log warning if we couldn't assign all participants
    if (remainingPickups > 0 || remainingDropoffs > 0) {
      logger.warn(`Could not assign vehicles for all participants in instance ${instance.id}`, {
        remainingPickups,
        remainingDropoffs,
        instance_id: instance.id
      });
    }
    
    return assignedVehicles;
  } catch (error) {
    logger.error(`Error assigning vehicles to instance ${instance.id}`, { error });
    return [];
  }
};

/**
 * Generate pickup and dropoff cards based on instance and vehicle assignments
 * @param {Object} instance Program instance
 * @param {Array} participants Array of participant objects
 * @param {Array} vehicles Array of assigned vehicle objects
 * @param {Object} config Configuration object
 * @returns {Object} Object containing pickup and dropoff cards
 */
const generateTransportCards = (instance, participants, vehicles, config) => {
  const pickupCards = [];
  const dropoffCards = [];
  
  // Parse program start/end times
  const programStartTime = instance.start_time; // Format: "HH:MM:SS"
  const programEndTime = instance.end_time;
  
  // Calculate default pickup/dropoff times
  const [programStartHour, programStartMinute] = programStartTime.split(':').map(Number);
  const [programEndHour, programEndMinute] = programEndTime.split(':').map(Number);
  
  const programStartMinutes = programStartHour * 60 + programStartMinute;
  const programEndMinutes = programEndHour * 60 + programEndMinute;
  
  const pickupStartMinutes = Math.max(0, programStartMinutes + config.DEFAULT_PICKUP_START_OFFSET);
  const dropoffEndMinutes = Math.min(24 * 60 - 1, programEndMinutes + config.DEFAULT_DROPOFF_END_OFFSET);
  
  // Format minutes to HH:MM
  const formatMinutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
  };
  
  // Generate cards for each vehicle with pickups
  vehicles.forEach((vehicle, index) => {
    if (vehicle.assigned_pickups > 0) {
      // Calculate pickup duration based on number of participants
      const pickupDuration = Math.max(
        config.MIN_PICKUP_DURATION,
        Math.ceil(vehicle.assigned_pickups * 10) // 10 minutes per pickup
      );
      
      // Calculate pickup start/end times
      const pickupEndMinutes = programStartMinutes - config.ACTIVITY_PADDING_BEFORE;
      const pickupStartMinutes = Math.max(0, pickupEndMinutes - pickupDuration);
      
      pickupCards.push({
        type: 'PICKUP',
        title: `Pickup Run ${index + 1}`,
        date: instance.date,
        start_time: formatMinutesToTime(pickupStartMinutes),
        end_time: formatMinutesToTime(pickupEndMinutes),
        vehicle_id: vehicle.vehicle_id,
        vehicle_name: vehicle.name,
        vehicle_registration: vehicle.registration,
        participant_count: vehicle.assigned_pickups,
        wheelchair_count: vehicle.assigned_wheelchairs,
        program_id: instance.program_id,
        program_instance_id: instance.id,
        notes: `Pickup run for ${instance.program_name}`,
        sequence_number: index + 1
      });
    }
    
    if (vehicle.assigned_dropoffs > 0) {
      // Calculate dropoff duration based on number of participants
      const dropoffDuration = Math.max(
        config.MIN_DROPOFF_DURATION,
        Math.ceil(vehicle.assigned_dropoffs * 10) // 10 minutes per dropoff
      );
      
      // Calculate dropoff start/end times
      const dropoffStartMinutes = programEndMinutes + config.ACTIVITY_PADDING_AFTER;
      const dropoffEndMinutes = Math.min(24 * 60 - 1, dropoffStartMinutes + dropoffDuration);
      
      dropoffCards.push({
        type: 'DROPOFF',
        title: `Dropoff Run ${index + 1}`,
        date: instance.date,
        start_time: formatMinutesToTime(dropoffStartMinutes),
        end_time: formatMinutesToTime(dropoffEndMinutes),
        vehicle_id: vehicle.vehicle_id,
        vehicle_name: vehicle.name,
        vehicle_registration: vehicle.registration,
        participant_count: vehicle.assigned_dropoffs,
        wheelchair_count: vehicle.assigned_wheelchairs,
        program_id: instance.program_id,
        program_instance_id: instance.id,
        notes: `Dropoff run for ${instance.program_name}`,
        sequence_number: index + 1
      });
    }
  });
  
  return { pickupCards, dropoffCards };
};

/**
 * Generate roster cards for staff assigned to an instance
 * @param {Object} instance Program instance
 * @param {Array} staff Array of assigned staff objects
 * @param {Array} transportCards Array of pickup and dropoff cards
 * @returns {Array} Array of roster card objects
 */
const generateRosterCards = (instance, staff, transportCards) => {
  const { pickupCards = [], dropoffCards = [] } = transportCards || {};
  const rosterCards = [];
  
  // Create roster card for each staff member
  staff.forEach((staffMember, index) => {
    // Determine if this staff member is assigned to transport
    const assignedToTransport = index === 0 && (pickupCards.length > 0 || dropoffCards.length > 0);
    
    // Calculate shift start/end times based on transport assignments
    let shiftStartTime = instance.start_time;
    let shiftEndTime = instance.end_time;
    
    if (assignedToTransport) {
      // If assigned to transport, shift starts with first pickup
      if (pickupCards.length > 0) {
        const firstPickup = pickupCards.reduce((earliest, card) => {
          return card.start_time < earliest.start_time ? card : earliest;
        }, pickupCards[0]);
        
        shiftStartTime = firstPickup.start_time;
      }
      
      // Shift ends after last dropoff
      if (dropoffCards.length > 0) {
        const lastDropoff = dropoffCards.reduce((latest, card) => {
          return card.end_time > latest.end_time ? card : latest;
        }, dropoffCards[0]);
        
        shiftEndTime = lastDropoff.end_time;
      }
    }
    
    // Create the roster card
    rosterCards.push({
      type: 'ROSTER',
      title: `${staffMember.role}: ${staffMember.first_name} ${staffMember.last_name}`,
      date: instance.date,
      start_time: shiftStartTime,
      end_time: shiftEndTime,
      staff_id: staffMember.staff_id,
      staff_name: `${staffMember.first_name} ${staffMember.last_name}`,
      staff_role: staffMember.role,
      schads_level: staffMember.schads_level,
      hourly_rate: staffMember.hourly_rate,
      program_id: instance.program_id,
      program_instance_id: instance.id,
      assigned_to_transport: assignedToTransport,
      notes: `${staffMember.role} for ${instance.program_name}`,
      sequence_number: index + 1
    });
  });
  
  return rosterCards;
};

/**
 * Calculate financial metrics for an instance
 * @param {Object} instance Program instance
 * @param {Array} participants Array of participant objects with billing codes
 * @param {Array} staff Array of assigned staff objects
 * @param {Object} config Configuration object
 * @returns {Object} Financial metrics object
 */
const calculateFinancialMetrics = (instance, participants, staff, config) => {
  try {
    // Calculate program duration in hours
    const startTime = instance.start_time.split(':').map(Number);
    const endTime = instance.end_time.split(':').map(Number);
    
    const startMinutes = startTime[0] * 60 + startTime[1];
    const endMinutes = endTime[0] * 60 + endTime[1];
    
    const durationHours = (endMinutes - startMinutes) / 60;
    
    // Calculate revenue from participant billing codes
    let totalRevenue = 0;
    
    participants.forEach(participant => {
      const billingCodes = participant.billing_codes || [];
      
      billingCodes.forEach(code => {
        const hourlyRate = code.hourly_rate || 0;
        const hours = code.hours || 0;
        
        totalRevenue += hourlyRate * hours;
      });
    });
    
    // Calculate staff costs
    let totalStaffCosts = 0;
    
    staff.forEach(staffMember => {
      const hourlyRate = staffMember.hourly_rate || 0;
      totalStaffCosts += hourlyRate * durationHours;
    });
    
    // Calculate admin costs
    const adminCosts = totalRevenue * config.ADMIN_COST_PERCENTAGE;
    
    // Calculate profit/loss
    const profitLoss = totalRevenue - totalStaffCosts - adminCosts;
    
    // Calculate profit margin
    const profitMargin = totalRevenue > 0 ? (profitLoss / totalRevenue) : 0;
    
    return {
      revenue: totalRevenue,
      staff_costs: totalStaffCosts,
      admin_costs: adminCosts,
      profit_loss: profitLoss,
      profit_margin: profitMargin,
      duration_hours: durationHours
    };
  } catch (error) {
    logger.error(`Error calculating financial metrics for instance ${instance.id}`, { error });
    return {
      revenue: 0,
      staff_costs: 0,
      admin_costs: 0,
      profit_loss: 0,
      profit_margin: 0,
      duration_hours: 0
    };
  }
};

/**
 * Process a program instance and generate all related cards and assignments
 * @param {Object} instance Program instance
 * @returns {Promise<Object>} Processing results
 */
const processInstance = async (instance) => {
  try {
    // Load configuration
    const config = await loadConfiguration();
    
    // Get participants for this instance
    const { rows: participants } = await pool.query(`
      SELECT 
        p.id as participant_id,
        p.first_name,
        p.last_name,
        p.supervision_multiplier,
        p.requires_wheelchair,
        pa.pickup_required,
        pa.dropoff_required,
        pa.billing_codes
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = $1
      AND pa.status = 'CONFIRMED'
    `, [instance.id]);
    
    // Assign staff based on participant needs
    const assignedStaff = await assignStaffToInstance(instance, participants, config);
    
    // Assign vehicles based on transport needs
    const assignedVehicles = await assignVehiclesToInstance(instance, participants, config);
    
    // Generate transport cards (pickup/dropoff)
    const transportCards = generateTransportCards(instance, participants, assignedVehicles, config);
    
    // Generate roster cards for staff
    const rosterCards = generateRosterCards(instance, assignedStaff, transportCards);
    
    // Calculate financial metrics
    const financialMetrics = calculateFinancialMetrics(instance, participants, assignedStaff, config);
    
    // Combine all cards
    const allCards = [
      ...transportCards.pickupCards,
      {
        type: 'ACTIVITY',
        title: instance.program_name,
        date: instance.date,
        start_time: instance.start_time,
        end_time: instance.end_time,
        program_id: instance.program_id,
        program_instance_id: instance.id,
        participant_count: participants.length,
        staff_count: assignedStaff.length,
        financials: financialMetrics,
        notes: instance.notes || '',
        sequence_number: 1
      },
      ...transportCards.dropoffCards,
      ...rosterCards
    ];
    
    // Save the generated cards and assignments to the database
    await saveInstanceData(instance, participants, assignedStaff, assignedVehicles, allCards, financialMetrics);
    
    return {
      success: true,
      instance_id: instance.id,
      participants: participants.length,
      staff: assignedStaff.length,
      vehicles: assignedVehicles.length,
      cards: allCards.length,
      financials: financialMetrics
    };
  } catch (error) {
    logger.error(`Error processing instance ${instance.id}`, { error });
    return {
      success: false,
      instance_id: instance.id,
      error: error.message
    };
  }
};

/**
 * Save instance data to the database
 * @param {Object} instance Program instance
 * @param {Array} participants Array of participant objects
 * @param {Array} staff Array of assigned staff objects
 * @param {Array} vehicles Array of assigned vehicle objects
 * @param {Array} cards Array of generated card objects
 * @param {Object} financialMetrics Financial metrics object
 * @returns {Promise<void>}
 */
const saveInstanceData = async (instance, participants, staff, vehicles, cards, financialMetrics) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update instance with financial metrics
    await client.query(`
      UPDATE tgl_loom_instances
      SET 
        financials = $1,
        staff_count = $2,
        participant_count = $3,
        last_processed = NOW()
      WHERE id = $4
    `, [
      JSON.stringify(financialMetrics),
      staff.length,
      participants.length,
      instance.id
    ]);
    
    // Save staff assignments
    for (const staffMember of staff) {
      await client.query(`
        INSERT INTO tgl_loom_staff_shifts
          (instance_id, staff_id, role, start_time, end_time)
        VALUES
          ($1, $2, $3, $4, $5)
        ON CONFLICT (instance_id, staff_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time
      `, [
        instance.id,
        staffMember.staff_id,
        staffMember.role,
        instance.start_time,
        instance.end_time
      ]);
    }
    
    // Save vehicle assignments
    for (const vehicle of vehicles) {
      await client.query(`
        INSERT INTO tgl_loom_vehicle_runs
          (instance_id, vehicle_id, assigned_pickups, assigned_dropoffs)
        VALUES
          ($1, $2, $3, $4)
        ON CONFLICT (instance_id, vehicle_id)
        DO UPDATE SET
          assigned_pickups = EXCLUDED.assigned_pickups,
          assigned_dropoffs = EXCLUDED.assigned_dropoffs
      `, [
        instance.id,
        vehicle.vehicle_id,
        vehicle.assigned_pickups,
        vehicle.assigned_dropoffs
      ]);
    }
    
    // Save cards to dashboard_cards table if it exists
    try {
      for (const card of cards) {
        await client.query(`
          INSERT INTO dashboard_cards
            (type, title, date, start_time, end_time, program_id, instance_id, 
             staff_id, vehicle_id, notes, metadata)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (type, date, program_id, instance_id, COALESCE(staff_id, 0), COALESCE(vehicle_id, 0))
          DO UPDATE SET
            title = EXCLUDED.title,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time,
            notes = EXCLUDED.notes,
            metadata = EXCLUDED.metadata
        `, [
          card.type,
          card.title,
          instance.date,
          card.start_time,
          card.end_time,
          instance.program_id,
          instance.id,
          card.staff_id || null,
          card.vehicle_id || null,
          card.notes || '',
          JSON.stringify({
            sequence_number: card.sequence_number,
            participant_count: card.participant_count,
            staff_count: card.staff_count,
            financials: card.financials,
            vehicle_registration: card.vehicle_registration
          })
        ]);
      }
    } catch (cardError) {
      // If dashboard_cards table doesn't exist, just log and continue
      logger.warn('Could not save to dashboard_cards table', { error: cardError.message });
    }
    
    // Log the processing in the audit log
    await client.query(`
      INSERT INTO tgl_loom_audit_log
        (instance_id, action, details)
      VALUES
        ($1, 'PROCESS_INSTANCE', $2)
    `, [
      instance.id,
      JSON.stringify({
        participants: participants.length,
        staff: staff.length,
        vehicles: vehicles.length,
        cards: cards.length,
        financials: financialMetrics
      })
    ]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Optimize bus routes for multiple pickups/dropoffs
 * @param {Array} participants Array of participant objects with addresses
 * @param {Object} vehicle Vehicle object
 * @param {String} type 'PICKUP' or 'DROPOFF'
 * @param {Object} config Configuration object
 * @returns {Object} Optimized route object
 */
const optimizeBusRoute = async (participants, vehicle, type, config) => {
  try {
    // This would ideally use a real routing algorithm with Google Maps API
    // For now, we'll just create a simple approximation
    
    // Filter participants who need this transport type
    const relevantParticipants = participants.filter(p => {
      return type === 'PICKUP' ? p.pickup_required : p.dropoff_required;
    });
    
    if (relevantParticipants.length === 0) {
      return {
        success: false,
        message: 'No participants require this transport type'
      };
    }
    
    // Sort by distance from venue (would be replaced by actual routing)
    const sortedParticipants = [...relevantParticipants].sort((a, b) => {
      // This is a placeholder - real implementation would use actual distances
      return (a.distance_from_venue || 0) - (b.distance_from_venue || 0);
    });
    
    // Calculate estimated duration
    const participantCount = sortedParticipants.length;
    const estimatedDuration = Math.min(
      config.MAX_BUS_RUN_DURATION,
      Math.max(
        config.MIN_PICKUP_DURATION,
        participantCount * 10 + 5 * (participantCount - 1) // 10 min per stop + 5 min between stops
      )
    );
    
    return {
      success: true,
      vehicle_id: vehicle.id,
      participants: sortedParticipants.map(p => p.participant_id),
      estimated_duration: estimatedDuration,
      stops: sortedParticipants.map((p, index) => ({
        participant_id: p.participant_id,
        sequence: index + 1,
        estimated_time: index * 10 // 10 minutes per stop
      }))
    };
  } catch (error) {
    logger.error('Error optimizing bus route', { error });
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Rebalance staff across multiple instances on the same day
 * @param {String} date Date to rebalance (YYYY-MM-DD)
 * @returns {Promise<Object>} Rebalancing results
 */
const rebalanceStaffForDay = async (date) => {
  try {
    // Load configuration
    const config = await loadConfiguration();
    
    // Get all instances for the day
    const { rows: instances } = await pool.query(`
      SELECT 
        i.id, 
        i.program_id,
        i.program_name,
        i.date,
        i.start_time,
        i.end_time,
        COUNT(pa.id) as participant_count,
        SUM(p.supervision_multiplier) as supervision_load
      FROM tgl_loom_instances i
      LEFT JOIN tgl_loom_participant_allocations pa ON i.id = pa.instance_id AND pa.status = 'CONFIRMED'
      LEFT JOIN participants p ON pa.participant_id = p.id
      WHERE i.date = $1
      GROUP BY i.id, i.program_id, i.program_name, i.date, i.start_time, i.end_time
      ORDER BY i.start_time
    `, [date]);
    
    if (instances.length === 0) {
      return {
        success: true,
        message: 'No instances found for this date',
        date
      };
    }
    
    // Process each instance to rebalance staff
    const results = [];
    
    for (const instance of instances) {
      const result = await processInstance(instance);
      results.push(result);
    }
    
    // Log the rebalancing in the audit log
    await pool.query(`
      INSERT INTO tgl_loom_audit_log
        (action, details)
      VALUES
        ('REBALANCE_STAFF', $1)
    `, [
      JSON.stringify({
        date,
        instances: instances.length,
        results
      })
    ]);
    
    return {
      success: true,
      date,
      instances: instances.length,
      results
    };
  } catch (error) {
    logger.error(`Error rebalancing staff for date ${date}`, { error });
    return {
      success: false,
      date,
      error: error.message
    };
  }
};

/**
 * Handle a participant cancellation for a specific date
 * @param {String} participantId Participant ID
 * @param {String} date Date of cancellation (YYYY-MM-DD)
 * @param {String} reason Cancellation reason
 * @returns {Promise<Object>} Cancellation results
 */
const handleParticipantCancellation = async (participantId, date, reason) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find affected instances
    const { rows: allocations } = await client.query(`
      SELECT 
        pa.id as allocation_id,
        pa.instance_id,
        i.program_id,
        i.program_name,
        i.date,
        i.start_time,
        i.end_time
      FROM tgl_loom_participant_allocations pa
      JOIN tgl_loom_instances i ON pa.instance_id = i.id
      WHERE pa.participant_id = $1
      AND i.date = $2
      AND pa.status = 'CONFIRMED'
    `, [participantId, date]);
    
    if (allocations.length === 0) {
      await client.query('COMMIT');
      return {
        success: true,
        message: 'No active allocations found for this participant on this date',
        participantId,
        date
      };
    }
    
    // Create cancellation exception
    await client.query(`
      INSERT INTO tgl_temporal_exceptions
        (exception_type, participant_id, program_id, exception_date, reason)
      VALUES
        ('PARTICIPANT_CANCELLATION', $1, $2, $3, $4)
    `, [
      participantId,
      allocations[0].program_id,
      date,
      reason || 'Participant cancelled'
    ]);
    
    // Update allocation status
    for (const allocation of allocations) {
      await client.query(`
        UPDATE tgl_loom_participant_allocations
        SET status = 'CANCELLED', last_updated = NOW()
        WHERE id = $1
      `, [allocation.allocation_id]);
    }
    
    // Log cancellation in audit log
    await client.query(`
      INSERT INTO tgl_loom_audit_log
        (action, details)
      VALUES
        ('PARTICIPANT_CANCELLATION', $1)
    `, [
      JSON.stringify({
        participant_id: participantId,
        date,
        reason,
        affected_instances: allocations.map(a => a.instance_id)
      })
    ]);
    
    // Reprocess affected instances
    for (const allocation of allocations) {
      await processInstance({
        id: allocation.instance_id,
        program_id: allocation.program_id,
        program_name: allocation.program_name,
        date: allocation.date,
        start_time: allocation.start_time,
        end_time: allocation.end_time
      });
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      participantId,
      date,
      affected_instances: allocations.length,
      instance_ids: allocations.map(a => a.instance_id)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error handling participant cancellation`, { error, participantId, date });
    return {
      success: false,
      participantId,
      date,
      error: error.message
    };
  } finally {
    client.release();
  }
};

/**
 * Handle staff sickness/absence for a specific date
 * @param {String} staffId Staff ID
 * @param {String} date Date of absence (YYYY-MM-DD)
 * @param {String} reason Absence reason
 * @returns {Promise<Object>} Absence handling results
 */
const handleStaffSickness = async (staffId, date, reason) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find affected shifts
    const { rows: shifts } = await client.query(`
      SELECT 
        ss.id as shift_id,
        ss.instance_id,
        i.program_id,
        i.program_name,
        i.date,
        i.start_time,
        i.end_time,
        ss.role
      FROM tgl_loom_staff_shifts ss
      JOIN tgl_loom_instances i ON ss.instance_id = i.id
      WHERE ss.staff_id = $1
      AND i.date = $2
    `, [staffId, date]);
    
    if (shifts.length === 0) {
      await client.query('COMMIT');
      return {
        success: true,
        message: 'No shifts found for this staff member on this date',
        staffId,
        date
      };
    }
    
    // Create staff absence record
    await client.query(`
      INSERT INTO staff_absences
        (staff_id, date, reason, status)
      VALUES
        ($1, $2, $3, 'APPROVED')
      ON CONFLICT (staff_id, date)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        status = 'APPROVED'
    `, [
      staffId,
      date,
      reason || 'Staff member unavailable'
    ]);
    
    // Remove staff from shifts
    for (const shift of shifts) {
      await client.query(`
        DELETE FROM tgl_loom_staff_shifts
        WHERE id = $1
      `, [shift.shift_id]);
    }
    
    // Log absence in audit log
    await client.query(`
      INSERT INTO tgl_loom_audit_log
        (action, details)
      VALUES
        ('STAFF_ABSENCE', $1)
    `, [
      JSON.stringify({
        staff_id: staffId,
        date,
        reason,
        affected_instances: shifts.map(s => s.instance_id)
      })
    ]);
    
    // Reprocess affected instances
    for (const shift of shifts) {
      await processInstance({
        id: shift.instance_id,
        program_id: shift.program_id,
        program_name: shift.program_name,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time
      });
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      staffId,
      date,
      affected_instances: shifts.length,
      instance_ids: shifts.map(s => s.instance_id)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error handling staff sickness`, { error, staffId, date });
    return {
      success: false,
      staffId,
      date,
      error: error.message
    };
  } finally {
    client.release();
  }
};

/**
 * Update loom configuration settings
 * @param {Object} settings Object containing settings to update
 * @returns {Promise<Object>} Update results
 */
const updateConfiguration = async (settings) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updates = [];
    
    for (const [key, value] of Object.entries(settings)) {
      if (DEFAULT_CONFIG.hasOwnProperty(key)) {
        let dataType = 'string';
        
        if (typeof value === 'number') dataType = 'number';
        if (typeof value === 'boolean') dataType = 'boolean';
        if (typeof value === 'object') dataType = 'json';
        
        const stringValue = dataType === 'json' ? JSON.stringify(value) : String(value);
        
        await client.query(`
          INSERT INTO tgl_settings
            (key, value, data_type, category)
          VALUES
            ($1, $2, $3, 'loom_logic')
          ON CONFLICT (key)
          DO UPDATE SET
            value = EXCLUDED.value,
            data_type = EXCLUDED.data_type
        `, [key, stringValue, dataType]);
        
        updates.push(key);
      }
    }
    
    // Log configuration update
    await client.query(`
      INSERT INTO tgl_loom_audit_log
        (entity_id, entity_type, action_type, action, details)
      VALUES
        (gen_random_uuid(), 'SYSTEM', 'SYSTEM', 'UPDATE_CONFIGURATION', $1)
    `, [
      JSON.stringify({
        updated_keys: updates,
        values: settings
      })
    ]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      updated: updates.length,
      keys: updates
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating loom configuration', { error });
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
};

module.exports = {
  // Core processing functions
  processInstance,
  rebalanceStaffForDay,
  
  // Staff and vehicle assignment
  calculateStaffRequirements,
  assignStaffToInstance,
  assignVehiclesToInstance,
  
  // Card generation
  generateTransportCards,
  generateRosterCards,
  
  // Route optimization
  optimizeBusRoute,
  
  // Exception handling
  handleParticipantCancellation,
  handleStaffSickness,
  
  // Configuration management
  loadConfiguration,
  updateConfiguration,
  
  // Financial calculations
  calculateFinancialMetrics
};
