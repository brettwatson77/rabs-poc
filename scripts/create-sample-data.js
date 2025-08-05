#!/usr/bin/env node
/**
 * Sample Data Creation Script for RABS POC
 * 
 * This script generates realistic sample data for staff and participants
 * to facilitate testing of the system without requiring real data.
 * 
 * Usage:
 *   node create-sample-data.js [options]
 * 
 * Options:
 *   --staff <number>       Number of staff records to create (default: 10)
 *   --participants <number> Number of participant records to create (default: 20)
 *   --clean                Remove existing data before creating new records
 *   --verbose              Show detailed logging
 *   --dry-run              Preview data without writing to database
 *   --help                 Show help
 */

const { program } = require('commander');
const staffService = require('../backend/services/staffService');
const participantService = require('../backend/services/participantService');

// Configure command line options
program
  .option('--staff <number>', 'Number of staff records to create', 10)
  .option('--participants <number>', 'Number of participant records to create', 20)
  .option('--clean', 'Remove existing data before creating new records', false)
  .option('--verbose', 'Show detailed logging', false)
  .option('--dry-run', 'Preview data without writing to database', false)
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
  dryRun: (message) => console.log(`${colors.magenta}[DRY RUN]${colors.reset} ${message}`),
  debug: (message) => {
    if (options.verbose) {
      console.log(`${colors.cyan}[DEBUG]${colors.reset} ${message}`);
    }
  },
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
 * Sample data generators
 */
