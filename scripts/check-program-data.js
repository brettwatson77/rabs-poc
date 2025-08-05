/**
 * Check Program Data Script
 * 
 * This script connects to the database and checks what program data is actually
 * being stored. It helps verify if all the frontend form data is making it to 
 * the backend properly.
 * 
 * Usage: node scripts/check-program-data.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rabspocdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
};

console.log(`Using PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port} with user '${dbConfig.user}'`);

// Create database pool
const pool = new Pool(dbConfig);

/**
 * Print section header
 * @param {string} title - Section title
 */
function printHeader(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`📋 ${title}`);
  console.log('='.repeat(80));
}

/**
 * Format JSON data for display
 * @param {Object} data - JSON data
 * @returns {string} - Formatted string
 */
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Get table structure
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} - Table columns and types
 */
async function getTableStructure(tableName) {
  const query = `
    SELECT column_name, data_type, character_maximum_length, 
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Get table constraints
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} - Table constraints
 */
async function getTableConstraints(tableName) {
  const query = `
    SELECT con.conname as constraint_name, 
           pg_get_constraintdef(con.oid) as constraint_definition
    FROM pg_constraint con 
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = $1 
    AND nsp.nspname = 'public';
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Get recent records from a table
 * @param {string} tableName - Name of the table
 * @param {number} limit - Number of records to retrieve
 * @returns {Promise<Array>} - Recent records
 */
async function getRecentRecords(tableName, limit = 5) {
  // Check if table has created_at or updated_at column for sorting
  const columnsResult = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns
    WHERE table_name = $1
    AND column_name IN ('created_at', 'updated_at');
  `, [tableName]);
  
  let orderByClause = '';
  if (columnsResult.rows.length > 0) {
    // Use created_at or updated_at for sorting if available
    const timeColumn = columnsResult.rows.find(row => row.column_name === 'created_at') 
      ? 'created_at' 
      : 'updated_at';
    orderByClause = `ORDER BY ${timeColumn} DESC`;
  }
  
  const query = `
    SELECT * 
    FROM ${tableName}
    ${orderByClause}
    LIMIT $1;
  `;
  
  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Get program-related records
 * @param {string} programId - Program ID
 * @returns {Promise<Object>} - Related records
 */
async function getProgramRelatedData(programId) {
  const data = {};
  
  // Check if program_participants table exists
  try {
    const participantsQuery = `
      SELECT * FROM program_participants WHERE program_id = $1;
    `;
    const participantsResult = await pool.query(participantsQuery, [programId]);
    data.participants = participantsResult.rows;
  } catch (error) {
    data.participants = { error: 'Table might not exist or query failed' };
  }
  
  // Check if billing_codes table exists
  try {
    const billingQuery = `
      SELECT * FROM billing_codes WHERE program_id = $1;
    `;
    const billingResult = await pool.query(billingQuery, [programId]);
    data.billing = billingResult.rows;
  } catch (error) {
    data.billing = { error: 'Table might not exist or query failed' };
  }
  
  // Try to get time slots from programs.time_slots JSONB field
  try {
    const timeSlotQuery = `
      SELECT time_slots FROM programs WHERE id = $1;
    `;
    const timeSlotResult = await pool.query(timeSlotQuery, [programId]);
    if (timeSlotResult.rows.length > 0 && timeSlotResult.rows[0].time_slots) {
      data.timeSlots = timeSlotResult.rows[0].time_slots;
    }
  } catch (error) {
    data.timeSlots = { error: 'Field might not exist or query failed' };
  }
  
  // Check if venue exists
  try {
    const venueQuery = `
      SELECT v.* 
      FROM venues v
      JOIN programs p ON p.venue_id = v.id
      WHERE p.id = $1;
    `;
    const venueResult = await pool.query(venueQuery, [programId]);
    data.venue = venueResult.rows[0] || { error: 'No venue found' };
  } catch (error) {
    data.venue = { error: 'Table might not exist or query failed' };
  }
  
  return data;
}

/**
 * Analyze what frontend data made it to the backend
 * @param {Object} programData - Program data from database
 * @returns {Object} - Analysis results
 */
function analyzeDataCompleteness(programData) {
  const analysis = {
    basicInfo: {
      name: Boolean(programData.name),
      program_type: Boolean(programData.program_type),
      notes: 'notes' in programData
    },
    dates: {
      start_date: Boolean(programData.start_date),
      end_date: 'end_date' in programData,
      repeat_pattern: Boolean(programData.repeat_pattern),
      days_of_week: Boolean(programData.days_of_week) && 
                   Array.isArray(programData.days_of_week) && 
                   programData.days_of_week.length > 0
    },
    times: {
      start_time: Boolean(programData.start_time),
      end_time: Boolean(programData.end_time),
      time_slots: Boolean(programData.time_slots) && 
                 Array.isArray(programData.time_slots) && 
                 programData.time_slots.length > 0
    },
    venue: {
      venue_id: Boolean(programData.venue_id)
    },
    staffing: {
      staff_assignment_mode: Boolean(programData.staff_assignment_mode),
      additional_staff_count: 'additional_staff_count' in programData
    }
  };
  
  // Calculate completeness percentage
  let totalFields = 0;
  let presentFields = 0;
  
  Object.values(analysis).forEach(category => {
    Object.values(category).forEach(present => {
      totalFields++;
      if (present === true) presentFields++;
    });
  });
  
  analysis.completenessScore = Math.round((presentFields / totalFields) * 100);
  
  return analysis;
}

/**
 * Main function
 */
async function main() {
  try {
    printHeader('Database Connection Test');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    console.log(`✅ Connection successful! Server time: ${result.rows[0].now}`);
    client.release();
    
    // 1. Show programs table structure
    printHeader('Programs Table Structure');
    const programsColumns = await getTableStructure('programs');
    console.table(programsColumns);
    
    // Show constraints
    printHeader('Programs Table Constraints');
    const programsConstraints = await getTableConstraints('programs');
    console.table(programsConstraints);
    
    // 2. Show recent program records
    printHeader('Recent Program Records');
    const programs = await getRecentRecords('programs', 3);
    
    if (programs.length === 0) {
      console.log('⚠️ No program records found in the database');
    } else {
      programs.forEach((program, index) => {
        console.log(`\n📝 Program #${index + 1}: ${program.name || program.id}`);
        
        // Basic info
        console.log('\n🔹 Basic Information:');
        console.log(`ID: ${program.id}`);
        console.log(`Name: ${program.name}`);
        console.log(`Type: ${program.program_type}`);
        console.log(`Status: ${program.active ? 'Active' : 'Inactive'}`);
        console.log(`Notes: ${program.notes || 'None'}`);
        
        // Dates and times
        console.log('\n🔹 Dates & Times:');
        console.log(`Start Date: ${program.start_date}`);
        console.log(`End Date: ${program.end_date || 'None (ongoing)'}`);
        console.log(`Repeat Pattern: ${program.repeat_pattern}`);
        console.log(`Days of Week: ${formatJson(program.days_of_week)}`);
        console.log(`Start Time: ${program.start_time}`);
        console.log(`End Time: ${program.end_time}`);
        
        // Venue
        console.log('\n🔹 Venue:');
        console.log(`Venue ID: ${program.venue_id || 'None'}`);
        
        // Staffing
        console.log('\n🔹 Staffing:');
        console.log(`Staff Assignment Mode: ${program.staff_assignment_mode}`);
        console.log(`Additional Staff Count: ${program.additional_staff_count}`);
        
        // Time slots
        console.log('\n🔹 Time Slots:');
        if (program.time_slots && Array.isArray(program.time_slots)) {
          console.log(`${program.time_slots.length} time slots found:`);
          console.log(formatJson(program.time_slots));
        } else {
          console.log('No time slots found or not in expected format');
        }
        
        // Get related data
        getProgramRelatedData(program.id).then(relatedData => {
          // Participants
          console.log('\n🔹 Participants:');
          if (Array.isArray(relatedData.participants)) {
            console.log(`${relatedData.participants.length} participants found`);
            if (relatedData.participants.length > 0) {
              console.log(formatJson(relatedData.participants));
            }
          } else {
            console.log('Participant data not available');
          }
          
          // Billing codes
          console.log('\n🔹 Billing Codes:');
          if (Array.isArray(relatedData.billing)) {
            console.log(`${relatedData.billing.length} billing codes found`);
            if (relatedData.billing.length > 0) {
              console.log(formatJson(relatedData.billing));
            }
          } else {
            console.log('Billing data not available');
          }
          
          // Venue details
          console.log('\n🔹 Venue Details:');
          if (relatedData.venue && !relatedData.venue.error) {
            console.log(formatJson(relatedData.venue));
          } else {
            console.log('Venue details not available');
          }
          
          // Analyze data completeness
          console.log('\n🔹 Frontend to Backend Data Analysis:');
          const analysis = analyzeDataCompleteness(program);
          console.log(`Data Completeness Score: ${analysis.completenessScore}%`);
          console.log('\nBasic Info:');
          console.table(analysis.basicInfo);
          console.log('\nDates:');
          console.table(analysis.dates);
          console.log('\nTimes:');
          console.table(analysis.times);
          console.log('\nVenue:');
          console.table(analysis.venue);
          console.log('\nStaffing:');
          console.table(analysis.staffing);
          
          // Recommendations
          if (analysis.completenessScore < 100) {
            console.log('\n⚠️ Some frontend data might not be making it to the backend.');
            console.log('Check the fields marked as false above.');
          } else {
            console.log('\n✅ All expected frontend data is being stored in the backend.');
          }
          
          console.log('\n' + '-'.repeat(80));
        });
      });
    }
    
    // 3. Show venues table structure and data
    printHeader('Venues Table Structure');
    try {
      const venuesColumns = await getTableStructure('venues');
      console.table(venuesColumns);
      
      printHeader('Recent Venue Records');
      const venues = await getRecentRecords('venues', 3);
      console.table(venues);
    } catch (error) {
      console.log('⚠️ Could not retrieve venues table information');
    }
    
    // Keep connection open for async operations to complete
    setTimeout(() => {
      pool.end();
      console.log('\n✨ Database check completed!');
    }, 5000);
    
  } catch (error) {
    console.error('\n❌ Error:');
    console.error(error.message);
    pool.end();
    process.exit(1);
  }
}

// Run the script
main();
