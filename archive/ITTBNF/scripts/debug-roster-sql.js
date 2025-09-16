/**
 * Debug Roster SQL Queries
 * 
 * This script extracts and tests the SQL queries used in the rosterService.js file
 * to identify exactly which query is failing and why.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// File paths
const rosterServicePath = path.join(__dirname, '..', 'backend', 'services', 'rosterService.js');

// Test date range
const startDate = '2025-08-05';
const endDate = '2025-08-12';

// Helper functions
const log = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
};

// Function to extract SQL queries from the service file
function extractSqlQueries(fileContent) {
  const queries = [];
  
  // Extract SQL strings - look for patterns like:
  // 1. const query = `SELECT ...`
  // 2. query += `JOIN ...`
  // 3. Direct usage in pool.query(`SELECT ...`)
  
  // Simple regex to find SQL queries (this is basic and might miss some complex cases)
  const queryRegex = /(?:const|let)\s+(\w+)\s*=\s*`([^`]+)`|(\w+)\s*\+=\s*`([^`]+)`|pool\.query\(`([^`]+)`/g;
  
  let match;
  while ((match = queryRegex.exec(fileContent)) !== null) {
    const queryName = match[1] || "anonymous";
    const queryContent = match[2] || match[4] || match[5] || "";
    
    if (queryContent.trim().toUpperCase().startsWith('SELECT') || 
        queryContent.trim().toUpperCase().startsWith('WITH') ||
        queryContent.trim().toUpperCase().startsWith('UPDATE') ||
        queryContent.trim().toUpperCase().startsWith('INSERT')) {
      queries.push({
        name: queryName,
        content: queryContent,
        lineNumber: getLineNumber(fileContent, match[0])
      });
    }
  }
  
  // Also try to find the complete queries that are built in parts
  const functionRegex = /async\s+(\w+)\s*\([^)]*\)\s*{([^}]*)}/gs;
  let funcMatch;
  
  while ((funcMatch = functionRegex.exec(fileContent)) !== null) {
    const functionName = funcMatch[1];
    const functionBody = funcMatch[2];
    
    // Look for query building
    if (functionBody.includes('const query =') && functionBody.includes('pool.query(')) {
      // This function contains a query - let's try to reconstruct it
      const queryParts = [];
      const queryPartsRegex = /(?:const|let)\s+query\s*=\s*`([^`]+)`|query\s*\+=\s*`([^`]+)`/g;
      let queryPartMatch;
      
      while ((queryPartMatch = queryPartsRegex.exec(functionBody)) !== null) {
        queryParts.push(queryPartMatch[1] || queryPartMatch[2]);
      }
      
      if (queryParts.length > 0) {
        const fullQuery = queryParts.join(' ');
        queries.push({
          name: `${functionName}_full`,
          content: fullQuery,
          lineNumber: getLineNumber(fileContent, functionName)
        });
      }
    }
  }
  
  return queries;
}

// Helper to get line number from content and search string
function getLineNumber(content, searchString) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return -1;
}

// Function to test a single SQL query
async function testQuery(query, params = []) {
  try {
    log(`Testing query: ${query.name} (line ${query.lineNumber})`);
    log(`SQL: ${query.content.replace(/\s+/g, ' ').trim()}`);
    
    if (params.length > 0) {
      log(`Parameters: ${JSON.stringify(params)}`);
    }
    
    const result = await pool.query(query.content, params);
    log(`✅ SUCCESS: Query executed successfully (${result.rowCount} rows)`);
    
    if (result.rows.length > 0) {
      log(`Sample result: ${JSON.stringify(result.rows[0], null, 2)}`);
    }
    
    return { success: true, result };
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    log(`Error details: ${JSON.stringify(error, null, 2)}`);
    
    // Provide helpful suggestions based on error
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      const columnMatch = error.message.match(/column\s+([^\s]+)\s+does not exist/);
      if (columnMatch && columnMatch[1]) {
        const columnName = columnMatch[1];
        log(`Suggestion: Check if column "${columnName}" exists in the database`);
        
        // Try to find the table from the column reference
        const tableMatch = columnName.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
        if (tableMatch) {
          const tableAlias = tableMatch[1];
          const column = tableMatch[2];
          log(`Table alias "${tableAlias}" is trying to access column "${column}"`);
          
          // Check if this is an alias issue
          const aliasMatch = query.content.match(new RegExp(`(?:FROM|JOIN)\\s+([a-zA-Z0-9_]+)\\s+(?:AS\\s+)?${tableAlias}`, 'i'));
          if (aliasMatch) {
            const actualTable = aliasMatch[1];
            log(`Table "${actualTable}" is aliased as "${tableAlias}"`);
            
            // Check if the column exists in the actual table
            checkColumnExists(actualTable, column);
          }
        }
      }
    }
    
    return { success: false, error };
  }
}

// Function to check if a column exists in a table
async function checkColumnExists(tableName, columnName) {
  try {
    const query = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `;
    
    const result = await pool.query(query, [tableName]);
    log(`Table "${tableName}" has ${result.rows.length} columns:`);
    
    result.rows.forEach(col => {
      log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    const columnExists = result.rows.some(col => col.column_name === columnName);
    if (columnExists) {
      log(`✅ Column "${columnName}" exists in table "${tableName}"`);
    } else {
      log(`❌ Column "${columnName}" does NOT exist in table "${tableName}"`);
      
      // Suggest similar column names
      const similarColumns = result.rows
        .map(col => col.column_name)
        .filter(col => {
          return col.includes(columnName) || 
                 columnName.includes(col) || 
                 levenshteinDistance(col, columnName) <= 3;
        });
      
      if (similarColumns.length > 0) {
        log(`Possible alternatives: ${similarColumns.join(', ')}`);
      }
    }
  } catch (error) {
    log(`Error checking columns: ${error.message}`);
  }
}

// Simple Levenshtein distance implementation for finding similar column names
function levenshteinDistance(a, b) {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) === a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // substitution
          Math.min(
            matrix[i][j-1] + 1, // insertion
            matrix[i-1][j] + 1  // deletion
          )
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Function to test the getRoster function specifically
async function testGetRosterQuery() {
  log('\nTesting getRoster query components...');
  
  try {
    // Base query for loom instances
    const baseQuery = `
      SELECT 
        li.id,
        li.program_id,
        li.instance_date,
        li.date,
        li.start_time,
        li.end_time,
        li.status,
        li.notes,
        p.name AS program_name,
        v.name AS venue_name
      FROM tgl_loom_instances li
      LEFT JOIN programs p ON li.program_id = p.id
      LEFT JOIN venues v ON li.venue_id = v.id
      WHERE (li.instance_date::date BETWEEN $1 AND $2) OR (li.date::date BETWEEN $1 AND $2)
      ORDER BY li.start_time
    `;
    
    // Test base query
    await testQuery({ 
      name: 'getRoster_base', 
      content: baseQuery,
      lineNumber: 'N/A'
    }, [startDate, endDate]);
    
    // Staff subquery
    const staffSubquery = `
      SELECT 
        li.id,
        (
          SELECT json_agg(json_build_object(
            'id', s.id,
            'staff_id', s.staff_id,
            'role', s.role,
            'start_time', s.start_time,
            'end_time', s.end_time,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'schads_level', st.schads_level
          ))
          FROM tgl_loom_staff_shifts s
          JOIN staff st ON s.staff_id = st.id
          WHERE s.loom_instance_id = li.id
        ) AS staff
      FROM tgl_loom_instances li
      WHERE (li.instance_date::date BETWEEN $1 AND $2) OR (li.date::date BETWEEN $1 AND $2)
    `;
    
    // Test staff subquery
    await testQuery({ 
      name: 'getRoster_staff', 
      content: staffSubquery,
      lineNumber: 'N/A'
    }, [startDate, endDate]);
    
    // Participants subquery
    const participantsSubquery = `
      SELECT 
        li.id,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'participant_id', pa.participant_id,
            'first_name', p.first_name,
            'last_name', p.last_name
          ))
          FROM tgl_loom_participant_allocations pa
          JOIN participants p ON pa.participant_id = p.id
          WHERE pa.loom_instance_id = li.id
        ) AS participants
      FROM tgl_loom_instances li
      WHERE (li.instance_date::date BETWEEN $1 AND $2) OR (li.date::date BETWEEN $1 AND $2)
    `;
    
    // Test participants subquery
    await testQuery({ 
      name: 'getRoster_participants', 
      content: participantsSubquery,
      lineNumber: 'N/A'
    }, [startDate, endDate]);
    
    // Complete getRoster query
    const fullQuery = `
      SELECT 
        li.id,
        li.program_id,
        li.instance_date,
        li.date,
        li.start_time,
        li.end_time,
        li.status,
        li.notes,
        p.name AS program_name,
        v.name AS venue_name,
        (
          SELECT json_agg(json_build_object(
            'id', s.id,
            'staff_id', s.staff_id,
            'role', s.role,
            'start_time', s.start_time,
            'end_time', s.end_time,
            'first_name', st.first_name,
            'last_name', st.last_name,
            'schads_level', st.schads_level
          ))
          FROM tgl_loom_staff_shifts s
          JOIN staff st ON s.staff_id = st.id
          WHERE s.loom_instance_id = li.id
        ) AS staff,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'participant_id', pa.participant_id,
            'first_name', p2.first_name,
            'last_name', p2.last_name
          ))
          FROM tgl_loom_participant_allocations pa
          JOIN participants p2 ON pa.participant_id = p2.id
          WHERE pa.loom_instance_id = li.id
        ) AS participants
      FROM tgl_loom_instances li
      LEFT JOIN programs p ON li.program_id = p.id
      LEFT JOIN venues v ON li.venue_id = v.id
      WHERE (li.instance_date::date BETWEEN $1 AND $2) OR (li.date::date BETWEEN $1 AND $2)
      ORDER BY li.start_time
    `;
    
    // Test full query
    await testQuery({ 
      name: 'getRoster_full', 
      content: fullQuery,
      lineNumber: 'N/A'
    }, [startDate, endDate]);
    
  } catch (error) {
    log(`Error in testGetRosterQuery: ${error.message}`);
  }
}

// Function to check the actual rosterService implementation
async function analyzeRosterService() {
  try {
    log('\nAnalyzing rosterService.js implementation...');
    
    // Read the file
    const serviceContent = fs.readFileSync(rosterServicePath, 'utf8');
    log(`✅ Read rosterService.js (${serviceContent.length} bytes)`);
    
    // Extract SQL queries
    const queries = extractSqlQueries(serviceContent);
    log(`Found ${queries.length} SQL queries in the file`);
    
    // Test each query
    for (const query of queries) {
      // Skip empty queries or template strings without actual SQL
      if (!query.content.trim() || query.content.includes('${')) {
        log(`Skipping query "${query.name}" as it contains template variables`);
        continue;
      }
      
      await testQuery(query, [startDate, endDate]);
    }
    
  } catch (error) {
    log(`Error analyzing rosterService: ${error.message}`);
  }
}

// Main function
async function main() {
  log('\n================================================================================');
  log('DEBUG ROSTER SQL QUERIES');
  log('================================================================================\n');
  
  try {
    // Test database connection
    log('Testing database connection...');
    await pool.query('SELECT NOW()');
    log('✅ Successfully connected to database');
    
    // Check if roster service file exists
    if (!fs.existsSync(rosterServicePath)) {
      throw new Error(`File not found: ${rosterServicePath}`);
    }
    
    // Analyze the service file
    await analyzeRosterService();
    
    // Test specific getRoster query components
    await testGetRosterQuery();
    
    // Summary
    log('\n================================================================================');
    log('DEBUGGING COMPLETE');
    log('================================================================================\n');
    
    log('Check the logs above for any SQL errors and their potential fixes.');
    log('Focus on column name mismatches and table aliases.');
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    console.error(error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
});
