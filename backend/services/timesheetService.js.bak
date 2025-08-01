/**
 * timesheetService.js
 * 
 * Service for generating staff timesheets in various formats (Xero, MYOB, etc.)
 * Handles SCHADS award rates, penalty calculations, and proper CSV formatting
 * for payroll integration.
 */

const { getDbConnection } = require('../database');
const { pool } = require('../database'); // For PostgreSQL (TGL architecture)
const fs = require('fs');
const path = require('path');

// Australian public holidays for 2025-2026
// In production, this would come from an API or database
const PUBLIC_HOLIDAYS = [
  '2025-01-01', // New Year's Day
  '2025-01-26', // Australia Day
  '2025-04-18', // Good Friday
  '2025-04-21', // Easter Monday
  '2025-04-25', // Anzac Day
  '2025-06-09', // King's Birthday
  '2025-10-06', // Labour Day
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
  '2026-01-01', // New Year's Day
];

/**
 * Generate timesheet CSV for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} format - Export format (xero, myob, etc.)
 * @returns {Promise<string>} CSV data as string
 */
async function generateTimesheetCsv(startDate, endDate, format = 'xero') {
  try {
    // Get all staff assignments for the date range
    const assignments = await getStaffAssignments(startDate, endDate);
    
    // Group assignments by staff member
    const staffAssignments = groupAssignmentsByStaff(assignments);
    
    // Calculate hours and pay for each staff member
    const timesheetData = await calculateTimesheetData(staffAssignments, startDate, endDate);
    
    // Format the data according to the specified export format
    const csvData = formatTimesheetCsv(timesheetData, format);
    
    return csvData;
  } catch (error) {
    console.error('Error generating timesheet CSV:', error);
    throw error;
  }
}

/**
 * Get all staff assignments for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Staff assignments
 */
