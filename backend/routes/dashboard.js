/**
 * Dashboard Routes
 * 
 * Endpoints for the Dashboard view, showing time slot cards in Before/Now/Next/Later/After columns
 * These are operational time slots (pickup/event/dropoff) derived from loom instances
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rabspocdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * @route   GET /api/v1/dashboard/time-slots
 * @desc    Get time slot cards for Before/Now/Next/Later/After columns
 * @access  Public
 */
router.get('/time-slots', async (req, res, next) => {
  try {
    const { date, referenceTime } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    // Default reference time to now if not provided
    const refTime = referenceTime || new Date().toTimeString().slice(0, 8);
    
    // Get all time slots for the day with program and venue info
    const result = await pool.query(
      `SELECT ts.id, ts.program_id, ts.start_time, ts.end_time, ts.segment_type,
              p.name as program_name, 
              li.id as loom_instance_id,
              li.date,
              v.name as venue_name,
              v.address as venue_address,
              COUNT(DISTINCT pp.participant_id) as participant_count,
              COUNT(DISTINCT ss.staff_id) as staff_count,
              COUNT(DISTINCT vr.vehicle_id) as vehicle_count
       FROM tgl_loom_time_slots ts
       JOIN programs p ON ts.program_id = p.id
       JOIN tgl_loom_instances li ON p.id = li.program_id
       JOIN venues v ON p.venue_id = v.id
       LEFT JOIN program_participants pp ON p.id = pp.program_id
       LEFT JOIN tgl_loom_staff_shifts ss ON li.id = ss.loom_instance_id
       LEFT JOIN tgl_loom_vehicle_runs vr ON li.id = vr.loom_instance_id
       WHERE li.date = $1
       GROUP BY ts.id, ts.program_id, ts.start_time, ts.end_time, ts.segment_type, 
                p.name, li.id, li.date, v.name, v.address
       ORDER BY ts.start_time`,
      [date]
    );
    
    // Categorize time slots into Before/Now/Next/Later/After
    const timeSlots = {
      before: [],
      now: [],
      next: [],
      later: [],
      after: []
    };
    
    result.rows.forEach(slot => {
      // Compare time slot to reference time
      if (slot.end_time < refTime) {
        timeSlots.after.push(slot); // Already ended
      } else if (slot.start_time <= refTime && refTime <= slot.end_time) {
        timeSlots.now.push(slot); // Currently happening
      } else if (timeSlots.next.length === 0) {
        timeSlots.next.push(slot); // Next upcoming
      } else if (timeSlots.later.length < 3) {
        timeSlots.later.push(slot); // Later today (up to 3)
      } else {
        timeSlots.after.push(slot); // Rest of the day
      }
    });
    
    res.json({
      success: true,
      data: timeSlots,
      meta: {
        date,
        referenceTime: refTime,
        totalTimeSlots: result.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/time-slots/:id
 * @desc    Get detailed information for a specific time slot
 * @access  Public
 */
router.get('/time-slots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get basic time slot info
    const timeSlotResult = await pool.query(
      `SELECT ts.*, 
              p.name as program_name, 
              p.staff_ratio,
              li.id as loom_instance_id,
              li.date,
              v.name as venue_name,
              v.address as venue_address
       FROM tgl_loom_time_slots ts
       JOIN programs p ON ts.program_id = p.id
       JOIN tgl_loom_instances li ON p.id = li.program_id
       JOIN venues v ON p.venue_id = v.id
       WHERE ts.id = $1`,
      [id]
    );
    
    if (timeSlotResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found'
      });
    }
    
    const timeSlot = timeSlotResult.rows[0];
    const loomInstanceId = timeSlot.loom_instance_id;
    
    // Get participants assigned to this program with attendance status
    const participantsResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.photo_url,
              bc.name as billing_code_name, bc.ndis_number,
              pa.status as attendance_status, pa.notes
       FROM participants p
       JOIN program_participants pp ON p.id = pp.participant_id
       LEFT JOIN billing_codes bc ON pp.billing_code_id = bc.id
       LEFT JOIN loom_participant_attendance pa ON p.id = pa.participant_id AND pa.loom_instance_id = $1
       WHERE pp.program_id = $2`,
      [loomInstanceId, timeSlot.program_id]
    );
    
    // Get staff assigned to this time slot
    const staffResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.photo_url, 
              ss.role, ss.start_time, ss.end_time
       FROM staff s
       JOIN tgl_loom_staff_shifts ss ON s.id = ss.staff_id
       WHERE ss.loom_instance_id = $1 AND 
             (ss.time_slot_id = $2 OR 
              (ss.time_slot_id IS NULL AND 
               $3 <= ss.end_time AND ss.start_time <= $4))`,
      [loomInstanceId, id, timeSlot.start_time, timeSlot.end_time]
    );
    
    // Get vehicles assigned to this time slot
    const vehicleResult = await pool.query(
      `SELECT v.id, v.name, v.make, v.model, v.registration, v.fuel_type, v.capacity,
              vr.start_time, vr.end_time, vr.route_data
       FROM vehicles v
       JOIN tgl_loom_vehicle_runs vr ON v.id = vr.vehicle_id
       WHERE vr.loom_instance_id = $1 AND 
             (vr.time_slot_id = $2 OR 
              (vr.time_slot_id IS NULL AND 
               $3 <= vr.end_time AND vr.start_time <= $4))`,
      [loomInstanceId, id, timeSlot.start_time, timeSlot.end_time]
    );
    
    // Combine all data
    const timeSlotData = {
      ...timeSlot,
      participants: participantsResult.rows,
      staff: staffResult.rows,
      vehicles: vehicleResult.rows
    };
    
    res.json({
      success: true,
      data: timeSlotData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/dashboard/time-slots/:id
 * @desc    Update attendance, staff assignments, vehicle changes for a time slot
 * @access  Public
 */
router.patch('/time-slots/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      participantAttendance,
      staffAssignments,
      vehicleAssignments,
      notes
    } = req.body;
    
    // Get time slot info to verify it exists
    const timeSlotResult = await pool.query(
      `SELECT ts.*, li.id as loom_instance_id
       FROM tgl_loom_time_slots ts
       JOIN programs p ON ts.program_id = p.id
       JOIN tgl_loom_instances li ON p.id = li.program_id
       WHERE ts.id = $1`,
      [id]
    );
    
    if (timeSlotResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Time slot not found'
      });
    }
    
    const timeSlot = timeSlotResult.rows[0];
    const loomInstanceId = timeSlot.loom_instance_id;
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update participant attendance if provided
      if (participantAttendance && Array.isArray(participantAttendance)) {
        for (const attendance of participantAttendance) {
          const { participantId, status, attendanceNotes } = attendance;
          
          // Check if attendance record exists
          const existingResult = await client.query(
            `SELECT id FROM loom_participant_attendance 
             WHERE participant_id = $1 AND loom_instance_id = $2`,
            [participantId, loomInstanceId]
          );
          
          if (existingResult.rows.length > 0) {
            // Update existing record
            await client.query(
              `UPDATE loom_participant_attendance 
               SET status = $1, notes = $2, updated_at = NOW()
               WHERE participant_id = $3 AND loom_instance_id = $4`,
              [status, attendanceNotes, participantId, loomInstanceId]
            );
          } else {
            // Create new record
            await client.query(
              `INSERT INTO loom_participant_attendance 
               (participant_id, loom_instance_id, status, notes)
               VALUES ($1, $2, $3, $4)`,
              [participantId, loomInstanceId, status, attendanceNotes]
            );
          }
        }
      }
      
      // Update staff assignments if provided
      if (staffAssignments && Array.isArray(staffAssignments)) {
        // First remove existing staff assignments for this time slot
        await client.query(
          `DELETE FROM tgl_loom_staff_shifts 
           WHERE loom_instance_id = $1 AND time_slot_id = $2`,
          [loomInstanceId, id]
        );
        
        // Add new staff assignments
        for (const assignment of staffAssignments) {
          const { staffId, role, startTime, endTime } = assignment;
          
          await client.query(
            `INSERT INTO tgl_loom_staff_shifts 
             (staff_id, loom_instance_id, time_slot_id, role, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [staffId, loomInstanceId, id, role, startTime || timeSlot.start_time, endTime || timeSlot.end_time]
          );
        }
      }
      
      // Update vehicle assignments if provided
      if (vehicleAssignments && Array.isArray(vehicleAssignments)) {
        // First remove existing vehicle assignments for this time slot
        await client.query(
          `DELETE FROM tgl_loom_vehicle_runs 
           WHERE loom_instance_id = $1 AND time_slot_id = $2`,
          [loomInstanceId, id]
        );
        
        // Add new vehicle assignments
        for (const assignment of vehicleAssignments) {
          const { vehicleId, startTime, endTime, routeData } = assignment;
          
          await client.query(
            `INSERT INTO tgl_loom_vehicle_runs 
             (vehicle_id, loom_instance_id, time_slot_id, start_time, end_time, route_data)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [vehicleId, loomInstanceId, id, startTime || timeSlot.start_time, endTime || timeSlot.end_time, routeData || {}]
          );
        }
      }
      
      // Update time slot notes if provided
      if (notes !== undefined) {
        await client.query(
          `UPDATE tgl_loom_time_slots 
           SET notes = $1
           WHERE id = $2`,
          [notes, id]
        );
      }
      
      // Log the update
      await client.query(
        `INSERT INTO system_logs (level, message, source, details)
         VALUES ($1, $2, $3, $4)`,
        ['info', `Time slot ${id} updated`, 'dashboard', {
          timeSlotId: id,
          loomInstanceId,
          updatedParticipants: participantAttendance ? participantAttendance.length : 0,
          updatedStaff: staffAssignments ? staffAssignments.length : 0,
          updatedVehicles: vehicleAssignments ? vehicleAssignments.length : 0,
          updatedNotes: notes !== undefined
        }]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Time slot updated successfully',
        data: {
          timeSlotId: id,
          loomInstanceId,
          updatedParticipants: participantAttendance ? participantAttendance.length : 0,
          updatedStaff: staffAssignments ? staffAssignments.length : 0,
          updatedVehicles: vehicleAssignments ? vehicleAssignments.length : 0,
          updatedNotes: notes !== undefined
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/summary
 * @desc    Get summary statistics for the dashboard
 * @access  Public
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    // Count time slots for the day
    const timeSlotsResult = await pool.query(
      `SELECT COUNT(*) as time_slot_count,
              COUNT(DISTINCT ts.segment_type) as segment_type_count
       FROM tgl_loom_time_slots ts
       JOIN programs p ON ts.program_id = p.id
       JOIN tgl_loom_instances li ON p.id = li.program_id
       WHERE li.date = $1`,
      [date]
    );
    
    // Count active participants for the day
    const participantsResult = await pool.query(
      `SELECT COUNT(DISTINCT pp.participant_id) as participant_count,
              SUM(CASE WHEN pa.status = 'attended' THEN 1 ELSE 0 END) as attended_count,
              SUM(CASE WHEN pa.status = 'absent' THEN 1 ELSE 0 END) as absent_count
       FROM program_participants pp
       JOIN tgl_loom_instances li ON pp.program_id = li.program_id
       LEFT JOIN loom_participant_attendance pa ON pp.participant_id = pa.participant_id AND pa.loom_instance_id = li.id
       WHERE li.date = $1`,
      [date]
    );
    
    // Count staff on duty for the day
    const staffResult = await pool.query(
      `SELECT COUNT(DISTINCT ss.staff_id) as staff_count
       FROM tgl_loom_staff_shifts ss
       JOIN tgl_loom_instances li ON ss.loom_instance_id = li.id
       WHERE li.date = $1`,
      [date]
    );
    
    // Count vehicles in use for the day
    const vehicleResult = await pool.query(
      `SELECT COUNT(DISTINCT vr.vehicle_id) as vehicle_count
       FROM tgl_loom_vehicle_runs vr
       JOIN tgl_loom_instances li ON vr.loom_instance_id = li.id
       WHERE li.date = $1`,
      [date]
    );
    
    res.json({
      success: true,
      data: {
        date,
        time_slots: {
          total: parseInt(timeSlotsResult.rows[0].time_slot_count) || 0,
          segment_types: parseInt(timeSlotsResult.rows[0].segment_type_count) || 0
        },
        participants: {
          total: parseInt(participantsResult.rows[0].participant_count) || 0,
          attended: parseInt(participantsResult.rows[0].attended_count) || 0,
          absent: parseInt(participantsResult.rows[0].absent_count) || 0
        },
        staff_count: parseInt(staffResult.rows[0].staff_count) || 0,
        vehicle_count: parseInt(vehicleResult.rows[0].vehicle_count) || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/dashboard/alerts
 * @desc    Get alerts for the dashboard
 * @access  Public
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    // Get time slots with insufficient staff (based on participant count and staff ratio)
    const staffingAlertsResult = await pool.query(
      `SELECT ts.id as time_slot_id, ts.segment_type, ts.start_time, ts.end_time,
              p.name as program_name, 
              COUNT(DISTINCT pp.participant_id) as participant_count,
              COUNT(DISTINCT ss.staff_id) as staff_count,
              p.staff_ratio
       FROM tgl_loom_time_slots ts
       JOIN programs p ON ts.program_id = p.id
       JOIN tgl_loom_instances li ON p.id = li.program_id
       LEFT JOIN program_participants pp ON p.id = pp.program_id
       LEFT JOIN tgl_loom_staff_shifts ss ON li.id = ss.loom_instance_id AND 
                                            (ss.time_slot_id = ts.id OR 
                                             (ss.time_slot_id IS NULL AND 
                                              ts.start_time <= ss.end_time AND ss.start_time <= ts.end_time))
       WHERE li.date = $1
       GROUP BY ts.id, ts.segment_type, ts.start_time, ts.end_time, p.name, p.staff_ratio
       HAVING COUNT(DISTINCT ss.staff_id) < CEIL(COUNT(DISTINCT pp.participant_id)::float / SUBSTRING(p.staff_ratio FROM '[0-9]+$')::float)`,
      [date]
    );
    
    // Get vehicle maintenance alerts affecting today's time slots
    const vehicleAlertsResult = await pool.query(
      `SELECT v.id, v.name, v.make, v.model, vb.reason, vb.start_date, vb.end_date,
              ts.id as time_slot_id, ts.segment_type, ts.start_time, ts.end_time,
              p.name as program_name
       FROM vehicles v
       JOIN vehicle_blackouts vb ON v.id = vb.vehicle_id
       JOIN tgl_loom_vehicle_runs vr ON v.id = vr.vehicle_id
       JOIN tgl_loom_instances li ON vr.loom_instance_id = li.id
       JOIN tgl_loom_time_slots ts ON (vr.time_slot_id = ts.id OR 
                                      (vr.time_slot_id IS NULL AND 
                                       ts.start_time <= vr.end_time AND vr.start_time <= ts.end_time))
       JOIN programs p ON li.program_id = p.id
       WHERE li.date = $1 AND $1 BETWEEN vb.start_date AND vb.end_date`,
      [date]
    );
    
    // Get staff unavailability alerts affecting today's time slots
    const staffAlertsResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, su.reason, su.start_date, su.end_date,
              ts.id as time_slot_id, ts.segment_type, ts.start_time, ts.end_time,
              p.name as program_name
       FROM staff s
       JOIN staff_unavailabilities su ON s.id = su.staff_id
       JOIN tgl_loom_staff_shifts ss ON s.id = ss.staff_id
       JOIN tgl_loom_instances li ON ss.loom_instance_id = li.id
       JOIN tgl_loom_time_slots ts ON (ss.time_slot_id = ts.id OR 
                                      (ss.time_slot_id IS NULL AND 
                                       ts.start_time <= ss.end_time AND ss.start_time <= ts.end_time))
       JOIN programs p ON li.program_id = p.id
       WHERE li.date = $1 AND $1 BETWEEN su.start_date AND su.end_date`,
      [date]
    );
    
    res.json({
      success: true,
      data: {
        staffing_alerts: staffingAlertsResult.rows,
        vehicle_alerts: vehicleAlertsResult.rows,
        staff_alerts: staffAlertsResult.rows,
        total_alerts: staffingAlertsResult.rows.length + 
                      vehicleAlertsResult.rows.length + 
                      staffAlertsResult.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
