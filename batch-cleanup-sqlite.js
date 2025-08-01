#!/usr/bin/env node
/**
 * batch-cleanup-sqlite.js
 * 
 * Automatically cleans up SQLite wrapper references in service files
 * and replaces them with direct PostgreSQL pool queries.
 * 
 * This script:
 * 1. Creates backups of all files before modification (.bak extension)
 * 2. Replaces SQLite wrapper imports with pool imports
 * 3. Removes direct Pool creation
 * 4. Converts SQLite-style queries to PostgreSQL
 * 5. Removes Promise.race timeout patterns
 * 6. Logs all changes
 * 
 * Usage: node batch-cleanup-sqlite.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Promisify fs functions
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const copyFile = util.promisify(fs.copyFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Directory to scan
const SERVICES_DIR = path.join(__dirname, 'backend', 'services');

// Patterns to match
const PATTERNS = {
  // Import patterns
  IMPORT_WRAPPER: /const\s*{\s*getDbConnection\s*}\s*=\s*require\(['"]\.\.\/database['"]\);?/g,
  IMPORT_POOL: /const\s*{\s*Pool\s*}\s*=\s*require\(['"]pg['"]\);?/g,
  
  // Pool creation patterns
  POOL_CREATION: /const\s+pool\s*=\s*new\s+Pool\(\{[\s\S]*?\}\);?/g,
  
  // Wrapper usage patterns
  DB_CONNECTION: /(?:let|const)\s+db\s*=\s*await\s+getDbConnection\(\);?/g,
  DB_ALL: /db\.all\((['"`])(.+?)\1,\s*(\[.*?\]|\[\]),\s*\(\s*(?:err|error),\s*(?:result|results|rows|data)\s*\)\s*=>\s*\{/g,
  DB_GET: /db\.get\((['"`])(.+?)\1,\s*(\[.*?\]|\[\]),\s*\(\s*(?:err|error),\s*(?:result|results|row|data)\s*\)\s*=>\s*\{/g,
  DB_RUN: /db\.run\((['"`])(.+?)\1,\s*(\[.*?\]|\[\]),\s*\(\s*(?:err|error|result)\s*\)\s*=>\s*\{/g,
  DB_CLOSE: /(?:if\s*\(\s*db\s*\)\s*)?db\.close\(\);?/g,
  
  // Promise patterns
  PROMISE_RESOLVE: /resolve\((\w+)\);?/g,
  PROMISE_REJECT: /(?:return\s+)?reject\((?:err|error)\);?/g,
  PROMISE_CREATION: /return\s+(?:await\s+)?new\s+Promise\(\(resolve,\s*reject\)\s*=>\s*\{/g,
  PROMISE_END: /\}\);/g,
  
  // Timeout patterns
  TIMEOUT_PROMISE: /const\s+timeout(?:Promise)?\s*=\s*new\s+Promise\(\(.*?\)\s*=>\s*setTimeout\(.*?(?:wrapper|database).*?timeout.*?\)\);?/g,
  PROMISE_RACE: /(?:return\s+)?(?:await\s+)?Promise\.race\(\[.*?timeout.*?\]\);?/g,
  
  // Finally block
  FINALLY_BLOCK: /finally\s*\{[\s\S]*?if\s*\(\s*db\s*\)\s*db\.close\(\);[\s\S]*?\}/g,
  
  // Try-catch with wrapper and fallback
  TRY_WRAPPER_FALLBACK: /try\s*\{[\s\S]*?getDbConnection\(\)[\s\S]*?\}\s*catch\s*\((?:err|error)\)\s*\{[\s\S]*?pool\.query[\s\S]*?\}/g
};

/**
 * Convert SQLite-style placeholders (?) to PostgreSQL-style placeholders ($1, $2, ...)
 * @param {string} sql - SQL query with ? placeholders
 * @returns {string} SQL query with $1, $2, ... placeholders
 */
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

/**
 * Clean up a service file
 * @param {string} filePath - Path to the service file
 * @returns {Promise<Object>} Object with cleanup results
 */
