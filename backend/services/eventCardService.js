/**
 * eventCardService.js
 * 
 * The Event Card Decomposition Service - a critical component of The Great Loom architecture
 * 
 * This service handles the "explosion" of a single loom_instance into multiple UI cards:
 * - 2 Bus Cards (pickup and dropoff)
 * - 1 Activity Card (the main program)
 * - Multiple Roster Cards (staff assignments)
 * 
 * This creates the 1-to-many relationship between backend events and frontend UI components
 * that makes the complex scheduling data digestible for users.
 */

const { pool } = require('../database');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Sanity-check: make sure the database pool survived the require cycle.
// This will emit exactly once when the file is first imported.
// ---------------------------------------------------------------------------
if (!pool) {
  /* eslint-disable-next-line no-console */
  console.error(
    '[eventCardService] FATAL – database pool is undefined. ' +
    'Services that call pool.query() will crash. ' +
    'Check backend/database.js export or circular-dependency issues.'
  );
} else {
  logger.debug('[eventCardService] Database pool acquired successfully');
}

// Card types for frontend rendering
const CARD_TYPES = {
  MASTER: 'MASTER',          // overall event card (new)
  BUS_PICKUP: 'BUS_PICKUP',
  ACTIVITY: 'ACTIVITY', 
  BUS_DROPOFF: 'BUS_DROPOFF',
  ROSTER: 'ROSTER'
};

/**
 * Generates all cards for a single loom instance
 * @param {number} instanceId - The loom_instance ID to decompose
 * @returns {Promise<Array>} Array of card objects
 */
