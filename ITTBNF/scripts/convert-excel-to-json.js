#!/usr/bin/env node
/**
 * Excel to JSON Converter Utility
 * 
 * This script converts Excel files to JSON format for easier inspection and debugging.
 * It supports both .xlsx files and tab-delimited .txt files.
 * 
 * Usage:
 *   node convert-excel-to-json.js --input path/to/file.xlsx [options]
 *   node convert-excel-to-json.js --input path/to/file.txt [options]
 * 
 * Options:
 *   --input <path>    Path to Excel file (required)
 *   --output <path>   Path to save JSON output (optional)
 *   --limit <number>  Limit number of rows to process (default: 10)
 *   --stats           Show data statistics
 *   --full            Show all rows (overrides --limit)
 *   --help            Show help
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { program } = require('commander');

// Configure command line options
program
  .requiredOption('--input <path>', 'Path to Excel file')
  .option('--output <path>', 'Path to save JSON output')
  .option('--limit <number>', 'Limit number of rows to display', 10)
  .option('--stats', 'Show data statistics', false)
  .option('--full', 'Show all rows (overrides --limit)', false)
  .option('--pretty', 'Pretty print JSON output', false)
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
  white: '\x1b[37m'
};

/**
 * Logger utility for consistent output formatting
 */
const logger = {
  info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  warning: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  error: (message) => console.error(`${colors.red}[ERROR]${colors.reset} ${message}`),
  header: (message) => console.log(`\n${colors.cyan}=== ${message} ===${colors.reset}`),
  table: (data) => console.table(data)
};

/**
 * Determine the data type of a value
 * @param {any} value - The value to check
 * @returns {string} The data type
 */
function getDataType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'float';
  }
  if (typeof value === 'string') {
    // Check if string is a date
    if (!isNaN(Date.parse(value))) {
      return 'date';
    }
    // Check if string is a boolean
    if (['true', 'false', 'yes', 'no', 'y', 'n'].includes(value.toLowerCase())) {
      return 'boolean-string';
    }
    return 'string';
  }
  return typeof value;
}

/**
 * Get a sample value as a string, truncated if needed
 * @param {any} value - The value to format
 * @returns {string} Formatted sample value
 */
function getSampleValue(value) {
  if (value === null || value === undefined) return 'null';
  
  const strValue = String(value);
  if (strValue.length > 30) {
    return strValue.substring(0, 27) + '...';
  }
  return strValue;
}

/**
 * Analyze column data types and statistics
 * @param {Array} data - Array of data objects
 * @returns {Object} Column analysis
 */
function analyzeColumns(data) {
  if (!data || data.length === 0) return {};
  
  const columns = {};
  const firstRow = data[0];
  
  // Initialize column data
  Object.keys(firstRow).forEach(key => {
    columns[key] = {
      name: key,
      types: new Set(),
      nonNullCount: 0,
      totalCount: data.length,
      uniqueValues: new Set(),
      min: null,
      max: null,
      samples: []
    };
  });
  
  // Analyze each row
  data.forEach(row => {
    Object.keys(columns).forEach(key => {
      const value = row[key];
      const type = getDataType(value);
      
      columns[key].types.add(type);
      
      if (value !== null && value !== undefined) {
        columns[key].nonNullCount++;
        columns[key].uniqueValues.add(String(value));
        
        // Track min/max for numeric values
        if (typeof value === 'number') {
          if (columns[key].min === null || value < columns[key].min) {
            columns[key].min = value;
          }
          if (columns[key].max === null || value > columns[key].max) {
            columns[key].max = value;
          }
        }
        
        // Collect sample values (up to 5)
        if (columns[key].samples.length < 5 && !columns[key].samples.includes(getSampleValue(value))) {
          columns[key].samples.push(getSampleValue(value));
        }
      }
    });
  });
  
  // Convert Sets to Arrays for easier display
  Object.keys(columns).forEach(key => {
    columns[key].types = Array.from(columns[key].types);
    columns[key].uniqueCount = columns[key].uniqueValues.size;
    delete columns[key].uniqueValues; // Remove the set to avoid circular references
  });
  
  return columns;
}

/**
 * Read an Excel file and convert to JSON
 * @param {string} filePath - Path to the Excel file
 * @returns {Object} Parsed data and metadata
 */
