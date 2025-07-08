// backend/routes/dynamicResources.js
const express = require('express');
const dynamicResourceController = require('../controllers/dynamicResourceController');

// Initialize router
const router = express.Router();

// Resource status routes
router.get('/status/:programInstanceId', dynamicResourceController.getResourceStatus);

// Rebalancing routes
router.post('/rebalance/:programInstanceId', dynamicResourceController.triggerRebalance);

// Participant change routes (add, cancel, leave)
router.post('/participant-change', dynamicResourceController.handleParticipantChangeRequest);

// Route optimization
router.post('/optimize-routes/:programInstanceId', dynamicResourceController.triggerRouteOptimization);
router.get('/routes/:programInstanceId', dynamicResourceController.getRouteDetails);

// Program creation with dynamic allocation
router.post('/programs', dynamicResourceController.createDynamicProgram);

// Export the router
module.exports = router;
