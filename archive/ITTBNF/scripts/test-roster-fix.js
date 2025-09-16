
/**
 * Test Roster Fix
 * 
 * This script tests if the roster service is working correctly after the fixes.
 */

const axios = require('axios');

async function testRosterAPI() {
  try {
    console.log('Testing Roster API...');
    const response = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: '2025-08-05',
        endDate: '2025-08-12'
      }
    });
    
    console.log('✅ SUCCESS: Roster API is working!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 300) + '...');
    return true;
  } catch (error) {
    console.log('❌ ERROR: Roster API request failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function main() {
  console.log('\n================================================================================');
  console.log('TESTING ROSTER FIX');
  console.log('================================================================================\n');
  
  const success = await testRosterAPI();
  
  console.log('\n================================================================================');
  if (success) {
    console.log('✅ ROSTER API IS WORKING CORRECTLY!');
    console.log('You can now restart your server and the roster page should load.');
  } else {
    console.log('❌ ROSTER API IS STILL NOT WORKING');
    console.log('Please check the server logs for more details.');
  }
  console.log('================================================================================\n');
}

main().catch(error => {
  console.error('Error running test:', error);
});
