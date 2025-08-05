/**
 * Quick Loom Fix Script
 * 
 * This script quickly fixes loom instances for existing programs
 * by creating instances with valid status values.
 * 
 * Usage: node scripts/quick-loom-fix.js
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
  cyan: '\x1b[36m'
};

/**
 * Get valid enum values for loom_instance_status
 */
async function getValidStatusValues() {
  try {
    // First try to get enum values directly
    const enumQuery = `
      SELECT e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'loom_instance_status'
      ORDER BY e.enumsortorder
    `;
    
    const result = await pool.query(enumQuery);
    
    if (result.rows.length > 0) {
      return result.rows.map(row => row.enumlabel);
    }
    
    // If the enum doesn't exist, check the column type constraints
    const columnQuery = `
      SELECT pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE a.attname = 'status' 
        AND c.conrelid = 'tgl_loom_instances'::regclass
        AND c.contype = 'c'
    `;
    
    const constraintResult = await pool.query(columnQuery);
    
    if (constraintResult.rows.length > 0) {
      // Extract values from constraint definition like CHECK (status = ANY (ARRAY['PLANNED', 'ACTIVE', ...]))
      const constraintDef = constraintResult.rows[0].pg_get_constraintdef;
      const match = constraintDef.match(/ARRAY\[(.*?)\]/);
      
      if (match && match[1]) {
        return match[1].split(',').map(s => s.trim().replace(/'/g, ''));
      }
    }
    
    // If we can't determine the valid values, use common status values
    return ['ACTIVE', 'PLANNED', 'CONFIRMED', 'PENDING'];
    
  } catch (error) {
    console.error(`${colors.red}Error getting enum values:${colors.reset}`, error.message);
    // Return fallback values
    return ['ACTIVE', 'PLANNED', 'CONFIRMED', 'PENDING'];
  }
}

/**
 * Get all active programs
 */
async function getActivePrograms() {
  try {
    const result = await pool.query(`
      SELECT id, name, program_type, start_date, end_date, repeat_pattern, 
             days_of_week, venue_id, start_time, end_time, time_slots
      FROM programs
      WHERE active = true
    `);
    
    return result.rows.map(program => ({
      ...program,
      days_of_week: Array.isArray(program.days_of_week) 
        ? program.days_of_week 
        : JSON.parse(program.days_of_week || '[]'),
      time_slots: Array.isArray(program.time_slots)
        ? program.time_slots
        : JSON.parse(program.time_slots || '[]')
    }));
  } catch (error) {
    console.error(`${colors.red}Error getting programs:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Create loom instances for a program
 */
async function createLoomInstances(program, validStatus) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`\n${colors.bright}Creating loom instance for program: ${program.name}${colors.reset}`);
    
    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Get program date
    const programDate = new Date(program.start_date);
    const programDateStr = programDate.toISOString().split('T')[0];
    
    // Check if instance already exists
    const existingResult = await client.query(`
      SELECT id FROM tgl_loom_instances 
      WHERE program_id = $1 AND date = $2
    `, [program.id, programDateStr]);
    
    if (existingResult.rows.length > 0) {
      console.log(`${colors.yellow}Instance already exists for ${programDateStr}, skipping${colors.reset}`);
      await client.query('COMMIT');
      return existingResult.rows[0].id;
    }
    
    // Create instance
    console.log(`${colors.yellow}Creating instance for ${programDateStr} with status: ${validStatus}${colors.reset}`);
    
    const instanceResult = await client.query(`
      INSERT INTO tgl_loom_instances
      (program_id, date, start_time, end_time, venue_id, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      program.id,
      programDateStr,
      program.start_time,
      program.end_time,
      program.venue_id,
      validStatus
    ]);
    
    const instanceId = instanceResult.rows[0].id;
    console.log(`${colors.green}✅ Created instance: ${instanceId}${colors.reset}`);
    
    // Create time slots
    console.log(`${colors.yellow}Creating ${program.time_slots.length} time slots...${colors.reset}`);
    
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
    
    // Get program participants
    const participantsResult = await client.query(`
      SELECT participant_id
      FROM program_participants
      WHERE program_id = $1 AND status = 'active'
    `, [program.id]);
    
    const participants = participantsResult.rows.map(p => p.participant_id);
    console.log(`${colors.yellow}Found ${participants.length} participants${colors.reset}`);
    
    // Create participant allocations
    for (const participantId of participants) {
      await client.query(`
        INSERT INTO tgl_loom_participant_allocations
        (instance_id, participant_id, status)
        VALUES ($1, $2, $3)
      `, [
        instanceId,
        participantId,
        'CONFIRMED'
      ]);
    }
    
    if (participants.length > 0) {
      console.log(`${colors.green}✅ Created ${participants.length} participant allocations${colors.reset}`);
    }
    
    // Create staff shifts based on participant count
    const staffCount = Math.max(1, Math.ceil(participants.length / 4));
    console.log(`${colors.yellow}Creating ${staffCount} staff shifts...${colors.reset}`);
    
    // Always create one lead
    await client.query(`
      INSERT INTO tgl_loom_staff_shifts
      (instance_id, role, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      instanceId,
      'LEAD',
      program.start_time,
      program.end_time,
      'PLANNED'
    ]);
    
    // Create support staff if needed
    for (let i = 1; i < staffCount; i++) {
      await client.query(`
        INSERT INTO tgl_loom_staff_shifts
        (instance_id, role, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        instanceId,
        'SUPPORT',
        program.start_time,
        program.end_time,
        'PLANNED'
      ]);
    }
    
    console.log(`${colors.green}✅ Created ${staffCount} staff shifts${colors.reset}`);
    
    // Check for pickup/dropoff slots and create vehicle runs
    const busSlots = program.time_slots.filter(slot => 
      (slot.type && (slot.type.toLowerCase().includes('pick') || slot.type.toLowerCase().includes('drop')))
    );
    
    if (busSlots.length > 0) {
      console.log(`${colors.yellow}Creating ${busSlots.length} vehicle runs...${colors.reset}`);
      
      for (const busSlot of busSlots) {
        const runType = busSlot.type.toLowerCase().includes('pick') ? 'PICKUP' : 'DROPOFF';
        
        await client.query(`
          INSERT INTO tgl_loom_vehicle_runs
          (instance_id, start_time, end_time, passenger_count, route_data)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          instanceId,
          busSlot.start_time,
          busSlot.end_time,
          participants.length,
          JSON.stringify({
            type: runType,
            stops: []
          })
        ]);
      }
      
      console.log(`${colors.green}✅ Created ${busSlots.length} vehicle runs${colors.reset}`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`${colors.green}✅ Successfully created all loom records for ${program.name}${colors.reset}`);
    return instanceId;
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error creating loom instance:${colors.reset}`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}RABS QUICK LOOM FIX${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // Get valid status values
    console.log(`\n${colors.bright}Checking valid status values...${colors.reset}`);
    const validStatusValues = await getValidStatusValues();
    console.log(`${colors.green}Found valid status values: ${validStatusValues.join(', ')}${colors.reset}`);
    
    // Use first valid status value
    const validStatus = validStatusValues[0] || 'ACTIVE';
    console.log(`${colors.yellow}Using status: ${validStatus}${colors.reset}`);
    
    // Get active programs
    console.log(`\n${colors.bright}Finding active programs...${colors.reset}`);
    const programs = await getActivePrograms();
    console.log(`${colors.green}Found ${programs.length} active programs${colors.reset}`);
    
    if (programs.length === 0) {
      console.log(`${colors.red}No active programs found!${colors.reset}`);
      return;
    }
    
    // Create instances for each program
    let successCount = 0;
    for (const program of programs) {
      try {
        await createLoomInstances(program, validStatus);
        successCount++;
      } catch (error) {
        console.error(`${colors.red}Failed to create instance for ${program.name}:${colors.reset}`, error.message);
      }
    }
    
    // Summary
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}SUMMARY${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`${colors.green}Successfully created loom instances for ${successCount} out of ${programs.length} programs${colors.reset}`);
    
    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`1. ${colors.cyan}Restart the server${colors.reset}`);
    console.log(`2. ${colors.cyan}Check Master Schedule on program dates${colors.reset}`);
    console.log(`3. ${colors.cyan}Check Dashboard for time slot cards${colors.reset}`);
    console.log(`4. ${colors.cyan}Check Roster for staff assignments${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
