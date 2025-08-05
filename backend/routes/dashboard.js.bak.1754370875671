/**
 * Dashboard Routes
 * 
 * API routes for dashboard cards and data.
 */

const express = require('express');
const programController = require('../controllers/programController');
const router = express.Router();

/**
 * @route   GET /api/v1/dashboard/cards/:date
 * @desc    Get all cards for a specific date
 * @params  date - Date in YYYY-MM-DD format
 * @returns Array of card objects for the dashboard
 * @access  Private
 */
router.get('/cards/:date', programController.getCardsByDate);

module.exports = router;
