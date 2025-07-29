/**
 * audit-database.js
 * 
 * Comprehensive database audit script that:
 * 1. Connects to PostgreSQL and lists ALL existing tables and their columns
 * 2. Maps out what the backend APIs expect based on our API reference document
 * 3. Identifies gaps - what exists vs what's needed
 * 4. Categorizes by page complexity (simple → complex)
 * 5. Generates a clear action plan for systematic fixes
 */

require('dotenv').config({ path: './backend/.env' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const marked = require('marked');

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

// Path to the API reference document
const apiReferencePath = path.join(__dirname, 'docs', '03_Development_&_Operations', '04_API_Backend_Reference_Map.md');

// Page complexity categories
const PAGE_COMPLEXITY = {
  SIMPLE: 'Simple',
  MODERATE: 'Moderate',
  COMPLEX: 'Complex'
};

// Page to complexity mapping
const pageComplexityMap = {
  'vehicles': PAGE_COMPLEXITY.SIMPLE,
  'venues': PAGE_COMPLEXITY.SIMPLE,
  'participants': PAGE_COMPLEXITY.SIMPLE,
  'staff': PAGE_COMPLEXITY.MODERATE,
  'finance': PAGE_COMPLEXITY.MODERATE,
  'dashboard': PAGE_COMPLEXITY.COMPLEX,
  'master-schedule': PAGE_COMPLEXITY.COMPLEX,
  'roster': PAGE_COMPLEXITY.COMPLEX,
  'cards': PAGE_COMPLEXITY.COMPLEX
};

/**
 * Get all tables and their columns from PostgreSQL
 * @returns {Promise<Object>} Object with table names as keys and column arrays as values
 */
async function getExistingTablesAndColumns() {
  const client = await pool.connect();
  try {
    logger.info('Fetching all tables from PostgreSQL...');
    
    // Get all tables in the public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    logger.success(`Found ${tables.length} tables in the database`);
    
    // Get columns for each table
    const tableStructure = {};
    for (const table of tables) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      tableStructure[table] = columnsResult.rows;
    }
    
    // Get foreign keys
    const foreignKeysResult = await client.query(`
      SELECT
        tc.table_name, 
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
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, kcu.column_name
    `);
    
    const foreignKeys = foreignKeysResult.rows;
    logger.success(`Found ${foreignKeys.length} foreign key relationships`);
    
    return { tableStructure, foreignKeys };
  } finally {
    client.release();
  }
}

/**
 * Parse the API reference document to extract expected tables and columns
 * @returns {Promise<Object>} Object with API endpoints and their expected database dependencies
 */
async function parseApiReference() {
  try {
    logger.info(`Reading API reference from ${apiReferencePath}`);
    
    if (!fs.existsSync(apiReferencePath)) {
      logger.warn(`API reference file not found at ${apiReferencePath}`);
      return { endpoints: [], tableReferences: {} };
    }
    
    const content = fs.readFileSync(apiReferencePath, 'utf8');
    logger.info(`Successfully read ${content.length} bytes from API reference`);
    
    // Parse the markdown content
    const tokens = marked.lexer(content);
    
    // Extract API endpoints and database references
    const endpoints = [];
    const tableReferences = {};
    let currentEndpoint = null;
    let inDatabaseSection = false;
    
    for (const token of tokens) {
      // Track API endpoints (looking for ### headings with /api/)
      if (token.type === 'heading' && token.depth === 3 && token.text.includes('/api/')) {
        const endpointMatch = token.text.match(/(`[^`]+`)/);
        if (endpointMatch) {
          const endpoint = endpointMatch[1].replace(/`/g, '');
          currentEndpoint = {
            path: endpoint,
            method: token.text.includes('GET') ? 'GET' : 
                    token.text.includes('POST') ? 'POST' :
                    token.text.includes('PUT') ? 'PUT' :
                    token.text.includes('DELETE') ? 'DELETE' : 'UNKNOWN',
            description: '',
            relatedPage: getRelatedPage(endpoint),
            tables: []
          };
          endpoints.push(currentEndpoint);
        }
      }
      
      // Track database references sections
      if (token.type === 'heading' && token.depth === 4 && 
          (token.text.includes('Database') || token.text.includes('Tables'))) {
        inDatabaseSection = true;
        continue;
      }
      
      if (inDatabaseSection && token.type === 'heading' && token.depth <= 4) {
        inDatabaseSection = false;
      }
      
      // Extract table references from database sections
      if (inDatabaseSection && token.type === 'list' && currentEndpoint) {
        for (const item of token.items) {
          const tableMatch = item.text.match(/`([^`]+)`/g);
          if (tableMatch) {
            const tables = tableMatch.map(t => t.replace(/`/g, ''));
            currentEndpoint.tables.push(...tables);
            
            // Add to table references
            for (const table of tables) {
              if (!tableReferences[table]) {
                tableReferences[table] = [];
              }
              tableReferences[table].push(currentEndpoint.path);
            }
          }
        }
      }
      
      // Capture endpoint descriptions
      if (currentEndpoint && token.type === 'paragraph' && !inDatabaseSection) {
        currentEndpoint.description += token.text + ' ';
      }
    }
    
    logger.success(`Found ${endpoints.length} API endpoints with database dependencies`);
    return { endpoints, tableReferences };
  } catch (error) {
    logger.error(`Error parsing API reference: ${error.message}`);
    return { endpoints: [], tableReferences: {} };
  }
}

