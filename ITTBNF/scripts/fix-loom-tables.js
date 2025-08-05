/**
 * Fix Loom Tables Script
 * 
 * This script fixes database schema issues that prevent loom cards from appearing:
 * 1. Checks what columns exist in tgl_loom_instances table
 * 2. Creates the missing participant_billing_codes table
 * 3. Fixes column name mismatches (like "date" vs "scheduled_date")
 * 4. Ensures all tables needed for loom functionality exist
 * 
 * Usage: node scripts/fix-loom-tables.js
 */

const { Pool } = require('pg');
const readline = require('readline');

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

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for confirmation
const confirm = (message) => {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${message} (y/N): ${colors.reset}`, (answer) => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
};

/**
 * Check if a table exists in the database
 */
async function tableExists(client, tableName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `, [tableName]);
  
  return result.rows[0].exists;
}

/**
 * Get columns for a table
 */
async function getTableColumns(client, tableName) {
  const result = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows;
}

/**
 * Check if a column exists in a table
 */
async function columnExists(client, tableName, columnName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    )
  `, [tableName, columnName]);
  
  return result.rows[0].exists;
}

/**
 * Check and fix the tgl_loom_instances table
 */
async function fixLoomInstancesTable(client) {
  console.log(`\n${colors.bright}Checking tgl_loom_instances table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_instances'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ tgl_loom_instances table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating tgl_loom_instances table...${colors.reset}`);
    
    await client.query(`
      CREATE TABLE tgl_loom_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
        capacity INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'GENERATED',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created tgl_loom_instances table${colors.reset}`);
    return true;
  }
  
  // Check if the date column exists
  const dateColumnExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_instances'
      AND column_name = 'date'
    )
  `);
  
  if (!dateColumnExists.rows[0].exists) {
    console.log(`${colors.red}❌ 'date' column does not exist in tgl_loom_instances table${colors.reset}`);
    
    // Check what column might be used instead
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_instances'
      AND data_type LIKE '%date%'
    `);
    
    if (columns.rows.length > 0) {
      console.log(`${colors.yellow}Found possible date columns:${colors.reset}`);
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      // If there's a scheduled_date column, rename it to date
      const hasScheduledDate = columns.rows.some(col => col.column_name === 'scheduled_date');
      
      if (hasScheduledDate) {
        console.log(`${colors.yellow}Renaming 'scheduled_date' to 'date'...${colors.reset}`);
        await client.query(`
          ALTER TABLE tgl_loom_instances
          RENAME COLUMN scheduled_date TO date
        `);
        console.log(`${colors.green}✅ Renamed 'scheduled_date' to 'date'${colors.reset}`);
        return true;
      } else {
        // Add the date column
        console.log(`${colors.yellow}Adding 'date' column to tgl_loom_instances...${colors.reset}`);
        await client.query(`
          ALTER TABLE tgl_loom_instances
          ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE
        `);
        console.log(`${colors.green}✅ Added 'date' column to tgl_loom_instances${colors.reset}`);
        return true;
      }
    } else {
      // Add the date column
      console.log(`${colors.yellow}Adding 'date' column to tgl_loom_instances...${colors.reset}`);
      await client.query(`
        ALTER TABLE tgl_loom_instances
        ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE
      `);
      console.log(`${colors.green}✅ Added 'date' column to tgl_loom_instances${colors.reset}`);
      return true;
    }
  }
  
  console.log(`${colors.green}✅ tgl_loom_instances table looks good${colors.reset}`);
  return false;
}

/**
 * Create the participant_billing_codes table if it doesn't exist
 */
async function createParticipantBillingCodesTable(client) {
  console.log(`\n${colors.bright}Checking participant_billing_codes table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'participant_billing_codes'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ participant_billing_codes table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating participant_billing_codes table...${colors.reset}`);
    
    await client.query(`
      CREATE TABLE participant_billing_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        billing_code TEXT NOT NULL,
        hours NUMERIC(5,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created participant_billing_codes table${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ participant_billing_codes table exists${colors.reset}`);
  return false;
}

