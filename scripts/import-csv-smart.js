#!/usr/bin/env node
/**
 * Smart CSV Data Import Script for RABS POC
 * 
 * This script imports staff and participant data from CSV files into the database,
 * using AI-powered address parsing for accurate extraction of address components.
 * 
 * Usage:
 *   node import-csv-smart.js --staff path/to/staff.csv --participants path/to/participants.csv [options]
 * 
 * Options:
 *   --staff <path>        Path to staff CSV file
 *   --participants <path> Path to participants CSV file
 *   --dry-run             Preview import without writing to database
 *   --update              Update existing records instead of skipping
 *   --verbose             Show detailed logging
 *   --help                Show help
 */

const fs = require('fs');
const path = require('path');
// csv-parser exports the parser function directly (default export)
const csv = require('csv-parser');
const { program } = require('commander');
const staffService = require('../backend/services/staffService');
const participantService = require('../backend/services/participantService');
const addressParser = require('./ai-address-parser');

// Configure command line options
program
  .option('--staff <path>', 'Path to staff CSV file')
  .option('--participants <path>', 'Path to participants CSV file')
  .option('--dry-run', 'Preview import without writing to database', false)
  .option('--update', 'Update existing records instead of skipping', false)
  .option('--verbose', 'Show detailed logging', false)
  .parse(process.argv);

const options = program.opts();

// Statistics tracking
const stats = {
  addressesProcessed: 0,
  cacheHits: 0,
  cacheMisses: 0,
  apiCalls: 0,
  parseErrors: 0
};

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
        
        // Debug: Show the first 3 rows and available fields
        if (options.verbose && results.length > 0) {
          logger.debug(`CSV Headers: ${Object.keys(results[0]).join(', ')}`);
          logger.debug(`First row sample: ${JSON.stringify(results[0], null, 2)}`);
          if (results.length > 1) {
            logger.debug(`Second row sample: ${JSON.stringify(results[1], null, 2)}`);
          }
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
  if (possibleKeys.length > 0 && possibleKeys[0] === 'Name' && row['_0'] !== undefined) {
    return row['_0'];
  }
  
  // Check for other common patterns in numeric indices
  const numericMap = {
    // Staff mappings
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
    
    // Participant mappings - FIXED CORRECT MAPPINGS
    'Date of Birth': '_1',
    'Address': '_2',  // Fixed: was incorrectly mapped to _5
    'NDIS #': '_3',
    'Primary Phone Name or Description': '_4',
    'Primary Phone': '_5',
    'Secondary Phone Name or Description': '_6',
    'Secondary Phone': '_7',
    'Primary Email': '_8',
    'Secondary Email': '_9',
    'Plan Management': '_10',
    'Other Supports & Needs': '_11'
  };
  
  for (const key of possibleKeys) {
    if (numericMap[key] && row[numericMap[key]] !== undefined) {
      return row[numericMap[key]];
    }
  }
  
  return defaultValue;
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
 * Clean and format a phone number to standard format
 * @param {string} phone - Phone number to clean
 * @returns {string|null} Cleaned phone number or null if invalid
 */
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove non-numeric characters
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Handle international format
  if (cleaned.startsWith('61')) {
    cleaned = '0' + cleaned.substring(2);
  }
  
  // Validate Australian phone number format
  if (cleaned.length !== 10 || !(cleaned.startsWith('02') || cleaned.startsWith('03') || 
      cleaned.startsWith('04') || cleaned.startsWith('07') || cleaned.startsWith('08'))) {
    return phone; // Return original if not valid Australian format
  }
  
  return cleaned;
}

/**
 * Collect all unique addresses from CSV data for batch processing
 * @param {Array} staffData - Staff CSV data
 * @param {Array} participantData - Participant CSV data
 * @returns {Array} Array of unique addresses
 */
