/**
 * Program Creation Verification Script
 * 
 * This script checks what was actually created in the database when a program
 * was successfully created but cards aren't showing up in the UI.
 * 
 * Usage: node scripts/check-created-program.js [programId]
 * If programId is not provided, it will check the most recently created program.
 */

const { Pool } = require('pg');
const { formatDateForDb, parseDbDate } = require('../backend/utils/dateUtils');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Helper to print section headers
const printHeader = (text) => {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
  console.log('='.repeat(80));
};

// Helper to print tables
const printTable = (data, indent = 0) => {
  if (!data || data.length === 0) {
    console.log(`${' '.repeat(indent)}${colors.yellow}No data found${colors.reset}`);
    return;
  }

  // Get all unique keys from all objects
  const keys = [...new Set(data.flatMap(item => Object.keys(item)))];
  
  // Calculate column widths
  const columnWidths = {};
  keys.forEach(key => {
    columnWidths[key] = Math.max(
      key.length,
      ...data.map(item => 
        item[key] !== null && item[key] !== undefined 
          ? String(item[key]).length 
          : 4 // length of "null"
      )
    );
  });
  
  // Print header
  const header = keys.map(key => 
    `${colors.bright}${key.padEnd(columnWidths[key])}${colors.reset}`
  ).join(' | ');
  console.log(`${' '.repeat(indent)}${header}`);
  
  // Print separator
  const separator = keys.map(key => 
    '-'.repeat(columnWidths[key])
  ).join('-+-');
  console.log(`${' '.repeat(indent)}${separator}`);
  
  // Print rows
  data.forEach(item => {
    const row = keys.map(key => {
      const value = item[key] !== null && item[key] !== undefined ? String(item[key]) : 'null';
      return value.padEnd(columnWidths[key]);
    }).join(' | ');
    console.log(`${' '.repeat(indent)}${row}`);
  });
};

/**
 * Get all programs, sorted by creation date (newest first)
 */
