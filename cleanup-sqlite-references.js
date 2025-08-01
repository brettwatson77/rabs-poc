#!/usr/bin/env node
/**
 * cleanup-sqlite-references.js
 * 
 * This script scans the backend/services directory to identify files that
 * still contain SQLite wrapper references and need to be updated to use
 * direct PostgreSQL connections.
 * 
 * Usage:
 *   node cleanup-sqlite-references.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);

// Patterns to look for
const PATTERNS = {
  IMPORT_WRAPPER: /getDbConnection.*?require\(['"]\.\.\/database['"]\)/,
  WRAPPER_USAGE: /getDbConnection\(\)/,
  SQLITE_METHODS: /db\.(all|get|run|each)/,
  DB_CLOSE: /db\.close\(\)/,
  PROMISE_RACE: /Promise\.race\(/,
  TIMEOUT_PATTERN: /setTimeout\(.*?['"](wrapper|database).*?timeout['"]/i,
  POOL_CREATION: /new Pool\(/,
};

// Directory to scan
const SERVICES_DIR = path.join(__dirname, 'backend', 'services');

/**
 * Check if a file contains SQLite wrapper references
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} Object with findings
 */
async function checkFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    
    // Initialize findings object
    const findings = {
      path: filePath,
      filename: path.basename(filePath),
      hasWrapperImport: PATTERNS.IMPORT_WRAPPER.test(content),
      usesWrapper: PATTERNS.WRAPPER_USAGE.test(content),
      usesSqliteMethods: PATTERNS.SQLITE_METHODS.test(content),
      usesDbClose: PATTERNS.DB_CLOSE.test(content),
      usesPromiseRace: PATTERNS.PROMISE_RACE.test(content),
      usesTimeout: PATTERNS.TIMEOUT_PATTERN.test(content),
      createsPool: PATTERNS.POOL_CREATION.test(content),
      needsCleanup: false,
      issues: [],
    };
    
    // Determine if file needs cleanup
    if (findings.hasWrapperImport) {
      findings.issues.push('Imports getDbConnection from database.js');
    }
    
    if (findings.usesWrapper) {
      findings.issues.push('Uses getDbConnection() to get a database connection');
    }
    
    if (findings.usesSqliteMethods) {
      findings.issues.push('Uses SQLite-style methods (db.all, db.get, etc.)');
    }
    
    if (findings.usesDbClose) {
      findings.issues.push('Uses db.close() to release connections');
    }
    
    if (findings.usesPromiseRace) {
      findings.issues.push('Uses Promise.race() for timeout handling');
    }
    
    if (findings.usesTimeout) {
      findings.issues.push('Uses setTimeout for wrapper timeout');
    }
    
    if (findings.createsPool) {
      findings.issues.push('Creates a new Pool instance (should use shared pool)');
    }
    
    findings.needsCleanup = findings.issues.length > 0;
    
    return findings;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return {
      path: filePath,
      filename: path.basename(filePath),
      error: error.message,
      needsCleanup: false,
      issues: ['Error reading file'],
    };
  }
}

/**
 * Recursively scan a directory for JS files
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} Array of file paths
 */
async function scanDirectory(dir) {
  const entries = await readdir(dir);
  const files = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      const subDirFiles = await scanDirectory(fullPath);
      files.push(...subDirFiles);
    } else if (stats.isFile() && entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Scanning for SQLite wrapper references...');
    
    // Check if the services directory exists
    try {
      await stat(SERVICES_DIR);
    } catch (error) {
      // If running from a different directory, try to adjust the path
      if (error.code === 'ENOENT') {
        const altPath = path.join(process.cwd(), 'backend', 'services');
        try {
          await stat(altPath);
          console.log(`Services directory not found at ${SERVICES_DIR}`);
          console.log(`Using alternative path: ${altPath}`);
          SERVICES_DIR = altPath;
        } catch (innerError) {
          console.error('Services directory not found. Make sure you run this script from the project root.');
          process.exit(1);
        }
      } else {
        throw error;
      }
    }
    
    // Scan for JS files
    const files = await scanDirectory(SERVICES_DIR);
    console.log(`Found ${files.length} JavaScript files to check.`);
    
    // Check each file
    const results = await Promise.all(files.map(checkFile));
    
    // Filter files that need cleanup
    const filesToClean = results.filter(result => result.needsCleanup);
    
    console.log('\n=== SQLite Wrapper Reference Report ===');
    console.log(`${filesToClean.length} of ${files.length} files need cleanup.\n`);
    
    // Display files that need cleanup
    if (filesToClean.length > 0) {
      console.log('Files that need cleanup:');
      filesToClean.forEach((file, index) => {
        console.log(`\n${index + 1}. ${file.filename}`);
        console.log(`   Path: ${file.path}`);
        console.log('   Issues:');
        file.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      });
      
      console.log('\nRecommended cleanup steps:');
      console.log('1. Replace "const { getDbConnection } = require(\'../database\')" with "const { pool } = require(\'../database\')"');
      console.log('2. Remove any direct Pool creation (new Pool(...))');
      console.log('3. Replace wrapper pattern with direct pool.query calls:');
      console.log('   FROM:');
      console.log('   ```');
      console.log('   const db = await getDbConnection();');
      console.log('   return new Promise((resolve, reject) => {');
      console.log('     db.all("SELECT * FROM table", [], (err, result) => {');
      console.log('       if (err) return reject(err);');
      console.log('       resolve(result);');
      console.log('     });');
      console.log('   });');
      console.log('   ```');
      console.log('   TO:');
      console.log('   ```');
      console.log('   const result = await pool.query("SELECT * FROM table");');
      console.log('   return result.rows;');
      console.log('   ```');
    } else {
      console.log('All files are clean! No SQLite wrapper references found.');
    }
    
  } catch (error) {
    console.error('Error scanning files:', error);
    process.exit(1);
  }
}

// Run the script
main();
