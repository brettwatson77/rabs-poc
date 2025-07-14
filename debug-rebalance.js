// debug-rebalance.js - Debug script to test rebalanceResources function
require('dotenv').config();
const { rebalanceResources } = require('./backend/services/dynamicResourceService');

// Program instance ID to test
const programInstanceId = 79;

// Utility function to format objects for logging
const formatObject = (obj) => {
  return JSON.stringify(obj, null, 2);
};

// Add debug wrapper around rebalanceResources
async function debugRebalance(id) {
  console.log(`\n🔍 DEBUG: Starting rebalance test for program instance ID: ${id}`);
  console.log('🔑 Google Maps API Key:', process.env.GOOGLE_MAPS_API_KEY ? 
    `${process.env.GOOGLE_MAPS_API_KEY.substring(0, 8)}...${process.env.GOOGLE_MAPS_API_KEY.substring(process.env.GOOGLE_MAPS_API_KEY.length - 4)}` : 
    'NOT FOUND');
  
  try {
    console.log('📋 Step 1: Calling rebalanceResources...');
    
    // Add a custom error handler to catch and log any errors
    const originalConsoleError = console.error;
    console.error = function(message, ...args) {
      originalConsoleError('\n❌ ERROR INTERCEPTED: ' + message, ...args);
      if (args[0] instanceof Error) {
        originalConsoleError('   Stack trace:', args[0].stack);
      }
    };
    
    // Call the actual function
    const result = await rebalanceResources(id);
    
    // Restore original console.error
    console.error = originalConsoleError;
    
    console.log('✅ Rebalance completed successfully!');
    console.log('📊 Result:', formatObject(result));
    
    // Analyze the result
    console.log('\n🔍 ANALYSIS:');
    console.log(`- Participant count: ${result.participantCount}`);
    console.log(`- Required staff: ${result.requiredStaff}, Allocated: ${result.allocatedStaff}`);
    console.log(`- Required vehicles: ${result.requiredVehicles}, Allocated: ${result.allocatedVehicles}`);
    
    // Check routes
    if (result.routes) {
      console.log(`- Routes generated: ${result.routes.pickupRoutes ? result.routes.pickupRoutes.length : 0} pickup, ${result.routes.dropoffRoutes ? result.routes.dropoffRoutes.length : 0} dropoff`);
      
      // Check if analysis logs are present
      if (result.routes.analysisLogs && result.routes.analysisLogs.length > 0) {
        console.log('- Analysis logs available:', result.routes.analysisLogs.length);
        console.log('\n📝 ANALYSIS LOGS:');
        result.routes.analysisLogs.forEach((log, i) => {
          console.log(`  ${i+1}. ${log}`);
        });
      } else {
        console.log('- No analysis logs available');
      }
    } else {
      console.log('- No routes generated');
    }
    
    return result;
  } catch (error) {
    console.log('\n❌ ERROR: Rebalance failed!');
    console.log(`- Error message: ${error.message}`);
    console.log('- Stack trace:');
    console.log(error.stack);
    
    // Try to determine where the error occurred
    console.log('\n🔍 ERROR ANALYSIS:');
    if (error.message.includes('Google Maps API')) {
      console.log('- Error related to Google Maps API');
      console.log('- Check if API key is valid and has required permissions');
      console.log('- Check if API services are enabled (Directions, Distance Matrix, etc.)');
      console.log('- Check if billing is enabled for the Google Cloud project');
    } else if (error.message.includes('vehicle')) {
      console.log('- Error related to vehicle allocation');
    } else if (error.message.includes('staff')) {
      console.log('- Error related to staff allocation');
    } else if (error.message.includes('route')) {
      console.log('- Error related to route calculation');
    } else if (error.message.includes('participant')) {
      console.log('- Error related to participant data');
    }
    
    throw error;
  }
}

// Run the debug function
console.log('🚀 Starting debug test for rebalanceResources...');
debugRebalance(programInstanceId)
  .then(() => {
    console.log('\n✅ Debug test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.log('\n❌ Debug test failed');
    process.exit(1);
  });