const sampleData = {
  // First names for generating random names
  firstNames: [
    'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
    'Margaret', 'Nancy', 'Lisa', 'Betty', 'Dorothy', 'Sandra', 'Ashley', 'Kimberly', 'Donna', 'Emily',
    'Kenneth', 'George', 'Brian', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
    'Carol', 'Michelle', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia',
    'Gary', 'Nicholas', 'Eric', 'Stephen', 'Jonathan', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
    'Kathleen', 'Helen', 'Amy', 'Shirley', 'Angela', 'Anna', 'Ruth', 'Brenda', 'Pamela', 'Nicole',
    'Samuel', 'Alexander', 'Tyler', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Aaron', 'Henry',
    'Katherine', 'Samantha', 'Christine', 'Emma', 'Catherine', 'Debra', 'Virginia', 'Rachel', 'Carolyn', 'Janet'
  ],

  // Last names for generating random names
  lastNames: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson',
    'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White',
    'Lopez', 'Lee', 'Gonzalez', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall',
    'Young', 'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
    'Hill', 'Ramirez', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Torres',
    'Parker', 'Collins', 'Edwards', 'Stewart', 'Flores', 'Morris', 'Nguyen', 'Murphy', 'Rivera', 'Cook',
    'Rogers', 'Morgan', 'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard',
    'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett', 'Gray', 'James',
    'Reyes', 'Cruz', 'Hughes', 'Price', 'Myers', 'Long', 'Foster', 'Sanders', 'Ross', 'Morales',
    'Powell', 'Sullivan', 'Russell', 'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler', 'Barnes', 'Fisher'
  ],

  // Street names for generating addresses
  streetNames: [
    'High Street', 'Station Road', 'Main Street', 'Park Road', 'Church Road', 'Church Street', 'London Road',
    'Victoria Road', 'Green Lane', 'Manor Road', 'Church Lane', 'Park Avenue', 'The Avenue', 'The Crescent',
    'Queens Road', 'New Road', 'Grange Road', 'Kings Road', 'Kingsway', 'Windsor Road', 'Highfield Road',
    'Mill Lane', 'Alexander Road', 'York Road', 'St. John\'s Road', 'Main Road', 'Broadway', 'King Street',
    'The Green', 'Springfield Road', 'George Street', 'Park Lane', 'Victoria Street', 'Albert Road',
    'Queensway', 'New Street', 'Queen Street', 'West Street', 'North Street', 'Manchester Road',
    'The Grove', 'Richmond Road', 'Grove Road', 'South Street', 'School Lane', 'The Drive',
    'North Road', 'Stanley Road', 'Chester Road', 'Mill Road'
  ],

  // NSW suburbs for generating addresses
  nswSuburbs: [
    { name: 'Sydney', postcode: '2000' },
    { name: 'Parramatta', postcode: '2150' },
    { name: 'Newcastle', postcode: '2300' },
    { name: 'Wollongong', postcode: '2500' },
    { name: 'Blacktown', postcode: '2148' },
    { name: 'Penrith', postcode: '2750' },
    { name: 'Campbelltown', postcode: '2560' },
    { name: 'Liverpool', postcode: '2170' },
    { name: 'Gosford', postcode: '2250' },
    { name: 'Wyong', postcode: '2259' },
    { name: 'Bathurst', postcode: '2795' },
    { name: 'Orange', postcode: '2800' },
    { name: 'Dubbo', postcode: '2830' },
    { name: 'Tamworth', postcode: '2340' },
    { name: 'Wagga Wagga', postcode: '2650' },
    { name: 'Albury', postcode: '2640' },
    { name: 'Port Macquarie', postcode: '2444' },
    { name: 'Coffs Harbour', postcode: '2450' },
    { name: 'Lismore', postcode: '2480' },
    { name: 'Byron Bay', postcode: '2481' },
    { name: 'Tweed Heads', postcode: '2485' },
    { name: 'Bega', postcode: '2550' },
    { name: 'Broken Hill', postcode: '2880' },
    { name: 'Grafton', postcode: '2460' }
  ],

  // Staff positions
  staffPositions: [
    'Support Worker',
    'Team Leader',
    'Coordinator',
    'Manager',
    'Administrator',
    'Disability Support Worker',
    'NDIS Specialist',
    'Case Manager',
    'Registered Nurse',
    'Occupational Therapist',
    'Physiotherapist',
    'Social Worker',
    'Psychologist',
    'Speech Pathologist',
    'Behavioral Therapist',
    'Community Access Worker',
    'Driver',
    'Activities Officer',
    'Finance Officer',
    'HR Officer'
  ],

  // Mobility needs descriptions
  mobilityNeeds: [
    'Uses wheelchair full-time',
    'Uses wheelchair occasionally',
    'Uses walking frame',
    'Uses walking stick',
    'Requires physical support when walking',
    'Requires assistance with transfers',
    'Limited mobility in left leg',
    'Limited mobility in right leg',
    'Limited mobility in both legs',
    'Requires assistance with stairs',
    'Cannot navigate uneven surfaces',
    'Tires easily when walking',
    'Requires ramps for access',
    'Uses motorized scooter',
    'No mobility issues',
    'Uses crutches',
    'Requires handrails',
    'Limited range of motion',
    'Balance issues',
    'Requires accessible transport'
  ],

  // Allergy descriptions
  allergies: [
    'No known allergies',
    'Peanut allergy',
    'Tree nut allergy',
    'Shellfish allergy',
    'Fish allergy',
    'Egg allergy',
    'Milk allergy',
    'Soy allergy',
    'Wheat allergy',
    'Gluten intolerance',
    'Lactose intolerance',
    'Strawberry allergy',
    'Kiwi allergy',
    'Penicillin allergy',
    'Bee sting allergy',
    'Dust mite allergy',
    'Pet dander allergy',
    'Pollen allergy',
    'Mold allergy',
    'Latex allergy'
  ],

  // Medication needs descriptions
  medicationNeeds: [
    'No medication required',
    'Requires assistance with medication',
    'Self-administers medication',
    'Requires medication reminder',
    'Requires insulin injections',
    'Takes blood pressure medication',
    'Takes anti-seizure medication',
    'Takes pain medication',
    'Takes anxiety medication',
    'Takes depression medication',
    'Takes ADHD medication',
    'Takes blood thinners',
    'Takes heart medication',
    'Takes asthma medication',
    'Takes allergy medication',
    'Takes thyroid medication',
    'Takes cholesterol medication',
    'Takes multiple medications daily',
    'Requires medication at specific times',
    'Requires medication with food'
  ],

  // Plan management types
  planManagementTypes: [
    'agency_managed',
    'plan_managed',
    'self_managed'
  ],

  /**
   * Generate a random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer
   */
  randomInt: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate a random boolean with specified probability of being true
   * @param {number} probability - Probability of true (0-1)
   * @returns {boolean} Random boolean
   */
  randomBoolean: (probability = 0.5) => {
    return Math.random() < probability;
  },

  /**
   * Get a random item from an array
   * @param {Array} array - Array to select from
   * @returns {*} Random item from array
   */
  randomItem: (array) => {
    return array[Math.floor(Math.random() * array.length)];
  },

  /**
   * Generate a random phone number
   * @returns {string} Random Australian phone number
   */
  randomPhone: () => {
    const formats = [
      // Mobile numbers
      '04XX XXX XXX',
      '04XX-XXX-XXX',
      '04XXXXXXXX',
      // Landline numbers
      '02 XXXX XXXX',
      '02-XXXX-XXXX',
      '02XXXXXXXX'
    ];
    
    let phone = sampleData.randomItem(formats);
    
    // Replace X with random digits
    return phone.replace(/X/g, () => sampleData.randomInt(0, 9));
  },

  /**
   * Generate a random email address
   * @param {string} firstName - First name
   * @param {string} lastName - Last name
   * @returns {string} Random email address
   */
  randomEmail: (firstName, lastName) => {
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'bigpond.com', 'live.com'];
    const separators = ['', '.', '_'];
    
    const normalizedFirstName = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedLastName = lastName.toLowerCase().replace(/[^a-z]/g, '');
    
    const separator = sampleData.randomItem(separators);
    const domain = sampleData.randomItem(domains);
    
    // Sometimes add a random number to the email
    const addNumber = sampleData.randomBoolean(0.3);
    const number = addNumber ? sampleData.randomInt(1, 999) : '';
    
    return `${normalizedFirstName}${separator}${normalizedLastName}${number}@${domain}`;
  },

  /**
   * Generate a random NDIS number
   * @returns {string} Random NDIS number
   */
  randomNdisNumber: () => {
    // NDIS numbers are 9 digits
    let ndisNumber = '';
    for (let i = 0; i < 9; i++) {
      ndisNumber += sampleData.randomInt(0, 9);
    }
    return ndisNumber;
  },

  /**
   * Generate a random street address
   * @returns {string} Random street address
   */
  randomAddress: () => {
    const houseNumber = sampleData.randomInt(1, 200);
    const street = sampleData.randomItem(sampleData.streetNames);
    return `${houseNumber} ${street}`;
  },

  /**
   * Generate a random supervision multiplier
   * @returns {number} Random supervision multiplier
   */
  randomSupervisionMultiplier: () => {
    // Common values are 1.0, 1.5, 2.0, 2.5, 3.0
    const multipliers = [1.0, 1.0, 1.0, 1.0, 1.5, 1.5, 2.0, 2.0, 2.5, 3.0];
    return sampleData.randomItem(multipliers);
  },

  /**
   * Generate random staff data
   * @returns {Object} Staff data object
   */
  generateStaffData: () => {
    const firstName = sampleData.randomItem(sampleData.firstNames);
    const lastName = sampleData.randomItem(sampleData.lastNames);
    const suburb = sampleData.randomItem(sampleData.nswSuburbs);
    
    return {
      first_name: firstName,
      last_name: lastName,
      address: sampleData.randomAddress(),
      suburb: suburb.name,
      state: 'NSW',
      postcode: suburb.postcode,
      phone: sampleData.randomPhone(),
      email: sampleData.randomEmail(firstName, lastName),
      position: sampleData.randomItem(sampleData.staffPositions),
      active: sampleData.randomBoolean(0.9) // 90% of staff are active
    };
  },

  /**
   * Generate random participant data
   * @returns {Object} Participant data object
   */
  generateParticipantData: () => {
    const firstName = sampleData.randomItem(sampleData.firstNames);
    const lastName = sampleData.randomItem(sampleData.lastNames);
    const suburb = sampleData.randomItem(sampleData.nswSuburbs);
    
    // Generate emergency contact (50% chance)
    const hasEmergencyContact = sampleData.randomBoolean(0.5);
    const emergencyContactName = hasEmergencyContact 
      ? `${sampleData.randomItem(sampleData.firstNames)} ${sampleData.randomItem(sampleData.lastNames)}`
      : null;
    const emergencyContactPhone = hasEmergencyContact
      ? sampleData.randomPhone()
      : null;
    
    // Generate support needs with realistic probabilities
    const hasDietaryRequirements = sampleData.randomBoolean(0.3);
    const hasMedicalRequirements = sampleData.randomBoolean(0.4);
    const hasWheelchairAccess = sampleData.randomBoolean(0.2);
    
    return {
      first_name: firstName,
      last_name: lastName,
      address: sampleData.randomAddress(),
      suburb: suburb.name,
      state: 'NSW',
      postcode: suburb.postcode,
      ndis_number: sampleData.randomNdisNumber(),
      phone: sampleData.randomPhone(),
      email: sampleData.randomEmail(firstName, lastName),
      notes: null, // Optional notes
      
      // Support needs
      supervision_multiplier: sampleData.randomSupervisionMultiplier(),
      mobility_needs: hasWheelchairAccess 
        ? sampleData.randomItem(sampleData.mobilityNeeds.filter(need => need.includes('wheelchair')))
        : sampleData.randomItem(sampleData.mobilityNeeds),
      allergies: hasDietaryRequirements
        ? sampleData.randomItem(sampleData.allergies.filter(allergy => allergy !== 'No known allergies'))
        : 'No known allergies',
      medication_needs: hasMedicalRequirements
        ? sampleData.randomItem(sampleData.medicationNeeds.filter(need => need !== 'No medication required'))
        : 'No medication required',
      
      // Boolean flags
      has_behavior_support_plan: sampleData.randomBoolean(0.15),
      has_wheelchair_access: hasWheelchairAccess,
      has_dietary_requirements: hasDietaryRequirements,
      has_medical_requirements: hasMedicalRequirements,
      has_behavioral_support: sampleData.randomBoolean(0.15),
      has_visual_impairment: sampleData.randomBoolean(0.1),
      has_hearing_impairment: sampleData.randomBoolean(0.1),
      has_cognitive_support: sampleData.randomBoolean(0.25),
      has_communication_needs: sampleData.randomBoolean(0.2),
      
      // Plan management
      plan_management_type: sampleData.randomItem(sampleData.planManagementTypes),
      
      // Emergency contact
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone
    };
  }
};

