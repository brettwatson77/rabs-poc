// backend/services/routeOptimizationService.js

// ---------------------------------------------------------------------------
// Load environment variables early so every helper below can access
// GOOGLE_MAPS_API_KEY (and friends) without relying on server.js to have
// executed first in the same process.
// ---------------------------------------------------------------------------
require('dotenv').config();

const axios = require('axios');
const { getDbConnection } = require('../database');

/**
 * Base depot location for all routes
 */
const DEPOT_LOCATION = {
  address: '56-62 Whitford Road, Hinchinbrook NSW 2168 Australia',
  latitude: -33.8916,
  longitude: 150.8651,
};

/**
 * Formats an address object into a string for Google Maps API
 * @param {Object} address - Address object with components
 * @returns {string} Formatted address string
 */
const formatAddressString = (address) => {
  if (typeof address === 'string') return address;
  
  return `${address.address || ''}, ${address.suburb || ''} ${address.state || 'NSW'} ${address.postcode || ''} Australia`.trim();
};

/**
 * Checks if Google Maps API is enabled and configured
 * @returns {Promise<boolean>} Whether Google Maps API is available
 */
const isGoogleMapsEnabled = async () => {
  // Check environment variable
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return false;
  }
  
  // Check database setting
  const db = await getDbConnection();
  try {
    const setting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = "google_maps_enabled"',
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return setting && setting.value === '1';
  } finally {
    db.close();
  }
};

/**
 * Geocode an address to get latitude and longitude
 * @param {string} address - Address to geocode
 * @returns {Promise<Object>} Geocoded result with lat/lng
 */