async function cleanupFile(filePath) {
  console.log(`\nProcessing: ${path.basename(filePath)}`);
  
  // Create backup
  const backupPath = `${filePath}.bak`;
  await copyFile(filePath, backupPath);
  console.log(`  ✓ Created backup: ${path.basename(backupPath)}`);
  
  // Read file content
  let content = await readFile(filePath, 'utf8');
  const originalContent = content;
  
  // Track changes
  const changes = {
    importReplaced: false,
    poolCreationRemoved: false,
    dbConnectionsReplaced: 0,
    dbQueriesReplaced: 0,
    dbCloseRemoved: 0,
    promiseRaceRemoved: 0,
    finallyBlocksRemoved: 0,
    tryWrapperBlocksReplaced: 0
  };
  
  // 1. Replace imports
  if (PATTERNS.IMPORT_WRAPPER.test(content)) {
    content = content.replace(PATTERNS.IMPORT_WRAPPER, "const { pool } = require('../database');");
    changes.importReplaced = true;
    console.log(`  ✓ Replaced getDbConnection import with pool import`);
  }
  
  // 2. Remove Pool import and creation if pool is already imported from database.js
  if (content.includes("const { pool } = require('../database')") && PATTERNS.IMPORT_POOL.test(content)) {
    content = content.replace(PATTERNS.IMPORT_POOL, '');
    console.log(`  ✓ Removed redundant Pool import`);
  }
  
  // 3. Remove pool creation
  if (PATTERNS.POOL_CREATION.test(content)) {
    content = content.replace(PATTERNS.POOL_CREATION, '');
    changes.poolCreationRemoved = true;
    console.log(`  ✓ Removed custom Pool creation`);
  }
  
  // 4. Remove Promise.race and timeout patterns
  if (PATTERNS.TIMEOUT_PROMISE.test(content)) {
    content = content.replace(PATTERNS.TIMEOUT_PROMISE, '');
    changes.promiseRaceRemoved++;
    console.log(`  ✓ Removed timeout promise creation`);
  }
  
  if (PATTERNS.PROMISE_RACE.test(content)) {
    content = content.replace(PATTERNS.PROMISE_RACE, '');
    changes.promiseRaceRemoved++;
    console.log(`  ✓ Removed Promise.race pattern`);
  }
  
  // 5. Remove finally blocks with db.close()
  if (PATTERNS.FINALLY_BLOCK.test(content)) {
    content = content.replace(PATTERNS.FINALLY_BLOCK, '');
    changes.finallyBlocksRemoved++;
    console.log(`  ✓ Removed finally block with db.close()`);
  }
  
  // 6. Replace try-wrapper-fallback pattern with direct pool query
  if (PATTERNS.TRY_WRAPPER_FALLBACK.test(content)) {
    // This is a complex pattern, we'll just log it for now
    changes.tryWrapperBlocksReplaced++;
    console.log(`  ⚠ Found complex try-wrapper-fallback pattern. Manual review recommended.`);
  }
  
  // 7. Replace db.all with pool.query
  let dbAllMatches = [...content.matchAll(PATTERNS.DB_ALL)];
  for (const match of dbAllMatches) {
    const [fullMatch, quoteChar, sql, params] = match;
    
    // Extract the callback body
    const startIdx = match.index + fullMatch.length;
    let depth = 1;
    let endIdx = startIdx;
    
    while (depth > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') depth++;
      if (content[endIdx] === '}') depth--;
      endIdx++;
    }
    
    const callbackBody = content.substring(startIdx, endIdx - 1);
    
    // Extract the resolve statement
    const resolveMatch = callbackBody.match(PATTERNS.PROMISE_RESOLVE);
    const resultVar = resolveMatch ? resolveMatch[0].match(/resolve\((\w+)\)/)[1] : 'result';
    
    // Create the replacement
    const convertedSql = convertPlaceholders(sql);
    const replacement = `const ${resultVar} = await pool.query(${quoteChar}${convertedSql}${quoteChar}, ${params});
    return ${resultVar}.rows;`;
    
    // Replace the entire block
    const blockToReplace = content.substring(match.index, endIdx);
    content = content.replace(blockToReplace, replacement);
    
    changes.dbQueriesReplaced++;
    console.log(`  ✓ Replaced db.all with pool.query`);
  }
  
  // 8. Replace db.get with pool.query for single row
  let dbGetMatches = [...content.matchAll(PATTERNS.DB_GET)];
  for (const match of dbGetMatches) {
    const [fullMatch, quoteChar, sql, params] = match;
    
    // Extract the callback body
    const startIdx = match.index + fullMatch.length;
    let depth = 1;
    let endIdx = startIdx;
    
    while (depth > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') depth++;
      if (content[endIdx] === '}') depth--;
      endIdx++;
    }
    
    const callbackBody = content.substring(startIdx, endIdx - 1);
    
    // Extract the resolve statement
    const resolveMatch = callbackBody.match(PATTERNS.PROMISE_RESOLVE);
    const resultVar = resolveMatch ? resolveMatch[0].match(/resolve\((\w+)\)/)[1] : 'result';
    
    // Create the replacement
    const convertedSql = convertPlaceholders(sql);
    const replacement = `const ${resultVar} = await pool.query(${quoteChar}${convertedSql}${quoteChar}, ${params});
    return ${resultVar}.rows[0];`;
    
    // Replace the entire block
    const blockToReplace = content.substring(match.index, endIdx);
    content = content.replace(blockToReplace, replacement);
    
    changes.dbQueriesReplaced++;
    console.log(`  ✓ Replaced db.get with pool.query`);
  }
  
  // 9. Replace db.run with pool.query for execution only
  let dbRunMatches = [...content.matchAll(PATTERNS.DB_RUN)];
  for (const match of dbRunMatches) {
    const [fullMatch, quoteChar, sql, params] = match;
    
    // Create the replacement
    const convertedSql = convertPlaceholders(sql);
    const replacement = `await pool.query(${quoteChar}${convertedSql}${quoteChar}, ${params});`;
    
    // Replace the match
    content = content.replace(fullMatch, replacement);
    
    changes.dbQueriesReplaced++;
    console.log(`  ✓ Replaced db.run with pool.query`);
  }
  
  // 10. Remove db connection getting
  if (PATTERNS.DB_CONNECTION.test(content)) {
    content = content.replace(PATTERNS.DB_CONNECTION, '');
    changes.dbConnectionsReplaced++;
    console.log(`  ✓ Removed db connection acquisition`);
  }
  
  // 11. Remove db.close calls
  const dbCloseMatches = content.match(PATTERNS.DB_CLOSE) || [];
  if (dbCloseMatches.length > 0) {
    content = content.replace(PATTERNS.DB_CLOSE, '');
    changes.dbCloseRemoved += dbCloseMatches.length;
    console.log(`  ✓ Removed ${dbCloseMatches.length} db.close() calls`);
  }
  
  // Write changes if content was modified
  if (content !== originalContent) {
    await writeFile(filePath, content, 'utf8');
    console.log(`  ✓ Saved changes to ${path.basename(filePath)}`);
    
    // Summary of changes
    console.log('  Changes made:');
    Object.entries(changes).forEach(([key, value]) => {
      if (typeof value === 'boolean' && value) {
        console.log(`    - ${key}: Yes`);
      } else if (typeof value === 'number' && value > 0) {
        console.log(`    - ${key}: ${value}`);
      }
    });
    
    return { filePath, changes, modified: true };
  } else {
    console.log(`  ✗ No changes made to ${path.basename(filePath)}`);
    return { filePath, changes, modified: false };
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
 * Check if a file contains SQLite wrapper references
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file needs cleanup
 */
async function needsCleanup(filePath) {
  const content = await readFile(filePath, 'utf8');
  
  return (
    PATTERNS.IMPORT_WRAPPER.test(content) ||
    PATTERNS.DB_CONNECTION.test(content) ||
    PATTERNS.DB_ALL.test(content) ||
    PATTERNS.DB_GET.test(content) ||
    PATTERNS.DB_RUN.test(content) ||
    PATTERNS.DB_CLOSE.test(content) ||
    PATTERNS.PROMISE_RACE.test(content) ||
    PATTERNS.TIMEOUT_PROMISE.test(content) ||
    (PATTERNS.POOL_CREATION.test(content) && content.includes("const { pool } = require('../database')"))
  );
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('SQLite Wrapper Cleanup Script');
    console.log('============================');
    
    // Check if the services directory exists
    let servicesDir = SERVICES_DIR;
    try {
      await stat(servicesDir);
    } catch (error) {
      // If running from a different directory, try to adjust the path
      if (error.code === 'ENOENT') {
        const altPath = path.join(process.cwd(), 'backend', 'services');
        try {
          await stat(altPath);
          console.log(`Services directory not found at ${servicesDir}`);
          console.log(`Using alternative path: ${altPath}`);
          servicesDir = altPath;
        } catch (innerError) {
          console.error('Services directory not found. Make sure you run this script from the project root.');
          process.exit(1);
        }
      } else {
        throw error;
      }
    }
    
    // Scan for JS files
    const files = await scanDirectory(servicesDir);
    console.log(`Found ${files.length} JavaScript files to check.`);
    
    // Filter files that need cleanup
    const filesToClean = [];
    for (const file of files) {
      if (await needsCleanup(file)) {
        filesToClean.push(file);
      }
    }
    
    console.log(`\n${filesToClean.length} of ${files.length} files need cleanup.`);
    
    // Process each file
    const results = [];
    for (const file of filesToClean) {
      const result = await cleanupFile(file);
      results.push(result);
    }
    
    // Final summary
    const modifiedCount = results.filter(r => r.modified).length;
    console.log('\n============================');
    console.log(`Cleanup complete! ${modifiedCount} of ${filesToClean.length} files were modified.`);
    console.log('Files that were modified:');
    results.filter(r => r.modified).forEach(result => {
      console.log(`- ${path.basename(result.filePath)}`);
    });
    
    if (modifiedCount < filesToClean.length) {
      console.log('\nFiles that could not be automatically cleaned (manual review needed):');
      results.filter(r => !r.modified).forEach(result => {
        console.log(`- ${path.basename(result.filePath)}`);
      });
    }
    
    console.log('\nBackups were created with .bak extension for all processed files.');
    console.log('If everything works correctly, you can delete the .bak files.');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the script
main();
