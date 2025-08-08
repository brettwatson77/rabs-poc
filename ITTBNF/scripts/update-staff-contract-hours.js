#!/usr/bin/env node
/**
 * Update Staff Financial Data Script
 * 
 * This script updates existing staff records with contract hours and pay rates from a CSV file.
 * It matches staff by name and updates their contracted_hours and base_pay_rate fields in the database.
 * 
 * Usage:
 *   node update-staff-contract-hours.js --csv path/to/staff.csv [options]
 * 
 * Options:
 *   --csv <path>        Path to staff CSV file
 *   --dry-run           Preview updates without writing to database
 *   --fuzzy             Enable fuzzy name matching for non-exact matches
 *   --verbose           Show detailed logging
 *   --help              Show help
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { program } = require('commander');
const { pool } = require('../backend/database');

// Configure command line options
program
  .option('--csv <path>', 'Path to staff CSV file')
  .option('--dry-run', 'Preview updates without writing to database', false)
  .option('--fuzzy', 'Enable fuzzy name matching for non-exact matches', false)
  .option('--verbose', 'Show detailed logging', false)
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
  dryRun: (message) => console.log(`${colors.magenta}[DRY RUN]${colors.reset} ${message}`),
  debug: (message) => {
    if (options.verbose) {
      console.log(`${colors.cyan}[DEBUG]${colors.reset} ${message}`);
    }
  },
  table: (data) => console.table(data),
  progress: (current, total, label = 'Progress') => {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    process.stdout.write(`\r${colors.blue}[${label}]${colors.reset} ${progressBar} ${percentage}% (${current}/${total})`);
    if (current === total) {
      process.stdout.write('\n');
    }
  }
};

/**
 * Read a CSV file and return the data as an array of objects
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} Array of objects representing each row
 */
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        logger.success(`Successfully read ${results.length} rows from ${path.basename(filePath)}`);
        
        // Debug: Show the first row and available fields
        if (options.verbose && results.length > 0) {
          logger.debug(`CSV Headers: ${Object.keys(results[0]).join(', ')}`);
          logger.debug(`First row sample: ${JSON.stringify(results[0], null, 2)}`);
        }
        
        resolve(results);
      })
      .on('error', (error) => {
        reject(new Error(`Error reading CSV file: ${error.message}`));
      });
  });
}

/**
 * Get value from row with fallback for different column naming patterns
 * @param {Object} row - CSV row data
 * @param {Array} possibleKeys - Possible keys to check
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Found value or default
 */
function getRowValue(row, possibleKeys, defaultValue = null) {
  // First check for exact matches
  for (const key of possibleKeys) {
    if (row[key] !== undefined) {
      return row[key];
    }
  }
  
  // Then check for case-insensitive matches
  const rowKeys = Object.keys(row);
  for (const key of possibleKeys) {
    const match = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
    if (match && row[match] !== undefined) {
      return row[match];
    }
  }
  
  // Check for numeric indices (_0, _1, etc.)
  const numericMap = {
    'Name': '_0',
    'Role': '_1',
    'Employment Type': '_2',
    'Date of Birth': '_3',
    'Email': '_4',
    'Address': '_5',
    'Primary Phone Number': '_6',
    'Emergency Contact Name': '_7',
    'Relationship': '_8',
    'Emergency Contact Number': '_9',
    'Contracted Hrs': '_10',
    'F.C': '_11',
    'Pay Rate': '_12',
    'Contract Expiry': '_13',
  };
  
  for (const key of possibleKeys) {
    if (numericMap[key] && row[numericMap[key]] !== undefined) {
      return row[numericMap[key]];
    }
  }
  
  return defaultValue;
}

/**
 * Parse contract hours from CSV value
 * @param {string} hoursValue - Raw contract hours value from CSV
 * @returns {number|null} Parsed hours as number or null if invalid
 */
function parseContractHours(hoursValue) {
  if (!hoursValue || hoursValue === '') {
    return null;
  }
  
  // Remove non-numeric characters (except decimal point)
  const cleaned = hoursValue.toString().replace(/[^\d.]/g, '');
  
  if (cleaned === '') {
    return null;
  }
  
  // Parse as float
  const hours = parseFloat(cleaned);
  
  // Check if valid number
  if (isNaN(hours)) {
    return null;
  }
  
  return hours;
}

/**
 * Parse pay rate from CSV value
 * @param {string} rateValue - Raw pay rate string (e.g., "$28.55", "30")
 * @returns {number|null} Parsed rate as number or null if invalid
 */
function parsePayRate(rateValue) {
  if (!rateValue || rateValue === '') {
    return null;
  }
  // Remove currency symbols and non-numeric except decimal
  const cleaned = rateValue.toString().replace(/[^\d.]/g, '');
  if (cleaned === '') {
    return null;
  }
  const rate = parseFloat(cleaned);
  return isNaN(rate) ? null : rate;
}

/**
 * Split a full name into first name and last name
 * @param {string} fullName - Full name to split
 * @returns {Object} Object with first_name and last_name properties
 */
