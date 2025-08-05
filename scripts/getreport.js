#!/usr/bin/env node
/**
 * getreport.js - RABS Spec Compliance Checker
 * 
 * Analyzes the codebase against MASTER_SPEC.md and generates a compliance report.
 * Checks API contracts, database schema alignment, naming conventions, etc.
 * 
 * Usage: node scripts/getreport.js [options]
 * Options:
 *   --verbose    Show detailed findings
 *   --fix        Generate fix suggestions where possible
 *   --section=X  Only check specific section (api, db, naming, frontend)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk'); // For colorful console output

// Configuration
const CONFIG = {
  masterSpecPath: './MASTER_SPEC.md',
  currentDatabasePath: './CURRENT_DATABASE.md',
  currentApiPath: './CURRENT_API.md',
  databaseSnapshotScript: './goonmakethatdbpretty.sh',
  backendDir: './backend',
  frontendDir: './frontend',
  routesDir: './backend/routes',
  controllersDir: './backend/controllers',
  servicesDir: './backend/services',
  databaseDir: './database',
  // outputReportPath will be set dynamically so each report is timestamped
  outputReportPath: null,
  openAiApiKey: process.env.OPENAI_API_KEY || null,
  useAi: false, // Set to true to enable AI-powered analysis
  // Directories that should never be scanned
  ignoreDirs: ['ITTBNF', 'node_modules', '.git', 'archive', 'docs_archive']
};

// --------------------------------------------------------------------------- //
//                 Initialise timestamped report location                      //
// --------------------------------------------------------------------------- //

const REPORT_DIR = path.join('.', 'reportcards');
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const TS_STRING = new Date().toISOString().replace(/[:.]/g, '-');
CONFIG.outputReportPath = path.join(
  REPORT_DIR,
  `COMPLIANCE_REPORT_${TS_STRING}.md`
);

// Initialize report structure
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    warningChecks: 0,
    complianceScore: 0,
    sections: {}
  },
  apiCompliance: {
    endpoints: [],
    missingEndpoints: [],
    wrongMethods: [],
    wrongPayloads: [],
    wrongResponses: []
  },
  dbCompliance: {
    tables: [],
    missingTables: [],
    missingColumns: [],
    wrongTypes: [],
    missingConstraints: []
  },
  namingConventions: {
    violations: []
  },
  frontendCompliance: {
    components: [],
    apiCallViolations: []
  },
  detailedFindings: []
};

/**
 * Updates the CURRENT_DATABASE.md file by running the database snapshot script
 * @returns {boolean} Success status
 */
