/**
 * backend/routes/loom.js
 *
 * API routes for the Loom system - dynamic resource allocation and scheduling
 */

const express = require('express');
const router = express.Router();
const loomController = require('../controllers/loomController');

// Window Management
router.get('/window-size', loomController.getWindowSize);
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

module.exports = router;
