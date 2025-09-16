#!/usr/bin/env node
/**
 * test-migration.js
 * 
 * This script performs a non-destructive analysis of SQLite patterns in the codebase
 * to help plan the migration to PostgreSQL. It identifies files that would need 
 * conversion but DOES NOT modify any files.
 * 
 * It analyzes:
 * - SQLite method usage (db.run, db.get, db.all)
 * - Parameter placeholder styles (? vs $1)
 * - Transaction patterns
 * - Connection management
 * 
 * Usage:
 *   node test-migration.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Promisify fs functions
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);

// Define directories to scan
const BACKEND_DIR = path.join(__dirname, 'backend');
const SERVICES_DIR = path.join(BACKEND_DIR, 'services');
const CONTROLLERS_DIR = path.join(BACKEND_DIR, 'controllers');
const DATABASE_DIR = path.join(__dirname, 'database');

// Patterns to identify SQLite code
const PATTERNS = {
  IMPORT_WRAPPER: /getDbConnection.*?require\(['"]\.\.\/database['"]\)/,
  WRAPPER_USAGE: /getDbConnection\(\)/,
  SQLITE_METHODS: {
    RUN: /db\.run\(/g,
    GET: /db\.get\(/g, 
    ALL: /db\.all\(/g,
    EACH: /db\.each\(/g
  },
  DB_CLOSE: /db\.close\(\)/g,
  PROMISE_RACE: /Promise\.race\(/g,
  TIMEOUT_PATTERN: /setTimeout\(.*?['"](?:wrapper|database).*?timeout['"]/i,
  TRANSACTION_BEGIN: /db\.run\(['"]BEGIN TRANSACTION['"]/g,
  TRANSACTION_COMMIT: /db\.run\(['"]COMMIT['"]/g,
  TRANSACTION_ROLLBACK: /db\.run\(['"]ROLLBACK['"]/g,
  SQLITE_REQUIRE: /sqlite3.*?require\(['"]sqlite3['"]\)/,
  QUESTION_MARKS: /(['"`].*?)(\?)(.*?['"`])/g,
};

// Track analysis results
const analysisResults = {
  scannedFiles: 0,
  filesWithSQLite: [],
  patternCounts: {
    dbRun: 0,
    dbGet: 0,
    dbAll: 0,
    dbEach: 0,
    dbClose: 0,
    transactions: {
      begin: 0,
      commit: 0,
      rollback: 0
    },
    questionMarks: 0
  },
  seedJsUsesSQLite: false,
  packageJsonHasSQLite: false,
  errors: []
};

/**
 * Recursively scan a directory for files
 */
async function scanDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files = [...files, ...(await scanDirectory(fullPath))];
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.bak')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Count occurrences of a pattern in text
 */
