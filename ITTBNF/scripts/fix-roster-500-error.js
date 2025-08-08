/**
 * Fix Roster API 500 Error
 * 
 * This script fixes the Roster API by replacing the incomplete implementation
 * with a simplified version that directly uses loom instances data.
 * 
 * The current implementation has placeholder functions that return empty arrays,
 * causing the API to crash with 500 errors.
 * 
 * Usage: node scripts/fix-roster-500-error.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Path to roster service file
const rosterServicePath = path.join(__dirname, '..', 'backend', 'services', 'rosterService.js');

// Create backup of original file
console.log(`${colors.yellow}Creating backup of original rosterService.js...${colors.reset}`);
const backupPath = `${rosterServicePath}.bak.${Date.now()}`;
fs.copyFileSync(rosterServicePath, backupPath);
console.log(`${colors.green}Backup created at: ${backupPath}${colors.reset}`);

// New simplified implementation that works with loom instances
const newRosterServiceContent = `// backend/services/rosterService.js
/**
 * Roster Service
 * ---------------
 * Simplified implementation that directly uses loom instances data
 * to ensure the Roster API works for the demo.
 */

const { pool } = require('../database'); // PostgreSQL pool

/**
 * Get roster data for a specific date or date range
 * @param {Object} params - { date } OR { startDate, endDate }
 * @returns {Promise<Object>} Roster data organized by program instance
 */
const getRoster = async (params) => {
  try {
    // ------------------------------------------------------------------
    // Parameter handling – support single date or date range
    // ------------------------------------------------------------------
    const { date, startDate, endDate } = params || {};

    let dateCondition = '';
    let queryParams = [];
    let paramIndex = 1;

    if (date) {
      // Single day - use partial matching for ISO date strings
      dateCondition = \`AND (li.instance_date::date = $\${paramIndex} OR li.date::date = $\${paramIndex})\`;
      queryParams.push(date);
    } else if (startDate && endDate) {
      // Date range - use partial matching for ISO date strings
      dateCondition = \`AND (
        (li.instance_date::date BETWEEN $\${paramIndex} AND $\${paramIndex+1}) OR 
        (li.date::date BETWEEN $\${paramIndex} AND $\${paramIndex+1})
      )\`;
      queryParams.push(startDate, endDate);
    } else {
      throw new Error(
        'Invalid parameters supplied to getRoster – provide \`date\` or both \`startDate\` and \`endDate\`'
      );
    }

    // Get all program instances with related data in a single query
    const query = \`
      SELECT 
        li.id,
        li.program_id,
        li.instance_date,
        li.date,
        li.start_time,
        li.end_time,
        li.status,
        li.notes,
        li.manually_modified,
        p.name AS program_name,
        p.program_type,
        p.description AS program_description,
        v.id AS venue_id,
        v.name AS venue_name,
        v.address AS venue_address,
        v.suburb AS venue_suburb,
        v.state AS venue_state,
        v.postcode AS venue_postcode,
        (
          SELECT json_agg(json_build_object(
            'id', s.id,
            'staff_id', s.staff_id,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'role', s.role,
            'schads_level', st.schads_level,
            'hourly_rate', st.base_pay_rate
          ))
          FROM tgl_loom_staff_shifts s
          JOIN staff st ON s.staff_id = st.id
          WHERE s.instance_id = li.id
        ) AS staff,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'participant_id', pa.participant_id,
            'first_name', pt.first_name,
            'last_name', pt.last_name,
            'supervision_multiplier', pt.supervision_multiplier,
            'pickup_required', pa.pickup_required,
            'dropoff_required', pa.dropoff_required
          ))
          FROM tgl_loom_participant_allocations pa
          JOIN participants pt ON pa.participant_id = pt.id
          WHERE pa.instance_id = li.id
        ) AS participants
      FROM tgl_loom_instances li
      JOIN programs p ON li.program_id = p.id
      LEFT JOIN venues v ON li.venue_id = v.id
      WHERE 1=1
      \${dateCondition}
      ORDER BY li.start_time
    \`;

    // Execute the query
    const { rows } = await pool.query(query, queryParams);

    // Process the results
    const programInstances = rows.map(row => {
      // Ensure arrays are never null
      const staff = row.staff || [];
      const participants = row.participants || [];
      
      // Calculate staffing status based on participant count and assigned staff
      const requiredStaffCount = Math.ceil((participants.length || 0) / 4);
      const staffingStatus = (staff.length || 0) >= requiredStaffCount ? 'adequate' : 'understaffed';
      
      // Format dates consistently
      const formattedDate = row.date ? new Date(row.date).toISOString().split('T')[0] : 
                           (row.instance_date ? new Date(row.instance_date).toISOString().split('T')[0] : null);
      
      // Return the processed row
      return {
        ...row,
        date: formattedDate,
        instance_date: formattedDate,
        staff,
        participants,
        requiredStaffCount,
        staffingStatus,
        vehicles: [] // Placeholder for now, to match expected structure
      };
    });

    // Organize by time slot
    const timeSlots = {};
    programInstances.forEach(instance => {
      const startTime = instance.start_time;
      if (!timeSlots[startTime]) {
        timeSlots[startTime] = [];
      }
      timeSlots[startTime].push(instance);
    });

    // Build the final payload
    const payload = {
      programInstances,
      rosterByTimeSlot: timeSlots
    };

    if (date) {
      payload.date = date;
    } else {
      payload.startDate = startDate;
      payload.endDate = endDate;
    }

    return payload;
  } catch (error) {
    console.error('Error in getRoster:', error);
    throw error;
  }
};

module.exports = {
  getRoster
};
`;

// Write the new implementation
console.log(`${colors.yellow}Writing new simplified rosterService.js...${colors.reset}`);
fs.writeFileSync(rosterServicePath, newRosterServiceContent);
console.log(`${colors.green}Successfully updated rosterService.js${colors.reset}`);

// Create a quick test script
const testScriptPath = path.join(__dirname, 'test-roster-api.js');
const testScriptContent = `
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
      console.log(\`Found \${response.data.data.programInstances.length} program instances\`);
    } else {
      console.log('❌ Roster API returned an error:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing Roster API:', error.message);
  }
}

testRosterApi();
`;

console.log(`${colors.yellow}Creating test script...${colors.reset}`);
fs.writeFileSync(testScriptPath, testScriptContent);
console.log(`${colors.green}Test script created at: ${testScriptPath}${colors.reset}`);

console.log(`\n${colors.bright}${colors.green}ROSTER API FIX COMPLETE!${colors.reset}`);
console.log(`\n${colors.bright}NEXT STEPS:${colors.reset}`);
console.log(`1. ${colors.yellow}Restart your server${colors.reset} to apply the changes`);
console.log(`2. ${colors.yellow}Test the Roster API${colors.reset} with: node scripts/test-roster-api.js`);
console.log(`3. ${colors.yellow}Open the Roster page${colors.reset} in your browser to verify it's working`);
console.log(`\nIf you encounter any issues, you can restore the backup with:`);
console.log(`cp ${backupPath} ${rosterServicePath}`);
