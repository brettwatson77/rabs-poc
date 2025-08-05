const express = require('express');
const router = express.Router();
const loomLogController = require('../controllers/loomLogController');

/**
 * @route   GET /api/v1/loom/logs
 * @desc    Get logs with filtering and pagination
 * @access  Private
 * @params  
 *   limit - Number of logs to return (default: 100)
 *   offset - Pagination offset (default: 0)
 *   severity - Filter by severity (ALL, INFO, WARN, ERROR, CRITICAL)
 *   category - Filter by category (ALL, RESOURCE, OPTIMIZATION, etc.)
 *   startDate - Filter logs after this date
 *   endDate - Filter logs before this date
 *   resolutionRequired - Filter logs that require resolution (true/false)
 */
router.get('/logs', loomLogController.getLogs);

/**
 * @route   POST /api/v1/loom/logs
 * @desc    Create a new log entry
 * @access  Private
 * @body    
 *   severity - Log severity level (INFO, WARN, ERROR, CRITICAL)
 *   category - Log category (RESOURCE, OPTIMIZATION, etc.)
 *   message - Log message
 *   details - Additional structured details (optional)
 *   affected_entities - Array of affected entities (optional)
 *   resolution_required - Whether resolution is required (optional)
 *   resolution_suggestions - Array of resolution suggestions (optional)
 */
router.post('/logs', loomLogController.createLog);

/**
 * @route   DELETE /api/v1/loom/logs
 * @desc    Clear all logs (development environment only)
 * @access  Private
 */
router.delete('/logs', loomLogController.clearLogs);

module.exports = router;