function collectUniqueAddresses(staffData = [], participantData = []) {
  logger.info('Collecting unique addresses for batch processing...');
  
  const uniqueAddresses = new Set();
  let addressCount = 0;
  
  // Process staff addresses
  for (const row of staffData) {
    const address = getRowValue(row, ['Address'], '');
    if (address && address.trim()) {
      uniqueAddresses.add(address.trim());
      addressCount++;
    }
  }
  
  // Process participant addresses
  for (const row of participantData) {
    const address = getRowValue(row, ['Address'], '');
    if (address && address.trim()) {
      uniqueAddresses.add(address.trim());
      addressCount++;
    }
  }
  
  logger.success(`Found ${uniqueAddresses.size} unique addresses from ${addressCount} total records`);
  return Array.from(uniqueAddresses);
}

/**
 * Process all addresses in batch using AI parser
 * @param {Array} addresses - Array of addresses to parse
 * @returns {Object} Map of original address to parsed components
 */
async function processAddressesBatch(addresses) {
  if (!addresses || addresses.length === 0) {
    return new Map();
  }
  
  logger.info(`Processing ${addresses.length} unique addresses with AI parser...`);
  
  // Create a map to store results
  const addressMap = new Map();
  
  try {
    // Process addresses in batches
    const batchSize = 20; // Adjust based on API limits
    const batches = Math.ceil(addresses.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, addresses.length);
      const batchAddresses = addresses.slice(start, end);
      
      logger.debug(`Processing batch ${i + 1}/${batches} (${batchAddresses.length} addresses)`);
      logger.progress(start, addresses.length, 'Address Parsing');
      
      // Process batch with postcode completion enabled
      const parsedAddresses = await addressParser.parseAddressBatch(
        batchAddresses, 
        { 
          verbose: options.verbose,
          completePostcode: true // Enable postcode completion
        }
      );
      
      // Store results in map
      batchAddresses.forEach((address, index) => {
        addressMap.set(address, parsedAddresses[index]);
      });
      
      // Update stats
      stats.apiCalls++;
      stats.addressesProcessed += batchAddresses.length;
      
      // Small delay between batches
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    logger.progress(addresses.length, addresses.length, 'Address Parsing');
    logger.success(`Successfully processed ${addresses.length} addresses`);
    
    return addressMap;
  } catch (error) {
    logger.error(`Error processing addresses: ${error.message}`);
    
    // Create fallback map with original addresses
    addresses.forEach(address => {
      addressMap.set(address, {
        address: address,
        suburb: null,
        state: 'NSW',
        postcode: null
      });
    });
    
    stats.parseErrors += addresses.length;
    return addressMap;
  }
}

/**
 * Convert plan management string to database enum value
 * @param {string} planManagement - Plan management string from CSV
 * @returns {string} Database enum value
 */
function convertPlanManagementType(planManagement) {
  if (!planManagement) return 'agency_managed'; // Default
  
  const normalized = planManagement.toLowerCase().trim();
  
  if (normalized.includes('self')) return 'self_managed';
  if (normalized.includes('plan')) return 'plan_managed';
  if (normalized.includes('ndia')) return 'agency_managed';
  
  return 'agency_managed'; // Default to agency managed
}

/**
 * Detect support needs from text description
 * @param {string} supportText - Support needs text
 * @returns {Object} Object with boolean flags and text descriptions
 */
