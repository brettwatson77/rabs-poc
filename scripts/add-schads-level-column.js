/**
 * Add SCHADS Level Column to Staff Table
 * 
 * This script adds a schads_level column to the staff table and populates it
 * with realistic SCHADS award levels (1-8) based on staff positions.
 * 
 * It uses OpenAI to help determine appropriate SCHADS levels for different positions.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
// New OpenAI client (v4+)
const { OpenAI } = require('openai');
require('dotenv').config();

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// Initialise OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper functions
const log = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
};

// SCHADS level mapping for common positions (fallback if OpenAI fails)
const schadsLevelMap = {
  'support worker': 2,
  'disability support worker': 2,
  'senior support worker': 3,
  'team leader': 4,
  'coordinator': 4,
  'supervisor': 5,
  'manager': 6,
  'senior manager': 7,
  'director': 8,
  'ceo': 8,
  'administrator': 3,
  'administrative assistant': 2,
  'admin': 2,
  'driver': 1,
  'care worker': 2,
  'personal care assistant': 2,
  'community support worker': 2,
  'youth worker': 3,
  'social worker': 4,
  'case manager': 4,
  'occupational therapist': 5,
  'physiotherapist': 5,
  'speech pathologist': 5,
  'psychologist': 6,
  'registered nurse': 5,
  'enrolled nurse': 4,
  'assistant nurse': 3,
  'program coordinator': 4,
  'finance officer': 4,
  'hr officer': 4,
  'it support': 3,
  'cleaner': 1,
  'maintenance': 2,
  'chef': 3,
  'kitchen hand': 1,
  'gardener': 2,
  'receptionist': 2,
  'volunteer coordinator': 3,
  'fundraising officer': 3,
  'marketing officer': 4,
  'communications officer': 4,
  'project officer': 4,
  'project manager': 5,
  'quality assurance officer': 4,
  'trainer': 4,
  'instructor': 3,
  'counsellor': 5,
  'mentor': 3,
  'advocate': 4,
  'community development officer': 4,
  'outreach worker': 3,
  'residential care worker': 3,
  'house supervisor': 4,
  'lifestyle coordinator': 3,
  'activities officer': 2,
  'recreation officer': 3,
  'transport coordinator': 3,
  'intake officer': 3,
  'assessment officer': 4,
  'ndis coordinator': 4,
  'behavior support practitioner': 5,
  'behavior support specialist': 6,
  'positive behavior support specialist': 6,
  'allied health assistant': 3,
  'therapy assistant': 2,
  'employment consultant': 3,
  'job coach': 3,
  'vocational trainer': 3,
  'skills trainer': 3,
  'education support worker': 2,
  'learning support officer': 3,
  'disability liaison officer': 4
};

// Function to determine SCHADS level using OpenAI
async function determineSchadsLevel(position) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert in the Social, Community, Home Care and Disability Services (SCHADS) Award in Australia. Your task is to determine the appropriate SCHADS level (1-8) for a given position title in a disability support organization. Level 1 is entry-level with minimal skills required, while Level 8 is for senior management with significant responsibility. Be precise and provide only the numeric level."
        },
        {
          role: "user",
          content: `What is the appropriate SCHADS level (1-8) for this position: "${position}"? Respond with only the number.`
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    });

    const level = parseInt(response.choices[0].message.content.trim());
    if (isNaN(level) || level < 1 || level > 8) {
      throw new Error(`Invalid SCHADS level: ${response.data.choices[0].message.content}`);
    }
    
    return level;
  } catch (error) {
    log(`⚠️ OpenAI API error for position "${position}": ${error.message}`);
    
    // Fallback to local mapping
    const normalizedPosition = position.toLowerCase();
    for (const [key, value] of Object.entries(schadsLevelMap)) {
      if (normalizedPosition.includes(key)) {
        log(`✅ Using fallback mapping for "${position}" → SCHADS Level ${value}`);
        return value;
      }
    }
    
    // Default fallback
    log(`⚠️ No mapping found for "${position}", using default SCHADS Level 2`);
    return 2;
  }
}

// Function to add schads_level column
async function addSchadsLevelColumn() {
  try {
    // Check if column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'staff' AND column_name = 'schads_level'
    `;
    
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      log('✅ schads_level column already exists in staff table');
    } else {
      // Add the column
      const addColumnQuery = `
        ALTER TABLE staff 
        ADD COLUMN schads_level INTEGER DEFAULT 2
      `;
      
      await pool.query(addColumnQuery);
      log('✅ Added schads_level column to staff table');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error adding schads_level column: ${error.message}`);
    return false;
  }
}

// Function to update staff with SCHADS levels
async function updateStaffSchadsLevels() {
  try {
    // Get all staff positions
    const getStaffQuery = `
      SELECT id, first_name, last_name, position 
      FROM staff
    `;
    
    const staffResult = await pool.query(getStaffQuery);
    log(`Found ${staffResult.rows.length} staff records`);
    
    // Process each staff member
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const staff of staffResult.rows) {
      try {
        if (!staff.position) {
          log(`⚠️ Skipping staff ${staff.id} (${staff.first_name} ${staff.last_name}) - no position defined`);
          skipped++;
          continue;
        }
        
        // Determine SCHADS level
        const schadsLevel = await determineSchadsLevel(staff.position);
        
        // Update staff record
        const updateQuery = `
          UPDATE staff 
          SET schads_level = $1 
          WHERE id = $2
        `;
        
        await pool.query(updateQuery, [schadsLevel, staff.id]);
        log(`✅ Updated ${staff.first_name} ${staff.last_name} (${staff.position}) → SCHADS Level ${schadsLevel}`);
        updated++;
      } catch (error) {
        log(`❌ Error updating staff ${staff.id}: ${error.message}`);
        failed++;
      }
    }
    
    return { updated, skipped, failed, total: staffResult.rows.length };
  } catch (error) {
    log(`❌ Error updating staff SCHADS levels: ${error.message}`);
    return { updated: 0, skipped: 0, failed: 0, total: 0, error: error.message };
  }
}

// Main function
async function main() {
  log('\n================================================================================');
  log('ADD SCHADS LEVEL COLUMN TO STAFF TABLE');
  log('================================================================================\n');
  
  try {
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      log('⚠️ OPENAI_API_KEY not found in environment variables');
      log('⚠️ Will use fallback mapping for SCHADS levels');
    } else {
      log('✅ OPENAI_API_KEY found in environment variables');
    }
    
    // Add schads_level column
    const columnAdded = await addSchadsLevelColumn();
    if (!columnAdded) {
      throw new Error('Failed to add schads_level column');
    }
    
    // Update staff SCHADS levels
    const updateResult = await updateStaffSchadsLevels();
    
    // Summary
    log('\n================================================================================');
    log('SUMMARY');
    log('================================================================================\n');
    
    log(`Total staff records: ${updateResult.total}`);
    log(`Updated: ${updateResult.updated}`);
    log(`Skipped: ${updateResult.skipped}`);
    log(`Failed: ${updateResult.failed}`);
    
    if (updateResult.error) {
      log(`Error: ${updateResult.error}`);
    }
    
    log('\n================================================================================');
    log('NEXT STEPS');
    log('================================================================================\n');
    
    log('1. Restart your server: cd backend && node server.js');
    log('2. Test the Roster API: node scripts/test-roster-fix.js');
    log('3. Open the Roster page in your browser');
    
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
