#!/usr/bin/env node
/**
 * Excel Data Import Script for RABS POC
 * 
 * This script imports staff and participant data from Excel files into the database.
 * It supports both .xlsx files and converted .txt files.
 * 
 * Usage:
 *   node import-excel-data.js --staff path/to/staff.xlsx --participants path/to/participants.xlsx [--dry-run]
 *   node import-excel-data.js --staff path/to/staff.txt --participants path/to/participants.txt [--dry-run]
 * 
 * Options:
 *   --staff          Path to staff Excel file
 *   --participants   Path to participants Excel file
 *   --dry-run        Preview import without writing to database
 *   --update         Update existing records instead of skipping
 *   --help           Show help
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { program } = require('commander');
const staffService = require('../backend/services/staffService');
const participantService = require('../backend/services/participantService');

// Configure command line options
program
  .option('--staff <path>', 'Path to staff Excel file')
  .option('--participants <path>', 'Path to participants Excel file')
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
  table: (data) => console.table(data)
};

/**
 * Read an Excel file and return the worksheet data
 * @param {string} filePath - Path to the Excel file
 * @returns {Array} Array of objects representing each row
 */
function readExcelFile(filePath) {
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
      // Create a CSV-like structure that XLSX can parse
      workbook = XLSX.read(fileContent, { type: 'string', raw: true });
    } else {
      // For .xlsx files, read directly
      workbook = XLSX.readFile(filePath);
    }
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    logger.success(`Successfully read ${data.length} rows from ${path.basename(filePath)}`);
    return data;
  } catch (error) {
    logger.error(`Failed to read Excel file: ${error.message}`);
    throw error;
  }
}

/**
 * Find the appropriate column name in the Excel data
 * @param {Object} row - Excel row data
 * @param {Array} possibleNames - Array of possible column names
 * @returns {string|null} The matched column name or null
 */
function findColumnName(row, possibleNames) {
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    // Case-insensitive match
    const match = rowKeys.find(key => key.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  return null;
}

/**
 * Convert various boolean representations to actual boolean values
 * @param {any} value - The value to convert
 * @returns {boolean|null} The converted boolean value or null if invalid
 */
function toBooleanValue(value) {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'boolean') return value;
  
  if (typeof value === 'number') return value !== 0;
  
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['yes', 'y', 'true', 't', '1'].includes(normalized)) return true;
    if (['no', 'n', 'false', 'f', '0'].includes(normalized)) return false;
  }
  
  return null;
}

/**
 * Map Excel column names to participant database fields
 * @param {Object} row - Excel row data
 * @returns {Object} Mapped participant data
 */
