/**
 * Check Participant Tables Script
 * 
 * This script examines the structure of program_participants and related tables
 * to help identify schema mismatches between the database and code.
 * 
 * Specifically checks for the missing "is_active" column that's causing errors.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rabspocdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Create a new pool
const pool = new Pool(dbConfig);

// Console styling
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Helper function to log with colors
const log = {
  info: (msg) => console.log(`${styles.blue}ℹ️ ${msg}${styles.reset}`),
  success: (msg) => console.log(`${styles.green}✅ ${msg}${styles.reset}`),
  error: (msg) => console.log(`${styles.red}❌ ${msg}${styles.reset}`),
  warning: (msg) => console.log(`${styles.yellow}⚠️ ${msg}${styles.reset}`),
  header: (msg) => console.log(`\n${styles.bright}${styles.cyan}${msg}${styles.reset}\n${'='.repeat(80)}`),
};

/**
 * Get table structure from information_schema
 */
async function getTableStructure(client, tableName) {
  const query = `
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length, 
      is_nullable, 
      column_default
    FROM 
      information_schema.columns
    WHERE 
      table_name = $1
      AND table_schema = 'public'
    ORDER BY 
      ordinal_position;
  `;
  
  try {
    const result = await client.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    log.error(`Error getting structure for table ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Get table constraints from information_schema
 */
async function getTableConstraints(client, tableName) {
  const query = `
    SELECT 
      tc.constraint_name,
      pg_get_constraintdef(pgc.oid) as constraint_definition
    FROM 
      information_schema.table_constraints tc
      JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
      JOIN pg_namespace nsp ON nsp.oid = pgc.connamespace
      JOIN pg_class cls ON pgc.conrelid = cls.oid
    WHERE 
      tc.table_name = $1
      AND tc.table_schema = 'public'
    ORDER BY 
      tc.constraint_name;
  `;
  
  try {
    const result = await client.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    log.error(`Error getting constraints for table ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Get foreign key relationships for a table
 */
async function getTableRelationships(client, tableName) {
  const query = `
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
      AND tc.table_schema = 'public';
  `;
  
  try {
    const result = await client.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    log.error(`Error getting relationships for table ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Get tables that reference this table
 */
async function getReferencingTables(client, tableName) {
  const query = `
    SELECT
      tc.table_name AS referencing_table,
      kcu.column_name AS referencing_column,
      ccu.column_name AS referenced_column
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = $1
      AND tc.table_schema = 'public';
  `;
  
  try {
    const result = await client.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    log.error(`Error getting referencing tables for table ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Get a list of all tables in the database
 */
async function getAllTables(client) {
  const query = `
    SELECT 
      table_name
    FROM 
      information_schema.tables
    WHERE 
      table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY 
      table_name;
  `;
  
  try {
    const result = await client.query(query);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    log.error(`Error getting all tables: ${error.message}`);
    return [];
  }
}

/**
 * Find participant-related tables
 */
async function findParticipantTables(client) {
  const allTables = await getAllTables(client);
  return allTables.filter(table => 
    table.includes('participant') || 
    table.includes('program') || 
    table.includes('billing') ||
    table.includes('enrollment')
  );
}

/**
 * Check if a table exists
 */
async function tableExists(client, tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  try {
    const result = await client.query(query, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    log.error(`Error checking if table ${tableName} exists: ${error.message}`);
    return false;
  }
}

/**
 * Check if a column exists in a table
 */
async function columnExists(client, tableName, columnName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    );
  `;
  
  try {
    const result = await client.query(query, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (error) {
    log.error(`Error checking if column ${columnName} exists in table ${tableName}: ${error.message}`);
    return false;
  }
}

/**
 * Get sample data from a table
 */
async function getSampleData(client, tableName, limit = 5) {
  try {
    const result = await client.query(`SELECT * FROM ${tableName} LIMIT ${limit}`);
    return result.rows;
  } catch (error) {
    log.error(`Error getting sample data from table ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Print table structure in a nice format
 */
function printTableStructure(structure) {
  console.table(structure);
}

/**
 * Print table constraints in a nice format
 */
function printTableConstraints(constraints) {
  if (constraints.length === 0) {
    console.log('  No constraints found.');
    return;
  }
  
  console.table(constraints);
}

/**
 * Print table relationships in a nice format
 */
function printTableRelationships(relationships) {
  if (relationships.length === 0) {
    console.log('  No relationships found.');
    return;
  }
  
  console.table(relationships);
}

/**
 * Print referencing tables in a nice format
 */
function printReferencingTables(referencingTables) {
  if (referencingTables.length === 0) {
    console.log('  No referencing tables found.');
    return;
  }
  
  console.table(referencingTables);
}

/**
 * Print sample data in a nice format
 */
function printSampleData(data) {
  if (data.length === 0) {
    console.log('  No sample data found.');
    return;
  }
  
  console.table(data);
}

/**
 * Generate SQL to add missing column
 */
function generateAddColumnSQL(tableName, columnName, dataType, defaultValue = null, isNullable = true) {
  let sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${dataType}`;
  
  if (!isNullable) {
    sql += ' NOT NULL';
  }
  
  if (defaultValue !== null) {
    sql += ` DEFAULT ${defaultValue}`;
  }
  
  sql += ';';
  
  return sql;
}

/**
 * Main function to check participant tables
 */
async function checkParticipantTables() {
  const client = await pool.connect();
  
  try {
    log.header('PARTICIPANT TABLES DATABASE CHECK');
    log.info(`Using PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port} with user '${dbConfig.user}'`);
    
    // Test connection
    log.info('Testing PostgreSQL connection...');
    const timeResult = await client.query('SELECT NOW() as now');
    const serverTime = timeResult.rows[0].now;
    log.success(`Connection successful! Server time: ${serverTime}`);
    
    // Find participant-related tables
    log.header('PARTICIPANT-RELATED TABLES');
    const participantTables = await findParticipantTables(client);
    
    if (participantTables.length === 0) {
      log.warning('No participant-related tables found.');
    } else {
      log.success(`Found ${participantTables.length} participant-related tables:`);
      participantTables.forEach(table => console.log(`  - ${table}`));
    }
    
    // Check if program_participants table exists
    const programParticipantsExists = await tableExists(client, 'program_participants');
    
    if (!programParticipantsExists) {
      log.error('The program_participants table does not exist!');
      log.info('This table is required for enrolling participants in programs.');
      log.info('Checking for similar tables that might be used instead...');
      
      const possibleAlternatives = participantTables.filter(table => 
        table !== 'program_participants' && 
        (table.includes('program') || table.includes('enrollment'))
      );
      
      if (possibleAlternatives.length > 0) {
        log.info('Possible alternative tables found:');
        possibleAlternatives.forEach(table => console.log(`  - ${table}`));
      } else {
        log.warning('No alternative tables found.');
      }
    } else {
      log.success('The program_participants table exists.');
      
      // Check program_participants structure
      log.header('PROGRAM_PARTICIPANTS TABLE STRUCTURE');
      const programParticipantsStructure = await getTableStructure(client, 'program_participants');
      printTableStructure(programParticipantsStructure);
      
      // Check for is_active column
      const isActiveExists = await columnExists(client, 'program_participants', 'is_active');
      
      if (!isActiveExists) {
        log.error('The is_active column does not exist in program_participants table!');
        log.info('This is causing the error in the programService.js file.');
        
        // Generate SQL to add the missing column
        log.header('SUGGESTED FIX');
        const addColumnSQL = generateAddColumnSQL('program_participants', 'is_active', 'boolean', 'true', false);
        console.log(addColumnSQL);
        
        // Check for similar columns
        const activeColumns = programParticipantsStructure.filter(col => 
          col.column_name.includes('active') || 
          col.column_name.includes('status') ||
          col.column_name === 'enabled'
        );
        
        if (activeColumns.length > 0) {
          log.info('Similar columns found that might be used instead:');
          activeColumns.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
        }
      } else {
        log.success('The is_active column exists in program_participants table.');
      }
      
      // Check constraints
      log.header('PROGRAM_PARTICIPANTS TABLE CONSTRAINTS');
      const programParticipantsConstraints = await getTableConstraints(client, 'program_participants');
      printTableConstraints(programParticipantsConstraints);
      
      // Check relationships
      log.header('PROGRAM_PARTICIPANTS TABLE RELATIONSHIPS');
      const programParticipantsRelationships = await getTableRelationships(client, 'program_participants');
      printTableRelationships(programParticipantsRelationships);
      
      // Check referencing tables
      log.header('TABLES REFERENCING PROGRAM_PARTICIPANTS');
      const referencingTables = await getReferencingTables(client, 'program_participants');
      printReferencingTables(referencingTables);
      
      // Get sample data
      log.header('PROGRAM_PARTICIPANTS SAMPLE DATA');
      const sampleData = await getSampleData(client, 'program_participants');
      printSampleData(sampleData);
    }
    
    // Check participants table
    const participantsExists = await tableExists(client, 'participants');
    
    if (participantsExists) {
      log.header('PARTICIPANTS TABLE STRUCTURE');
      const participantsStructure = await getTableStructure(client, 'participants');
      printTableStructure(participantsStructure);
    }
    
    // Check programs table
    const programsExists = await tableExists(client, 'programs');
    
    if (programsExists) {
      log.header('PROGRAMS TABLE STRUCTURE');
      const programsStructure = await getTableStructure(client, 'programs');
      printTableStructure(programsStructure);
    }
    
    log.header('NEXT STEPS');
    console.log(`${styles.bright}1. Add the missing is_active column to program_participants${styles.reset}`);
    console.log(`${styles.bright}2. Or modify programService.js to not use the is_active column${styles.reset}`);
    console.log(`${styles.bright}3. Check for other schema mismatches in participant-related tables${styles.reset}`);
    
    log.success('✨ Database check completed successfully!');
    
  } catch (error) {
    log.error(`Error checking participant tables: ${error.message}`);
    console.error(error);
  } finally {
    // Release the client back to the pool
    client.release();
    await pool.end();
  }
}

// Run the main function
checkParticipantTables().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
