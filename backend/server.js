/**
 * RABS v3 - Main Server
 * 
 * The clean-slate rebuild server following RP2 methodology.
 * API-IS-KING: All endpoints follow the MASTER_SPEC.md contract.
 */

const path = require('path'); // keep single import

// Always load .env from project root so cwd doesn't matter
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const uuid = require('uuid');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3009;

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'rabspocdb';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

console.log(
  `[DB] target host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} user=${DB_USER}`
);

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Make pool available to routes
app.locals.pool = pool;

// Middleware
// ---------------------------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------------------------
const whitelist = [
  'http://localhost:3008',
  'http://localhost:3009',
  'http://127.0.0.1:3008',
  'http://127.0.0.1:3009',
  'http://192.168.77.8:3008',
  'http://192.168.77.8:3009',
  'https://rabspoc.codexdiz.com',
  'https://www.rabspoc.codexdiz.com',   // sub-domain with www just in case
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, curl) or whitelisted
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = uuid.v4();
  
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
const apiRoutes = require('./routes');
app.use('/api/v1', apiRoutes);

// Serve OpenAPI documentation
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/openapi.html'));
});

// Error handling middleware
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
