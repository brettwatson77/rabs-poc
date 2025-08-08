#!/usr/bin/env node
/**
 * Excel File Finder Utility
 * 
 * This script searches for Excel files and uploaded files in common locations.
 * It helps identify files that can be used with the data import script.
 * 
 * Usage:
 *   node find-excel-files.js [options]
 * 
 * Options:
 *   --dir <path>      Directory to start search (default: current directory)
 *   --keywords <list> Comma-separated list of keywords to search for (default: staff,participant,uploaded_file)
 *   --extensions <list> Comma-separated list of file extensions (default: xlsx,xls,csv,txt)
 *   --max-depth <n>   Maximum directory depth to search (default: 5)
 *   --preview         Show file content preview (default: true)
 *   --preview-lines <n> Number of lines to preview for text files (default: 5)
 *   --preview-cells <n> Number of cells to preview for Excel files (default: 10)
 *   --help            Show help
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const XLSX = require('xlsx');

// Configure command line options
program
  .option('--dir <path>', 'Directory to start search', process.cwd())
  .option('--keywords <list>', 'Comma-separated list of keywords to search for', 'staff,participant,uploaded_file')
  .option('--extensions <list>', 'Comma-separated list of file extensions', 'xlsx,xls,csv,txt')
  .option('--max-depth <n>', 'Maximum directory depth to search', 5)
  .option('--preview', 'Show file content preview', true)
  .option('--preview-lines <n>', 'Number of lines to preview for text files', 5)
  .option('--preview-cells <n>', 'Number of cells to preview for Excel files', 10)
  .option('--no-preview', 'Disable file content preview')
  .option('--show-all', 'Show all matching files, not just those with keywords', false)
  .parse(process.argv);

const options = program.opts();

// Console colors for better logging
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

/**
 * Logger utility for consistent output formatting
 */
