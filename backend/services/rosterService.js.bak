// backend/services/rosterService.js
const { getDbConnection } = require('../database');

/**
 * Get roster and route sheet data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Roster data organized by program instance
 */
const getRoster = async (date) => {
  let db;
  try {
    db = await getDbConnection();

    // Step 1: Get all program instances for the date
    const programInstances = await getProgramInstancesByDate(db, date);
    
    // Step 2: For each program instance, get the detailed data
    const result = [];
    
    for (const instance of programInstances) {
      // Get participants for this program instance
      const participants = await getParticipantsForProgramInstance(db, instance.id);
      
      // Get staff assignments for this program instance
      const staff = await getStaffForProgramInstance(db, instance.id);
      
      // Get vehicle assignments for this program instance
      const vehicles = await getVehiclesWithRoutesForProgramInstance(db, instance.id);
      
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
    
    return {
      date,
      programInstances: result,
      rosterByTimeSlot
    };
  } finally {
    if (db) db.close();
  }
};

/**
 * Get all program instances for a specific date
 * @param {sqlite3.Database} db - The database connection object
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of program instances
 */
const getProgramInstancesByDate = (db, date) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        pi.id,
        pi.program_id,
        pi.date,
        pi.start_time,
        pi.end_time,
        pi.activity_description,
        pi.notes,
        p.name AS program_name,
        p.description AS program_description,
        p.day_of_week,
        p.is_weekend,
        p.is_centre_based,
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.suburb AS venue_suburb,
        v.state AS venue_state,
        v.postcode AS venue_postcode,
        v.is_main_centre AS venue_is_main_centre,
        COUNT(DISTINCT a.id) AS total_attendees,
        COUNT(DISTINCT sa.id) AS total_staff,
        COUNT(DISTINCT va.id) AS total_vehicles
      FROM program_instances pi
      JOIN programs p ON pi.program_id = p.id
      JOIN venues v ON pi.venue_id = v.id
      LEFT JOIN attendance a ON pi.id = a.program_instance_id AND a.status = 'confirmed'
      LEFT JOIN staff_assignments sa ON pi.id = sa.program_instance_id
      LEFT JOIN vehicle_assignments va ON pi.id = va.program_instance_id
      WHERE pi.date = ?
      GROUP BY pi.id
      ORDER BY pi.start_time
    `;
    
    db.all(query, [date], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/**
 * Get participants for a program instance with their attendance status
 * @param {sqlite3.Database} db - The database connection object
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of participants with attendance details
 */
const getParticipantsForProgramInstance = (db, programInstanceId) => {
  return new Promise((resolve, reject) => {
    const query = `
      WITH instance_date AS (
        SELECT pi.id       AS program_instance_id,
               pi.date     AS the_date,
               pi.program_id
        FROM   program_instances pi
        WHERE  pi.id = ?
      ),
      base_enroll AS (
        SELECT p.id, p.first_name, p.last_name, p.address, p.suburb, p.state, p.postcode, p.is_plan_managed,
               COALESCE(a.status,'confirmed') AS status,
               COALESCE(a.pickup_required,0) AS pickup_required,
               COALESCE(a.dropoff_required,0) AS dropoff_required,
               COALESCE(a.notes,'') AS notes
        FROM   program_enrollments pe
        JOIN   instance_date idt ON idt.program_id = pe.program_id
        JOIN   participants p ON p.id = pe.participant_id
        LEFT   JOIN attendance a ON a.participant_id = p.id AND a.program_instance_id = idt.program_instance_id
        WHERE  pe.start_date <= idt.the_date
          AND (pe.end_date IS NULL OR pe.end_date >= idt.the_date)
      ),
      adds AS (
        SELECT p.id, p.first_name, p.last_name, p.address, p.suburb, p.state, p.postcode, p.is_plan_managed,
               'confirmed' AS status, 0 AS pickup_required, 0 AS dropoff_required, '' AS notes
        FROM   pending_enrollment_changes pec
        JOIN   instance_date idt ON idt.program_id = pec.program_id
        JOIN   participants p ON p.id = pec.participant_id
        WHERE  pec.action = 'add' AND pec.effective_date <= idt.the_date
      ),
      removed AS (
        SELECT pec.participant_id
        FROM   pending_enrollment_changes pec
        JOIN   instance_date idt ON idt.program_id = pec.program_id
        WHERE  pec.action = 'remove' AND pec.effective_date <= idt.the_date
      )
      SELECT * FROM (
        SELECT * FROM base_enroll
        UNION
        SELECT * FROM adds
      )
      WHERE id NOT IN (SELECT participant_id FROM removed)
      ORDER BY last_name, first_name
    `;
    
    db.all(query, [programInstanceId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/**
 * Get staff assignments for a program instance
 * @param {sqlite3.Database} db - The database connection object
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of staff with their roles
 */
const getStaffForProgramInstance = (db, programInstanceId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        s.id, s.first_name, s.last_name, sa.role, sa.notes
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.program_instance_id = ?
      ORDER BY sa.role, s.last_name, s.first_name
    `;
    
    db.all(query, [programInstanceId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/**
 * Get vehicles with detailed route information for a program instance
 * @param {sqlite3.Database} db - The database connection object
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of vehicles with route details
 */
const getVehiclesWithRoutesForProgramInstance = async (db, programInstanceId) => {
  // Get vehicle assignments
  const vehicleAssignments = await new Promise((resolve, reject) => {
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
    
    db.all(query, [programInstanceId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
  
  // For each vehicle assignment, get the detailed routes with stops
  for (const vehicle of vehicleAssignments) {
    vehicle.pickup_route = await getDetailedRouteForVehicleAssignment(db, vehicle.vehicle_assignment_id, 'pickup');
    vehicle.dropoff_route = await getDetailedRouteForVehicleAssignment(db, vehicle.vehicle_assignment_id, 'dropoff');
    
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
 * @param {sqlite3.Database} db - The database connection object
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - Route type ('pickup' or 'dropoff')
 * @returns {Promise<Object>} Route object with detailed stops
 */
const getDetailedRouteForVehicleAssignment = async (db, vehicleAssignmentId, routeType) => {
  // Get route
  const routes = await new Promise((resolve, reject) => {
    const query = `
      SELECT r.id, r.estimated_duration, r.estimated_distance
      FROM routes r
      WHERE r.vehicle_assignment_id = ? AND r.route_type = ?
    `;
    
    db.all(query, [vehicleAssignmentId, routeType], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
  
  if (routes.length === 0) return null;
  
  const route = routes[0];
  
  // Get stops for this route
  const stops = await new Promise((resolve, reject) => {
    const query = `
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
    
    db.all(query, [route.id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
  
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