function countOccurrences(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Analyze a file for SQLite patterns
 */
async function analyzeFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    analysisResults.scannedFiles++;
    
    // Check for SQLite patterns
    const dbRunCount = countOccurrences(content, PATTERNS.SQLITE_METHODS.RUN);
    const dbGetCount = countOccurrences(content, PATTERNS.SQLITE_METHODS.GET);
    const dbAllCount = countOccurrences(content, PATTERNS.SQLITE_METHODS.ALL);
    const dbEachCount = countOccurrences(content, PATTERNS.SQLITE_METHODS.EACH);
    const dbCloseCount = countOccurrences(content, PATTERNS.DB_CLOSE);
    const beginCount = countOccurrences(content, PATTERNS.TRANSACTION_BEGIN);
    const commitCount = countOccurrences(content, PATTERNS.TRANSACTION_COMMIT);
    const rollbackCount = countOccurrences(content, PATTERNS.TRANSACTION_ROLLBACK);
    
    // Count question mark placeholders in SQL strings
    let questionMarkCount = 0;
    let match;
    const regex = new RegExp(PATTERNS.QUESTION_MARKS);
    while ((match = regex.exec(content)) !== null) {
      if (match[2] === '?' && /SELECT|INSERT|UPDATE|DELETE/i.test(match[0])) {
        questionMarkCount++;
      }
    }
    
    // Update total counts
    analysisResults.patternCounts.dbRun += dbRunCount;
    analysisResults.patternCounts.dbGet += dbGetCount;
    analysisResults.patternCounts.dbAll += dbAllCount;
    analysisResults.patternCounts.dbEach += dbEachCount;
    analysisResults.patternCounts.dbClose += dbCloseCount;
    analysisResults.patternCounts.transactions.begin += beginCount;
    analysisResults.patternCounts.transactions.commit += commitCount;
    analysisResults.patternCounts.transactions.rollback += rollbackCount;
    analysisResults.patternCounts.questionMarks += questionMarkCount;
    
    // Check if file has SQLite patterns
    const hasSQLitePatterns = 
      dbRunCount > 0 || 
      dbGetCount > 0 || 
      dbAllCount > 0 || 
      dbEachCount > 0 || 
      beginCount > 0 || 
      commitCount > 0 || 
      rollbackCount > 0 ||
      PATTERNS.IMPORT_WRAPPER.test(content) ||
      PATTERNS.WRAPPER_USAGE.test(content) ||
      PATTERNS.SQLITE_REQUIRE.test(content);
    
    if (hasSQLitePatterns) {
      analysisResults.filesWithSQLite.push({
        path: filePath,
        filename: path.basename(filePath),
        patterns: {
          dbRun: dbRunCount,
          dbGet: dbGetCount,
          dbAll: dbAllCount,
          dbEach: dbEachCount,
          dbClose: dbCloseCount,
          transactions: {
            begin: beginCount,
            commit: commitCount,
            rollback: rollbackCount
          },
          questionMarks: questionMarkCount,
          hasWrapperImport: PATTERNS.IMPORT_WRAPPER.test(content),
          usesWrapper: PATTERNS.WRAPPER_USAGE.test(content),
          usesSqliteRequire: PATTERNS.SQLITE_REQUIRE.test(content)
        }
      });
    }
    
    return hasSQLitePatterns;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    analysisResults.errors.push({ file: filePath, error: error.message });
    return false;
  }
}

/**
 * Check if seed.js uses SQLite
 */
async function checkSeedJs() {
  try {
    const seedPath = path.join(DATABASE_DIR, 'seed.js');
    const content = await readFile(seedPath, 'utf8');
    
    analysisResults.seedJsUsesSQLite = PATTERNS.SQLITE_REQUIRE.test(content);
    
    return analysisResults.seedJsUsesSQLite;
  } catch (error) {
    console.error('Error checking seed.js:', error);
    analysisResults.errors.push({ file: 'database/seed.js', error: error.message });
    return false;
  }
}

/**
 * Check if package.json has SQLite dependency
 */
async function checkPackageJson() {
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const content = await readFile(packagePath, 'utf8');
    
    // Parse package.json
    const packageJson = JSON.parse(content);
    
    // Check for SQLite dependency
    analysisResults.packageJsonHasSQLite = 
      packageJson.dependencies && 
      packageJson.dependencies.sqlite3 !== undefined;
    
    return analysisResults.packageJsonHasSQLite;
  } catch (error) {
    console.error('Error checking package.json:', error);
    analysisResults.errors.push({ file: 'package.json', error: error.message });
    return false;
  }
}

/**
 * Generate a summary of the analysis
 */
