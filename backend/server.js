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

// ---------------------------------------------------------------------------
// Ensure Wizard V2 supporting schema exists (runs once at start-up)
// ---------------------------------------------------------------------------
(async () => {
  const ddlBlock = `
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rules_programs' AND column_name = 'anchor_date'
    ) THEN
      ALTER TABLE rules_programs ADD COLUMN anchor_date date;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rules_programs' AND column_name = 'recurrence_pattern'
    ) THEN
      ALTER TABLE rules_programs
        ADD COLUMN recurrence_pattern text
        CHECK (recurrence_pattern IN ('one_off','weekly','fortnightly','monthly'))
        DEFAULT 'fortnightly';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rules_programs' AND column_name = 'auto_assign_staff'
    ) THEN
      ALTER TABLE rules_programs ADD COLUMN auto_assign_staff boolean DEFAULT true;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rules_programs' AND column_name = 'auto_assign_vehicles'
    ) THEN
      ALTER TABLE rules_programs ADD COLUMN auto_assign_vehicles boolean DEFAULT true;
    END IF;
  END $$;
  `;

  const billingTableDDL = `
    /* Wizard V2 – participant billing lines (modern schema) */
    CREATE TABLE IF NOT EXISTS rules_program_participant_billing (
      id uuid PRIMARY KEY,
      rule_participant_id uuid NOT NULL,
      billing_code_id uuid NOT NULL,
      hours numeric(6,2) NOT NULL,
      created_at timestamp DEFAULT now()
    );
  `;

  try {
    await pool.query(ddlBlock);
    await pool.query(billingTableDDL);
    // ---------------------------------------------------------------------
    // Staff / Vehicle placeholder tables for Wizard v2.1
    // ---------------------------------------------------------------------
    const placeholdersDDL = `
      -- Staff placeholders (auto / manual)
      CREATE TABLE IF NOT EXISTS rules_program_staff_placeholders (
        id uuid PRIMARY KEY,
        rule_id uuid NOT NULL,
        slot_index integer NOT NULL DEFAULT 0,
        mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto','manual')),
        staff_id uuid NULL,
        created_at timestamp DEFAULT now()
      );

      -- Vehicle placeholders (auto / manual)
      CREATE TABLE IF NOT EXISTS rules_program_vehicle_placeholders (
        id uuid PRIMARY KEY,
        rule_id uuid NOT NULL,
        slot_index integer NOT NULL DEFAULT 0,
        mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto','manual')),
        vehicle_id uuid NULL,
        created_at timestamp DEFAULT now()
      );
    `;

    await pool.query(placeholdersDDL);
    console.log('✅ Wizard V2 schema verified/updated');

    // ---------------------------------------------------------------------
    // Fix FK on rules_program_participant_billing.billing_code_id
    // Should reference billing_rates(id) (some DBs still point to billing_codes)
    // ---------------------------------------------------------------------
    try {
      const fkCheckSql = `
        SELECT c.conname,
               pg_get_constraintdef(c.oid, true) AS definition
          FROM pg_constraint c
          JOIN pg_class rel ON rel.oid = c.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'public'
           AND rel.relname = 'rules_program_participant_billing'
           AND c.contype = 'f'
           AND EXISTS (
               SELECT 1
                 FROM pg_attribute a
                WHERE a.attrelid = c.conrelid
                  AND a.attnum = ANY (c.conkey)
                  AND a.attname = 'billing_code_id'
           );
      `;

      const { rows: fkRows } = await pool.query(fkCheckSql);
      let needsDrop = false;
      for (const r of fkRows) {
        if (r.definition.includes('REFERENCES public.billing_codes')) {
          needsDrop = true;
          // Drop incorrect FK
          await pool.query(
            `ALTER TABLE public.rules_program_participant_billing
               DROP CONSTRAINT IF EXISTS ${r.conname}`
          );
          console.log(
            `🔧 Dropped outdated FK ${r.conname} referencing billing_codes`
          );
        }
      }

      // Ensure correct FK exists
      const ensureFkSql = `
        ALTER TABLE public.rules_program_participant_billing
        ADD CONSTRAINT rules_program_participant_billing_billing_code_id_fkey
        FOREIGN KEY (billing_code_id)
        REFERENCES public.billing_rates(id)
      `;
      if (needsDrop || fkRows.length === 0) {
        // Only attempt to add if not already present
        await pool.query(ensureFkSql);
        console.log(
          '✅ FK rules_program_participant_billing.billing_code_id → billing_rates(id) verified/created'
        );
      }
    } catch (fkErr) {
      console.warn(
        '⚠️  Unable to audit/repair billing_code_id foreign key:',
        fkErr.message
      );
    }
  } catch (schemaErr) {
    console.error('❌ Failed ensuring Wizard V2 schema:', schemaErr.message);
  }
})();

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
  // Dev workstation origins
  'http://192.168.77.6:3008',
  'http://192.168.77.6:3009',
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

// -------------------------------------------------------------
// Health check endpoints (root + versioned)
// -------------------------------------------------------------
const healthHandler = (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler); // compat alias for FE checks
app.get('/api/v1/health', healthHandler);

// API Routes - Versioned under /api/v1
const apiRoutes = require('./routes');
app.use('/api/v1', apiRoutes);
// Compat alias so legacy calls to /api still work
app.use('/api', apiRoutes);

// Serve OpenAPI documentation
app.get('/api/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/openapi.html'));
});

// Error handling middleware
app.use(async (err, req, res, next) => {
  console.error('❌ Error:', err);
  
  // Log error to system_logs table
  try {
    await pool.query(
      `INSERT INTO system_logs (id, severity, category, message, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        uuid.v4(),          // id
        'ERROR',            // severity
        'SYSTEM',           // category
        err.message,        // message
        {                   // details
          stack: err.stack,
          path: req.path,
          method: req.method
        }
      ]
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
