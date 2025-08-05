/**
 * Quick Fix for August 6th Cards
 * 
 * This script fixes the date issue by:
 * 1. Setting program date to August 6th, 2025 (Wednesday)
 * 2. Creating loom instance specifically for August 6th
 * 3. Creating time slots for that instance
 * 4. Verifying cards will appear for August 6th
 * 
 * Usage: node scripts/quick-fix-august-6.js
 */

const { Pool } = require('pg');

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
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Main function
 */
async function main() {
  const client = await pool.connect();
  
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}AUGUST 6TH QUICK FIX${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Get the program ID for "wednesday walks"
    console.log(`\n${colors.bright}Finding wednesday walks program...${colors.reset}`);
    const programResult = await client.query(`
      SELECT id, name, program_type, venue_id, start_time, end_time, time_slots
      FROM programs
      WHERE name = 'wednesday walks' AND active = true
    `);
    
    if (programResult.rows.length === 0) {
      throw new Error('Could not find wednesday walks program');
    }
    
    const program = programResult.rows[0];
    console.log(`${colors.green}✅ Found program: ${program.name} (${program.id})${colors.reset}`);
    
    // Parse time slots
    program.time_slots = Array.isArray(program.time_slots) 
      ? program.time_slots 
      : JSON.parse(program.time_slots || '[]');
    
    // 2. Update program date to August 6th, 2025
    console.log(`\n${colors.bright}Updating program date to August 6th, 2025...${colors.reset}`);
    
    // Create exact date for August 6th, 2025
    const newDate = new Date(2025, 7, 6); // Month is 0-based, so 7 = August
    
    await client.query(`
      UPDATE programs
      SET start_date = $1, end_date = $2
      WHERE id = $3
    `, [newDate, newDate, program.id]);
    
    console.log(`${colors.green}✅ Updated program dates to 2025-08-06${colors.reset}`);
    
    // Update program participants dates
    await client.query(`
      UPDATE program_participants
      SET start_date = $1, end_date = $2
      WHERE program_id = $3
    `, [newDate, newDate, program.id]);
    
    console.log(`${colors.green}✅ Updated program participant dates to 2025-08-06${colors.reset}`);
    
    // 3. Delete any existing instances for this program
    console.log(`\n${colors.bright}Deleting existing loom instances...${colors.reset}`);
    
    // First delete time slots for any existing instances
    const existingInstancesResult = await client.query(`
      SELECT id FROM tgl_loom_instances
      WHERE program_id = $1
    `, [program.id]);
    
    for (const row of existingInstancesResult.rows) {
      await client.query(`
        DELETE FROM tgl_loom_time_slots
        WHERE instance_id = $1
      `, [row.id]);
    }
    
    // Then delete the instances
    const deleteResult = await client.query(`
      DELETE FROM tgl_loom_instances
      WHERE program_id = $1
      RETURNING id
    `, [program.id]);
    
    console.log(`${colors.green}✅ Deleted ${deleteResult.rowCount} existing instances${colors.reset}`);
    
    // 4. Create new instance for August 6th
    console.log(`\n${colors.bright}Creating new instance for August 6th...${colors.reset}`);
    
    // Format date as YYYY-MM-DD
    const dateStr = '2025-08-06';
    
    // Create new instance with both date columns set to August 6th
    const instanceResult = await client.query(`
      INSERT INTO tgl_loom_instances
      (program_id, date, instance_date, start_time, end_time, venue_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      program.id,
      dateStr,
      dateStr,
      program.start_time,
      program.end_time,
      program.venue_id,
      'draft'
    ]);
    
    const instanceId = instanceResult.rows[0].id;
    console.log(`${colors.green}✅ Created instance: ${instanceId}${colors.reset}`);
    
    // 5. Create time slots
    console.log(`\n${colors.bright}Creating time slots...${colors.reset}`);
    
    for (const slot of program.time_slots) {
      // Determine card type from slot type
      let cardType = 'ACTIVITY';
      if (slot.type) {
        const type = slot.type.toLowerCase();
        if (type.includes('pick')) cardType = 'PICKUP';
        else if (type.includes('drop')) cardType = 'DROPOFF';
        else cardType = 'ACTIVITY';
      }
      
      await client.query(`
        INSERT INTO tgl_loom_time_slots
        (instance_id, start_time, end_time, label, card_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        instanceId,
        slot.start_time,
        slot.end_time,
        slot.label || '',
        cardType
      ]);
    }
    
    console.log(`${colors.green}✅ Created ${program.time_slots.length} time slots${colors.reset}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    // 6. Verify cards will appear
    console.log(`\n${colors.bright}Verifying cards will appear for August 6th...${colors.reset}`);
    
    const verifyResult = await pool.query(`
      SELECT i.id, i.date, i.instance_date, 
             (SELECT COUNT(*) FROM tgl_loom_time_slots WHERE instance_id = i.id) as slot_count
      FROM tgl_loom_instances i
      WHERE (i.date = $1 OR i.instance_date = $1)
    `, [dateStr]);
    
    if (verifyResult.rows.length === 0) {
      console.log(`${colors.red}❌ No loom instances found for date ${dateStr}${colors.reset}`);
    } else {
      const totalSlots = verifyResult.rows.reduce((sum, row) => sum + parseInt(row.slot_count), 0);
      
      console.log(`${colors.green}✅ Found ${verifyResult.rows.length} loom instances for date ${dateStr}${colors.reset}`);
      console.log(`${colors.green}✅ Found ${totalSlots} time slots for date ${dateStr}${colors.reset}`);
      
      // All checks passed
      console.log(`\n${colors.bright}${colors.magenta}DEMO READY!${colors.reset} Your cards should now appear on:`);
      console.log(`1. ${colors.cyan}Master Schedule - August 6th, 2025${colors.reset}`);
      console.log(`2. ${colors.cyan}Dashboard - August 6th, 2025${colors.reset}`);
      console.log(`3. ${colors.cyan}Roster - August 6th, 2025${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`1. ${colors.cyan}Restart the server${colors.reset}`);
    console.log(`2. ${colors.cyan}Check Master Schedule on August 6th, 2025${colors.reset}`);
    console.log(`3. ${colors.cyan}Check Dashboard for time slot cards${colors.reset}`);
    console.log(`4. ${colors.cyan}Check Roster for staff assignments${colors.reset}`);
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
