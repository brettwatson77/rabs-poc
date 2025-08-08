#!/usr/bin/env node
/**
 * getreport-simple.js - RABS Simple Compliance Checker
 * 
 * A simplified version that focuses on core functionality:
 * - Updates database docs using goonmakethatdbpretty.sh
 * - Generates basic API docs
 * - Creates a simple report
 * - Tracks progress trajectory by comparing with previous reports
 * 
 * Usage: node scripts/getreport-simple.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  masterSpecPath: '../MASTER_SPEC.md',
  currentDatabasePath: '../CURRENT_DATABASE.md',
  currentApiPath: '../CURRENT_API.md',
  databaseSnapshotScript: '../goonmakethatdbpretty.sh',
  backendDir: '../backend',
  frontendDir: '../frontend',
  routesDir: '../backend/routes',
  controllersDir: '../backend/controllers',
  servicesDir: '../backend/services',
  databaseDir: '../database',
  // outputReportPath will be set dynamically so each report is timestamped
  outputReportPath: null,
  // Directories that should never be scanned
  ignoreDirs: ['ITTBNF', 'node_modules', '.git', 'archive', 'docs_archive'],
  // Number of previous reports to compare with
  maxPreviousReports: 3
};

// --------------------------------------------------------------------------- //
//                 Initialize timestamped report location                      //
// --------------------------------------------------------------------------- //

const REPORT_DIR = path.join('..', 'reportcards');
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
    complianceScore: 0
  },
  apiEndpoints: [],
  missingDirectories: [],
  missingFiles: [],
  detailedFindings: []
};

/**
 * Updates the CURRENT_DATABASE.md file by running the database snapshot script
 * @returns {boolean} Success status
 */
function updateDatabaseSnapshot() {
  console.log('🗄️  Updating database snapshot...');
  
  try {
    if (!fs.existsSync(CONFIG.databaseSnapshotScript)) {
      console.warn(`⚠️  Database snapshot script not found at ${CONFIG.databaseSnapshotScript}`);
      return false;
    }
    
    // Make sure the script is executable
    try {
      execSync(`chmod +x ${CONFIG.databaseSnapshotScript}`);
    } catch (error) {
      console.warn(`⚠️  Could not make script executable: ${error.message}`);
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
    console.log(`Running: ${CONFIG.databaseSnapshotScript}`);
    execSync(`${CONFIG.databaseSnapshotScript}`, {
      stdio: 'inherit', // Show output in console
      env: env // Pass environment variables
    });
    
    console.log(`✅ Database snapshot updated at ${CONFIG.currentDatabasePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating database snapshot: ${error.message}`);
    return false;
  }
}

/**
 * Scans backend files to extract API routes
 * @returns {Array} Extracted API routes
 */
function scanBackendRoutes() {
  console.log('🔍 Scanning backend routes...');
  
  try {
    const routes = [];
    
    if (!fs.existsSync(CONFIG.routesDir)) {
      console.warn(`⚠️  ${CONFIG.routesDir} not found. Skipping backend routes scan.`);
      report.missingDirectories.push(CONFIG.routesDir);
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
    
    console.log(`✅ Found ${routes.length} API routes in backend`);
    return routes;
  } catch (error) {
    console.error(`❌ Error scanning backend routes: ${error.message}`);
    return [];
  }
}

/**
 * Generates the CURRENT_API.md file by scanning backend routes
 * @returns {boolean} Success status
 */
function generateApiDocumentation(routes) {
  console.log('📝 Generating API documentation...');
  
  try {
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
    
    if (Object.keys(routesByPath).length === 0) {
      markdown += `No API endpoints found. Backend routes directory may be empty.\n\n`;
    } else {
      for (const [basePath, endpoints] of Object.entries(routesByPath)) {
        markdown += `### ${basePath}\n\n`;
        markdown += `| Method | Path | Handler |\n`;
        markdown += `|--------|------|--------|\n`;
        
        for (const endpoint of endpoints) {
          markdown += `| ${endpoint.method} | ${endpoint.fullPath} | ${endpoint.handler} |\n`;
        }
        
        markdown += `\n`;
      }
    }
    
    // Write to file
    fs.writeFileSync(CONFIG.currentApiPath, markdown);
    
    console.log(`✅ API documentation generated at ${CONFIG.currentApiPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error generating API documentation: ${error.message}`);
    return false;
  }
}

/**
 * Check for required directories and files
 */
function checkRequiredFiles() {
  console.log('🔍 Checking required directories and files...');
  
  const requiredDirs = [
    CONFIG.backendDir,
    CONFIG.frontendDir,
    CONFIG.databaseDir,
    path.join(CONFIG.backendDir, 'routes'),
    path.join(CONFIG.backendDir, 'controllers'),
    path.join(CONFIG.backendDir, 'services'),
    path.join(CONFIG.backendDir, 'models'),
    path.join(CONFIG.frontendDir, 'src'),
    path.join(CONFIG.frontendDir, 'public')
  ];
  
  const requiredFiles = [
    CONFIG.masterSpecPath,
    '../package.json',
    '../.env',
    '../README.md'
  ];
  
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      console.warn(`⚠️  Required directory not found: ${dir}`);
      report.missingDirectories.push(dir);
    } else {
      console.log(`✅ Found directory: ${dir}`);
    }
  }
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.warn(`⚠️  Required file not found: ${file}`);
      report.missingFiles.push(file);
    } else {
      console.log(`✅ Found file: ${file}`);
    }
  }
}

