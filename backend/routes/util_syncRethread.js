/**
 * syncRethread Utility
 * 
 * Implements the synchronous rethread operation for the RABS system.
 * This utility is responsible for generating loom_instances and event_card_map
 * entries based on rules_programs and rules_program_slots.
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../database');

/**
 * Helper function to get tomorrow's date in YYYY-MM-DD format
 * @returns {string} Tomorrow's date in YYYY-MM-DD format
 */
function getTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Helper function to check if a rule is active on a specific date
 * @param {Object} rule - The rule object from the database
 * @param {string} dateStr - The date string in YYYY-MM-DD format
 * @returns {boolean} - Whether the rule is active on the given date
 */
function isRuleActiveOnDate(rule, dateStr) {
  if (!rule || !dateStr) return false;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  
  // Get day of week (1-7, where 1 is Monday)
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday (0) to 7
  
  // Check if the day of week matches
  if (rule.day_of_week !== dayOfWeek) return false;
  
  // If week_in_cycle is defined, check week parity
  if (rule.week_in_cycle !== null && rule.week_in_cycle !== undefined) {
    // Get ISO week number
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay()) / 7);
    
    // Check if week parity matches (week 1 = odd weeks, week 2 = even weeks)
    const isOddWeek = weekNumber % 2 === 1;
    return (rule.week_in_cycle === 1 && isOddWeek) || 
           (rule.week_in_cycle === 2 && !isOddWeek);
  }
  
  // If week_in_cycle is not defined, treat as weekly
  return true;
}

/**
 * Generate date range array from start to end dates
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string[]} - Array of dates in YYYY-MM-DD format
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  const lastDate = new Date(endDate);
  
  while (currentDate <= lastDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

/**
 * Synchronously rethread loom instances and event cards
 * @param {Object} options - Options for the rethread operation
 * @param {string} [options.ruleId] - Optional specific rule ID to rethread
 * @param {string} [options.dateFrom] - Start date in YYYY-MM-DD format (defaults to tomorrow)
 * @param {string} [options.dateTo] - End date in YYYY-MM-DD format (defaults to dateFrom + 14 days)
 * @param {number} [options.windowDays=14] - Number of days in the window if dateTo not provided
 * @param {boolean} [options.futureOnly=true] - Whether to clamp dateFrom to tomorrow if it's earlier
 * @returns {Object} - Summary of the rethread operation
 */
async function syncRethread(options = {}) {
  const {
    ruleId,
    windowDays = 14,
    futureOnly = true
  } = options;
  
  // Set up date range
  const tomorrow = getTomorrow();
  let dateFrom = options.dateFrom || tomorrow;
  
  // Clamp dateFrom to tomorrow if futureOnly and dateFrom is before tomorrow
  if (futureOnly && dateFrom < tomorrow) {
    dateFrom = tomorrow;
  }
  
  // Calculate dateTo if not provided
  const dateTo = options.dateTo || (() => {
    const endDate = new Date(dateFrom);
    endDate.setDate(endDate.getDate() + windowDays - 1);
    return endDate.toISOString().split('T')[0];
  })();
  
  // Generate the date range
  const dateRange = generateDateRange(dateFrom, dateTo);
  
  // Initialize summary counters
  const summary = {
    datesProcessed: 0,
    rulesTouched: 0,
    instancesUpserted: 0,
    cardsWritten: 0
  };
  
  // Process each date in the range
  for (const date of dateRange) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Get rules active on this date
        let rules;
        if (ruleId) {
          // If specific rule ID provided, use it (and ensure it's active)
          const ruleResult = await client.query(`
            SELECT * FROM rules_programs
            WHERE id = $1 AND active = true
          `, [ruleId]);
          
          rules = ruleResult.rows;
        } else {
          // Otherwise, get all active rules for this day of week
          const dayOfWeek = new Date(date).getDay() === 0 ? 7 : new Date(date).getDay();
          const rulesResult = await client.query(`
            SELECT * FROM rules_programs
            WHERE active = true AND day_of_week = $1
          `, [dayOfWeek]);
          
          // Filter rules by week_in_cycle if applicable
          rules = rulesResult.rows.filter(rule => isRuleActiveOnDate(rule, date));
        }
        
        // Skip this date if no active rules
        if (rules.length === 0) {
          continue;
        }
        
        summary.rulesTouched += rules.length;
        
        // Process each rule
        for (const rule of rules) {
          // Upsert loom_instance
          const instanceResult = await client.query(`
            INSERT INTO loom_instances (
              id, source_rule_id, instance_date, start_time, end_time, venue_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6
            )
            ON CONFLICT (source_rule_id, instance_date)
            DO UPDATE SET
              start_time = EXCLUDED.start_time,
              end_time = EXCLUDED.end_time,
              venue_id = EXCLUDED.venue_id,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `, [
            uuidv4(),
            rule.id,
            date,
            rule.start_time,
            rule.end_time,
            rule.venue_id
          ]);
          
          summary.instancesUpserted++;
          
          const instanceId = instanceResult.rows[0].id;
          
          // Delete existing event_card_map entries for this instance
          await client.query(`
            DELETE FROM event_card_map
            WHERE loom_instance_id = $1
          `, [instanceId]);
          
          // Get slots for this rule
          const slotsResult = await client.query(`
            SELECT * FROM rules_program_slots
            WHERE rule_id = $1
            ORDER BY seq
          `, [rule.id]);
          
          const slots = slotsResult.rows;
          
          // Insert new event_card_map entries
          for (const slot of slots) {
            await client.query(`
              INSERT INTO event_card_map (
                id, loom_instance_id, card_type, card_order, 
                display_title, display_subtitle, 
                display_time_start, display_time_end
              ) VALUES (
                $1, $2, $3, $4, $5, $6, 
                $7::date + $8::time, $7::date + $9::time
              )
            `, [
              uuidv4(),
              instanceId,
              slot.slot_type,
              slot.seq,
              slot.label || slot.slot_type.toUpperCase(),
              rule.name,
              date,
              slot.start_time,
              slot.end_time
            ]);
            
            summary.cardsWritten++;
          }
          
          // Apply temporary exceptions (stubbed for MVP)
          // This would involve checking rules_program_exceptions and applying them
          // For now, we just leave this as a stub
        }
        
        await client.query('COMMIT');
        summary.datesProcessed++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing date ${date}:`, err);
        // Continue with next date despite error
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Failed to get client for date ${date}:`, err);
      // Continue with next date despite error
    }
  }
  
  return summary;
}

module.exports = {
  syncRethread,
  isRuleActiveOnDate
};