function splitName(fullName) {
  if (!fullName) return { first_name: '', last_name: '' };
  
  // Handle special case with (PL), (ML) in the name
  fullName = fullName.replace(/\s*\([^)]*\)\s*/, ' ').trim();
  
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: ''
    };
  }
  
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' ')
  };
}

/**
 * Get all staff from the database
 * @returns {Promise<Array>} Array of staff objects
 */
async function getAllStaffFromDatabase() {
  try {
    const { rows } = await pool.query('SELECT * FROM staff');
    logger.info(`Found ${rows.length} staff records in database`);
    return rows;
  } catch (error) {
    logger.error(`Error fetching staff from database: ${error.message}`);
    throw error;
  }
}

/**
 * Find staff in database by name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {Array} allStaff - Array of all staff records
 * @param {boolean} fuzzyMatch - Whether to allow fuzzy matching
 * @returns {Object|null} Matching staff record or null
 */
function findStaffByName(firstName, lastName, allStaff, fuzzyMatch = false) {
  // Try exact match first
  const exactMatch = allStaff.find(staff => 
    staff.first_name.toLowerCase() === firstName.toLowerCase() && 
    staff.last_name.toLowerCase() === lastName.toLowerCase()
  );
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // If fuzzy matching is enabled, try more flexible matching
  if (fuzzyMatch) {
    // Try matching just by last name if it's unique
    const lastNameMatches = allStaff.filter(staff => 
      staff.last_name.toLowerCase() === lastName.toLowerCase()
    );
    
    if (lastNameMatches.length === 1) {
      logger.debug(`Found fuzzy match by last name for ${firstName} ${lastName}`);
      return lastNameMatches[0];
    }
    
    // Try matching by first name initial + last name
    if (firstName.length > 0) {
      const firstInitial = firstName[0].toLowerCase();
      const initialMatch = allStaff.find(staff => 
        staff.first_name.toLowerCase()[0] === firstInitial && 
        staff.last_name.toLowerCase() === lastName.toLowerCase()
      );
      
      if (initialMatch) {
        logger.debug(`Found fuzzy match by first initial + last name for ${firstName} ${lastName}`);
        return initialMatch;
      }
    }
    
    // Try matching by first name if last name is empty or very short
    if (!lastName || lastName.length <= 2) {
      const firstNameMatch = allStaff.find(staff => 
        staff.first_name.toLowerCase() === firstName.toLowerCase()
      );
      
      if (firstNameMatch) {
        logger.debug(`Found fuzzy match by first name for ${firstName} ${lastName}`);
        return firstNameMatch;
      }
    }
  }
  
  return null;
}

/**
 * Update staff financial data in database
 * @param {string} staffId - Staff ID
 * @param {number} contractedHours - New contracted hours value
 * @param {number} payRate - New base pay rate value
 * @returns {Promise<Object>} Updated staff record
 */
async function updateStaffFinancialData(staffId, contractedHours, payRate) {
  try {
    const { rows } = await pool.query(
      'UPDATE staff SET contracted_hours = $1, base_pay_rate = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [contractedHours, payRate, staffId]
    );
    return rows[0];
  } catch (error) {
    logger.error(`Error updating financial data for staff ${staffId}: ${error.message}`);
    throw error;
  }
}

/**
 * Process CSV data and update staff financial data
 * @param {Array} csvData - CSV data rows
 * @returns {Promise<Object>} Results summary
 */