function mapParticipantData(row) {
  // Define possible Excel column names for each database field
  const columnMappings = {
    first_name: ['First Name', 'FirstName', 'first_name', 'First', 'Given Name', 'GivenName'],
    last_name: ['Last Name', 'LastName', 'last_name', 'Last', 'Surname', 'Family Name', 'FamilyName'],
    address: ['Address', 'Street Address', 'StreetAddress', 'address', 'Residential Address'],
    suburb: ['Suburb', 'City', 'Town', 'suburb'],
    state: ['State', 'state', 'Province'],
    postcode: ['Postcode', 'PostCode', 'ZIP', 'ZipCode', 'Postal Code', 'PostalCode', 'postcode'],
    ndis_number: ['NDIS Number', 'NDIS#', 'NDISNumber', 'ndis_number', 'NDIS ID'],
    phone: ['Phone', 'Phone Number', 'PhoneNumber', 'Contact Phone', 'ContactPhone', 'Mobile', 'phone', 'Telephone'],
    email: ['Email', 'Email Address', 'EmailAddress', 'Contact Email', 'ContactEmail', 'email'],
    notes: ['Notes', 'Comments', 'Additional Information', 'notes'],
    supervision_multiplier: ['Supervision Multiplier', 'SupervisionMultiplier', 'Supervision Ratio', 'supervision_multiplier'],
    mobility_needs: ['Mobility Needs', 'MobilityNeeds', 'Mobility Requirements', 'mobility_needs', 'mobility_requirements'],
    allergies: ['Allergies', 'Dietary Requirements', 'DietaryRequirements', 'allergies', 'dietary_requirements', 'Food Allergies'],
    medication_needs: ['Medication Needs', 'MedicationNeeds', 'Medical Requirements', 'medication_needs', 'medical_requirements'],
    has_behavior_support_plan: ['Behavior Support Plan', 'BehaviorSupportPlan', 'Has Behavior Support Plan', 'behavior_support_plan'],
    plan_management_type: ['Plan Management Type', 'PlanManagementType', 'Plan Management', 'plan_management_type'],
    emergency_contact_name: ['Emergency Contact Name', 'EmergencyContactName', 'Emergency Contact', 'emergency_contact_name'],
    emergency_contact_phone: ['Emergency Contact Phone', 'EmergencyContactPhone', 'Emergency Phone', 'emergency_contact_phone']
  };
  
  // Boolean flags
  const booleanFlags = {
    has_wheelchair_access: ['Wheelchair Access', 'WheelchairAccess', 'Needs Wheelchair', 'has_wheelchair_access'],
    has_dietary_requirements: ['Dietary Requirements', 'DietaryRequirements', 'Special Diet', 'has_dietary_requirements'],
    has_medical_requirements: ['Medical Requirements', 'MedicalRequirements', 'Medical Needs', 'has_medical_requirements'],
    has_behavioral_support: ['Behavioral Support', 'BehavioralSupport', 'Behavior Issues', 'has_behavioral_support'],
    has_visual_impairment: ['Visual Impairment', 'VisualImpairment', 'Vision Issues', 'has_visual_impairment'],
    has_hearing_impairment: ['Hearing Impairment', 'HearingImpairment', 'Hearing Issues', 'has_hearing_impairment'],
    has_cognitive_support: ['Cognitive Support', 'CognitiveSupport', 'Cognitive Issues', 'has_cognitive_support'],
    has_communication_needs: ['Communication Needs', 'CommunicationNeeds', 'Communication Issues', 'has_communication_needs']
  };
  
  const participantData = {};
  
  // Map standard fields
  for (const [dbField, possibleColumns] of Object.entries(columnMappings)) {
    const columnName = findColumnName(row, possibleColumns);
    if (columnName && row[columnName] !== null) {
      participantData[dbField] = row[columnName];
    }
  }
  
  // Map boolean flags
  for (const [dbField, possibleColumns] of Object.entries(booleanFlags)) {
    const columnName = findColumnName(row, possibleColumns);
    if (columnName) {
      participantData[dbField] = toBooleanValue(row[columnName]);
    }
  }
  
  // Handle plan management type specifically
  if (participantData.plan_management_type) {
    const planType = participantData.plan_management_type.toString().toLowerCase().trim();
    if (planType.includes('agency')) participantData.plan_management_type = 'agency_managed';
    else if (planType.includes('self')) participantData.plan_management_type = 'self_managed';
    else if (planType.includes('plan')) participantData.plan_management_type = 'plan_managed';
    else participantData.plan_management_type = 'agency_managed'; // Default
  }
  
  // Handle supervision multiplier as a number
  if (participantData.supervision_multiplier) {
    const multiplier = parseFloat(participantData.supervision_multiplier);
    participantData.supervision_multiplier = isNaN(multiplier) ? 1.0 : multiplier;
  }
  
  return participantData;
}

/**
 * Map Excel column names to staff database fields
 * @param {Object} row - Excel row data
 * @returns {Object} Mapped staff data
 */
function mapStaffData(row) {
  // Define possible Excel column names for each database field
  const columnMappings = {
    first_name: ['First Name', 'FirstName', 'first_name', 'First', 'Given Name', 'GivenName'],
    last_name: ['Last Name', 'LastName', 'last_name', 'Last', 'Surname', 'Family Name', 'FamilyName'],
    address: ['Address', 'Street Address', 'StreetAddress', 'address', 'Residential Address'],
    suburb: ['Suburb', 'City', 'Town', 'suburb'],
    state: ['State', 'state', 'Province'],
    postcode: ['Postcode', 'PostCode', 'ZIP', 'ZipCode', 'Postal Code', 'PostalCode', 'postcode'],
    phone: ['Phone', 'Phone Number', 'PhoneNumber', 'Contact Phone', 'ContactPhone', 'Mobile', 'phone', 'Telephone'],
    email: ['Email', 'Email Address', 'EmailAddress', 'Contact Email', 'ContactEmail', 'email'],
    position: ['Position', 'Role', 'Job Title', 'JobTitle', 'position', 'role'],
    active: ['Active', 'IsActive', 'Status', 'Employment Status', 'active']
  };
  
  const staffData = {};
  
  // Map standard fields
  for (const [dbField, possibleColumns] of Object.entries(columnMappings)) {
    const columnName = findColumnName(row, possibleColumns);
    if (columnName && row[columnName] !== null) {
      if (dbField === 'active') {
        staffData[dbField] = toBooleanValue(row[columnName]);
      } else {
        staffData[dbField] = row[columnName];
      }
    }
  }
  
  return staffData;
}

/**
 * Validate participant data before import
 * @param {Object} participant - Mapped participant data
 * @returns {Object} Validation result {isValid, errors}
 */
