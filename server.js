/**
 * RABS v3 - Main Server
 * 
 * The clean-slate rebuild server following RP2 methodology.
 * API-IS-KING: All endpoints follow the MASTER_SPEC.md contract.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const uuid = require('uuid');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3009;

// Database connection
const apiRouter = require('./backend/routes');
app.use('/api/v1', apiRouter);
  user: process.env.DB_USER || 'postgres',
  
  console.log(`📝 [${requestId}] ${req.method} ${req.url} started at ${new Date().toISOString()}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`✅ [${requestId}] ${req.method} ${req.url} ${res.statusCode} completed in ${duration}ms`);
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

// API Routes - Versioned under /api/v1
const apiRouter = express.Router();
app.use('/api/v1', apiRouter);

// -------------------------------------------------------------------------
// Filing Cabinet Routes - Reference Data (participants, staff, vehicles, venues)
// -------------------------------------------------------------------------

// Participants
apiRouter.get('/participants', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM participants ORDER BY last_name, first_name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/participants/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Staff
apiRouter.get('/staff', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM staff ORDER BY last_name, first_name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/staff/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM staff WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staff member not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Vehicles
apiRouter.get('/vehicles', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/vehicles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Venues
apiRouter.get('/venues', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM venues ORDER BY name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/venues/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------------
// Wall Routes - Program Templates
// -------------------------------------------------------------------------

// Programs
apiRouter.get('/programs', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM programs ORDER BY name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/programs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM programs WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/programs', async (req, res, next) => {
  try {
    const { 
      name, 
      venue_id, 
      repeat_pattern, 
      days_of_week, 
      start_date, 
      end_date,
      staff_ratio 
    } = req.body;
    
    // Validate required fields
    if (!name || !venue_id || !start_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, venue_id, start_date'
      });
    }
    
    // Insert program
    const result = await pool.query(
      `INSERT INTO programs 
       (name, venue_id, repeat_pattern, days_of_week, start_date, end_date, staff_ratio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, venue_id, repeat_pattern, days_of_week, start_date, end_date || start_date, staff_ratio || '1:4']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Time slots for programs
apiRouter.get('/programs/:programId/time-slots', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const result = await pool.query(
      'SELECT * FROM tgl_loom_time_slots WHERE program_id = $1 ORDER BY start_time',
      [programId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/programs/:programId/time-slots', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { start_time, end_time, segment_type } = req.body;
    
    // Validate required fields
    if (!start_time || !end_time || !segment_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: start_time, end_time, segment_type'
      });
    }
    
    // Insert time slot
    const result = await pool.query(
      `INSERT INTO tgl_loom_time_slots 
       (program_id, start_time, end_time, segment_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [programId, start_time, end_time, segment_type]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Program participants
apiRouter.get('/programs/:programId/participants', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const result = await pool.query(
      `SELECT pp.*, p.first_name, p.last_name, p.photo_url 
       FROM program_participants pp
       JOIN participants p ON pp.participant_id = p.id
       WHERE pp.program_id = $1`,
      [programId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/programs/:programId/participants', async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { participant_id, billing_code_id } = req.body;
    
    // Validate required fields
    if (!participant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: participant_id'
      });
    }
    
    // Insert program participant
    const result = await pool.query(
      `INSERT INTO program_participants 
       (program_id, participant_id, billing_code_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [programId, participant_id, billing_code_id]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------------
// Calendar Routes - Loom Instances & Intentions
// -------------------------------------------------------------------------

// Loom instances
apiRouter.get('/loom/instances', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = 'SELECT * FROM tgl_loom_instances';
    const params = [];
    
    if (startDate && endDate) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' WHERE date >= $1';
      params.push(startDate);
    } else if (endDate) {
      query += ' WHERE date <= $1';
      params.push(endDate);
    }
    
    query += ' ORDER BY date, id';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Dashboard cards
apiRouter.get('/dashboard/cards', async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: date'
      });
    }
    
    const result = await pool.query(
      `SELECT li.*, p.name as program_name, v.name as venue_name
       FROM tgl_loom_instances li
       JOIN programs p ON li.program_id = p.id
       JOIN venues v ON p.venue_id = v.id
       WHERE li.date = $1
       ORDER BY li.id`,
      [date]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Intentions (calendar entries)
apiRouter.post('/intentions', async (req, res, next) => {
  try {
    const { 
      type, 
      date, 
      permanent, 
      metadata,
      created_by 
    } = req.body;
    
    // Validate required fields
    if (!type || !date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, date'
      });
    }
    
    // Insert intention
    const result = await pool.query(
      `INSERT INTO tgl_operator_intents 
       (type, date, permanent, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type, date, permanent || false, metadata || {}, created_by || 'system']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------------
// Finance Routes - Billing Codes
// -------------------------------------------------------------------------

// Billing codes
apiRouter.get('/finance/billing-codes', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM billing_codes ORDER BY name');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------------
// System Routes - Settings, Logs
// -------------------------------------------------------------------------

// Settings
apiRouter.get('/settings', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM tgl_settings');
    
    // Convert array to object with key-value pairs
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// System logs
apiRouter.get('/system/logs', async (req, res, next) => {
  try {
    const { limit } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT $1',
      [limit || 100]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/system/logs', async (req, res, next) => {
  try {
    const { level, message, source, details } = req.body;
    
    // Validate required fields
    if (!level || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: level, message'
      });
    }
    
    // Insert log
    const result = await pool.query(
      `INSERT INTO system_logs 
       (level, message, source, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [level, message, source || 'api', details || {}]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------------------
// Error handling middleware
// -------------------------------------------------------------------------

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Log error to system_logs table
  try {
    pool.query(
      `INSERT INTO system_logs (level, message, source, details) 
       VALUES ($1, $2, $3, $4)`,
      ['error', err.message, 'server', { stack: err.stack, path: req.path, method: req.method }]
    );
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  const asciiArt = `
  ██████╗  █████╗ ██████╗ ███████╗    ██╗   ██╗██████╗ 
  ██╔══██╗██╔══██╗██╔══██╗██╔════╝    ██║   ██║╚════██╗
  ██████╔╝███████║██████╔╝███████╗    ██║   ██║ █████╔╝
  ██╔══██╗██╔══██║██╔══██╗╚════██║    ╚██╗ ██╔╝ ╚═══██╗
  ██║  ██║██║  ██║██████╔╝███████║     ╚████╔╝ ██████╔╝
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝      ╚═══╝  ╚═════╝ 
                                                       
  RP2: FROM FLUSHED TO FINISHED!
  `;
  
  console.log(asciiArt);
  console.log(`🚀 RABS v3 server is ALIVE on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API docs: http://localhost:${PORT}/api/v1`);
  console.log('🧠 API-IS-KING principle in full effect!');
  console.log('📆 Loom window is ready to weave the future!');
});