async function processStaffFinancialData(csvData) {
  // Get all staff from database
  const allStaff = await getAllStaffFromDatabase();
  
  // Results tracking
  const results = {
    total: csvData.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };
  
  // Process each row
  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    const rowNum = i + 2; // +2 because CSV is 1-based and we skip header row
    
    try {
      // Extract name, contract hours, and pay rate
      const fullName = getRowValue(row, ['Name'], '');
      const contractedHrsRaw = getRowValue(row, ['Contracted Hrs', 'Contract Hours'], null);
      const payRateRaw = getRowValue(row, ['Pay Rate', 'Base Rate', 'Hourly Rate'], null);
      
      // Skip if no name
      if (!fullName || fullName.trim() === '') {
        logger.debug(`Skipping row ${rowNum}: No name found`);
        results.skipped++;
        continue;
      }
      
      // Parse contract hours and pay rate
      const contractedHours = parseContractHours(contractedHrsRaw);
      const payRate = parsePayRate(payRateRaw);
      
      // Skip if no valid data to update
      if (contractedHours === null && payRate === null) {
        logger.debug(`Skipping row ${rowNum}: No valid financial data for ${fullName}`);
        results.skipped++;
        continue;
      }
      
      // Split name
      const { first_name, last_name } = splitName(fullName);
      
      // Find matching staff in database
      const matchedStaff = findStaffByName(first_name, last_name, allStaff, options.fuzzy);
      
      if (!matchedStaff) {
        logger.warning(`Row ${rowNum}: No matching staff found for ${fullName}`);
        results.errors++;
        results.details.push({
          row: rowNum,
          name: fullName,
          action: 'NOT_FOUND',
          hours: contractedHours,
          rate: payRate,
          error: 'No matching staff found in database'
        });
        continue;
      }
      
      results.matched++;
      
      // Check if update is needed
      const currentHours = matchedStaff.contracted_hours || 0;
      const currentRate = matchedStaff.base_pay_rate || 0;
      
      const hoursNeedsUpdate = contractedHours !== null && currentHours !== contractedHours;
      const rateNeedsUpdate = payRate !== null && currentRate !== payRate;
      const needsUpdate = hoursNeedsUpdate || rateNeedsUpdate;
      
      // Determine which values to update (use current values if not provided)
      const newHours = contractedHours !== null ? contractedHours : currentHours;
      const newRate = payRate !== null ? payRate : currentRate;
      
      // Add to results
      results.details.push({
        row: rowNum,
        name: fullName,
        action: needsUpdate ? 'UPDATE' : 'SKIP',
        staffId: matchedStaff.id,
        beforeHours: currentHours,
        afterHours: newHours,
        beforeRate: currentRate,
        afterRate: newRate,
        hoursChange: hoursNeedsUpdate ? `${currentHours} → ${newHours}` : 'No change',
        rateChange: rateNeedsUpdate ? `$${currentRate} → $${newRate}` : 'No change'
      });
      
      // Update if needed and not in dry-run mode
      if (needsUpdate && !options.dryRun) {
        await updateStaffFinancialData(matchedStaff.id, newHours, newRate);
        results.updated++;
        
        let updateMsg = `Updated ${fullName}:`;
        if (hoursNeedsUpdate) updateMsg += ` Hours ${currentHours} → ${newHours}`;
        if (rateNeedsUpdate) updateMsg += ` Rate $${currentRate} → $${newRate}`;
        
        logger.success(updateMsg);
      } else if (needsUpdate) {
        // Count as would-be updated in dry-run mode
        results.updated++;
        
        let updateMsg = `Would update ${fullName}:`;
        if (hoursNeedsUpdate) updateMsg += ` Hours ${currentHours} → ${newHours}`;
        if (rateNeedsUpdate) updateMsg += ` Rate $${currentRate} → $${newRate}`;
        
        logger.dryRun(updateMsg);
      } else {
        results.skipped++;
        logger.debug(`No change needed for ${fullName}: Financial data already current`);
      }
    } catch (error) {
      results.errors++;
      logger.error(`Error processing row ${rowNum}: ${error.message}`);
    }
    
    // Show progress
    logger.progress(i + 1, csvData.length, 'Processing');
  }
  
  return results;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Update Staff Financial Data Script${colors.reset}

This script updates existing staff records with contract hours and pay rates from a CSV file.
It matches staff by name and updates their contracted_hours and base_pay_rate fields in the database.

${colors.yellow}Usage:${colors.reset}
  node update-staff-contract-hours.js --csv path/to/staff.csv [options]

${colors.yellow}Options:${colors.reset}
  --csv <path>        Path to staff CSV file
  --dry-run           Preview updates without writing to database
  --fuzzy             Enable fuzzy name matching for non-exact matches
  --verbose           Show detailed logging
  --help              Show help
  `);
}

/**
 * Main function
 */
async function main() {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  if (!options.csv) {
    logger.error('No CSV file specified. Use --csv option.');
    showHelp();
    process.exit(1);
  }
  
  // Log database connection info from environment
  const dbHost = process.env.PGHOST || 'localhost';
  const dbPort = process.env.PGPORT || '5432';
  const dbName = process.env.PGDATABASE || 'rabspocdb';
  console.log(`Using PostgreSQL database: ${dbName} at ${dbHost}:${dbPort}`);
  
  if (options.dryRun) {
    logger.dryRun('Running in dry-run mode. No data will be written to the database.');
  }
  
  if (options.fuzzy) {
    logger.info('Fuzzy name matching enabled for non-exact matches.');
  }
  
  try {
    // Read CSV file
    const csvData = await readCsvFile(options.csv);
    
    // Process data and update financial data
    const results = await processStaffFinancialData(csvData);
    
    // Show summary
    logger.info('\n===== Update Summary =====');
    logger.info(`Total records: ${results.total}`);
    logger.info(`Matched staff: ${results.matched}`);
    logger.info(`Updated records: ${results.updated}`);
    logger.info(`Skipped records: ${results.skipped}`);
    logger.info(`Errors: ${results.errors}`);
    
    // Show details table
    if (results.details.length > 0) {
      logger.info('\nUpdate Details:');
      
      // Filter to show only relevant information
      const displayDetails = results.details.map(detail => ({
        Name: detail.name,
        Action: detail.action,
        'Hours Before': detail.beforeHours,
        'Hours After': detail.afterHours,
        'Hours Change': detail.hoursChange,
        'Rate Before': detail.beforeRate ? `$${detail.beforeRate}` : '-',
        'Rate After': detail.afterRate ? `$${detail.afterRate}` : '-',
        'Rate Change': detail.rateChange
      }));
      
      logger.table(displayDetails);
    }
    
    if (options.dryRun) {
      logger.dryRun('\nThis was a dry run. No data was written to the database.');
      logger.dryRun('Run without --dry-run to apply the updates.');
    }
    
  } catch (error) {
    logger.error(`Script failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
