#!/usr/bin/env node

/**
 * precommit-guard.js
 * 
 * This script checks for suspicious file changes that might indicate truncation.
 * It's designed to run as a pre-commit hook to prevent committing truncated files.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Repository root (one level up from the scripts directory)
const repoRoot = path.resolve(__dirname, '..');

// Configuration
const SUSPICIOUS_THRESHOLD = {
  DELETED_LINES: 200,
  ADDED_LINES: 50,
  MAX_LINE_COUNT: 1000
};

// Paths to monitor
const MONITORED_PATHS = [
  'frontend/src/pages/**/*.jsx',
  'frontend/src/pages/**/*.js',
  'frontend/src/components/**/*.jsx',
  'frontend/src/components/**/*.js',
  'backend/**/*.js'
];

/**
 * Safely execute a git command and return its output
 */
function execGit(command) {
  try {
    // Ensure all git commands execute from the repo root to avoid UNC CWD issues
    return execSync(`git -C "${repoRoot}" ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error executing git command: git -C "${repoRoot}" ${command}`);
    console.error(error.message);
    return '';
  }
}

/**
 * Get list of staged files
 */
function getStagedFiles() {
  return execGit('diff --cached --name-only --diff-filter=ACM')
    .split('\n')
    .filter(Boolean);
}

/**
 * Check if a file matches the monitored paths
 */
function isMonitoredFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Check if file is a JavaScript or JSX file
  if (!normalizedPath.endsWith('.js') && !normalizedPath.endsWith('.jsx')) {
    return false;
  }
  
  // Check if file is in one of the monitored paths
  return MONITORED_PATHS.some(pattern => {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(normalizedPath);
  });
}

/**
 * Get diff stats for a file
 */
function getDiffStats(filePath) {
  const diffOutput = execGit(`diff --cached --numstat -- "${filePath}"`);
  
  if (!diffOutput) {
    return { added: 0, deleted: 0 };
  }
  
  const [added, deleted] = diffOutput.split('\t').map(Number);
  return {
    added: isNaN(added) ? 0 : added,
    deleted: isNaN(deleted) ? 0 : deleted
  };
}

/**
 * Get current line count for the staged version of a file
 */
function getLineCount(filePath) {
  try {
    const fileContent = execGit(`show :${filePath}`);
    return fileContent.split('\n').length;
  } catch (error) {
    console.warn(`Could not get line count for ${filePath}: ${error.message}`);
    return 0;
  }
}

/**
 * Check if file changes look suspicious (possible truncation)
 */
function isSuspicious(stats, lineCount) {
  return (
    stats.deleted > SUSPICIOUS_THRESHOLD.DELETED_LINES && 
    stats.added < SUSPICIOUS_THRESHOLD.ADDED_LINES &&
    lineCount < SUSPICIOUS_THRESHOLD.MAX_LINE_COUNT
  );
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking for possible file truncation...');
  
  const stagedFiles = getStagedFiles();
  const monitoredFiles = stagedFiles.filter(isMonitoredFile);
  
  console.log(`Found ${monitoredFiles.length} staged JavaScript/JSX files to check`);
  
  const suspiciousFiles = [];
  
  for (const file of monitoredFiles) {
    try {
      const stats = getDiffStats(file);
      const lineCount = getLineCount(file);
      
      if (isSuspicious(stats, lineCount)) {
        suspiciousFiles.push({
          file,
          stats,
          lineCount
        });
      }
    } catch (error) {
      console.warn(`Error checking file ${file}: ${error.message}`);
    }
  }
  
  if (suspiciousFiles.length > 0) {
    console.error('\n⚠️  WARNING: Possible file truncation detected! ⚠️\n');
    console.error('The following files show suspicious changes that might indicate truncation:');
    
    suspiciousFiles.forEach(({ file, stats, lineCount }) => {
      console.error(`
File: ${file}
  - ${stats.deleted} lines deleted
  - ${stats.added} lines added
  - Current line count: ${lineCount}
  - This pattern suggests the file might be truncated
`);
    });
    
    console.error(`
To prevent accidental data loss, the commit has been blocked.

If these changes are intentional, you can:
1. Bypass this check with: BYPASS_GUARD=1 git commit
2. Or review the files and make sure no content was accidentally lost

For large files, consider breaking them into smaller components to improve maintainability.
`);
    
    // Exit with error code unless bypassed
    if (process.env.BYPASS_GUARD === '1') {
      console.warn('⚠️  Guard check bypassed via BYPASS_GUARD=1');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } else {
    console.log('✅ No suspicious file changes detected');
    process.exit(0);
  }
}

main();
