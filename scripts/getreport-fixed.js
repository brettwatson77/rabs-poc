#!/usr/bin/env node
/**
 * getreport-fixed.js - RABS Simple Compliance Checker
 * 
 * A simplified version that focuses on core functionality:
 * - Updates database docs using goonmakethatdbpretty.sh
 * - Generates basic API docs
 * - Checks for missing files/directories
 * - Creates a simple report
 * 
 * Usage: node scripts/getreport-fixed.js
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
  // Directories that should never be scanned
  ignoreDirs: ['ITTBNF', 'node_modules', '.git', 'archive', 'docs_archive']
};

// Create reportcards directory if it doesn't exist
const REPORT_DIR = path.join('.', 'reportcards');
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Create timestamped report filename
const TS_STRING = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_REPORT_PATH = path.join(
  REPORT_DIR,
  `COMPLIANCE_REPORT_${TS_STRING}.md`
);

// Simple report structure
const report = {
  timestamp: new Date().toISOString(),
  missingDirs: [],
  missingFiles: [],
  apiEndpoints: [],
  databaseTables: [],
  findings: []
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
    console.log(chalk.blue(`Running: ${CONFIG.databaseSnapshotScript}`));
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
    if (!fs.existsSync(CONFIG.routesDir)) {
      console.warn(chalk.yellow(`⚠️ ${CONFIG.routesDir} not found. Skipping API documentation generation.`));
      return false;
    }
    
    const routes = [];
    const routeFiles = fs.readdirSync(CONFIG.routesDir).filter(file => 
      file.endsWith('.js') && !file.startsWith('._') && !file.endsWith('.bak')
    );
    
    for (const file of routeFiles) {
      const filePath = path.join(CONFIG.routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract route definitions using simple regex
      const routerMatches = content.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g);
      for (const match of Array.from(routerMatches)) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        
        routes.push({
          file,
          method,
          path: routePath,
          fullPath: `/api/v1${routePath.startsWith('/') ? routePath : '/' + routePath}`
        });
      }
    }
    
    // Generate markdown documentation
    let markdown = `# RABS API Documentation\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
    markdown += `## API Endpoints\n\n`;
    markdown += `| Method | Path | File |\n`;
    markdown += `|--------|------|------|\n`;
    
    for (const route of routes) {
      markdown += `| ${route.method} | ${route.fullPath} | ${route.file} |\n`;
      report.apiEndpoints.push(route);
    }
    
    // Write to file
    fs.writeFileSync(CONFIG.currentApiPath, markdown);
    
    console.log(chalk.green(`✅ API documentation generated at ${CONFIG.currentApiPath} (${routes.length} routes found)`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error generating API documentation: ${error.message}`));
    return false;
  }
}

/**
 * Checks for required directories and files
 */
function checkRequiredFiles() {
  console.log(chalk.blue('🔍 Checking for required directories and files...'));
  
  // Check required directories
  const requiredDirs = [
    './backend',
    './frontend',
    './database',
    './scripts'
  ];
  
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      console.warn(chalk.yellow(`⚠️ Required directory ${dir} not found`));
      report.missingDirs.push(dir);
      report.findings.push({
        type: 'warning',
        message: `Required directory ${dir} not found`
      });
    }
  }
  
  // Check required files
  const requiredFiles = [
    './MASTER_SPEC.md',
    './package.json',
    './README.md'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.warn(chalk.yellow(`⚠️ Required file ${file} not found`));
      report.missingFiles.push(file);
      report.findings.push({
        type: 'warning',
        message: `Required file ${file} not found`
      });
    }
  }
}

/**
 * Extract table names from database snapshot
 */
function extractDatabaseInfo() {
  console.log(chalk.blue('📊 Extracting database information...'));
  
  try {
    if (!fs.existsSync(CONFIG.currentDatabasePath)) {
      console.warn(chalk.yellow(`⚠️ ${CONFIG.currentDatabasePath} not found. Skipping database info extraction.`));
      return;
    }
    
    const content = fs.readFileSync(CONFIG.currentDatabasePath, 'utf8');
    
    // Simple regex to extract table names and row counts from markdown tables
    const tablePattern = /\|\s*([a-zA-Z0-9_]+)\s*\|\s*(\d+)\s*\|/g;
    const matches = content.matchAll(tablePattern);
    
    for (const match of Array.from(matches)) {
      const tableName = match[1];
      const rowCount = parseInt(match[2], 10);
      
      // Skip system tables or tables that might appear in other contexts
      if (!tableName.startsWith('pg_') && 
          !tableName.startsWith('sql_') && 
          !tableName.startsWith('information_schema')) {
        report.databaseTables.push({
          name: tableName,
          rowCount
        });
      }
    }
    
    console.log(chalk.green(`✅ Found ${report.databaseTables.length} tables in database`));
  } catch (error) {
    console.error(chalk.red(`❌ Error extracting database info: ${error.message}`));
  }
}

