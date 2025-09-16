#!/usr/bin/env node
/**
 * Test Loom Roller Service
 * 
 * This script tests the loom roller service by:
 * 1. Creating test data (program, participants, staff, vehicles)
 * 2. Running the roller functions manually
 * 3. Verifying the results
 * 4. Cleaning up (optional)
 * 
 * Usage:
 *   node scripts/test-loom-roller.js [--cleanup] [--verbose]
 * 
 * Options:
 *   --cleanup  Remove test data after running
 *   --verbose  Show detailed logs
 */

const { pool } = require('../backend/database');
const {
  dailyRoll,
  verifyDailyRoll,
  generateMissingInstances,
  applyOperatorIntents,
  applyTemporalExceptions,
  assignResources
} = require('../backend/services/loomRoller');
const { formatDateForDb, getTodaySydney, addDays, addWeeks } = require('../backend/utils/dateUtils');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldCleanup = args.includes('--cleanup');
const verbose = args.includes('--verbose');

// Test data identifiers
const TEST_PREFIX = 'LOOM_TEST_';
let testProgramId;
let testParticipantIds = [];
let testStaffIds = [];
let testVehicleId;
let testVenueId;
let testBillingCodeId;

/**
 * Log helper that respects verbose flag
 */
function log(message, always = false) {
  if (verbose || always) {
    console.log(message);
  }
}

/**
 * Create test data for loom roller testing
 */