/**
 * Determine which frontend page an API endpoint is related to
 * @param {string} endpoint - API endpoint path
 * @returns {string} Related page name
 */
function getRelatedPage(endpoint) {
  if (endpoint.includes('/vehicles')) return 'vehicles';
  if (endpoint.includes('/venues')) return 'venues';
  if (endpoint.includes('/participants')) return 'participants';
  if (endpoint.includes('/staff')) return 'staff';
  if (endpoint.includes('/finance') || endpoint.includes('/financials')) return 'finance';
  if (endpoint.includes('/dashboard')) return 'dashboard';
  if (endpoint.includes('/schedule/master')) return 'master-schedule';
  if (endpoint.includes('/roster')) return 'roster';
  if (endpoint.includes('/cards')) return 'cards';
  return 'unknown';
}

/**
 * Compare existing database structure with API expectations
 * @param {Object} dbStructure - Database structure from PostgreSQL
 * @param {Object} apiExpectations - API expectations from reference doc
 * @returns {Object} Gaps and mismatches
 */
function identifyGaps(dbStructure, apiExpectations) {
  const { tableStructure, foreignKeys } = dbStructure;
  const { tableReferences } = apiExpectations;
  
  const missingTables = [];
  const missingColumns = {};
  const tablesByPage = {};
  
  // Check for tables referenced in API but missing in DB
  for (const table in tableReferences) {
    if (!tableStructure[table]) {
      missingTables.push({
        table,
        referencedBy: tableReferences[table],
        relatedPages: tableReferences[table].map(endpoint => getRelatedPage(endpoint)).filter((v, i, a) => a.indexOf(v) === i)
      });
    }
    
    // Group tables by page
    const pages = tableReferences[table].map(endpoint => getRelatedPage(endpoint)).filter((v, i, a) => a.indexOf(v) === i);
    for (const page of pages) {
      if (!tablesByPage[page]) {
        tablesByPage[page] = [];
      }
      tablesByPage[page].push(table);
    }
  }
  
  // Check for column mismatches in services
  const servicesDir = path.join(__dirname, 'backend', 'services');
  const serviceFiles = fs.readdirSync(servicesDir).filter(file => file.endsWith('.js'));
  
  for (const serviceFile of serviceFiles) {
    const serviceContent = fs.readFileSync(path.join(servicesDir, serviceFile), 'utf8');
    
    // Extract SQL queries
    const sqlQueries = extractSqlQueries(serviceContent);
    
    // Check each query for column references
    for (const query of sqlQueries) {
      const columnRefs = extractColumnReferences(query.sql);
      
      // Check if referenced columns exist
      for (const ref of columnRefs) {
        const { table, column } = ref;
        
        if (tableStructure[table]) {
          const columnExists = tableStructure[table].some(col => col.column_name === column);
          
          if (!columnExists) {
            if (!missingColumns[table]) {
              missingColumns[table] = [];
            }
            
            // Check if this column is already in the missing list
            const alreadyListed = missingColumns[table].some(c => c.column === column);
            
            if (!alreadyListed) {
              missingColumns[table].push({
                column,
                serviceFile,
                query: query.sql.substring(0, 100) + '...'
              });
            }
          }
        }
      }
    }
  }
  
  return { missingTables, missingColumns, tablesByPage };
}

