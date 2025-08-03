/**
 * Loom Configuration Controller
 * 
 * Handles configuration management, real-time controls, optimization,
 * and testing endpoints for the loom system.
 */

const { pool } = require('../database');
const logger = require('../utils/logger');
const loomLogicEngine = require('../services/loomLogicEngine');

/**
 * Get current loom configuration values
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getConfiguration = async (req, res) => {
  try {
    const config = await loomLogicEngine.loadConfiguration();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching loom configuration', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration',
      error: error.message
    });
  }
};

/**
 * Update loom configuration values
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateConfiguration = async (req, res) => {
  try {
    const settings = req.body;
    
    if (!settings || Object.keys(settings).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No settings provided'
      });
    }
    
    const result = await loomLogicEngine.updateConfiguration(settings);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Updated ${result.updated} configuration settings`,
        updatedKeys: result.keys
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update configuration',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error updating loom configuration', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: error.message
    });
  }
};

/**
 * Reset loom configuration to defaults
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetConfiguration = async (req, res) => {
  try {
    // Get the default configuration
    const defaultConfig = await loomLogicEngine.loadConfiguration();
    
    // Delete all existing configuration
    await pool.query(`
      DELETE FROM tgl_settings
      WHERE category = 'loom_logic'
    `);
    
    // Re-insert default values
    const result = await loomLogicEngine.updateConfiguration(defaultConfig);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Configuration reset to defaults',
        config: defaultConfig
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to reset configuration',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error resetting loom configuration', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to reset configuration',
      error: error.message
    });
  }
};

/**
 * Rebalance staff for a specific date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rebalanceStaff = async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const result = await loomLogicEngine.rebalanceStaffForDay(date);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Rebalanced staff for ${date}`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to rebalance staff',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error rebalancing staff', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to rebalance staff',
      error: error.message
    });
  }
};

/**
 * Process a specific instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processInstance = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    // Get instance details
    const { rows } = await pool.query(`
      SELECT 
        id, 
        program_id, 
        program_name, 
        date, 
        start_time, 
        end_time
      FROM tgl_loom_instances
      WHERE id = $1
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    const instance = rows[0];
    const result = await loomLogicEngine.processInstance(instance);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Processed instance ${id}`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to process instance',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error processing instance', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to process instance',
      error: error.message
    });
  }
};

/**
 * Handle participant cancellation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleCancellation = async (req, res) => {
  try {
    const { participant_id, date, reason } = req.body;
    
    if (!participant_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID and date are required'
      });
    }
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const result = await loomLogicEngine.handleParticipantCancellation(
      participant_id,
      date,
      reason || 'Cancelled via API'
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: `Handled cancellation for participant ${participant_id} on ${date}`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to handle cancellation',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error handling participant cancellation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to handle cancellation',
      error: error.message
    });
  }
};

/**
 * Handle staff absence
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleAbsence = async (req, res) => {
  try {
    const { staff_id, date, reason } = req.body;
    
    if (!staff_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID and date are required'
      });
    }
    
    // Validate date format
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    const result = await loomLogicEngine.handleStaffSickness(
      staff_id,
      date,
      reason || 'Absence reported via API'
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: `Handled absence for staff ${staff_id} on ${date}`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to handle staff absence',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error handling staff absence', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to handle staff absence',
      error: error.message
    });
  }
};

/**
 * Optimize bus route for participants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const optimizeRoute = async (req, res) => {
  try {
    const { participants, vehicle_id, type } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid participants array is required'
      });
    }
    
    if (!vehicle_id) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required'
      });
    }
    
    if (!type || !['PICKUP', 'DROPOFF'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid type is required (PICKUP or DROPOFF)'
      });
    }
    
    // Get vehicle details
    const { rows } = await pool.query(`
      SELECT id, name, registration, capacity, wheelchair_capacity
      FROM vehicles
      WHERE id = $1
    `, [vehicle_id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    const vehicle = rows[0];
    const config = await loomLogicEngine.loadConfiguration();
    
    const result = await loomLogicEngine.optimizeBusRoute(
      participants,
      vehicle,
      type,
      config
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: `Optimized ${type.toLowerCase()} route`,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to optimize route',
        error: result.error || result.message
      });
    }
  } catch (error) {
    logger.error('Error optimizing route', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to optimize route',
      error: error.message
    });
  }
};

/**
 * Optimize staff allocation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const optimizeStaffing = async (req, res) => {
  try {
    const { instance_id, participants } = req.body;
    
    if (!instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    // If participants not provided, fetch them from the database
    let participantData = participants;
    
    if (!participantData) {
      const { rows } = await pool.query(`
        SELECT 
          p.id as participant_id,
          p.first_name,
          p.last_name,
          p.supervision_multiplier,
          p.requires_wheelchair,
          pa.pickup_required,
          pa.dropoff_required,
          pa.billing_codes
        FROM tgl_loom_participant_allocations pa
        JOIN participants p ON pa.participant_id = p.id
        WHERE pa.instance_id = $1
        AND pa.status = 'CONFIRMED'
      `, [instance_id]);
      
      participantData = rows;
    }
    
    if (!participantData || participantData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants found for this instance'
      });
    }
    
    // Load configuration
    const config = await loomLogicEngine.loadConfiguration();
    
    // Calculate staff requirements
    const requirements = loomLogicEngine.calculateStaffRequirements(participantData, config);
    
    // Get instance details
    const { rows: instanceRows } = await pool.query(`
      SELECT id, program_id, program_name, date, start_time, end_time
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instance_id]);
    
    if (instanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    const instance = instanceRows[0];
    
    // Assign staff
    const assignedStaff = await loomLogicEngine.assignStaffToInstance(
      instance,
      participantData,
      config
    );
    
    res.json({
      success: true,
      message: 'Staff allocation optimized',
      data: {
        requirements,
        assigned_staff: assignedStaff,
        instance_id,
        participant_count: participantData.length
      }
    });
  } catch (error) {
    logger.error('Error optimizing staffing', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to optimize staffing',
      error: error.message
    });
  }
};

/**
 * Get optimization metrics for a date
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMetrics = async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }
    
    // Get instances for the date
    const { rows: instances } = await pool.query(`
      SELECT 
        id,
        program_name,
        start_time,
        end_time,
        participant_count,
        staff_count,
        financials
      FROM tgl_loom_instances
      WHERE date = $1
      ORDER BY start_time
    `, [date]);
    
    // Get staff utilization
    const { rows: staffUtilization } = await pool.query(`
      SELECT 
        s.id,
        s.first_name || ' ' || s.last_name as name,
        s.schads_level,
        COUNT(ss.id) as shift_count,
        SUM(
          EXTRACT(EPOCH FROM (i.end_time::time - i.start_time::time)) / 3600
        ) as total_hours
      FROM staff s
      LEFT JOIN tgl_loom_staff_shifts ss ON s.id = ss.staff_id
      LEFT JOIN tgl_loom_instances i ON ss.instance_id = i.id AND i.date = $1
      WHERE s.active = true
      GROUP BY s.id, s.first_name, s.last_name, s.schads_level
      ORDER BY total_hours DESC
    `, [date]);
    
    // Get vehicle utilization
    const { rows: vehicleUtilization } = await pool.query(`
      SELECT 
        v.id,
        v.name,
        v.registration,
        COUNT(vr.id) as run_count,
        SUM(vr.assigned_pickups) as total_pickups,
        SUM(vr.assigned_dropoffs) as total_dropoffs
      FROM vehicles v
      LEFT JOIN tgl_loom_vehicle_runs vr ON v.id = vr.vehicle_id
      LEFT JOIN tgl_loom_instances i ON vr.instance_id = i.id AND i.date = $1
      WHERE v.active = true
      GROUP BY v.id, v.name, v.registration
      ORDER BY run_count DESC
    `, [date]);
    
    // Calculate summary metrics
    let totalRevenue = 0;
    let totalStaffCosts = 0;
    let totalAdminCosts = 0;
    let totalProfitLoss = 0;
    let totalParticipants = 0;
    
    instances.forEach(instance => {
      const financials = instance.financials || {};
      totalRevenue += financials.revenue || 0;
      totalStaffCosts += financials.staff_costs || 0;
      totalAdminCosts += financials.admin_costs || 0;
      totalProfitLoss += financials.profit_loss || 0;
      totalParticipants += instance.participant_count || 0;
    });
    
    const profitMargin = totalRevenue > 0 ? (totalProfitLoss / totalRevenue) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        date,
        summary: {
          instance_count: instances.length,
          total_participants: totalParticipants,
          total_staff: staffUtilization.filter(s => s.shift_count > 0).length,
          total_vehicles: vehicleUtilization.filter(v => v.run_count > 0).length,
          financials: {
            revenue: totalRevenue,
            staff_costs: totalStaffCosts,
            admin_costs: totalAdminCosts,
            profit_loss: totalProfitLoss,
            profit_margin: profitMargin
          }
        },
        instances,
        staff_utilization: staffUtilization,
        vehicle_utilization: vehicleUtilization
      }
    });
  } catch (error) {
    logger.error('Error fetching optimization metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch optimization metrics',
      error: error.message
    });
  }
};

/**
 * Test card generation for an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testGenerateCards = async (req, res) => {
  try {
    const { instance_id } = req.params;
    
    if (!instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    // Get instance details
    const { rows: instanceRows } = await pool.query(`
      SELECT id, program_id, program_name, date, start_time, end_time
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instance_id]);
    
    if (instanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    const instance = instanceRows[0];
    
    // Get participants
    const { rows: participants } = await pool.query(`
      SELECT 
        p.id as participant_id,
        p.first_name,
        p.last_name,
        p.supervision_multiplier,
        p.requires_wheelchair,
        pa.pickup_required,
        pa.dropoff_required,
        pa.billing_codes
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = $1
      AND pa.status = 'CONFIRMED'
    `, [instance_id]);
    
    // Get assigned staff
    const { rows: staff } = await pool.query(`
      SELECT 
        s.id as staff_id,
        s.first_name,
        s.last_name,
        ss.role,
        s.schads_level,
        s.hourly_rate
      FROM tgl_loom_staff_shifts ss
      JOIN staff s ON ss.staff_id = s.id
      WHERE ss.instance_id = $1
    `, [instance_id]);
    
    // Get assigned vehicles
    const { rows: vehicles } = await pool.query(`
      SELECT 
        v.id as vehicle_id,
        v.name,
        v.registration,
        v.capacity,
        vr.assigned_pickups,
        vr.assigned_dropoffs
      FROM tgl_loom_vehicle_runs vr
      JOIN vehicles v ON vr.vehicle_id = v.id
      WHERE vr.instance_id = $1
    `, [instance_id]);
    
    // Load configuration
    const config = await loomLogicEngine.loadConfiguration();
    
    // Generate transport cards
    const transportCards = loomLogicEngine.generateTransportCards(
      instance,
      participants,
      vehicles,
      config
    );
    
    // Generate roster cards
    const rosterCards = loomLogicEngine.generateRosterCards(
      instance,
      staff,
      transportCards
    );
    
    // Calculate financial metrics
    const financialMetrics = loomLogicEngine.calculateFinancialMetrics(
      instance,
      participants,
      staff,
      config
    );
    
    // Combine all cards
    const allCards = [
      ...transportCards.pickupCards,
      {
        type: 'ACTIVITY',
        title: instance.program_name,
        date: instance.date,
        start_time: instance.start_time,
        end_time: instance.end_time,
        program_id: instance.program_id,
        program_instance_id: instance.id,
        participant_count: participants.length,
        staff_count: staff.length,
        financials: financialMetrics,
        notes: instance.notes || '',
        sequence_number: 1
      },
      ...transportCards.dropoffCards,
      ...rosterCards
    ];
    
    res.json({
      success: true,
      message: 'Test card generation completed',
      data: {
        instance,
        cards: {
          total: allCards.length,
          pickup: transportCards.pickupCards.length,
          activity: 1,
          dropoff: transportCards.dropoffCards.length,
          roster: rosterCards.length
        },
        all_cards: allCards,
        financials: financialMetrics
      }
    });
  } catch (error) {
    logger.error('Error testing card generation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to test card generation',
      error: error.message
    });
  }
};

/**
 * Test staff calculation for an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testCalculateStaff = async (req, res) => {
  try {
    const { instance_id } = req.params;
    
    if (!instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    // Get participants
    const { rows: participants } = await pool.query(`
      SELECT 
        p.id as participant_id,
        p.first_name,
        p.last_name,
        p.supervision_multiplier,
        p.requires_wheelchair,
        pa.pickup_required,
        pa.dropoff_required,
        pa.billing_codes
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = $1
      AND pa.status = 'CONFIRMED'
    `, [instance_id]);
    
    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants found for this instance'
      });
    }
    
    // Load configuration
    const config = await loomLogicEngine.loadConfiguration();
    
    // Calculate staff requirements
    const requirements = loomLogicEngine.calculateStaffRequirements(participants, config);
    
    // Get instance details
    const { rows: instanceRows } = await pool.query(`
      SELECT id, program_id, program_name, date, start_time, end_time
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instance_id]);
    
    if (instanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    const instance = instanceRows[0];
    
    // Assign staff
    const assignedStaff = await loomLogicEngine.assignStaffToInstance(
      instance,
      participants,
      config
    );
    
    res.json({
      success: true,
      message: 'Test staff calculation completed',
      data: {
        instance,
        participants: {
          count: participants.length,
          details: participants.map(p => ({
            id: p.participant_id,
            name: `${p.first_name} ${p.last_name}`,
            supervision_multiplier: p.supervision_multiplier || 1.0
          }))
        },
        requirements,
        assigned_staff: assignedStaff
      }
    });
  } catch (error) {
    logger.error('Error testing staff calculation', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to test staff calculation',
      error: error.message
    });
  }
};

/**
 * Test vehicle assignment for an instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testAssignVehicles = async (req, res) => {
  try {
    const { instance_id } = req.params;
    
    if (!instance_id) {
      return res.status(400).json({
        success: false,
        message: 'Instance ID is required'
      });
    }
    
    // Get instance details
    const { rows: instanceRows } = await pool.query(`
      SELECT id, program_id, program_name, date, start_time, end_time
      FROM tgl_loom_instances
      WHERE id = $1
    `, [instance_id]);
    
    if (instanceRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Instance not found'
      });
    }
    
    const instance = instanceRows[0];
    
    // Get participants
    const { rows: participants } = await pool.query(`
      SELECT 
        p.id as participant_id,
        p.first_name,
        p.last_name,
        p.supervision_multiplier,
        p.requires_wheelchair,
        pa.pickup_required,
        pa.dropoff_required,
        pa.billing_codes
      FROM tgl_loom_participant_allocations pa
      JOIN participants p ON pa.participant_id = p.id
      WHERE pa.instance_id = $1
      AND pa.status = 'CONFIRMED'
    `, [instance_id]);
    
    // Load configuration
    const config = await loomLogicEngine.loadConfiguration();
    
    // Assign vehicles
    const assignedVehicles = await loomLogicEngine.assignVehiclesToInstance(
      instance,
      participants,
      config
    );
    
    // Generate transport cards
    const transportCards = loomLogicEngine.generateTransportCards(
      instance,
      participants,
      assignedVehicles,
      config
    );
    
    res.json({
      success: true,
      message: 'Test vehicle assignment completed',
      data: {
        instance,
        participants: {
          count: participants.length,
          pickup_required: participants.filter(p => p.pickup_required).length,
          dropoff_required: participants.filter(p => p.dropoff_required).length,
          wheelchair_required: participants.filter(p => p.requires_wheelchair).length
        },
        assigned_vehicles: assignedVehicles,
        transport_cards: transportCards
      }
    });
  } catch (error) {
    logger.error('Error testing vehicle assignment', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to test vehicle assignment',
      error: error.message
    });
  }
};

module.exports = {
  // Configuration Management
  getConfiguration,
  updateConfiguration,
  resetConfiguration,
  
  // Real-time Control Endpoints
  rebalanceStaff,
  processInstance,
  handleCancellation,
  handleAbsence,
  
  // Optimization Endpoints
  optimizeRoute,
  optimizeStaffing,
  getMetrics,
  
  // Testing Endpoints
  testGenerateCards,
  testCalculateStaff,
  testAssignVehicles
};
