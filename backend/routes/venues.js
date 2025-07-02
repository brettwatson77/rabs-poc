// backend/routes/venues.js
const express = require('express');
const venueController = require('../controllers/venueController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', venueController.getAllVenues);
router.get('/:id', venueController.getVenueById);
router.post('/', venueController.createVenue);
router.put('/:id', venueController.updateVenue);
router.delete('/:id', venueController.deleteVenue);

// Export the router
module.exports = router;
