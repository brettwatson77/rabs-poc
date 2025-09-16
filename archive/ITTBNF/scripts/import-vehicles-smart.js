#!/usr/bin/env node
/**
 * Smart Vehicle Import Script for RABS POC
 * 
 * This script imports vehicle data from a CSV file into the database,
 * using AI-powered address parsing for location fields.
 * 
 * Usage:
 *   node import-vehicles-smart.js --csv path/to/vehicles.csv [options]
 * 
 * Options:
 *   --csv <path>        Path to vehicles CSV file
 *   --dry-run           Preview import without writing to database
 *   --update            Update existing records instead of skipping
 *   --verbose           Show detailed logging
 *   --help              Show help
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { program } = require('commander');
const { pool } = require('../backend/database');
const addressParser = require('./ai-address-parser');

// Configure command line options
program
  .option('--csv <path>', 'Path to vehicles CSV file')
  .option('--dry-run', 'Preview import without writing to database', false)
  .option('--update', 'Update existing records instead of skipping', false)
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

// List of known vehicle manufacturers for make/model parsing
const knownManufacturers = [
  'Toyota', 'Renault', 'Hyundai', 'LDV', 'Honda', 'Mazda', 'Nissan', 'Ford',
  'Holden', 'Kia', 'Mitsubishi', 'Subaru', 'Volkswagen', 'Mercedes', 'BMW'
];

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
  
  return defaultValue;
}

/**
 * Parse make and model from a combined field
 * @param {string} makeModel - Combined make and model string
 * @returns {Object} Object with make and model properties
 */
function parseMakeModel(makeModel) {
  if (!makeModel) {
    return { make: null, model: null };
  }
  
  // Clean and normalize the input
  const cleaned = makeModel.trim();
  
  // Try to find a known manufacturer at the start of the string
  for (const manufacturer of knownManufacturers) {
    if (cleaned.toLowerCase().startsWith(manufacturer.toLowerCase())) {
      const make = manufacturer;
      // Extract model by removing the make
      const model = cleaned.substring(make.length).trim();
      return { make, model };
    }
  }
  
  // If no known manufacturer found, use the first word as make and the rest as model
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { make: parts[0], model: null };
  }
  
  return {
    make: parts[0],
    model: parts.slice(1).join(' ')
  };
}

/**
 * Parse date string to ISO format
 * @param {string} dateString - Date string in various formats
 * @returns {string|null} ISO date string or null if invalid
 */
function parseDate(dateString) {
  if (!dateString) {
    return null;
  }
  
  try {
    // Try to parse the date
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Return ISO date string (YYYY-MM-DD)
    return date.toISOString().split('T')[0];
  } catch (error) {
    logger.debug(`Error parsing date: ${dateString} - ${error.message}`);
    return null;
  }
}

/**
 * Parse wheelchair accessibility from WC column
 * @param {string} wcValue - Value from WC column
 * @returns {boolean} Whether the vehicle is wheelchair accessible
 */
function parseWheelchairAccessible(wcValue) {
  if (!wcValue) {
    return false;
  }
  
  // Check for indicators of wheelchair accessibility
  const value = wcValue.toString().trim().toLowerCase();
  return value === 'x' || value === 'yes' || value === 'true' || value === '1';
}

/**
 * Parse numeric value ensuring it's a valid number
 * @param {string|number} value - Value to parse
 * @returns {number|null} Parsed number or null if invalid
 */
function parseNumeric(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  // Remove non-numeric characters (except decimal point)
  const cleaned = value.toString().replace(/[^\d.]/g, '');
  
  if (cleaned === '') {
    return null;
  }
  
  // Parse as float
  const num = parseFloat(cleaned);
  
  // Check if valid number
  if (isNaN(num)) {
    return null;
  }
  
  return num;
}

/**
 * Process location field using AI address parser
 * @param {string} location - Location string from CSV
 * @returns {Promise<Object>} Parsed address components
 */
