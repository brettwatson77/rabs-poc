// backend/routes/vehicles.js
const express = require('express');
const vehicleController = require('../controllers/vehicleController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', vehicleController.getAllVehicles);
router.get('/:id', vehicleController.getVehicleById);
router.post('/', vehicleController.createVehicle);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);

// Export the router
module.exports = router;
