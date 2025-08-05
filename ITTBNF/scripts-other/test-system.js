// test-system.js
/**
 * System Test Script for RABS POC
 * 
 * This script tests the core functionality of the RABS POC system:
 * 1. Database connection
 * 2. Table existence (participants, staff, vehicles, venues)
 * 3. Creating a sample participant with boolean flags
 * 4. Creating a sample staff member
 * 5. Creating a sample vehicle
 * 
 * Run with: node test-system.js
 */

const { pool } = require('./backend/database');
const { v4: uuidv4 } = require('uuid');

// Test IDs to track and clean up test records
const TEST_IDS = {
  participant: null,
  staff: null,
  vehicle: null,
  venue: null
};

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 RABS POC System Tests');
  console.log('=======================');
  
  try {
    // Test 1: Database Connection
    await testDatabaseConnection();
    
    // Test 2: Table Existence
    await testTableExistence();
    
    // Test 3: Create Participant with Boolean Flags
    await testCreateParticipant();
    
    // Test 4: Create Staff Member
    await testCreateStaff();
    
    // Test 5: Create Vehicle
    await testCreateVehicle();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  } finally {
    // Clean up test data
    await cleanupTestData();
    
    // Close database connection
    await pool.end();
    console.log('\n🧹 Test cleanup complete. Database connection closed.');
  }
}

/**
 * Test 1: Database Connection
 */
