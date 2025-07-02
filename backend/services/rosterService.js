// backend/services/rosterService.js
const db = require('../database');

/**
 * Get roster and route sheet data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Roster data organized by program instance
 */
const getRoster = async (date) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: Get all program instances for the date
      const programInstances = await getProgramInstancesByDate(date);
      
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
      
      resolve({
        date,
        programInstances: result,
        rosterByTimeSlot
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get all program instances for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of program instances
 */
const getProgramInstancesByDate = (date) => {
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
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get participants for a program instance with their attendance status
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of participants with attendance details
 */
const getParticipantsForProgramInstance = (programInstanceId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.address,
        p.suburb,
        p.state,
        p.postcode,
        p.is_plan_managed,
        a.status,
        a.pickup_required,
        a.dropoff_required,
        a.notes,
        (
          SELECT rs.estimated_arrival_time 
          FROM route_stops rs
          JOIN routes r ON rs.route_id = r.id
          JOIN vehicle_assignments va ON r.vehicle_assignment_id = va.id
          WHERE r.route_type = 'pickup' AND rs.participant_id = p.id AND va.program_instance_id = a.program_instance_id
          LIMIT 1
        ) AS pickup_time,
        (
          SELECT rs.estimated_arrival_time 
          FROM route_stops rs
          JOIN routes r ON rs.route_id = r.id
          JOIN vehicle_assignments va ON r.vehicle_assignment_id = va.id
          WHERE r.route_type = 'dropoff' AND rs.participant_id = p.id AND va.program_instance_id = a.program_instance_id
          LIMIT 1
        ) AS dropoff_time
      FROM attendance a
      JOIN participants p ON a.participant_id = p.id
      WHERE a.program_instance_id = ?
      ORDER BY p.last_name, p.first_name
    `;
    
    db.all(query, [programInstanceId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get staff assignments for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of staff with their roles
 */
const getStaffForProgramInstance = (programInstanceId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        sa.role,
        sa.notes,
        (
          SELECT va.id
          FROM vehicle_assignments va
          WHERE va.driver_staff_id = s.id AND va.program_instance_id = sa.program_instance_id
          LIMIT 1
        ) AS driving_vehicle_assignment_id,
        (
          SELECT v.id
          FROM vehicles v
          JOIN vehicle_assignments va ON v.id = va.vehicle_id
          WHERE va.driver_staff_id = s.id AND va.program_instance_id = sa.program_instance_id
          LIMIT 1
        ) AS driving_vehicle_id,
        (
          SELECT v.description
          FROM vehicles v
          JOIN vehicle_assignments va ON v.id = va.vehicle_id
          WHERE va.driver_staff_id = s.id AND va.program_instance_id = sa.program_instance_id
          LIMIT 1
        ) AS driving_vehicle_description
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.program_instance_id = ?
      ORDER BY sa.role, s.last_name, s.first_name
    `;
    
    db.all(query, [programInstanceId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get vehicles with detailed route information for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of vehicles with route details
 */
const getVehiclesWithRoutesForProgramInstance = (programInstanceId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get vehicle assignments
      const vehicleAssignments = await new Promise((resolveVehicles, rejectVehicles) => {
        const query = `
          SELECT 
            va.id AS vehicle_assignment_id,
            v.id,
            v.description,
            v.seats,
            v.registration,
            s.id AS driver_id,
            s.first_name AS driver_first_name,
            s.last_name AS driver_last_name,
            va.notes
          FROM vehicle_assignments va
          JOIN vehicles v ON va.vehicle_id = v.id
          LEFT JOIN staff s ON va.driver_staff_id = s.id
          WHERE va.program_instance_id = ?
        `;
        
        db.all(query, [programInstanceId], (err, rows) => {
          if (err) {
            rejectVehicles(err);
            return;
          }
          resolveVehicles(rows);
        });
      });
      
      // For each vehicle assignment, get the detailed routes with stops
      for (const vehicle of vehicleAssignments) {
        // Get pickup route with stops
        const pickupRoute = await getDetailedRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'pickup');
        vehicle.pickup_route = pickupRoute;
        
        // Get dropoff route with stops
        const dropoffRoute = await getDetailedRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'dropoff');
        vehicle.dropoff_route = dropoffRoute;
        
        // Count participants for this vehicle
        vehicle.participant_count = 0;
        if (pickupRoute && pickupRoute.stops) {
          vehicle.participant_count = pickupRoute.stops.filter(stop => stop.participant_id).length;
        }
      }
      
      resolve(vehicleAssignments);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get detailed route information with stops for a vehicle assignment
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - Route type ('pickup' or 'dropoff')
 * @returns {Promise<Object>} Route object with detailed stops
 */
const getDetailedRouteForVehicleAssignment = (vehicleAssignmentId, routeType) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get route
      const routes = await new Promise((resolveRoute, rejectRoute) => {
        const query = `
          SELECT 
            r.id,
            r.estimated_duration,
            r.estimated_distance
          FROM routes r
          WHERE r.vehicle_assignment_id = ? AND r.route_type = ?
        `;
        
        db.all(query, [vehicleAssignmentId, routeType], (err, rows) => {
          if (err) {
            rejectRoute(err);
            return;
          }
          resolveRoute(rows);
        });
      });
      
      if (routes.length === 0) {
        resolve(null);
        return;
      }
      
      const route = routes[0];
      
      // Get stops for this route with detailed information
      const stops = await new Promise((resolveStops, rejectStops) => {
        const query = `
          SELECT 
            rs.id,
            rs.stop_order,
            rs.participant_id,
            rs.venue_id,
            rs.address,
            rs.suburb,
            rs.state,
            rs.postcode,
            rs.estimated_arrival_time,
            rs.notes,
            p.first_name AS participant_first_name,
            p.last_name AS participant_last_name,
            v.name AS venue_name,
            (
              SELECT a.status
              FROM attendance a
              JOIN vehicle_assignments va ON va.program_instance_id = a.program_instance_id
              JOIN routes r ON r.vehicle_assignment_id = va.id
              WHERE a.participant_id = rs.participant_id AND r.id = rs.route_id
              LIMIT 1
            ) AS attendance_status
          FROM route_stops rs
          LEFT JOIN participants p ON rs.participant_id = p.id
          LEFT JOIN venues v ON rs.venue_id = v.id
          WHERE rs.route_id = ?
          ORDER BY rs.stop_order
        `;
        
        db.all(query, [route.id], (err, rows) => {
          if (err) {
            rejectStops(err);
            return;
          }
          resolveStops(rows);
        });
      });
      
      route.stops = stops;
      
      // Calculate total distance and duration
      route.total_distance = route.estimated_distance || 0;
      route.total_duration = route.estimated_duration || 0;
      
      resolve(route);
    } catch (error) {
      reject(error);
    }
  });
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
