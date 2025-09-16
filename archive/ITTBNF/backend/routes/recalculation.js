// backend/routes/recalculation.js
const express = require('express');
const recalculationController = require('../controllers/recalculationController');

const router = express.Router();

// Route to trigger the processing of pending enrollment changes
router.post('/process', recalculationController.processPendingChanges);

module.exports = router;
