/**
 * Fix Program Date Script
 * 
 * This script fixes the date mismatch issue by:
 * 1. Checking the current program's start_date and end_date
 * 2. Updating from August 5th to August 6th (Wednesday)
 * 3. Deleting existing loom instances for the wrong date
 * 4. Creating new loom instances for August 6th
 * 5. Creating time slots for the correct date
 * 
 * Usage: node scripts/fix-program-date.js
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
    return ['draft', 'planned', 'staffed', 'ready', 'completed'];
    
  } catch (error) {
    console.error(`${colors.red}Error getting enum values:${colors.reset}`, error.message);
    // Return fallback values
    return ['draft', 'planned', 'staffed', 'ready', 'completed'];
  }
}

/**
 * Check table columns to understand schema
 */
async function checkTableColumns(tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}Error checking table columns:${colors.reset}`, error.message);
    return [];
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
 * Update program date from August 5th to August 6th
 */
async function updateProgramDate(program) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`\n${colors.bright}Updating program date for: ${program.name}${colors.reset}`);
    
    // Get current date
    const currentStartDate = new Date(program.start_date);
    const currentEndDate = new Date(program.end_date);
    
    console.log(`${colors.yellow}Current start date: ${currentStartDate.toISOString().split('T')[0]}${colors.reset}`);
    console.log(`${colors.yellow}Current end date: ${currentEndDate.toISOString().split('T')[0]}${colors.reset}`);
    
    // Create new dates (August 6th, 2025)
    const newDate = new Date(2025, 7, 6); // Month is 0-based, so 7 = August
    const newDateStr = newDate.toISOString().split('T')[0];
    
    console.log(`${colors.yellow}New date: ${newDateStr}${colors.reset}`);
    
    // Update program dates
    await client.query(`
      UPDATE programs
      SET start_date = $1, end_date = $2
      WHERE id = $3
    `, [newDate, newDate, program.id]);
    
    console.log(`${colors.green}✅ Updated program dates to ${newDateStr}${colors.reset}`);
    
    // Update program participants dates
    await client.query(`
      UPDATE program_participants
      SET start_date = $1, end_date = $2
      WHERE program_id = $3
    `, [newDate, newDate, program.id]);
    
    console.log(`${colors.green}✅ Updated program participant dates to ${newDateStr}${colors.reset}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Return updated program
    return {
      ...program,
      start_date: newDate,
      end_date: newDate
    };
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error updating program date:${colors.reset}`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete existing loom instances for the wrong date
 */
async function deleteExistingInstances(programId) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`\n${colors.bright}Deleting existing loom instances for program: ${programId}${colors.reset}`);
    
    // Find existing instances
    const instancesResult = await client.query(`
      SELECT id 
      FROM tgl_loom_instances
      WHERE program_id = $1
    `, [programId]);
    
    if (instancesResult.rows.length === 0) {
      console.log(`${colors.yellow}No existing instances found${colors.reset}`);
      await client.query('COMMIT');
      return 0;
    }
    
    const instanceIds = instancesResult.rows.map(row => row.id);
    console.log(`${colors.yellow}Found ${instanceIds.length} existing instances to delete${colors.reset}`);
    
    // Delete time slots for these instances
    for (const instanceId of instanceIds) {
      const timeSlotsResult = await client.query(`
        DELETE FROM tgl_loom_time_slots
        WHERE instance_id = $1
        RETURNING id
      `, [instanceId]);
      
      console.log(`${colors.yellow}Deleted ${timeSlotsResult.rowCount} time slots for instance ${instanceId}${colors.reset}`);
    }
    
    // Delete instances
    const deleteResult = await client.query(`
      DELETE FROM tgl_loom_instances
      WHERE program_id = $1
      RETURNING id
    `, [programId]);
    
    console.log(`${colors.green}✅ Deleted ${deleteResult.rowCount} loom instances${colors.reset}`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return deleteResult.rowCount;
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error deleting existing instances:${colors.reset}`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create loom instances for the correct date
 */
