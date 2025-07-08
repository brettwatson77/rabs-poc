/**
 * routingService.js
 *
 * This service acts as a dispatcher for calculating routes. It will use the
 * Google Maps Directions API if a key is provided, otherwise it will fall back
 * to a simpler nearest-neighbor algorithm.
 */
require('dotenv').config();
const { Client } = require("@googlemaps/google-maps-services-js");
const { calculateFallbackRoute } = require('./fallbackRouting.js');

const client = new Client({});

/**
 * Calculates a route using the Google Maps Directions API.
 * @param {Array<Object>} stops - An array of stop objects. Each must have latitude and longitude.
 * @returns {Promise<{orderedRoute: Array<Object>, totalDistance: number, totalDuration: number}>} The calculated route details.
 */
async function calculateGoogleRoute(stops) {
    if (!stops || stops.length < 2) {
        return { orderedRoute: stops, totalDistance: 0, totalDuration: 0 };
    }

    const venue = stops.find(s => s.type === 'venue');
    const participantStops = stops.filter(s => s.type !== 'venue');

    // If there's no venue or no participants, a round trip can't be calculated.
    if (!venue || participantStops.length === 0) {
        return calculateFallbackRoute(stops);
    }

    const origin = { lat: venue.latitude, lng: venue.longitude };
    const waypoints = participantStops.map(p => ({
        location: { lat: p.latitude, lng: p.longitude },
        stopover: true,
    }));

    try {
        const response = await client.directions({
            params: {
                origin: origin,
                destination: origin,
                waypoints: waypoints,
                optimize: true, // Key parameter for route optimization
                key: process.env.GOOGLE_MAPS_API_KEY,
            },
            timeout: 5000, // 5 seconds
        });

        const route = response.data.routes[0];
        if (!route) {
            throw new Error("No route found by Google Maps API.");
        }

        // Reorder the participant stops based on the optimized order from the API
        const orderedParticipantStops = route.waypoint_order.map(i => participantStops[i]);
        
        // The final route is venue -> ordered participants -> venue
        const orderedRoute = [venue, ...orderedParticipantStops, venue];

        // Calculate total distance and duration from all legs of the journey
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;
        route.legs.forEach(leg => {
            totalDistanceMeters += leg.distance.value;
            totalDurationSeconds += leg.duration.value;
        });

        const totalDistanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(2));
        const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

        return {
            orderedRoute,
            totalDistance: totalDistanceKm,
            totalDuration: totalDurationMinutes,
        };

    } catch (e) {
        const errorMessage = e.response ? e.response.data.error_message : e.message;
        console.error(`Error calling Google Maps Directions API: ${errorMessage}`);
        console.log("Falling back to simple routing due to Google Maps API error.");
        return calculateFallbackRoute(stops);
    }
}

/**
 * Main routing function. Dispatches to Google Maps or a fallback based on API key availability.
 * @param {Array<Object>} stops - An array of stop objects.
 * @returns {Promise<{orderedRoute: Array<Object>, totalDistance: number, totalDuration: number}>} The calculated route details.
 */
async function calculateRoute(stops) {
    if (process.env.GOOGLE_MAPS_API_KEY) {
        console.log("Attempting to use Google Maps API for routing.");
        return await calculateGoogleRoute(stops);
    } else {
        console.log("No Google Maps API key found. Using fallback routing.");
        // The fallback is not async, but we wrap it to maintain a consistent interface
        return Promise.resolve(calculateFallbackRoute(stops));
    }
}

module.exports = {
    calculateRoute,
};
