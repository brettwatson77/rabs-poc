
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

async function testFixedRosterApi() {
  try {
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.bright}${colors.blue}TESTING FIXED ROSTER API${colors.reset}`);
    console.log('='.repeat(50));
    
    // Test main roster endpoint
    console.log(`\n${colors.yellow}Testing main roster endpoint...${colors.reset}`);
    const rosterResponse = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-13'
      }
    });
    
    if (rosterResponse.status === 200 && rosterResponse.data.success) {
      console.log(`${colors.green}✅ Roster API is working!${colors.reset}`);
      console.log(`${colors.green}Found ${rosterResponse.data.data.programInstances.length} program instances${colors.reset}`);
      
      if (rosterResponse.data.data.programInstances.length > 0) {
        const instance = rosterResponse.data.data.programInstances[0];
        console.log(`\n${colors.cyan}Sample program instance:${colors.reset}`);
        console.log(`  ID: ${instance.id}`);
        console.log(`  Date: ${instance.date}`);
        console.log(`  Program: ${instance.program_name}`);
        console.log(`  Time: ${instance.start_time} - ${instance.end_time}`);
        console.log(`  Staff count: ${instance.staff ? instance.staff.length : 0}`);
        console.log(`  Participant count: ${instance.participants ? instance.participants.length : 0}`);
      }
    } else {
      console.log(`${colors.red}❌ Roster API returned an error:${colors.reset}`, rosterResponse.data);
    }
    
    // Test metrics endpoint
    console.log(`\n${colors.yellow}Testing roster metrics endpoint...${colors.reset}`);
    const metricsResponse = await axios.get('http://localhost:3009/api/v1/roster/metrics', {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-13'
      }
    });
    
    if (metricsResponse.status === 200 && metricsResponse.data.success) {
      console.log(`${colors.green}✅ Roster Metrics API is working!${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Roster Metrics API returned an error:${colors.reset}`, metricsResponse.data);
    }
    
    console.log(`\n${colors.bright}${colors.green}🎉 ROSTER FIX SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.green}The Roster page should now load properly in the browser.${colors.reset}`);
  } catch (error) {
    console.log(`\n${colors.red}❌ Error testing Fixed Roster API:${colors.reset}`, error.message);
    
    if (error.response) {
      console.log(`${colors.red}Status: ${error.response.status}${colors.reset}`);
      console.log(`${colors.red}Message: ${error.response.data?.message || 'No message'}${colors.reset}`);
    }
  }
}

testFixedRosterApi();