/**
 * Check and create the tgl_loom_time_slots table if it doesn't exist
 */
async function createTimeSlotsTables(client) {
  console.log(`\n${colors.bright}Checking tgl_loom_time_slots table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_time_slots'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ tgl_loom_time_slots table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating tgl_loom_time_slots table...${colors.reset}`);
    
    // Check if card_type enum exists
    const enumExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_type
        WHERE typname = 'tgl_card_type'
      )
    `);
    
    if (!enumExists.rows[0].exists) {
      console.log(`${colors.yellow}Creating tgl_card_type enum...${colors.reset}`);
      await client.query(`
        CREATE TYPE tgl_card_type AS ENUM ('PICKUP', 'DROPOFF', 'ACTIVITY', 'PROGRAM')
      `);
    }
    
    await client.query(`
      CREATE TABLE tgl_loom_time_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        label TEXT,
        card_type tgl_card_type NOT NULL DEFAULT 'ACTIVITY',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created tgl_loom_time_slots table${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ tgl_loom_time_slots table exists${colors.reset}`);
  return false;
}

/**
 * Check and create the tgl_loom_participant_allocations table if it doesn't exist
 */
async function createParticipantAllocationsTable(client) {
  console.log(`\n${colors.bright}Checking tgl_loom_participant_allocations table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_participant_allocations'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ tgl_loom_participant_allocations table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating tgl_loom_participant_allocations table...${colors.reset}`);
    
    await client.query(`
      CREATE TABLE tgl_loom_participant_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        billing_code_id TEXT,
        hours NUMERIC(5,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'CONFIRMED',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created tgl_loom_participant_allocations table${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ tgl_loom_participant_allocations table exists${colors.reset}`);
  return false;
}

/**
 * Check and create the tgl_loom_staff_shifts table if it doesn't exist
 */
async function createStaffShiftsTable(client) {
  console.log(`\n${colors.bright}Checking tgl_loom_staff_shifts table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_staff_shifts'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ tgl_loom_staff_shifts table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating tgl_loom_staff_shifts table...${colors.reset}`);
    
    await client.query(`
      CREATE TABLE tgl_loom_staff_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
        staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
        role TEXT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'PLANNED',
        manually_assigned BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created tgl_loom_staff_shifts table${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ tgl_loom_staff_shifts table exists${colors.reset}`);
  return false;
}

/**
 * Check and create the tgl_loom_vehicle_runs table if it doesn't exist
 */
