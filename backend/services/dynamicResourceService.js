// backend/services/dynamicResourceService.js

// ---------------------------------------------------------------------------
// Load environment variables so downstream helpers can access keys such as
// GOOGLE_MAPS_API_KEY, OPENAI_API_KEY, etc., without relying on server.js to
// have executed in the same process.
// ---------------------------------------------------------------------------
require('dotenv').config();

const { getDbConnection } = require('../database');
const axios = require('axios');
const { formatDateForApi } = require('../utils/dateUtils');

// Base location for all routes (depot)
const BASE_LOCATION = {
  address: '56-62 Whitford Road, Hinchinbrook NSW 2168 Australia',
  latitude: -33.8916, // Approximate coordinates
  longitude: 150.8651,
};

/**
 * Calculate required resources based on participant count
 * @param {Array} participants - Array of participant objects
 * @returns {Object} Object containing required staff and vehicles
 */
const calculateRequiredResources = (participants) => {
  const participantCount = participants.length;
  
  // Staff calculation: 1 staff per 4 participants (rounded up)
  const requiredStaff = Math.ceil(participantCount / 4);
  
  // Vehicle calculation: prefer 5 participants per vehicle for efficiency
  // but respect maximum capacity of 9 participants + 1 staff per vehicle
  const preferredVehicleCount = Math.ceil(participantCount / 5);
  const minimumVehicleCount = Math.ceil(participantCount / 9);
  
  // Use the preferred count unless it's less than the minimum required
  const requiredVehicles = Math.max(preferredVehicleCount, minimumVehicleCount);
  
  return {
    requiredStaff,
    requiredVehicles,
    staffParticipantRatio: '1:4',
    preferredParticipantsPerVehicle: 5,
    maxParticipantsPerVehicle: 9
  };
};

/**
 * Get all participants for a specific program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Array>} Array of participant objects with addresses
 */