function validateParticipantData(participant) {
  const errors = [];
  
  // Required fields
  if (!participant.first_name) errors.push('First name is required');
  if (!participant.last_name) errors.push('Last name is required');
  if (!participant.address) errors.push('Address is required');
  if (!participant.suburb) errors.push('Suburb is required');
  if (!participant.postcode) errors.push('Postcode is required');
  
  // Format validations
  if (participant.postcode && !/^\d{4}$/.test(participant.postcode.toString())) {
    errors.push('Postcode must be a 4-digit number');
  }
  
  if (participant.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant.email)) {
    errors.push('Email format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate staff data before import
 * @param {Object} staff - Mapped staff data
 * @returns {Object} Validation result {isValid, errors}
 */
function validateStaffData(staff) {
  const errors = [];
  
  // Required fields
  if (!staff.first_name) errors.push('First name is required');
  if (!staff.last_name) errors.push('Last name is required');
  
  // Format validations
  if (staff.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email)) {
    errors.push('Email format is invalid');
  }
  
  if (staff.postcode && !/^\d{4}$/.test(staff.postcode.toString())) {
    errors.push('Postcode must be a 4-digit number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
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
        p.postcode.toString() === participant.postcode.toString()
      )
    )
  );
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
 * Import participants from Excel data
 * @param {string} filePath - Path to participants Excel file
 * @returns {Promise<Object>} Import results
 */
async function importParticipants(filePath) {
  try {
    const excelData = readExcelFile(filePath);
    logger.info(`Processing ${excelData.length} participant records`);
    
    // Get existing participants for duplicate detection
    const existingParticipants = await participantService.getAllParticipants();
    logger.debug(`Found ${existingParticipants.length} existing participants in database`);
    
    const results = {
      total: excelData.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
      updated: 0,
      created: 0,
      errors: []
    };
    
    // Preview table for dry run
    const preview = [];
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      const rowNum = i + 2; // +2 because Excel is 1-based and we skip header row
      
      try {
        // Map Excel columns to database fields
        const participantData = mapParticipantData(row);
        
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
            ndis: participantData.ndis_number || 'N/A'
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
          name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : `Row ${rowNum}`,
          errors: [error.message]
        });
        logger.error(`Error processing row ${rowNum}: ${error.message}`);
      }
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
 * Import staff from Excel data
 * @param {string} filePath - Path to staff Excel file
 * @returns {Promise<Object>} Import results
 */
async function importStaff(filePath) {
  try {
    const excelData = readExcelFile(filePath);
    logger.info(`Processing ${excelData.length} staff records`);
    
    // Get existing staff for duplicate detection
    const existingStaff = await staffService.getAllStaff();
    logger.debug(`Found ${existingStaff.length} existing staff in database`);
    
    const results = {
      total: excelData.length,
      valid: 0,
      invalid: 0,
      skipped: 0,
      updated: 0,
      created: 0,
      errors: []
    };
    
    // Preview table for dry run
    const preview = [];
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      const rowNum = i + 2; // +2 because Excel is 1-based and we skip header row
      
      try {
        // Map Excel columns to database fields
        const staffData = mapStaffData(row);
        
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
            position: staffData.position || 'N/A'
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
          name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : `Row ${rowNum}`,
          errors: [error.message]
        });
        logger.error(`Error processing row ${rowNum}: ${error.message}`);
      }
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
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Excel Data Import Script for RABS POC${colors.reset}

This script imports staff and participant data from Excel files into the database.
It supports both .xlsx files and converted .txt files.

${colors.yellow}Usage:${colors.reset}
  node import-excel-data.js --staff path/to/staff.xlsx --participants path/to/participants.xlsx [options]
  node import-excel-data.js --staff path/to/staff.txt --participants path/to/participants.txt [options]

${colors.yellow}Options:${colors.reset}
  --staff <path>       Path to staff Excel file
  --participants <path> Path to participants Excel file
  --dry-run           Preview import without writing to database
  --update            Update existing records instead of skipping
  --verbose           Show detailed logging
  --help              Show this help message
  `);
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
  
  if (options.dryRun) {
    logger.dryRun('Running in dry-run mode. No data will be written to the database.');
  }
  
  try {
    let participantResults = null;
    let staffResults = null;
    
    // Import participants if specified
    if (options.participants) {
      logger.info(`Starting participant import from ${options.participants}`);
      participantResults = await importParticipants(options.participants);
    }
    
    // Import staff if specified
    if (options.staff) {
      logger.info(`Starting staff import from ${options.staff}`);
      staffResults = await importStaff(options.staff);
    }
    
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