/**
 * Validate staff data against schema requirements
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
 * Validate participant data against schema requirements
 * @param {Object} participantData - Participant data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
function validateParticipantData(participantData) {
  const errors = [];
  
  // Required fields
  if (!participantData.first_name) errors.push('First name is required');
  if (!participantData.last_name) errors.push('Last name is required');
  if (!participantData.address) errors.push('Address is required');
  if (!participantData.suburb) errors.push('Suburb is required');
  if (!participantData.postcode) errors.push('Postcode is required');
  
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
 * Create staff records
 * @param {number} count - Number of staff records to create
 * @returns {Promise<Array>} Created staff records
 */
async function createStaffRecords(count) {
  const createdStaff = [];
  const invalidData = [];
  
  logger.info(`Generating ${count} staff records...`);
  
  for (let i = 0; i < count; i++) {
    const staffData = sampleData.generateStaffData();
    
    // Validate data
    const validation = validateStaffData(staffData);
    if (!validation.isValid) {
      logger.warning(`Invalid staff data: ${validation.errors.join(', ')}`);
      invalidData.push({ data: staffData, errors: validation.errors });
      continue;
    }
    
    try {
      if (options.dryRun) {
        logger.dryRun(`Would create staff: ${staffData.first_name} ${staffData.last_name}`);
        createdStaff.push({ id: `dry-run-${i}`, ...staffData });
      } else {
        const staff = await staffService.createStaff(staffData);
        createdStaff.push(staff);
        logger.debug(`Created staff: ${staff.first_name} ${staff.last_name} (ID: ${staff.id})`);
      }
    } catch (error) {
      logger.error(`Error creating staff: ${error.message}`);
      invalidData.push({ data: staffData, error: error.message });
    }
    
    // Show progress
    logger.progress(i + 1, count, 'Staff');
  }
  
  if (invalidData.length > 0) {
    logger.warning(`${invalidData.length} staff records failed validation`);
  }
  
  return createdStaff;
}

