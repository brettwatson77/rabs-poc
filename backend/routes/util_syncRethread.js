/**
 * syncRethread Utility
 * 
 * Implements the synchronous rethread operation for the RABS system.
 * This utility is responsible for generating loom_instances and event_card_map
 * entries based on rules_programs and rules_program_slots.
 */

const { v4: uuidv4 } = require('uuid');

/* ------------------------------------------------------------------------ */
/*  Time-zone helpers – Australia/Sydney                                    */
/* ------------------------------------------------------------------------ */
const TZ = 'Australia/Sydney';

// Format Date → 'YYYY-MM-DD' in target TZ using ISO-like en-CA
function formatDateInTZ(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Parse 'YYYY-MM-DD' → { y,m,d }
function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return { y, m, d };
}

// Add days to a ymd string, return ymd string in TZ
function addDaysYmdTZ(ymd, days) {
  const { y, m, d } = parseYmd(ymd);
  // Use Date.UTC noon to avoid DST edge
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDateInTZ(dt);
}

// Day of week in TZ (1=Mon … 7=Sun)
const DOW_MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
function dayOfWeekInTZ(ymd) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(dt);
  return DOW_MAP[short];
}

/**
 * Helper function to get tomorrow's date in YYYY-MM-DD format
 * @returns {string} Tomorrow's date in YYYY-MM-DD format
 */
function getTomorrow() {
  const todayYmd = formatDateInTZ(new Date());
  return addDaysYmdTZ(todayYmd, 1);
}

/**
 * Helper function to check if a rule is active on a specific date
 * @param {Object} rule - The rule object from the database
 * @param {string} dateStr - The date string in YYYY-MM-DD format
 * @returns {boolean} - Whether the rule is active on the given date
 */
/**
 * Enhanced recurrence logic honouring anchor_date & recurrence_pattern
 * Accepted patterns: one_off | weekly | fortnightly | monthly | null(weekly)
 */
function isRuleActiveOnDate(rule, dateStr) {
  if (!rule || !dateStr) return false;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  // Derive weekday in Australia/Sydney TZ (1-Mon … 7-Sun)
  const dayOfWeek = dayOfWeekInTZ(dateStr);
  const anchorDate =
    rule.anchor_date && !isNaN(new Date(rule.anchor_date).getTime())
      ? new Date(rule.anchor_date)
      : null;
  const pattern = (rule.recurrence_pattern || 'weekly').toLowerCase();

  switch (pattern) {
    /* -------------------------------------------------- */
    case 'one_off':
      return anchorDate
        ? dateStr === rule.anchor_date
        : false;

    /* -------------------------------------------------- */
    case 'weekly':
      return rule.day_of_week === dayOfWeek;

    /* -------------------------------------------------- */
    case 'fortnightly': {
      if (rule.day_of_week !== dayOfWeek) return false;

      // Prefer anchor_date parity; fall back to week_in_cycle
      if (anchorDate) {
        const diffDays = Math.floor(
          (date.getTime() - anchorDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        return diffDays % 14 === 0;
      }

      if (rule.week_in_cycle !== null && rule.week_in_cycle !== undefined) {
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / 86400000);
        const weekNumber = Math.ceil((days + startOfYear.getDay()) / 7);
        const isOddWeek = weekNumber % 2 === 1;
        return (
          (rule.week_in_cycle === 1 && isOddWeek) ||
          (rule.week_in_cycle === 2 && !isOddWeek)
        );
      }

      // If no anchor or week_in_cycle, treat as weekly match
      return true;
    }

    /* -------------------------------------------------- */
    case 'monthly': {
      if (!anchorDate) return false;
      return date.getDate() === anchorDate.getDate();
    }

    /* -------------------------------------------------- */
    default:
      // Fallback to weekly behaviour
      return rule.day_of_week === dayOfWeek;
  }
}

/**
 * Generate date range array from start to end dates
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string[]} - Array of dates in YYYY-MM-DD format
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  let currentYmd = startDate;
  while (currentYmd <= endDate) {
    dates.push(currentYmd);
    currentYmd = addDaysYmdTZ(currentYmd, 1);
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
 * @param {Pool} pool - pg Pool instance provided by the caller
 * @returns {Object} - Summary of the rethread operation
 */
async function syncRethread(options = {}, pool) {
  if (!pool) {
    throw new Error('syncRethread requires a database pool');
  }
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
  const dateTo = options.dateTo || addDaysYmdTZ(dateFrom, windowDays - 1);
  
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
          // Filter that single rule by recurrence/anchor logic for this date
          const single = ruleResult.rows.length ? ruleResult.rows[0] : null;
          rules = single && isRuleActiveOnDate(single, date) ? [single] : [];
        } else {
          // Otherwise, get all active rules for this day of week
          const dayOfWeek = dayOfWeekInTZ(date);
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
