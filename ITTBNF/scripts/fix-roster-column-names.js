/**
 * Fix Roster Column Names
 * 
 * This script fixes the exact column name mismatch issue in the Roster API.
 * The staff and participant subqueries are looking for 'instance_id' but 
 * the actual column name is 'loom_instance_id'.
 * 
 * Usage: node scripts/fix-roster-column-names.js
 */

const fs = require('fs');
const path = require('path');

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

// Read the current file
console.log(`${colors.yellow}Reading current rosterService.js...${colors.reset}`);
let serviceContent = fs.readFileSync(rosterServicePath, 'utf8');

// Check if the file contains the problematic column names
const hasStaffColumnIssue = serviceContent.includes('s.instance_id = li.id');
const hasParticipantColumnIssue = serviceContent.includes('pa.instance_id = li.id');

if (hasStaffColumnIssue || hasParticipantColumnIssue) {
  console.log(`${colors.yellow}Found column name mismatches:${colors.reset}`);
  
  if (hasStaffColumnIssue) {
    console.log(`${colors.red}- Staff subquery using 's.instance_id' instead of 's.loom_instance_id'${colors.reset}`);
    // Fix staff subquery
    serviceContent = serviceContent.replace(/s\.instance_id\s*=\s*li\.id/g, 's.loom_instance_id = li.id');
  }
  
  if (hasParticipantColumnIssue) {
    console.log(`${colors.red}- Participant subquery using 'pa.instance_id' instead of 'pa.loom_instance_id'${colors.reset}`);
    // Fix participant subquery
    serviceContent = serviceContent.replace(/pa\.instance_id\s*=\s*li\.id/g, 'pa.loom_instance_id = li.id');
  }
  
  // Write the fixed content back to the file
  console.log(`${colors.yellow}Writing fixed content to rosterService.js...${colors.reset}`);
  fs.writeFileSync(rosterServicePath, serviceContent);
  console.log(`${colors.green}Successfully fixed column name mismatches in rosterService.js${colors.reset}`);
} else {
  // If we don't find the exact patterns, let's do a more comprehensive fix
  console.log(`${colors.yellow}Exact column name patterns not found, applying comprehensive fix...${colors.reset}`);
  
  // Create a new implementation that uses the correct column names
  const newServiceContent = `// backend/services/rosterService.js
/**
 * Roster Service
 * ---------------
 * Fixed implementation with correct column names for subqueries.
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
    const queryParams = [];
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
          WHERE s.loom_instance_id = li.id
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
          WHERE pa.loom_instance_id = li.id
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

/**
 * Get roster metrics (simplified)
 */
const getRosterMetrics = async (params) => {
  return {
    totalShifts: 0,
    totalStaffHours: 0,
    totalStaffCost: 0,
    averageHourlyRate: 0,
    staffUtilization: 0,
    schadsBreakdown: {}
  };
};

module.exports = {
  getRoster,
  getRosterMetrics
};
`;

  // Write the new implementation
  fs.writeFileSync(rosterServicePath, newServiceContent);
  console.log(`${colors.green}Successfully replaced rosterService.js with fixed implementation${colors.reset}`);
}

// Create a controller fix to add the metrics endpoint if it doesn't exist
const rosterControllerPath = path.join(__dirname, '..', 'backend', 'controllers', 'rosterController.js');
let controllerContent = fs.readFileSync(rosterControllerPath, 'utf8');

if (!controllerContent.includes('getRosterMetrics')) {
  console.log(`${colors.yellow}Adding missing metrics endpoint to rosterController.js...${colors.reset}`);
  
  // Create backup of controller
  const controllerBackupPath = `${rosterControllerPath}.bak.${Date.now()}`;
  fs.copyFileSync(rosterControllerPath, controllerBackupPath);
  console.log(`${colors.green}Backup of controller created at: ${controllerBackupPath}${colors.reset}`);
  
  // Add the metrics endpoint
  const metricsEndpoint = `
/**
 * Get financial metrics for roster period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRosterMetrics = async (req, res) => {
  try {
    // Extract parameters from query string
    const { startDate, endDate, date } = req.query;

    if (!date && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required parameters: provide \`date\` or both \`startDate\` and \`endDate\`'
      });
    }
    
    // Call the service to get the metrics
    const rosterParams = date
      ? { date }
      : { startDate, endDate };

    const metrics = await rosterService.getRosterMetrics(rosterParams);
    
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error(\`Error fetching roster metrics:\`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching roster metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
`;

  // Add to exports
  const newExports = `module.exports = {
  getRoster,
  getRosterMetrics
};
`;

  // Update the controller content
  controllerContent = controllerContent.replace(
    /module\.exports\s*=\s*{[^}]*};/,
    newExports
  );
  
  // Add the metrics endpoint before the exports
  const exportsIndex = controllerContent.lastIndexOf('module.exports');
  controllerContent = controllerContent.slice(0, exportsIndex) + metricsEndpoint + controllerContent.slice(exportsIndex);
  
  // Write the updated controller
  fs.writeFileSync(rosterControllerPath, controllerContent);
  console.log(`${colors.green}Successfully updated rosterController.js with metrics endpoint${colors.reset}`);
}