/**
 * Extract SQL queries from service file content
 * @param {string} content - File content
 * @returns {Array} Array of query objects
 */
function extractSqlQueries(content) {
  const queries = [];
  
  // Match template literals containing SQL
  const templateRegex = /const\s+query\s*=\s*`([^`]+)`|query\s*=\s*`([^`]+)`|await\s+pool\.query\(`([^`]+)`/g;
  let match;
  
  while ((match = templateRegex.exec(content)) !== null) {
    const sql = match[1] || match[2] || match[3];
    if (sql && (sql.trim().toUpperCase().startsWith('SELECT') || 
                sql.trim().toUpperCase().startsWith('INSERT') || 
                sql.trim().toUpperCase().startsWith('UPDATE') || 
                sql.trim().toUpperCase().startsWith('DELETE'))) {
      queries.push({ sql });
    }
  }
  
  return queries;
}

/**
 * Extract column references from SQL query
 * @param {string} sql - SQL query
 * @returns {Array} Array of table.column references
 */
function extractColumnReferences(sql) {
  const refs = [];
  
  // Match table aliases in FROM/JOIN clauses
  const aliasRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+AS)?\s+([a-zA-Z0-9_]+)/gi;
  const aliases = {};
  let aliasMatch;
  
  while ((aliasMatch = aliasRegex.exec(sql)) !== null) {
    const table = aliasMatch[1];
    const alias = aliasMatch[2];
    aliases[alias] = table;
  }
  
  // Match column references with aliases
  const colRefRegex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
  let colMatch;
  
  while ((colMatch = colRefRegex.exec(sql)) !== null) {
    const alias = colMatch[1];
    const column = colMatch[2];
    
    // If it's an alias, use the actual table name
    const table = aliases[alias] || alias;
    
    refs.push({ table, column });
  }
  
  return refs;
}

/**
 * Generate action plan based on identified gaps
 * @param {Object} gaps - Identified gaps
 * @returns {Object} Action plan
 */
function generateActionPlan(gaps) {
  const { missingTables, missingColumns, tablesByPage } = gaps;
  
  // Group by page complexity
  const actionsByComplexity = {
    [PAGE_COMPLEXITY.SIMPLE]: [],
    [PAGE_COMPLEXITY.MODERATE]: [],
    [PAGE_COMPLEXITY.COMPLEX]: []
  };
  
  // Actions for missing tables
  for (const item of missingTables) {
    const highestComplexity = item.relatedPages.reduce((highest, page) => {
      const complexity = pageComplexityMap[page] || PAGE_COMPLEXITY.MODERATE;
      return complexity === PAGE_COMPLEXITY.COMPLEX ? complexity : 
             (highest === PAGE_COMPLEXITY.COMPLEX ? highest : complexity);
    }, PAGE_COMPLEXITY.SIMPLE);
    
    actionsByComplexity[highestComplexity].push({
      type: 'Create Table',
      target: item.table,
      relatedPages: item.relatedPages.join(', '),
      description: `Create missing table '${item.table}' referenced by ${item.referencedBy.length} endpoints`
    });
  }
  
  // Actions for missing columns
  for (const table in missingColumns) {
    // Find related pages for this table
    let relatedPages = [];
    for (const page in tablesByPage) {
      if (tablesByPage[page].includes(table)) {
        relatedPages.push(page);
      }
    }
    
    // Determine complexity
    const highestComplexity = relatedPages.reduce((highest, page) => {
      const complexity = pageComplexityMap[page] || PAGE_COMPLEXITY.MODERATE;
      return complexity === PAGE_COMPLEXITY.COMPLEX ? complexity : 
             (highest === PAGE_COMPLEXITY.COMPLEX ? highest : complexity);
    }, PAGE_COMPLEXITY.SIMPLE);
    
    // Add actions for each missing column
    for (const item of missingColumns[table]) {
      actionsByComplexity[highestComplexity].push({
        type: 'Add Column',
        target: `${table}.${item.column}`,
        relatedPages: relatedPages.join(', '),
        description: `Add missing column '${item.column}' to table '${table}' referenced in ${item.serviceFile}`
      });
    }
  }
  
  // Identify column name mismatches (e.g., instance_id vs loom_instance_id)
  const columnMismatches = [];
  for (const table in missingColumns) {
    for (const item of missingColumns[table]) {
      // Check for common mismatches
      if (item.column === 'instance_id' && table === 'event_card_map') {
        columnMismatches.push({
          type: 'Column Mismatch',
          table,
          expectedColumn: item.column,
          actualColumn: 'loom_instance_id',
          serviceFile: item.serviceFile
        });
      }
    }
  }
  
  return { actionsByComplexity, columnMismatches };
}

/**
 * Main audit function
 */
async function auditDatabase() {
  logger.info('Starting comprehensive database audit...');
  logger.info(`Connecting to PostgreSQL database: ${dbConfig.database} at ${dbConfig.host}:${dbConfig.port}`);
  
  try {
    // Get existing database structure
    const dbStructure = await getExistingTablesAndColumns();
    
    // Parse API reference
    const apiExpectations = await parseApiReference();
    
    // Identify gaps
    const gaps = identifyGaps(dbStructure, apiExpectations);
    
    // Generate action plan
    const actionPlan = generateActionPlan(gaps);
    
    // Generate report
    generateReport(dbStructure, apiExpectations, gaps, actionPlan);
    
    logger.success('Database audit completed successfully');
  } catch (err) {
    logger.error(`Audit failed: ${err.message}`);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
    logger.info('Database connection closed');
  }
}

/**
 * Generate and output the audit report
 * @param {Object} dbStructure - Database structure
 * @param {Object} apiExpectations - API expectations
 * @param {Object} gaps - Identified gaps
 * @param {Object} actionPlan - Generated action plan
 */
function generateReport(dbStructure, apiExpectations, gaps, actionPlan) {
  const { tableStructure, foreignKeys } = dbStructure;
  const { endpoints } = apiExpectations;
  const { missingTables, missingColumns, tablesByPage } = gaps;
  const { actionsByComplexity, columnMismatches } = actionPlan;
  
  // Create report directory if it doesn't exist
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }
  
  // Create report file
  const reportPath = path.join(reportDir, `database-audit-${new Date().toISOString().split('T')[0]}.md`);
  let report = `# Database Audit Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  // Database summary
  report += `## Database Summary\n\n`;
  report += `- **Database:** ${dbConfig.database}\n`;
  report += `- **Tables:** ${Object.keys(tableStructure).length}\n`;
  report += `- **Foreign Keys:** ${foreignKeys.length}\n\n`;
  
  // API summary
  report += `## API Summary\n\n`;
  report += `- **Endpoints:** ${endpoints.length}\n`;
  report += `- **Tables Referenced:** ${Object.keys(apiExpectations.tableReferences).length}\n\n`;
  
  // Missing tables
  report += `## Missing Tables\n\n`;
  if (missingTables.length === 0) {
    report += `No missing tables found.\n\n`;
  } else {
    report += `| Table | Referenced By | Related Pages |\n`;
    report += `|-------|--------------|---------------|\n`;
    for (const item of missingTables) {
      report += `| \`${item.table}\` | ${item.referencedBy.length} endpoints | ${item.relatedPages.join(', ')} |\n`;
    }
    report += `\n`;
  }
  
  // Missing columns
  report += `## Missing Columns\n\n`;
  if (Object.keys(missingColumns).length === 0) {
    report += `No missing columns found.\n\n`;
  } else {
    report += `| Table | Column | Referenced In | Query |\n`;
    report += `|-------|--------|--------------|-------|\n`;
    for (const table in missingColumns) {
      for (const item of missingColumns[table]) {
        report += `| \`${table}\` | \`${item.column}\` | ${item.serviceFile} | \`${item.query}\` |\n`;
      }
    }
    report += `\n`;
  }
  
  // Column mismatches
  report += `## Column Name Mismatches\n\n`;
  if (columnMismatches.length === 0) {
    report += `No column name mismatches found.\n\n`;
  } else {
    report += `| Table | Expected Column | Actual Column | Service File |\n`;
    report += `|-------|----------------|---------------|-------------|\n`;
    for (const mismatch of columnMismatches) {
      report += `| \`${mismatch.table}\` | \`${mismatch.expectedColumn}\` | \`${mismatch.actualColumn}\` | ${mismatch.serviceFile} |\n`;
    }
    report += `\n`;
  }
  
  // Action plan by complexity
  report += `## Action Plan\n\n`;
  
  // Simple actions
  report += `### Simple Pages (Vehicles, Venues, Participants)\n\n`;
  if (actionsByComplexity[PAGE_COMPLEXITY.SIMPLE].length === 0) {
    report += `No actions needed for simple pages.\n\n`;
  } else {
    report += `| Action | Target | Related Pages | Description |\n`;
    report += `|--------|--------|--------------|-------------|\n`;
    for (const action of actionsByComplexity[PAGE_COMPLEXITY.SIMPLE]) {
      report += `| ${action.type} | \`${action.target}\` | ${action.relatedPages} | ${action.description} |\n`;
    }
    report += `\n`;
  }
  
  // Moderate actions
  report += `### Moderate Pages (Staff, Finance)\n\n`;
  if (actionsByComplexity[PAGE_COMPLEXITY.MODERATE].length === 0) {
    report += `No actions needed for moderate pages.\n\n`;
  } else {
    report += `| Action | Target | Related Pages | Description |\n`;
    report += `|--------|--------|--------------|-------------|\n`;
    for (const action of actionsByComplexity[PAGE_COMPLEXITY.MODERATE]) {
      report += `| ${action.type} | \`${action.target}\` | ${action.relatedPages} | ${action.description} |\n`;
    }
    report += `\n`;
  }
  
  // Complex actions
  report += `### Complex Pages (Dashboard, Master Schedule, Roster, Cards)\n\n`;
  if (actionsByComplexity[PAGE_COMPLEXITY.COMPLEX].length === 0) {
    report += `No actions needed for complex pages.\n\n`;
  } else {
    report += `| Action | Target | Related Pages | Description |\n`;
    report += `|--------|--------|--------------|-------------|\n`;
    for (const action of actionsByComplexity[PAGE_COMPLEXITY.COMPLEX]) {
      report += `| ${action.type} | \`${action.target}\` | ${action.relatedPages} | ${action.description} |\n`;
    }
    report += `\n`;
  }
  
  // Tables by page
  report += `## Tables by Page\n\n`;
  for (const page in tablesByPage) {
    report += `### ${page}\n\n`;
    report += `- ${tablesByPage[page].map(t => `\`${t}\``).join('\n- ')}\n\n`;
  }
  
  // Write report to file
  fs.writeFileSync(reportPath, report);
  logger.success(`Report generated at ${reportPath}`);
  
  // Also generate a JSON file for programmatic use
  const jsonReport = {
    database: {
      name: dbConfig.database,
      tables: Object.keys(tableStructure).length,
      foreignKeys: foreignKeys.length
    },
    api: {
      endpoints: endpoints.length,
      tablesReferenced: Object.keys(apiExpectations.tableReferences).length
    },
    missingTables,
    missingColumns,
    columnMismatches,
    actionPlan: actionsByComplexity,
    tablesByPage
  };
  
  const jsonReportPath = path.join(reportDir, `database-audit-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  logger.success(`JSON report generated at ${jsonReportPath}`);
  
  // Print summary to console
  logger.info('\n=== AUDIT SUMMARY ===');
  logger.info(`Total tables in database: ${Object.keys(tableStructure).length}`);
  logger.info(`Missing tables: ${missingTables.length}`);
  logger.info(`Tables with missing columns: ${Object.keys(missingColumns).length}`);
  logger.info(`Column name mismatches: ${columnMismatches.length}`);
  logger.info(`Total actions needed: ${
    actionsByComplexity[PAGE_COMPLEXITY.SIMPLE].length +
    actionsByComplexity[PAGE_COMPLEXITY.MODERATE].length +
    actionsByComplexity[PAGE_COMPLEXITY.COMPLEX].length
  }`);
  
  // Print action plan summary
  logger.info('\n=== ACTION PLAN ===');
  logger.info(`Simple pages: ${actionsByComplexity[PAGE_COMPLEXITY.SIMPLE].length} actions`);
  logger.info(`Moderate pages: ${actionsByComplexity[PAGE_COMPLEXITY.MODERATE].length} actions`);
  logger.info(`Complex pages: ${actionsByComplexity[PAGE_COMPLEXITY.COMPLEX].length} actions`);
  
  // Print recommended approach
  logger.info('\n=== RECOMMENDED APPROACH ===');
  logger.info('1. Start with simple pages (Vehicles, Venues, Participants)');
  logger.info('2. Move to moderate pages (Staff, Finance)');
  logger.info('3. Tackle complex pages (Dashboard, Master Schedule, Roster, Cards)');
  logger.info('4. Fix column name mismatches in services');
  logger.info('5. Create missing tables and columns');
}

// Run the audit
auditDatabase().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
