// backend/routes/planner.js
const express = require('express');
const plannerController = require('../controllers/plannerController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/:participantId', plannerController.getParticipantEnrollments);
// Change-log / history route
router.get('/:participantId/history', plannerController.getChangeHistory);
// Enrollment-only change history (Participant Planner actions)
router.get(
  '/:participantId/enrollment-history',
  plannerController.getParticipantEnrollmentHistory
);
router.post('/:participantId', plannerController.updateParticipantEnrollments);

// Export the router
module.exports = router;