/**
 * Create participant records
 * @param {number} count - Number of participant records to create
 * @returns {Promise<Array>} Created participant records
 */
async function createParticipantRecords(count) {
  const createdParticipants = [];
  const invalidData = [];
  
  logger.info(`Generating ${count} participant records...`);
  
  for (let i = 0; i < count; i++) {
    const participantData = sampleData.generateParticipantData();
    
    // Validate data
    const validation = validateParticipantData(participantData);
    if (!validation.isValid) {
      logger.warning(`Invalid participant data: ${validation.errors.join(', ')}`);
      invalidData.push({ data: participantData, errors: validation.errors });
      continue;
    }
    
    try {
      if (options.dryRun) {
        logger.dryRun(`Would create participant: ${participantData.first_name} ${participantData.last_name}`);
        createdParticipants.push({ id: `dry-run-${i}`, ...participantData });
      } else {
        const participant = await participantService.createParticipant(participantData);
        createdParticipants.push(participant);
        logger.debug(`Created participant: ${participant.first_name} ${participant.last_name} (ID: ${participant.id})`);
      }
    } catch (error) {
      logger.error(`Error creating participant: ${error.message}`);
      invalidData.push({ data: participantData, error: error.message });
    }
    
    // Show progress
    logger.progress(i + 1, count, 'Participants');
  }
  
  if (invalidData.length > 0) {
    logger.warning(`${invalidData.length} participant records failed validation`);
  }
  
  return createdParticipants;
}

