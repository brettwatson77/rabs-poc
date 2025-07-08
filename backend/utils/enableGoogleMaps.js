// backend/utils/enableGoogleMaps.js
const { getDbConnection } = require('../database');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Format an address object into a string for Google Maps API
 * @param {Object} participant - Participant object with address components
 * @returns {string} Formatted address string
 */
const formatAddressString = (participant) => {
  return `${participant.address}, ${participant.suburb} ${participant.state} ${participant.postcode} Australia`.trim();
};

/**
 * Enable Google Maps in database settings
 * @returns {Promise<boolean>} Success status
 */
const enableGoogleMapsInSettings = async () => {
  const db = await getDbConnection();
  
  try {
    // Check if Google Maps API key is available
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.error('Error: GOOGLE_MAPS_API_KEY not found in environment variables');
      return false;
    }
    
    // Update the setting
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE settings SET value = "1", updated_at = CURRENT_TIMESTAMP WHERE key = "google_maps_enabled"',
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log('✅ Google Maps enabled in database settings');
    return true;
  } catch (error) {
    console.error('Error enabling Google Maps in settings:', error);
    return false;
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
    const apiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const response = await axios.get(apiUrl, {
      params: {
        address,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }
    
    const location = response.data.results[0].geometry.location;
    
    return {
      latitude: location.lat,
      longitude: location.lng
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
        'UPDATE participants SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
 * Geocode all participants without coordinates
 * @returns {Promise<{total: number, success: number, failed: number}>} Results summary
 */
const geocodeParticipantsWithoutCoordinates = async () => {
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
    
    console.log(`Found ${participants.length} participants without coordinates`);
    
    let successCount = 0;
    let failedCount = 0;
    
    // Geocode each participant (with rate limiting)
    for (const participant of participants) {
      try {
        console.log(`Geocoding participant ${participant.id}: ${formatAddressString(participant)}`);
        
        const address = formatAddressString(participant);
        const geocoded = await geocodeAddress(address);
        
        await updateParticipantCoordinates(
          participant.id,
          geocoded.latitude,
          geocoded.longitude
        );
        
        console.log(`  ✅ Updated: (${geocoded.latitude}, ${geocoded.longitude})`);
        successCount++;
        
        // Rate limiting - Google has quotas
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`  ❌ Failed to geocode participant ${participant.id}:`, error.message);
        failedCount++;
      }
    }
    
    return {
      total: participants.length,
      success: successCount,
      failed: failedCount
    };
  } finally {
    db.close();
  }
};

/**
 * Main function to enable Google Maps and geocode participants
 */
const setupGoogleMaps = async () => {
  console.log('🗺️  Setting up Google Maps integration...');
  
  // Step 1: Enable Google Maps in settings
  const settingsEnabled = await enableGoogleMapsInSettings();
  
  if (!settingsEnabled) {
    console.error('Failed to enable Google Maps in settings. Aborting.');
    return;
  }
  
  // Step 2: Geocode participants without coordinates
  console.log('\n🔍 Geocoding participants without coordinates...');
  const geocodeResults = await geocodeParticipantsWithoutCoordinates();
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`  Total participants processed: ${geocodeResults.total}`);
  console.log(`  Successfully geocoded: ${geocodeResults.success}`);
  console.log(`  Failed to geocode: ${geocodeResults.failed}`);
  
  console.log('\n✨ Google Maps setup complete!');
};

// Run the script if executed directly
if (require.main === module) {
  setupGoogleMaps().catch(error => {
    console.error('Error setting up Google Maps:', error);
    process.exit(1);
  });
}

// Export functions for use in other modules
module.exports = {
  enableGoogleMapsInSettings,
  geocodeParticipantsWithoutCoordinates,
  setupGoogleMaps
};