async function getStaffAssignments(startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      // TGL architecture query (PostgreSQL)
      const query = `
        SELECT 
          lsa.id AS assignment_id,
          lsa.staff_id,
          s.first_name,
          s.last_name,
          s.schads_level,
          s.base_rate,
          s.apply_penalty_rates,
          s.payroll_id,
          li.date,
          lsa.start_time,
          lsa.end_time,
          lsa.role,
          lsa.assignment_type,
          EXTRACT(EPOCH FROM (lsa.end_time - lsa.start_time)) / 3600 as hours_worked
        FROM loom_staff_assignments lsa
        JOIN staff s ON lsa.staff_id = s.id
        JOIN loom_instances li ON lsa.instance_id = li.id
        WHERE li.date BETWEEN $1 AND $2
        ORDER BY s.id, li.date, lsa.start_time
      `;
      
      const result = await pool.query(query, [startDate, endDate]);
      return result.rows;
    } catch (pgError) {
      // Fall back to SQLite query (legacy system)
      const db = await getDbConnection();
      
      const query = `
        SELECT 
          sa.id AS assignment_id,
          sa.staff_id,
          s.first_name,
          s.last_name,
          s.schads_level,
          s.base_rate,
          s.apply_penalty_rates,
          s.payroll_id,
          pi.date,
          sa.start_time,
          sa.end_time,
          sa.role,
          sa.assignment_type,
          (julianday(sa.end_time) - julianday(sa.start_time)) * 24 as hours_worked
        FROM staff_assignments sa
        JOIN staff s ON sa.staff_id = s.id
        JOIN program_instances pi ON sa.program_instance_id = pi.id
        WHERE pi.date BETWEEN ? AND ?
        ORDER BY s.id, pi.date, sa.start_time
      `;
      
      return new Promise((resolve, reject) => {
        db.all(query, [startDate, endDate], (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    }
  } catch (error) {
    console.error('Error getting staff assignments:', error);
    throw error;
  }
}

/**
 * Group assignments by staff member
 * @param {Array} assignments - Staff assignments
 * @returns {Object} Assignments grouped by staff ID
 */
function groupAssignmentsByStaff(assignments) {
  const staffAssignments = {};
  
  assignments.forEach(assignment => {
    if (!staffAssignments[assignment.staff_id]) {
      staffAssignments[assignment.staff_id] = {
        staff_id: assignment.staff_id,
        first_name: assignment.first_name,
        last_name: assignment.last_name,
        schads_level: assignment.schads_level || 3,
        base_rate: assignment.base_rate || getSchadsRate(assignment.schads_level || 3),
        apply_penalty_rates: assignment.apply_penalty_rates !== false,
        payroll_id: assignment.payroll_id || assignment.staff_id,
        assignments: []
      };
    }
    
    staffAssignments[assignment.staff_id].assignments.push(assignment);
  });
  
  return staffAssignments;
}

/**
 * Calculate timesheet data for each staff member
 * @param {Object} staffAssignments - Assignments grouped by staff ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Timesheet data
 */
async function calculateTimesheetData(staffAssignments, startDate, endDate) {
  const timesheetData = [];
  
  // Process each staff member's assignments
  for (const staffId in staffAssignments) {
    const staff = staffAssignments[staffId];
    const dailyHours = calculateDailyHours(staff.assignments);
    
    // Calculate contracted hours for the period
    const contractedHours = await getContractedHours(staffId, startDate, endDate);
    
    // Calculate regular hours, overtime, and penalty rates
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalPenaltyHours = 0;
    let totalAmount = 0;
    
    const timeEntries = [];
    
    // Process each day's hours
    for (const date in dailyHours) {
      const day = new Date(date).getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = day === 0 || day === 6;
      const isPublicHoliday = PUBLIC_HOLIDAYS.includes(date);
      
      const entries = dailyHours[date];
      let dailyTotal = 0;
      
      // Process each time entry for the day
      entries.forEach(entry => {
        const hours = entry.hours_worked;
        dailyTotal += hours;
        
        let rate = staff.base_rate;
        let rateType = 'regular';
        
        // Apply penalty rates if enabled
        if (staff.apply_penalty_rates) {
          if (isPublicHoliday) {
            rate = staff.base_rate * 2.5; // 250% for public holidays
            rateType = 'public_holiday';
            totalPenaltyHours += hours;
          } else if (isWeekend) {
            rate = staff.base_rate * 1.5; // 150% for weekends
            rateType = 'weekend';
            totalPenaltyHours += hours;
          }
        }
        
        // Add the time entry
        timeEntries.push({
          date,
          start_time: entry.start_time,
          end_time: entry.end_time,
          hours,
          rate,
          rate_type: rateType,
          description: entry.role || entry.assignment_type || 'Support Work',
          amount: hours * rate
        });
        
        totalAmount += hours * rate;
      });
      
      // Calculate overtime (anything over 8 hours per day)
      if (dailyTotal > 8) {
        const overtimeHours = dailyTotal - 8;
        totalOvertimeHours += overtimeHours;
        totalRegularHours += (dailyTotal - overtimeHours);
      } else {
        totalRegularHours += dailyTotal;
      }
    }
    
    // Add the staff member's timesheet data
    timesheetData.push({
      staff_id: staff.staff_id,
      payroll_id: staff.payroll_id,
      first_name: staff.first_name,
      last_name: staff.last_name,
      schads_level: staff.schads_level,
      base_rate: staff.base_rate,
      contracted_hours: contractedHours,
      total_hours: totalRegularHours + totalOvertimeHours,
      regular_hours: totalRegularHours,
      overtime_hours: totalOvertimeHours,
      penalty_hours: totalPenaltyHours,
      total_amount: totalAmount,
      time_entries: timeEntries
    });
  }
  
  return timesheetData;
}

/**
 * Calculate hours worked per day for each assignment
 * @param {Array} assignments - Staff assignments
 * @returns {Object} Hours grouped by date
 */
function calculateDailyHours(assignments) {
  const dailyHours = {};
  
  assignments.forEach(assignment => {
    const date = assignment.date;
    
    if (!dailyHours[date]) {
      dailyHours[date] = [];
    }
    
    dailyHours[date].push(assignment);
  });
  
  return dailyHours;
}

/**
 * Get contracted hours for a staff member in a date range
 * @param {string} staffId - Staff ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number>} Contracted hours
 */
async function getContractedHours(staffId, startDate, endDate) {
  try {
    // Try PostgreSQL (TGL) first, fall back to SQLite if needed
    try {
      // TGL architecture query (PostgreSQL)
      const query = `
        SELECT contracted_hours
        FROM staff
        WHERE id = $1
      `;
      
      const result = await pool.query(query, [staffId]);
      
      if (result.rows.length === 0) {
        return 0;
      }
      
      // Calculate pro-rated contracted hours for the period
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = (end - start) / (1000 * 60 * 60 * 24) + 1;
      const fortnightDays = 14;
      
      return (result.rows[0].contracted_hours / fortnightDays) * days;
    } catch (pgError) {
      // Fall back to SQLite
      const db = await getDbConnection();
      
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT contracted_hours FROM staff WHERE id = ?`,
          [staffId],
          (err, row) => {
            if (err) return reject(err);
            
            if (!row) {
              return resolve(0);
            }
            
            // Calculate pro-rated contracted hours for the period
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = (end - start) / (1000 * 60 * 60 * 24) + 1;
            const fortnightDays = 14;
            
            resolve((row.contracted_hours / fortnightDays) * days);
          }
        );
      });
    }
  } catch (error) {
    console.error(`Error getting contracted hours for staff ${staffId}:`, error);
    return 0;
  }
}

/**
 * Format timesheet data as CSV for the specified export format
 * @param {Array} timesheetData - Timesheet data
 * @param {string} format - Export format (xero, myob, etc.)
 * @returns {string} CSV data as string
 */
function formatTimesheetCsv(timesheetData, format = 'xero') {
  switch (format.toLowerCase()) {
    case 'xero':
      return formatXeroCsv(timesheetData);
    case 'myob':
      return formatMyobCsv(timesheetData);
    default:
      return formatXeroCsv(timesheetData); // Default to Xero format
  }
}

/**
 * Format timesheet data as CSV for Xero
 * @param {Array} timesheetData - Timesheet data
 * @returns {string} CSV data as string
 */
function formatXeroCsv(timesheetData) {
  // Xero timesheet CSV headers
  const headers = [
    'Employee ID',
    'First Name',
    'Last Name',
    'Start Date',
    'End Date',
    'Description',
    'Hours',
    'Pay Item',
    'Rate',
    'Amount'
  ];
  
  // Create CSV rows
  const rows = [];
  
  // Add header row
  rows.push(headers.join(','));
  
  // Add data rows
  timesheetData.forEach(staff => {
    staff.time_entries.forEach(entry => {
      const row = [
        staff.payroll_id || staff.staff_id,
        escapeCsvField(staff.first_name),
        escapeCsvField(staff.last_name),
        entry.date, // Start date
        entry.date, // End date
        escapeCsvField(entry.description),
        entry.hours.toFixed(2),
        getXeroPayItem(entry.rate_type, staff.schads_level),
        entry.rate.toFixed(2),
        entry.amount.toFixed(2)
      ];
      
      rows.push(row.join(','));
    });
  });
  
  return rows.join('\n');
}

/**
 * Format timesheet data as CSV for MYOB
 * @param {Array} timesheetData - Timesheet data
 * @returns {string} CSV data as string
 */
function formatMyobCsv(timesheetData) {
  // MYOB timesheet CSV headers
  const headers = [
    'Employee ID',
    'Employee Name',
    'Pay Period',
    'Pay Date',
    'Pay Item',
    'Hours',
    'Rate',
    'Amount',
    'Notes'
  ];
  
  // Create CSV rows
  const rows = [];
  
  // Add header row
  rows.push(headers.join(','));
  
  // Add data rows
  timesheetData.forEach(staff => {
    // Group entries by day for MYOB format
    const entriesByDay = {};
    
    staff.time_entries.forEach(entry => {
      const payItem = getMyobPayItem(entry.rate_type, staff.schads_level);
      
      if (!entriesByDay[entry.date]) {
        entriesByDay[entry.date] = {};
      }
      
      if (!entriesByDay[entry.date][payItem]) {
        entriesByDay[entry.date][payItem] = {
          hours: 0,
          amount: 0,
          rate: entry.rate,
          descriptions: []
        };
      }
      
      entriesByDay[entry.date][payItem].hours += entry.hours;
      entriesByDay[entry.date][payItem].amount += entry.amount;
      entriesByDay[entry.date][payItem].descriptions.push(entry.description);
    });
    
    // Create rows for each day and pay item
    for (const date in entriesByDay) {
      for (const payItem in entriesByDay[date]) {
        const entry = entriesByDay[date][payItem];
        const row = [
          staff.payroll_id || staff.staff_id,
          escapeCsvField(`${staff.first_name} ${staff.last_name}`),
          date, // Pay period
          date, // Pay date
          payItem,
          entry.hours.toFixed(2),
          entry.rate.toFixed(2),
          entry.amount.toFixed(2),
          escapeCsvField(entry.descriptions.join(', '))
        ];
        
        rows.push(row.join(','));
      }
    }
  });
  
  return rows.join('\n');
}

/**
 * Get Xero pay item based on rate type and SCHADS level
 * @param {string} rateType - Rate type (regular, weekend, public_holiday)
 * @param {number} schadsLevel - SCHADS level (1-8)
 * @returns {string} Xero pay item
 */
function getXeroPayItem(rateType, schadsLevel) {
  const level = schadsLevel || 3;
  
  switch (rateType) {
    case 'weekend':
      return `SCHADS${level}W`;
    case 'public_holiday':
      return `SCHADS${level}PH`;
    case 'overtime':
      return `SCHADS${level}OT`;
    default:
      return `SCHADS${level}`;
  }
}

/**
 * Get MYOB pay item based on rate type and SCHADS level
 * @param {string} rateType - Rate type (regular, weekend, public_holiday)
 * @param {number} schadsLevel - SCHADS level (1-8)
 * @returns {string} MYOB pay item
 */
function getMyobPayItem(rateType, schadsLevel) {
  const level = schadsLevel || 3;
  
  switch (rateType) {
    case 'weekend':
      return `SCH${level}SAT`;
    case 'public_holiday':
      return `SCH${level}HOL`;
    case 'overtime':
      return `SCH${level}OT`;
    default:
      return `SCH${level}ORD`;
  }
}

/**
 * Get SCHADS award hourly rate based on level
 * @param {number|string} level - SCHADS level (1-8)
 * @returns {number} Hourly rate
 */
function getSchadsRate(level) {
  // SCHADS Social and Community Services Employee rates as of July 2025
  // These would typically come from a database or config, but hardcoded for POC
  const rates = {
    1: 28.41,
    2: 32.54,
    3: 34.85,
    4: 36.88,
    5: 39.03,
    6: 43.26,
    7: 46.71,
    8: 50.15
  };
  
  // Default to level 3 if invalid level provided
  return rates[level] || rates[3];
}

/**
 * Escape CSV field to handle commas, quotes, etc.
 * @param {string} field - Field value
 * @returns {string} Escaped field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  
  const stringField = String(field);
  
  // If the field contains commas, quotes, or newlines, wrap it in quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // Double up any quotes in the field
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Generate and save timesheet CSV file
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} format - Export format (xero, myob, etc.)
 * @param {string} outputDir - Directory to save the file
 * @returns {Promise<string>} Path to the saved file
 */
async function generateAndSaveTimesheetCsv(startDate, endDate, format = 'xero', outputDir = './exports') {
  try {
    // Generate the CSV data
    const csvData = await generateTimesheetCsv(startDate, endDate, format);
    
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate a filename
    const filename = `timesheets_${startDate}_to_${endDate}_${format}.csv`;
    const filePath = path.join(outputDir, filename);
    
    // Write the CSV data to the file
    fs.writeFileSync(filePath, csvData);
    
    return filePath;
  } catch (error) {
    console.error('Error generating and saving timesheet CSV:', error);
    throw error;
  }
}

module.exports = {
  generateTimesheetCsv,
  generateAndSaveTimesheetCsv,
  getStaffAssignments,
  calculateTimesheetData,
  formatTimesheetCsv
};
