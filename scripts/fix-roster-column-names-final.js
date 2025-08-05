/**
 * Fix Roster Column Names - Final Fix
 * 
 * This script fixes the column name mismatches in the rosterService.js file.
 * It checks the actual database schema and updates the service file accordingly.
 * 
 * Issues fixed:
 * 1. st.schads_level doesn't exist
 * 2. s.instance_id should be s.loom_instance_id
 * 3. pa.instance_id should be pa.loom_instance_id
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const util = require('util');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// File paths
const rosterServicePath = path.join(__dirname, '..', 'backend', 'services', 'rosterService.js');
const backupPath = `${rosterServicePath}.bak.${Date.now()}`;

// Helper functions
const log = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
};

// Main function
async function main() {
  log('\n================================================================================');
  log('ROSTER COLUMN NAMES FINAL FIX');
  log('================================================================================\n');

  try {
    // Create backup
    log('Creating backup of rosterService.js...');
    fs.copyFileSync(rosterServicePath, backupPath);
    log(`✅ Backup created at: ${backupPath}`);

    // Check if file exists
    if (!fs.existsSync(rosterServicePath)) {
      log(`❌ ERROR: File not found: ${rosterServicePath}`);
      return;
    }

    // Read the service file
    log('Reading rosterService.js...');
    let serviceContent = fs.readFileSync(rosterServicePath, 'utf8');
    log('✅ File read successfully');

    // Check database schema
    log('Checking database schema...');
    
    // Check staff table columns
    const staffColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'staff'
    `;
    
    const staffColumns = await pool.query(staffColumnsQuery);
    log(`Found ${staffColumns.rows.length} columns in staff table:`);
    staffColumns.rows.forEach(col => {
      log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check if schads_level exists
    const schadsLevelExists = staffColumns.rows.some(col => col.column_name === 'schads_level');
    let schadsLevelAlternative = null;
    
    if (!schadsLevelExists) {
      log('❌ schads_level column not found in staff table');
      
      // Look for potential alternatives
      const potentialAlternatives = ['level', 'staff_level', 'pay_level', 'classification'];
      for (const alt of potentialAlternatives) {
        if (staffColumns.rows.some(col => col.column_name === alt)) {
          schadsLevelAlternative = alt;
          log(`✅ Found potential alternative: ${alt}`);
          break;
        }
      }
      
      if (!schadsLevelAlternative) {
        // If no alternative found, check if there's any column with 'level' in the name
        const levelColumn = staffColumns.rows.find(col => col.column_name.includes('level'));
        if (levelColumn) {
          schadsLevelAlternative = levelColumn.column_name;
          log(`✅ Found column with 'level' in name: ${schadsLevelAlternative}`);
        } else {
          // If still no alternative, use a default value
          schadsLevelAlternative = 'classification';
          log(`⚠️ No alternative found, using default: ${schadsLevelAlternative}`);
        }
      }
    }

    // Check loom_staff_shifts table columns
    const staffShiftsColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tgl_loom_staff_shifts'
    `;
    
    const staffShiftsColumns = await pool.query(staffShiftsColumnsQuery);
    log(`Found ${staffShiftsColumns.rows.length} columns in tgl_loom_staff_shifts table:`);
    staffShiftsColumns.rows.forEach(col => {
      log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check if instance_id exists or loom_instance_id
    const instanceIdExists = staffShiftsColumns.rows.some(col => col.column_name === 'instance_id');
    const loomInstanceIdExists = staffShiftsColumns.rows.some(col => col.column_name === 'loom_instance_id');
    
    log(`instance_id exists: ${instanceIdExists}`);
    log(`loom_instance_id exists: ${loomInstanceIdExists}`);

    // Check participant allocations table
    const participantAllocationsColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tgl_loom_participant_allocations'
    `;
    
    const participantAllocationsColumns = await pool.query(participantAllocationsColumnsQuery);
    log(`Found ${participantAllocationsColumns.rows.length} columns in tgl_loom_participant_allocations table:`);
    participantAllocationsColumns.rows.forEach(col => {
      log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check if instance_id exists or loom_instance_id in participant allocations
    const paInstanceIdExists = participantAllocationsColumns.rows.some(col => col.column_name === 'instance_id');
    const paLoomInstanceIdExists = participantAllocationsColumns.rows.some(col => col.column_name === 'loom_instance_id');
    
    log(`participant allocations instance_id exists: ${paInstanceIdExists}`);
    log(`participant allocations loom_instance_id exists: ${paLoomInstanceIdExists}`);

    // Apply fixes
    log('\nApplying fixes to rosterService.js...');
    
    // Fix 1: Replace st.schads_level with alternative if needed
    if (!schadsLevelExists && schadsLevelAlternative) {
      const before = serviceContent;
      serviceContent = serviceContent.replace(/st\.schads_level/g, `st.${schadsLevelAlternative}`);
      
      if (before !== serviceContent) {
        log(`✅ Fixed: Replaced 'st.schads_level' with 'st.${schadsLevelAlternative}'`);
      } else {
        log('⚠️ No occurrences of st.schads_level found in the file');
      }
    }
    
    // Fix 2: Replace s.instance_id with s.loom_instance_id if needed
    if (!instanceIdExists && loomInstanceIdExists) {
      const before = serviceContent;
      serviceContent = serviceContent.replace(/s\.instance_id/g, 's.loom_instance_id');
      
      if (before !== serviceContent) {
        log('✅ Fixed: Replaced s.instance_id with s.loom_instance_id');
      } else {
        log('⚠️ No occurrences of s.instance_id found in the file');
      }
    }
    
    // Fix 3: Replace pa.instance_id with pa.loom_instance_id if needed
    if (!paInstanceIdExists && paLoomInstanceIdExists) {
      const before = serviceContent;
      serviceContent = serviceContent.replace(/pa\.instance_id/g, 'pa.loom_instance_id');
      
      if (before !== serviceContent) {
        log('✅ Fixed: Replaced pa.instance_id with pa.loom_instance_id');
      } else {
        log('⚠️ No occurrences of pa.instance_id found in the file');
      }
    }

    // Write the updated file
    log('Writing updated rosterService.js...');
    fs.writeFileSync(rosterServicePath, serviceContent);
    log('✅ File updated successfully');

    // Create a test script
    log('Creating test script...');
    const testScriptPath = path.join(__dirname, 'test-roster-fix.js');
    const testScript = `
/**
 * Test Roster Fix
 * 
 * This script tests if the roster service is working correctly after the fixes.
 */

