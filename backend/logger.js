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

// Valid severity levels (including CRITICAL from older schema)
const VALID_SEVERITIES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

// Allowed categories enforced by DB check constraint
const ALLOWED_CATEGORIES = [
  'RESOURCE',
  'OPTIMIZATION',
  'CONSTRAINT',
  'SYSTEM',
  'OPERATIONAL',
  'FINANCIAL'
];

// Cache for database schema introspection
let columnsCache = null;
let timestampColumnCache = null;

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
 * Get all available columns in the system_logs table
 * @returns {Promise<string[]>} Array of column names
 */
async function getSystemLogsColumns() {
  if (columnsCache) {
    return columnsCache;
  }

  if (!pool) {
    console.error('Logger not initialized with database pool');
    return [];
  }

  try {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'system_logs'
    `;
    
    const result = await pool.query(query);
    columnsCache = result.rows.map(row => row.column_name);
    return columnsCache;
  } catch (error) {
    console.error('Failed to fetch system_logs columns:', error);
    return ['id', 'severity', 'category', 'message', 'details']; // Fallback to minimal columns
  }
}

/**
 * Determine the preferred timestamp column to use
 * @returns {Promise<string>} The name of the timestamp column to use
 */
async function getPreferredTimestampColumn() {
  if (timestampColumnCache) {
    return timestampColumnCache;
  }

  const columns = await getSystemLogsColumns();
  
  // Check for timestamp columns in order of preference
  const preferredColumns = ['ts', 'timestamp', 'created_at', 'updated_at'];
  for (const col of preferredColumns) {
    if (columns.includes(col)) {
      timestampColumnCache = col;
      return col;
    }
  }
  
  // If none found, default to 'id' as a last resort
  console.warn('No timestamp column found in system_logs table, using id for ordering');
  timestampColumnCache = 'id';
  return 'id';
}

/**
 * Normalize a log row to ensure consistent structure regardless of DB schema
 * @param {Object} row - Database row
 * @returns {Object} Normalized log entry
 */
function normalizeLogRow(row) {
  if (!row) return null;
  
  // Determine which timestamp field to use for 'ts'
  const timestamp = row.ts || row.timestamp || row.created_at || row.updated_at || new Date();
  
  return {
    id: row.id,
    ts: timestamp,
    severity: row.severity || 'INFO',
    category: row.category || 'SYSTEM',
    message: row.message || '',
    details: row.details || null,
    entity: row.entity || null,
    entity_id: row.entity_id || null,
    actor: row.actor || null
  };
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
 * @param {string} [options.severity='INFO'] - Log severity (DEBUG, INFO, WARN, ERROR, CRITICAL)
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

  // Normalise category and validate against allowed list
  category = String(category || 'SYSTEM').toUpperCase();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = 'SYSTEM';
  }

  // Ensure details is either null or an object that can be JSON-encoded
  if (details && typeof details !== 'object') {
    details = { value: details };
  }
  
  try {
    const id = uuidv4();
    
    // Get available columns to build dynamic query
    const availableColumns = await getSystemLogsColumns();
    
    // Always include these core columns
    const columns = ['id', 'severity', 'category', 'message'];
    const values = [id, severity, category, message];
    let paramIndex = 5;
    
    // Conditionally add optional columns if they exist in the schema
    if (availableColumns.includes('details')) {
      columns.push('details');
      values.push(details);
    }
    
    if (availableColumns.includes('entity')) {
      columns.push('entity');
      values.push(entity);
    }
    
    if (availableColumns.includes('entity_id')) {
      columns.push('entity_id');
      values.push(entity_id);
    }
    
    if (availableColumns.includes('actor')) {
      columns.push('actor');
      values.push(actor);
    }
    
    // Build the parameterized query
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      INSERT INTO system_logs (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    const logRow = normalizeLogRow(result.rows[0]);
    
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
 * @param {string} [options.sinceId=null] - Only return logs after this ID (not used - UUID ordering is not chronological)
 * @param {string|Date} [options.sinceTs=null] - Only return logs after this timestamp
 * @returns {Promise<Array>} - Array of log entries
 */
async function getRecent({
  limit = 100,
  sinceId = null, // Not used for filtering as UUID ordering is not chronological
  sinceTs = null
} = {}) {
  if (!pool) {
    console.error('Logger not initialized with database pool');
    return [];
  }
  
  try {
    // Get the preferred timestamp column for ordering and filtering
    const tsColumn = await getPreferredTimestampColumn();
    
    // Build query conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Only filter by timestamp if we have a valid timestamp column
    if (sinceTs && tsColumn !== 'id') {
      conditions.push(`${tsColumn} > $${paramIndex++}`);
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
      SELECT *
      FROM system_logs
      ${whereClause}
      ORDER BY ${tsColumn} DESC
      LIMIT $${params.length}
    `;
    
    const result = await pool.query(query, params);
    
    // Normalize each row to ensure consistent structure
    return result.rows.map(normalizeLogRow);
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