/**
 * Find the most recent report files in the reportcards directory
 * @returns {Array} Array of report file paths, sorted by most recent first
 */
function findPreviousReports() {
  try {
    if (!fs.existsSync(REPORT_DIR)) {
      return [];
    }
    
    const reportFiles = fs.readdirSync(REPORT_DIR)
      .filter(file => file.startsWith('COMPLIANCE_REPORT_') && file.endsWith('.md'))
      .map(file => ({
        path: path.join(REPORT_DIR, file),
        timestamp: file.replace('COMPLIANCE_REPORT_', '').replace('.md', ''),
        date: new Date(file.replace('COMPLIANCE_REPORT_', '').replace('.md', '').replace(/-/g, ':').slice(0, -4))
      }))
      .sort((a, b) => b.date - a.date) // Sort by date, most recent first
      .slice(0, CONFIG.maxPreviousReports); // Take only the most recent N reports
    
    return reportFiles;
  } catch (error) {
    console.error(`❌ Error finding previous reports: ${error.message}`);
    return [];
  }
}

/**
 * Extract key metrics from a report file
 * @param {string} reportPath - Path to the report file
 * @returns {Object} Extracted metrics
 */
function extractMetricsFromReport(reportPath) {
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    
    // Extract metrics using regex
    const apiEndpointsMatch = content.match(/Found (\d+) API endpoints/);
    const apiEndpointsCount = apiEndpointsMatch ? parseInt(apiEndpointsMatch[1]) : 0;
    
    const missingDirsMatch = content.match(/Missing Directories\n\n([\s\S]*?)(?=\n\n##|$)/);
    const missingDirsCount = missingDirsMatch && missingDirsMatch[1].includes('- ') 
      ? missingDirsMatch[1].split('- ').filter(Boolean).length 
      : 0;
    
    const missingFilesMatch = content.match(/Missing Files\n\n([\s\S]*?)(?=\n\n##|$)/);
    const missingFilesCount = missingFilesMatch && missingFilesMatch[1].includes('- ') 
      ? missingFilesMatch[1].split('- ').filter(Boolean).length 
      : 0;
    
    // Extract timestamp from filename
    const filenameMatch = reportPath.match(/COMPLIANCE_REPORT_(.+)\.md$/);
    const timestamp = filenameMatch 
      ? filenameMatch[1].replace(/-/g, ':').slice(0, -4)
      : 'unknown';
    
    return {
      timestamp,
      date: new Date(timestamp),
      apiEndpointsCount,
      missingDirsCount,
      missingFilesCount,
      totalIssues: missingDirsCount + missingFilesCount - apiEndpointsCount
    };
  } catch (error) {
    console.error(`❌ Error extracting metrics from ${reportPath}: ${error.message}`);
    return {
      timestamp: 'unknown',
      date: new Date(0),
      apiEndpointsCount: 0,
      missingDirsCount: 0, 
      missingFilesCount: 0,
      totalIssues: 0
    };
  }
}

/**
 * Compare current metrics with previous ones to show progress/regression
 * @param {Object} currentMetrics - Current report metrics
 * @param {Array} previousMetrics - Array of previous report metrics
 * @returns {Object} Comparison results
 */
function compareMetrics(currentMetrics, previousMetrics) {
  if (!previousMetrics || previousMetrics.length === 0) {
    return {
      firstReport: true,
      apiEndpointsChange: { value: 0, status: 'neutral' },
      missingDirsChange: { value: 0, status: 'neutral' },
      missingFilesChange: { value: 0, status: 'neutral' },
      totalIssuesChange: { value: 0, status: 'neutral' }
    };
  }
  
  // Compare with most recent previous report
  const mostRecent = previousMetrics[0];
  
  return {
    firstReport: false,
    previousDate: mostRecent.date,
    apiEndpointsChange: {
      value: currentMetrics.apiEndpointsCount - mostRecent.apiEndpointsCount,
      status: currentMetrics.apiEndpointsCount > mostRecent.apiEndpointsCount ? 'improved' : 
              currentMetrics.apiEndpointsCount < mostRecent.apiEndpointsCount ? 'regressed' : 'neutral'
    },
    missingDirsChange: {
      value: mostRecent.missingDirsCount - currentMetrics.missingDirsCount,
      status: currentMetrics.missingDirsCount < mostRecent.missingDirsCount ? 'improved' : 
              currentMetrics.missingDirsCount > mostRecent.missingDirsCount ? 'regressed' : 'neutral'
    },
    missingFilesChange: {
      value: mostRecent.missingFilesCount - currentMetrics.missingFilesCount,
      status: currentMetrics.missingFilesCount < mostRecent.missingFilesCount ? 'improved' : 
              currentMetrics.missingFilesCount > mostRecent.missingFilesCount ? 'regressed' : 'neutral'
    },
    totalIssuesChange: {
      value: mostRecent.totalIssues - currentMetrics.totalIssues,
      status: currentMetrics.totalIssues < mostRecent.totalIssues ? 'improved' : 
              currentMetrics.totalIssues > mostRecent.totalIssues ? 'regressed' : 'neutral'
    }
  };
}

/**
 * Get a status indicator emoji based on change status
 * @param {string} status - Status ('improved', 'regressed', 'neutral')
 * @returns {string} Status emoji
 */
function getStatusIndicator(status) {
  switch (status) {
    case 'improved':
      return '⬆️ ';
    case 'regressed':
      return '⬇️ ';
    case 'neutral':
    default:
      return '➡️ ';
  }
}

/**
 * Generates a comprehensive report based on all checks
 */
function generateReport() {
  console.log('📝 Generating compliance report...');
  
  // Current metrics
  const currentMetrics = {
    timestamp: new Date().toISOString(),
    date: new Date(),
    apiEndpointsCount: report.apiEndpoints.length,
    missingDirsCount: report.missingDirectories.length,
    missingFilesCount: report.missingFiles.length,
    totalIssues: report.missingDirectories.length + report.missingFiles.length - report.apiEndpoints.length
  };
  
  // Find previous reports and extract metrics
  const previousReports = findPreviousReports();
  const previousMetrics = previousReports.map(reportFile => 
    extractMetricsFromReport(reportFile.path)
  );
  
  // Compare current metrics with previous ones
  const comparison = compareMetrics(currentMetrics, previousMetrics);
  
  // Generate markdown report
  let markdown = `# RABS Spec Compliance Report\n\n`;
  markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // Summary section
  markdown += `## Summary\n\n`;
  markdown += `- API Endpoints: ${currentMetrics.apiEndpointsCount}\n`;
  markdown += `- Missing Directories: ${currentMetrics.missingDirsCount}\n`;
  markdown += `- Missing Files: ${currentMetrics.missingFilesCount}\n\n`;
  
  // Progress Trajectory section
  markdown += `## Progress Trajectory\n\n`;
  
  if (comparison.firstReport) {
    markdown += `This is the first compliance report. Future reports will show progress trajectory.\n\n`;
  } else {
    const prevDate = comparison.previousDate.toLocaleString();
    markdown += `Comparing with previous report from ${prevDate}:\n\n`;
    
    markdown += `| Metric | Previous | Current | Change | Status |\n`;
    markdown += `|--------|----------|---------|--------|--------|\n`;
    
    const apiStatus = getStatusIndicator(comparison.apiEndpointsChange.status);
    const dirsStatus = getStatusIndicator(comparison.missingDirsChange.status);
    const filesStatus = getStatusIndicator(comparison.missingFilesChange.status);
    const totalStatus = getStatusIndicator(comparison.totalIssuesChange.status);
    
    const prevMetrics = previousMetrics[0];
    
    markdown += `| API Endpoints | ${prevMetrics.apiEndpointsCount} | ${currentMetrics.apiEndpointsCount} | ${comparison.apiEndpointsChange.value >= 0 ? '+' : ''}${comparison.apiEndpointsChange.value} | ${apiStatus} |\n`;
    markdown += `| Missing Directories | ${prevMetrics.missingDirsCount} | ${currentMetrics.missingDirsCount} | ${comparison.missingDirsChange.value >= 0 ? '+' : ''}${comparison.missingDirsChange.value} | ${dirsStatus} |\n`;
    markdown += `| Missing Files | ${prevMetrics.missingFilesCount} | ${currentMetrics.missingFilesCount} | ${comparison.missingFilesChange.value >= 0 ? '+' : ''}${comparison.missingFilesChange.value} | ${filesStatus} |\n`;
    markdown += `| Total Issues | ${prevMetrics.totalIssues} | ${currentMetrics.totalIssues} | ${comparison.totalIssuesChange.value >= 0 ? '+' : ''}${comparison.totalIssuesChange.value} | ${totalStatus} |\n\n`;
    
    // Add trend visualization if we have multiple previous reports
    if (previousMetrics.length > 1) {
      markdown += `### Trend Over Time\n\n`;
      markdown += `Last ${previousMetrics.length + 1} reports:\n\n`;
      
      // Create a simple ASCII chart
      markdown += "```\n";
      markdown += `Issues |${previousMetrics.map(() => '-').join('')}->\n`;
      
      const allMetrics = [...previousMetrics.slice().reverse(), currentMetrics];
      const maxIssues = Math.max(...allMetrics.map(m => m.totalIssues));
      
      for (let i = maxIssues; i > 0; i -= Math.max(1, Math.floor(maxIssues / 10))) {
        markdown += `${i.toString().padStart(6)} |${allMetrics.map(m => m.totalIssues >= i ? '*' : ' ').join('')}\n`;
      }
      
      markdown += `       +${allMetrics.map(() => '-').join('')}\n`;
      markdown += `        ${allMetrics.map((_, i) => i + 1).join(' ')}\n`;
      markdown += "```\n\n";
    }
  }
  
  // API Endpoints
  markdown += `## API Endpoints\n\n`;
  if (report.apiEndpoints.length > 0) {
    markdown += `Found ${report.apiEndpoints.length} API endpoints.\n\n`;
    markdown += `| Method | Path | Handler |\n`;
    markdown += `|--------|------|--------|\n`;
    
    for (const endpoint of report.apiEndpoints) {
      markdown += `| ${endpoint.method} | ${endpoint.fullPath} | ${endpoint.handler} |\n`;
    }
  } else {
    markdown += `No API endpoints found. Backend routes directory may be empty.\n`;
  }
  
  markdown += `\n`;
  
  // Missing Directories
  markdown += `## Missing Directories\n\n`;
  if (report.missingDirectories.length > 0) {
    markdown += `The following directories are missing and should be created:\n\n`;
    for (const dir of report.missingDirectories) {
      markdown += `- ${dir}\n`;
    }
  } else {
    markdown += `All required directories exist.\n`;
  }
  
  markdown += `\n`;
  
  // Missing Files
  markdown += `## Missing Files\n\n`;
  if (report.missingFiles.length > 0) {
    markdown += `The following files are missing and should be created:\n\n`;
    for (const file of report.missingFiles) {
      markdown += `- ${file}\n`;
    }
  } else {
    markdown += `All required files exist.\n`;
  }
  
  markdown += `\n`;
  
  // Database Info
  markdown += `## Database Information\n\n`;
  if (fs.existsSync(CONFIG.currentDatabasePath)) {
    markdown += `Database snapshot available at: ${CONFIG.currentDatabasePath}\n`;
    
    try {
      const dbContent = fs.readFileSync(CONFIG.currentDatabasePath, 'utf8');
      const tableMatch = dbContent.match(/## Tables and Row Counts([\s\S]*?)(?=##|$)/);
      
      if (tableMatch) {
        markdown += `\n### Tables and Row Counts\n\n`;
        markdown += tableMatch[1].trim() + '\n\n';
      }
    } catch (error) {
      markdown += `Error reading database snapshot: ${error.message}\n`;
    }
  } else {
    markdown += `No database snapshot available. Run the database snapshot script first.\n`;
  }
  
  // Write report to file
  fs.writeFileSync(CONFIG.outputReportPath, markdown);
  
  console.log(`✅ Report generated successfully: ${CONFIG.outputReportPath}`);
  
  // Print summary to console
  console.log('\n=== COMPLIANCE SUMMARY ===');
  console.log(`API Endpoints: ${report.apiEndpoints.length}`);
  console.log(`Missing Directories: ${report.missingDirectories.length}`);
  console.log(`Missing Files: ${report.missingFiles.length}`);
  
  // Print trajectory summary if available
  if (!comparison.firstReport) {
    console.log('\n=== TRAJECTORY ===');
    console.log(`API Endpoints: ${getStatusIndicator(comparison.apiEndpointsChange.status)} ${comparison.apiEndpointsChange.value >= 0 ? '+' : ''}${comparison.apiEndpointsChange.value}`);
    console.log(`Missing Directories: ${getStatusIndicator(comparison.missingDirsChange.status)} ${comparison.missingDirsChange.value >= 0 ? '+' : ''}${comparison.missingDirsChange.value}`);
    console.log(`Missing Files: ${getStatusIndicator(comparison.missingFilesChange.status)} ${comparison.missingFilesChange.value >= 0 ? '+' : ''}${comparison.missingFilesChange.value}`);
    console.log(`Total Issues: ${getStatusIndicator(comparison.totalIssuesChange.status)} ${comparison.totalIssuesChange.value >= 0 ? '+' : ''}${comparison.totalIssuesChange.value}`);
  }
  
  console.log(`\nReport saved to: ${CONFIG.outputReportPath}`);
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
  console.log('\n=== RABS SPEC COMPLIANCE CHECKER ===\n');
  
  // Step 1: Update database snapshot
  const dbUpdated = updateDatabaseSnapshot();
  
  if (!dbUpdated) {
    console.warn('⚠️  Could not update database snapshot. Will use existing file if available.');
  }
  
  // Step 2: Check required files and directories
  checkRequiredFiles();
  
  // Step 3: Scan backend routes
  const backendRoutes = scanBackendRoutes();
  report.apiEndpoints = backendRoutes;
  
  // Step 4: Generate API documentation
  generateApiDocumentation(backendRoutes);
  
  // Step 5: Generate report
  generateReport();
}

// Run the main function
main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
