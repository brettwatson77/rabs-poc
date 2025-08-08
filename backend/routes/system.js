/**
 * System API Routes
 * 
 * Endpoints for system management:
 * - GET /system/logs - Get system logs
 * - POST /system/logs - Create log entry
 * - DELETE /system/logs - Clear logs
 * - GET /system/health - Extended health check
 * - POST /system/backup - Backup database
 * - GET /system/info - System information
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// GET /system/logs - Get system logs
router.get('/logs', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      level, 
      source,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = req.query;
    
    // Build query with optional filters
    let query = `
      SELECT id, level, message, source, details, created_at
      FROM system_logs
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (level) {
      query += ` AND level = $${paramIndex++}`;
      queryParams.push(level);
    }
    
    if (source) {
      query += ` AND source = $${paramIndex++}`;
      queryParams.push(source);
    }
    
    if (start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(end_date);
    }
    
    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM system_logs
      WHERE 1=1
    `;
    
    let countParams = [];
    let countParamIndex = 1;
    
    if (level) {
      countQuery += ` AND level = $${countParamIndex++}`;
      countParams.push(level);
    }
    
    if (source) {
      countQuery += ` AND source = $${countParamIndex++}`;
      countParams.push(source);
    }
    
    if (start_date) {
      countQuery += ` AND created_at >= $${countParamIndex++}`;
      countParams.push(start_date);
    }
    
    if (end_date) {
      countQuery += ` AND created_at <= $${countParamIndex++}`;
      countParams.push(end_date);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: total > parseInt(offset) + result.rowCount
      }
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system logs',
      message: error.message
    });
  }
});

// POST /system/logs - Create log entry
router.post('/logs', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { level, message, source, details } = req.body;
    
    // Validate required fields
    if (!level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'level and message are required'
      });
    }
    
    // Validate log level
    const validLevels = ['debug', 'info', 'warning', 'error', 'critical'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid log level',
        message: `level must be one of: ${validLevels.join(', ')}`
      });
    }
    
    const query = `
      INSERT INTO system_logs (level, message, source, details)
      VALUES ($1, $2, $3, $4)
      RETURNING id, level, message, source, details, created_at
    `;
    
    const values = [
      level,
      message,
      source || 'api',
      details || null
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Log entry created successfully'
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

// DELETE /system/logs - Clear logs
router.delete('/logs', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { 
      level, 
      source,
      start_date,
      end_date,
      confirm
    } = req.query;
    
    // Require confirmation for safety
    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Add ?confirm=true to confirm log deletion'
      });
    }
    
    // Build query with optional filters
    let query = `DELETE FROM system_logs WHERE 1=1`;
    
    const queryParams = [];
    let paramIndex = 1;
    
    if (level) {
      query += ` AND level = $${paramIndex++}`;
      queryParams.push(level);
    }
    
    if (source) {
      query += ` AND source = $${paramIndex++}`;
      queryParams.push(source);
    }
    
    if (start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      queryParams.push(start_date);
    }
    
    if (end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      queryParams.push(end_date);
    }
    
    // Execute deletion
    const result = await pool.query(query, queryParams);
    
    // Create a log entry about the deletion
    await pool.query(
      `INSERT INTO system_logs (level, message, source, details)
       VALUES ($1, $2, $3, $4)`,
      [
        'info',
        'System logs cleared',
        'system',
        {
          deleted_rows: result.rowCount,
          filters: {
            level,
            source,
            start_date,
            end_date
          }
        }
      ]
    );
    
    res.json({
      success: true,
      data: {
        deleted_rows: result.rowCount
      },
      message: `Successfully deleted ${result.rowCount} log entries`
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
      message: error.message
    });
  }
});

// GET /system/health - Extended health check
router.get('/health', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const startTime = Date.now();
    
    // Check database connection
    const dbResult = await pool.query('SELECT NOW() as time');
    const dbResponseTime = Date.now() - startTime;
    
    // Check system resources
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: os.cpus(),
      load_average: os.loadavg()
    };
    
    // Check database size
    const dbSizeQuery = `
      SELECT pg_database_size(current_database()) as size,
             pg_size_pretty(pg_database_size(current_database())) as size_pretty
    `;
    
    const dbSizeResult = await pool.query(dbSizeQuery);
    
    // Check table counts
    const tableCountsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM participants) as participants_count,
        (SELECT COUNT(*) FROM staff) as staff_count,
        (SELECT COUNT(*) FROM programs) as programs_count,
        (SELECT COUNT(*) FROM loom_instances) as loom_instances_count,
        (SELECT COUNT(*) FROM vehicles) as vehicles_count,
        (SELECT COUNT(*) FROM system_logs) as system_logs_count
    `;
    
    const tableCountsResult = await pool.query(tableCountsQuery);
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        database: {
          connected: true,
          response_time_ms: dbResponseTime,
          current_time: dbResult.rows[0].time,
          size: parseInt(dbSizeResult.rows[0].size),
          size_pretty: dbSizeResult.rows[0].size_pretty
        },
        system: systemInfo,
        table_counts: tableCountsResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error performing health check:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /system/backup - Backup database
router.post('/backup', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { format = 'sql' } = req.body;
    
    // Validate format
    const validFormats = ['sql', 'custom', 'directory', 'tar'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup format',
        message: `format must be one of: ${validFormats.join(', ')}`
      });
    }
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `rabs_backup_${timestamp}.${format}`;
    const backupPath = path.join(backupDir, backupFilename);
    
    // Get database connection info from pool
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'rabspocdb'
    };
    
    // Build pg_dump command
    const pgDumpCmd = `PGPASSWORD=${dbConfig.password} pg_dump -h ${dbConfig.host} -U ${dbConfig.user} -F ${format} -f ${backupPath} ${dbConfig.database}`;
    
    // Execute backup
    exec(pgDumpCmd, async (error, stdout, stderr) => {
      if (error) {
        console.error('Backup error:', error);
        
        // Log backup failure
        try {
          await pool.query(
            `INSERT INTO system_logs (level, message, source, details)
             VALUES ($1, $2, $3, $4)`,
            [
              'error',
              'Database backup failed',
              'system',
              {
                format,
                error: error.message,
                stderr
              }
            ]
          );
        } catch (logError) {
          console.error('Failed to log backup error:', logError);
        }
        
        return res.status(500).json({
          success: false,
          error: 'Backup failed',
          message: error.message
        });
      }
      
      // Get backup file size
      const stats = fs.statSync(backupPath);
      const fileSizeInBytes = stats.size;
      
      // Log successful backup
      try {
        await pool.query(
          `INSERT INTO system_logs (level, message, source, details)
           VALUES ($1, $2, $3, $4)`,
          [
            'info',
            'Database backup created',
            'system',
            {
              format,
              filename: backupFilename,
              size_bytes: fileSizeInBytes,
              path: backupPath
            }
          ]
        );
      } catch (logError) {
        console.error('Failed to log backup success:', logError);
      }
      
      res.json({
        success: true,
        data: {
          format,
          filename: backupFilename,
          path: backupPath,
          size_bytes: fileSizeInBytes,
          timestamp: new Date().toISOString()
        },
        message: 'Database backup created successfully'
      });
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      message: error.message
    });
  }
});

// GET /system/info - System information
router.get('/info', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    // Get database version
    const dbVersionResult = await pool.query('SELECT version()');
    
    // Get table counts and sizes
    const tablesQuery = `
      SELECT
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
        pg_total_relation_size(quote_ident(table_name)) as size_bytes
      FROM
        information_schema.tables
      WHERE
        table_schema = 'public'
      ORDER BY
        pg_total_relation_size(quote_ident(table_name)) DESC
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    
    // Get last system log
    const lastLogResult = await pool.query(
      `SELECT created_at FROM system_logs ORDER BY created_at DESC LIMIT 1`
    );
    
    // Get system info
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      version: os.version(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpus: os.cpus().length,
      network_interfaces: Object.keys(os.networkInterfaces())
    };
    
    // Get Node.js info
    const nodeInfo = {
      version: process.version,
      env: process.env.NODE_ENV || 'development',
      pid: process.pid,
      uptime: process.uptime()
    };
    
    res.json({
      success: true,
      data: {
        system: systemInfo,
        node: nodeInfo,
        database: {
          version: dbVersionResult.rows[0].version,
          tables: tablesResult.rows,
          last_log: lastLogResult.rows[0]?.created_at || null
        },
        app: {
          name: 'RABS',
          version: '3.0.0',
          description: 'Real-time Adaptive Backend System',
          api_version: 'v1'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system info',
      message: error.message
    });
  }
});

module.exports = router;
