// backend/routes/recalculation.js
const express = require('express');
const recalculationController = require('../controllers/recalculationController');

// Initialize router
const router = express.Router();

// Define the route to trigger the recalculation process
router.post('/', recalculationController.triggerRecalculation);

// Export the router
module.exports = router;
