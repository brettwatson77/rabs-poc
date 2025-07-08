/**
 * fallbackRouting.js
 *
 * This service provides the fallback routing logic using a nearest-neighbor
 * algorithm and the Haversine formula. It is used when a Google Maps API key
 * is not available.
 */

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param {object} point1 - The first point { latitude, longitude }.
 * @param {object} point2 - The second point { latitude, longitude }.
 * @returns {number} The distance between the two points in kilometers.
 */
function haversineDistance(point1, point2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (point2.latitude - point1.latitude) * (Math.PI / 180);
  const dLon = (point2.longitude - point1.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.latitude * (Math.PI / 180)) *
      Math.cos(point2.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest neighbor to a given point from a list of other points.
 * @param {object} startPoint - The point to start from.
 * @param {Array<object>} remainingPoints - The list of points to search through.
 * @returns {object} The nearest point and its index in the original array.
 */
function findNearestNeighbor(startPoint, remainingPoints) {
  let nearest = null;
  let nearestIndex = -1;
  let minDistance = Infinity;

  remainingPoints.forEach((point, index) => {
    const distance = haversineDistance(startPoint, point);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
      nearestIndex = index;
    }
  });

  return { nearest, nearestIndex };
}

/**
 * Calculates a route using the nearest-neighbor algorithm.
 * @param {Array<object>} stops - An array of stops, where each stop has latitude and longitude.
 *   The first stop is assumed to be the depot/venue.
 * @returns {Array<object>} The calculated route as an ordered array of stops.
 */
function calculateFallbackRoute(stops) {
  if (!stops || stops.length === 0) {
    return [];
  }

  // The venue/depot is the start and end point.
  const depot = stops.find(s => s.type === 'venue');
  if (!depot) {
      // If no venue, we can't calculate a route. Return stops as is.
      return stops;
  }
  
  let remainingStops = stops.filter(s => s.type !== 'venue');
  const route = [depot];
  let currentPoint = depot;

  while (remainingStops.length > 0) {
    const { nearest, nearestIndex } = findNearestNeighbor(currentPoint, remainingStops);
    if (nearest) {
      route.push(nearest);
      currentPoint = nearest;
      remainingStops.splice(nearestIndex, 1);
    } else {
      // Should not happen if there are remaining stops
      break;
    }
  }

  // The route ends back at the depot
  route.push(depot);

  return route;
}

module.exports = {
  calculateFallbackRoute,
};