async function testDatabaseConnection() {
  try {
    console.log('\n🔍 Testing database connection...');
    const result = await pool.query('SELECT NOW() as now');
    console.log(`✅ Database connection successful! Server time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

/**
 * Test 2: Table Existence
 */
async function testTableExistence() {
  const requiredTables = ['participants', 'staff', 'vehicles', 'venues'];
  
  try {
    console.log('\n🔍 Testing table existence...');
    
    for (const table of requiredTables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);
      
      const exists = result.rows[0].exists;
      
      if (exists) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        throw new Error(`Table '${table}' does not exist`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Table existence test failed:', error.message);
    throw error;
  }
}

/**
 * Test 3: Create Participant with Boolean Flags
 */
async function testCreateParticipant() {
  try {
    console.log('\n🔍 Testing participant creation with boolean flags...');
    
    // Generate a unique test participant
    const testParticipant = {
      first_name: 'Test',
      last_name: `Participant-${Date.now()}`,
      address: '123 Test St',
      suburb: 'Testville',
      state: 'NSW',
      postcode: '2000',
      phone: '0400000000',
      email: `test-${Date.now()}@example.com`,
      ndis_number: `NDIS-${Date.now()}`,
      plan_management_type: 'agency_managed',
      supervision_multiplier: 1.25,
      mobility_needs: 'Test mobility needs',
      allergies: 'Test allergies',
      medication_needs: 'Test medication needs',
      has_behavior_support_plan: true,
      has_wheelchair_access: true,
      has_dietary_requirements: true,
      has_medical_requirements: false,
      has_behavioral_support: true,
      has_visual_impairment: false,
      has_hearing_impairment: false,
      has_cognitive_support: true,
      has_communication_needs: false,
      notes: 'Test participant created by system test'
    };
    
    // Insert the test participant
    const result = await pool.query(`
      INSERT INTO participants (
        first_name, last_name, address, suburb, state, postcode,
        phone, email, ndis_number, plan_management_type,
        supervision_multiplier, mobility_needs, allergies, medication_needs,
        has_behavior_support_plan, has_wheelchair_access, has_dietary_requirements,
        has_medical_requirements, has_behavioral_support, has_visual_impairment,
        has_hearing_impairment, has_cognitive_support, has_communication_needs,
        notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING id
    `, [
      testParticipant.first_name, testParticipant.last_name, 
      testParticipant.address, testParticipant.suburb, 
      testParticipant.state, testParticipant.postcode,
      testParticipant.phone, testParticipant.email, 
      testParticipant.ndis_number, testParticipant.plan_management_type,
      testParticipant.supervision_multiplier, testParticipant.mobility_needs, 
      testParticipant.allergies, testParticipant.medication_needs,
      testParticipant.has_behavior_support_plan, testParticipant.has_wheelchair_access, 
      testParticipant.has_dietary_requirements, testParticipant.has_medical_requirements, 
      testParticipant.has_behavioral_support, testParticipant.has_visual_impairment,
      testParticipant.has_hearing_impairment, testParticipant.has_cognitive_support, 
      testParticipant.has_communication_needs, testParticipant.notes
    ]);
    
    TEST_IDS.participant = result.rows[0].id;
    
    // Verify the participant was created with correct boolean flags
    const verifyResult = await pool.query(`
      SELECT 
        has_wheelchair_access, has_dietary_requirements,
        has_medical_requirements, has_behavioral_support,
        has_visual_impairment, has_hearing_impairment,
        has_cognitive_support, has_communication_needs
      FROM participants 
      WHERE id = $1
    `, [TEST_IDS.participant]);
    
    const participant = verifyResult.rows[0];
    
    // Verify boolean flags match what we set
    if (
      participant.has_wheelchair_access !== testParticipant.has_wheelchair_access ||
      participant.has_dietary_requirements !== testParticipant.has_dietary_requirements ||
      participant.has_medical_requirements !== testParticipant.has_medical_requirements ||
      participant.has_behavioral_support !== testParticipant.has_behavioral_support ||
      participant.has_visual_impairment !== testParticipant.has_visual_impairment ||
      participant.has_hearing_impairment !== testParticipant.has_hearing_impairment ||
      participant.has_cognitive_support !== testParticipant.has_cognitive_support ||
      participant.has_communication_needs !== testParticipant.has_communication_needs
    ) {
      throw new Error('Boolean flags do not match expected values');
    }
    
    console.log(`✅ Participant created successfully with ID: ${TEST_IDS.participant}`);
    console.log('✅ Boolean flags verified correctly');
    
    return true;
  } catch (error) {
    console.error('❌ Participant creation test failed:', error.message);
    throw error;
  }
}

/**
 * Test 4: Create Staff Member
 */
async function testCreateStaff() {
  try {
    console.log('\n🔍 Testing staff creation...');
    
    // Generate a unique test staff member
    const testStaff = {
      first_name: 'Test',
      last_name: `Staff-${Date.now()}`,
      position: 'Support Worker',
      address: '456 Test Ave',
      suburb: 'Testville',
      state: 'NSW',
      postcode: '2000',
      phone: '0400000001',
      email: `staff-${Date.now()}@example.com`,
      active: true
    };
    
    // Insert the test staff member
    const result = await pool.query(`
      INSERT INTO staff (
        first_name, last_name, position, address, suburb,
        state, postcode, phone, email, active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id
    `, [
      testStaff.first_name, testStaff.last_name, 
      testStaff.position, testStaff.address, 
      testStaff.suburb, testStaff.state, 
      testStaff.postcode, testStaff.phone, 
      testStaff.email, testStaff.active
    ]);
    
    TEST_IDS.staff = result.rows[0].id;
    
    // Verify the staff member was created with correct position
    const verifyResult = await pool.query(`
      SELECT position FROM staff WHERE id = $1
    `, [TEST_IDS.staff]);
    
    if (verifyResult.rows[0].position !== testStaff.position) {
      throw new Error('Staff position does not match expected value');
    }
    
    console.log(`✅ Staff member created successfully with ID: ${TEST_IDS.staff}`);
    console.log(`✅ Position field verified correctly: "${testStaff.position}"`);
    
    return true;
  } catch (error) {
    console.error('❌ Staff creation test failed:', error.message);
    throw error;
  }
}

/**
 * Test 5: Create Vehicle
 */
async function testCreateVehicle() {
  try {
    console.log('\n🔍 Testing vehicle creation...');
    
    // Generate a unique test vehicle
    const testVehicle = {
      name: `Test Vehicle ${Date.now()}`,
      registration: `TEST${Date.now().toString().slice(-3)}`,
      capacity: 8,
      wheelchair_capacity: 2,
      make: 'Toyota',
      model: 'HiAce',
      year: 2023,
      active: true,
      notes: 'Test vehicle created by system test'
    };
    
    // Insert the test vehicle
    const result = await pool.query(`
      INSERT INTO vehicles (
        name, registration, capacity, wheelchair_capacity,
        make, model, year, active, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id
    `, [
      testVehicle.name, testVehicle.registration, 
      testVehicle.capacity, testVehicle.wheelchair_capacity,
      testVehicle.make, testVehicle.model, 
      testVehicle.year, testVehicle.active, 
      testVehicle.notes
    ]);
    
    TEST_IDS.vehicle = result.rows[0].id;
    
    // Verify the vehicle was created with correct capacity
    const verifyResult = await pool.query(`
      SELECT capacity, wheelchair_capacity FROM vehicles WHERE id = $1
    `, [TEST_IDS.vehicle]);
    
    const vehicle = verifyResult.rows[0];
    
    if (
      vehicle.capacity !== testVehicle.capacity ||
      vehicle.wheelchair_capacity !== testVehicle.wheelchair_capacity
    ) {
      throw new Error('Vehicle capacity values do not match expected values');
    }
    
    console.log(`✅ Vehicle created successfully with ID: ${TEST_IDS.vehicle}`);
    console.log(`✅ Capacity fields verified correctly: ${testVehicle.capacity} seats, ${testVehicle.wheelchair_capacity} wheelchair spots`);
    
    return true;
  } catch (error) {
    console.error('❌ Vehicle creation test failed:', error.message);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete test participant if created
    if (TEST_IDS.participant) {
      await pool.query('DELETE FROM participants WHERE id = $1', [TEST_IDS.participant]);
      console.log(`✅ Test participant deleted: ${TEST_IDS.participant}`);
    }
    
    // Delete test staff if created
    if (TEST_IDS.staff) {
      await pool.query('DELETE FROM staff WHERE id = $1', [TEST_IDS.staff]);
      console.log(`✅ Test staff member deleted: ${TEST_IDS.staff}`);
    }
    
    // Delete test vehicle if created
    if (TEST_IDS.vehicle) {
      await pool.query('DELETE FROM vehicles WHERE id = $1', [TEST_IDS.vehicle]);
      console.log(`✅ Test vehicle deleted: ${TEST_IDS.vehicle}`);
    }
    
    // Delete test venue if created
    if (TEST_IDS.venue) {
      await pool.query('DELETE FROM venues WHERE id = $1', [TEST_IDS.venue]);
      console.log(`✅ Test venue deleted: ${TEST_IDS.venue}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    return false;
  }
}

// Run the tests
runTests();