const geocodeAddress = async (address) => {
  try {
    // Check if Google Maps API is enabled
    if (!await isGoogleMapsEnabled()) {
      throw new Error('Google Maps API is not enabled');
    }
    
    const apiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const response = await axios.get(apiUrl, {
      params: {
        address: formatAddressString(address),
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }
    
    const location = response.data.results[0].geometry.location;
    const formattedAddress = response.data.results[0].formatted_address;
    
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};

/**
 * Update participant coordinates in the database
 * @param {number} participantId - Participant ID
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<void>}
 */
const updateParticipantCoordinates = async (participantId, latitude, longitude) => {
  const db = await getDbConnection();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE participants SET latitude = ?, longitude = ? WHERE id = ?',
        [latitude, longitude, participantId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  } finally {
    db.close();
  }
};

/**
 * Batch geocode participants without coordinates
 * @returns {Promise<number>} Number of participants geocoded
 */
const batchGeocodeParticipants = async () => {
  const db = await getDbConnection();
  
  try {
    // Find participants without coordinates
    const participants = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, address, suburb, state, postcode FROM participants WHERE latitude IS NULL OR longitude IS NULL',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    let geocodedCount = 0;
    
    // Geocode each participant (with rate limiting)
    for (const participant of participants) {
      try {
        const address = formatAddressString(participant);
        const geocoded = await geocodeAddress(address);
        
        await updateParticipantCoordinates(
          participant.id,
          geocoded.latitude,
          geocoded.longitude
        );
        
        geocodedCount++;
        
        // Rate limiting - Google has quotas
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to geocode participant ${participant.id}:`, error);
      }
    }
    
    return geocodedCount;
  } finally {
    db.close();
  }
};

/**
 * Calculate distance matrix between multiple origins and destinations
 * @param {Array} origins - Array of origin addresses or coordinates
 * @param {Array} destinations - Array of destination addresses or coordinates
 * @param {Object} options - Options for the calculation
 * @returns {Promise<Object>} Distance matrix results
 */
const calculateDistanceMatrix = async (origins, destinations, options = {}) => {
  try {
    // Check if Google Maps API is enabled
    if (!await isGoogleMapsEnabled()) {
      throw new Error('Google Maps API is not enabled');
    }
    
    // Format origins and destinations
    const formattedOrigins = origins.map(formatAddressString);
    const formattedDestinations = destinations.map(formatAddressString);
    
    // Build API parameters
    const params = {
      origins: formattedOrigins.join('|'),
      destinations: formattedDestinations.join('|'),
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // Add optional parameters
    if (options.departureTime) {
      // Can be 'now' or a timestamp in seconds
      params.departure_time = options.departureTime === 'now' 
        ? 'now' 
        : Math.floor(options.departureTime / 1000);
    }
    
    if (options.trafficModel) {
      // Can be 'best_guess', 'pessimistic', or 'optimistic'
      params.traffic_model = options.trafficModel;
    }
    
    // Make the API request
    const apiUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const response = await axios.get(apiUrl, { params });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Distance Matrix API error: ${response.data.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Distance matrix calculation error:', error);
    throw error;
  }
};

/**
 * Calculate optimal route with real-time traffic
 * @param {Object|string} origin - Origin location
 * @param {Array} waypoints - Array of waypoint locations
 * @param {Object|string} destination - Final destination
 * @param {Object} options - Options for routing
 * @returns {Promise<Object>} Optimized route
 */
const calculateOptimalRoute = async (origin, waypoints, destination, options = {}) => {
  try {
    /* ------------------------------------------------------------------
     * 1. Ensure Maps API is enabled
     * ---------------------------------------------------------------- */
    if (!(await isGoogleMapsEnabled())) {
      throw new Error('Google Maps API is not enabled');
    }

    /* ------------------------------------------------------------------
     * 2. Build request params – ALWAYS ask for alternatives so we have
     *    real data to score.
     * ---------------------------------------------------------------- */
    const params = {
      origin: formatAddressString(origin),
      destination: formatAddressString(destination),
      key: process.env.GOOGLE_MAPS_API_KEY,
      alternatives: 'true',                 // multiple options
      traffic_model: options.trafficModel || 'best_guess',
    };

    /* Waypoint optimisation */
    if (waypoints && waypoints.length) {
      params.waypoints = `optimize:true|${waypoints
        .map((wp) => formatAddressString(wp))
        .join('|')}`;
    }

    /* Real-time traffic */
    params.departure_time =
      options.departureTime === 'now' || !options.departureTime
        ? 'now'
        : Math.floor(options.departureTime / 1000);

    /* ------------------------------------------------------------------
     * 3. Call Google Directions
     * ---------------------------------------------------------------- */
    const apiUrl =
      'https://maps.googleapis.com/maps/api/directions/json';
    const response = await axios.get(apiUrl, { params });

    if (response.data.status !== 'OK') {
      throw new Error(
        `Directions API error: ${response.data.status}`,
      );
    }

    /* ------------------------------------------------------------------
     * 4. Convert Google response into internal route objects
     * ---------------------------------------------------------------- */
    const routes = response.data.routes.map((route) => {
      // Extract the optimized waypoint order if available
      const waypointOrder = route.waypoint_order || [];
      
      // Calculate total duration and distance
      let totalDuration = 0;
      let totalDistance = 0;
      let totalDurationInTraffic = 0;
      
      const legs = route.legs.map(leg => {
        totalDuration += leg.duration.value;
        totalDistance += leg.distance.value;
        
        // Add duration in traffic if available
        if (leg.duration_in_traffic) {
          totalDurationInTraffic += leg.duration_in_traffic.value;
        }
        
        return {
          startAddress: leg.start_address,
          endAddress: leg.end_address,
          distance: {
            text: leg.distance.text,
            value: leg.distance.value // in meters
          },
          duration: {
            text: leg.duration.text,
            value: leg.duration.value // in seconds
          },
          durationInTraffic: leg.duration_in_traffic ? {
            text: leg.duration_in_traffic.text,
            value: leg.duration_in_traffic.value // in seconds
          } : null,
          startLocation: leg.start_location,
          endLocation: leg.end_location,
          steps: leg.steps.map(step => ({
            distance: step.distance,
            duration: step.duration,
            instructions: step.html_instructions,
            travelMode: step.travel_mode
          }))
        };
      });
      
      return {
        summary: route.summary,
        waypointOrder,
        legs,
        googleIndex: route.route_index ?? 0,
        totalDistance: {
          text: `${(totalDistance / 1000).toFixed(1)} km`,
          value: totalDistance // in meters
        },
        totalDuration: {
          text: `${Math.floor(totalDuration / 60)} mins`,
          value: totalDuration // in seconds
        },
        totalDurationInTraffic: totalDurationInTraffic > 0 ? {
          text: `${Math.floor(totalDurationInTraffic / 60)} mins`,
          value: totalDurationInTraffic // in seconds
        } : null,
        encodedPolyline: route.overview_polyline.points
      };
    });
    
    /* ------------------------------------------------------------------
     * 5. BUS RUN ANALYSIS & OPTIMISATION – score each alternative
     * ---------------------------------------------------------------- */
    const analysisLog = [];

    analysisLog.push(
      `🚌 Bus Run Analysis: received ${routes.length} alternatives from Google`,
    );

    const scored = routes.map((r) => {
      // Simple 70/30 time vs distance score (lower is better)
      const dur = r.totalDurationInTraffic?.value || r.totalDuration.value;
      const dist = r.totalDistance.value;
      const score = dur * 0.7 + dist * 0.3;
      analysisLog.push(
        `  • Route ${r.googleIndex ?? ''} – ${r.summary}: ${
          (dur / 60).toFixed(0)
        } min / ${(dist / 1000).toFixed(1)} km  → score ${score.toFixed(0)}`,
      );
      return { ...r, _score: score };
    });

    scored.sort((a, b) => a._score - b._score);
    const bestRoute = scored[0];

    analysisLog.push(
      `✅ Selected route "${bestRoute.summary}" (score ${bestRoute._score.toFixed(
        0,
      )})`,
    );

    // Emit full log to console – can be consumed by UI terminal later
    analysisLog.forEach((msg) => console.log(msg));

    /* ------------------------------------------------------------------
     * 6. Return enhanced object (keeps original shape + extras)
     * ---------------------------------------------------------------- */
    return {
      status: response.data.status,
      routes: scored,
      bestRoute,
      analysisLog,
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    throw error;
  }
};

/**
 * Calculate estimated arrival times for each stop in a route
 * @param {Object} route - Route object from calculateOptimalRoute
 * @param {Date|number} departureTime - Departure time (Date object or timestamp)
 * @returns {Object} Route with estimated arrival times
 */
const calculateEstimatedArrivals = (route, departureTime) => {
  // Convert departureTime to timestamp if it's a Date object
  const startTime = departureTime instanceof Date 
    ? departureTime.getTime() 
    : departureTime;
  
  let currentTime = startTime;
  const routeWithTimes = { ...route };
  
  // Calculate arrival time for each leg
  routeWithTimes.legs = route.legs.map(leg => {
    // Use duration in traffic if available, otherwise use regular duration
    const legDuration = (leg.durationInTraffic ? leg.durationInTraffic.value : leg.duration.value) * 1000; // convert to ms
    
    // Calculate arrival time at the end of this leg
    const arrivalTime = new Date(currentTime + legDuration);
    
    // Update current time for next leg
    currentTime += legDuration;
    
    return {
      ...leg,
      departureTime: new Date(currentTime - legDuration),
      arrivalTime
    };
  });
  
  // Add overall arrival time
  routeWithTimes.arrivalTime = new Date(currentTime);
  
  return routeWithTimes;
};

/**
 * Compare multiple route alternatives and select the best one
 * @param {Array} routes - Array of route objects
 * @param {Object} preferences - Routing preferences (time vs. distance priority)
 * @returns {Object} Best route based on preferences
 */
const selectBestRoute = (routes, preferences = { timeWeight: 0.7, distanceWeight: 0.3 }) => {
  if (!routes || routes.length === 0) {
    return null;
  }
  
  // If only one route, return it
  if (routes.length === 1) {
    return routes[0];
  }
  
  // Normalize weights
  const totalWeight = preferences.timeWeight + preferences.distanceWeight;
  const timeWeight = preferences.timeWeight / totalWeight;
  const distanceWeight = preferences.distanceWeight / totalWeight;
  
  // Find min and max values for normalization
  const minDuration = Math.min(...routes.map(r => r.totalDurationInTraffic?.value || r.totalDuration.value));
  const maxDuration = Math.max(...routes.map(r => r.totalDurationInTraffic?.value || r.totalDuration.value));
  const durationRange = maxDuration - minDuration || 1; // Avoid division by zero
  
  const minDistance = Math.min(...routes.map(r => r.totalDistance.value));
  const maxDistance = Math.max(...routes.map(r => r.totalDistance.value));
  const distanceRange = maxDistance - minDistance || 1; // Avoid division by zero
  
  // Calculate scores for each route (lower is better)
  const routesWithScores = routes.map(route => {
    const duration = route.totalDurationInTraffic?.value || route.totalDuration.value;
    const distance = route.totalDistance.value;
    
    // Normalize values to 0-1 range
    const normalizedDuration = (duration - minDuration) / durationRange;
    const normalizedDistance = (distance - minDistance) / distanceRange;
    
    // Calculate weighted score (lower is better)
    const score = (normalizedDuration * timeWeight) + (normalizedDistance * distanceWeight);
    
    return { ...route, score };
  });
  
  // Sort by score (ascending) and return the best route
  routesWithScores.sort((a, b) => a.score - b.score);
  return routesWithScores[0];
};

/**
 * Get route polyline for map display
 * @param {string} encodedPolyline - Encoded polyline from Google Maps API
 * @returns {Array} Array of latitude/longitude points
 */
const decodePolyline = (encodedPolyline) => {
  // Implementation of Google's polyline algorithm
  // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encodedPolyline.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encodedPolyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      latitude: lat * 1e-5,
      longitude: lng * 1e-5
    });
  }
  
  return points;
};

/**
 * Save route data to the database
 * @param {number} vehicleAssignmentId - Vehicle assignment ID
 * @param {string} routeType - 'pickup' or 'dropoff'
 * @param {Object} routeData - Route data from Google Maps
 * @param {Array} participants - Array of participants on this route
 * @param {Object} venue - Venue information
 * @returns {Promise<number>} Route ID
 */
const saveRouteToDatabase = async (vehicleAssignmentId, routeType, routeData, participants, venue) => {
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
      // Get the best route if multiple routes are provided
      const route = Array.isArray(routeData.routes) 
        ? selectBestRoute(routeData.routes)
        : routeData.routes[0];
      
      // Insert route record
      const routeId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO routes 
           (vehicle_assignment_id, route_type, estimated_duration, estimated_distance)
           VALUES (?, ?, ?, ?)`,
          [
            vehicleAssignmentId, 
            routeType, 
            Math.round((route.totalDurationInTraffic?.value || route.totalDuration.value) / 60), // minutes
            Math.round(route.totalDistance.value / 100) / 10 // km with 1 decimal
          ],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Get the waypoint order from the route
      const waypointOrder = route.waypointOrder || [];
      
      // Create an array of stops in the correct order
      const stops = [];
      
      // Add depot as first stop for pickup routes
      if (routeType === 'pickup') {
        stops.push({
          type: 'depot',
          address: DEPOT_LOCATION.address,
          latitude: DEPOT_LOCATION.latitude,
          longitude: DEPOT_LOCATION.longitude
        });
      } else {
        // For dropoff routes, venue is the first stop
        stops.push({
          type: 'venue',
          venueId: venue.venue_id,
          name: venue.venue_name,
          address: venue.venue_address,
          suburb: venue.venue_suburb,
          state: venue.venue_state,
          postcode: venue.venue_postcode
        });
      }
      
      // Add participant stops in the order specified by the waypoint order
      waypointOrder.forEach(index => {
        const participant = participants[index];
        stops.push({
          type: 'participant',
          participantId: participant.id,
          name: `${participant.first_name} ${participant.last_name}`,
          address: participant.address,
          suburb: participant.suburb,
          state: participant.state,
          postcode: participant.postcode
        });
      });
      
      // Add final stop (venue for pickup, depot for dropoff)
      if (routeType === 'pickup') {
        stops.push({
          type: 'venue',
          venueId: venue.venue_id,
          name: venue.venue_name,
          address: venue.venue_address,
          suburb: venue.venue_suburb,
          state: venue.venue_state,
          postcode: venue.venue_postcode
        });
      } else {
        stops.push({
          type: 'depot',
          address: DEPOT_LOCATION.address,
          latitude: DEPOT_LOCATION.latitude,
          longitude: DEPOT_LOCATION.longitude
        });
      }
      
      // Calculate estimated arrival times
      let currentTime;
      if (routeType === 'pickup') {
        // For pickup, calculate backward from program start time
        const programStartTime = new Date(`${venue.date}T${venue.start_time}`);
        const totalDuration = (route.totalDurationInTraffic?.value || route.totalDuration.value) * 1000; // ms
        currentTime = programStartTime.getTime() - totalDuration;
      } else {
        // For dropoff, calculate forward from program end time
        currentTime = new Date(`${venue.date}T${venue.end_time}`).getTime();
      }
      
      // Insert route stops with estimated arrival times
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        
        // Calculate arrival time for this stop
        let estimatedArrivalTime = new Date(currentTime);
        
        // Format as HH:MM
        const timeString = estimatedArrivalTime.toTimeString().substring(0, 5);
        
        // Update current time for next stop
        if (i < route.legs.length) {
          const legDuration = (route.legs[i].durationInTraffic?.value || route.legs[i].duration.value) * 1000; // ms
          if (routeType === 'pickup') {
            currentTime += legDuration;
          } else {
            currentTime += legDuration;
          }
        }
        
        let participantId = null;
        let venueId = null;
        
        if (stop.type === 'participant') {
          participantId = stop.participantId;
        } else if (stop.type === 'venue') {
          venueId = stop.venueId;
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
              stop.address,
              stop.suburb || '',
              stop.state || 'NSW',
              stop.postcode || '',
              timeString
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

module.exports = {
  DEPOT_LOCATION,
  geocodeAddress,
  batchGeocodeParticipants,
  calculateDistanceMatrix,
  calculateOptimalRoute,
  calculateEstimatedArrivals,
  selectBestRoute,
  decodePolyline,
  saveRouteToDatabase,
  isGoogleMapsEnabled
};