/**
 * Generates a simple compliance report
 */
function generateReport() {
  console.log(chalk.blue('📝 Generating compliance report...'));
  
  // Generate markdown report
  let markdown = `# RABS Simple Compliance Report\n\n`;
  markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // System information
  markdown += `## System Information\n\n`;
  markdown += `- Node.js version: ${process.version}\n`;
  markdown += `- Platform: ${process.platform}\n\n`;
  
  // Directory structure
  markdown += `## Directory Structure\n\n`;
  if (report.missingDirs.length > 0) {
    markdown += `### Missing Directories\n\n`;
    for (const dir of report.missingDirs) {
      markdown += `- ${dir}\n`;
    }
    markdown += `\n`;
  } else {
    markdown += `All required directories are present.\n\n`;
  }
  
  if (report.missingFiles.length > 0) {
    markdown += `### Missing Files\n\n`;
    for (const file of report.missingFiles) {
      markdown += `- ${file}\n`;
    }
    markdown += `\n`;
  } else {
    markdown += `All required files are present.\n\n`;
  }
  
  // API endpoints
  markdown += `## API Endpoints\n\n`;
  markdown += `Total API endpoints found: ${report.apiEndpoints.length}\n\n`;
  
  if (report.apiEndpoints.length > 0) {
    markdown += `| Method | Path | File |\n`;
    markdown += `|--------|------|------|\n`;
    
    for (const endpoint of report.apiEndpoints) {
      markdown += `| ${endpoint.method} | ${endpoint.fullPath} | ${endpoint.file} |\n`;
    }
    
    markdown += `\n`;
  } else {
    markdown += `No API endpoints found.\n\n`;
  }
  
  // Database tables
  markdown += `## Database Tables\n\n`;
  markdown += `Total database tables found: ${report.databaseTables.length}\n\n`;
  
  if (report.databaseTables.length > 0) {
    markdown += `| Table Name | Row Count |\n`;
    markdown += `|------------|----------:|\n`;
    
    for (const table of report.databaseTables) {
      markdown += `| ${table.name} | ${table.rowCount} |\n`;
    }
    
    markdown += `\n`;
  } else {
    markdown += `No database tables found.\n\n`;
  }
  
  // Findings
  if (report.findings.length > 0) {
    markdown += `## Findings\n\n`;
    
    for (const finding of report.findings) {
      const icon = finding.type === 'error' ? '❌' : '⚠️';
      markdown += `- ${icon} ${finding.message}\n`;
    }
    
    markdown += `\n`;
  }
  
  // Write report to file
  fs.writeFileSync(OUTPUT_REPORT_PATH, markdown);
  
  console.log(chalk.green(`✅ Report generated successfully: ${OUTPUT_REPORT_PATH}`));
  
  // Print summary to console
  console.log('\n' + chalk.bold('=== COMPLIANCE SUMMARY ==='));
  console.log(`API Endpoints: ${report.apiEndpoints.length}`);
  console.log(`Database Tables: ${report.databaseTables.length}`);
  console.log(`Missing Directories: ${report.missingDirs.length}`);
  console.log(`Missing Files: ${report.missingFiles.length}`);
  console.log(`Findings: ${report.findings.length}`);
}

/**
 * Main function that orchestrates the entire report generation process
 */
async function main() {
  console.log(chalk.bold('\n=== RABS SIMPLE COMPLIANCE CHECKER ===\n'));
  
  // Step 1: Update database snapshot
  updateDatabaseSnapshot();
  
  // Step 2: Generate API documentation
  generateApiDocumentation();
  
  // Step 3: Check required files and directories
  checkRequiredFiles();
  
  // Step 4: Extract database information
  extractDatabaseInfo();
  
  // Step 5: Generate report
  generateReport();
}

// Run the main function
main().catch(error => {
  console.error(chalk.red(`❌ Fatal error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
});
