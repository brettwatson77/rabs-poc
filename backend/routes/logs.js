/**
 * Logs API Routes
 * 
 * Endpoints for system logs:
 * - GET /logs - Get recent logs with pagination
 * - POST /logs - Create a client-side log entry
 * - GET /logs/stream - SSE stream for real-time log updates
 */

const express = require('express');
const router = express.Router();
const logger = require('../logger');

/**
 * GET /logs
 * 
 * Get recent logs with optional filtering
 * Query parameters:
 * - limit: Maximum number of logs to return (default: 100, max: 1000)
 * - sinceTs: Only return logs after this timestamp (ISO string)
 * - sinceId: Only return logs after this ID (UUID)
 */
router.get('/', async (req, res) => {
  try {
    const { limit, sinceTs, sinceId } = req.query;
    
    const logs = await logger.getRecent({
      limit: limit ? parseInt(limit, 10) : 100,
      sinceTs: sinceTs || null,
      sinceId: sinceId || null
    });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: error.message
    });
  }
});

/**
 * POST /logs
 * 
 * Create a new log entry from client
 * Body: {
 *   severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
 *   category: string,
 *   message: string (required),
 *   details: object,
 *   entity: string,
 *   entity_id: string (UUID),
 *   actor: string
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { severity, category, message, details, entity, entity_id, actor } = req.body;
    
    // Validate required fields
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Message is required and must be a string'
      });
    }
    
    // Log the event
    const logEntry = await logger.logEvent({
      severity: severity || 'INFO',
      category: category || 'CLIENT',
      message,
      details,
      entity,
      entity_id,
      actor
    });
    
    if (!logEntry) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create log entry'
      });
    }
    
    res.status(201).json({
      success: true,
      data: logEntry
    });
  } catch (error) {
    console.error('Error creating log entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create log entry',
      message: error.message
    });
  }
});

/**
 * GET /logs/stream
 * 
 * SSE endpoint for real-time log streaming
 * No parameters - establishes a persistent connection
 */
router.get('/stream', (req, res) => {
  // Set up SSE connection
  logger.addClient(res);
  
  // No need to send a response as the SSE connection is established
  // and managed by the logger
});

module.exports = router;
