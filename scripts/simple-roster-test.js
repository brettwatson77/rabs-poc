/**
 * Simple Roster API Test
 * 
 * This script makes a basic request to the Roster API to verify
 * that it's working with our simplified implementation.
 * 
 * Usage: node scripts/simple-roster-test.js
 */

const axios = require('axios');

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function testRosterApi() {
  console.log(`\n${colors.bright}${colors.blue}SIMPLE ROSTER API TEST${colors.reset}`);
  console.log('-'.repeat(50));
  
  try {
    // Get today's date and a week from now
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`${colors.yellow}Testing date range:${colors.reset} ${today} to ${nextWeek}`);
    console.log(`${colors.yellow}Making API request to:${colors.reset} http://localhost:3009/api/v1/roster`);
    
    // Make the API request
    const response = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: today,
        endDate: nextWeek
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Check if the response was successful
    if (response.status === 200 && response.data.success) {
      console.log(`\n${colors.green}✓ SUCCESS!${colors.reset} Roster API is working!`);
      
      // Get the program instances
      const { programInstances } = response.data.data;
      
      console.log(`\n${colors.cyan}Found ${programInstances.length} program instances:${colors.reset}`);
      
      // Display basic info about each program instance
      if (programInstances.length > 0) {
        programInstances.forEach((instance, index) => {
          console.log(`\n${colors.bright}Instance ${index + 1}:${colors.reset}`);
          console.log(`  ID: ${instance.id}`);
          console.log(`  Date: ${instance.date || instance.instance_date}`);
          console.log(`  Time: ${instance.start_time} - ${instance.end_time}`);
          console.log(`  Status: ${instance.status}`);
        });
      } else {
        console.log(`${colors.yellow}No program instances found in the date range.${colors.reset}`);
        console.log(`${colors.yellow}Try creating a program in the Master Schedule first.${colors.reset}`);
      }
      
      console.log(`\n${colors.green}✓ ROSTER API TEST COMPLETE${colors.reset}`);
    } else {
      console.log(`\n${colors.red}✗ ERROR:${colors.reset} API returned unsuccessful response`);
      console.log(response.data);
    }
  } catch (error) {
    console.log(`\n${colors.red}✗ ERROR:${colors.reset} Failed to test Roster API`);
    
    if (error.response) {
      // The server responded with an error status
      console.log(`${colors.red}Status:${colors.reset} ${error.response.status}`);
      console.log(`${colors.red}Message:${colors.reset} ${error.response.data?.message || 'No error message provided'}`);
      
      if (error.response.status === 500) {
        console.log(`\n${colors.yellow}POSSIBLE SOLUTIONS:${colors.reset}`);
        console.log(`1. Check if the server is running`);
        console.log(`2. Look at server logs for specific errors`);
        console.log(`3. Make sure the database is properly connected`);
        console.log(`4. Verify that the tgl_loom_instances table exists`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.log(`${colors.red}Error:${colors.reset} No response received from server`);
      console.log(`${colors.yellow}Is the server running? Try:${colors.reset} node server.js`);
    } else {
      // Something happened in setting up the request
      console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
    }
  }
}

// Run the test
testRosterApi();
