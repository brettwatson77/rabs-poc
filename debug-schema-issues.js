/**
 * debug-schema-issues.js
 * 
 * Diagnoses database schema mismatches between code expectations and actual tables.
 * Specifically checks time_slots and system_logs tables that are causing errors.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Initialize database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rabspocdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Tables and columns to check
const expectedColumns = {
  time_slots: [
    'id',
    'program_id',  // This is missing according to error
    'loom_instance_id', // Alternative that might exist
    'start_time',
    'end_time',
    'segment_type'
  ],
  system_logs: [
    'id',
    'level',  // This is missing according to error
    'message',
    'source',
    'details',
    'created_at'
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

/**
 * Get actual columns for a table from the database
 */
async function getTableColumns(tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    return result.rows;
  } catch (err) {
    console.error(`${colors.red}Error fetching columns for ${tableName}:${colors.reset}`, err.message);
    return [];
  }
}

/**
 * Check if a table exists
 */
async function tableExists(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (err) {
    console.error(`${colors.red}Error checking if table ${tableName} exists:${colors.reset}`, err.message);
    return false;
  }
}

/**
 * Get all tables in the database
 */
async function getAllTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    return result.rows.map(row => row.table_name);
  } catch (err) {
    console.error(`${colors.red}Error fetching tables:${colors.reset}`, err.message);
    return [];
  }
}

/**
 * Find similar tables by name
 */
function findSimilarTables(tableName, allTables) {
  return allTables.filter(t => 
    t.includes(tableName.replace('_', '')) || 
    tableName.includes(t.replace('_', ''))
  );
}

/**
 * Print table schema comparison
 */
function printSchemaComparison(tableName, actualColumns, expectedCols) {
  console.log(`\n${colors.bold}${colors.cyan}=== TABLE: ${tableName} ===${colors.reset}`);
  
  if (actualColumns.length === 0) {
    console.log(`${colors.red}Table does not exist or has no columns${colors.reset}`);
    return;
  }
  
  console.log(`\n${colors.bold}Actual Columns:${colors.reset}`);
  console.log('┌─────────────────────┬─────────────┬──────────────┐');
  console.log('│ Column Name         │ Data Type   │ Nullable     │');
  console.log('├─────────────────────┼─────────────┼──────────────┤');
  
  actualColumns.forEach(col => {
    const isExpected = expectedCols.includes(col.column_name);
    const colorStart = isExpected ? colors.green : colors.white;
    
    console.log(`│ ${colorStart}${col.column_name.padEnd(19)}${colors.reset} │ ${col.data_type.padEnd(11)} │ ${col.is_nullable.padEnd(12)} │`);
  });
  
  console.log('└─────────────────────┴─────────────┴──────────────┘');
  
  console.log(`\n${colors.bold}Expected Columns:${colors.reset}`);
  console.log('┌─────────────────────┬────────────────────────────┐');
  console.log('│ Column Name         │ Status                     │');
  console.log('├─────────────────────┼────────────────────────────┤');
  
  expectedCols.forEach(col => {
    const exists = actualColumns.some(c => c.column_name === col);
    const status = exists ? `${colors.green}Found${colors.reset}` : `${colors.red}Missing${colors.reset}`;
    
    console.log(`│ ${col.padEnd(19)} │ ${status.padEnd(24)} │`);
  });
  
  console.log('└─────────────────────┴────────────────────────────┘');
}

/**
 * Generate SQL to fix missing columns
 */
function generateFixSQL(tableName, actualColumns, expectedCols) {
  const missingColumns = expectedCols.filter(col => 
    !actualColumns.some(c => c.column_name === col)
  );
  
  if (missingColumns.length === 0) {
    return null;
  }
  
  let sql = `-- Fix for ${tableName} table\n`;
  
  missingColumns.forEach(col => {
    let dataType = 'text';
    
    // Make educated guesses about data types
    if (col === 'id') dataType = 'serial PRIMARY KEY';
    else if (col.endsWith('_id')) dataType = 'integer';
    else if (col === 'level') dataType = 'varchar(20)';
    else if (col === 'created_at') dataType = 'timestamp DEFAULT CURRENT_TIMESTAMP';
    else if (col.includes('time')) dataType = 'time';
    else if (col.includes('date')) dataType = 'date';
    else if (col === 'details') dataType = 'jsonb';
    
    sql += `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col} ${dataType};\n`;
  });
  
  return sql;
}

/**
 * Generate code fix for dashboard.js
 */
function generateCodeFix(tableName, actualColumns, expectedCols) {
  if (tableName !== 'time_slots') return null;
  
  const missingColumns = expectedCols.filter(col => 
    !actualColumns.some(c => c.column_name === col)
  );
  
  if (!missingColumns.includes('program_id')) return null;
  
  // Check if loom_instance_id exists as an alternative
  const hasLoomInstanceId = actualColumns.some(c => c.column_name === 'loom_instance_id');
  
  if (hasLoomInstanceId) {
    return `
// Fix for dashboard.js
// Replace:
SELECT ts.id, ts.program_id, ts.start_time, ts.end_time, ts.segment_type,
       p.name as program_name, 
       li.id as loom_instance_id,
       
// With:
SELECT ts.id, li.program_id, ts.start_time, ts.end_time, ts.segment_type,
       p.name as program_name, 
       li.id as loom_instance_id,
`;
  }
  
  return null;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(`${colors.bold}${colors.magenta}
╔══════════════════════════════════════════════════╗
║  RABS v3 - Database Schema Diagnostic Tool       ║
║  Checking for schema mismatches in the database  ║
╚══════════════════════════════════════════════════╝${colors.reset}
`);
    
    // Get all tables for reference
    const allTables = await getAllTables();
    console.log(`${colors.cyan}Found ${allTables.length} tables in database${colors.reset}`);
    
    // Check each table we're interested in
    for (const tableName of Object.keys(expectedColumns)) {
      const exists = await tableExists(tableName);
      
      if (!exists) {
        console.log(`\n${colors.red}Table '${tableName}' does not exist!${colors.reset}`);
        
        // Find similar tables
        const similarTables = findSimilarTables(tableName, allTables);
        if (similarTables.length > 0) {
          console.log(`${colors.yellow}Similar tables found: ${similarTables.join(', ')}${colors.reset}`);
          
          // Check the first similar table
          if (similarTables.length > 0) {
            const similarColumns = await getTableColumns(similarTables[0]);
            console.log(`\n${colors.yellow}Columns in similar table '${similarTables[0]}':${colors.reset}`);
            similarColumns.forEach(col => {
              console.log(`  - ${col.column_name} (${col.data_type})`);
            });
          }
        }
        
        continue;
      }
      
      const actualColumns = await getTableColumns(tableName);
      printSchemaComparison(tableName, actualColumns, expectedColumns[tableName]);
      
      const fixSQL = generateFixSQL(tableName, actualColumns, expectedColumns[tableName]);
      if (fixSQL) {
        console.log(`\n${colors.bold}${colors.yellow}Suggested SQL Fix:${colors.reset}`);
        console.log(fixSQL);
      }
      
      const codeFix = generateCodeFix(tableName, actualColumns, expectedColumns[tableName]);
      if (codeFix) {
        console.log(`\n${colors.bold}${colors.yellow}Suggested Code Fix:${colors.reset}`);
        console.log(codeFix);
      }
    }
    
    console.log(`\n${colors.green}${colors.bold}Diagnostic complete!${colors.reset}`);
  } catch (err) {
    console.error(`${colors.red}${colors.bold}Error:${colors.reset}`, err);
  } finally {
    await pool.end();
  }
}

// Run the script
main();
