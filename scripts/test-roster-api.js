
const axios = require('axios');

async function testRosterApi() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('Testing Roster API...');
    const response = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: today,
        endDate: nextWeek
      }
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Roster API is working!');
      console.log(`Found ${response.data.data.programInstances.length} program instances`);
    } else {
      console.log('❌ Roster API returned an error:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing Roster API:', error.message);
  }
}

testRosterApi();