async function setupTestData(client) {
  log('Creating test data...', true);

  // Create test venue
  const venueResult = await client.query(`
    INSERT INTO venues (name, address, capacity, is_active)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [`${TEST_PREFIX}Venue`, '123 Test St', 20, true]);
  
  testVenueId = venueResult.rows[0].id;
  log(`Created test venue: ${testVenueId}`);

  // Create test billing code
  const billingResult = await client.query(`
    INSERT INTO billing_codes (code, description, rate, is_active)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, ['04_102_0136_6_1', 'Test Billing Code', 22.52, true]);
  
  testBillingCodeId = billingResult.rows[0].id;
  log(`Created test billing code: ${testBillingCodeId}`);

  // Create test program
  const today = getTodaySydney();
  const todayFormatted = formatDateForDb(today);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const programResult = await client.query(`
    INSERT INTO programs (
      name, description, start_date, days_of_week, 
      start_time, end_time, venue_id, capacity, 
      is_active, requires_transport
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `, [
    `${TEST_PREFIX}Program`, 
    'Test program for loom roller', 
    todayFormatted,
    dayOfWeek.toString(), // Run on today's day of week
    '09:00', 
    '15:00', 
    testVenueId, 
    10, 
    true,
    true
  ]);
  
  testProgramId = programResult.rows[0].id;
  log(`Created test program: ${testProgramId} running on day ${dayOfWeek} (today)`);

  // Create test participants (5)
  for (let i = 1; i <= 5; i++) {
    const participantResult = await client.query(`
      INSERT INTO participants (
        first_name, last_name, ndis_number, is_active
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      `${TEST_PREFIX}First${i}`,
      `${TEST_PREFIX}Last${i}`,
      `TEST${i}00000`,
      true
    ]);
    
    const participantId = participantResult.rows[0].id;
    testParticipantIds.push(participantId);
    
    // Add participant to program
    await client.query(`
      INSERT INTO program_participants (
        program_id, participant_id, billing_code_id, hours, is_active
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      testProgramId,
      participantId,
      testBillingCodeId,
      6.0, // 6 hours
      true
    ]);
  }
  log(`Created ${testParticipantIds.length} test participants and added to program`);

  // Create test staff (2 - 1 lead, 1 support)
  for (let i = 1; i <= 2; i++) {
    const isLead = i === 1;
    const staffResult = await client.query(`
      INSERT INTO staff (
        first_name, last_name, email, phone, is_active, can_lead
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      `${TEST_PREFIX}Staff${i}`,
      `${TEST_PREFIX}Last${i}`,
      `test${i}@example.com`,
      `0400000${i}00`,
      true,
      isLead
    ]);
    
    testStaffIds.push(staffResult.rows[0].id);
  }
  log(`Created ${testStaffIds.length} test staff (1 lead, 1 support)`);

  // Create test vehicle
  const vehicleResult = await client.query(`
    INSERT INTO vehicles (
      name, registration, capacity, is_active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [
    `${TEST_PREFIX}Vehicle`,
    'TEST123',
    8, // Capacity for 8 passengers
    true
  ]);
  
  testVehicleId = vehicleResult.rows[0].id;
  log(`Created test vehicle: ${testVehicleId}`);

  // Set window size to 4 weeks
  await client.query(`
    INSERT INTO settings (key, value, description)
    VALUES ('loom_window_weeks', '4', 'Loom window size in weeks')
    ON CONFLICT (key) DO UPDATE SET value = '4'
  `);
  log('Set loom window size to 4 weeks');

  log('Test data setup complete', true);
}

/**
 * Clean up test data
 */
async function cleanupTestData(client) {
  log('Cleaning up test data...', true);

  // Delete test program participants
  await client.query(`
    DELETE FROM program_participants
    WHERE program_id = $1
  `, [testProgramId]);

  // Delete test loom instances and related data
  await client.query(`
    DELETE FROM tgl_loom_vehicle_runs
    WHERE instance_id IN (
      SELECT id FROM tgl_loom_instances
      WHERE program_id = $1
    )
  `, [testProgramId]);

  await client.query(`
    DELETE FROM tgl_loom_staff_shifts
    WHERE instance_id IN (
      SELECT id FROM tgl_loom_instances
      WHERE program_id = $1
    )
  `, [testProgramId]);

  await client.query(`
    DELETE FROM tgl_loom_participant_allocations
    WHERE instance_id IN (
      SELECT id FROM tgl_loom_instances
      WHERE program_id = $1
    )
  `, [testProgramId]);

  await client.query(`
    DELETE FROM tgl_loom_instances
    WHERE program_id = $1
  `, [testProgramId]);

  // Delete test program
  await client.query(`DELETE FROM programs WHERE id = $1`, [testProgramId]);

  // Delete test participants
  for (const id of testParticipantIds) {
    await client.query(`DELETE FROM participants WHERE id = $1`, [id]);
  }

  // Delete test staff
  for (const id of testStaffIds) {
    await client.query(`DELETE FROM staff WHERE id = $1`, [id]);
  }

  // Delete test vehicle
  await client.query(`DELETE FROM vehicles WHERE id = $1`, [testVehicleId]);

  // Delete test venue
  await client.query(`DELETE FROM venues WHERE id = $1`, [testVenueId]);

  // Delete test billing code
  await client.query(`DELETE FROM billing_codes WHERE id = $1`, [testBillingCodeId]);

  // Delete test audit logs
  await client.query(`
    DELETE FROM tgl_loom_audit_log
    WHERE details::text LIKE '%${TEST_PREFIX}%'
  `);

  log('Test data cleanup complete', true);
}

/**
 * Test the daily roll function
 */
async function testDailyRoll() {
  console.log('\n=== Testing Daily Roll ===');
  
  try {
    const result = await dailyRoll();
    
    if (result.success) {
      console.log('✅ Daily roll completed successfully');
      console.log(`   Date: ${result.date}`);
      console.log(`   Window end: ${result.windowEnd}`);
      console.log(`   New instances: ${result.stats.newInstances}`);
      console.log(`   Intents applied: ${result.stats.intentsApplied}`);
      console.log(`   Exceptions applied: ${result.stats.exceptionsApplied}`);
      console.log(`   Resources assigned: ${result.stats.resourcesAssigned}`);
      console.log(`   Instances purged: ${result.stats.purgedCount}`);
      return true;
    } else {
      console.error('❌ Daily roll failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error during daily roll:', error.message);
    return false;
  }
}

/**
 * Test the verification function
 */
async function testVerification() {
  console.log('\n=== Testing Verification ===');
  
  try {
    const result = await verifyDailyRoll();
    
    if (result.success) {
      console.log('✅ Verification passed');
      console.log(`   Date: ${result.date}`);
      console.log(`   Expected programs: ${result.expectedPrograms}`);
      console.log(`   Actual instances: ${result.actualInstances}`);
      console.log(`   Last roll status: ${result.lastRollStatus}`);
      console.log(`   Last roll time: ${result.lastRollTime}`);
      return true;
    } else {
      console.error('❌ Verification failed:', result.error || 'Mismatch in expected vs. actual instances');
      console.log(`   Expected programs: ${result.expectedPrograms || 'unknown'}`);
      console.log(`   Actual instances: ${result.actualInstances || 'unknown'}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    return false;
  }
}

/**
 * Test operator intent application
 */
async function testOperatorIntents(client) {
  console.log('\n=== Testing Operator Intents ===');
  
  try {
    // Create a test intent to add a participant to tomorrow's program
    const tomorrow = addDays(getTodaySydney(), 1);
    const tomorrowFormatted = formatDateForDb(tomorrow);
    
    // Get tomorrow's day of week
    const tomorrowDayOfWeek = tomorrow.getDay();
    
    // Update program to run on tomorrow as well
    await client.query(`
      UPDATE programs 
      SET days_of_week = days_of_week || ',' || $1 
      WHERE id = $2
    `, [tomorrowDayOfWeek, testProgramId]);
    
    log(`Updated program to run on day ${tomorrowDayOfWeek} (tomorrow) as well`);
    
    // Create a new participant for the intent
    const intentParticipantResult = await client.query(`
      INSERT INTO participants (
        first_name, last_name, ndis_number, is_active
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      `${TEST_PREFIX}IntentParticipant`,
      `${TEST_PREFIX}Last`,
      `TESTINTENT00000`,
      true
    ]);
    
    const intentParticipantId = intentParticipantResult.rows[0].id;
    testParticipantIds.push(intentParticipantId);
    log(`Created intent test participant: ${intentParticipantId}`);
    
    // Create an intent to add this participant tomorrow
    const intentResult = await client.query(`
      INSERT INTO tgl_operator_intents (
        intent_type, program_id, participant_id, start_date,
        billing_code_id, hours
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      'ADD_PARTICIPANT',
      testProgramId,
      intentParticipantId,
      tomorrowFormatted,
      testBillingCodeId,
      6.0
    ]);
    
    const intentId = intentResult.rows[0].id;
    console.log(`✅ Created operator intent: ${intentId} to add participant to tomorrow's program`);
    
    // Generate tomorrow's instances
    await generateMissingInstances(client, tomorrow);
    console.log('✅ Generated instances for tomorrow');
    
    // Apply the intent
    const intentsApplied = await applyOperatorIntents(client, tomorrow);
    console.log(`✅ Applied ${intentsApplied} operator intents for tomorrow`);
    
    // Verify the intent was applied
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM tgl_loom_participant_allocations a
      JOIN tgl_loom_instances i ON a.instance_id = i.id
      WHERE i.program_id = $1
      AND i.date = $2
      AND a.participant_id = $3
    `, [testProgramId, tomorrowFormatted, intentParticipantId]);
    
    const count = parseInt(verifyResult.rows[0].count, 10);
    
    if (count > 0) {
      console.log('✅ Intent successfully applied - participant added to tomorrow\'s instance');
      return true;
    } else {
      console.error('❌ Intent application failed - participant not found in tomorrow\'s instance');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing operator intents:', error.message);
    return false;
  }
}

/**
 * Test resource assignment
 */
async function testResourceAssignment(client) {
  console.log('\n=== Testing Resource Assignment ===');
  
  try {
    const today = getTodaySydney();
    const todayFormatted = formatDateForDb(today);
    
    // Get instance ID for today's program
    const instanceResult = await client.query(`
      SELECT id FROM tgl_loom_instances
      WHERE program_id = $1 AND date = $2
    `, [testProgramId, todayFormatted]);
    
    if (instanceResult.rows.length === 0) {
      console.error('❌ No instance found for today');
      return false;
    }
    
    const instanceId = instanceResult.rows[0].id;
    log(`Found instance: ${instanceId}`);
    
    // Assign resources
    await assignResources(client, today);
    console.log('✅ Resource assignment function executed');
    
    // Verify staff assignment
    const staffResult = await client.query(`
      SELECT s.id, s.first_name, ss.role
      FROM tgl_loom_staff_shifts ss
      JOIN staff s ON ss.staff_id = s.id
      WHERE ss.instance_id = $1
    `, [instanceId]);
    
    if (staffResult.rows.length > 0) {
      console.log(`✅ Staff assigned to instance: ${staffResult.rows.length} staff members`);
      staffResult.rows.forEach(staff => {
        log(`   - ${staff.first_name} (${staff.role})`);
      });
    } else {
      console.error('❌ No staff assigned to instance');
    }
    
    // Verify vehicle assignment
    const vehicleResult = await client.query(`
      SELECT v.id, v.name, vr.passenger_count
      FROM tgl_loom_vehicle_runs vr
      JOIN vehicles v ON vr.vehicle_id = v.id
      WHERE vr.instance_id = $1
    `, [instanceId]);
    
    if (vehicleResult.rows.length > 0) {
      console.log(`✅ Vehicle assigned to instance: ${vehicleResult.rows[0].name}`);
      log(`   - Passenger count: ${vehicleResult.rows[0].passenger_count}`);
    } else {
      console.error('❌ No vehicle assigned to instance');
    }
    
    // Check instance status
    const statusResult = await client.query(`
      SELECT status FROM tgl_loom_instances
      WHERE id = $1
    `, [instanceId]);
    
    console.log(`✅ Instance status: ${statusResult.rows[0].status}`);
    
    return staffResult.rows.length > 0 && vehicleResult.rows.length > 0;
  } catch (error) {
    console.error('❌ Error testing resource assignment:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Loom Roller Test Script ===');
  console.log(`Cleanup after test: ${shouldCleanup ? 'Yes' : 'No'}`);
  console.log(`Verbose logging: ${verbose ? 'Yes' : 'No'}`);
  
  const client = await pool.connect();
  let success = false;
  
  try {
    await client.query('BEGIN');
    
    // Setup test data
    await setupTestData(client);
    
    // Test daily roll
    const dailyRollSuccess = await testDailyRoll();
    
    // Test verification
    const verificationSuccess = await testVerification();
    
    // Test operator intents
    const intentsSuccess = await testOperatorIntents(client);
    
    // Test resource assignment
    const resourceSuccess = await testResourceAssignment(client);
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Daily Roll: ${dailyRollSuccess ? '✅ Passed' : '❌ Failed'}`);
    console.log(`Verification: ${verificationSuccess ? '✅ Passed' : '❌ Failed'}`);
    console.log(`Operator Intents: ${intentsSuccess ? '✅ Passed' : '❌ Failed'}`);
    console.log(`Resource Assignment: ${resourceSuccess ? '✅ Passed' : '❌ Failed'}`);
    
    success = dailyRollSuccess && verificationSuccess && intentsSuccess && resourceSuccess;
    console.log(`\nOverall: ${success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (shouldCleanup) {
      await cleanupTestData(client);
    } else {
      console.log('\nTest data has been kept in the database.');
      console.log('To clean up later, run with --cleanup flag.');
    }
    
    // Commit if not cleaning up, to keep the test data
    if (!shouldCleanup) {
      await client.query('COMMIT');
    } else {
      // For cleanup, we've already done everything inside the transaction
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during tests:', error.message);
    success = false;
  } finally {
    client.release();
  }
  
  return success;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
