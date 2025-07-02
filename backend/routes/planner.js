// backend/routes/planner.js
const express = require('express');
const plannerController = require('../controllers/plannerController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/:participantId', plannerController.getParticipantEnrollments);
router.post('/:participantId', plannerController.updateParticipantEnrollments);

// Export the router
module.exports = router;
