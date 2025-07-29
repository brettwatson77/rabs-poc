/**
 * simple-table-check.js
 * 
 * Quick script to check what columns exist in our simple tables
 * (vehicles, venues, participants, staff) vs what the frontend pages expect.
 * This gives us a focused view of what we need to fix for the simple pages first.
 */

require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Setup logger with timestamps and colors
const logger = {
  info: (msg) => console.log(`\x1b[36m[${new Date().toISOString()}] INFO: ${msg}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m[${new Date().toISOString()}] ERROR: ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m[${new Date().toISOString()}] SUCCESS: ${msg}\x1b[0m`),
  warn: (msg) => console.warn(`\x1b[33m[${new Date().toISOString()}] WARNING: ${msg}\x1b[0m`),
  table: (data) => console.table(data)
};

// PostgreSQL connection configuration from environment variables
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'rabspocdb'
};

// Create a new pool
const pool = new Pool(dbConfig);

// Simple tables to check
const SIMPLE_TABLES = ['vehicles', 'venues', 'participants', 'staff'];

// Frontend files to check for expected columns
const FRONTEND_FILES = {
  'vehicles': 'frontend/src/pages/Vehicles.jsx',
  'venues': 'frontend/src/pages/Venues.jsx',
  'participants': 'frontend/src/pages/Participants.jsx',
  'staff': 'frontend/src/pages/Staff.jsx'
};

/**
 * Get columns for a specific table from PostgreSQL
 * @param {string} tableName - Name of the table
 * @returns {Promise<Array>} Array of column objects
 */
async function getTableColumns(tableName) {
  const client = await pool.connect();
  try {
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    return columnsResult.rows;
  } finally {
    client.release();
  }
}

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table
 * @returns {Promise<boolean>} True if table exists
 */
async function tableExists(tableName) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    
    return result.rows[0].exists;
  } finally {
    client.release();
  }
}

/**
 * Extract expected column names from frontend file
 * @param {string} filePath - Path to frontend file
 * @returns {Array} Array of expected column names
 */