async function createVehicleRunsTable(client) {
  console.log(`\n${colors.bright}Checking tgl_loom_vehicle_runs table...${colors.reset}`);
  
  const tableExists = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'tgl_loom_vehicle_runs'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    console.log(`${colors.red}❌ tgl_loom_vehicle_runs table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Creating tgl_loom_vehicle_runs table...${colors.reset}`);
    
    await client.query(`
      CREATE TABLE tgl_loom_vehicle_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES tgl_loom_instances(id) ON DELETE CASCADE,
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        passenger_count INTEGER DEFAULT 0,
        route_data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    
    console.log(`${colors.green}✅ Created tgl_loom_vehicle_runs table${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ tgl_loom_vehicle_runs table exists${colors.reset}`);
  return false;
}

/**
 * Fix any issues with existing program records
 */
async function fixProgramRecords(client) {
  console.log(`\n${colors.bright}Checking program records...${colors.reset}`);
  
  // Check if there are programs with null time_slots
  const nullTimeSlots = await client.query(`
    SELECT COUNT(*) FROM programs WHERE time_slots IS NULL
  `);
  
  if (parseInt(nullTimeSlots.rows[0].count) > 0) {
    console.log(`${colors.red}❌ Found ${nullTimeSlots.rows[0].count} programs with NULL time_slots${colors.reset}`);
    console.log(`${colors.yellow}Fixing NULL time_slots...${colors.reset}`);
    
    await client.query(`
      UPDATE programs 
      SET time_slots = '[]'::jsonb
      WHERE time_slots IS NULL
    `);
    
    console.log(`${colors.green}✅ Fixed NULL time_slots${colors.reset}`);
    return true;
  }
  
  // Check if there are programs with null days_of_week
  const nullDays = await client.query(`
    SELECT COUNT(*) FROM programs WHERE days_of_week IS NULL
  `);
  
  if (parseInt(nullDays.rows[0].count) > 0) {
    console.log(`${colors.red}❌ Found ${nullDays.rows[0].count} programs with NULL days_of_week${colors.reset}`);
    console.log(`${colors.yellow}Fixing NULL days_of_week...${colors.reset}`);
    
    await client.query(`
      UPDATE programs 
      SET days_of_week = '[]'::jsonb
      WHERE days_of_week IS NULL
    `);
    
    console.log(`${colors.green}✅ Fixed NULL days_of_week${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.green}✅ Program records look good${colors.reset}`);
  return false;
}

/**
 * Migrate billing codes from program_participants to participant_billing_codes
 */
async function migrateBillingCodes(client) {
  console.log(`\n${colors.bright}Checking for billing codes to migrate...${colors.reset}`);
  
  // Check if both tables exist
  const ppExists = await tableExists(client, 'program_participants');
  const pbcExists = await tableExists(client, 'participant_billing_codes');
  
  if (!ppExists || !pbcExists) {
    console.log(`${colors.yellow}Cannot migrate billing codes - required tables don't exist${colors.reset}`);
    return false;
  }
  
  // Check if program_participants has billing_code_id column
  const hasBillingCodeId = await columnExists(client, 'program_participants', 'billing_code_id');
  
  if (hasBillingCodeId) {
    // Count program_participants with billing codes
    const countResult = await client.query(`
      SELECT COUNT(*) FROM program_participants WHERE billing_code_id IS NOT NULL
    `);
    
    const count = parseInt(countResult.rows[0].count);
    
    if (count > 0) {
      console.log(`${colors.yellow}Found ${count} program participants with billing codes to migrate${colors.reset}`);
      
      // Count existing records in participant_billing_codes
      const existingResult = await client.query(`
        SELECT COUNT(*) FROM participant_billing_codes
      `);
      
      const existingCount = parseInt(existingResult.rows[0].count);
      
      if (existingCount > 0) {
        console.log(`${colors.yellow}participant_billing_codes already has ${existingCount} records${colors.reset}`);
        console.log(`${colors.yellow}Skipping migration to avoid duplicates${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.yellow}Migrating billing codes...${colors.reset}`);
      
      // Get billing codes from program_participants
      const billingCodes = await client.query(`
        SELECT 
          pp.program_id, 
          pp.participant_id, 
          pp.billing_code_id, 
          pp.start_date, 
          pp.end_date
        FROM program_participants pp
        WHERE pp.billing_code_id IS NOT NULL
      `);
      
      // Insert into participant_billing_codes
      for (const code of billingCodes.rows) {
        await client.query(`
          INSERT INTO participant_billing_codes
          (program_id, participant_id, billing_code, hours, start_date, end_date, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          code.program_id,
          code.participant_id,
          code.billing_code_id,
          5.0, // Default to 5 hours
          code.start_date,
          code.end_date,
          true
        ]);
      }
      
      console.log(`${colors.green}✅ Migrated ${billingCodes.rows.length} billing codes${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.green}✅ No billing codes to migrate${colors.reset}`);
      return false;
    }
  } else {
    console.log(`${colors.yellow}program_participants doesn't have billing_code_id column${colors.reset}`);
    return false;
  }
}

/**
 * Regenerate loom instances for existing programs
 */
async function regenerateLoomInstances(client) {
  console.log(`\n${colors.bright}Checking if loom instances need regeneration...${colors.reset}`);
  
  // Count existing programs
  const programsResult = await client.query(`
    SELECT COUNT(*) FROM programs WHERE active = true
  `);
  
  const programCount = parseInt(programsResult.rows[0].count);
  
  if (programCount === 0) {
    console.log(`${colors.yellow}No active programs found${colors.reset}`);
    return false;
  }
  
  // Count existing loom instances
  const instancesResult = await client.query(`
    SELECT COUNT(*) FROM tgl_loom_instances
  `);
  
  const instanceCount = parseInt(instancesResult.rows[0].count);
  
  if (instanceCount > 0) {
    console.log(`${colors.green}✅ Found ${instanceCount} existing loom instances${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.yellow}Found ${programCount} active programs but no loom instances${colors.reset}`);
  
  const shouldRegenerate = await confirm("Would you like to regenerate loom instances for all programs?");
  
  if (!shouldRegenerate) {
    console.log(`${colors.yellow}Skipping loom instance regeneration${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.yellow}Regenerating loom instances...${colors.reset}`);
  
  // Get loom window size
  const settingsResult = await client.query(`
    SELECT value FROM settings WHERE key = 'loom_window_weeks'
  `);
  
  const windowWeeks = settingsResult.rows.length > 0 
    ? parseInt(settingsResult.rows[0].value) 
    : 4;
  
  console.log(`${colors.yellow}Using loom window size: ${windowWeeks} weeks${colors.reset}`);
  
  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Calculate end date
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + (windowWeeks * 7));
  const endDateStr = endDate.toISOString().split('T')[0];
  
  console.log(`${colors.yellow}Regenerating instances from ${todayStr} to ${endDateStr}${colors.reset}`);
  
  // Get active programs
  const programs = await client.query(`
    SELECT id, name, program_type, start_date, end_date, repeat_pattern, days_of_week,
           venue_id, start_time, end_time, time_slots
    FROM programs
    WHERE active = true
  `);
  
  let totalInstances = 0;
  
  // Process each program
  for (const program of programs.rows) {
    console.log(`${colors.yellow}Processing program: ${program.name} (${program.id})${colors.reset}`);
    
    // Parse days_of_week
    const daysOfWeek = Array.isArray(program.days_of_week) 
      ? program.days_of_week 
      : JSON.parse(program.days_of_week || '[]');
    
    // Parse time_slots
    const timeSlots = Array.isArray(program.time_slots)
      ? program.time_slots
      : JSON.parse(program.time_slots || '[]');
    
    // Skip programs with no days_of_week
    if (daysOfWeek.length === 0) {
      console.log(`${colors.yellow}  Skipping - no days of week defined${colors.reset}`);
      continue;
    }
    
    // For one-off programs, just create a single instance
    if (program.repeat_pattern === 'none') {
      const programDate = new Date(program.start_date);
      const programDateStr = programDate.toISOString().split('T')[0];
      
      // Only create if within window
      if (programDateStr >= todayStr && programDateStr <= endDateStr) {
        // Create instance
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
          'GENERATED'
        ]);
        
        const instanceId = instanceResult.rows[0].id;
        
        // Create time slots
        for (const slot of timeSlots) {
          await client.query(`
            INSERT INTO tgl_loom_time_slots
            (instance_id, start_time, end_time, label, card_type)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            instanceId,
            slot.start_time,
            slot.end_time,
            slot.label || '',
            slot.type?.toUpperCase() || 'ACTIVITY'
          ]);
        }
        
        totalInstances++;
      }
      
      continue;
    }
    
    // For recurring programs, iterate through the date range
    const startDateObj = new Date(Math.max(
      new Date(program.start_date),
      new Date(todayStr)
    ));
    
    const endDateObj = program.end_date 
      ? new Date(Math.min(
          new Date(program.end_date),
          new Date(endDateStr)
        ))
      : new Date(endDateStr);
    
    let currentDate = new Date(startDateObj);
    let instancesForProgram = 0;
    
    while (currentDate <= endDateObj) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if program runs on this day
      if (daysOfWeek.includes(dayOfWeek)) {
        // For fortnightly programs, check if this is the right week
        if (program.repeat_pattern === 'fortnightly') {
          // Calculate weeks since program start
          const programStart = new Date(program.start_date);
          const weeksSinceStart = Math.floor(
            (currentDate - programStart) / (7 * 24 * 60 * 60 * 1000)
          );
          
          // Only create instance on even weeks
          if (weeksSinceStart % 2 !== 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        // For monthly programs, check if this is the same day of month as start date
        if (program.repeat_pattern === 'monthly') {
          const programStart = new Date(program.start_date);
          
          // Only create instance on same day of month
          if (currentDate.getDate() !== programStart.getDate()) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
        }
        
        // Create instance for this date
        const currentDateStr = currentDate.toISOString().split('T')[0];
        
        // Create instance
        const instanceResult = await client.query(`
          INSERT INTO tgl_loom_instances
          (program_id, date, start_time, end_time, venue_id, status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          program.id,
          currentDateStr,
          program.start_time,
          program.end_time,
          program.venue_id,
          'GENERATED'
        ]);
        
        const instanceId = instanceResult.rows[0].id;
        
        // Create time slots
        for (const slot of timeSlots) {
          await client.query(`
            INSERT INTO tgl_loom_time_slots
            (instance_id, start_time, end_time, label, card_type)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            instanceId,
            slot.start_time,
            slot.end_time,
            slot.label || '',
            slot.type?.toUpperCase() || 'ACTIVITY'
          ]);
        }
        
        instancesForProgram++;
        totalInstances++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`${colors.green}  Created ${instancesForProgram} instances${colors.reset}`);
  }
  
  console.log(`${colors.green}✅ Regenerated ${totalInstances} loom instances for ${programs.rows.length} programs${colors.reset}`);
  return true;
}

/**
 * Main function
 */
async function main() {
  const client = await pool.connect();
  
  try {
    // Banner
    console.log('\n' + '*'.repeat(80));
    console.log(`${colors.bright}${colors.green}RABS LOOM TABLES FIX UTILITY${colors.reset}`);
    console.log('*'.repeat(80));
    console.log(`Database: ${colors.cyan}rabspocdb${colors.reset} at ${colors.cyan}localhost:5432${colors.reset} with user '${colors.cyan}postgres${colors.reset}'`);
    
    // Start transaction
    await client.query('BEGIN');
    
    printHeader('CHECKING DATABASE SCHEMA');
    
    // Fix tables
    let changes = 0;
    
    if (await fixLoomInstancesTable(client)) changes++;
    if (await createParticipantBillingCodesTable(client)) changes++;
    if (await createTimeSlotsTables(client)) changes++;
    if (await createParticipantAllocationsTable(client)) changes++;
    if (await createStaffShiftsTable(client)) changes++;
    if (await createVehicleRunsTable(client)) changes++;
    if (await fixProgramRecords(client)) changes++;
    if (await migrateBillingCodes(client)) changes++;
    
    // Commit transaction
    await client.query('COMMIT');
    
    printHeader('REGENERATING LOOM INSTANCES');
    
    // Regenerate loom instances if needed
    if (await regenerateLoomInstances(client)) changes++;
    
    // Summary
    printHeader('SUMMARY');
    
    if (changes > 0) {
      console.log(`${colors.green}✅ Fixed ${changes} issues with loom tables${colors.reset}`);
      console.log(`${colors.green}✅ Database schema is now ready for loom functionality${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ No issues found - loom tables are correctly configured${colors.reset}`);
    }
    
    console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
    console.log(`1. ${colors.cyan}Restart the server${colors.reset}`);
    console.log(`2. ${colors.cyan}Check Master Schedule on your program date${colors.reset}`);
    console.log(`3. ${colors.cyan}Check Dashboard for time slot cards${colors.reset}`);
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Close readline interface
    rl.close();
    
    // Release client
    client.release();
    
    // Close pool
    await pool.end();
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