async function getPrograms(limit = 5) {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.name, p.program_type, p.start_date, p.end_date,
        p.repeat_pattern, p.days_of_week, p.venue_id, 
        v.name as venue_name, p.created_at
      FROM programs p
      LEFT JOIN venues v ON p.venue_id = v.id
      ORDER BY p.created_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows.map(row => ({
      ...row,
      days_of_week: Array.isArray(row.days_of_week) ? row.days_of_week : JSON.parse(row.days_of_week || '[]'),
      created_at: new Date(row.created_at).toLocaleString()
    }));
  } catch (error) {
    console.error(`${colors.red}Error getting programs:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get details for a specific program
 */
async function getProgramDetails(programId) {
  try {
    const result = await pool.query(`
      SELECT 
        p.*, v.name as venue_name,
        v.address as venue_address, v.suburb as venue_suburb
      FROM programs p
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE p.id = $1
    `, [programId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const program = result.rows[0];
    
    // Parse JSON fields
    program.days_of_week = Array.isArray(program.days_of_week) 
      ? program.days_of_week 
      : JSON.parse(program.days_of_week || '[]');
    
    program.time_slots = Array.isArray(program.time_slots)
      ? program.time_slots
      : JSON.parse(program.time_slots || '[]');
    
    // Format dates
    program.created_at = new Date(program.created_at).toLocaleString();
    program.updated_at = new Date(program.updated_at).toLocaleString();
    
    return program;
  } catch (error) {
    console.error(`${colors.red}Error getting program details:${colors.reset}`, error.message);
    return null;
  }
}

/**
 * Get participants for a program
 */
async function getProgramParticipants(programId) {
  try {
    const result = await pool.query(`
      SELECT 
        pp.id, pp.participant_id, p.first_name, p.last_name,
        pp.start_date, pp.end_date, pp.status
      FROM program_participants pp
      JOIN participants p ON pp.participant_id = p.id
      WHERE pp.program_id = $1
    `, [programId]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting program participants:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get billing codes for a program participant
 */
async function getParticipantBillingCodes(programId, participantId) {
  try {
    const result = await pool.query(`
      SELECT 
        pbc.id, pbc.billing_code, bc.description,
        pbc.hours, pbc.start_date, pbc.end_date, pbc.is_active
      FROM participant_billing_codes pbc
      LEFT JOIN billing_codes bc ON pbc.billing_code = bc.code
      WHERE pbc.program_id = $1 AND pbc.participant_id = $2
    `, [programId, participantId]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting billing codes:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get loom instances for a program
 */
async function getLoomInstances(programId) {
  try {
    const result = await pool.query(`
      SELECT 
        id, program_id, date, start_time, end_time,
        venue_id, capacity, status
      FROM tgl_loom_instances
      WHERE program_id = $1
      ORDER BY date, start_time
    `, [programId]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting loom instances:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get time slots for a loom instance
 */
async function getTimeSlots(instanceId) {
  try {
    const result = await pool.query(`
      SELECT 
        id, instance_id, start_time, end_time,
        label, card_type
      FROM tgl_loom_time_slots
      WHERE instance_id = $1
      ORDER BY start_time
    `, [instanceId]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting time slots:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get staff shifts for a loom instance
 */
async function getStaffShifts(instanceId) {
  try {
    const result = await pool.query(`
      SELECT 
        id, instance_id, staff_id, role,
        start_time, end_time, status, manually_assigned
      FROM tgl_loom_staff_shifts
      WHERE instance_id = $1
      ORDER BY role
    `, [instanceId]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting staff shifts:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get vehicle runs for a loom instance
 */
async function getVehicleRuns(instanceId) {
  try {
    const result = await pool.query(`
      SELECT 
        id, instance_id, vehicle_id, start_time, end_time,
        passenger_count, route_data
      FROM tgl_loom_vehicle_runs
      WHERE instance_id = $1
      ORDER BY start_time
    `, [instanceId]);
    
    return result.rows.map(row => ({
      ...row,
      route_data: typeof row.route_data === 'string' 
        ? JSON.parse(row.route_data) 
        : row.route_data
    }));
  } catch (error) {
    console.error(`${colors.red}Error getting vehicle runs:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Check loom window settings
 */
async function getLoomSettings() {
  try {
    const result = await pool.query(`
      SELECT key, value, description
      FROM settings
      WHERE key LIKE 'loom%'
      ORDER BY key
    `);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error getting loom settings:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Check API routes for Master Schedule and Dashboard
 */
async function checkApiRoutes() {
  try {
    const result = await pool.query(`
      SELECT route_path, method, handler_name, auth_required
      FROM api_routes
      WHERE route_path LIKE '%programs%' 
         OR route_path LIKE '%loom%'
         OR route_path LIKE '%cards%'
      ORDER BY route_path
    `);
    
    if (result.rows.length === 0) {
      console.log(`${colors.yellow}No API routes found in database. This might be normal if routes aren't stored in DB.${colors.reset}`);
      
      // Show expected API routes
      return [
        { route_path: '/api/v1/programs', method: 'GET', handler_name: 'getPrograms', expected: true },
        { route_path: '/api/v1/programs/:id', method: 'GET', handler_name: 'getProgramById', expected: true },
        { route_path: '/api/v1/programs', method: 'POST', handler_name: 'createProgram', expected: true },
        { route_path: '/api/v1/loom/instances', method: 'GET', handler_name: 'getLoomInstances', expected: true },
        { route_path: '/api/v1/loom/cards/:date', method: 'GET', handler_name: 'getCardsByDate', expected: true },
        { route_path: '/api/v1/dashboard/cards/:date', method: 'GET', handler_name: 'getCardsByDate', expected: true }
      ];
    }
    
    return result.rows;
  } catch (error) {
    console.log(`${colors.yellow}Could not query API routes from database. This is normal if routes aren't stored in DB.${colors.reset}`);
    
    // Show expected API routes
    return [
      { route_path: '/api/v1/programs', method: 'GET', handler_name: 'getPrograms', expected: true },
      { route_path: '/api/v1/programs/:id', method: 'GET', handler_name: 'getProgramById', expected: true },
      { route_path: '/api/v1/programs', method: 'POST', handler_name: 'createProgram', expected: true },
      { route_path: '/api/v1/loom/instances', method: 'GET', handler_name: 'getLoomInstances', expected: true },
      { route_path: '/api/v1/loom/cards/:date', method: 'GET', handler_name: 'getCardsByDate', expected: true },
      { route_path: '/api/v1/dashboard/cards/:date', method: 'GET', handler_name: 'getDashboardCards', expected: true }
    ];
  }
}

/**
 * Check frontend API calls
 */
async function checkFrontendApiCalls() {
  // This is a simulation since we can't directly check the frontend code
  // In a real scenario, you'd need to examine the frontend code
  
  const masterScheduleApiCalls = [
    { component: 'MasterSchedule.jsx', endpoint: '/api/v1/programs', purpose: 'Fetch all programs' },
    { component: 'MasterSchedule.jsx', endpoint: '/api/v1/programs/:id', purpose: 'Fetch specific program details' },
    { component: 'MasterSchedule.jsx', endpoint: '/api/v1/programs', method: 'POST', purpose: 'Create new program' },
    { component: 'MasterSchedule.jsx', endpoint: '/api/v1/loom/instances?start=:date&end=:date', purpose: 'Fetch loom instances for date range' }
  ];
  
  const dashboardApiCalls = [
    { component: 'Dashboard.jsx', endpoint: '/api/v1/dashboard/cards/:date', purpose: 'Fetch cards for specific date' },
    { component: 'Dashboard.jsx', endpoint: '/api/v1/loom/cards/:date', purpose: 'Alternative endpoint for cards' }
  ];
  
  return {
    masterSchedule: masterScheduleApiCalls,
    dashboard: dashboardApiCalls
  };
}

/**
 * Main function
 */
async function main() {
  try {
    // Get program ID from command line args or use most recent
    let programId = process.argv[2];
    
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}RABS PROGRAM CREATION VERIFICATION TOOL${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // Get recent programs
    printHeader('RECENT PROGRAMS');
    const programs = await getPrograms(5);
    printTable(programs);
    
    // If no program ID provided, use the most recent
    if (!programId && programs.length > 0) {
      programId = programs[0].id;
      console.log(`\n${colors.yellow}No program ID provided, using most recent: ${colors.bright}${programId}${colors.reset}`);
    }
    
    if (!programId) {
      console.error(`${colors.red}No programs found in database and no program ID provided.${colors.reset}`);
      process.exit(1);
    }
    
    // Get program details
    printHeader(`PROGRAM DETAILS: ${programId}`);
    const program = await getProgramDetails(programId);
    
    if (!program) {
      console.error(`${colors.red}Program not found: ${programId}${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.bright}Name:${colors.reset} ${program.name}`);
    console.log(`${colors.bright}Type:${colors.reset} ${program.program_type}`);
    console.log(`${colors.bright}Dates:${colors.reset} ${program.start_date} to ${program.end_date || 'ongoing'}`);
    console.log(`${colors.bright}Repeat:${colors.reset} ${program.repeat_pattern}`);
    console.log(`${colors.bright}Days:${colors.reset} ${program.days_of_week.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`);
    console.log(`${colors.bright}Time:${colors.reset} ${program.start_time} to ${program.end_time}`);
    console.log(`${colors.bright}Venue:${colors.reset} ${program.venue_name} (${program.venue_id})`);
    console.log(`${colors.bright}Created:${colors.reset} ${program.created_at}`);
    
    // Time slots
    console.log(`\n${colors.bright}Time Slots:${colors.reset}`);
    if (program.time_slots && program.time_slots.length > 0) {
      printTable(program.time_slots, 2);
    } else {
      console.log(`  ${colors.yellow}No time slots defined${colors.reset}`);
    }
    
    // Get program participants
    printHeader('PROGRAM PARTICIPANTS');
    const participants = await getProgramParticipants(programId);
    printTable(participants);
    
    // Get billing codes for each participant
    for (const participant of participants) {
      console.log(`\n${colors.bright}Billing Codes for ${participant.first_name} ${participant.last_name}:${colors.reset}`);
      const billingCodes = await getParticipantBillingCodes(programId, participant.participant_id);
      printTable(billingCodes, 2);
    }
    
    // Get loom instances
    printHeader('LOOM INSTANCES');
    const instances = await getLoomInstances(programId);
    printTable(instances);
    
    // Get details for each instance
    for (const instance of instances) {
      console.log(`\n${colors.bright}Instance ${instance.id} (${instance.date}):${colors.reset}`);
      
      // Time slots
      console.log(`\n  ${colors.bright}Time Slots:${colors.reset}`);
      const timeSlots = await getTimeSlots(instance.id);
      printTable(timeSlots, 4);
      
      // Staff shifts
      console.log(`\n  ${colors.bright}Staff Shifts:${colors.reset}`);
      const staffShifts = await getStaffShifts(instance.id);
      printTable(staffShifts, 4);
      
      // Vehicle runs
      console.log(`\n  ${colors.bright}Vehicle Runs:${colors.reset}`);
      const vehicleRuns = await getVehicleRuns(instance.id);
      printTable(vehicleRuns, 4);
    }
    
    // Get loom settings
    printHeader('LOOM SETTINGS');
    const settings = await getLoomSettings();
    printTable(settings);
    
    // Check API routes
    printHeader('API ROUTES');
    const routes = await checkApiRoutes();
    printTable(routes);
    
    // Check frontend API calls
    printHeader('FRONTEND API CALLS');
    const apiCalls = await checkFrontendApiCalls();
    
    console.log(`\n${colors.bright}Master Schedule API Calls:${colors.reset}`);
    printTable(apiCalls.masterSchedule, 2);
    
    console.log(`\n${colors.bright}Dashboard API Calls:${colors.reset}`);
    printTable(apiCalls.dashboard, 2);
    
    // UI Visibility Analysis
    printHeader('UI VISIBILITY ANALYSIS');
    
    // Master Schedule analysis
    console.log(`${colors.bright}Master Schedule Card Visibility:${colors.reset}`);
    if (instances.length === 0) {
      console.log(`${colors.red}❌ No loom instances found - nothing will appear on Master Schedule${colors.reset}`);
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`  - Loom window doesn't include the program dates`);
      console.log(`  - Instance generation failed during program creation`);
      console.log(`  - Program start date is outside current loom window`);
    } else {
      console.log(`${colors.green}✅ ${instances.length} loom instances found - should appear on Master Schedule${colors.reset}`);
      console.log(`${colors.yellow}Check if frontend is:${colors.reset}`);
      console.log(`  - Calling /api/v1/loom/instances with correct date range`);
      console.log(`  - Refreshing after program creation`);
      console.log(`  - Looking at the correct date in the calendar`);
    }
    
    // Dashboard analysis
    console.log(`\n${colors.bright}Dashboard Card Visibility:${colors.reset}`);
    let totalTimeSlots = 0;
    for (const instance of instances) {
      const timeSlots = await getTimeSlots(instance.id);
      totalTimeSlots += timeSlots.length;
    }
    
    if (totalTimeSlots === 0) {
      console.log(`${colors.red}❌ No time slot cards found - nothing will appear on Dashboard${colors.reset}`);
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`  - Time slots weren't properly saved during program creation`);
      console.log(`  - Time slot generation failed`);
    } else {
      console.log(`${colors.green}✅ ${totalTimeSlots} time slot cards found - should appear on Dashboard${colors.reset}`);
      console.log(`${colors.yellow}Check if frontend is:${colors.reset}`);
      console.log(`  - Calling /api/v1/dashboard/cards/:date or /api/v1/loom/cards/:date`);
      console.log(`  - Looking at the correct date on Dashboard`);
      console.log(`  - Refreshing after program creation`);
    }
    
    // Next steps
    printHeader('NEXT STEPS');
    console.log(`1. ${colors.green}Check Master Schedule on date: ${colors.bright}${program.start_date}${colors.reset}`);
    console.log(`2. ${colors.green}Check Dashboard on date: ${colors.bright}${program.start_date}${colors.reset}`);
    console.log(`3. ${colors.green}Try manually refreshing both pages${colors.reset}`);
    console.log(`4. ${colors.green}Check browser console for API errors${colors.reset}`);
    console.log(`5. ${colors.green}Verify frontend is calling correct API endpoints${colors.reset}`);
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
