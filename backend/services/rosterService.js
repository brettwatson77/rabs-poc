// backend/services/rosterService.js
/**
 * Roster Service
 * ---------------
 * Legacy implementation used a hand-rolled SQLite wrapper (`db.all`). The updated
 * PostgreSQL architecture relies on the shared connection‐pool exported from
 * `backend/database.js`.  All helper functions have been converted to use
 * `pool.query` (which returns a Promise that resolves to `{ rows }`).
 */

const { pool } = require('../database'); // PostgreSQL pool

/**
 * Get roster and route sheet data for a specific date
 * @param {Object} params - { date } OR { startDate, endDate }
 * @returns {Promise<Object>} Roster data organized by program instance
 */
const getRoster = async (params) => {
  try {
    // ------------------------------------------------------------------
    // Parameter handling – support single date or date range
    // ------------------------------------------------------------------
    const { date, startDate, endDate } = params || {};

    let dateCondition = '';
    if (date) {
      // single day
      dateCondition = `AND li.instance_date = '${date}'`;
    } else if (startDate && endDate) {
      // date range
      dateCondition = `AND li.instance_date BETWEEN '${startDate}' AND '${endDate}'`;
    } else {
      throw new Error(
        'Invalid parameters supplied to getRoster – provide `date` or both `startDate` and `endDate`'
      );
    }

    // Step 1: Get all program instances within the requested window
    const programInstances = await getProgramInstancesByDate(dateCondition);
    
    // Step 2: For each program instance, get the detailed data
    const result = [];
    
    for (const instance of programInstances) {
      // Get participants for this program instance
      const participants = await getParticipantsForProgramInstance(instance.id);
      
      // Get staff assignments for this program instance
      const staff = await getStaffForProgramInstance(instance.id);
      
      // Get vehicle assignments for this program instance
      const vehicles = await getVehiclesWithRoutesForProgramInstance(instance.id);
      
      // Calculate staffing status based on participant count and assigned staff
      const requiredStaffCount = Math.ceil(participants.length / 4);
      const staffingStatus = staff.length >= requiredStaffCount ? 'adequate' : 'understaffed';
      
      // Add to result
      result.push({
        ...instance,
        participants,
        staff,
        vehicles,
        requiredStaffCount,
        staffingStatus
      });
    }
    
    // Step 3: Organize the data by time slot for easier rendering
    const rosterByTimeSlot = organizeByTimeSlot(result);
    
    const payload = {
      programInstances: result,
      rosterByTimeSlot
    };

    if (date) {
      payload.date = date;
    } else {
      payload.startDate = startDate;
      payload.endDate = endDate;
    }

    return payload;
  } finally {
    // PostgreSQL pool connections are automatically managed; no manual close needed
  }
};

/**
 * Get all program instances for a specific date
 * @param {string} dateCondition - SQL-safe date condition (e.g., "AND pi.date = '2025-08-02'")
 * @returns {Promise<Array>} Array of program instances
 */
const getProgramInstancesByDate = async (dateCondition) => {
  const query = `
      SELECT 
        li.id,
        li.program_id,
        li.instance_date   AS date,
        li.start_time,
        li.end_time,
        li.status,
        li.notes,
        p.name             AS program_name,
        p.description      AS program_description,
        v.id               AS venue_id,
        v.name             AS venue_name,
        v.address          AS venue_address,
        v.suburb           AS venue_suburb,
        v.state            AS venue_state,
        v.postcode         AS venue_postcode
      FROM tgl_loom_instances li
      JOIN programs p      ON li.program_id = p.id
      LEFT JOIN venues v   ON li.venue_id  = v.id
      WHERE 1=1
      ${dateCondition}
      ORDER BY li.start_time
    `;

  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Get participants for a program instance with their attendance status
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of participants with attendance details
 */
const getParticipantsForProgramInstance = async (programInstanceId) => {
  // TODO: replace with real allocation query once loom participant
  // allocation tables are stabilised.
  return [];
};

/**
 * Get staff assignments for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of staff with their roles
 */
const getStaffForProgramInstance = async (programInstanceId) => {
  // TODO: hook into tgl_loom_staff_shifts once implemented
  return [];
};

/**
 * Get vehicles with detailed route information for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of vehicles with route details
 */
const getVehiclesWithRoutesForProgramInstance = async (programInstanceId) => {
  // Get vehicle assignments
  const query = `
      SELECT 
        va.id AS vehicle_assignment_id,
        v.id, v.description, v.seats, v.registration,
        s.id AS driver_id, s.first_name AS driver_first_name, s.last_name AS driver_last_name,
        va.notes
      FROM vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      LEFT JOIN staff s ON va.driver_staff_id = s.id
      WHERE va.program_instance_id = ?
    `;

  const { rows: vehicleAssignments } = await pool.query(query, [programInstanceId]);
  
  // For each vehicle assignment, get the detailed routes with stops
  for (const vehicle of vehicleAssignments) {
    vehicle.pickup_route = await getDetailedRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'pickup');
    vehicle.dropoff_route = await getDetailedRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'dropoff');
    
    // Count participants for this vehicle
    vehicle.participant_count = 0;
    if (vehicle.pickup_route && vehicle.pickup_route.stops) {
      vehicle.participant_count = vehicle.pickup_route.stops.filter(stop => stop.participant_id).length;
    }
  }
  
  return vehicleAssignments;
};

/**
 * Get detailed route information with stops for a vehicle assignment
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - Route type ('pickup' or 'dropoff')
 * @returns {Promise<Object>} Route object with detailed stops
 */
const getDetailedRouteForVehicleAssignment = async (vehicleAssignmentId, routeType) => {
  // Get route
  const queryRoute = `
      SELECT r.id, r.estimated_duration, r.estimated_distance
      FROM routes r
      WHERE r.vehicle_assignment_id = ? AND r.route_type = ?
    `;

  const { rows: routes } = await pool.query(queryRoute, [vehicleAssignmentId, routeType]);
  
  if (routes.length === 0) return null;
  
  const route = routes[0];
  
  // Get stops for this route
  const queryStops = `
      SELECT 
        rs.id, rs.stop_order, rs.participant_id, rs.venue_id, rs.address,
        rs.suburb, rs.state, rs.postcode, rs.estimated_arrival_time, rs.notes,
        p.first_name AS participant_first_name, p.last_name AS participant_last_name,
        v.name AS venue_name
      FROM route_stops rs
      LEFT JOIN participants p ON rs.participant_id = p.id
      LEFT JOIN venues v ON rs.venue_id = v.id
      WHERE rs.route_id = ?
      ORDER BY rs.stop_order
    `;

  const { rows: stops } = await pool.query(queryStops, [route.id]);
  
  route.stops = stops;
  return route;
};

/**
 * Organize program instances by time slot for easier rendering
 * @param {Array} programInstances - Array of program instances with detailed data
 * @returns {Object} Program instances organized by time slot
 */
const organizeByTimeSlot = (programInstances) => {
  const timeSlots = {};
  
  programInstances.forEach(instance => {
    const startTime = instance.start_time;
    
    if (!timeSlots[startTime]) {
      timeSlots[startTime] = [];
    }
    
    timeSlots[startTime].push(instance);
  });
  
  return timeSlots;
};

module.exports = {
  getRoster
};
