// test-google-maps.js - Test script for Google Maps API key
require('dotenv').config();
const axios = require('axios');

// Get the API key from environment variables
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

// Check if API key exists
if (!apiKey) {
  console.error('❌ ERROR: Google Maps API key not found in .env file');
  console.log('Make sure you have GOOGLE_MAPS_API_KEY=your_key in your .env file');
  process.exit(1);
}

console.log(`🔑 API Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

// Test locations (Sydney to Melbourne)
const origin = '-33.8688,151.2093'; // Sydney
const destination = '-37.8136,144.9631'; // Melbourne

// Test the Directions API with a simple request
async function testDirectionsApi() {
  console.log('🚀 Testing Google Maps Directions API...');
  
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&alternatives=true&key=${apiKey}`;
    
    console.log(`📡 Sending request to Google Maps API...`);
    const response = await axios.get(url);
    
    if (response.data.status === 'OK') {
      console.log('✅ SUCCESS! Google Maps API key is working correctly');
      console.log(`📊 Found ${response.data.routes.length} route(s) from Sydney to Melbourne`);
      
      // Display basic info about each route
      response.data.routes.forEach((route, index) => {
        const distance = route.legs[0].distance.text;
        const duration = route.legs[0].duration.text;
        console.log(`🛣️ Route ${index + 1}: ${distance}, ${duration}`);
      });
      
      return true;
    } else {
      console.error(`❌ ERROR: API returned status "${response.data.status}"`);
      console.error(`📝 Error message: ${response.data.error_message || 'No detailed error message provided'}`);
      
      if (response.data.status === 'REQUEST_DENIED') {
        console.log('\n🔍 TROUBLESHOOTING TIPS:');
        console.log('1. Check if billing is enabled for your Google Cloud project');
        console.log('2. Verify the API key restrictions (HTTP referrers, IP addresses)');
        console.log('3. Make sure Directions API is enabled in your Google Cloud Console');
        console.log('4. Check if you have exceeded your quota');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to connect to Google Maps API');
    console.error(`📝 Error details: ${error.message}`);
    
    if (error.response) {
      console.error(`📝 Status code: ${error.response.status}`);
      console.error(`📝 Response data:`, error.response.data);
    }
    
    return false;
  }
}

// Run the test
testDirectionsApi()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