function updateDatabaseSnapshot() {
  console.log(chalk.blue('🗄️ Updating database snapshot...'));
  
  try {
    if (!fs.existsSync(CONFIG.databaseSnapshotScript)) {
      console.warn(chalk.yellow(`⚠️ Database snapshot script not found at ${CONFIG.databaseSnapshotScript}`));
      return false;
    }
    
    // Make sure the script is executable
    try {
      execSync(`chmod +x ${CONFIG.databaseSnapshotScript}`);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not make script executable: ${error.message}`));
    }
    
    // Get database connection info from .env file (might be used by the script)
    const dbUser = process.env.DB_USER || 'postgres';
    const dbName = process.env.DB_NAME || 'rabspocdb';
    
    // Set environment variables for the script
    const env = {
      ...process.env,
      DB_USER: dbUser,
      DB_NAME: dbName,
      OUTPUT_FILE: CONFIG.currentDatabasePath
    };
    
    // Run the bash script directly
    console.log(chalk.blue(`Running: ${CONFIG.databaseSnapshotScript} > ${CONFIG.currentDatabasePath}`));
    execSync(`${CONFIG.databaseSnapshotScript}`, {
      stdio: 'inherit', // Show output in console
      env: env // Pass environment variables
    });
    
    console.log(chalk.green(`✅ Database snapshot updated at ${CONFIG.currentDatabasePath}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error updating database snapshot: ${error.message}`));
    return false;
  }
}

/**
 * Generates the CURRENT_API.md file by scanning backend routes
 * @returns {boolean} Success status
 */
function generateApiDocumentation() {
  console.log(chalk.blue('📝 Generating API documentation...'));
  
  try {
    const routes = scanBackendRoutes();
    
    // Group routes by base path
    const routesByPath = {};
    for (const route of routes) {
      const basePath = route.fullPath.split('/').slice(0, 4).join('/');
      if (!routesByPath[basePath]) {
        routesByPath[basePath] = [];
      }
      routesByPath[basePath].push(route);
    }
    
    // Generate markdown documentation
    let markdown = `# RABS API Documentation\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
    markdown += `## API Endpoints\n\n`;
    
    for (const [basePath, endpoints] of Object.entries(routesByPath)) {
      markdown += `### ${basePath}\n\n`;
      markdown += `| Method | Path | Handler |\n`;
      markdown += `|--------|------|--------|\n`;
      
      for (const endpoint of endpoints) {
        markdown += `| ${endpoint.method} | ${endpoint.fullPath} | ${endpoint.handler} |\n`;
      }
      
      markdown += `\n`;
    }
    
    // Write to file
    fs.writeFileSync(CONFIG.currentApiPath, markdown);
    
    console.log(chalk.green(`✅ API documentation generated at ${CONFIG.currentApiPath}`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error generating API documentation: ${error.message}`));
    return false;
  }
}

/**
 * Parses the MASTER_SPEC.md file to extract rules and requirements
 * @returns {Object} Parsed spec content
 */
function parseMasterSpec() {
  console.log(chalk.blue('📋 Parsing MASTER_SPEC.md...'));
  
  try {
    const specContent = fs.readFileSync(CONFIG.masterSpecPath, 'utf8');
    
    // Extract sections using regex
    const sections = {};
    
    // Extract workshed model
    const workshedModelMatch = specContent.match(/## 1\. Workshed Mental Model([\s\S]*?)---/);
    if (workshedModelMatch) {
      sections.workshedModel = workshedModelMatch[1].trim();
    }
    
    // Extract API contracts
    const apiContractsMatch = specContent.match(/## 3\. Core Data Domains & Endpoints([\s\S]*?)---/);
    if (apiContractsMatch) {
      sections.apiContracts = parseApiContractsTable(apiContractsMatch[1].trim());
    }
    
    // Extract naming conventions
    const namingConventionsMatch = specContent.match(/## 7\. Naming & Format Conventions([\s\S]*?)---/);
    if (namingConventionsMatch) {
      sections.namingConventions = parseNamingConventions(namingConventionsMatch[1].trim());
    }
    
    // Extract minimum viable tables
    const minTablesMatch = specContent.match(/## 8\. Minimum Viable Tables([\s\S]*?)---/);
    if (minTablesMatch) {
      const tablesText = minTablesMatch[1].trim();
      const tablesMatch = tablesText.match(/`([^`]+)`/);
      if (tablesMatch) {
        sections.minimumViableTables = tablesMatch[1].split(', ');
      }
    }
    
    console.log(chalk.green(`✅ Successfully parsed MASTER_SPEC.md with ${Object.keys(sections).length} sections`));
    return sections;
  } catch (error) {
    console.error(chalk.red(`❌ Error parsing MASTER_SPEC.md: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Parses API contracts table from the spec
 * @param {string} tableContent - Raw table content from markdown
 * @returns {Array} Parsed API contracts
 */
function parseApiContractsTable(tableContent) {
  const contracts = [];
  
  // Split by lines and find table rows
  const lines = tableContent.split('\n');
  let inTable = false;
  
  for (const line of lines) {
    if (line.trim().startsWith('|') && line.includes('Main Endpoint')) {
      inTable = true;
      continue;
    }
    
    if (inTable && line.trim().startsWith('|')) {
      // Skip separator row
      if (line.includes('---')) continue;
      
      // Parse table row
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      if (cells.length >= 4) {
        const domain = cells[0];
        const component = cells[1];
        const endpoints = cells[2].split(' ').filter(ep => ep.startsWith('`')).map(ep => ep.replace(/`/g, ''));
        const payload = cells[3];
        
        contracts.push({
          domain,
          component,
          endpoints,
          payload
        });
      }
    }
  }
  
  return contracts;
}

/**
 * Parses naming conventions from the spec
 * @param {string} content - Raw naming conventions content
 * @returns {Object} Parsed naming conventions
 */
function parseNamingConventions(content) {
  const conventions = {};
  
  // Extract bullet points
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('•')) {
      const parts = line.trim().substring(1).split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const value = parts[1].trim();
        conventions[key] = value;
      }
    }
  }
  
  return conventions;
}

/**
 * Parses the CURRENT_DATABASE.md file to extract schema information
 * @returns {Object} Database schema information
 */