async function processLocation(location) {
  if (!location) {
    return {
      location: null,
      suburb: null,
      state: 'NSW',
      postcode: null
    };
  }
  
  try {
    // Parse address using AI
    const parsedAddress = await addressParser.parseAddress(location, { verbose: options.verbose });
    
    // Return structured location data
    return {
      location: location, // Keep original location string
      suburb: parsedAddress.suburb,
      state: parsedAddress.state || 'NSW',
      postcode: parsedAddress.postcode
    };
  } catch (error) {
    logger.warning(`Error parsing location "${location}": ${error.message}`);
    return {
      location: location,
      suburb: null,
      state: 'NSW',
      postcode: null
    };
  }
}

/**
 * Collect all unique locations from CSV data for batch processing
 * @param {Array} vehicleData - Vehicle CSV data
 * @returns {Array} Array of unique locations
 */
function collectUniqueLocations(vehicleData = []) {
  logger.info('Collecting unique locations for batch processing...');
  
  const uniqueLocations = new Set();
  let locationCount = 0;
  
  // Process vehicle locations
  for (const row of vehicleData) {
    const location = getRowValue(row, ['Location'], '');
    if (location && location.trim()) {
      uniqueLocations.add(location.trim());
      locationCount++;
    }
  }
  
  logger.success(`Found ${uniqueLocations.size} unique locations from ${locationCount} total records`);
  return Array.from(uniqueLocations);
}

/**
 * Process all locations in batch using AI parser
 * @param {Array} locations - Array of locations to parse
 * @returns {Object} Map of original location to parsed components
 */
async function processLocationsBatch(locations) {
  if (!locations || locations.length === 0) {
    return new Map();
  }
  
  logger.info(`Processing ${locations.length} unique locations with AI parser...`);
  
  try {
    // Process locations in batch
    const parsedLocations = await addressParser.parseAddressBatch(
      locations,
      { verbose: options.verbose }
    );
    
    // Create a map of original location to parsed components
    const locationMap = new Map();
    locations.forEach((location, index) => {
      locationMap.set(location, {
        location: location,
        suburb: parsedLocations[index].suburb,
        state: parsedLocations[index].state || 'NSW',
        postcode: parsedLocations[index].postcode
      });
    });
    
    logger.success(`Successfully processed ${locations.length} locations`);
    return locationMap;
  } catch (error) {
    logger.error(`Error processing locations: ${error.message}`);
    
    // Create fallback map with original locations
    const locationMap = new Map();
    locations.forEach(location => {
      locationMap.set(location, {
        location: location,
        suburb: null,
        state: 'NSW',
        postcode: null
      });
    });
    
    return locationMap;
  }
}

/**
 * Map vehicle CSV row to database fields
 * @param {Object} row - CSV row data
 * @param {Map} locationMap - Map of locations to parsed components
 * @returns {Object} Mapped vehicle data
 */