const getParticipantsForInstance = async (programInstanceId) => {
  const db = await getDbConnection();
  
  try {
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.address,
        p.suburb,
        p.state,
        p.postcode,
        p.latitude,
        p.longitude,
        a.pickup_required,
        a.dropoff_required
      FROM participants p
      JOIN attendance a ON p.id = a.participant_id
      WHERE a.program_instance_id = ? 
      AND a.status != 'cancelled'
    `;
    
    const participants = await new Promise((resolve, reject) => {
      db.all(query, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return participants;
  } finally {
    db.close();
  }
};

/**
 * Get program instance details including venue
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Object>} Program instance details
 */
const getProgramInstanceDetails = async (programInstanceId) => {
  const db = await getDbConnection();
  
  try {
    const query = `
      SELECT 
        pi.id,
        pi.program_id,
        pi.date,
        pi.start_time,
        pi.end_time,
        p.name AS program_name,
        p.day_of_week,
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.suburb AS venue_suburb,
        v.state AS venue_state,
        v.postcode AS venue_postcode,
        v.latitude AS venue_latitude,
        v.longitude AS venue_longitude
      FROM program_instances pi
      JOIN programs p ON pi.program_id = p.id
      LEFT JOIN venues v ON pi.venue_id = v.id OR p.venue_id = v.id
      WHERE pi.id = ?
    `;
    
    const instance = await new Promise((resolve, reject) => {
      db.get(query, [programInstanceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    return instance;
  } finally {
    db.close();
  }
};

/**
 * Get staff who need hours most (prioritized by remaining contracted hours)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @param {number} dayOfWeek - Day of week (0-6, Sunday is 0)
 * @returns {Promise<Array>} Array of available staff sorted by who needs hours most
 */
const getAvailableStaffByHoursNeeded = async (date, startTime, endTime, dayOfWeek) => {
  const db = await getDbConnection();
  
  try {
    // Get current fortnight dates for hours calculation
    const today = new Date();
    const startOfFortnight = new Date(today);
    startOfFortnight.setDate(today.getDate() - (today.getDay() + 7) % 14);
    const endOfFortnight = new Date(startOfFortnight);
    endOfFortnight.setDate(startOfFortnight.getDate() + 13);
    
    const fortnightStartStr = formatDateForApi(startOfFortnight);
    const fortnightEndStr = formatDateForApi(endOfFortnight);
    
    // Get all staff with their availability and current allocated hours
    const query = `
      WITH staff_hours AS (
        SELECT 
          s.id AS staff_id,
          COALESCE(SUM(
            (JULIANDAY(pi.end_time) - JULIANDAY(pi.start_time)) * 24
          ), 0) AS allocated_hours
        FROM staff s
        LEFT JOIN staff_assignments sa ON s.id = sa.staff_id
        LEFT JOIN program_instances pi ON sa.program_instance_id = pi.id
        WHERE pi.date BETWEEN ? AND ?
        GROUP BY s.id
      )
      SELECT 
        s.id,
        s.first_name,
        s.last_name,
        s.contracted_hours,
        COALESCE(sh.allocated_hours, 0) AS allocated_hours,
        s.contracted_hours - COALESCE(sh.allocated_hours, 0) AS remaining_hours,
        EXISTS (
          SELECT 1 FROM staff_availability sa 
          WHERE sa.staff_id = s.id 
          AND sa.day_of_week = ?
          AND sa.start_time <= ?
          AND sa.end_time >= ?
        ) AS is_available
      FROM staff s
      LEFT JOIN staff_hours sh ON s.id = sh.staff_id
      WHERE EXISTS (
        SELECT 1 FROM staff_availability sa 
        WHERE sa.staff_id = s.id 
        AND sa.day_of_week = ?
        AND sa.start_time <= ?
        AND sa.end_time >= ?
      )
      ORDER BY remaining_hours DESC, allocated_hours ASC
    `;
    
    const staff = await new Promise((resolve, reject) => {
      db.all(query, [
        fortnightStartStr, 
        fortnightEndStr, 
        dayOfWeek, 
        startTime, 
        endTime,
        dayOfWeek,
        startTime,
        endTime
      ], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return staff;
  } finally {
    db.close();
  }
};

    const analysisLogs = []; // collect terminal log lines
/**
 * Get available vehicles for a specific time slot
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH:MM format
        const routeRes = await calculateOptimalRoute(
          BASE_LOCATION,
          group.participants,
          instance,
        );

        // collect analysis log
        if (routeRes.analysisLog && routeRes.analysisLog.length) {
          analysisLogs.push(...routeRes.analysisLog);
        }

        const { bestRoute } = routeRes;
        const routeId = await saveRoute(
          group.vehicleAssignmentId,
          'pickup',
          bestRoute,
        );
        pickupRoutes.push({ ...bestRoute, routeId, vehicleId: group.vehicleId });
const getAvailableVehicles = async (date, startTime, endTime) => {
  const db = await getDbConnection();
  
  try {
    const query = `
      SELECT 
        v.id,
        v.description,
        v.seats,
        v.registration
      FROM vehicles v
      WHERE NOT EXISTS (
        SELECT 1 
        FROM vehicle_assignments va
        JOIN program_instances pi ON va.program_instance_id = pi.id
        WHERE va.vehicle_id = v.id
        AND pi.date = ?
        AND (
          (pi.start_time <= ? AND pi.end_time > ?) OR
          (pi.start_time < ? AND pi.end_time >= ?) OR
          (pi.start_time >= ? AND pi.end_time <= ?)
        )
      )
    `;
    
    const vehicles = await new Promise((resolve, reject) => {
      db.all(query, [
        date, 
        startTime, endTime,  // Case 1: Program starts before our start and ends during our slot
        startTime, startTime, // Case 2: Program starts during our slot
        startTime, endTime    // Case 3: Program is entirely within our slot
      ], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return vehicles;
  } finally {
    db.close();
  }
};

/**
 * Allocate staff to a program instance based on required count
 * @param {number} programInstanceId - Program instance ID
 * @param {number} requiredCount - Number of staff required
 * @returns {Promise<Array>} Array of allocated staff
 */
const allocateStaff = async (programInstanceId, requiredCount) => {
  const db = await getDbConnection();
  
  try {
    // Get program instance details
    const instance = await getProgramInstanceDetails(programInstanceId);
    if (!instance) {
      throw new Error(`Program instance ${programInstanceId} not found`);
    }
    
    // Get currently assigned staff
    const currentStaffQuery = `
      SELECT staff_id, role
      FROM staff_assignments
      WHERE program_instance_id = ?
    `;
    
    const currentStaff = await new Promise((resolve, reject) => {
      db.all(currentStaffQuery, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const currentCount = currentStaff.length;
    
    // If we already have enough staff, return the current assignments
    if (currentCount >= requiredCount) {
      return currentStaff;
    }
    
    // Get available staff prioritized by who needs hours most
    const availableStaff = await getAvailableStaffByHoursNeeded(
      instance.date,
      instance.start_time,
      instance.end_time,
      instance.day_of_week
    );
    
    // Filter out staff who are already assigned
    const currentStaffIds = currentStaff.map(s => s.staff_id);
    const unassignedStaff = availableStaff.filter(s => !currentStaffIds.includes(s.id));
    
    // Determine how many additional staff we need
    const additionalNeeded = requiredCount - currentCount;
    
    // Select the top N staff who need hours most
    const staffToAdd = unassignedStaff.slice(0, additionalNeeded);
    
    if (staffToAdd.length < additionalNeeded) {
      console.warn(`Warning: Only found ${staffToAdd.length} available staff, needed ${additionalNeeded}`);
    }
    
    // Begin transaction to add new staff assignments
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      // Assign first staff member as lead, rest as support
      for (let i = 0; i < staffToAdd.length; i++) {
        const staff = staffToAdd[i];
        const role = currentCount === 0 && i === 0 ? 'lead' : 'support';
        
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO staff_assignments (staff_id, program_instance_id, role) VALUES (?, ?, ?)',
            [staff.id, programInstanceId, role],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      }
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Return all staff assignments (existing + new)
      return [...currentStaff, ...staffToAdd.map(s => ({ staff_id: s.id, role: 'support' }))];
      
    } catch (error) {
      // Rollback on error
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } finally {
    db.close();
  }
};

/**
 * Allocate vehicles to a program instance based on participant needs
 * @param {number} programInstanceId - Program instance ID
 * @param {Array} participants - Array of participant objects
 * @returns {Promise<Array>} Array of allocated vehicles with assignments
 */
const allocateVehicles = async (programInstanceId, participants) => {
  const db = await getDbConnection();
  
  try {
    // Get program instance details
    const instance = await getProgramInstanceDetails(programInstanceId);
    if (!instance) {
      throw new Error(`Program instance ${programInstanceId} not found`);
    }
    
    // Get currently assigned vehicles
    const currentVehiclesQuery = `
      SELECT 
        va.id AS assignment_id,
        va.vehicle_id,
        va.driver_staff_id,
        v.seats,
        v.registration
      FROM vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      WHERE va.program_instance_id = ?
    `;
    
    const currentVehicles = await new Promise((resolve, reject) => {
      db.all(currentVehiclesQuery, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Filter participants who need pickup/dropoff
    const participantsNeedingTransport = participants.filter(
      p => p.pickup_required || p.dropoff_required
    );
    
    // Calculate required vehicles
    const { requiredVehicles } = calculateRequiredResources(participantsNeedingTransport);
    
    // If we already have enough vehicles, return the current assignments
    if (currentVehicles.length >= requiredVehicles) {
      return currentVehicles;
    }
    
    // Get available vehicles
    const availableVehicles = await getAvailableVehicles(
      instance.date,
      instance.start_time,
      instance.end_time
    );
    
    // Filter out vehicles that are already assigned
    const currentVehicleIds = currentVehicles.map(v => v.vehicle_id);
    const unassignedVehicles = availableVehicles.filter(v => !currentVehicleIds.includes(v.id));
    
    // Determine how many additional vehicles we need
    const additionalNeeded = requiredVehicles - currentVehicles.length;
    
    // Select the required number of vehicles
    const vehiclesToAdd = unassignedVehicles.slice(0, additionalNeeded);
    
    if (vehiclesToAdd.length < additionalNeeded) {
      console.warn(`Warning: Only found ${vehiclesToAdd.length} available vehicles, needed ${additionalNeeded}`);
    }
    
    // Get staff assignments to find potential drivers
    const staffQuery = `
      SELECT 
        sa.staff_id,
        s.first_name,
        s.last_name
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.program_instance_id = ?
      AND sa.role != 'lead'  -- Lead staff typically doesn't drive
    `;
    
    const availableDrivers = await new Promise((resolve, reject) => {
      db.all(staffQuery, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Begin transaction to add new vehicle assignments
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      const newAssignments = [];
      
      // Assign vehicles with drivers if available
      for (let i = 0; i < vehiclesToAdd.length; i++) {
        const vehicle = vehiclesToAdd[i];
        // Assign a driver if available, otherwise leave as null (will need manual assignment)
        const driver = availableDrivers[i] ? availableDrivers[i].staff_id : null;
        
        const assignmentId = await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO vehicle_assignments (vehicle_id, program_instance_id, driver_staff_id) VALUES (?, ?, ?)',
            [vehicle.id, programInstanceId, driver],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
        
        newAssignments.push({
          assignment_id: assignmentId,
          vehicle_id: vehicle.id,
          driver_staff_id: driver,
          seats: vehicle.seats,
          registration: vehicle.registration
        });
      }
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Return all vehicle assignments (existing + new)
      return [...currentVehicles, ...newAssignments];
      
    } catch (error) {
      // Rollback on error
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } finally {
    db.close();
  }
};

/**
 * Use Google Maps API to calculate optimal routes
 * @param {Object} origin - Origin location (base/depot)
 * @param {Array} destinations - Array of destination objects with addresses
 * @param {Object} venue - Venue location
 * @returns {Promise<Object>} Optimized route information
 */
const calculateOptimalRoute = async (origin, destinations, venue) => {
  try {
    // Check if Google Maps API key is available
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not found, using fallback routing');
      return calculateFallbackRoute(origin, destinations, venue);
    }
    
    // Format waypoints for Google Maps API
    const waypoints = destinations.map(d => 
      `${d.address}, ${d.suburb} ${d.state} ${d.postcode} Australia`
    );
    
    // Build the Google Maps Directions API URL
    const apiUrl = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
      origin: origin.address,
      destination: `${venue.address}, ${venue.suburb} ${venue.state} ${venue.postcode} Australia`,
      waypoints: `optimize:true|${waypoints.join('|')}`,
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // Make the API request
    const response = await axios.get(apiUrl, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }
    
    // Extract the optimized route information
    const route = response.data.routes[0];
    const optimizedWaypointOrder = route.waypoint_order;
    const legs = route.legs;
    
    // Calculate total duration and distance
    let totalDuration = 0;
    let totalDistance = 0;
    
    legs.forEach(leg => {
      totalDuration += leg.duration.value; // in seconds
      totalDistance += leg.distance.value; // in meters
    });
    
    // Format the optimized route
    const optimizedRoute = {
      totalDurationMinutes: Math.round(totalDuration / 60),
      totalDistanceKm: Math.round(totalDistance / 100) / 10, // convert to km with 1 decimal
      stops: []
    };
    
    // Add depot as first stop
    optimizedRoute.stops.push({
      type: 'depot',
      address: origin.address,
      estimatedArrivalTime: null // Will be calculated based on program start time
    });
    
    // Add participant stops in optimized order
    optimizedWaypointOrder.forEach((index, i) => {
      const participant = destinations[index];
      optimizedRoute.stops.push({
        type: 'participant',
        participantId: participant.id,
        name: `${participant.first_name} ${participant.last_name}`,
        address: `${participant.address}, ${participant.suburb} ${participant.state} ${participant.postcode}`,
        estimatedArrivalTime: null, // Will be calculated based on program start time
        legDurationMinutes: Math.round(legs[i + 1].duration.value / 60)
      });
    });
    
    // Add venue as last stop
    optimizedRoute.stops.push({
      type: 'venue',
      name: venue.venue_name,
      address: `${venue.venue_address}, ${venue.venue_suburb} ${venue.venue_state} ${venue.venue_postcode}`,
      estimatedArrivalTime: null // Will be calculated based on program start time
    });
    
    return optimizedRoute;
    
  } catch (error) {
    console.error('Error calculating optimal route:', error);
    // Fall back to simple routing if Google Maps fails
    return calculateFallbackRoute(origin, destinations, venue);
  }
};

/**
 * Fallback routing when Google Maps API is unavailable
 * Simple "as the crow flies" distance calculation
 * @param {Object} origin - Origin location
 * @param {Array} destinations - Array of destination objects
 * @param {Object} venue - Venue location
 * @returns {Object} Basic route information
 */
const calculateFallbackRoute = (origin, destinations, venue) => {
  // Calculate distances using Haversine formula (as the crow flies)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Sort destinations by distance from origin
  const sortedDestinations = [...destinations].sort((a, b) => {
    const distA = calculateDistance(
      origin.latitude, 
      origin.longitude, 
      a.latitude || 0, 
      a.longitude || 0
    );
    const distB = calculateDistance(
      origin.latitude, 
      origin.longitude, 
      b.latitude || 0, 
      b.longitude || 0
    );
    return distA - distB;
  });
  
  // Estimate total distance and duration
  let totalDistance = 0;
  let currentLat = origin.latitude;
  let currentLon = origin.longitude;
  
  // Add distance from origin to each stop
  sortedDestinations.forEach(dest => {
    const distance = calculateDistance(
      currentLat,
      currentLon,
      dest.latitude || 0,
      dest.longitude || 0
    );
    totalDistance += distance;
    currentLat = dest.latitude || 0;
    currentLon = dest.longitude || 0;
  });
  
  // Add distance to venue
  totalDistance += calculateDistance(
    currentLat,
    currentLon,
    venue.venue_latitude || 0,
    venue.venue_longitude || 0
  );
  
  // Estimate duration (assuming 30 km/h average speed)
  const totalDurationMinutes = Math.round((totalDistance / 30) * 60);
  
  // Format the route
  const route = {
    totalDurationMinutes,
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    stops: []
  };
  
  // Add depot as first stop
  route.stops.push({
    type: 'depot',
    address: origin.address,
    estimatedArrivalTime: null
  });
  
  // Add participant stops
  sortedDestinations.forEach(participant => {
    route.stops.push({
      type: 'participant',
      participantId: participant.id,
      name: `${participant.first_name} ${participant.last_name}`,
      address: `${participant.address}, ${participant.suburb} ${participant.state} ${participant.postcode}`,
      estimatedArrivalTime: null,
      legDurationMinutes: 5 // Rough estimate per stop
    });
  });
  
  // Add venue as last stop
  route.stops.push({
    type: 'venue',
    name: venue.venue_name,
    address: `${venue.venue_address}, ${venue.venue_suburb} ${venue.venue_state} ${venue.venue_postcode}`,
    estimatedArrivalTime: null
  });
  
  return route;
};

/**
 * Save route information to the database
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - 'pickup' or 'dropoff'
 * @param {Object} routeData - Route data from calculateOptimalRoute
 * @returns {Promise<number>} Route ID
 */
const saveRoute = async (vehicleAssignmentId, routeType, routeData) => {
  // ---------------------------------------------------------------------
  // Guard Clause: Ensure routeData is valid before touching its properties
  // ---------------------------------------------------------------------
  if (
    !routeData ||
    typeof routeData.totalDurationMinutes !== 'number' ||
    typeof routeData.totalDistanceKm !== 'number' ||
    !Array.isArray(routeData.stops)
  ) {
    throw new Error(
      `saveRoute() received invalid routeData for vehicleAssignmentId=${vehicleAssignmentId}, routeType=${routeType}`
    );
  }

  const db = await getDbConnection();
  
  try {
    // Begin transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      // Insert route record
      const routeId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO routes 
           (vehicle_assignment_id, route_type, estimated_duration, estimated_distance)
           VALUES (?, ?, ?, ?)`,
          [
            vehicleAssignmentId, 
            routeType, 
            routeData.totalDurationMinutes,
            routeData.totalDistanceKm
          ],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Insert route stops
      for (let i = 0; i < routeData.stops.length; i++) {
        const stop = routeData.stops[i];
        
        let participantId = null;
        let venueId = null;
        
        if (stop.type === 'participant') {
          participantId = stop.participantId;
        } else if (stop.type === 'venue') {
          // Look up venue ID from name
          if (stop.venueId) {
            venueId = stop.venueId;
          } else {
            const venueQuery = `SELECT id FROM venues WHERE name = ?`;
            const venue = await new Promise((resolve, reject) => {
              db.get(venueQuery, [stop.name], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });
            if (venue) {
              venueId = venue.id;
            }
          }
        }
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO route_stops
             (route_id, stop_order, participant_id, venue_id, address, suburb, state, postcode, estimated_arrival_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              routeId,
              i,
              participantId,
              venueId,
              stop.address.split(',')[0], // Extract street address
              stop.address.split(',')[1]?.trim() || '', // Extract suburb
              'NSW', // Default state
              stop.address.match(/\d{4}/) ? stop.address.match(/\d{4}/)[0] : '', // Extract postcode
              stop.estimatedArrivalTime
            ],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      }
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      return routeId;
      
    } catch (error) {
      // Rollback on error
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } finally {
    db.close();
  }
};

/**
 * Optimize pickup and dropoff routes for a program instance
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Object>} Object containing pickup and dropoff routes
 */
const optimizeRoutes = async (programInstanceId) => {
  try {
    // Get program instance details
    const instance = await getProgramInstanceDetails(programInstanceId);
    if (!instance) {
      throw new Error(`Program instance ${programInstanceId} not found`);
    }
    
    // Get participants who need transport
    const participants = await getParticipantsForInstance(programInstanceId);
    const participantsNeedingPickup = participants.filter(p => p.pickup_required);
    const participantsNeedingDropoff = participants.filter(p => p.dropoff_required);
    
    // Get vehicle assignments
    const db = await getDbConnection();
    const vehicleAssignments = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, vehicle_id, driver_staff_id FROM vehicle_assignments WHERE program_instance_id = ?`,
        [programInstanceId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    db.close();
    
    if (!vehicleAssignments.length) {
      throw new Error(`No vehicles assigned to program instance ${programInstanceId}`);
    }
    
    // Clear existing routes
    await clearExistingRoutes(vehicleAssignments.map(va => va.id));
    
    // Calculate optimal participant distribution per vehicle
    const pickupGroups = distributeParticipantsToVehicles(participantsNeedingPickup, vehicleAssignments);
    const dropoffGroups = distributeParticipantsToVehicles(participantsNeedingDropoff, vehicleAssignments);
    
    // Calculate and save pickup routes
    const pickupRoutes = [];
    for (let i = 0; i < pickupGroups.length; i++) {
      const group = pickupGroups[i];
      if (group.participants.length > 0) {
        const route = await calculateOptimalRoute(BASE_LOCATION, group.participants, instance);
        const routeId = await saveRoute(group.vehicleAssignmentId, 'pickup', route);
        pickupRoutes.push({ ...route, routeId, vehicleId: group.vehicleId });
      }
    }
    
    // Calculate and save dropoff routes
    const dropoffRoutes = [];
    for (let i = 0; i < dropoffGroups.length; i++) {
      const group = dropoffGroups[i];
      if (group.participants.length > 0) {
        // For dropoff, the origin is the venue and destination is the base
        const routeRes = await calculateOptimalRoute(
          { address: `${instance.venue_address}, ${instance.venue_suburb} ${instance.venue_state} ${instance.venue_postcode}` },
          group.participants,
          { venue_name: 'Depot', venue_address: BASE_LOCATION.address }
        );

        if (routeRes.analysisLog && routeRes.analysisLog.length) {
          analysisLogs.push(...routeRes.analysisLog);
        }

        const { bestRoute } = routeRes;
        const routeId = await saveRoute(
          group.vehicleAssignmentId,
          'dropoff',
          bestRoute,
        );
        dropoffRoutes.push({ ...bestRoute, routeId, vehicleId: group.vehicleId });
      }
    }
    
    return {
      pickupRoutes,
      dropoffRoutes,
      analysisLogs
    };
    
  } catch (error) {
    console.error('Error optimizing routes:', error);
    throw error;
  }
};

/**
 * Clear existing routes for vehicle assignments
 * @param {Array} vehicleAssignmentIds - Array of vehicle assignment IDs
 * @returns {Promise<void>}
 */
const clearExistingRoutes = async (vehicleAssignmentIds) => {
  if (!vehicleAssignmentIds.length) return;
  
  const db = await getDbConnection();
  
  try {
    // Begin transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      // First get all route IDs
      const placeholders = vehicleAssignmentIds.map(() => '?').join(',');
      const routeIds = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id FROM routes WHERE vehicle_assignment_id IN (${placeholders})`,
          vehicleAssignmentIds,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.id));
          }
        );
      });
      
      if (routeIds.length > 0) {
        // Delete route stops
        const stopPlaceholders = routeIds.map(() => '?').join(',');
        await new Promise((resolve, reject) => {
          db.run(
            `DELETE FROM route_stops WHERE route_id IN (${stopPlaceholders})`,
            routeIds,
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        // Delete routes
        await new Promise((resolve, reject) => {
          db.run(
            `DELETE FROM routes WHERE id IN (${stopPlaceholders})`,
            routeIds,
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
    } catch (error) {
      // Rollback on error
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } finally {
    db.close();
  }
};

/**
 * Distribute participants to vehicles optimally
 * @param {Array} participants - Array of participant objects
 * @param {Array} vehicleAssignments - Array of vehicle assignment objects
 * @returns {Array} Array of groups, each with vehicleAssignmentId and participants
 */
const distributeParticipantsToVehicles = (participants, vehicleAssignments) => {
  // If no participants or vehicles, return empty array
  if (!participants.length || !vehicleAssignments.length) {
    return [];
  }
  
  // Create a copy of participants to work with
  const remainingParticipants = [...participants];
  
  // Create groups for each vehicle
  const groups = vehicleAssignments.map(va => ({
    vehicleAssignmentId: va.id,
    vehicleId: va.vehicle_id,
    participants: []
  }));
  
  // Target 5 participants per vehicle for efficiency
  const targetPerVehicle = 5;
  
  // First pass: try to give each vehicle the target number
  for (let i = 0; i < groups.length && remainingParticipants.length > 0; i++) {
    const group = groups[i];
    const toAdd = Math.min(targetPerVehicle, remainingParticipants.length);
    
    for (let j = 0; j < toAdd; j++) {
      group.participants.push(remainingParticipants.shift());
    }
  }
  
  // Second pass: distribute any remaining participants
  let currentGroup = 0;
  while (remainingParticipants.length > 0) {
    groups[currentGroup].participants.push(remainingParticipants.shift());
    currentGroup = (currentGroup + 1) % groups.length;
  }
  
  return groups;
};

/**
 * Rebalance resources when participants change
 * @param {number} programInstanceId - Program instance ID
 * @returns {Promise<Object>} Updated resource allocation
 */
const rebalanceResources = async (programInstanceId) => {
  try {
    // Get participants for the program instance
    const participants = await getParticipantsForInstance(programInstanceId);
    
    // Calculate required resources
    const resources = calculateRequiredResources(participants);
    
    // Allocate staff based on requirements
    const staffAllocations = await allocateStaff(programInstanceId, resources.requiredStaff);
    
    // Allocate vehicles based on requirements
    const vehicleAllocations = await allocateVehicles(programInstanceId, participants);
    
    // Optimize routes
    const routes = await optimizeRoutes(programInstanceId);
    
    return {
      programInstanceId,
      participantCount: participants.length,
      requiredStaff: resources.requiredStaff,
      allocatedStaff: staffAllocations.length,
      requiredVehicles: resources.requiredVehicles,
      allocatedVehicles: vehicleAllocations.length,
      routes
    };
  } catch (error) {
    console.error('Error rebalancing resources:', error);
    throw error;
  }
};

/**
 * Handle participant change (add, cancel, leave)
 * @param {number} participantId - Participant ID
 * @param {number} programInstanceId - Program instance ID
 * @param {string} changeType - 'add', 'cancel', or 'leave'
 * @returns {Promise<Object>} Updated resource allocation
 */
const handleParticipantChange = async (participantId, programInstanceId, changeType) => {
  const db = await getDbConnection();
  
  try {
    // Begin transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    try {
      // Update attendance record based on change type
      if (changeType === 'add') {
        // Check if participant already has an attendance record
        const existingRecord = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id, status FROM attendance WHERE participant_id = ? AND program_instance_id = ?',
            [participantId, programInstanceId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        
        if (existingRecord) {
          // Update existing record if it's cancelled
          if (existingRecord.status === 'cancelled') {
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE attendance SET status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [existingRecord.id],
                err => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        } else {
          // Create new attendance record
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO attendance 
               (participant_id, program_instance_id, status, pickup_required, dropoff_required)
               VALUES (?, ?, "confirmed", 1, 1)`,
              [participantId, programInstanceId],
              err => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
      } else if (changeType === 'cancel') {
        // Update attendance to cancelled
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE attendance SET status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE participant_id = ? AND program_instance_id = ?',
            [participantId, programInstanceId],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else if (changeType === 'leave') {
        // Delete attendance record
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM attendance WHERE participant_id = ? AND program_instance_id = ?',
            [participantId, programInstanceId],
            err => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Rebalance resources
      return await rebalanceResources(programInstanceId);
      
    } catch (error) {
      // Rollback on error
      await new Promise(resolve => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
  } finally {
    db.close();
  }
};

module.exports = {
  calculateRequiredResources,
  allocateStaff,
  allocateVehicles,
  optimizeRoutes,
  rebalanceResources,
  handleParticipantChange,
  BASE_LOCATION
};
