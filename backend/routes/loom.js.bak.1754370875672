/**
 * backend/routes/loom.js
 *
 * API routes for the Loom system - dynamic resource allocation and scheduling
 */

const express = require('express');
const router = express.Router();
const loomController = require('../controllers/loomController');
const loomConfigController = require('../controllers/loomConfigController'); // <-- NEW

// Window Management
router.get('/window-size', loomController.getWindowSize);
// Current loom window (start & end dates)
router.get('/window',       loomController.getWindow);
router.post('/generate', loomController.generateWindow);
router.patch('/resize', loomController.resizeWindow);

// Instance Management
router.get('/instances', loomController.getInstances);
router.get('/instances/:id', loomController.getInstance);

// Resource Allocation
router.post('/instances/:id/allocate-participants', loomController.allocateParticipants);
router.post('/instances/:id/assign-staff', loomController.assignStaff);
router.post('/instances/:id/assign-vehicles', loomController.assignVehicles);

// Dynamic Updates
router.patch('/allocations/:id/cancel', loomController.cancelParticipant);
router.patch('/shifts/:id/sick', loomController.reportStaffSickness);

// Optimization
router.post('/instances/:id/reoptimize', loomController.reoptimizeInstance);

// ---------------------------------------------------------------------------
// Configuration Management
// ---------------------------------------------------------------------------
router.get('/config',           loomConfigController.getConfiguration);
router.post('/config',          loomConfigController.updateConfiguration);  // create/update many
router.post('/config/reset',    loomConfigController.resetConfiguration);

// ---------------------------------------------------------------------------
// Real-time Control Endpoints
// ---------------------------------------------------------------------------
router.post('/control/rebalance/:date',        loomConfigController.rebalanceStaff);
router.post('/control/process-instance/:id',   loomConfigController.processInstance);
router.post('/control/handle-cancellation',    loomConfigController.handleCancellation);
router.post('/control/handle-absence',         loomConfigController.handleAbsence);

// ---------------------------------------------------------------------------
// Optimization Endpoints
// ---------------------------------------------------------------------------
// Day-1 Manual Roll – triggers the loom roller immediately
//  Useful for testing after creating first participants/programs
router.post('/roll', loomController.rollNow);

router.post('/optimize/route',      loomConfigController.optimizeRoute);
router.post('/optimize/staffing',   loomConfigController.optimizeStaffing);
router.get('/metrics/:date',        loomConfigController.getMetrics);

// ---------------------------------------------------------------------------
// Testing Endpoints
// ---------------------------------------------------------------------------
router.get('/test/generate-cards/:instance_id',  loomConfigController.testGenerateCards);
router.get('/test/calculate-staff/:instance_id', loomConfigController.testCalculateStaff);
router.get('/test/assign-vehicles/:instance_id', loomConfigController.testAssignVehicles);

module.exports = router;
