const express = require('express');
const router = express.Router();
const { handleCreateCancellation } = require('../controllers/cancellationController');

// POST /api/v1/cancellations
router.post('/', handleCreateCancellation);

module.exports = router;