function mapVehicleData(row, locationMap) {
  // Debug: Show the raw row data
  if (options.verbose) {
    logger.debug(`Processing vehicle row: ${JSON.stringify(row, null, 2)}`);
  }
  
  // Get values with fallbacks for different column names
  const name = getRowValue(row, ['Name'], '');
  const makeModelCombined = getRowValue(row, ['MAKE & MODEL'], '');
  const yearOfMake = getRowValue(row, ['YEAR OF MAKE'], null);
  const allocation = getRowValue(row, ['Allocation'], null);
  const vinNumber = getRowValue(row, ['VIN NUMBER'], null);
  const engineNumber = getRowValue(row, ['ENGINE NUMBER'], null);
  const regoDue = getRowValue(row, ['Rego Due'], null);
  const location = getRowValue(row, ['Location'], null);
  const seatCapacity = getRowValue(row, ['SEAT CAPACITY'], null);
  const fuel = getRowValue(row, ['FUEL'], null);
  const maxHeight = getRowValue(row, ['MAX HEIGHT'], null);
  const wc = getRowValue(row, ['WC'], null);
  
  // Parse make and model
  const { make, model } = parseMakeModel(makeModelCombined);
  
  // Get parsed location from map
  let locationData = {
    location: location,
    suburb: null,
    state: 'NSW',
    postcode: null
  };
  
  if (location && locationMap.has(location.trim())) {
    locationData = locationMap.get(location.trim());
  }
  
  // Parse numeric values
  const capacity = parseNumeric(seatCapacity);
  const year = yearOfMake ? parseInt(yearOfMake, 10) : null;
  const height = parseNumeric(maxHeight);
  
  // Parse wheelchair accessibility
  const wheelchairAccessible = parseWheelchairAccessible(wc);
  
  // Parse registration due date
  const registrationExpiry = parseDate(regoDue);
  
  return {
    name: name,
    description: `${make || ''} ${model || ''}`.trim() || null,
    make: make,
    model: model,
    year: year,  // Changed from year_of_make to match schema
    capacity: capacity || 0,  // Changed from seats to match schema
    vin_number: vinNumber,
    engine_number: engineNumber,
    registration: name, // Using name as registration since it often contains the rego number
    registration_expiry: registrationExpiry,  // Changed from regoDueDate to match schema
    fuel_type: fuel,
    location: locationData.location,
    suburb: locationData.suburb,
    state: locationData.state,
    postcode: locationData.postcode,
    max_height: height,
    wheelchair_capacity: wheelchairAccessible ? 1 : 0,
    wheelchair_accessible: wheelchairAccessible,
    notes: allocation || null,
    active: true,
    status: 'active'
  };
}

/**
 * Validate vehicle data before import
 * @param {Object} vehicleData - Vehicle data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
function validateVehicleData(vehicleData) {
  const errors = [];
  
  // Required fields
  if (!vehicleData.name) errors.push('Name is required');
  if (!vehicleData.capacity && vehicleData.capacity !== 0) errors.push('Seat capacity is required');
  
  // Format validations
  if (vehicleData.year && (vehicleData.year < 1900 || vehicleData.year > 2100)) {
    errors.push('Year must be between 1900 and 2100');
  }
  
  if (vehicleData.registration_expiry) {
    const expiryDate = new Date(vehicleData.registration_expiry);
    if (isNaN(expiryDate.getTime())) {
      errors.push('Registration expiry date is invalid');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get all vehicles from the database
 * @returns {Promise<Array>} Array of vehicle objects
 */
async function getAllVehiclesFromDatabase() {
  try {
    const { rows } = await pool.query('SELECT * FROM vehicles');
    logger.info(`Found ${rows.length} vehicles in database`);
    return rows;
  } catch (error) {
    logger.error(`Error fetching vehicles from database: ${error.message}`);
    throw error;
  }
}

/**
 * Find vehicle in database by name or registration
 * @param {Object} vehicleData - Vehicle data
 * @param {Array} existingVehicles - List of existing vehicles
 * @returns {Object|null} Matching vehicle or null
 */
function findExistingVehicle(vehicleData, existingVehicles) {
  // Try to match by name (exact match)
  const nameMatch = existingVehicles.find(v => 
    v.name && v.name.toLowerCase() === vehicleData.name.toLowerCase()
  );
  
  if (nameMatch) {
    return nameMatch;
  }
  
  // Try to match by registration if different from name
  if (vehicleData.registration && vehicleData.registration !== vehicleData.name) {
    const registrationMatch = existingVehicles.find(v => 
      v.registration && v.registration.toLowerCase() === vehicleData.registration.toLowerCase()
    );
    
    if (registrationMatch) {
      return registrationMatch;
    }
  }
  
  return null;
}

/**
 * Create a new vehicle in the database
 * @param {Object} vehicleData - Vehicle data
 * @returns {Promise<Object>} Created vehicle
 */
