/**
 * Date Format Test Script
 * 
 * This script demonstrates the date format mismatch between:
 * 1. What formatDateForApi() returns (used in the frontend filter)
 * 2. What the API actually returns in the date field
 * 
 * This mismatch explains why cards aren't showing up in the Master Schedule.
 * 
 * Usage: node scripts/test-date-format.js
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
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

/**
 * Simulates the formatDateForApi function from the frontend
 * This is what's used in getCardsForDay() to filter cards
 */
function formatDateForApi(date) {
  // Common implementation - YYYY-MM-DD format
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Alternative formatDateForApi that would work with the API response
 */
function fixedFormatDateForApi(date) {
  // Return the full ISO string to match API response
  const d = new Date(date);
  return d.toISOString();
}

/**
 * Test the API response format
 */
async function testApiFormat() {
  try {
    console.log(`\n${colors.bright}${colors.blue}TESTING API DATE FORMAT${colors.reset}`);
    
    // Make API call to get loom instances
    console.log(`${colors.yellow}Making API call to:${colors.reset} http://localhost:3009/api/v1/loom/instances?startDate=2025-08-06&endDate=2025-08-12`);
    
    const response = await axios.get('http://localhost:3009/api/v1/loom/instances', {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-12'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (response.status !== 200 || !response.data.success) {
      console.log(`${colors.red}API returned error:${colors.reset}`, response.data);
      return null;
    }
    
    if (!response.data.data || response.data.data.length === 0) {
      console.log(`${colors.red}API returned no instances!${colors.reset}`);
      return null;
    }
    
    // Get the first instance
    const instance = response.data.data[0];
    
    console.log(`\n${colors.bright}API RESPONSE DATE FORMAT:${colors.reset}`);
    console.log(`${colors.yellow}Instance ID:${colors.reset} ${instance.id}`);
    console.log(`${colors.yellow}Program:${colors.reset} ${instance.program_name}`);
    console.log(`${colors.yellow}Raw date field:${colors.reset} ${instance.date}`);
    console.log(`${colors.yellow}Raw instance_date field:${colors.reset} ${instance.instance_date}`);
    
    // Demonstrate the frontend filter logic
    const testDates = [
      new Date('2025-08-06'), // The date we're looking for
      new Date('2025-08-05'), // The date that might be in the database
    ];
    
    console.log(`\n${colors.bright}FRONTEND FILTER SIMULATION:${colors.reset}`);
    
    testDates.forEach(testDate => {
      const dateStr = formatDateForApi(testDate);
      const fixedDateStr = fixedFormatDateForApi(testDate);
      
      console.log(`\n${colors.yellow}Test date:${colors.reset} ${testDate.toDateString()}`);
      console.log(`${colors.yellow}formatDateForApi() returns:${colors.reset} "${dateStr}"`);
      console.log(`${colors.yellow}API date field contains:${colors.reset} "${instance.date}"`);
      
      // Test the comparison that happens in getCardsForDay()
      const matches = instance.date === dateStr;
      console.log(`${colors.yellow}Do they match?${colors.reset} ${matches ? colors.green + 'YES' : colors.red + 'NO'}`);
      
      // Test with the fixed format
      const fixedMatches = instance.date.includes(dateStr);
      console.log(`${colors.yellow}Would partial matching work?${colors.reset} ${fixedMatches ? colors.green + 'YES' : colors.red + 'NO'}`);
    });
    
    return instance;
  } catch (error) {
    console.error(`${colors.red}Error testing API:${colors.reset}`, error.message);
    console.log(`${colors.yellow}Is the server running? Try:${colors.reset} node server.js`);
    return null;
  }
}

/**
 * Suggest fixes for the issue
 */
function suggestFixes(instance) {
  if (!instance) return;
  
  console.log(`\n${colors.bright}${colors.bgGreen}${colors.bright} PROBLEM IDENTIFIED ${colors.reset}`);
  console.log(`\n${colors.bright}The issue is a date format mismatch:${colors.reset}`);
  console.log(`1. ${colors.yellow}Frontend filter uses:${colors.reset} "${formatDateForApi(new Date('2025-08-06'))}"`);
  console.log(`2. ${colors.yellow}API returns:${colors.reset} "${instance.date}"`);
  console.log(`\n${colors.bright}This is why no cards are showing up in Master Schedule.${colors.reset}`);
  
  console.log(`\n${colors.bright}${colors.bgGreen}${colors.bright} SOLUTIONS ${colors.reset}`);
  console.log(`\n${colors.bright}Option 1: Fix the getCardsForDay function in MasterSchedule.jsx:${colors.reset}`);
  console.log(`
  const getCardsForDay = (day) => {
    const dateStr = formatDateForApi(day);
    return scheduleData.filter(card => {
      // Use partial matching instead of exact matching
      return card.date && card.date.includes(dateStr);
    });
  };`);
  
  console.log(`\n${colors.bright}Option 2: Fix the API response to return simple dates:${colors.reset}`);
  console.log(`
  // In loomEngine.js or loomController.js
  // Format the date before returning it
  const formattedInstances = instances.map(instance => ({
    ...instance,
    date: instance.date.split('T')[0] // Convert to YYYY-MM-DD
  }));`);
  
  console.log(`\n${colors.bright}RECOMMENDED SOLUTION:${colors.reset} Option 1 is quicker and safer for the demo.`);
}

/**
 * Main function
 */
async function main() {
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}DATE FORMAT MISMATCH TEST${colors.reset}`);
    console.log('*'.repeat(80));
    
    // Test API format
    const instance = await testApiFormat();
    
    // Suggest fixes
    suggestFixes(instance);
    
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
