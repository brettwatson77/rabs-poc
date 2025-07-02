// backend/routes/participants.js
const express = require('express');
const participantController = require('../controllers/participantController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', participantController.getAllParticipants);
router.get('/:id', participantController.getParticipantById);
router.post('/', participantController.createParticipant);
router.put('/:id', participantController.updateParticipant);
router.delete('/:id', participantController.deleteParticipant);

// Export the router
module.exports = router;