function extractExpectedColumns(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Frontend file not found: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract column names from form fields, table headers, and object destructuring
    const columns = new Set();
    
    // Look for form fields (common patterns in our React forms)
    const formFieldRegex = /name=["']([a-zA-Z0-9_]+)["']|id=["']([a-zA-Z0-9_]+)["']|htmlFor=["']([a-zA-Z0-9_]+)["']/g;
    let match;
    while ((match = formFieldRegex.exec(content)) !== null) {
      const column = match[1] || match[2] || match[3];
      if (column && !column.includes('search') && !column.includes('filter') && !column.includes('btn')) {
        columns.add(column);
      }
    }
    
    // Look for table headers
    const tableHeaderRegex = /<th[^>]*>([^<]+)<\/th>/g;
    while ((match = tableHeaderRegex.exec(content)) !== null) {
      const header = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      if (header && header !== 'actions') {
        columns.add(header);
      }
    }
    
    // Look for object destructuring
    const destructuringRegex = /const\s*{\s*([^}]+)\s*}\s*=\s*([a-zA-Z0-9_]+)/g;
    while ((match = destructuringRegex.exec(content)) !== null) {
      const props = match[1].split(',').map(prop => prop.trim());
      const variable = match[2];
      
      // Only consider if variable is likely an entity (item, vehicle, venue, etc.)
      if (['item', 'data', 'record', 'vehicle', 'venue', 'participant', 'staff'].includes(variable)) {
        props.forEach(prop => {
          if (prop && !prop.includes('...') && !prop.includes('=')) {
            columns.add(prop);
          }
        });
      }
    }
    
    // Look for property access
    const propertyAccessRegex = /\b([a-zA-Z0-9_]+)\.([-a-zA-Z0-9_]+)\b/g;
    while ((match = propertyAccessRegex.exec(content)) !== null) {
      const variable = match[1];
      const prop = match[2];
      
      // Only consider if variable is likely an entity
      if (['item', 'data', 'record', 'vehicle', 'venue', 'participant', 'staff'].includes(variable)) {
        if (prop && !['map', 'filter', 'forEach', 'length', 'push', 'pop', 'shift', 'unshift'].includes(prop)) {
          columns.add(prop);
        }
      }
    }
    
    return Array.from(columns);
  } catch (error) {
    logger.error(`Error extracting expected columns from ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Check for common column naming patterns
 * @param {string} dbColumn - Database column name
 * @param {string} expectedColumn - Expected column name
 * @returns {boolean} True if they likely match
 */
function columnsLikelyMatch(dbColumn, expectedColumn) {
  // Direct match
  if (dbColumn === expectedColumn) return true;
  
  // snake_case vs camelCase
  if (dbColumn === expectedColumn.replace(/([A-Z])/g, '_$1').toLowerCase()) return true;
  if (expectedColumn === dbColumn.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase())) return true;
  
  // Common variations
  const variations = {
    'id': ['uuid', 'uid', '_id'],
    'first_name': ['firstname', 'fname'],
    'last_name': ['lastname', 'lname'],
    'email': ['email_address', 'mail'],
    'phone': ['phone_number', 'telephone', 'tel'],
    'address': ['street_address', 'location'],
    'created_at': ['created', 'creation_date', 'date_created'],
    'updated_at': ['updated', 'last_updated', 'date_updated'],
    'description': ['desc', 'details', 'info'],
    'registration': ['reg_number', 'rego', 'plate_number'],
    'capacity': ['seats', 'max_capacity', 'max_seats'],
    'supervision_multiplier': ['supervision_level', 'support_level', 'support_multiplier']
  };
  
  // Check if either column has a common variation
  for (const [base, variants] of Object.entries(variations)) {
    if ((dbColumn === base || variants.includes(dbColumn)) && 
        (expectedColumn === base || variants.includes(expectedColumn))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a report for a table
 * @param {string} tableName - Name of the table
 * @param {Array} dbColumns - Database columns
 * @param {Array} expectedColumns - Expected columns
 * @returns {Object} Report object
 */
function generateTableReport(tableName, dbColumns, expectedColumns) {
  const dbColumnNames = dbColumns.map(col => col.column_name);
  
  // Find missing columns (expected but not in DB)
  const missingColumns = [];
  for (const expected of expectedColumns) {
    if (!dbColumnNames.some(dbCol => columnsLikelyMatch(dbCol, expected))) {
      missingColumns.push(expected);
    }
  }
  
  // Find extra columns (in DB but not expected)
  const extraColumns = [];
  for (const dbCol of dbColumnNames) {
    if (!expectedColumns.some(expected => columnsLikelyMatch(dbCol, expected))) {
      extraColumns.push(dbCol);
    }
  }
  
  // Find potential matches (similar names)
  const potentialMatches = [];
  for (const expected of expectedColumns) {
    for (const dbCol of dbColumnNames) {
      if (expected !== dbCol && columnsLikelyMatch(dbCol, expected)) {
        potentialMatches.push({
          expected,
          actual: dbCol,
          suggestion: `Frontend uses '${expected}' but DB has '${dbCol}'`
        });
      }
    }
  }
  
  return {
    tableName,
    dbColumnCount: dbColumnNames.length,
    expectedColumnCount: expectedColumns.length,
    missingColumns,
    extraColumns,
    potentialMatches
  };
}

/**
 * Main function to check tables
 */
async function checkSimpleTables() {
  logger.info('Starting simple table check...');
  logger.info(`Connecting to PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  
  try {
    const reports = [];
    
    for (const tableName of SIMPLE_TABLES) {
      logger.info(`Checking table: ${tableName}`);
      
      // Check if table exists
      const exists = await tableExists(tableName);
      if (!exists) {
        logger.warn(`Table '${tableName}' does not exist in the database`);
        reports.push({
          tableName,
          exists: false,
          error: `Table does not exist`
        });
        continue;
      }
      
      // Get database columns
      const dbColumns = await getTableColumns(tableName);
      logger.info(`Found ${dbColumns.length} columns in '${tableName}' table`);
      
      // Get expected columns from frontend
      const frontendFile = FRONTEND_FILES[tableName];
      const expectedColumns = extractExpectedColumns(frontendFile);
      logger.info(`Extracted ${expectedColumns.length} expected columns from '${frontendFile}'`);
      
      // Generate report
      const report = generateTableReport(tableName, dbColumns, expectedColumns);
      reports.push({
        ...report,
        exists: true
      });
    }
    
    // Output reports
    outputReports(reports);
    
    logger.success('Simple table check completed successfully');
  } catch (err) {
    logger.error(`Check failed: ${err.message}`);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
    logger.info('Database connection closed');
  }
}

/**
 * Output reports to console and file
 * @param {Array} reports - Array of report objects
 */
function outputReports(reports) {
  console.log('\n=== SIMPLE TABLE CHECK RESULTS ===\n');
  
  for (const report of reports) {
    console.log(`\x1b[1m${report.tableName}\x1b[0m`);
    
    if (!report.exists) {
      console.log(`  \x1b[31mERROR: ${report.error}\x1b[0m`);
      continue;
    }
    
    console.log(`  Database columns: ${report.dbColumnCount}`);
    console.log(`  Expected columns: ${report.expectedColumnCount}`);
    
    if (report.missingColumns.length > 0) {
      console.log(`  \x1b[33mMissing columns (${report.missingColumns.length}):\x1b[0m`);
      report.missingColumns.forEach(col => console.log(`    - ${col}`));
    } else {
      console.log(`  \x1b[32mNo missing columns\x1b[0m`);
    }
    
    if (report.potentialMatches.length > 0) {
      console.log(`  \x1b[33mPotential column mismatches (${report.potentialMatches.length}):\x1b[0m`);
      report.potentialMatches.forEach(match => console.log(`    - ${match.suggestion}`));
    }
    
    console.log('');
  }
  
  // Create a markdown report
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }
  
  const reportPath = path.join(reportDir, `simple-tables-${new Date().toISOString().split('T')[0]}.md`);
  let markdown = `# Simple Tables Check Report\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  for (const report of reports) {
    markdown += `## ${report.tableName}\n\n`;
    
    if (!report.exists) {
      markdown += `**ERROR:** ${report.error}\n\n`;
      continue;
    }
    
    markdown += `- Database columns: ${report.dbColumnCount}\n`;
    markdown += `- Expected columns: ${report.expectedColumnCount}\n\n`;
    
    if (report.missingColumns.length > 0) {
      markdown += `### Missing Columns\n\n`;
      report.missingColumns.forEach(col => markdown += `- \`${col}\`\n`);
      markdown += '\n';
    } else {
      markdown += `✅ No missing columns\n\n`;
    }
    
    if (report.potentialMatches.length > 0) {
      markdown += `### Potential Column Mismatches\n\n`;
      report.potentialMatches.forEach(match => markdown += `- ${match.suggestion}\n`);
      markdown += '\n';
    }
    
    // Add SQL to create missing columns
    if (report.missingColumns.length > 0) {
      markdown += `### SQL to Add Missing Columns\n\n`;
      markdown += '```sql\n';
      report.missingColumns.forEach(col => {
        markdown += `ALTER TABLE ${report.tableName} ADD COLUMN ${col} TEXT;\n`;
      });
      markdown += '```\n\n';
    }
    
    // Add SQL to rename mismatched columns
    if (report.potentialMatches.length > 0) {
      markdown += `### SQL to Rename Mismatched Columns\n\n`;
      markdown += '```sql\n';
      report.potentialMatches.forEach(match => {
        markdown += `-- Consider renaming column:\n`;
        markdown += `-- ALTER TABLE ${report.tableName} RENAME COLUMN ${match.actual} TO ${match.expected};\n\n`;
      });
      markdown += '```\n\n';
    }
  }
  
  // Add summary and next steps
  markdown += `## Summary\n\n`;
  const missingTotal = reports.reduce((sum, r) => sum + (r.missingColumns?.length || 0), 0);
  const mismatchTotal = reports.reduce((sum, r) => sum + (r.potentialMatches?.length || 0), 0);
  
  markdown += `- **Total missing columns:** ${missingTotal}\n`;
  markdown += `- **Total potential mismatches:** ${mismatchTotal}\n\n`;
  
  markdown += `## Next Steps\n\n`;
  markdown += `1. Add missing columns to database tables\n`;
  markdown += `2. Update frontend code to use correct column names\n`;
  markdown += `3. Test each simple page (Vehicles, Venues, Participants, Staff) individually\n`;
  markdown += `4. Move on to more complex pages once simple pages are working\n`;
  
  fs.writeFileSync(reportPath, markdown);
  logger.success(`Report generated at ${reportPath}`);
}

// Run the check
checkSimpleTables().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