const logger = {
  info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  warning: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  error: (message) => console.error(`${colors.red}[ERROR]${colors.reset} ${message}`),
  header: (message) => console.log(`\n${colors.bold}${colors.cyan}=== ${message} ===${colors.reset}`),
  divider: () => console.log(`${colors.yellow}${'-'.repeat(80)}${colors.reset}`),
  fileInfo: (message) => console.log(`${colors.green}→ ${colors.reset}${message}`),
  highlight: (text) => `${colors.yellow}${text}${colors.reset}`
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date in human-readable format
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDate(date) {
  return date.toLocaleString();
}

/**
 * Check if a file matches the search criteria
 * @param {string} filePath - Path to the file
 * @returns {boolean} True if file matches criteria
 */
function isMatchingFile(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  const extension = path.extname(filePath).toLowerCase().substring(1);
  
  // Check if extension matches
  const extensions = options.extensions.toLowerCase().split(',');
  if (!extensions.includes(extension)) return false;
  
  // If show-all is enabled, return true for any matching extension
  if (options.showAll) return true;
  
  // Check if filename contains any of the keywords
  const keywords = options.keywords.toLowerCase().split(',');
  return keywords.some(keyword => fileName.includes(keyword.trim()));
}

/**
 * Get file metadata
 * @param {string} filePath - Path to the file
 * @returns {Object} File metadata
 */
function getFileMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).substring(1),
      size: stats.size,
      formattedSize: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      formattedModified: formatDate(stats.mtime)
    };
  } catch (error) {
    logger.error(`Error getting metadata for ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Preview text file content
 * @param {string} filePath - Path to the file
 * @returns {string} File content preview
 */
function previewTextFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const preview = lines.slice(0, options.previewLines).join('\n');
    
    if (lines.length > options.previewLines) {
      return preview + `\n... (${lines.length - options.previewLines} more lines)`;
    }
    
    return preview;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Preview Excel file content
 * @param {string} filePath - Path to the file
 * @returns {string} File content preview
 */
function previewExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Get sheet names
    const sheetNames = workbook.SheetNames;
    
    // Format preview
    let preview = `Sheets: ${sheetNames.join(', ')}\n`;
    preview += `Current Sheet: ${sheetName}\n`;
    preview += `Rows: ${data.length}\n`;
    
    if (data.length > 0) {
      preview += `Columns: ${data[0].length}\n\n`;
      
      // Show header row if available
      if (data.length > 0) {
        preview += `Headers: ${data[0].join(', ')}\n\n`;
      }
      
      // Show data preview
      const previewRows = Math.min(options.previewCells, data.length);
      for (let i = 0; i < previewRows; i++) {
        const rowNum = i === 0 ? 'Header' : `Row ${i}`;
        preview += `${rowNum}: ${data[i].slice(0, 5).join(', ')}`;
        if (data[i].length > 5) {
          preview += `, ... (${data[i].length - 5} more columns)`;
        }
        preview += '\n';
      }
      
      if (data.length > previewRows) {
        preview += `... (${data.length - previewRows} more rows)`;
      }
    }
    
    return preview;
  } catch (error) {
    return `Error reading Excel file: ${error.message}`;
  }
}

/**
 * Preview CSV file content
 * @param {string} filePath - Path to the file
 * @returns {string} File content preview
 */
function previewCsvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const preview = lines.slice(0, options.previewLines).join('\n');
    
    if (lines.length > options.previewLines) {
      return preview + `\n... (${lines.length - options.previewLines} more lines)`;
    }
    
    return preview;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Get file content preview based on file type
 * @param {Object} file - File metadata
 * @returns {string} File content preview
 */
function getFilePreview(file) {
  if (!options.preview) return '';
  
  const extension = file.extension.toLowerCase();
  
  switch (extension) {
    case 'xlsx':
    case 'xls':
      return previewExcelFile(file.path);
    case 'csv':
      return previewCsvFile(file.path);
    case 'txt':
      return previewTextFile(file.path);
    default:
      return 'Preview not available for this file type';
  }
}

/**
 * Search for files in a directory recursively
 * @param {string} dir - Directory to search
 * @param {number} depth - Current search depth
 * @returns {Array} Array of matching files
 */
function findFiles(dir, depth = 0) {
  if (depth > options.maxDepth) return [];
  
  let results = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and .git directories
        if (item === 'node_modules' || item === '.git') continue;
        
        // Recursively search subdirectories
        results = results.concat(findFiles(itemPath, depth + 1));
      } else if (stats.isFile() && isMatchingFile(itemPath)) {
        // Add matching file to results
        const metadata = getFileMetadata(itemPath);
        if (metadata) results.push(metadata);
      }
    }
  } catch (error) {
    logger.warning(`Error reading directory ${dir}: ${error.message}`);
  }
  
  return results;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Excel File Finder Utility${colors.reset}

This script searches for Excel files and uploaded files in common locations.
It helps identify files that can be used with the data import script.

${colors.yellow}Usage:${colors.reset}
  node find-excel-files.js [options]

${colors.yellow}Options:${colors.reset}
  --dir <path>        Directory to start search (default: current directory)
  --keywords <list>   Comma-separated list of keywords to search for (default: staff,participant,uploaded_file)
  --extensions <list> Comma-separated list of file extensions (default: xlsx,xls,csv,txt)
  --max-depth <n>     Maximum directory depth to search (default: 5)
  --preview           Show file content preview (default: true)
  --no-preview        Disable file content preview
  --preview-lines <n> Number of lines to preview for text files (default: 5)
  --preview-cells <n> Number of cells to preview for Excel files (default: 10)
  --show-all          Show all matching files, not just those with keywords
  --help              Show this help message
  `);
}

/**
 * Display file information
 * @param {Object} file - File metadata
 * @param {number} index - File index
 */
function displayFileInfo(file, index) {
  logger.divider();
  logger.fileInfo(`${index}. ${colors.bold}${file.name}${colors.reset}`);
  logger.fileInfo(`Path: ${file.path}`);
  logger.fileInfo(`Size: ${file.formattedSize}`);
  logger.fileInfo(`Modified: ${file.formattedModified}`);
  
  if (options.preview) {
    logger.header('File Preview');
    console.log(getFilePreview(file));
  }
}