function convertExcelToJson(filePath) {
  try {
    logger.info(`Reading file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Handle both .xlsx and .txt (converted Excel) files
    let workbook;
    if (filePath.endsWith('.txt')) {
      // For .txt files, assume tab-delimited and parse accordingly
      const fileContent = fs.readFileSync(filePath, 'utf8');
      workbook = XLSX.read(fileContent, { type: 'string', raw: true });
    } else {
      // For .xlsx files, read directly
      workbook = XLSX.readFile(filePath);
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get sheet names
    const sheetNames = workbook.SheetNames;
    
    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    // Get column headers
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    
    // Analyze columns
    const columnAnalysis = analyzeColumns(data);
    
    logger.success(`Successfully read ${data.length} rows from ${path.basename(filePath)}`);
    
    return {
      fileName: path.basename(filePath),
      sheetNames,
      currentSheet: sheetName,
      rowCount: data.length,
      columnCount: headers.length,
      headers,
      columnAnalysis,
      data
    };
  } catch (error) {
    logger.error(`Failed to convert Excel file: ${error.message}`);
    throw error;
  }
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Excel to JSON Converter Utility${colors.reset}

This script converts Excel files to JSON format for easier inspection and debugging.
It supports both .xlsx files and tab-delimited .txt files.

${colors.yellow}Usage:${colors.reset}
  node convert-excel-to-json.js --input path/to/file.xlsx [options]
  node convert-excel-to-json.js --input path/to/file.txt [options]

${colors.yellow}Options:${colors.reset}
  --input <path>    Path to Excel file (required)
  --output <path>   Path to save JSON output (optional)
  --limit <number>  Limit number of rows to display (default: 10)
  --stats           Show data statistics
  --full            Show all rows (overrides --limit)
  --pretty          Pretty print JSON output
  --help            Show this help message
  `);
}

/**
 * Display column statistics
 * @param {Object} columnAnalysis - Column analysis data
 */
function displayColumnStats(columnAnalysis) {
  logger.header('Column Statistics');
  
  const columnStats = Object.values(columnAnalysis).map(col => ({
    Column: col.name,
    Types: col.types.join(', '),
    'Non-Null': `${col.nonNullCount}/${col.totalCount} (${Math.round(col.nonNullCount / col.totalCount * 100)}%)`,
    Unique: col.uniqueCount,
    Samples: col.samples.join(', ')
  }));
  
  logger.table(columnStats);
  
  // Display additional numeric stats where applicable
  const numericColumns = Object.values(columnAnalysis).filter(col => 
    col.types.includes('integer') || col.types.includes('float')
  );
  
  if (numericColumns.length > 0) {
    logger.header('Numeric Column Ranges');
    const numericStats = numericColumns.map(col => ({
      Column: col.name,
      Min: col.min,
      Max: col.max,
      Range: col.max - col.min
    }));
    logger.table(numericStats);
  }
}

/**
 * Main function to run the conversion
 */
async function main() {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  try {
    const result = convertExcelToJson(options.input);
    
    // Display basic info
    logger.header('File Information');
    console.log(`File: ${result.fileName}`);
    console.log(`Sheets: ${result.sheetNames.join(', ')}`);
    console.log(`Current Sheet: ${result.currentSheet}`);
    console.log(`Rows: ${result.rowCount}`);
    console.log(`Columns: ${result.columnCount}`);
    console.log(`Headers: ${result.headers.join(', ')}`);
    
    // Display column statistics if requested
    if (options.stats) {
      displayColumnStats(result.columnAnalysis);
    }
    
    // Display data preview
    logger.header('Data Preview');
    const limit = options.full ? result.data.length : parseInt(options.limit);
    const preview = result.data.slice(0, limit);
    logger.table(preview);
    
    if (!options.full && result.data.length > limit) {
      logger.info(`Showing ${limit} of ${result.data.length} rows. Use --full to see all rows.`);
    }
    
    // Save to file if output path is specified
    if (options.output) {
      const outputData = {
        metadata: {
          fileName: result.fileName,
          sheetNames: result.sheetNames,
          currentSheet: result.currentSheet,
          rowCount: result.rowCount,
          columnCount: result.columnCount,
          headers: result.headers
        },
        data: result.data
      };
      
      const jsonString = options.pretty 
        ? JSON.stringify(outputData, null, 2) 
        : JSON.stringify(outputData);
      
      fs.writeFileSync(options.output, jsonString);
      logger.success(`Output saved to ${options.output}`);
    }
    
  } catch (error) {
    logger.error(`Conversion failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