async function createLoomInstances(program, validStatus, columns) {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log(`\n${colors.bright}Creating loom instance for program: ${program.name}${colors.reset}`);
    
    // Get program date
    const programDate = new Date(program.start_date);
    const programDateStr = programDate.toISOString().split('T')[0];
    
    console.log(`${colors.yellow}Program date: ${programDateStr}${colors.reset}`);
    
    // Build dynamic INSERT query based on actual columns
    const hasDateColumn = columns.some(col => col.column_name === 'date');
    const hasInstanceDateColumn = columns.some(col => col.column_name === 'instance_date');
    
    let columnNames = ['program_id', 'start_time', 'end_time', 'venue_id', 'status'];
    let placeholders = ['$1', '$2', '$3', '$4', '$5'];
    let values = [program.id, program.start_time, program.end_time, program.venue_id, validStatus];
    let paramIndex = 6;
    
    // Add date columns
    if (hasDateColumn) {
      columnNames.push('date');
      placeholders.push(`$${paramIndex}`);
      values.push(programDateStr);
      paramIndex++;
    }
    
    if (hasInstanceDateColumn) {
      columnNames.push('instance_date');
      placeholders.push(`$${paramIndex}`);
      values.push(programDateStr);
      paramIndex++;
    }
    
    const insertQuery = `
      INSERT INTO tgl_loom_instances
      (${columnNames.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING id
    `;
    
    console.log(`${colors.yellow}Using columns: ${columnNames.join(', ')}${colors.reset}`);
    
    const instanceResult = await client.query(insertQuery, values);
    
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
    
    // Check if tgl_loom_participant_allocations table exists and has the right columns
    try {
      // Check if the table exists
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tgl_loom_participant_allocations'
        )
      `);
      
      if (tableResult.rows[0].exists) {
        // Check the column name - could be instance_id or loom_instance_id
        const columnResult = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'tgl_loom_participant_allocations'
          AND column_name LIKE '%instance%'
        `);
        
        if (columnResult.rows.length > 0) {
          const instanceColumn = columnResult.rows[0].column_name;
          console.log(`${colors.yellow}Using column ${instanceColumn} for participant allocations${colors.reset}`);
          
          // Create participant allocations
          for (const participantId of participants) {
            await client.query(`
              INSERT INTO tgl_loom_participant_allocations
              (${instanceColumn}, participant_id, status)
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
        }
      }
    } catch (error) {
      console.log(`${colors.yellow}Note: Could not create participant allocations: ${error.message}${colors.reset}`);
      console.log(`${colors.yellow}This is not critical for card display${colors.reset}`);
    }
    
    // Check if tgl_loom_staff_shifts table exists
    try {
      // Check if the table exists
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tgl_loom_staff_shifts'
        )
      `);
      
      if (tableResult.rows[0].exists) {
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
      }
    } catch (error) {
      console.log(`${colors.yellow}Note: Could not create staff shifts: ${error.message}${colors.reset}`);
      console.log(`${colors.yellow}This is not critical for card display${colors.reset}`);
    }
    
    // Check if tgl_loom_vehicle_runs table exists
    try {
      // Check if the table exists
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tgl_loom_vehicle_runs'
        )
      `);
      
      if (tableResult.rows[0].exists) {
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
      }
    } catch (error) {
      console.log(`${colors.yellow}Note: Could not create vehicle runs: ${error.message}${colors.reset}`);
      console.log(`${colors.yellow}This is not critical for card display${colors.reset}`);
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
 * Verify cards will appear
 */
async function verifyCards(date) {
  console.log(`\n${colors.bright}Verifying cards will appear for date: ${date}${colors.reset}`);
  
  try {
    // Check if loom instances exist for the date
    const instancesResult = await pool.query(`
      SELECT id FROM tgl_loom_instances
      WHERE date = $1 OR instance_date = $1
    `, [date]);
    
    if (instancesResult.rows.length === 0) {
      console.log(`${colors.red}❌ No loom instances found for date ${date}${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✅ Found ${instancesResult.rows.length} loom instances for date ${date}${colors.reset}`);
    
    // Check if time slots exist for these instances
    const instanceIds = instancesResult.rows.map(row => row.id);
    
    const timeSlotsResult = await pool.query(`
      SELECT COUNT(*) as count FROM tgl_loom_time_slots
      WHERE instance_id IN (${instanceIds.map((_, i) => `$${i + 1}`).join(', ')})
    `, instanceIds);
    
    const timeSlotCount = parseInt(timeSlotsResult.rows[0].count);
    
    if (timeSlotCount === 0) {
      console.log(`${colors.red}❌ No time slots found for instances on date ${date}${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✅ Found ${timeSlotCount} time slots for date ${date}${colors.reset}`);
    
    // All checks passed
    console.log(`${colors.green}${colors.bright}✅ Cards should now appear for date ${date}!${colors.reset}`);
    return true;
    
  } catch (error) {
    console.error(`${colors.red}Error verifying cards:${colors.reset}`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}RABS PROGRAM DATE FIX${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // Check table structure
    console.log(`\n${colors.bright}Checking tgl_loom_instances table structure...${colors.reset}`);
    const columns = await checkTableColumns('tgl_loom_instances');
    
    if (columns.length === 0) {
      console.error(`${colors.red}Error: Could not get table structure!${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.green}Found ${columns.length} columns in tgl_loom_instances table${colors.reset}`);
    
    // Check for date columns
    const dateColumns = columns.filter(col => 
      col.column_name === 'date' || col.column_name === 'instance_date'
    );
    
    console.log(`${colors.yellow}Date columns:${colors.reset}`);
    dateColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Get valid status values
    console.log(`\n${colors.bright}Checking valid status values...${colors.reset}`);
    const validStatusValues = await getValidStatusValues();
    console.log(`${colors.green}Found valid status values: ${validStatusValues.join(', ')}${colors.reset}`);
    
    // Use first valid status value
    const validStatus = validStatusValues[0] || 'draft';
    console.log(`${colors.yellow}Using status: ${validStatus}${colors.reset}`);
    
    // Get active programs
    console.log(`\n${colors.bright}Finding active programs...${colors.reset}`);
    const programs = await getActivePrograms();
    console.log(`${colors.green}Found ${programs.length} active programs${colors.reset}`);
    
    if (programs.length === 0) {
      console.log(`${colors.red}No active programs found!${colors.reset}`);
      return;
    }
    
    // Process each program
    let successCount = 0;
    for (const program of programs) {
      try {
        // 1. Update program date
        const updatedProgram = await updateProgramDate(program);
        
        // 2. Delete existing instances
        await deleteExistingInstances(program.id);
        
        // 3. Create new instances
        await createLoomInstances(updatedProgram, validStatus, columns);
        
        successCount++;
      } catch (error) {
        console.error(`${colors.red}Failed to process program ${program.name}:${colors.reset}`, error.message);
      }
    }
    
    // 4. Verify cards will appear
    const targetDate = '2025-08-06';
    const cardsWillAppear = await verifyCards(targetDate);
    
    // Summary
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}SUMMARY${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`${colors.green}Successfully processed ${successCount} out of ${programs.length} programs${colors.reset}`);
    
    if (cardsWillAppear) {
      console.log(`\n${colors.bright}${colors.magenta}DEMO READY!${colors.reset} Your cards should now appear on:`);
      console.log(`1. ${colors.cyan}Master Schedule - August 6th, 2025${colors.reset}`);
      console.log(`2. ${colors.cyan}Dashboard - August 6th, 2025${colors.reset}`);
      console.log(`3. ${colors.cyan}Roster - August 6th, 2025${colors.reset}`);
    } else {
      console.log(`\n${colors.red}Cards may still not appear. Please check the logs for errors.${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`1. ${colors.cyan}Restart the server${colors.reset}`);
    console.log(`2. ${colors.cyan}Check Master Schedule on August 6th, 2025${colors.reset}`);
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
