// backend/controllers/dynamicResourceController.js

const { 
  rebalanceResources,
  handleParticipantChange,
  optimizeRoutes,
  getParticipantsForInstance,
  getProgramInstanceDetails,
  BASE_LOCATION
} = require('../services/dynamicResourceService');
const { getDbConnection } = require('../database');

/**
 * Trigger resource rebalancing for a program instance
 * This recalculates staff and vehicle allocations based on current participants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const triggerRebalance = async (req, res) => {
  // Historically the frontend only sent a single numeric path param.
  // It can now represent EITHER:
  //   • a program instance ID  (primary key of program_instances)
  //   • a program ID          (primary key of programs  – optimise *all* future instances)
  //
  // For backward-compatibility keep the same param name but add detection logic.
  const { programInstanceId: idParam } = req.params;
  
  if (!idParam) {
    return res.status(400).json({
      success: false,
      message: 'Program instance ID is required'
    });
  }
  
  try {
    // Validate that the program instance exists
    const db = await getDbConnection();
    /* -----------------------------------------------------------
     * STEP 1 – Try treat param as a PROGRAM INSTANCE id
     * --------------------------------------------------------- */
    const instanceRow = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, program_id FROM program_instances WHERE id = ?',
        [idParam],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    let results = [];

    if (instanceRow) {
      // Single-instance optimisation
      const rebalanceResult = await rebalanceResources(Number(instanceRow.id));
      results.push(rebalanceResult);
    } else {
      /* -------------------------------------------------------
       * STEP 2 – Treat param as a PROGRAM id (optimise ALL
       *          upcoming instances for that program)
       * ----------------------------------------------------- */
      const upcomingInstances = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id
             FROM program_instances
            WHERE program_id = ?
              AND date >= DATE('now')`,
          [idParam],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (upcomingInstances.length === 0) {
        db.close();
        return res.status(404).json({
          success: false,
          message: `No program instances found for ID ${idParam}`
        });
      }

      // Optimise each instance sequentially to avoid DB locks
      for (const row of upcomingInstances) {
        try {
          const rebalanceResult = await rebalanceResources(Number(row.id));
          results.push(rebalanceResult);
        } catch (err) {
          console.error(`Rebalance failed for instance ${row.id}:`, err);
        }
      }
    }

    db.close();

    res.status(200).json({
      success: true,
      message: 'Resources rebalanced successfully',
      data: results
    });
  } catch (error) {
    console.error(`Error rebalancing resources for identifier ${idParam}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error rebalancing resources',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle participant change (add, cancel, leave)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleParticipantChangeRequest = async (req, res) => {
  const { participantId, programInstanceId, changeType } = req.body;
  
  // Validate required parameters
  if (!participantId || !programInstanceId || !changeType) {
    return res.status(400).json({
      success: false,
      message: 'Participant ID, program instance ID, and change type are required'
    });
  }
  
  // Validate change type
  const validChangeTypes = ['add', 'cancel', 'leave'];
  if (!validChangeTypes.includes(changeType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid change type. Must be one of: ${validChangeTypes.join(', ')}`
    });
  }
  
  try {
    // Process the participant change
    const result = await handleParticipantChange(
      parseInt(participantId, 10),
      parseInt(programInstanceId, 10),
      changeType
    );
    
    res.status(200).json({
      success: true,
      message: `Participant ${changeType} processed successfully`,
      data: result
    });
  } catch (error) {
    console.error(`Error handling participant ${changeType}:`, error);
    res.status(500).json({
      success: false,
      message: `Error handling participant ${changeType}`,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get current resource allocation status for a program instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getResourceStatus = async (req, res) => {
  const { programInstanceId } = req.params;
  
  if (!programInstanceId) {
    return res.status(400).json({
      success: false,
      message: 'Program instance ID is required'
    });
  }
  
  try {
    const db = await getDbConnection();
    
    try {
      // Get program instance details
      const instance = await new Promise((resolve, reject) => {
        db.get(
          `SELECT 
            pi.id,
            pi.program_id,
            pi.date,
            pi.start_time,
            pi.end_time,
            p.name AS program_name,
            v.name AS venue_name
          FROM program_instances pi
          JOIN programs p ON pi.program_id = p.id
          LEFT JOIN venues v ON pi.venue_id = v.id OR p.venue_id = v.id
          WHERE pi.id = ?`,
          [programInstanceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (!instance) {
        return res.status(404).json({
          success: false,
          message: `Program instance with ID ${programInstanceId} not found`
        });
      }
      
      // Get participant count
      const participantCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) AS count
           FROM attendance
           WHERE program_instance_id = ? AND status != 'cancelled'`,
          [programInstanceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
          }
        );
      });
      
      // Get staff assignments
      const staffAssignments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            sa.id,
            sa.staff_id,
            sa.role,
            s.first_name,
            s.last_name
           FROM staff_assignments sa
           JOIN staff s ON sa.staff_id = s.id
           WHERE sa.program_instance_id = ?`,
          [programInstanceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      // Get vehicle assignments
      const vehicleAssignments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            va.id,
            va.vehicle_id,
            va.driver_staff_id,
            v.description,
            v.seats,
            v.registration,
            s.first_name AS driver_first_name,
            s.last_name AS driver_last_name
           FROM vehicle_assignments va
           JOIN vehicles v ON va.vehicle_id = v.id
           LEFT JOIN staff s ON va.driver_staff_id = s.id
           WHERE va.program_instance_id = ?`,
          [programInstanceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      // Get routes
      const routes = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            r.id,
            r.vehicle_assignment_id,
            r.route_type,
            r.estimated_duration,
            r.estimated_distance,
            va.vehicle_id,
            v.registration
           FROM routes r
           JOIN vehicle_assignments va ON r.vehicle_assignment_id = va.id
           JOIN vehicles v ON va.vehicle_id = v.id
           WHERE va.program_instance_id = ?`,
          [programInstanceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      // Calculate required staff and vehicles based on participant count
      const requiredStaff = Math.ceil(participantCount / 4);
      const preferredVehicleCount = Math.ceil(participantCount / 5);
      
      const status = {
        programInstanceId: parseInt(programInstanceId, 10),
        programName: instance.program_name,
        date: instance.date,
        time: `${instance.start_time} - ${instance.end_time}`,
        venue: instance.venue_name,
        participants: {
          count: participantCount,
          ratio: '4:1' // 4 participants per staff
        },
        staff: {
          required: requiredStaff,
          assigned: staffAssignments.length,
          assignments: staffAssignments,
          status: staffAssignments.length >= requiredStaff ? 'adequate' : 'understaffed'
        },
        vehicles: {
          preferred: preferredVehicleCount,
          assigned: vehicleAssignments.length,
          assignments: vehicleAssignments,
          status: vehicleAssignments.length >= preferredVehicleCount ? 'adequate' : 'insufficient'
        },
        routes: {
          count: routes.length,
          details: routes
        }
      };
      
      res.status(200).json({
        success: true,
        data: status
      });
      
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`Error getting resource status for program instance ${programInstanceId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error getting resource status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Manually trigger route optimization for a program instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const triggerRouteOptimization = async (req, res) => {
  const { programInstanceId } = req.params;
  
  if (!programInstanceId) {
    return res.status(400).json({
      success: false,
      message: 'Program instance ID is required'
    });
  }
  
  try {
    // Optimize routes for the program instance
    const routes = await optimizeRoutes(parseInt(programInstanceId, 10));
    
    res.status(200).json({
      success: true,
      message: 'Routes optimized successfully',
      data: routes
    });
  } catch (error) {
    console.error(`Error optimizing routes for program instance ${programInstanceId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error optimizing routes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get route details for a program instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRouteDetails = async (req, res) => {
  const { programInstanceId } = req.params;
  
  if (!programInstanceId) {
    return res.status(400).json({
      success: false,
      message: 'Program instance ID is required'
    });
  }
  
  try {
    const db = await getDbConnection();
    
    try {
      // Get vehicle assignments for the program instance
      const vehicleAssignments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            va.id,
            va.vehicle_id,
            va.driver_staff_id,
            v.description,
            v.registration,
            s.first_name AS driver_first_name,
            s.last_name AS driver_last_name
           FROM vehicle_assignments va
           JOIN vehicles v ON va.vehicle_id = v.id
           LEFT JOIN staff s ON va.driver_staff_id = s.id
           WHERE va.program_instance_id = ?`,
          [programInstanceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
      
      // Get routes for each vehicle assignment
      const routeDetails = [];
      
      for (const assignment of vehicleAssignments) {
        // Get routes for this vehicle assignment
        const routes = await new Promise((resolve, reject) => {
          db.all(
            `SELECT 
              r.id,
              r.route_type,
              r.estimated_duration,
              r.estimated_distance
             FROM routes r
             WHERE r.vehicle_assignment_id = ?`,
            [assignment.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
        
        // Get stops for each route
        for (const route of routes) {
          const stops = await new Promise((resolve, reject) => {
            db.all(
              `SELECT 
                rs.id,
                rs.stop_order,
                rs.participant_id,
                rs.venue_id,
                rs.address,
                rs.suburb,
                rs.state,
                rs.postcode,
                rs.estimated_arrival_time,
                p.first_name,
                p.last_name,
                v.name AS venue_name
               FROM route_stops rs
               LEFT JOIN participants p ON rs.participant_id = p.id
               LEFT JOIN venues v ON rs.venue_id = v.id
               WHERE rs.route_id = ?
               ORDER BY rs.stop_order`,
              [route.id],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              }
            );
          });
          
          // Format stops with type information
          const formattedStops = stops.map(stop => {
            let stopType = 'unknown';
            let name = '';
            
            if (stop.participant_id) {
              stopType = 'participant';
              name = `${stop.first_name} ${stop.last_name}`;
            } else if (stop.venue_id) {
              stopType = 'venue';
              name = stop.venue_name;
            } else {
              stopType = 'depot';
              name = 'Depot';
            }
            
            return {
              ...stop,
              type: stopType,
              name
            };
          });
          
          routeDetails.push({
            vehicleId: assignment.vehicle_id,
            vehicleDescription: assignment.description,
            registration: assignment.registration,
            driver: assignment.driver_staff_id ? 
              `${assignment.driver_first_name} ${assignment.driver_last_name}` : 
              'Unassigned',
            routeId: route.id,
            routeType: route.route_type,
            estimatedDuration: route.estimated_duration,
            estimatedDistance: route.estimated_distance,
            stops: formattedStops,
            baseLocation: BASE_LOCATION
          });
        }
      }
      
      res.status(200).json({
        success: true,
        data: {
          programInstanceId: parseInt(programInstanceId, 10),
          routes: routeDetails
        }
      });
      
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(`Error getting route details for program instance ${programInstanceId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error getting route details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a new program with dynamic resource allocation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createDynamicProgram = async (req, res) => {
  const { 
    name,
    description,
    dayOfWeek,
    startTime,
    endTime,
    venueId,
    isCentreBased,
    repeatPattern // 'weekly', 'fortnightly', 'monthly', etc.
  } = req.body;
  
  // Validate required fields
  if (!name || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Name, day of week, start time, and end time are required'
    });
  }
  
  // Validate day of week (0-6)
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({
      success: false,
      message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
    });
  }
  
  try {
    const db = await getDbConnection();
    
    try {
      // Begin transaction
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      try {
        // Insert new program
        const programId = await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO programs 
             (name, description, day_of_week, start_time, end_time, is_weekend, is_centre_based, venue_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              name,
              description || '',
              dayOfWeek,
              startTime,
              endTime,
              dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0, // is_weekend
              isCentreBased ? 1 : 0,
              venueId || null
            ],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
        
        // Generate program instances based on repeat pattern
        // For this example, we'll create instances for the next 8 weeks
        const today = new Date();
        const daysToAdd = (dayOfWeek - today.getDay() + 7) % 7; // Next occurrence of day_of_week
        const firstDate = new Date(today);
        firstDate.setDate(today.getDate() + daysToAdd);
        
        const instances = [];
        
        // Create 8 weekly instances
        for (let i = 0; i < 8; i++) {
          const instanceDate = new Date(firstDate);
          instanceDate.setDate(firstDate.getDate() + (i * 7)); // Add weeks
          
          // Format date as YYYY-MM-DD
          const dateString = instanceDate.toISOString().split('T')[0];
          
          // Insert program instance
          const instanceId = await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO program_instances 
               (program_id, date, start_time, end_time, venue_id)
               VALUES (?, ?, ?, ?, ?)`,
              [
                programId,
                dateString,
                startTime,
                endTime,
                venueId || null
              ],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
          
          instances.push({
            id: instanceId,
            date: dateString
          });
        }
        
        // Commit transaction
        await new Promise((resolve, reject) => {
          db.run('COMMIT', err => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        res.status(201).json({
          success: true,
          message: 'Dynamic program created successfully',
          data: {
            programId,
            name,
            dayOfWeek,
            startTime,
            endTime,
            instances
          }
        });
        
      } catch (error) {
        // Rollback on error
        await new Promise(resolve => {
          db.run('ROLLBACK', () => resolve());
        });
        throw error;
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('Error creating dynamic program:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating dynamic program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  triggerRebalance,
  handleParticipantChangeRequest,
  getResourceStatus,
  triggerRouteOptimization,
  getRouteDetails,
  createDynamicProgram
};