function detectSupportNeeds(supportText) {
  if (!supportText) {
    return {
      has_wheelchair_access: false,
      has_dietary_requirements: false,
      has_medical_requirements: false,
      has_behavioral_support: false,
      has_visual_impairment: false,
      has_hearing_impairment: false,
      has_cognitive_support: false,
      has_communication_needs: false,
      mobility_needs: null,
      allergies: null,
      medication_needs: null
    };
  }
  
  const normalized = supportText.toLowerCase();
  
  // Initialize result
  const result = {
    has_wheelchair_access: false,
    has_dietary_requirements: false,
    has_medical_requirements: false,
    has_behavioral_support: false,
    has_visual_impairment: false,
    has_hearing_impairment: false,
    has_cognitive_support: false,
    has_communication_needs: false,
    mobility_needs: null,
    allergies: null,
    medication_needs: null
  };
  
  // Detect wheelchair
  if (normalized.includes('wheelchair') || normalized.includes('wheel chair')) {
    result.has_wheelchair_access = true;
    result.mobility_needs = supportText;
  }
  
  // Detect walker
  if (normalized.includes('walker') || normalized.includes('walking frame')) {
    result.mobility_needs = supportText;
  }
  
  // Detect dietary requirements
  if (normalized.includes('allerg') || normalized.includes('diet') || 
      normalized.includes('food') || normalized.includes('nuts')) {
    result.has_dietary_requirements = true;
    result.allergies = supportText;
  }
  
  // Detect medical requirements
  if (normalized.includes('medic') || normalized.includes('cpap') || 
      normalized.includes('epi') || normalized.includes('insulin')) {
    result.has_medical_requirements = true;
    result.medication_needs = supportText;
  }
  
  // Detect visual impairment
  if (normalized.includes('sight') || normalized.includes('visual') || normalized.includes('vision')) {
    result.has_visual_impairment = true;
  }
  
  // Detect hearing impairment
  if (normalized.includes('hearing') || normalized.includes('deaf')) {
    result.has_hearing_impairment = true;
  }
  
  // Detect cognitive support
  if (normalized.includes('cognitive') || normalized.includes('memory') || 
      normalized.includes('intellectual') || normalized.includes('learning')) {
    result.has_cognitive_support = true;
  }
  
  // Detect communication needs
  if (normalized.includes('communicat') || normalized.includes('speech') || 
      normalized.includes('language') || normalized.includes('non-verbal')) {
    result.has_communication_needs = true;
  }
  
  // Detect behavioral support
  if (normalized.includes('behav')) {
    result.has_behavioral_support = true;
  }
  
  return result;
}

/**
 * Map staff CSV row to database fields using AI-parsed address
 * @param {Object} row - CSV row data
 * @param {Map} addressMap - Map of addresses to parsed components
 * @returns {Object} Mapped staff data
 */
function mapStaffData(row, addressMap) {
  // Debug: Show the raw row data
  if (options.verbose) {
    logger.debug(`Processing staff row: ${JSON.stringify(row, null, 2)}`);
  }
  
  // Get values with fallbacks for different column names
  const name = getRowValue(row, ['Name'], '');
  const role = getRowValue(row, ['Role'], '');
  const employmentType = getRowValue(row, ['Employment Type'], '');
  const email = getRowValue(row, ['Email'], null);
  const address = getRowValue(row, ['Address'], '');
  const primaryPhone = getRowValue(row, ['Primary Phone Number'], null);
  // Contracted Hours (fortnightly / weekly etc.)
  const contractedHrsRaw = getRowValue(row, ['Contracted Hrs', 'Contract Hours'], null);
  let contractedHours = null;
  if (contractedHrsRaw !== null && contractedHrsRaw !== '') {
    // Remove non-numeric (just in case "Hours" is appended)
    const hrsNum = contractedHrsRaw.toString().replace(/[^\d.]/g, '');
    if (hrsNum) {
      contractedHours = parseFloat(hrsNum);
      if (Number.isNaN(contractedHours)) {
        contractedHours = null;
      }
    }
  }
  
  // Split name into first and last name
  const nameObj = splitName(name);
  
  // Get parsed address from map
  let addressObj = {
    address: address,
    suburb: null,
    state: 'NSW',
    postcode: null
  };
  
  if (address && addressMap.has(address.trim())) {
    addressObj = addressMap.get(address.trim());
    stats.cacheHits++;
  } else if (address) {
    stats.cacheMisses++;
    logger.debug(`Address not found in map: ${address}`);
  }
  
  // Determine active status based on Employment Type
  const isActive = employmentType !== 'Inactive' && employmentType !== 'Terminated';
  
  // Clean phone number
  const phone = cleanPhoneNumber(primaryPhone);
  
  return {
    first_name: nameObj.first_name,
    last_name: nameObj.last_name,
    address: addressObj.address,
    suburb: addressObj.suburb,
    state: addressObj.state,
    postcode: addressObj.postcode,
    phone: phone,
    email: email,
    position: role,
    active: isActive
  };
}

