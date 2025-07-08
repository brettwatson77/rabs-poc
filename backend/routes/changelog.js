// backend/routes/changelog.js
const express = require('express');
const changelogController = require('../controllers/changelogController');

// Initialize router
const router = express.Router();

// Define routes
// This route will fetch all pending changes that fall within a given week.
router.get('/weekly', changelogController.getWeeklyChangeLog);

// Export the router
module.exports = router;