function parseCurrentDatabase() {
  console.log(chalk.blue('🗄️ Parsing CURRENT_DATABASE.md...'));
  
  try {
    if (!fs.existsSync(CONFIG.currentDatabasePath)) {
      console.warn(chalk.yellow(`⚠️ ${CONFIG.currentDatabasePath} not found. Skipping database compliance checks.`));
      return null;
    }
    
    const dbContent = fs.readFileSync(CONFIG.currentDatabasePath, 'utf8');
    
    const schema = {
      tables: [],
      enums: [],
      relationships: []
    };
    
    // Extract tables
    const tableMatches = dbContent.matchAll(/### Table: ([a-zA-Z0-9_]+)([\s\S]*?)(?=### Table:|---\n\n## |$)/g);
    for (const match of tableMatches) {
      const tableName = match[1];
      const tableContent = match[2];
      
      const table = {
        name: tableName,
        columns: [],
        primaryKey: null,
        foreignKeys: [],
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: []
      };
      
      // Extract row count
      const rowCountMatch = tableContent.match(/\*\*Row count:\*\* (\d+)/);
      if (rowCountMatch) {
        table.rowCount = parseInt(rowCountMatch[1], 10);
      }
      
      // Extract columns
      const columnsMatch = tableContent.match(/\| Column Name \| Data Type \| Length \| Nullable \| Default \|([\s\S]*?)(?=####|$)/);
      if (columnsMatch) {
        const columnRows = columnsMatch[1].trim().split('\n');
        for (const row of columnRows) {
          if (row.startsWith('|') && !row.includes('---|---')) {
            const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
            if (cells.length >= 5) {
              table.columns.push({
                name: cells[0],
                dataType: cells[1],
                length: cells[2],
                nullable: cells[3] === 'YES',
                default: cells[4]
              });
            }
          }
        }
      }
      
      // Extract primary key
      const pkMatch = tableContent.match(/#### Primary Key([\s\S]*?)(?=####|$)/);
      if (pkMatch) {
        const constraintMatch = pkMatch[1].match(/- Constraint Name: ([a-zA-Z0-9_]+)/);
        const columnsMatch = pkMatch[1].match(/- Columns: ([a-zA-Z0-9_, ]+)/);
        
        if (constraintMatch && columnsMatch) {
          table.primaryKey = {
            name: constraintMatch[1],
            columns: columnsMatch[1].split(', ')
          };
        }
      }
      
      // Extract foreign keys
      const fkMatch = tableContent.match(/#### Foreign Keys([\s\S]*?)(?=####|$)/);
      if (fkMatch) {
        const fkContent = fkMatch[1];
        const fkConstraints = fkContent.matchAll(/- Constraint Name: ([a-zA-Z0-9_]+)\n- Column: ([a-zA-Z0-9_]+) → References: ([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g);
        
        for (const fkMatch of fkConstraints) {
          table.foreignKeys.push({
            name: fkMatch[1],
            column: fkMatch[2],
            referencesTable: fkMatch[3],
            referencesColumn: fkMatch[4]
          });
        }
      }
      
      schema.tables.push(table);
    }
    
    // Extract enums
    const enumsMatch = dbContent.match(/## 2\. Enum Types([\s\S]*?)(?=##|$)/);
    if (enumsMatch) {
      const enumTable = enumsMatch[1];
      const enumRows = enumTable.match(/\| ([a-zA-Z0-9_]+) \| (.*) \|/g);
      
      if (enumRows) {
        for (const row of enumRows) {
          const match = row.match(/\| ([a-zA-Z0-9_]+) \| (.*) \|/);
          if (match) {
            schema.enums.push({
              name: match[1],
              values: match[2].split(', ')
            });
          }
        }
      }
    }
    
    // Extract relationships
    const relationshipsMatch = dbContent.match(/## 5\. Relationships([\s\S]*?)(?=##|$)/);
    if (relationshipsMatch) {
      const relationshipContent = relationshipsMatch[1];
      const relationshipLines = relationshipContent.match(/- \*\*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\*\* → \*\*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\*\* \(([a-zA-Z0-9_]+)\)/g);
      
      if (relationshipLines) {
        for (const line of relationshipLines) {
          const match = line.match(/- \*\*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\*\* → \*\*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\*\* \(([a-zA-Z0-9_]+)\)/);
          if (match) {
            schema.relationships.push({
              sourceTable: match[1],
              sourceColumn: match[2],
              targetTable: match[3],
              targetColumn: match[4],
              constraintName: match[5]
            });
          }
        }
      }
    }
    
    console.log(chalk.green(`✅ Successfully parsed database schema with ${schema.tables.length} tables, ${schema.enums.length} enums`));
    return schema;
  } catch (error) {
    console.error(chalk.red(`❌ Error parsing CURRENT_DATABASE.md: ${error.message}`));
    return null;
  }
}

/**
 * Scans backend files to extract API routes
 * @returns {Array} Extracted API routes
 */
function scanBackendRoutes() {
  console.log(chalk.blue('🔍 Scanning backend routes...'));
  
  try {
    const routes = [];
    
    if (!fs.existsSync(CONFIG.routesDir)) {
      console.warn(chalk.yellow(`⚠️ ${CONFIG.routesDir} not found. Skipping backend routes scan.`));
      return routes;
    }
    
    const routeFiles = fs.readdirSync(CONFIG.routesDir).filter(file => 
      file.endsWith('.js') && !file.startsWith('._') && !file.endsWith('.bak')
    );
    
    for (const file of routeFiles) {
      // Additional safety: skip if route file path includes ignored dirs
      if (CONFIG.ignoreDirs.some(dir => file.includes(`../${dir}`) || file.includes(`${dir}/`))) {
        continue;
      }
      const filePath = path.join(CONFIG.routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract route definitions
      const routerMatches = content.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g);
      for (const match of routerMatches) {
        const method = match[1].toUpperCase();
        const path = match[2];
        
        // Try to extract handler function name
        const handlerMatch = content.match(new RegExp(`router\\.${match[1]}\\(['"]${escapeRegExp(path)}['"],\\s*([a-zA-Z0-9_.]+)`));
        const handler = handlerMatch ? handlerMatch[1] : 'unknown';
        
        routes.push({
          file,
          method,
          path,
          handler,
          fullPath: `/api/v1${path.startsWith('/') ? path : '/' + path}`
        });
      }
    }
    
    console.log(chalk.green(`✅ Found ${routes.length} API routes in backend`));
    return routes;
  } catch (error) {
    console.error(chalk.red(`❌ Error scanning backend routes: ${error.message}`));
    return [];
  }
}

/**
 * Scans frontend files to extract API calls
 * @returns {Array} Extracted API calls
 */
function scanFrontendApiCalls() {
  console.log(chalk.blue('🔍 Scanning frontend API calls...'));
  
  try {
    const apiCalls = [];
    
    if (!fs.existsSync(CONFIG.frontendDir)) {
      console.warn(chalk.yellow(`⚠️ ${CONFIG.frontendDir} not found. Skipping frontend API calls scan.`));
      return apiCalls;
    }
    
    // Get all JS/JSX files recursively
    const jsxFiles = [];
    function scanDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        // Skip ignored directories completely
        if (CONFIG.ignoreDirs.some(ignored => filePath.includes(`${path.sep}${ignored}${path.sep}`))) {
          continue;
        }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          scanDir(filePath);
        } else if (
          (file.endsWith('.js') || file.endsWith('.jsx')) && 
          !file.startsWith('._') && 
          !file.endsWith('.test.js') && 
          !file.endsWith('.spec.js')
        ) {
          jsxFiles.push(filePath);
        }
      }
    }
    
    scanDir(CONFIG.frontendDir);
    
    for (const file of jsxFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(process.cwd(), file);
      
      // Look for axios calls
      const axiosMatches = content.matchAll(/axios\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g);
      for (const match of axiosMatches) {
        const method = match[1].toUpperCase();
        const url = match[2];
        
        // Try to extract payload for POST/PUT/PATCH
        let payload = null;
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          const payloadMatch = content.substring(match.index).match(/axios\.(?:post|put|patch)\([^,]+,\s*(\{[^}]+\})/);
          if (payloadMatch) {
            payload = payloadMatch[1];
          }
        }
        
        apiCalls.push({
          file: relativePath,
          method,
          url,
          payload
        });
      }
      
      // Look for fetch calls
      const fetchMatches = content.matchAll(/fetch\(['"]([^'"]+)['"]/g);
      for (const match of fetchMatches) {
        const url = match[1];
        
        // Try to extract method and payload
        const optionsMatch = content.substring(match.index).match(/fetch\([^,]+,\s*\{[^}]*method:\s*['"]([A-Z]+)['"]/);
        const method = optionsMatch ? optionsMatch[1] : 'GET';
        
        apiCalls.push({
          file: relativePath,
          method,
          url,
          payload: null
        });
      }
    }
    
    console.log(chalk.green(`✅ Found ${apiCalls.length} API calls in frontend`));
    return apiCalls;
  } catch (error) {
    console.error(chalk.red(`❌ Error scanning frontend API calls: ${error.message}`));
    return [];
  }
}

/**
 * Checks API compliance against the master spec
 * @param {Object} spec - Parsed master spec
 * @param {Array} backendRoutes - Extracted backend routes
 * @param {Array} frontendApiCalls - Extracted frontend API calls
 */
function checkApiCompliance(spec, backendRoutes, frontendApiCalls) {
  console.log(chalk.blue('🔍 Checking API compliance...'));
  
  const apiContracts = spec.apiContracts || [];
  const findings = [];
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  // Check if required endpoints exist in backend
  for (const contract of apiContracts) {
    for (const endpoint of contract.endpoints) {
      // Parse endpoint string to get method and path
      const methodMatch = endpoint.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
      if (!methodMatch) continue;
      
      const expectedMethod = methodMatch[1].toUpperCase();
      const expectedPath = methodMatch[2];
      
      // Check if this endpoint exists in backend routes
      const matchingRoute = backendRoutes.find(route => {
        // Handle path params vs query params
        const routePath = route.fullPath.replace(/\/:[^/]+/g, '/\\w+');
        const regexPath = new RegExp(`^${routePath.replace(/\//g, '\\/')}$`);
        return route.method === expectedMethod && regexPath.test(`/api/v1${expectedPath}`);
      });
      
      if (matchingRoute) {
        findings.push({
          type: 'success',
          message: `✅ Endpoint ${expectedMethod} ${expectedPath} exists in backend`,
          details: `Implemented in ${matchingRoute.file} as ${matchingRoute.handler}`
        });
        passCount++;
      } else {
        findings.push({
          type: 'error',
          message: `❌ Endpoint ${expectedMethod} ${expectedPath} is missing from backend`,
          details: `Required by ${contract.domain} (${contract.component})`
        });
        failCount++;
        
        report.apiCompliance.missingEndpoints.push({
          method: expectedMethod,
          path: expectedPath,
          domain: contract.domain,
          component: contract.component
        });
      }
    }
  }
  
  // Check if frontend is calling the correct endpoints
  for (const apiCall of frontendApiCalls) {
    // Normalize URL to match our API format
    let normalizedUrl = apiCall.url;
    if (normalizedUrl.startsWith('/')) {
      normalizedUrl = normalizedUrl;
    } else if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `/${normalizedUrl}`;
    }
    
    // Skip external API calls
    if (normalizedUrl.startsWith('http') && !normalizedUrl.includes('/api/v1')) {
      continue;
    }
    
    // Extract API path
    const apiPathMatch = normalizedUrl.match(/\/api\/v1\/([^?]+)/);
    if (!apiPathMatch) continue;
    
    const apiPath = apiPathMatch[1];
    
    // Check if this API call matches any contract
    let matchesContract = false;
    for (const contract of apiContracts) {
      for (const endpoint of contract.endpoints) {
        const methodMatch = endpoint.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
        if (!methodMatch) continue;
        
        const expectedMethod = methodMatch[1].toUpperCase();
        const expectedPath = methodMatch[2].replace(/^\//, '');
        
        // Simple path matching (could be improved with regex for path params)
        if (apiCall.method === expectedMethod && apiPath === expectedPath) {
          matchesContract = true;
          findings.push({
            type: 'success',
            message: `✅ Frontend API call ${apiCall.method} ${normalizedUrl} matches contract`,
            details: `In file ${apiCall.file}`
          });
          passCount++;
          break;
        }
      }
      
      if (matchesContract) break;
    }
    
    if (!matchesContract) {
      // Check if it at least matches a backend route
      const matchingRoute = backendRoutes.find(route => {
        return route.method === apiCall.method && route.fullPath.endsWith(apiPath);
      });
      
      if (matchingRoute) {
        findings.push({
          type: 'warning',
          message: `⚠️ Frontend API call ${apiCall.method} ${normalizedUrl} exists in backend but not in spec`,
          details: `In file ${apiCall.file}`
        });
        warningCount++;
      } else {
        findings.push({
          type: 'error',
          message: `❌ Frontend API call ${apiCall.method} ${normalizedUrl} doesn't match any contract or backend route`,
          details: `In file ${apiCall.file}`
        });
        failCount++;
        
        report.apiCompliance.wrongMethods.push({
          method: apiCall.method,
          url: normalizedUrl,
          file: apiCall.file
        });
      }
    }
  }
  
  // Update report
  report.summary.sections.api = {
    passCount,
    failCount,
    warningCount,
    complianceScore: Math.round((passCount / (passCount + failCount + warningCount)) * 100)
  };
  
  report.summary.totalChecks += passCount + failCount + warningCount;
  report.summary.passedChecks += passCount;
  report.summary.failedChecks += failCount;
  report.summary.warningChecks += warningCount;
  
  report.detailedFindings.push(...findings);
  
  console.log(chalk.green(`✅ API compliance check complete: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`));
}

/**
 * Checks database schema compliance against the master spec
 * @param {Object} spec - Parsed master spec
 * @param {Object} dbSchema - Parsed database schema
 */
function checkDatabaseCompliance(spec, dbSchema) {
  console.log(chalk.blue('🔍 Checking database schema compliance...'));
  
  if (!dbSchema) {
    console.warn(chalk.yellow('⚠️ No database schema available. Skipping database compliance check.'));
    return;
  }
  
  const minimumViableTables = spec.minimumViableTables || [];
  const findings = [];
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  // Check if all required tables exist
  for (const requiredTable of minimumViableTables) {
    const tableExists = dbSchema.tables.some(table => table.name === requiredTable);
    
    if (tableExists) {
      findings.push({
        type: 'success',
        message: `✅ Required table '${requiredTable}' exists in database`,
        details: `Table defined in section 8 of MASTER_SPEC.md`
      });
      passCount++;
    } else {
      findings.push({
        type: 'error',
        message: `❌ Required table '${requiredTable}' is missing from database`,
        details: `Table defined in section 8 of MASTER_SPEC.md`
      });
      failCount++;
      
      report.dbCompliance.missingTables.push(requiredTable);
    }
  }
  
  // Check naming conventions for tables and columns
  const namingConventions = spec.namingConventions || {};
  
  for (const table of dbSchema.tables) {
    // Check table name (should be snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(table.name)) {
      findings.push({
        type: 'error',
        message: `❌ Table name '${table.name}' doesn't follow snake_case convention`,
        details: `Table names should be lowercase with underscores`
      });
      failCount++;
      
      report.namingConventions.violations.push({
        type: 'table',
        name: table.name,
        issue: 'not snake_case'
      });
    for (const column of table.columns) {
      // Check column name (should be snake_case)
      if (!/^[a-z][a-z0-9_]*$/.test(column.name)) {
        findings.push({
    } // <-- Close snake_case check for table name
          type: 'error',
          message: `❌ Column name '${column.name}' in table '${table.name}' doesn't follow snake_case convention`,
          details: `Column names should be lowercase with underscores`
        });
        failCount++;
        
        report.namingConventions.violations.push({
          type: 'column',
          table: table.name,
          name: column.name,
          issue: 'not snake_case'
        });
      }
      
      // Check ID columns (should be UUID)
      if (column.name === 'id' && !column.dataType.toLowerCase().includes('uuid')) {
        findings.push({
          type: 'error',
          message: `❌ ID column in table '${table.name}' is not UUID type`,
          details: `Section 7 of MASTER_SPEC.md specifies IDs should be UUID v4`
        });
        failCount++;
        
        report.dbCompliance.wrongTypes.push({
          table: table.name,
          column: column.name,
          currentType: column.dataType,
          expectedType: 'uuid'
        });
      }
      
      // Check date columns
      if (column.name.includes('date') && !column.dataType.toLowerCase().includes('date')) {
        findings.push({
          type: 'warning',
          message: `⚠️ Date column '${column.name}' in table '${table.name}' is not a date type`,
          details: `Date columns should use date or timestamp types`
        });
        warningCount++;
      }
      
      // Check monetary columns
      if (column.name.includes('price') || column.name.includes('cost') || column.name.includes('rate')) {
        if (!column.dataType.toLowerCase().includes('numeric') && !column.dataType.toLowerCase().includes('decimal')) {
          findings.push({
            type: 'error',
            message: `❌ Monetary column '${column.name}' in table '${table.name}' is not numeric type`,
            details: `Section 7 specifies monetary values should be numeric(12,2)`
          });
          failCount++;
          
          report.dbCompliance.wrongTypes.push({
            table: table.name,
            column: column.name,
            currentType: column.dataType,
            expectedType: 'numeric(12,2)'
          });
        }
      }
    }
  }
  
  // Update report
  report.summary.sections.database = {
    passCount,
    failCount,
    warningCount,
    complianceScore: Math.round((passCount / (passCount + failCount + warningCount)) * 100)
  };
  
  report.summary.totalChecks += passCount + failCount + warningCount;
  report.summary.passedChecks += passCount;
  report.summary.failedChecks += failCount;
  report.summary.warningChecks += warningCount;
  
  report.detailedFindings.push(...findings);
  
  console.log(chalk.green(`✅ Database compliance check complete: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`));
}

/**
 * Checks frontend code compliance
 * @param {Object} spec - Parsed master spec
 * @param {Array} frontendApiCalls - Extracted frontend API calls
 */
function checkFrontendCompliance(spec, frontendApiCalls) {
  console.log(chalk.blue('🔍 Checking frontend code compliance...'));
  
  const findings = [];
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  // Check for consistent API response handling
  const frontendFiles = new Set(frontendApiCalls.map(call => call.file));
  
  for (const file of frontendFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check if the file handles API responses correctly
      const hasSuccessCheck = content.includes('.success') || content.includes('response.data.success');
      const hasErrorHandling = content.includes('catch') && (content.includes('error') || content.includes('err'));
      
      if (hasSuccessCheck) {
        findings.push({
          type: 'success',
          message: `✅ File ${file} correctly checks for success in API responses`,
          details: `Uses .success property as specified in data-flow pipeline`
        });
        passCount++;
      } else if (content.includes('axios') || content.includes('fetch')) {
        findings.push({
          type: 'error',
          message: `❌ File ${file} makes API calls but doesn't check for success property`,
          details: `Section 4 requires checking { success, data | errors } pattern`
        });
        failCount++;
        
        report.frontendCompliance.apiCallViolations.push({
          file,
          issue: 'missing success check'
        });
      }
      
      if (hasErrorHandling) {
        findings.push({
          type: 'success',
          message: `✅ File ${file} has proper error handling for API calls`,
          details: `Uses try/catch or .catch() for error handling`
        });
        passCount++;
      } else if (content.includes('axios') || content.includes('fetch')) {
        findings.push({
          type: 'error',
          message: `❌ File ${file} makes API calls but doesn't have proper error handling`,
          details: `Missing try/catch or .catch() for API calls`
        });
        failCount++;
        
        report.frontendCompliance.apiCallViolations.push({
          file,
          issue: 'missing error handling'
        });
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not read file ${file}: ${error.message}`));
    }
  }
  
  // Update report
  report.summary.sections.frontend = {
    passCount,
    failCount,
    warningCount,
    complianceScore: Math.round((passCount / (passCount + failCount + warningCount)) * 100)
  };
  
  report.summary.totalChecks += passCount + failCount + warningCount;
  report.summary.passedChecks += passCount;
  report.summary.failedChecks += failCount;
  report.summary.warningCount += warningCount;
  
  report.detailedFindings.push(...findings);
  
  console.log(chalk.green(`✅ Frontend compliance check complete: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`));
}

/**
 * Generates a comprehensive report based on all checks
 */
function generateReport() {
  console.log(chalk.blue('📝 Generating compliance report...'));
  
  // Calculate overall compliance score
  if (report.summary.totalChecks > 0) {
    report.summary.complianceScore = Math.round(
      (report.summary.passedChecks / report.summary.totalChecks) * 100
    );
  }
  
  // Generate markdown report
  let markdown = `# RABS Spec Compliance Report\n\n`;
  markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // Summary section
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Value |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Checks | ${report.summary.totalChecks} |\n`;
  markdown += `| Passed | ${report.summary.passedChecks} |\n`;
  markdown += `| Failed | ${report.summary.failedChecks} |\n`;
  markdown += `| Warnings | ${report.summary.warningChecks} |\n`;
  markdown += `| Overall Compliance | ${report.summary.complianceScore}% |\n\n`;
  
  // Section scores
  markdown += `### Section Scores\n\n`;
  markdown += `| Section | Passed | Failed | Warnings | Score |\n`;
  markdown += `|---------|--------|--------|----------|-------|\n`;
  
  for (const [section, scores] of Object.entries(report.summary.sections)) {
    markdown += `| ${section.charAt(0).toUpperCase() + section.slice(1)} | ${scores.passCount} | ${scores.failCount} | ${scores.warningCount} | ${scores.complianceScore}% |\n`;
  }
  
  markdown += `\n`;
  
  // API compliance
  markdown += `## API Compliance\n\n`;
  
  if (report.apiCompliance.missingEndpoints.length > 0) {
    markdown += `### Missing Endpoints\n\n`;
    markdown += `| Method | Path | Domain | Component |\n`;
    markdown += `|--------|------|--------|----------|\n`;
    
    for (const endpoint of report.apiCompliance.missingEndpoints) {
      markdown += `| ${endpoint.method} | ${endpoint.path} | ${endpoint.domain} | ${endpoint.component} |\n`;
    }
    
    markdown += `\n`;
  }
  
  if (report.apiCompliance.wrongMethods.length > 0) {
    markdown += `### Incorrect API Calls\n\n`;
    markdown += `| Method | URL | File |\n`;
    markdown += `|--------|-----|------|\n`;
    
    for (const call of report.apiCompliance.wrongMethods) {
      markdown += `| ${call.method} | ${call.url} | ${call.file} |\n`;
    }
    
    markdown += `\n`;
  }
  
  // Database compliance
  markdown += `## Database Compliance\n\n`;
  
  if (report.dbCompliance.missingTables.length > 0) {
    markdown += `### Missing Tables\n\n`;
    markdown += `The following tables are required by the spec but missing from the database:\n\n`;
    
    for (const table of report.dbCompliance.missingTables) {
      markdown += `- ${table}\n`;
    }
    
    markdown += `\n`;
  }
  
  if (report.dbCompliance.wrongTypes.length > 0) {
    markdown += `### Incorrect Column Types\n\n`;
    markdown += `| Table | Column | Current Type | Expected Type |\n`;
    markdown += `|-------|--------|-------------|---------------|\n`;
    
    for (const column of report.dbCompliance.wrongTypes) {
      markdown += `| ${column.table} | ${column.column} | ${column.currentType} | ${column.expectedType} |\n`;
    }
    
    markdown += `\n`;
  }
  
  // Naming conventions
  markdown += `## Naming Convention Violations\n\n`;
  
  if (report.namingConventions.violations.length > 0) {
    markdown += `| Type | Name | Issue |\n`;
    markdown += `|------|------|-------|\n`;
    
    for (const violation of report.namingConventions.violations) {
      markdown += `| ${violation.type} | ${violation.table ? `${violation.table}.${violation.name}` : violation.name} | ${violation.issue} |\n`;
    }
  } else {
    markdown += `No naming convention violations found.\n`;
  }
  
  markdown += `\n`;
  
  // Frontend compliance
  markdown += `## Frontend Compliance\n\n`;
  
  if (report.frontendCompliance.apiCallViolations.length > 0) {
    markdown += `### API Call Violations\n\n`;
    markdown += `| File | Issue |\n`;
    markdown += `|------|-------|\n`;
    
    for (const violation of report.frontendCompliance.apiCallViolations) {
      markdown += `| ${violation.file} | ${violation.issue} |\n`;
    }
  } else {
    markdown += `No frontend API call violations found.\n`;
  }
  
  markdown += `\n`;
  
  // Detailed findings
  markdown += `## Detailed Findings\n\n`;
  
  for (const finding of report.detailedFindings) {
    const icon = finding.type === 'success' ? '✅' : finding.type === 'error' ? '❌' : '⚠️';
    markdown += `### ${icon} ${finding.message}\n\n`;
    markdown += `${finding.details}\n\n`;
  }
  
  // Write report to file
  fs.writeFileSync(CONFIG.outputReportPath, markdown);
  
  console.log(chalk.green(`✅ Report generated successfully: ${CONFIG.outputReportPath}`));
  
  // Print summary to console
  console.log('\n' + chalk.bold('=== COMPLIANCE SUMMARY ==='));
  console.log(chalk.bold(`Overall Compliance: ${report.summary.complianceScore}%`));
  console.log(`Total Checks: ${report.summary.totalChecks}`);
  console.log(chalk.green(`Passed: ${report.summary.passedChecks}`));
  console.log(chalk.red(`Failed: ${report.summary.failedChecks}`));
  console.log(chalk.yellow(`Warnings: ${report.summary.warningChecks}`));
  
  // Print section scores
  console.log('\n' + chalk.bold('=== SECTION SCORES ==='));
  for (const [section, scores] of Object.entries(report.summary.sections)) {
    const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
    console.log(`${sectionName}: ${scores.complianceScore}% (${scores.passCount} passed, ${scores.failCount} failed, ${scores.warningCount} warnings)`);
  }
  
  // Print critical issues
  if (report.apiCompliance.missingEndpoints.length > 0 || report.dbCompliance.missingTables.length > 0) {
    console.log('\n' + chalk.bold.red('=== CRITICAL ISSUES ==='));
    
    if (report.apiCompliance.missingEndpoints.length > 0) {
      console.log(chalk.red(`Missing ${report.apiCompliance.missingEndpoints.length} required API endpoints`));
    }
    
    if (report.dbCompliance.missingTables.length > 0) {
      console.log(chalk.red(`Missing ${report.dbCompliance.missingTables.length} required database tables`));
    }
  }
  
  // Use AI to provide recommendations if enabled
  if (CONFIG.useAi && CONFIG.openAiApiKey) {
    console.log('\n' + chalk.blue('🤖 Generating AI recommendations...'));
    generateAiRecommendations();
  }
}

/**
 * Uses OpenAI to generate recommendations based on compliance issues
 */
async function generateAiRecommendations() {
  try {
    const { Configuration, OpenAIApi } = require('openai');
    
    const configuration = new Configuration({
      apiKey: CONFIG.openAiApiKey,
    });
    const openai = new OpenAIApi(configuration);
    // Create a prompt based on the report
    let prompt = `Analyze this compliance report and provide specific recommendations to fix the issues:\n\n`;
    prompt += `Missing API Endpoints: ${report.apiCompliance.missingEndpoints.map(e => `${e.method} ${e.path}`).join(', ')}\n`;
    prompt += `Missing Database Tables: ${report.dbCompliance.missingTables.join(', ')}\n`;
    prompt += `Wrong Column Types: ${report.dbCompliance.wrongTypes.map(c => `${c.table}.${c.column} is ${c.currentType}, should be ${c.expectedType}`).join(', ')}\n`;
    prompt += `Naming Convention Violations: ${report.namingConventions.violations.map(v => `${v.type} ${v.name} (${v.issue})`).join(', ')}\n`;
    
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const recommendations = response.data.choices[0].text.trim();
    
    // Append recommendations to the report
    fs.appendFileSync(CONFIG.outputReportPath, `\n\n## AI Recommendations\n\n${recommendations}\n`);
    
    console.log(chalk.green('✅ AI recommendations added to report'));
  } catch (error) {
    console.error(chalk.red(`❌ Error generating AI recommendations: ${error.message}`));
  }
}

/**
 * Helper function to escape special characters in regex
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main function that orchestrates the entire report generation process
 */
async function main() {
  console.log(chalk.bold('\n=== RABS SPEC COMPLIANCE CHECKER ===\n'));
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const fix = args.includes('--fix');
  const sectionArg = args.find(arg => arg.startsWith('--section='));
  const section = sectionArg ? sectionArg.split('=')[1] : null;
  
  // Enable AI if API key is available
  if (CONFIG.openAiApiKey) {
    CONFIG.useAi = true;
    console.log(chalk.blue('🤖 AI recommendations enabled'));
  }
  
  // Step 0: Update database snapshot and API documentation
  console.log(chalk.blue('🔄 Updating documentation before running checks...'));
  const dbUpdated = updateDatabaseSnapshot();
  const apiDocsUpdated = generateApiDocumentation();
  
  if (!dbUpdated) {
    console.warn(chalk.yellow('⚠️ Could not update database snapshot. Will use existing file if available.'));
  }
  
  if (!apiDocsUpdated) {
    console.warn(chalk.yellow('⚠️ Could not generate API documentation. Will proceed with compliance checks.'));
  }
  
  // Step 1: Parse master spec
  const spec = parseMasterSpec();
  
  // Step 2: Parse database schema
  const dbSchema = parseCurrentDatabase();
  
  // Step 3: Scan backend routes
  const backendRoutes = scanBackendRoutes();
  
  // Step 4: Scan frontend API calls
  const frontendApiCalls = scanFrontendApiCalls();
  
  // Step 5: Check API compliance
  if (!section || section === 'api') {
    checkApiCompliance(spec, backendRoutes, frontendApiCalls);
  }
  
  // Step 6: Check database compliance
  if (!section || section === 'db') {
    checkDatabaseCompliance(spec, dbSchema);
  }
  
  // Step 7: Check frontend compliance
  if (!section || section === 'frontend') {
    checkFrontendCompliance(spec, frontendApiCalls);
  }
  
  // Step 8: Generate report
  generateReport();
  
  // Step 9: Generate fix suggestions if requested
  if (fix) {
    console.log(chalk.blue('\n🔧 Generating fix suggestions...'));
    console.log(chalk.yellow('This feature is not yet implemented.'));
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red(`❌ Fatal error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
});