/**
 * Map participant CSV row to database fields using AI-parsed address
 * @param {Object} row - CSV row data
 * @param {Map} addressMap - Map of addresses to parsed components
 * @returns {Object} Mapped participant data
 */
function mapParticipantData(row, addressMap) {
  // Debug: Show the raw row data
  if (options.verbose) {
    logger.debug(`Processing participant row: ${JSON.stringify(row, null, 2)}`);
  }
  
  // Get values with fallbacks for different column names
  const name = getRowValue(row, ['Name'], '');
  const address = getRowValue(row, ['Address'], '');
  const ndisNumber = getRowValue(row, ['NDIS #'], null);
  const primaryPhone = getRowValue(row, ['Primary Phone'], null);
  const secondaryPhoneName = getRowValue(row, ['Secondary Phone Name or Description'], null);
  const secondaryPhone = getRowValue(row, ['Secondary Phone'], null);
  const primaryEmail = getRowValue(row, ['Primary Email'], null);
  const planManagement = getRowValue(row, ['Plan Management'], null);
  const supportNeeds = getRowValue(row, ['Other Supports & Needs'], null);
  
  // Split name into first and last name
  const nameObj = splitName(name);
  
  // Get parsed address from map
  let addressObj = {
    address: address,
    suburb: null,
    state: 'NSW',
    postcode: null
  };
  
  if (address && addressMap.has(address.trim())) {
    addressObj = addressMap.get(address.trim());
    stats.cacheHits++;
  } else if (address) {
    stats.cacheMisses++;
    logger.debug(`Address not found in map: ${address}`);
  }
  
  // Clean phone number
  const phone = cleanPhoneNumber(primaryPhone);
  
  // Convert plan management type
  const planManagementType = convertPlanManagementType(planManagement);
  
  // Detect support needs
  const supportNeedsObj = detectSupportNeeds(supportNeeds);
  
  // NDIS number (remove non-numeric characters)
  let processedNdisNumber = null;
  if (ndisNumber && ndisNumber !== 'n/a') {
    processedNdisNumber = ndisNumber.toString().replace(/\D/g, '');
  }
  
  return {
    first_name: nameObj.first_name,
    last_name: nameObj.last_name,
    address: addressObj.address,
    suburb: addressObj.suburb,
    state: addressObj.state,
    postcode: addressObj.postcode,
    ndis_number: processedNdisNumber,
    phone: phone,
    email: primaryEmail,
    notes: null,
    supervision_multiplier: 1.0,
    mobility_needs: supportNeedsObj.mobility_needs,
    allergies: supportNeedsObj.allergies,
    medication_needs: supportNeedsObj.medication_needs,
    has_behavior_support_plan: supportNeedsObj.has_behavioral_support,
    has_wheelchair_access: supportNeedsObj.has_wheelchair_access,
    has_dietary_requirements: supportNeedsObj.has_dietary_requirements,
    has_medical_requirements: supportNeedsObj.has_medical_requirements,
    has_behavioral_support: supportNeedsObj.has_behavioral_support,
    has_visual_impairment: supportNeedsObj.has_visual_impairment,
    has_hearing_impairment: supportNeedsObj.has_hearing_impairment,
    has_cognitive_support: supportNeedsObj.has_cognitive_support,
    has_communication_needs: supportNeedsObj.has_communication_needs,
    plan_management_type: planManagementType,
    emergency_contact_name: secondaryPhoneName,
    emergency_contact_phone: cleanPhoneNumber(secondaryPhone)
  };
}