async function generateCardsForInstance(instanceId) {
  try {
    /* ------------------------------------------------------------------
     * 1. Load instance & helper data
     * ------------------------------------------------------------------ */
    const instance = await getLoomInstanceDetails(instanceId);
    if (!instance) throw new Error(`Loom instance ${instanceId} not found`);

    const cards = [];

    /* ------------------------------------------------------------------
     * 2. MASTER CARD  (overall event container)
     * ------------------------------------------------------------------ */
    cards.push({
      card_id: `master-${instanceId}`,
      instance_id: instanceId,
      card_type: CARD_TYPES.MASTER,
      title: `Event: ${instance.program_name}`,
      start_time: instance.pickup_time,
      end_time: instance.dropoff_time,
      location: instance.activity_location,
      location_coordinates: instance.activity_coordinates,
      participants: instance.participants,
      staff: [], // master card will be enriched later
      vehicle: null,
      notes: instance.activity_notes,
      quality_flag: instance.quality_flag,
      override_status: instance.override_status
    });

    /* ------------------------------------------------------------------
     * 3. Determine dynamic counts  (NOW WITH SUPERVISION MULTIPLIER)
     * ------------------------------------------------------------------ */

    /**
     * A participant with supervision_multiplier > 1 “feels” heavier for staff
     * allocation but still consumes exactly one physical bus seat.
     */
    const virtualParticipantCount = instance.participants.reduce(
      (sum, p) => sum + (parseFloat(p.supervision_multiplier) || 1.0),
      0
    );

    const STAFF_RATIO = 4; // 1 staff : 4 virtual participants (configurable)
    const requiredRosterCards = Math.ceil(virtualParticipantCount / STAFF_RATIO);

    // route optimisation – get estimated duration & vehicle capacity
    const routeInfo = await getOptimisedRoute(instanceId); // {runs: [...], totalMinutes}
    const MAX_ROUTE_MINUTES = 60;
    const busRunCount =
      routeInfo.totalMinutes > MAX_ROUTE_MINUTES
        ? Math.ceil(routeInfo.totalMinutes / MAX_ROUTE_MINUTES)
        : routeInfo.runs.length; // fall back to API-suggested split

    /* ------------------------------------------------------------------
     * 4. Build BUS PICKUP / DROPOFF cards
     * ------------------------------------------------------------------ */
    for (let runIndex = 0; runIndex < busRunCount; runIndex++) {
      const run = routeInfo.runs[runIndex] || {}; // safety default

      // pickup
      cards.push({
        card_id: `pickup-${instanceId}-${runIndex + 1}`,
        instance_id: instanceId,
        card_type: CARD_TYPES.BUS_PICKUP,
        title: `Pickup (${runIndex + 1}/${busRunCount}): ${instance.program_name}`,
        start_time: run.pickupStart || instance.pickup_time,
        end_time: run.pickupEnd || instance.activity_start_time,
        location: instance.pickup_location,
        location_coordinates: instance.pickup_coordinates,
        participants: run.participants || instance.participants,
        staff: instance.pickup_staff,
        vehicle: instance.vehicle,
        notes: instance.pickup_notes,
        quality_flag: instance.quality_flag,
        override_status: instance.override_status
      });

      // drop-off
      cards.push({
        card_id: `dropoff-${instanceId}-${runIndex + 1}`,
        instance_id: instanceId,
        card_type: CARD_TYPES.BUS_DROPOFF,
        title: `Dropoff (${runIndex + 1}/${busRunCount}): ${instance.program_name}`,
        start_time: run.dropoffStart || instance.activity_end_time,
        end_time: run.dropoffEnd || instance.dropoff_time,
        location: instance.dropoff_location,
        location_coordinates: instance.dropoff_coordinates,
        participants: run.participants || instance.participants,
        staff: instance.dropoff_staff,
        vehicle: instance.vehicle,
        notes: instance.dropoff_notes,
        quality_flag: instance.quality_flag,
        override_status: instance.override_status
      });
    }

    /* ------------------------------------------------------------------
     * 5. ACTIVITY card (unchanged – still single)
     * ------------------------------------------------------------------ */
    cards.push({
      card_id: `activity-${instanceId}`,
      instance_id: instanceId,
      card_type: CARD_TYPES.ACTIVITY,
      title: instance.program_name,
      start_time: instance.activity_start_time,
      end_time: instance.activity_end_time,
      location: instance.activity_location,
      location_coordinates: instance.activity_coordinates,
      participants: instance.participants,
      staff: instance.activity_staff,
      vehicle: null,
      notes: instance.activity_notes,
      quality_flag: instance.quality_flag,
      override_status: instance.override_status
    });

    /* ------------------------------------------------------------------
     * 6. Dynamic ROSTER cards
     * ------------------------------------------------------------------ */
    const staffAssignments = await getStaffAssignmentsForInstance(instanceId);
    // Limit / expand based on requiredRosterCards
    const rosterAssignments = staffAssignments.slice(0, requiredRosterCards);

    rosterAssignments.forEach((assignment, idx) => {
      cards.push({
        card_id: `roster-${instanceId}-${assignment.staff_id}-${idx + 1}`,
        instance_id: instanceId,
        card_type: CARD_TYPES.ROSTER,
        title: `${assignment.role}: ${instance.program_name}`,
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        location: instance.activity_location,
        location_coordinates: instance.activity_coordinates,
        participants: instance.participants,
        staff: { id: assignment.staff_id, name: assignment.staff_name, role: assignment.role },
        vehicle: assignment.requires_vehicle ? instance.vehicle : null,
        notes: assignment.notes,
        quality_flag: instance.quality_flag,
        override_status: assignment.override_status || instance.override_status
      });
    });

    /* ------------------------------------------------------------------
     * 7. Persist & return
     * ------------------------------------------------------------------ */
    await storeCardMappings(cards);
    return cards;
  } catch (error) {
    logger.error(`Error generating cards for instance ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Placeholder for route optimisation – in real system this would call
 * mapping/optimisation micro-service.
 * @returns {Promise<{runs:Array, totalMinutes:number}>}
 */
async function getOptimisedRoute(instanceId) {
  // TODO: integrate with DynamicResourceService / Google Maps optimiser
  // For now return a dummy single-run response.
  return {
    runs: [{}],
    totalMinutes: 45
  };
}

/**
 * Batch generates cards for multiple loom instances
 * @param {Array<number>} instanceIds - Array of loom_instance IDs
 * @returns {Promise<Object>} Mapping of instance IDs to their cards
 */
async function batchGenerateCards(instanceIds) {
  try {
    const cardsByInstance = {};
    
    for (const instanceId of instanceIds) {
      cardsByInstance[instanceId] = await generateCardsForInstance(instanceId);
    }
    
    return cardsByInstance;
  } catch (error) {
    logger.error('Error in batch card generation:', error);
    throw error;
  }
}

/**
 * Gets cards for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of card objects
 */
async function getCardsByDateRange(startDate, endDate) {
  try {
    const query = `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_card_map cm
      JOIN loom_instances li ON cm.instance_id = li.id
      WHERE li.date BETWEEN $1 AND $2
      ORDER BY li.date, cm.start_time
    `;
    
    const { rows } = await pool.query(query, [startDate, endDate]);
    return enrichCardData(rows);
  } catch (error) {
    logger.error('Error fetching cards by date range:', error);
    throw error;
  }
}

/**
 * Gets cards for a specific participant
 * @param {number} participantId - The participant ID
 * @param {Date} startDate - Optional start date filter
 * @param {Date} endDate - Optional end date filter
 * @returns {Promise<Array>} Array of card objects
 */
async function getCardsByParticipant(participantId, startDate = null, endDate = null) {
  try {
    let query = `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_card_map cm
      JOIN loom_instances li ON cm.instance_id = li.id
      JOIN loom_participant_attendance lpa ON li.id = lpa.instance_id
      WHERE lpa.participant_id = $1
    `;
    
    const params = [participantId];
    
    if (startDate && endDate) {
      query += ` AND li.date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }
    
    query += ` ORDER BY li.date, cm.start_time`;
    
    const { rows } = await pool.query(query, params);
    return enrichCardData(rows);
  } catch (error) {
    logger.error(`Error fetching cards for participant ${participantId}:`, error);
    throw error;
  }
}