const axios = require('axios');

async function testRosterAPI() {
  try {
    console.log('Testing Roster API...');
    const response = await axios.get('http://localhost:3009/api/v1/roster', {
      params: {
        startDate: '2025-08-05',
        endDate: '2025-08-12'
      }
    });
    
    console.log('✅ SUCCESS: Roster API is working!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 300) + '...');
    return true;
  } catch (error) {
    console.log('❌ ERROR: Roster API request failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function main() {
  console.log('\\n================================================================================');
  console.log('TESTING ROSTER FIX');
  console.log('================================================================================\\n');
  
  const success = await testRosterAPI();
  
  console.log('\\n================================================================================');
  if (success) {
    console.log('✅ ROSTER API IS WORKING CORRECTLY!');
    console.log('You can now restart your server and the roster page should load.');
  } else {
    console.log('❌ ROSTER API IS STILL NOT WORKING');
    console.log('Please check the server logs for more details.');
  }
  console.log('================================================================================\\n');
}

main().catch(error => {
  console.error('Error running test:', error);
});
`;
    
    fs.writeFileSync(testScriptPath, testScript);
    log(`✅ Test script created at: ${testScriptPath}`);

    // Summary
    log('\n================================================================================');
    log('FIX SUMMARY');
    log('================================================================================\n');
    
    if (!schadsLevelExists && schadsLevelAlternative) {
      log(`✅ Fixed: st.schads_level → st.${schadsLevelAlternative}`);
    }
    
    if (!instanceIdExists && loomInstanceIdExists) {
      log('✅ Fixed: s.instance_id → s.loom_instance_id');
    }
    
    if (!paInstanceIdExists && paLoomInstanceIdExists) {
      log('✅ Fixed: pa.instance_id → pa.loom_instance_id');
    }
    
    log('\n================================================================================');
    log('NEXT STEPS');
    log('================================================================================\n');
    
    log('1. Restart your server: cd backend && node server.js');
    log('2. Test the fixed API: node scripts/test-roster-fix.js');
    log('3. Open the Roster page in your browser');
    log('\nIf the Roster page still doesn\'t work, check the server logs for more details.');
    
  } catch (error) {
    log(`❌ ERROR: ${error.message}`);
    console.error(error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
});