/**
 * Validate staff data before import
 * @param {Object} staffData - Staff data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
function validateStaffData(staffData) {
  const errors = [];
  
  // Required fields
  if (!staffData.first_name) errors.push('First name is required');
  if (!staffData.last_name) errors.push('Last name is required');
  
  // Format validations
  if (staffData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffData.email)) {
    errors.push('Email format is invalid');
  }
  
  if (staffData.postcode && !/^\d{4}$/.test(staffData.postcode.toString())) {
    errors.push('Postcode must be a 4-digit number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate participant data before import
 * @param {Object} participantData - Participant data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
function validateParticipantData(participantData) {
  const errors = [];
  
  // Required fields
  if (!participantData.first_name) errors.push('First name is required');
  if (!participantData.last_name) errors.push('Last name is required');
  
  // Check for required address fields
  if (!participantData.address) errors.push('Address is required');
  if (!participantData.suburb) errors.push('Suburb is required');
  if (!participantData.postcode) errors.push('Postcode is required');
  
  // If any required fields are missing, create a combined error message
  if (errors.length > 0 && errors.some(e => e.includes('required'))) {
    return {
      isValid: false,
      errors: [`Missing required participant data: ${errors.join(', ')}`]
    };
  }
  
  // Format validations
  if (participantData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantData.email)) {
    errors.push('Email format is invalid');
  }
  
  if (participantData.postcode && !/^\d{4}$/.test(participantData.postcode.toString())) {
    errors.push('Postcode must be a 4-digit number');
  }
  
  if (participantData.ndis_number && !/^\d{9}$/.test(participantData.ndis_number.toString())) {
    errors.push('NDIS number must be a 9-digit number');
  }
  
  // Validate plan management type
  const validPlanTypes = ['agency_managed', 'plan_managed', 'self_managed'];
  if (participantData.plan_management_type && !validPlanTypes.includes(participantData.plan_management_type)) {
    errors.push('Invalid plan management type');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if a staff member already exists in the database
 * @param {Object} staff - Staff data
 * @param {Array} existingStaff - List of existing staff
 * @returns {Object|null} Matching staff or null
 */
async function findExistingStaff(staff, existingStaff) {
  return existingStaff.find(s => 
    s.first_name.toLowerCase() === staff.first_name.toLowerCase() &&
    s.last_name.toLowerCase() === staff.last_name.toLowerCase() &&
    (
      // Match at least one additional field
      (staff.phone && s.phone === staff.phone) ||
      (staff.email && s.email === staff.email)
    )
  );
}

/**
 * Check if a participant already exists in the database
 * @param {Object} participant - Participant data
 * @param {Array} existingParticipants - List of existing participants
 * @returns {Object|null} Matching participant or null
 */
async function findExistingParticipant(participant, existingParticipants) {
  // First try to match by NDIS number if available
  if (participant.ndis_number) {
    const match = existingParticipants.find(p => 
      p.ndis_number && p.ndis_number.toString() === participant.ndis_number.toString()
    );
    if (match) return match;
  }
  
  // Then try to match by name and other identifying info
  return existingParticipants.find(p => 
    p.first_name.toLowerCase() === participant.first_name.toLowerCase() &&
    p.last_name.toLowerCase() === participant.last_name.toLowerCase() &&
    (
      // Match at least one additional field
      (participant.phone && p.phone === participant.phone) ||
      (participant.email && p.email === participant.email) ||
      (
        participant.address && 
        p.address === participant.address && 
        p.suburb === participant.suburb && 
        p.postcode && participant.postcode &&
        p.postcode.toString() === participant.postcode.toString()
      )
    )
  );
}

/**
 * Import staff from CSV data
 * @param {string} filePath - Path to staff CSV file
 * @param {Map} addressMap - Map of addresses to parsed components
 * @returns {Promise<Object>} Import results
 */
