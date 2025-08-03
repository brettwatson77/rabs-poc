const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { validateUUID, validateDateRange } = require('../middleware/validation');

// ============================================================================
// VEHICLE BLACKOUT ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/availability/vehicles/:vehicleId/blackouts
 * @desc    Get all blackouts for a specific vehicle
 * @access  Private
 */
router.get('/vehicles/:vehicleId/blackouts', 
  validateUUID('vehicleId'),
  availabilityController.getVehicleBlackouts
);

/**
 * @route   POST /api/v1/availability/vehicles/:vehicleId/blackouts
 * @desc    Create a new blackout period for a vehicle
 * @access  Private
 */
router.post('/vehicles/:vehicleId/blackouts',
  validateUUID('vehicleId'),
  availabilityController.createVehicleBlackout
);

/**
 * @route   PUT /api/v1/availability/blackouts/:id
 * @desc    Update a vehicle blackout period
 * @access  Private
 */
router.put('/blackouts/:id',
  validateUUID('id'),
  availabilityController.updateVehicleBlackout
);

/**
 * @route   DELETE /api/v1/availability/blackouts/:id
 * @desc    Delete a vehicle blackout period
 * @access  Private
 */
router.delete('/blackouts/:id',
  validateUUID('id'),
  availabilityController.deleteVehicleBlackout
);

/**
 * @route   GET /api/v1/availability/vehicles/availability/:startTime/:endTime
 * @desc    Check vehicle availability for a date range
 * @access  Private
 */
router.get('/vehicles/availability/:startTime/:endTime',
  validateDateRange('startTime', 'endTime'),
  availabilityController.checkVehicleAvailability
);

// ============================================================================
// STAFF UNAVAILABILITY ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/availability/staff/:staffId/unavailabilities
 * @desc    Get all unavailability periods for a staff member
 * @access  Private
 */
router.get('/staff/:staffId/unavailabilities',
  validateUUID('staffId'),
  availabilityController.getStaffUnavailabilities
);

/**
 * @route   POST /api/v1/availability/staff/:staffId/unavailabilities
 * @desc    Create a new unavailability period for a staff member
 * @access  Private
 */
router.post('/staff/:staffId/unavailabilities',
  validateUUID('staffId'),
  availabilityController.createStaffUnavailability
);

/**
 * @route   PUT /api/v1/availability/unavailabilities/:id
 * @desc    Update a staff unavailability period
 * @access  Private
 */
router.put('/unavailabilities/:id',
  validateUUID('id'),
  availabilityController.updateStaffUnavailability
);

/**
 * @route   DELETE /api/v1/availability/unavailabilities/:id
 * @desc    Delete a staff unavailability period
 * @access  Private
 */
router.delete('/unavailabilities/:id',
  validateUUID('id'),
  availabilityController.deleteStaffUnavailability
);

/**
 * @route   GET /api/v1/availability/staff/availability/:startTime/:endTime
 * @desc    Check staff availability for a date range
 * @access  Private
 */
router.get('/staff/availability/:startTime/:endTime',
  validateDateRange('startTime', 'endTime'),
  availabilityController.checkStaffAvailability
);

// ============================================================================
// CONFLICT DETECTION HELPER ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/availability/conflicts/vehicle/:vehicleId/:startTime/:endTime
 * @desc    Check for conflicts between vehicle blackouts and loom instances
 * @access  Private
 */
router.get('/conflicts/vehicle/:vehicleId/:startTime/:endTime',
  validateUUID('vehicleId'),
  validateDateRange('startTime', 'endTime'),
  availabilityController.checkVehicleAvailability
);

/**
 * @route   GET /api/v1/availability/conflicts/staff/:staffId/:startTime/:endTime
 * @desc    Check for conflicts between staff unavailabilities and loom instances
 * @access  Private
 */
router.get('/conflicts/staff/:staffId/:startTime/:endTime',
  validateUUID('staffId'),
  validateDateRange('startTime', 'endTime'),
  availabilityController.checkStaffAvailability
);

module.exports = router;
