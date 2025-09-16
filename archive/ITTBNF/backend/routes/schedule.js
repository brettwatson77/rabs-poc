// backend/routes/schedule.js
const express = require('express');
const scheduleController = require('../controllers/scheduleController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', scheduleController.getSchedule);

// Export the router
module.exports = router;
