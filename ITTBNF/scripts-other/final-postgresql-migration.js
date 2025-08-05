#!/usr/bin/env node
/**
 * final-postgresql-migration.js
 * 
 * This script performs a comprehensive migration from SQLite to PostgreSQL
 * by scanning all backend services and converting SQLite patterns to their
 * PostgreSQL equivalents.
 * 
 * It handles:
 * - Converting db.run(), db.get(), db.all() to pool.query()
 * - Changing parameter placeholders from ? to $1, $2, etc.
 * - Converting transaction handling
 * - Updating error handling patterns
 * - Changing connection management
 * 
 * Usage:
 *   node final-postgresql-migration.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const { execSync } = require('child_process');

// Promisify fs functions
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);
const stat = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

// Define directories
const BACKEND_DIR = path.join(__dirname, 'backend');
const SERVICES_DIR = path.join(BACKEND_DIR, 'services');
const CONTROLLERS_DIR = path.join(BACKEND_DIR, 'controllers');
const DATABASE_DIR = path.join(__dirname, 'database');
const BACKUP_DIR = path.join(__dirname, 'sqlite_backup_' + new Date().toISOString().replace(/:/g, '-'));

// Patterns to identify SQLite code
const PATTERNS = {
  IMPORT_WRAPPER: /getDbConnection.*?require\(['"]\.\.\/database['"]\)/,
  WRAPPER_USAGE: /getDbConnection\(\)/,
  SQLITE_METHODS: /db\.(all|get|run|each)/g,
  DB_CLOSE: /db\.close\(\)/g,
  PROMISE_RACE: /Promise\.race\(/g,
  TIMEOUT_PATTERN: /setTimeout\(.*?['"](?:wrapper|database).*?timeout['"]/i,
  TRANSACTION_BEGIN: /db\.run\(['"]BEGIN TRANSACTION['"]/,
  TRANSACTION_COMMIT: /db\.run\(['"]COMMIT['"]/,
  TRANSACTION_ROLLBACK: /db\.run\(['"]ROLLBACK['"]/,
  SQLITE_REQUIRE: /sqlite3.*?require\(['"]sqlite3['"]\)/,
};

// Track all changes for summary
const changes = {
  scannedFiles: 0,
  modifiedFiles: [],
  errors: [],
  conversionStats: {
    dbRunToQuery: 0,
    dbGetToQuery: 0,
    dbAllToQuery: 0,
    questionMarksToPositional: 0,
    transactionsConverted: 0,
  }
};

/**
 * Create backup directory and copy files before modification
 */
