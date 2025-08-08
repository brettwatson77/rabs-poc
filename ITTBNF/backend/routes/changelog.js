/**
 * backend/routes/changeLog.js
 *
 * API routes for the change logging system that provides endpoints
 * for retrieving change history and logging different types of changes.
 */

const express = require('express');
const router = express.Router();
const changeLogController = require('../controllers/changelogController');

// -----------------------------------------------------------------------------
// GET routes for retrieving change history
// -----------------------------------------------------------------------------

/**
 * Get participant change history
 * GET /api/v1/changes/participant/:id/changes
 */
router.get('/participant/:id/changes', changeLogController.getParticipantChangeHistory);

/**
 * Get changes for a specific date
 * GET /api/v1/changes/daily/:date/changes
 */
router.get('/daily/:date/changes', changeLogController.getDailyChanges);

/**
 * Get changes for a program instance
 * GET /api/v1/changes/instance/:id/changes
 */
router.get('/instance/:id/changes', changeLogController.getProgramInstanceChanges);

/**
 * Get changes with billing impact
 * GET /api/v1/changes/billing/changes
 */
router.get('/billing/changes', changeLogController.getBillingImpactChanges);

// -----------------------------------------------------------------------------
// POST routes for logging changes
// -----------------------------------------------------------------------------

/**
 * Log a participant joining a program
 * POST /api/v1/changes/participant/:id/join
 */
router.post('/participant/:id/join', changeLogController.logProgramJoin);

/**
 * Log a participant leaving a program
 * POST /api/v1/changes/participant/:id/leave
 */
router.post('/participant/:id/leave', changeLogController.logProgramLeave);

/**
 * Log a participant cancelling attendance for a specific date
 * POST /api/v1/changes/participant/:id/cancel
 */
router.post('/participant/:id/cancel', changeLogController.logProgramCancel);

/**
 * Log a program being rescheduled
 * POST /api/v1/changes/instance/:id/reschedule
 */
router.post('/instance/:id/reschedule', changeLogController.logProgramReschedule);

/**
 * Log a staff change (assign, unassign, replace)
 * POST /api/v1/changes/instance/:id/staff
 */
router.post('/instance/:id/staff', changeLogController.logStaffChange);

/**
 * Log a vehicle change (assign, unassign)
 * POST /api/v1/changes/instance/:id/vehicle
 */
router.post('/instance/:id/vehicle', changeLogController.logVehicleChange);

// -----------------------------------------------------------------------------
// PUT routes for updates
// -----------------------------------------------------------------------------

/**
 * Update billing status for a change
 * PUT /api/v1/changes/:id/billing
 */
router.put('/changes/:id/billing', changeLogController.updateBillingStatus);

module.exports = router;