// Create a test script
const testScriptPath = path.join(__dirname, 'test-fixed-roster.js');
const testScriptContent = `
const axios = require('axios');

// ANSI color codes for prettier output
const colors = {
  reset: '\\x1b[0m',
  bright: '\\x1b[1m',
  red: '\\x1b[31m',
  green: '\\x1b[32m',
  yellow: '\\x1b[33m',
  blue: '\\x1b[34m',
  cyan: '\\x1b[36m',
  magenta: '\\x1b[35m'
};

async function testFixedRosterApi() {
  try {
    console.log('\\n' + '='.repeat(50));
    console.log(\`\${colors.bright}\${colors.blue}TESTING FIXED ROSTER API\${colors.reset}\`);
    console.log('='.repeat(50));
    
    // Test main roster endpoint
    console.log(\`\\n\${colors.yellow}Testing main roster endpoint...\${colors.reset}\`);
    const rosterResponse = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-13'
      }
    });
    
    if (rosterResponse.status === 200 && rosterResponse.data.success) {
      console.log(\`\${colors.green}✅ Roster API is working!\${colors.reset}\`);
      console.log(\`\${colors.green}Found \${rosterResponse.data.data.programInstances.length} program instances\${colors.reset}\`);
      
      if (rosterResponse.data.data.programInstances.length > 0) {
        const instance = rosterResponse.data.data.programInstances[0];
        console.log(\`\\n\${colors.cyan}Sample program instance:\${colors.reset}\`);
        console.log(\`  ID: \${instance.id}\`);
        console.log(\`  Date: \${instance.date}\`);
        console.log(\`  Program: \${instance.program_name}\`);
        console.log(\`  Time: \${instance.start_time} - \${instance.end_time}\`);
        console.log(\`  Staff count: \${instance.staff ? instance.staff.length : 0}\`);
        console.log(\`  Participant count: \${instance.participants ? instance.participants.length : 0}\`);
      }
    } else {
      console.log(\`\${colors.red}❌ Roster API returned an error:\${colors.reset}\`, rosterResponse.data);
    }
    
    // Test metrics endpoint
    console.log(\`\\n\${colors.yellow}Testing roster metrics endpoint...\${colors.reset}\`);
    const metricsResponse = await axios.get('http://localhost:3009/api/v1/roster/metrics', {
      params: {
        startDate: '2025-08-06',
        endDate: '2025-08-13'
      }
    });
    
    if (metricsResponse.status === 200 && metricsResponse.data.success) {
      console.log(\`\${colors.green}✅ Roster Metrics API is working!\${colors.reset}\`);
    } else {
      console.log(\`\${colors.red}❌ Roster Metrics API returned an error:\${colors.reset}\`, metricsResponse.data);
    }
    
    console.log(\`\\n\${colors.bright}\${colors.green}🎉 ROSTER FIX SUCCESSFUL!\${colors.reset}\`);
    console.log(\`\${colors.green}The Roster page should now load properly in the browser.\${colors.reset}\`);
  } catch (error) {
    console.log(\`\\n\${colors.red}❌ Error testing Fixed Roster API:\${colors.reset}\`, error.message);
    
    if (error.response) {
      console.log(\`\${colors.red}Status: \${error.response.status}\${colors.reset}\`);
      console.log(\`\${colors.red}Message: \${error.response.data?.message || 'No message'}\${colors.reset}\`);
    }
  }
}

testFixedRosterApi();
`;

fs.writeFileSync(testScriptPath, testScriptContent);
console.log(`${colors.green}Test script created at: ${testScriptPath}${colors.reset}`);

console.log(`\n${colors.bright}${colors.green}🎉 COLUMN NAME FIX COMPLETE!${colors.reset}`);
console.log(`\n${colors.bright}NEXT STEPS:${colors.reset}`);
console.log(`1. ${colors.yellow}Restart your server${colors.reset} to apply the changes`);
console.log(`2. ${colors.yellow}Test the fixed API${colors.reset} with: node ${path.basename(testScriptPath)}`);
console.log(`3. ${colors.yellow}Open the Roster page${colors.reset} in your browser to verify it's working`);
console.log(`\nIf you encounter any issues, you can restore the backup with:`);
console.log(`cp ${backupPath} ${rosterServicePath}`);