async function createVehicle(vehicleData) {
  try {
    const query = `
      INSERT INTO vehicles (
        name, make, model, year, capacity, 
        vin_number, engine_number, registration, registration_expiry,
        fuel_type, location, max_height, wheelchair_capacity, 
        wheelchair_accessible, notes, active, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `;
    
    const values = [
      vehicleData.name,
      vehicleData.make,
      vehicleData.model,
      vehicleData.year,
      vehicleData.capacity,
      vehicleData.vin_number,
      vehicleData.engine_number,
      vehicleData.registration,
      vehicleData.registration_expiry,
      vehicleData.fuel_type,
      vehicleData.location,
      vehicleData.max_height,
      vehicleData.wheelchair_capacity,
      vehicleData.wheelchair_accessible,
      vehicleData.notes,
      vehicleData.active,
      vehicleData.status
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error creating vehicle: ${error.message}`);
    throw error;
  }
}

/**
 * Update an existing vehicle in the database
 * @param {string} id - Vehicle ID
 * @param {Object} vehicleData - Vehicle data
 * @returns {Promise<Object>} Updated vehicle
 */
async function updateVehicle(id, vehicleData) {
  try {
    const query = `
      UPDATE vehicles SET
        make = $1,
        model = $2,
        year = $3,
        capacity = $4,
        vin_number = $5,
        engine_number = $6,
        registration = $7,
        registration_expiry = $8,
        fuel_type = $9,
        location = $10,
        max_height = $11,
        wheelchair_capacity = $12,
        wheelchair_accessible = $13,
        notes = $14,
        active = $15,
        status = $16,
        updated_at = NOW()
      WHERE id = $17
      RETURNING *
    `;
    
    const values = [
      vehicleData.make,
      vehicleData.model,
      vehicleData.year,
      vehicleData.capacity,
      vehicleData.vin_number,
      vehicleData.engine_number,
      vehicleData.registration,
      vehicleData.registration_expiry,
      vehicleData.fuel_type,
      vehicleData.location,
      vehicleData.max_height,
      vehicleData.wheelchair_capacity,
      vehicleData.wheelchair_accessible,
      vehicleData.notes,
      vehicleData.active,
      vehicleData.status,
      id
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error(`Error updating vehicle: ${error.message}`);
    throw error;
  }
}

/**
 * Import vehicles from CSV data
 * @param {string} filePath - Path to vehicles CSV file
 * @returns {Promise<Object>} Import results
 */
async function importVehicles(filePath) {
  try {
    // Read CSV file
    const csvData = await readCsvFile(filePath);
    logger.info(`Processing ${csvData.length} vehicle records`);
    
    // Filter out empty rows
    const filteredData = csvData.filter(row => {
      const nameValue = getRowValue(row, ['Name'], null);
      const hasName = nameValue && nameValue.trim() !== '';
      
      if (!hasName && options.verbose) {
        logger.debug(`Filtering out row without Name: ${JSON.stringify(row)}`);
      }
      
      return hasName;
    });
    
    logger.debug(`After filtering: ${filteredData.length} vehicle records remain`);
    
    // Collect unique locations for batch processing
    const uniqueLocations = collectUniqueLocations(filteredData);
    
    // Process all locations in batch
    const locationMap = await processLocationsBatch(uniqueLocations);
    
    // Get existing vehicles for duplicate detection
    const existingVehicles = await getAllVehiclesFromDatabase();
    logger.debug(`Found ${existingVehicles.length} existing vehicles in database`);
    
    // Results tracking
    const results = {
      total: filteredData.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
      updated: 0,
      created: 0,
      errors: []
    };
    
    // Preview table for dry run
    const preview = [];
    
    // Process each row
    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2; // +2 because CSV is 1-based and we skip header row
      
      try {
        // Map CSV columns to database fields
        const vehicleData = mapVehicleData(row, locationMap);
        
        // Validate data
        const validation = validateVehicleData(vehicleData);
        if (!validation.isValid) {
          results.invalid++;
          results.errors.push({
            row: rowNum,
            name: vehicleData.name || `Row ${rowNum}`,
            errors: validation.errors
          });
          logger.warning(`Row ${rowNum}: Invalid vehicle data - ${validation.errors.join(', ')}`);
          continue;
        }
        
        results.valid++;
        
        // Check for duplicates
        const existingVehicle = findExistingVehicle(vehicleData, existingVehicles);
        
        if (options.dryRun) {
          // Add to preview table
          preview.push({
            row: rowNum,
            name: vehicleData.name,
            action: existingVehicle 
              ? (options.update ? 'UPDATE' : 'SKIP') 
              : 'CREATE',
            make: vehicleData.make || 'N/A',
            model: vehicleData.model || 'N/A',
            year: vehicleData.year || 'N/A',
            capacity: vehicleData.capacity || 'N/A',
            fuel: vehicleData.fuel_type || 'N/A',
            wheelchair: vehicleData.wheelchair_accessible ? 'Yes' : 'No'
          });
          continue;
        }
        
        if (existingVehicle) {
          if (options.update) {
            // Update existing vehicle
            await updateVehicle(existingVehicle.id, vehicleData);
            results.updated++;
            logger.success(`Updated vehicle: ${vehicleData.name}`);
          } else {
            // Skip duplicate
            results.skipped++;
            logger.warning(`Skipped duplicate vehicle: ${vehicleData.name}`);
          }
        } else {
          // Create new vehicle
          const newVehicle = await createVehicle(vehicleData);
          results.created++;
          logger.success(`Created vehicle: ${vehicleData.name}`);
          
          // Add to existing list for future duplicate checks
          existingVehicles.push(newVehicle);
        }
      } catch (error) {
        results.invalid++;
        results.errors.push({
          row: rowNum,
          name: getRowValue(row, ['Name'], `Row ${rowNum}`),
          errors: [error.message]
        });
        logger.error(`Error processing row ${rowNum}: ${error.message}`);
      }
      
      // Show progress
      logger.progress(i + 1, filteredData.length, 'Vehicles');
    }
    
    if (options.dryRun && preview.length > 0) {
      logger.dryRun('Vehicle Import Preview:');
      logger.table(preview);
    }
    
    // Save address cache for future runs
    addressParser.saveAddressCache();
    
    return results;
  } catch (error) {
    logger.error(`Failed to import vehicles: ${error.message}`);
    throw error;
  }
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Smart Vehicle Import Script for RABS POC${colors.reset}

This script imports vehicle data from a CSV file into the database,
using AI-powered address parsing for location fields.

${colors.yellow}Usage:${colors.reset}
  node import-vehicles-smart.js --csv path/to/vehicles.csv [options]

${colors.yellow}Options:${colors.reset}
  --csv <path>        Path to vehicles CSV file
  --dry-run           Preview import without writing to database
  --update            Update existing records instead of skipping
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
  
  try {
    // Import vehicles
    const results = await importVehicles(options.csv);
    
    // Show summary
    logger.info('\n===== Import Summary =====');
    logger.info(`Total records: ${results.total}`);
    logger.info(`Valid records: ${results.valid}`);
    logger.info(`Invalid records: ${results.invalid}`);
    
    if (!options.dryRun) {
      logger.info(`Created: ${results.created}`);
      logger.info(`Updated: ${results.updated}`);
      logger.info(`Skipped: ${results.skipped}`);
    }
    
    if (results.errors.length > 0) {
      logger.warning('\nImport Errors:');
      for (const error of results.errors) {
        logger.warning(`Row ${error.row} (${error.name}): ${error.errors.join(', ')}`);
      }
    }
    
    if (options.dryRun) {
      logger.dryRun('\nThis was a dry run. No data was written to the database.');
      logger.dryRun('Run without --dry-run to perform the actual import.');
    }
    
  } catch (error) {
    logger.error(`Import failed: ${error.message}`);
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
