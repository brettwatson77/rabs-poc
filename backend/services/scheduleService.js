// backend/services/scheduleService.js
const db = require('../database');

/**
 * Get schedule for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of program instances with related data
 */
const getSchedule = async (startDate, endDate) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Step 1: Get all program instances in the date range
      const programInstances = await getProgramInstances(startDate, endDate);
      
      // Step 2: For each program instance, get the participants, staff, and vehicles
      const result = [];
      
      for (const instance of programInstances) {
        // Get participants for this program instance
        const participants = await getParticipantsForProgramInstance(instance.id);
        
        // Get staff assignments for this program instance
        const staff = await getStaffForProgramInstance(instance.id);
        
        // Get vehicle assignments for this program instance
        const vehicles = await getVehiclesForProgramInstance(instance.id);
        
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
      
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get all program instances in a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of program instances
 */
const getProgramInstances = (startDate, endDate) => {
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
      WHERE pi.date BETWEEN ? AND ?
      GROUP BY pi.id
      ORDER BY pi.date, pi.start_time
    `;
    
    db.all(query, [startDate, endDate], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get participants for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of participants
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
        a.notes
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
 * Get staff for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of staff
 */
const getStaffForProgramInstance = (programInstanceId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        sa.role,
        sa.notes
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
 * Get vehicles for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of vehicles with routes
 */
const getVehiclesForProgramInstance = (programInstanceId) => {
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
      
      // For each vehicle assignment, get the routes
      for (const vehicle of vehicleAssignments) {
        // Get pickup route
        const pickupRoute = await getRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'pickup');
        vehicle.pickup_route = pickupRoute;
        
        // Get dropoff route
        const dropoffRoute = await getRouteForVehicleAssignment(vehicle.vehicle_assignment_id, 'dropoff');
        vehicle.dropoff_route = dropoffRoute;
      }
      
      resolve(vehicleAssignments);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get route for a vehicle assignment
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - Route type ('pickup' or 'dropoff')
 * @returns {Promise<Object>} Route object with stops
 */
const getRouteForVehicleAssignment = (vehicleAssignmentId, routeType) => {
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
      
      // Get stops for this route
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
            v.name AS venue_name
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
      resolve(route);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  getSchedule
};