async function createBackups(filesToBackup) {
  try {
    // Create backup directory if it doesn't exist
    await mkdir(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
    
    // Copy each file to backup
    for (const filePath of filesToBackup) {
      const backupPath = path.join(BACKUP_DIR, path.basename(filePath));
      await copyFile(filePath, backupPath);
      console.log(`Backed up: ${path.basename(filePath)}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating backups:', error);
    return false;
  }
}

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
 * Check if a file contains SQLite patterns
 */
async function checkFileForSQLite(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    changes.scannedFiles++;
    
    return {
      path: filePath,
      filename: path.basename(filePath),
      hasWrapperImport: PATTERNS.IMPORT_WRAPPER.test(content),
      usesWrapper: PATTERNS.WRAPPER_USAGE.test(content),
      usesSqliteMethods: PATTERNS.SQLITE_METHODS.test(content),
      usesDbClose: PATTERNS.DB_CLOSE.test(content),
      usesPromiseRace: PATTERNS.PROMISE_RACE.test(content),
      usesTimeout: PATTERNS.TIMEOUT_PATTERN.test(content),
      usesTransactions: PATTERNS.TRANSACTION_BEGIN.test(content) || 
                        PATTERNS.TRANSACTION_COMMIT.test(content) || 
                        PATTERNS.TRANSACTION_ROLLBACK.test(content),
      usesSqliteRequire: PATTERNS.SQLITE_REQUIRE.test(content),
      content,
      needsConversion: false
    };
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error);
    changes.errors.push({ file: filePath, error: error.message });
    return null;
  }
}

/**
 * Replace ? placeholders with $1, $2, etc.
 */
function convertPlaceholders(sql) {
  let paramCount = 0;
  return sql.replace(/\?/g, () => {
    paramCount++;
    changes.conversionStats.questionMarksToPositional++;
    return `$${paramCount}`;
  });
}

/**
 * Convert db.run() to pool.query()
 */
function convertDbRun(content) {
  let modified = content;
  
  // Handle db.run with callbacks
  modified = modified.replace(
    /db\.run\((['"`].*?['"`])\s*,\s*\[(.*?)\]\s*,\s*\(?(?:function)?\s*\(\s*err\s*(?:,\s*result)?\s*\)\s*(?:=>)?\s*{([\s\S]*?)}\)/g,
    (match, sql, params, callback) => {
      changes.conversionStats.dbRunToQuery++;
      const convertedSql = convertPlaceholders(sql);
      
      // Handle different callback patterns
      if (callback.includes('reject(err)') && callback.includes('resolve()')) {
        return `await pool.query(${convertedSql}, [${params}])`;
      } else {
        return `await pool.query(${convertedSql}, [${params}]);\n${callback.trim()}`;
      }
    }
  );
  
  // Handle simpler db.run cases
  modified = modified.replace(
    /db\.run\((['"`].*?['"`])\s*(?:,\s*\[(.*?)\])?\s*\)/g,
    (match, sql, params) => {
      changes.conversionStats.dbRunToQuery++;
      const convertedSql = convertPlaceholders(sql);
      return params 
        ? `await pool.query(${convertedSql}, [${params}])`
        : `await pool.query(${convertedSql})`;
    }
  );
  
  return modified;
}

/**
 * Convert db.get() to pool.query() with result.rows[0]
 */
function convertDbGet(content) {
  let modified = content;
  
  // Handle db.get with callbacks
  modified = modified.replace(
    /db\.get\((['"`].*?['"`])\s*,\s*\[(.*?)\]\s*,\s*\(?(?:function)?\s*\(\s*err\s*,\s*row\s*\)\s*(?:=>)?\s*{([\s\S]*?)}\)/g,
    (match, sql, params, callback) => {
      changes.conversionStats.dbGetToQuery++;
      const convertedSql = convertPlaceholders(sql);
      
      // Handle different callback patterns
      if (callback.includes('reject(err)') && callback.includes('resolve(row)')) {
        return `const result = await pool.query(${convertedSql}, [${params}]);\nconst row = result.rows[0];`;
      } else {
        return `const result = await pool.query(${convertedSql}, [${params}]);\nconst row = result.rows[0];\n${callback.trim()}`;
      }
    }
  );
  
  // Handle simpler db.get cases
  modified = modified.replace(
    /const\s+(\w+)\s+=\s+await\s+new\s+Promise.*?db\.get\((['"`].*?['"`])\s*,\s*\[(.*?)\]\s*,.*?resolve\(row\)/g,
    (match, varName, sql, params) => {
      changes.conversionStats.dbGetToQuery++;
      const convertedSql = convertPlaceholders(sql);
      return `const result = await pool.query(${convertedSql}, [${params}]);\nconst ${varName} = result.rows[0]`;
    }
  );
  
  return modified;
}

/**
 * Convert db.all() to pool.query() with result.rows
 */
function convertDbAll(content) {
  let modified = content;
  
  // Handle db.all with callbacks
  modified = modified.replace(
    /db\.all\((['"`].*?['"`])\s*,\s*\[(.*?)\]\s*,\s*\(?(?:function)?\s*\(\s*err\s*,\s*rows\s*\)\s*(?:=>)?\s*{([\s\S]*?)}\)/g,
    (match, sql, params, callback) => {
      changes.conversionStats.dbAllToQuery++;
      const convertedSql = convertPlaceholders(sql);
      
      // Handle different callback patterns
      if (callback.includes('reject(err)') && callback.includes('resolve(rows)')) {
        return `const result = await pool.query(${convertedSql}, [${params}]);\nconst rows = result.rows;`;
      } else {
        return `const result = await pool.query(${convertedSql}, [${params}]);\nconst rows = result.rows;\n${callback.trim()}`;
      }
    }
  );
  
  // Handle simpler db.all cases
  modified = modified.replace(
    /const\s+(\w+)\s+=\s+await\s+new\s+Promise.*?db\.all\((['"`].*?['"`])\s*,\s*\[(.*?)\]\s*,.*?resolve\(rows\)/g,
    (match, varName, sql, params) => {
      changes.conversionStats.dbAllToQuery++;
      const convertedSql = convertPlaceholders(sql);
      return `const result = await pool.query(${convertedSql}, [${params}]);\nconst ${varName} = result.rows`;
    }
  );
  
  return modified;
}

/**
 * Convert SQLite transactions to PostgreSQL transactions
 */
function convertTransactions(content) {
  let modified = content;
  
  // Replace BEGIN TRANSACTION
  modified = modified.replace(
    /db\.run\(['"`]BEGIN TRANSACTION['"`].*?(?:=>)?\s*{/g,
    () => {
      changes.conversionStats.transactionsConverted++;
      return `await pool.query('BEGIN');`;
    }
  );
  
  // Replace COMMIT
  modified = modified.replace(
    /db\.run\(['"`]COMMIT['"`].*?(?:=>)?\s*{/g,
    () => {
      return `await pool.query('COMMIT');`;
    }
  );
  
  // Replace ROLLBACK
  modified = modified.replace(
    /db\.run\(['"`]ROLLBACK['"`].*?(?:=>)?\s*{/g,
    () => {
      return `await pool.query('ROLLBACK');`;
    }
  );
  
  return modified;
}

/**
 * Update imports and connection management
 */
function updateImportsAndConnections(content) {
  let modified = content;
  
  // Replace getDbConnection import with pool import
  modified = modified.replace(
    /const\s*{\s*getDbConnection\s*}\s*=\s*require\(['"]\.\.\/database['"]\);/g,
    `const { pool } = require('../database');`
  );
  
  // Replace getDbConnection() usage
  modified = modified.replace(
    /(?:const|let)\s+db\s*=\s*await\s+getDbConnection\(\);/g,
    ``
  );
  
  // Remove db.close()
  modified = modified.replace(/db\.close\(\);/g, '');
  
  return modified;
}

/**
 * Convert SQLite code to PostgreSQL
 */
async function convertFile(fileInfo) {
  try {
    let modified = fileInfo.content;
    
    // Skip if no SQLite patterns found
    if (!fileInfo.usesWrapper && !fileInfo.usesSqliteMethods && !fileInfo.usesTransactions) {
      return { converted: false, content: modified };
    }
    
    // Convert SQLite patterns to PostgreSQL
    modified = updateImportsAndConnections(modified);
    modified = convertDbRun(modified);
    modified = convertDbGet(modified);
    modified = convertDbAll(modified);
    modified = convertTransactions(modified);
    
    // Check if file was actually modified
    const wasModified = modified !== fileInfo.content;
    
    return {
      converted: wasModified,
      content: modified
    };
  } catch (error) {
    console.error(`Error converting file ${fileInfo.path}:`, error);
    changes.errors.push({ file: fileInfo.path, error: error.message });
    return { converted: false, content: fileInfo.content };
  }
}

/**
 * Update seed.js to use PostgreSQL
 */
async function updateSeedJs() {
  try {
    const seedPath = path.join(DATABASE_DIR, 'seed.js');
    const content = await readFile(seedPath, 'utf8');
    
    // Create backup
    await copyFile(seedPath, path.join(BACKUP_DIR, 'seed.js'));
    
    let modified = content;
    
    // Replace SQLite3 require with pg
    modified = modified.replace(
      /const\s+sqlite3\s*=\s*require\(['"]sqlite3['"]\)\.verbose\(\);/,
      `const { Pool } = require('pg');`
    );
    
    // Replace SQLite database initialization
    modified = modified.replace(
      /const\s+DB_PATH\s*=\s*path\.join\(DATA_DIR,\s*['"]rabs-poc\.db['"]\);/,
      ``
    );
    
    // Add PostgreSQL configuration
    modified = modified.replace(
      /let\s+db;.*?\/\/ will be assigned in runSeed\(\)/s,
      `// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'rabspocdb',
};

// Create PostgreSQL connection pool
const pool = new Pool(pgConfig);`
    );
    
    // Replace SQLite database operations with PostgreSQL
    modified = modified.replace(
      /db\s*=\s*new\s+sqlite3\.Database\(DB_PATH\);/g,
      ``
    );
    
    // Replace db.run with pool.query
    modified = modified.replace(
      /db\.run\((['"`].*?['"`])\s*(?:,\s*\[(.*?)\])?\s*(?:,\s*(?:function)?\s*\(\s*err\s*\)\s*{([\s\S]*?)}\s*)?/g,
      (match, sql, params, callback) => {
        const convertedSql = convertPlaceholders(sql);
        if (params) {
          return `await pool.query(${convertedSql}, [${params}])`;
        } else {
          return `await pool.query(${convertedSql})`;
        }
      }
    );
    
    // Replace db.get with pool.query
    modified = modified.replace(
      /db\.get\((['"`].*?['"`])\s*(?:,\s*\[(.*?)\])?\s*,\s*(?:function)?\s*\(\s*err\s*,\s*row\s*\)\s*{([\s\S]*?)}\s*/g,
      (match, sql, params, callback) => {
        const convertedSql = convertPlaceholders(sql);
        if (params) {
          return `const result = await pool.query(${convertedSql}, [${params}]);\nconst row = result.rows[0];\n`;
        } else {
          return `const result = await pool.query(${convertedSql});\nconst row = result.rows[0];\n`;
        }
      }
    );
    
    // Replace db.all with pool.query
    modified = modified.replace(
      /db\.all\((['"`].*?['"`])\s*(?:,\s*\[(.*?)\])?\s*,\s*(?:function)?\s*\(\s*err\s*,\s*rows\s*\)\s*{([\s\S]*?)}\s*/g,
      (match, sql, params, callback) => {
        const convertedSql = convertPlaceholders(sql);
        if (params) {
          return `const result = await pool.query(${convertedSql}, [${params}]);\nconst rows = result.rows;\n`;
        } else {
          return `const result = await pool.query(${convertedSql});\nconst rows = result.rows;\n`;
        }
      }
    );
    
    // Replace db.close
    modified = modified.replace(/db\.close\(\);/g, `await pool.end();`);
    
    // Write updated content
    await writeFile(seedPath, modified, 'utf8');
    
    console.log('Updated seed.js to use PostgreSQL');
    changes.modifiedFiles.push({ file: seedPath, type: 'seed.js' });
    
    return true;
  } catch (error) {
    console.error('Error updating seed.js:', error);
    changes.errors.push({ file: 'database/seed.js', error: error.message });
    return false;
  }
}

/**
 * Update package.json to remove SQLite dependency
 */
async function updatePackageJson() {
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const content = await readFile(packagePath, 'utf8');
    
    // Create backup
    await copyFile(packagePath, path.join(BACKUP_DIR, 'package.json'));
    
    // Parse package.json
    const packageJson = JSON.parse(content);
    
    // Remove SQLite dependency if it exists
    if (packageJson.dependencies && packageJson.dependencies.sqlite3) {
      delete packageJson.dependencies.sqlite3;
      console.log('Removed sqlite3 dependency from package.json');
      
      // Write updated package.json
      await writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
      changes.modifiedFiles.push({ file: packagePath, type: 'package.json' });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating package.json:', error);
    changes.errors.push({ file: 'package.json', error: error.message });
    return false;
  }
}

/**
 * Validate the conversion by checking for remaining SQLite patterns
 */
async function validateConversion(filePath, content) {
  try {
    // Check for remaining SQLite patterns
    const hasRemainingPatterns = 
      PATTERNS.SQLITE_METHODS.test(content) ||
      PATTERNS.DB_CLOSE.test(content) ||
      PATTERNS.TRANSACTION_BEGIN.test(content) ||
      PATTERNS.TRANSACTION_COMMIT.test(content) ||
      PATTERNS.TRANSACTION_ROLLBACK.test(content);
    
    if (hasRemainingPatterns) {
      console.warn(`Warning: File ${filePath} may still contain SQLite patterns after conversion`);
      return {
        valid: false,
        issues: ['Remaining SQLite patterns detected']
      };
    }
    
    return {
      valid: true,
      issues: []
    };
  } catch (error) {
    console.error(`Error validating conversion for ${filePath}:`, error);
    return {
      valid: false,
      issues: [error.message]
    };
  }
}

/**
 * Generate a summary of all changes made
 */
function generateSummary() {
  console.log('\n===== MIGRATION SUMMARY =====');
  console.log(`Total files scanned: ${changes.scannedFiles}`);
  console.log(`Total files modified: ${changes.modifiedFiles.length}`);
  console.log(`Total errors encountered: ${changes.errors.length}`);
  
  console.log('\nConversion statistics:');
  console.log(`- db.run() to pool.query(): ${changes.conversionStats.dbRunToQuery}`);
  console.log(`- db.get() to pool.query(): ${changes.conversionStats.dbGetToQuery}`);
  console.log(`- db.all() to pool.query(): ${changes.conversionStats.dbAllToQuery}`);
  console.log(`- ? placeholders to $N: ${changes.conversionStats.questionMarksToPositional}`);
  console.log(`- Transactions converted: ${changes.conversionStats.transactionsConverted}`);
  
  if (changes.errors.length > 0) {
    console.log('\nErrors encountered:');
    changes.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.file}: ${error.error}`);
    });
  }
  
  console.log('\nModified files:');
  changes.modifiedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.file}`);
  });
  
  console.log('\nBackups created in:', BACKUP_DIR);
  
  // Write summary to file
  const summaryPath = path.join(__dirname, 'postgresql-migration-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(changes, null, 2), 'utf8');
  console.log(`Summary written to: ${summaryPath}`);
}

/**
 * Main migration function
 */
async function migrateToPostgreSQL() {
  try {
    console.log('Starting comprehensive SQLite to PostgreSQL migration...');
    
    // Scan backend directories for files
    console.log('Scanning files...');
    const serviceFiles = await scanDirectory(SERVICES_DIR);
    const controllerFiles = await scanDirectory(CONTROLLERS_DIR);
    const allFiles = [...serviceFiles, ...controllerFiles];
    
    console.log(`Found ${allFiles.length} files to check`);
    
    // Check each file for SQLite patterns
    const fileInfos = [];
    for (const filePath of allFiles) {
      const fileInfo = await checkFileForSQLite(filePath);
      if (fileInfo && (fileInfo.usesWrapper || fileInfo.usesSqliteMethods || fileInfo.usesTransactions)) {
        fileInfo.needsConversion = true;
        fileInfos.push(fileInfo);
      }
    }
    
    const filesToConvert = fileInfos.filter(info => info.needsConversion);
    console.log(`Found ${filesToConvert.length} files that need conversion`);
    
    if (filesToConvert.length === 0) {
      console.log('No files need conversion. Migration complete!');
      return;
    }
    
    // Create backups before modifying files
    console.log('Creating backups...');
    const backupSuccess = await createBackups([
      ...filesToConvert.map(info => info.path),
      path.join(DATABASE_DIR, 'seed.js'),
      path.join(__dirname, 'package.json')
    ]);
    
    if (!backupSuccess) {
      console.error('Failed to create backups. Aborting migration.');
      return;
    }
    
    // Convert each file
    console.log('Converting files...');
    for (const fileInfo of filesToConvert) {
      const { converted, content } = await convertFile(fileInfo);
      
      if (converted) {
        // Validate conversion
        const validation = await validateConversion(fileInfo.path, content);
        
        if (validation.valid) {
          // Write converted content back to file
          await writeFile(fileInfo.path, content, 'utf8');
          console.log(`Converted: ${fileInfo.filename}`);
          changes.modifiedFiles.push({ file: fileInfo.path, type: 'service' });
        } else {
          console.warn(`Validation failed for ${fileInfo.filename}: ${validation.issues.join(', ')}`);
          changes.errors.push({ file: fileInfo.path, error: `Validation failed: ${validation.issues.join(', ')}` });
        }
      }
    }
    
    // Update seed.js
    console.log('Updating seed.js...');
    await updateSeedJs();
    
    // Update package.json
    console.log('Updating package.json...');
    await updatePackageJson();
    
    // Generate summary
    generateSummary();
    
    console.log('\nMigration complete! Please review the changes and run tests to ensure everything works correctly.');
    console.log('You may need to run `npm install` to update dependencies.');
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateToPostgreSQL();
