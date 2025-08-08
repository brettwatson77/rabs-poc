// backend/routes/rates.js
const express = require('express');
const rateController = require('../controllers/rateController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', rateController.getAllRateLineItems);
router.post('/', rateController.createRateLineItem);
router.get('/:id', rateController.getRateLineItemById);
router.put('/:id', rateController.updateRateLineItem);
router.delete('/:id', rateController.deleteRateLineItem);

// Export the router
module.exports = router;
