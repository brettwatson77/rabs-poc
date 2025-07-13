/**
 * Google Maps API loader utility
 * 
 * Dynamically loads the Google Maps JavaScript API and returns a promise
 * that resolves when window.google.maps is available.
 * 
 * Usage:
 *   import loadGoogleMaps from '../utils/loadGoogleMaps';
 *   
 *   async function initMap() {
 *     try {
 *       const google = await loadGoogleMaps();
 *       const map = new google.maps.Map(document.getElementById('map'), {
 *         center: { lat: -33.8916, lng: 150.8651 },
 *         zoom: 12
 *       });
 *     } catch (error) {
 *       console.error('Failed to load Google Maps:', error);
 *     }
 *   }
 */

// Module-level variable to store the loading promise (singleton pattern)
let googleMapsPromise = null;

/**
 * Loads the Google Maps JavaScript API
 * @param {Object} options - Optional configuration
 * @param {string} options.apiKey - Override the API key from env vars
 * @param {string[]} options.libraries - Additional libraries to load (e.g. ['places', 'geometry'])
 * @returns {Promise<Object>} - Promise that resolves to the global google object
 */
const loadGoogleMaps = (options = {}) => {
  // If we already have a promise in progress, return it
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // Create a new promise
  googleMapsPromise = new Promise((resolve, reject) => {
    // If Google Maps is already loaded, resolve immediately
    if (window.google && window.google.maps) {
      return resolve(window.google);
    }

    // Get API key from Vite environment or options
    const apiKey = options.apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      return reject(new Error('Google Maps API key is required. Set VITE_GOOGLE_MAPS_API_KEY in .env or pass it as an option.'));
    }

    // Prepare callback function name
    const callbackName = `googleMapsInitCallback_${Date.now()}`;
    
    // Create global callback function
    window[callbackName] = () => {
      // Clean up the global callback
      delete window[callbackName];
      
      // Resolve with the loaded Google API object
      resolve(window.google);
    };

    // Create the script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}${options.libraries ? `&libraries=${options.libraries.join(',')}` : ''}`;
    script.async = true;
    script.defer = true;
    
    // Handle loading errors
    script.onerror = () => {
      // Reset the promise so we can try again
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps API script'));
    };

    // Add the script to the page
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

export default loadGoogleMaps;