function generateSummary() {
  console.log('\n===== SQLite to PostgreSQL Migration Analysis =====');
  console.log(`Total files scanned: ${analysisResults.scannedFiles}`);
  console.log(`Files with SQLite patterns: ${analysisResults.filesWithSQLite.length}`);
  
  console.log('\nPattern counts:');
  console.log(`- db.run() calls: ${analysisResults.patternCounts.dbRun}`);
  console.log(`- db.get() calls: ${analysisResults.patternCounts.dbGet}`);
  console.log(`- db.all() calls: ${analysisResults.patternCounts.dbAll}`);
  console.log(`- db.each() calls: ${analysisResults.patternCounts.dbEach}`);
  console.log(`- db.close() calls: ${analysisResults.patternCounts.dbClose}`);
  console.log(`- Transaction statements: ${
    analysisResults.patternCounts.transactions.begin + 
    analysisResults.patternCounts.transactions.commit + 
    analysisResults.patternCounts.transactions.rollback
  }`);
  console.log(`- Question mark placeholders: ${analysisResults.patternCounts.questionMarks}`);
  
  console.log('\nOther SQLite dependencies:');
  console.log(`- seed.js uses SQLite: ${analysisResults.seedJsUsesSQLite}`);
  console.log(`- package.json has SQLite dependency: ${analysisResults.packageJsonHasSQLite}`);
  
  if (analysisResults.errors.length > 0) {
    console.log('\nErrors encountered:');
    analysisResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.file}: ${error.error}`);
    });
  }
  
  console.log('\nFiles that would be modified:');
  analysisResults.filesWithSQLite.forEach((file, index) => {
    console.log(`\n${index + 1}. ${file.filename} (${file.path})`);
    console.log(`   - db.run calls: ${file.patterns.dbRun}`);
    console.log(`   - db.get calls: ${file.patterns.dbGet}`);
    console.log(`   - db.all calls: ${file.patterns.dbAll}`);
    console.log(`   - db.each calls: ${file.patterns.dbEach}`);
    console.log(`   - db.close calls: ${file.patterns.dbClose}`);
    console.log(`   - Transactions: Begin=${file.patterns.transactions.begin}, Commit=${file.patterns.transactions.commit}, Rollback=${file.patterns.transactions.rollback}`);
    console.log(`   - Question marks: ${file.patterns.questionMarks}`);
    console.log(`   - Uses wrapper import: ${file.patterns.hasWrapperImport}`);
    console.log(`   - Uses getDbConnection(): ${file.patterns.usesWrapper}`);
    console.log(`   - Directly requires sqlite3: ${file.patterns.usesSqliteRequire}`);
  });
  
  console.log('\n===== Migration Impact Assessment =====');
  const totalChanges = 
    analysisResults.patternCounts.dbRun + 
    analysisResults.patternCounts.dbGet + 
    analysisResults.patternCounts.dbAll + 
    analysisResults.patternCounts.dbEach + 
    analysisResults.patternCounts.dbClose +
    analysisResults.patternCounts.transactions.begin + 
    analysisResults.patternCounts.transactions.commit + 
    analysisResults.patternCounts.transactions.rollback +
    analysisResults.patternCounts.questionMarks;
  
  console.log(`Total pattern changes required: ${totalChanges}`);
  console.log(`Total files to modify: ${analysisResults.filesWithSQLite.length + (analysisResults.seedJsUsesSQLite ? 1 : 0) + (analysisResults.packageJsonHasSQLite ? 1 : 0)}`);
  
  let riskLevel = 'Low';
  if (totalChanges > 100) riskLevel = 'Medium';
  if (totalChanges > 300) riskLevel = 'High';
  if (totalChanges > 500) riskLevel = 'Very High';
  
  console.log(`Estimated migration risk level: ${riskLevel}`);
  
  console.log('\nRecommended approach:');
  if (riskLevel === 'Low') {
    console.log('- Safe to proceed with full migration script');
  } else if (riskLevel === 'Medium') {
    console.log('- Consider migrating files in batches');
    console.log('- Test each batch before proceeding');
  } else {
    console.log('- Migrate one file at a time');
    console.log('- Start with simpler files (fewer patterns)');
    console.log('- Test thoroughly after each file');
    console.log('- Consider manual migration for complex files');
  }
  
  // Write analysis to file
  const analysisPath = path.join(__dirname, 'sqlite-migration-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysisResults, null, 2), 'utf8');
  console.log(`\nDetailed analysis written to: ${analysisPath}`);
}

/**
 * Main analysis function
 */
async function analyzeForMigration() {
  try {
    console.log('Starting SQLite to PostgreSQL migration analysis...');
    console.log('NOTE: This script only analyzes files and does not modify them.');
    
    // Scan backend directories for files
    console.log('Scanning files...');
    const serviceFiles = await scanDirectory(SERVICES_DIR);
    const controllerFiles = await scanDirectory(CONTROLLERS_DIR);
    const allFiles = [...serviceFiles, ...controllerFiles];
    
    console.log(`Found ${allFiles.length} files to analyze`);
    
    // Analyze each file for SQLite patterns
    for (const filePath of allFiles) {
      await analyzeFile(filePath);
    }
    
    // Check seed.js
    console.log('Checking database/seed.js...');
    await checkSeedJs();
    
    // Check package.json
    console.log('Checking package.json...');
    await checkPackageJson();
    
    // Generate summary
    generateSummary();
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// Run the analysis
analyzeForMigration();
