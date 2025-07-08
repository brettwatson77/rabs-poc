/**
 * backend/controllers/staffAssignmentController.js
 * 
 * Controller for managing staff assignments to program instances
 * Handles staff availability, assignment updates, and hours tracking
 */
const { getDbConnection } = require('../database');

/**
 * Get available staff for a specific program instance based on date and time
 * Considers staff availability schedule and existing assignments
 */
const getAvailableStaff = async (req, res) => {
  const { programInstanceId } = req.query;
  let db;
  
  try {
    if (!programInstanceId) {
      return res.status(400).json({ error: 'Program instance ID is required' });
    }
    
    db = await getDbConnection();
    
    // First get the program instance details to know the day, time, and date
    const instanceQuery = `
      SELECT pi.id, pi.date, pi.start_time, pi.end_time, p.day_of_week
      FROM program_instances pi
      JOIN programs p ON pi.program_id = p.id
      WHERE pi.id = ?
    `;
    
    const instance = await new Promise((resolve, reject) => {
      db.get(instanceQuery, [programInstanceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!instance) {
      return res.status(404).json({ error: 'Program instance not found' });
    }
    
    // Get all staff who are available on this day and time
    const availableStaffQuery = `
      SELECT s.id, s.first_name, s.last_name, s.contracted_hours,
             (SELECT COUNT(*) FROM staff_assignments sa 
              JOIN program_instances pi ON sa.program_instance_id = pi.id
              WHERE sa.staff_id = s.id AND pi.date = ?) as has_assignment_on_date
      FROM staff s
      JOIN staff_availability sa ON s.id = sa.staff_id
      WHERE sa.day_of_week = ?
      AND sa.start_time <= ?
      AND sa.end_time >= ?
      ORDER BY s.first_name, s.last_name
    `;
    
    const availableStaff = await new Promise((resolve, reject) => {
      db.all(availableStaffQuery, [
        instance.date,
        instance.day_of_week,
        instance.start_time,
        instance.end_time
      ], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Get currently assigned staff for this program instance
    const assignedStaffQuery = `
      SELECT sa.id as assignment_id, sa.staff_id, s.first_name, s.last_name, sa.role
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.program_instance_id = ?
    `;
    
    const assignedStaff = await new Promise((resolve, reject) => {
      db.all(assignedStaffQuery, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return res.json({
      programInstanceId,
      date: instance.date,
      availableStaff,
      assignedStaff
    });
    
  } catch (error) {
    console.error('Error getting available staff:', error);
    return res.status(500).json({ error: 'Failed to get available staff' });
  } finally {
    if (db) db.close();
  }
};

/**
 * Get current staff assignments for a program instance
 */
const getStaffAssignments = async (req, res) => {
  const { programInstanceId } = req.params;
  let db;
  
  try {
    db = await getDbConnection();
    
    const query = `
      SELECT sa.id, sa.staff_id, s.first_name, s.last_name, sa.role, sa.notes
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.program_instance_id = ?
    `;
    
    const assignments = await new Promise((resolve, reject) => {
      db.all(query, [programInstanceId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    return res.json(assignments);
    
  } catch (error) {
    console.error('Error getting staff assignments:', error);
    return res.status(500).json({ error: 'Failed to get staff assignments' });
  } finally {
    if (db) db.close();
  }
};

/**
 * Update staff assignment for a single program instance
 * Replaces one staff member with another for just one instance
 */
const updateSingleStaffAssignment = async (req, res) => {
  const { programInstanceId } = req.params;
  const { oldStaffId, newStaffId, role } = req.body;
  let db;
  
  try {
    if (!programInstanceId || !oldStaffId || !newStaffId) {
      return res.status(400).json({ 
        error: 'Program instance ID, old staff ID, and new staff ID are required' 
      });
    }
    
    db = await getDbConnection();
    
    // Begin transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => err ? reject(err) : resolve());
    });
    
    try {
      // Check if the old assignment exists
      const checkQuery = `
        SELECT id FROM staff_assignments 
        WHERE program_instance_id = ? AND staff_id = ?
      `;
      
      const existingAssignment = await new Promise((resolve, reject) => {
        db.get(checkQuery, [programInstanceId, oldStaffId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!existingAssignment) {
        throw new Error('Staff assignment not found');
      }
      
      // Update the assignment
      const updateQuery = `
        UPDATE staff_assignments
        SET staff_id = ?, 
            role = COALESCE(?, role),
            notes = COALESCE(notes, '') || ' | Replaced staff member ' || ? || ' with ' || ?
        WHERE id = ?
      `;
      
      await new Promise((resolve, reject) => {
        db.run(updateQuery, [
          newStaffId,
          role,
          oldStaffId,
          newStaffId,
          existingAssignment.id
        ], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
      
      // Log the change in activity_log
      const logQuery = `
        INSERT INTO activity_log (event_type, staff_id, program_instance_id, description)
        VALUES ('staff_replacement', ?, ?, ?)
      `;
      
      await new Promise((resolve, reject) => {
        db.run(logQuery, [
          newStaffId,
          programInstanceId,
          `Staff ${oldStaffId} replaced with ${newStaffId} for single instance`
        ], (err) => err ? reject(err) : resolve());
      });
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => err ? reject(err) : resolve());
      });
      
      return res.json({ 
        success: true, 
        message: 'Staff assignment updated successfully',
        programInstanceId,
        oldStaffId,
        newStaffId
      });
      
    } catch (error) {
      // Rollback transaction on error
      await new Promise((resolve) => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
    
  } catch (error) {
    console.error('Error updating staff assignment:', error);
    return res.status(500).json({ 
      error: 'Failed to update staff assignment',
      message: error.message 
    });
  } finally {
    if (db) db.close();
  }
};

/**
 * Update staff assignment for all future instances of a program
 * Implements the "forever" option for staff changes
 */
const updateRecurringStaffAssignment = async (req, res) => {
  const { programId } = req.params;
  const { oldStaffId, newStaffId, role, startDate } = req.body;
  let db;
  
  try {
    if (!programId || !oldStaffId || !newStaffId || !startDate) {
      return res.status(400).json({ 
        error: 'Program ID, old staff ID, new staff ID, and start date are required' 
      });
    }
    
    db = await getDbConnection();
    
    // Begin transaction
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => err ? reject(err) : resolve());
    });
    
    try {
      // Find all future program instances from the start date
      const instancesQuery = `
        SELECT id, date
        FROM program_instances
        WHERE program_id = ? AND date >= ?
        ORDER BY date
      `;
      
      const instances = await new Promise((resolve, reject) => {
        db.all(instancesQuery, [programId, startDate], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (instances.length === 0) {
        return res.status(404).json({ 
          error: 'No future program instances found from the specified start date' 
        });
      }
      
      // For each instance, update the staff assignment
      let updatedCount = 0;
      for (const instance of instances) {
        // Check if the old staff is assigned to this instance
        const checkQuery = `
          SELECT id FROM staff_assignments 
          WHERE program_instance_id = ? AND staff_id = ?
        `;
        
        const existingAssignment = await new Promise((resolve, reject) => {
          db.get(checkQuery, [instance.id, oldStaffId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        /* ------------------------------------------------------------------
         * 1) If oldStaff **is** assigned to this instance …
         *    • If newStaff already assigned  → just delete the old row.
         *    • Else                          → update the row to newStaff.
         *
         * 2) If oldStaff is NOT assigned    → skip (do nothing) to avoid
         *    UNIQUE (staff_id, program_instance_id) violations.
         * ---------------------------------------------------------------- */

        // Is new staff already on this instance?
        const duplicateRow = await new Promise((resolve, reject) => {
          db.get(
            `SELECT id FROM staff_assignments WHERE program_instance_id = ? AND staff_id = ?`,
            [instance.id, newStaffId],
            (err, row) => (err ? reject(err) : resolve(row))
          );
        });

        if (existingAssignment) {
          if (duplicateRow) {
            // New staff already present – remove the old staff row
            await new Promise((resolve, reject) => {
              db.run(
                `DELETE FROM staff_assignments WHERE id = ?`,
                [existingAssignment.id],
                (err) => (err ? reject(err) : resolve())
              );
            });
            updatedCount++;
          } else {
            // Safe to update
            const updateQuery = `
              UPDATE staff_assignments
              SET staff_id = ?, 
                  role = COALESCE(?, role),
                  notes = COALESCE(notes, '') || ' | Recurring replacement from ' || ? || ' to ' || ?
              WHERE id = ?
            `;
            const changes = await new Promise((resolve, reject) => {
              db.run(
                updateQuery,
                [newStaffId, role, oldStaffId, newStaffId, existingAssignment.id],
                function (err) {
                  if (err) reject(err);
                  else resolve(this.changes);
                }
              );
            });
            if (changes > 0) updatedCount++;
          }
        } else {
          // oldStaff NOT assigned → skip to avoid duplicates (no insert)
          continue;
        }
      }
      
      // Log the recurring change
      const logQuery = `
        INSERT INTO activity_log (event_type, staff_id, description)
        VALUES ('recurring_staff_replacement', ?, ?)
      `;
      
      await new Promise((resolve, reject) => {
        db.run(logQuery, [
          newStaffId,
          `Staff ${oldStaffId} replaced with ${newStaffId} for all future instances of program ${programId} from ${startDate}`
        ], (err) => err ? reject(err) : resolve());
      });
      
      // Commit transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => err ? reject(err) : resolve());
      });
      
      return res.json({ 
        success: true, 
        message: `Staff assignments updated for ${updatedCount} future program instances`,
        programId,
        oldStaffId,
        newStaffId,
        startDate,
        updatedCount
      });
      
    } catch (error) {
      // Rollback transaction on error
      await new Promise((resolve) => {
        db.run('ROLLBACK', () => resolve());
      });
      throw error;
    }
    
  } catch (error) {
    console.error('Error updating recurring staff assignments:', error);
    return res.status(500).json({ 
      error: 'Failed to update recurring staff assignments',
      message: error.message 
    });
  } finally {
    if (db) db.close();
  }
};

/**
 * Add a new staff assignment to a program instance
 */
const addStaffAssignment = async (req, res) => {
  const { programInstanceId } = req.params;
  const { staffId, role } = req.body;
  let db;
  
  try {
    if (!programInstanceId || !staffId) {
      return res.status(400).json({ error: 'Program instance ID and staff ID are required' });
    }
    
    db = await getDbConnection();
    
    // Check if the assignment already exists
    const checkQuery = `
      SELECT id FROM staff_assignments 
      WHERE program_instance_id = ? AND staff_id = ?
    `;
    
    const existingAssignment = await new Promise((resolve, reject) => {
      db.get(checkQuery, [programInstanceId, staffId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingAssignment) {
      return res.status(409).json({ error: 'Staff is already assigned to this program instance' });
    }
    
    // Insert the new assignment
    const insertQuery = `
      INSERT INTO staff_assignments (staff_id, program_instance_id, role, notes)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.run(insertQuery, [
        staffId,
        programInstanceId,
        role || 'support',
        'Manually assigned'
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
    
    return res.status(201).json({
      success: true,
      message: 'Staff assignment created successfully',
      id: result.id,
      staffId,
      programInstanceId,
      role: role || 'support'
    });
    
  } catch (error) {
    console.error('Error adding staff assignment:', error);
    return res.status(500).json({ error: 'Failed to add staff assignment' });
  } finally {
    if (db) db.close();
  }
};

/**
 * Remove a staff assignment
 */
const removeStaffAssignment = async (req, res) => {
  const { assignmentId } = req.params;
  let db;
  
  try {
    db = await getDbConnection();
    
    // Get the assignment details before deleting for logging
    const getQuery = `
      SELECT sa.staff_id, sa.program_instance_id, s.first_name, s.last_name
      FROM staff_assignments sa
      JOIN staff s ON sa.staff_id = s.id
      WHERE sa.id = ?
    `;
    
    const assignment = await new Promise((resolve, reject) => {
      db.get(getQuery, [assignmentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!assignment) {
      return res.status(404).json({ error: 'Staff assignment not found' });
    }
    
    // Delete the assignment
    const deleteQuery = `DELETE FROM staff_assignments WHERE id = ?`;
    
    const result = await new Promise((resolve, reject) => {
      db.run(deleteQuery, [assignmentId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Staff assignment not found' });
    }
    
    // Log the removal
    const logQuery = `
      INSERT INTO activity_log (event_type, staff_id, program_instance_id, description)
      VALUES ('staff_removal', ?, ?, ?)
    `;
    
    await new Promise((resolve, reject) => {
      db.run(logQuery, [
        assignment.staff_id,
        assignment.program_instance_id,
        `Removed staff ${assignment.first_name} ${assignment.last_name} from program instance`
      ], (err) => err ? reject(err) : resolve());
    });
    
    return res.json({
      success: true,
      message: 'Staff assignment removed successfully',
      assignmentId
    });
    
  } catch (error) {
    console.error('Error removing staff assignment:', error);
    return res.status(500).json({ error: 'Failed to remove staff assignment' });
  } finally {
    if (db) db.close();
  }
};

/**
 * Get allocated hours for a staff member in the current fortnight
 * Calculates total allocated hours and compares with contracted hours
 */
const getStaffHours = async (req, res) => {
  const { staffId } = req.params;
  const { startDate, endDate } = req.query;
  let db;
  
  try {
    if (!staffId) {
      return res.status(400).json({ error: 'Staff ID is required' });
    }
    
    db = await getDbConnection();
    
    // Get staff details including contracted hours
    const staffQuery = `SELECT id, first_name, last_name, contracted_hours FROM staff WHERE id = ?`;
    
    const staff = await new Promise((resolve, reject) => {
      db.get(staffQuery, [staffId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    // Calculate current fortnight dates if not provided
    let fortnightStart, fortnightEnd;
    
    if (startDate && endDate) {
      fortnightStart = startDate;
      fortnightEnd = endDate;
    } else {
      // Get current date from settings or use system date
      const dateQuery = `SELECT value FROM settings WHERE key = 'current_date'`;
      
      const dateSetting = await new Promise((resolve, reject) => {
        db.get(dateQuery, [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      const currentDate = dateSetting ? new Date(dateSetting.value) : new Date();
      
      // Find the start of the fortnight (Monday of the current or previous week)
      fortnightStart = new Date(currentDate);
      const dayOfWeek = fortnightStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const diff = (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Adjust to get to Monday
      
      // If we're in the second week of the fortnight, go back one more week
      const isSecondWeek = Math.floor(fortnightStart.getDate() / 7) % 2 === 1;
      const weeksToGoBack = isSecondWeek ? 1 : 0;
      
      fortnightStart.setDate(fortnightStart.getDate() - diff - (weeksToGoBack * 7));
      fortnightStart.setHours(0, 0, 0, 0);
      
      // End date is 13 days later (14 days total in fortnight)
      fortnightEnd = new Date(fortnightStart);
      fortnightEnd.setDate(fortnightStart.getDate() + 13);
      fortnightEnd.setHours(23, 59, 59, 999);
      
      // Format dates as YYYY-MM-DD
      fortnightStart = fortnightStart.toISOString().split('T')[0];
      fortnightEnd = fortnightEnd.toISOString().split('T')[0];
    }
    
    // Get all assignments for this staff member in the fortnight
    const assignmentsQuery = `
      SELECT sa.id, sa.program_instance_id, pi.date, pi.start_time, pi.end_time,
             p.name as program_name
      FROM staff_assignments sa
      JOIN program_instances pi ON sa.program_instance_id = pi.id
      JOIN programs p ON pi.program_id = p.id
      WHERE sa.staff_id = ?
      AND pi.date BETWEEN ? AND ?
      ORDER BY pi.date, pi.start_time
    `;
    
    const assignments = await new Promise((resolve, reject) => {
      db.all(assignmentsQuery, [staffId, fortnightStart, fortnightEnd], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate total hours from assignments
    let totalMinutes = 0;
    const assignmentDetails = assignments.map(assignment => {
      // Calculate duration in minutes
      const startParts = assignment.start_time.split(':').map(Number);
      const endParts = assignment.end_time.split(':').map(Number);
      
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];
      
      const duration = endMinutes - startMinutes;
      totalMinutes += duration;
      
      return {
        ...assignment,
        duration: duration,
        durationHours: (duration / 60).toFixed(1)
      };
    });
    
    const totalHours = (totalMinutes / 60).toFixed(1);
    const percentAllocated = staff.contracted_hours > 0 
      ? ((totalMinutes / 60) / staff.contracted_hours * 100).toFixed(1) 
      : 0;
    const remainingHours = Math.max(0, staff.contracted_hours - (totalMinutes / 60)).toFixed(1);
    const overAllocated = totalMinutes / 60 > staff.contracted_hours;
    
    return res.json({
      staff: {
        id: staff.id,
        name: `${staff.first_name} ${staff.last_name}`,
        contracted_hours: staff.contracted_hours
      },
      fortnight: {
        start_date: fortnightStart,
        end_date: fortnightEnd
      },
      hours: {
        allocated: parseFloat(totalHours),
        remaining: parseFloat(remainingHours),
        percent_allocated: parseFloat(percentAllocated),
        over_allocated: overAllocated
      },
      assignments: assignmentDetails
    });
    
  } catch (error) {
    console.error('Error getting staff hours:', error);
    return res.status(500).json({ error: 'Failed to get staff hours' });
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  getAvailableStaff,
  getStaffAssignments,
  updateSingleStaffAssignment,
  updateRecurringStaffAssignment,
  addStaffAssignment,
  removeStaffAssignment,
  getStaffHours
};
