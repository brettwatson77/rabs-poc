// backend/services/routingService.js

/**
 * Calculates the great-circle distance between two points on the earth (specified in decimal degrees)
 * using the Haversine formula.
 * @param {{latitude: number, longitude: number}} coords1 - The coordinates of the first point.
 * @param {{latitude: number, longitude: number}} coords2 - The coordinates of the second point.
 * @returns {number} The distance in kilometers.
 */
const haversineDistance = (coords1, coords2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (coords2.latitude - coords1.latitude) * (Math.PI / 180);
    const dLon = (coords2.longitude - coords1.longitude) * (Math.PI / 180);
    const lat1 = coords1.latitude * (Math.PI / 180);
    const lat2 = coords2.latitude * (Math.PI / 180);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in km
};

/**
 * Finds the nearest neighbor to a starting point from a list of other points.
 * @param {Object} startPoint - The point to start from. Must have latitude and longitude.
 * @param {Array<Object>} points - An array of points to search through.
 * @returns {{point: Object, distance: number, index: number}} The closest point, its distance, and its index.
 */
const findNearestNeighbor = (startPoint, points) => {
    let nearest = null;
    let minDistance = Infinity;
    let nearestIndex = -1;

    points.forEach((point, index) => {
        const distance = haversineDistance(startPoint, point);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = point;
            nearestIndex = index;
        }
    });

    return { point: nearest, distance: minDistance, index: nearestIndex };
};

/**
 * Calculates a route using the nearest-neighbor algorithm.
 * This is a fallback for when the Google Maps API is not available.
 * @param {Array<Object>} stops - An array of stop objects. Each must have latitude and longitude. The first stop is the depot/venue.
 * @returns {{orderedRoute: Array<Object>, totalDistance: number, totalDuration: number}} The calculated route details.
 */
const calculateRoute = (stops) => {
    if (!stops || stops.length < 2) {
        return { orderedRoute: stops, totalDistance: 0, totalDuration: 0 };
    }

    const orderedRoute = [];
    let remainingStops = [...stops];
    let totalDistance = 0;
    
    // The first stop is always the starting point (e.g., the venue).
    let currentPoint = remainingStops.shift();
    orderedRoute.push(currentPoint);

    while (remainingStops.length > 0) {
        const { point: nearest, distance, index } = findNearestNeighbor(currentPoint, remainingStops);
        totalDistance += distance;
        currentPoint = nearest;
        orderedRoute.push(currentPoint);
        remainingStops.splice(index, 1); // Remove the stop from the list of remaining stops
    }
    
    // Optional: Add the distance back to the starting point if it's a round trip
    // For pickup/dropoff, this is not always necessary as the last stop is the destination.

    // Estimate travel time
    const AVERAGE_SPEED_KPH = 40; // Assume an average speed of 40 km/h
    const STOP_DURATION_MINUTES = 5; // Assume 5 minutes per stop for pickup/dropoff
    
    const travelTimeHours = totalDistance / AVERAGE_SPEED_KPH;
    const travelTimeMinutes = travelTimeHours * 60;
    const stopTimeMinutes = (orderedRoute.length - 1) * STOP_DURATION_MINUTES;
    const totalDuration = Math.round(travelTimeMinutes + stopTimeMinutes);

    return {
        orderedRoute,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        totalDuration // in minutes
    };
};

module.exports = {
    calculateRoute,
    haversineDistance
};
