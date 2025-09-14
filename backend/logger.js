/**
 * Logger Module
 * 
 * Central logging service that writes to PostgreSQL system_logs table
 * and broadcasts events via Server-Sent Events (SSE).
 */

const { v4: uuidv4 } = require('uuid');

// Module state
let pool = null;
const clients = new Set();

// Valid severity levels
const VALID_SEVERITIES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

/**
 * Initialize the logger with a database pool
 * @param {Object} options - Configuration options
 * @param {Object} options.pool - PostgreSQL connection pool
 */
function init({ pool: pgPool }) {
  pool = pgPool;
  console.log('Logger initialized with database pool');
}

/**
 * Register a new SSE client
 * @param {Object} res - Express response object
 */
function addClient(res) {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial heartbeat
  res.write('event: connected\ndata: {"connected": true}\n\n');
  
  // Add to clients set
  clients.add(res);
  console.log(`SSE client connected (${clients.size} total)`);
  
  // Handle client disconnect
  res.on('close', () => {
    removeClient(res);
  });
}

/**
 * Remove an SSE client
 * @param {Object} res - Express response object
 */
function removeClient(res) {
  clients.delete(res);
  console.log(`SSE client disconnected (${clients.size} remaining)`);
}

/**
 * Log an event to the database and broadcast to SSE clients
 * @param {Object} options - Log options
 * @param {string} [options.severity='INFO'] - Log severity (DEBUG, INFO, WARN, ERROR)
 * @param {string} [options.category='SYSTEM'] - Log category
 * @param {string} options.message - Log message
 * @param {Object} [options.details=null] - Additional details (stored as JSONB)
 * @param {string} [options.entity=null] - Entity type (e.g., 'participant', 'program')
 * @param {string} [options.entity_id=null] - Entity ID
 * @param {string} [options.actor=null] - Actor who performed the action
 * @returns {Promise<Object>} - The inserted log row
 */
async function logEvent({
  severity = 'INFO',
  category = 'SYSTEM',
  message,
  details = null,
  entity = null,
  entity_id = null,
  actor = null
}) {
  if (!pool) {
    console.error('Logger not initialized with database pool');
    return null;
  }
  
  if (!message) {
    console.error('Log message is required');
    return null;
  }
  
  // Normalize severity and validate
  severity = severity.toUpperCase();
  if (!VALID_SEVERITIES.includes(severity)) {
    severity = 'INFO';
  }
  
  try {
    const id = uuidv4();
    
    const result = await pool.query(
      `INSERT INTO system_logs 
       (id, severity, category, message, details, entity, entity_id, actor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, ts, severity, category, message, details, entity, entity_id, actor`,
      [id, severity, category, message, details, entity, entity_id, actor]
    );
    
    const logRow = result.rows[0];
    
    // Broadcast to all connected clients
    broadcast(logRow);
    
    return logRow;
  } catch (error) {
    console.error('Failed to insert log:', error);
    return null;
  }
}

/**
 * Broadcast a log entry to all connected SSE clients
 * @param {Object} logEntry - The log entry to broadcast
 */
function broadcast(logEntry) {
  const data = JSON.stringify(logEntry);
  const message = `data: ${data}\n\n`;
  
  clients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      console.error('Error sending to SSE client:', error);
      removeClient(client);
    }
  });
}

/**
 * Get recent log entries
 * @param {Object} options - Query options
 * @param {number} [options.limit=100] - Maximum number of logs to return
 * @param {string} [options.sinceId=null] - Only return logs after this ID
 * @param {string|Date} [options.sinceTs=null] - Only return logs after this timestamp
 * @returns {Promise<Array>} - Array of log entries
 */
async function getRecent({
  limit = 100,
  sinceId = null,
  sinceTs = null
} = {}) {
  if (!pool) {
    console.error('Logger not initialized with database pool');
    return [];
  }
  
  try {
    // Build query conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (sinceId) {
      conditions.push(`id > $${paramIndex++}`);
      params.push(sinceId);
    }
    
    if (sinceTs) {
      conditions.push(`ts > $${paramIndex++}`);
      params.push(sinceTs instanceof Date ? sinceTs : new Date(sinceTs));
    }
    
    // Ensure limit is a number and reasonable
    limit = Number(limit) || 100;
    limit = Math.min(Math.max(1, limit), 1000); // Between 1 and 1000
    
    // Add limit parameter
    params.push(limit);
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    const query = `
      SELECT id, ts, severity, category, message, details, entity, entity_id, actor
      FROM system_logs
      ${whereClause}
      ORDER BY ts DESC
      LIMIT $${params.length}
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch recent logs:', error);
    return [];
  }
}

module.exports = {
  init,
  addClient,
  removeClient,
  logEvent,
  getRecent
};