/**
 * Gets cards for a specific staff member
 * @param {number} staffId - The staff ID
 * @param {Date} startDate - Optional start date filter
 * @param {Date} endDate - Optional end date filter
 * @returns {Promise<Array>} Array of card objects
 */
async function getCardsByStaff(staffId, startDate = null, endDate = null) {
  try {
    let query = `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_card_map cm
      JOIN loom_instances li ON cm.instance_id = li.id
      JOIN loom_staff_assignments lsa ON li.id = lsa.instance_id
      WHERE lsa.staff_id = $1 AND cm.card_type = 'ROSTER'
    `;
    
    const params = [staffId];
    
    if (startDate && endDate) {
      query += ` AND li.date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }
    
    query += ` ORDER BY li.date, cm.start_time`;
    
    const { rows } = await pool.query(query, params);
    return enrichCardData(rows);
  } catch (error) {
    logger.error(`Error fetching cards for staff ${staffId}:`, error);
    throw error;
  }
}

/**
 * Gets full details for a loom instance
 * @param {number} instanceId - The loom_instance ID
 * @returns {Promise<Object>} Instance details with all associated data
 */
async function getLoomInstanceDetails(instanceId) {
  try {
    // Get base instance data
    const instanceQuery = `
      SELECT li.*, p.name as program_name
      FROM loom_instances li
      JOIN rules_programs p ON li.program_id = p.id
      WHERE li.id = $1
    `;
    
    const { rows: instanceRows } = await pool.query(instanceQuery, [instanceId]);
    if (instanceRows.length === 0) return null;
    
    const instance = instanceRows[0];
    
    // Get participants
    const participantsQuery = `
      SELECT pa.*, p.name, p.special_needs
      FROM loom_participant_attendance pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = $1
    `;
    
    const { rows: participantRows } = await pool.query(participantsQuery, [instanceId]);
    instance.participants = participantRows;
    
    // Get staff assignments
    const staffQuery = `
      SELECT sa.*, s.name as staff_name, s.qualifications
      FROM loom_staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.instance_id = $1
    `;
    
    const { rows: staffRows } = await pool.query(staffQuery, [instanceId]);
    
    // Separate staff by role
    instance.pickup_staff = staffRows.filter(s => s.assignment_type === 'PICKUP');
    instance.activity_staff = staffRows.filter(s => s.assignment_type === 'ACTIVITY');
    instance.dropoff_staff = staffRows.filter(s => s.assignment_type === 'DROPOFF');
    
    // Get vehicle assignment
    const vehicleQuery = `
      SELECT va.*, v.registration, v.capacity, v.accessibility_features
      FROM loom_vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      WHERE va.instance_id = $1
    `;
    
    const { rows: vehicleRows } = await pool.query(vehicleQuery, [instanceId]);
    instance.vehicle = vehicleRows.length > 0 ? vehicleRows[0] : null;
    
    return instance;
  } catch (error) {
    logger.error(`Error fetching details for instance ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Gets staff assignments for a loom instance
 * @param {number} instanceId - The loom_instance ID
 * @returns {Promise<Array>} Staff assignments
 */
async function getStaffAssignmentsForInstance(instanceId) {
  try {
    const query = `
      SELECT sa.*, s.name as staff_name, s.qualifications
      FROM loom_staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.instance_id = $1
    `;
    
    const { rows } = await pool.query(query, [instanceId]);
    return rows;
  } catch (error) {
    logger.error(`Error fetching staff assignments for instance ${instanceId}:`, error);
    throw error;
  }
}

/**
 * Stores card mappings in the database
 * @param {Array} cards - Array of card objects
 * @returns {Promise<void>}
 */
async function storeCardMappings(cards) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing mappings for these instances
    const instanceIds = [...new Set(cards.map(card => card.instance_id))];
    await client.query(
      'DELETE FROM event_card_map WHERE instance_id = ANY($1)',
      [instanceIds]
    );
    
    // Insert new mappings
    for (const card of cards) {
      await client.query(`
        INSERT INTO event_card_map (
          card_id, instance_id, card_type, title, 
          start_time, end_time, location, location_coordinates,
          notes, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        card.card_id,
        card.instance_id,
        card.card_type,
        card.title,
        card.start_time,
        card.end_time,
        card.location,
        card.location_coordinates,
        card.notes,
        JSON.stringify({
          participants: card.participants?.map(p => p.id) || [],
          staff: Array.isArray(card.staff) 
            ? card.staff.map(s => s.id) 
            : (card.staff?.id ? [card.staff.id] : []),
          vehicle: card.vehicle?.id || null,
          quality_flag: card.quality_flag || false,
          override_status: card.override_status || 'NONE'
        })
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error storing card mappings:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Enriches card data with additional information
 * @param {Array} cards - Raw card data from database
 * @returns {Promise<Array>} Enriched card objects
 */
async function enrichCardData(cards) {
  try {
    // Group cards by instance for batch processing
    const instanceIds = [...new Set(cards.map(card => card.instance_id))];
    
    // Get all participants for these instances
    const participantsQuery = `
      SELECT pa.instance_id, pa.participant_id, p.name, p.special_needs
      FROM loom_participant_attendance pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = ANY($1)
    `;
    
    const { rows: allParticipants } = await pool.query(participantsQuery, [instanceIds]);
    
    // Group participants by instance
    const participantsByInstance = {};
    allParticipants.forEach(p => {
      if (!participantsByInstance[p.instance_id]) {
        participantsByInstance[p.instance_id] = [];
      }
      participantsByInstance[p.instance_id].push(p);
    });
    
    // Get all staff for these instances
    const staffQuery = `
      SELECT sa.instance_id, sa.staff_id, s.name, sa.assignment_type, sa.role
      FROM loom_staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.instance_id = ANY($1)
    `;
    
    const { rows: allStaff } = await pool.query(staffQuery, [instanceIds]);
    
    // Group staff by instance
    const staffByInstance = {};
    allStaff.forEach(s => {
      if (!staffByInstance[s.instance_id]) {
        staffByInstance[s.instance_id] = [];
      }
      staffByInstance[s.instance_id].push(s);
    });
    
    // Get all vehicles for these instances
    const vehicleQuery = `
      SELECT va.instance_id, va.vehicle_id, v.registration, v.capacity
      FROM loom_vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      WHERE va.instance_id = ANY($1)
    `;
    
    const { rows: allVehicles } = await pool.query(vehicleQuery, [instanceIds]);
    
    // Group vehicles by instance
    const vehiclesByInstance = {};
    allVehicles.forEach(v => {
      vehiclesByInstance[v.instance_id] = v;
    });
    
    // Enrich each card with its related data
    return cards.map(card => {
      const metadata = card.metadata || {};
      
      // Add participants
      card.participants = participantsByInstance[card.instance_id] || [];
      
      // Add appropriate staff based on card type
      if (card.card_type === CARD_TYPES.BUS_PICKUP) {
        card.staff = (staffByInstance[card.instance_id] || [])
          .filter(s => s.assignment_type === 'PICKUP');
      } else if (card.card_type === CARD_TYPES.ACTIVITY) {
        card.staff = (staffByInstance[card.instance_id] || [])
          .filter(s => s.assignment_type === 'ACTIVITY');
      } else if (card.card_type === CARD_TYPES.BUS_DROPOFF) {
        card.staff = (staffByInstance[card.instance_id] || [])
          .filter(s => s.assignment_type === 'DROPOFF');
      } else if (card.card_type === CARD_TYPES.ROSTER) {
        // For roster cards, find the specific staff member
        const staffId = metadata.staff?.[0];
        card.staff = (staffByInstance[card.instance_id] || [])
          .find(s => s.staff_id === staffId) || null;
      }
      
      // Add vehicle if applicable
      if ([CARD_TYPES.BUS_PICKUP, CARD_TYPES.BUS_DROPOFF].includes(card.card_type) || 
          (card.card_type === CARD_TYPES.ROSTER && metadata.vehicle)) {
        card.vehicle = vehiclesByInstance[card.instance_id] || null;
      } else {
        card.vehicle = null;
      }
      
      return card;
    });
  } catch (error) {
    logger.error('Error enriching card data:', error);
    throw error;
  }
}

/**
 * Regenerates all cards for instances that have changed
 * @returns {Promise<number>} Number of cards regenerated
 */
async function regenerateAllCards() {
  try {
    // Get all instances that need card regeneration
    const query = `
      SELECT id FROM loom_instances 
      WHERE needs_card_regeneration = true
      ORDER BY date
    `;
    
    const { rows } = await pool.query(query);
    const instanceIds = rows.map(row => row.id);
    
    if (instanceIds.length === 0) {
      return 0;
    }
    
    // Generate cards for all these instances
    await batchGenerateCards(instanceIds);
    
    // Mark instances as processed
    await pool.query(`
      UPDATE loom_instances
      SET needs_card_regeneration = false
      WHERE id = ANY($1)
    `, [instanceIds]);
    
    return instanceIds.length;
  } catch (error) {
    logger.error('Error regenerating cards:', error);
    throw error;
  }
}

module.exports = {
  CARD_TYPES,
  generateCardsForInstance,
  batchGenerateCards,
  getCardsByDateRange,
  getCardsByParticipant,
  getCardsByStaff,
  regenerateAllCards
};