/**
 * Group files by type (staff, participant, other)
 * @param {Array} files - Array of file metadata
 * @returns {Object} Grouped files
 */
function groupFilesByType(files) {
  const groups = {
    staff: [],
    participant: [],
    uploaded: [],
    other: []
  };
  
  for (const file of files) {
    const name = file.name.toLowerCase();
    
    if (name.includes('staff')) {
      groups.staff.push(file);
    } else if (name.includes('participant')) {
      groups.participant.push(file);
    } else if (name.includes('uploaded_file')) {
      groups.uploaded.push(file);
    } else {
      groups.other.push(file);
    }
  }
  
  return groups;
}

/**
 * Display import command examples
 * @param {Object} groups - Grouped files
 */
function displayImportCommands(groups) {
  logger.header('Import Command Examples');
  
  let staffFile = null;
  let participantFile = null;
  
  // Try to find the best staff and participant files
  if (groups.staff.length > 0) {
    staffFile = groups.staff[0];
  }
  
  if (groups.participant.length > 0) {
    participantFile = groups.participant[0];
  }
  
  if (staffFile && participantFile) {
    console.log(`
${colors.green}To import both staff and participants:${colors.reset}
node scripts/import-excel-data.js --staff "${staffFile.path}" --participants "${participantFile.path}" --dry-run

${colors.green}To import only staff:${colors.reset}
node scripts/import-excel-data.js --staff "${staffFile.path}" --dry-run

${colors.green}To import only participants:${colors.reset}
node scripts/import-excel-data.js --participants "${participantFile.path}" --dry-run

${colors.yellow}Add --update flag to update existing records${colors.reset}
${colors.yellow}Remove --dry-run flag to actually import the data${colors.reset}
`);
  } else {
    console.log(`
${colors.yellow}Not enough files found to generate import commands.${colors.reset}
Please specify the staff and participant files manually:

node scripts/import-excel-data.js --staff "path/to/staff/file" --participants "path/to/participants/file" --dry-run
`);
  }
}

/**
 * Main function to run the search
 */
async function main() {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  try {
    logger.info(`Searching for files in ${options.dir}`);
    logger.info(`Extensions: ${options.extensions}`);
    logger.info(`Keywords: ${options.keywords}`);
    
    const startTime = Date.now();
    const files = findFiles(options.dir);
    const endTime = Date.now();
    
    if (files.length === 0) {
      logger.warning('No matching files found.');
      logger.info(`Try using --show-all to see all files with matching extensions.`);
      process.exit(0);
    }
    
    logger.success(`Found ${files.length} matching files in ${(endTime - startTime) / 1000} seconds.`);
    
    // Group files by type
    const groups = groupFilesByType(files);
    
    // Display staff files
    if (groups.staff.length > 0) {
      logger.header(`Staff Files (${groups.staff.length})`);
      groups.staff.forEach((file, index) => {
        displayFileInfo(file, index + 1);
      });
    }
    
    // Display participant files
    if (groups.participant.length > 0) {
      logger.header(`Participant Files (${groups.participant.length})`);
      groups.participant.forEach((file, index) => {
        displayFileInfo(file, index + 1);
      });
    }
    
    // Display uploaded files
    if (groups.uploaded.length > 0) {
      logger.header(`Uploaded Files (${groups.uploaded.length})`);
      groups.uploaded.forEach((file, index) => {
        displayFileInfo(file, index + 1);
      });
    }
    
    // Display other files
    if (groups.other.length > 0) {
      logger.header(`Other Matching Files (${groups.other.length})`);
      groups.other.forEach((file, index) => {
        displayFileInfo(file, index + 1);
      });
    }
    
    // Display import command examples
    displayImportCommands(groups);
    
  } catch (error) {
    logger.error(`Search failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