/**
 * Clean existing data
 * @returns {Promise<void>}
 */
async function cleanExistingData() {
  if (!options.clean) return;
  
  logger.info('Cleaning existing data...');
  
  if (options.dryRun) {
    logger.dryRun('Would clean existing data (dry run)');
    return;
  }
  
  try {
    // Get existing staff
    const staff = await staffService.getAllStaff();
    logger.info(`Found ${staff.length} existing staff records`);
    
    // Delete each staff member
    for (let i = 0; i < staff.length; i++) {
      await staffService.deleteStaff(staff[i].id);
      logger.debug(`Deleted staff: ${staff[i].first_name} ${staff[i].last_name} (ID: ${staff[i].id})`);
      logger.progress(i + 1, staff.length, 'Cleaning Staff');
    }
    
    // Get existing participants
    const participants = await participantService.getAllParticipants();
    logger.info(`Found ${participants.length} existing participant records`);
    
    // Delete each participant
    for (let i = 0; i < participants.length; i++) {
      await participantService.deleteParticipant(participants[i].id);
      logger.debug(`Deleted participant: ${participants[i].first_name} ${participants[i].last_name} (ID: ${participants[i].id})`);
      logger.progress(i + 1, participants.length, 'Cleaning Participants');
    }
    
    logger.success('Data cleaning completed');
  } catch (error) {
    logger.error(`Error cleaning data: ${error.message}`);
    throw error;
  }
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
${colors.cyan}Sample Data Creation Script for RABS POC${colors.reset}

This script generates realistic sample data for staff and participants
to facilitate testing of the system without requiring real data.

${colors.yellow}Usage:${colors.reset}
  node create-sample-data.js [options]

${colors.yellow}Options:${colors.reset}
  --staff <number>       Number of staff records to create (default: 10)
  --participants <number> Number of participant records to create (default: 20)
  --clean                Remove existing data before creating new records
  --verbose              Show detailed logging
  --dry-run              Preview data without writing to database
  --help                 Show help
  `);
}

/**
 * Main function to run the script
 */
async function main() {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  const staffCount = parseInt(options.staff);
  const participantCount = parseInt(options.participants);
  
  logger.info(`${options.dryRun ? '[DRY RUN] ' : ''}Sample Data Creation Script`);
  logger.info(`Staff records: ${staffCount}`);
  logger.info(`Participant records: ${participantCount}`);
  
  try {
    // Clean existing data if requested
    await cleanExistingData();
    
    // Create staff records
    const staff = await createStaffRecords(staffCount);
    logger.success(`${options.dryRun ? 'Would create' : 'Created'} ${staff.length} staff records`);
    
    // Create participant records
    const participants = await createParticipantRecords(participantCount);
    logger.success(`${options.dryRun ? 'Would create' : 'Created'} ${participants.length} participant records`);
    
    // Summary
    logger.info('\n===== Data Creation Summary =====');
    logger.info(`Staff: ${staff.length}/${staffCount}`);
    logger.info(`Participants: ${participants.length}/${participantCount}`);
    
    if (options.dryRun) {
      logger.dryRun('This was a dry run. No data was written to the database.');
      logger.dryRun('Run without --dry-run to create actual records.');
    }
    
  } catch (error) {
    logger.error(`Data creation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  logger.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