async function importStaff(filePath, addressMap) {
  try {
    const csvData = await readCsvFile(filePath);
    logger.info(`Processing ${csvData.length} staff records`);
    
    // Get existing staff for duplicate detection
    const existingStaff = await staffService.getAllStaff();
    logger.debug(`Found ${existingStaff.length} existing staff in database`);
    
    const results = {
      total: csvData.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
      updated: 0,
      created: 0,
      errors: []
    };
    
    // Preview table for dry run
    const preview = [];
    
    // Filter out empty rows (sometimes CSVs have trailing empty rows)
    const filteredData = csvData.filter(row => {
      // Check if row has a name value (either in Name field or _0 field)
      const nameValue = getRowValue(row, ['Name'], null);
      const hasName = nameValue && nameValue.trim() !== '';
      
      if (!hasName && options.verbose) {
        logger.debug(`Filtering out row without Name: ${JSON.stringify(row)}`);
      }
      
      return hasName;
    });
    
    logger.debug(`After filtering: ${filteredData.length} staff records remain`);
    
    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2; // +2 because CSV is 1-based and we skip header row
      
      try {
        // Map CSV columns to database fields using AI-parsed address
        const staffData = mapStaffData(row, addressMap);
        
        // Validate data
        const validation = validateStaffData(staffData);
        if (!validation.isValid) {
          results.invalid++;
          results.errors.push({
            row: rowNum,
            name: `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim(),
            errors: validation.errors
          });
          logger.warning(`Row ${rowNum}: Invalid staff data - ${validation.errors.join(', ')}`);
          continue;
        }
        
        results.valid++;
        
        // Check for duplicates
        const existingStaffMember = await findExistingStaff(staffData, existingStaff);
        
        if (options.dryRun) {
          // Add to preview table
          preview.push({
            row: rowNum,
            name: `${staffData.first_name} ${staffData.last_name}`,
            action: existingStaffMember 
              ? (options.update ? 'UPDATE' : 'SKIP') 
              : 'CREATE',
            position: staffData.position || 'N/A',
            phone: staffData.phone || 'N/A',
            suburb: staffData.suburb || 'N/A',
            postcode: staffData.postcode || 'N/A'
          });
          continue;
        }
        
        if (existingStaffMember) {
          if (options.update) {
            // Update existing staff
            await staffService.updateStaff(existingStaffMember.id, staffData);
            results.updated++;
            logger.success(`Updated staff: ${staffData.first_name} ${staffData.last_name}`);
          } else {
            // Skip duplicate
            results.skipped++;
            logger.warning(`Skipped duplicate staff: ${staffData.first_name} ${staffData.last_name}`);
          }
        } else {
          // Create new staff
          const newStaff = await staffService.createStaff(staffData);
          results.created++;
          logger.success(`Created staff: ${staffData.first_name} ${staffData.last_name}`);
          
          // Add to existing list for future duplicate checks
          existingStaff.push(newStaff);
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
      logger.progress(i + 1, filteredData.length, 'Staff');
    }
    
    if (options.dryRun && preview.length > 0) {
      logger.dryRun('Staff Import Preview:');
      logger.table(preview);
    }
    
    return results;
  } catch (error) {
    logger.error(`Failed to import staff: ${error.message}`);
    throw error;
  }
}

/**
 * Import participants from CSV data
 * @param {string} filePath - Path to participants CSV file
 * @param {Map} addressMap - Map of addresses to parsed components
 * @returns {Promise<Object>} Import results
 */
async function importParticipants(filePath, addressMap) {
  try {
    const csvData = await readCsvFile(filePath);
    logger.info(`Processing ${csvData.length} participant records`);
    
    // Get existing participants for duplicate detection
    const existingParticipants = await participantService.getAllParticipants();
    logger.debug(`Found ${existingParticipants.length} existing participants in database`);
    
    const results = {
      total: csvData.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
      updated: 0,
      created: 0,
      errors: []
    };
    
    // Preview table for dry run
    const preview = [];
    
    // Filter out empty rows (sometimes CSVs have trailing empty rows)
    const filteredData = csvData.filter(row => {
      // Check if row has a name value (either in Name field or _0 field)
      const nameValue = getRowValue(row, ['Name'], null);
      const hasName = nameValue && nameValue.trim() !== '';
      
      if (!hasName && options.verbose) {
        logger.debug(`Filtering out row without Name: ${JSON.stringify(row)}`);
      }
      
      return hasName;
    });
    
    logger.debug(`After filtering: ${filteredData.length} participant records remain`);
    
    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const rowNum = i + 2; // +2 because CSV is 1-based and we skip header row
      
      try {
        // Map CSV columns to database fields using AI-parsed address
        const participantData = mapParticipantData(row, addressMap);
        
        // Validate data
        const validation = validateParticipantData(participantData);
        if (!validation.isValid) {
          results.invalid++;
          results.errors.push({
            row: rowNum,
            name: `${participantData.first_name || ''} ${participantData.last_name || ''}`.trim(),
            errors: validation.errors
          });
          logger.warning(`Row ${rowNum}: Invalid participant data - ${validation.errors.join(', ')}`);
          continue;
        }
        
        results.valid++;
        
        // Check for duplicates
        const existingParticipant = await findExistingParticipant(participantData, existingParticipants);
        
        if (options.dryRun) {
          // Add to preview table
          preview.push({
            row: rowNum,
            name: `${participantData.first_name} ${participantData.last_name}`,
            action: existingParticipant 
              ? (options.update ? 'UPDATE' : 'SKIP') 
              : 'CREATE',
            ndis: participantData.ndis_number || 'N/A',
            plan: participantData.plan_management_type,
            suburb: participantData.suburb || 'N/A',
            postcode: participantData.postcode || 'N/A'
          });
          continue;
        }
        
        if (existingParticipant) {
          if (options.update) {
            // Update existing participant
            await participantService.updateParticipant(existingParticipant.id, participantData);
            results.updated++;
            logger.success(`Updated participant: ${participantData.first_name} ${participantData.last_name}`);
          } else {
            // Skip duplicate
            results.skipped++;
            logger.warning(`Skipped duplicate participant: ${participantData.first_name} ${participantData.last_name}`);
          }
        } else {
          // Create new participant
          const newParticipant = await participantService.createParticipant(participantData);
          results.created++;
          logger.success(`Created participant: ${participantData.first_name} ${participantData.last_name}`);
          
          // Add to existing list for future duplicate checks
          existingParticipants.push(newParticipant);
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
      logger.progress(i + 1, filteredData.length, 'Participants');
    }
    
    if (options.dryRun && preview.length > 0) {
      logger.dryRun('Participant Import Preview:');
      logger.table(preview);
    }
    
    return results;
  } catch (error) {
    logger.error(`Failed to import participants: ${error.message}`);
    throw error;
  }
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Smart CSV Data Import Script for RABS POC${colors.reset}

This script imports staff and participant data from CSV files into the database,
using AI-powered address parsing for accurate extraction of address components.

${colors.yellow}Usage:${colors.reset}
  node import-csv-smart.js --staff path/to/staff.csv --participants path/to/participants.csv [options]

${colors.yellow}Options:${colors.reset}
  --staff <path>        Path to staff CSV file
  --participants <path> Path to participants CSV file
  --dry-run             Preview import without writing to database
  --update              Update existing records instead of skipping
  --verbose             Show detailed logging
  --help                Show help
  `);
}

/**
 * Show address parsing statistics
 */
function showAddressStats() {
  logger.info('\n===== Address Parsing Statistics =====');
  
  // Get stats from the address parser
  const parserStats = addressParser.getStats();
  
  logger.info(`Total addresses processed: ${parserStats.addressesParsed}`);
  logger.info(`Cache hits: ${parserStats.cacheHits}`);
  logger.info(`Cache misses: ${parserStats.cacheMisses}`);
  logger.info(`API calls made: ${parserStats.apiCalls}`);
  logger.info(`Parse errors: ${parserStats.parseErrors}`);
  
  // Show postcode completion statistics
  logger.info(`Postcodes completed: ${parserStats.postcodesCompleted}`);
  logger.info(`Postcode completion errors: ${parserStats.postcodeCompletionErrors}`);
  
  // Show cache sizes
  logger.info(`Address cache size: ${parserStats.addressCacheSize}`);
  logger.info(`Postcode cache size: ${parserStats.postcodeCacheSize}`);
  
  // Calculate efficiency
  const cacheHitPercentage = parserStats.addressesParsed > 0 
    ? Math.round((parserStats.cacheHits / (parserStats.cacheHits + parserStats.cacheMisses)) * 100) 
    : 100;
  
  logger.info(`Cache efficiency: ${cacheHitPercentage}%`);
}

/**
 * Main function to run the import
 */
async function main() {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  if (!options.staff && !options.participants) {
    logger.error('No input files specified. Use --staff and/or --participants options.');
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
    let participantResults = null;
    let staffResults = null;
    let participantData = [];
    let staffData = [];
    
    // Read the CSV files first
    if (options.participants) {
      logger.info(`Reading participant data from ${options.participants}`);
      participantData = await readCsvFile(options.participants);
    }
    
    if (options.staff) {
      logger.info(`Reading staff data from ${options.staff}`);
      staffData = await readCsvFile(options.staff);
    }
    
    // Collect all unique addresses for batch processing
    const uniqueAddresses = collectUniqueAddresses(staffData, participantData);
    
    // Process all addresses in batch
    const addressMap = await processAddressesBatch(uniqueAddresses);
    
    // Import participants if specified
    if (options.participants) {
      logger.info(`Starting participant import from ${options.participants}`);
      participantResults = await importParticipants(options.participants, addressMap);
    }
    
    // Import staff if specified
    if (options.staff) {
      logger.info(`Starting staff import from ${options.staff}`);
      staffResults = await importStaff(options.staff, addressMap);
    }
    
    // Save both address and postcode caches for future runs
    addressParser.saveAddressCache();
    addressParser.savePostcodeCache();
    
    // Summary
    logger.info('\n===== Import Summary =====');
    
    if (participantResults) {
      logger.info('\nParticipant Import:');
      logger.info(`Total records: ${participantResults.total}`);
      logger.info(`Valid records: ${participantResults.valid}`);
      logger.info(`Invalid records: ${participantResults.invalid}`);
      
      if (!options.dryRun) {
        logger.info(`Created: ${participantResults.created}`);
        logger.info(`Updated: ${participantResults.updated}`);
        logger.info(`Skipped: ${participantResults.skipped}`);
      }
      
      if (participantResults.errors.length > 0) {
        logger.warning('\nParticipant Errors:');
        for (const error of participantResults.errors) {
          logger.warning(`Row ${error.row} (${error.name}): ${error.errors.join(', ')}`);
        }
      }
    }
    
    if (staffResults) {
      logger.info('\nStaff Import:');
      logger.info(`Total records: ${staffResults.total}`);
      logger.info(`Valid records: ${staffResults.valid}`);
      logger.info(`Invalid records: ${staffResults.invalid}`);
      
      if (!options.dryRun) {
        logger.info(`Created: ${staffResults.created}`);
        logger.info(`Updated: ${staffResults.updated}`);
        logger.info(`Skipped: ${staffResults.skipped}`);
      }
      
      if (staffResults.errors.length > 0) {
        logger.warning('\nStaff Errors:');
        for (const error of staffResults.errors) {
          logger.warning(`Row ${error.row} (${error.name}): ${error.errors.join(', ')}`);
        }
      }
    }
    
    // Show address parsing statistics
    showAddressStats();
    
    if (options.dryRun) {
      logger.dryRun('\nThis was a dry run. No data was written to the database.');
      logger.dryRun('Run without --dry-run to perform the actual import.');
    }
    
  } catch (error) {
    logger.error(`Import failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
