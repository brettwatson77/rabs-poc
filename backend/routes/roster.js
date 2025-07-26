// backend/routes/roster.js
const express = require('express');
const rosterController = require('../controllers/rosterController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', rosterController.getRoster);

// Export the router
module.exports = router;
