// backend/routes/roster.js
const express = require('express');
const rosterController = require('../controllers/rosterController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', rosterController.getRoster);

// Financial metrics for roster period
router.get('/financial-metrics', rosterController.getFinancialMetrics);

// Timesheet data for roster period
router.get('/timesheets', rosterController.getTimesheets);

// Export the router
module.exports = router;
