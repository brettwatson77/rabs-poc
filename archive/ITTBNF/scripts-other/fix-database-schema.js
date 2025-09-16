#!/usr/bin/env node
/**
 * fix-database-schema.js
 * 
 * This script fixes database schema issues by:
 * 1. Adding missing columns to existing tables
 * 2. Creating missing tables needed by the application
 * 3. Ensuring proper data types and constraints
 * 
 * It's designed to be idempotent - safe to run multiple times.
 */

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'rabspocdb',
};

// Create PostgreSQL connection pool
const pool = new Pool(pgConfig);

console.log(`Connecting to PostgreSQL database: ${pgConfig.database} at ${pgConfig.host}:${pgConfig.port}`);

/**
 * Check if a table exists in the database
 * @param {string} tableName - Name of the table to check
 * @returns {Promise<boolean>} - True if the table exists, false otherwise
 */
async function tableExists(tableName) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = $1
    );
  `, [tableName]);
  
  return rows[0].exists;
}

/**
 * Check if a column exists in a table
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column to check
 * @returns {Promise<boolean>} - True if the column exists, false otherwise
 */
async function columnExists(tableName, columnName) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    );
  `, [tableName, columnName]);
  
  return rows[0].exists;
}

/**
 * Check if an enum type exists in the database
 * @param {string} typeName - Name of the enum type to check
 * @returns {Promise<boolean>} - True if the enum type exists, false otherwise
 */
async function enumTypeExists(typeName) {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT FROM pg_type
      JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
      WHERE pg_namespace.nspname = 'public'
      AND pg_type.typname = $1
    );
  `, [typeName]);
  
  return rows[0].exists;
}

/**
 * Execute a query and log the result
 * @param {string} description - Description of what the query does
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
async function executeQuery(description, query, params = []) {
  try {
    console.log(`Executing: ${description}`);
    const result = await pool.query(query, params);
    console.log(`✅ Success: ${description}`);
    return result;
  } catch (error) {
    if (error.code === '42701' && error.message.includes('already exists')) {
      console.log(`ℹ️ Already exists: ${description}`);
    } else {
      console.error(`❌ Error: ${description}`);
      console.error(`   ${error.message}`);
      throw error;
    }
  }
}

/**
 * Main function to fix the database schema
 */
async function fixDatabaseSchema() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Fix 1: Add missing supervision_multiplier column to participants table
    if (await tableExists('participants')) {
      if (!await columnExists('participants', 'supervision_multiplier')) {
        await executeQuery(
          "Adding supervision_multiplier column to participants table",
          `ALTER TABLE participants ADD COLUMN supervision_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0;`
        );
      }
    }
    
    // Fix 2: Create tgl_settings table if it doesn't exist
    if (!await tableExists('tgl_settings')) {
      await executeQuery(
        "Creating tgl_settings table",
        `CREATE TABLE tgl_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          data_type TEXT NOT NULL DEFAULT 'string',
          category TEXT NOT NULL DEFAULT 'general',
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );`
      );
      
      // Add default loom settings
      await executeQuery(
        "Adding default loom settings",
        `INSERT INTO tgl_settings (key, value, data_type, category, description)
        VALUES 
          ('PARTICIPANTS_PER_LEAD', '5', 'number', 'loom_logic', 'Number of participants per lead staff'),
          ('PARTICIPANTS_PER_SUPPORT', '5', 'number', 'loom_logic', 'Number of participants per support staff'),
          ('MIN_SUPERVISION_MULTIPLIER', '1.0', 'number', 'loom_logic', 'Default supervision multiplier'),
          ('HIGH_SUPPORT_THRESHOLD', '2.5', 'number', 'loom_logic', 'Participants above this need dedicated staff'),
          ('OPTIMAL_BUS_RUN_DURATION', '45', 'number', 'loom_logic', 'Target minutes for a bus run'),
          ('MAX_BUS_RUN_DURATION', '90', 'number', 'loom_logic', 'Maximum minutes for a single bus run'),
          ('VEHICLE_CAPACITY_BUFFER', '0.9', 'number', 'loom_logic', 'Don''t fill vehicles beyond this percentage'),
          ('MIN_PICKUP_DURATION', '30', 'number', 'loom_logic', 'Minimum minutes for pickup run'),
          ('MIN_DROPOFF_DURATION', '30', 'number', 'loom_logic', 'Minimum minutes for dropoff run'),
          ('ACTIVITY_PADDING_BEFORE', '15', 'number', 'loom_logic', 'Minutes before activity start'),
          ('ACTIVITY_PADDING_AFTER', '15', 'number', 'loom_logic', 'Minutes after activity end'),
          ('TARGET_PROFIT_MARGIN', '0.15', 'number', 'loom_logic', 'Target profit margin'),
          ('ADMIN_COST_PERCENTAGE', '0.18', 'number', 'loom_logic', 'Admin cost percentage'),
          ('PREFER_CASUAL_STAFF', 'true', 'boolean', 'loom_logic', 'Prefer casual staff for short programs'),
          ('DEFAULT_PICKUP_START_OFFSET', '-60', 'number', 'loom_logic', 'Start pickup minutes before program'),
          ('DEFAULT_DROPOFF_END_OFFSET', '60', 'number', 'loom_logic', 'End dropoff minutes after program'),
          ('loom_window_weeks', '4', 'number', 'loom_system', 'Loom window size in weeks')
        ON CONFLICT (key) DO NOTHING;`
      );
    }
    
    // Fix 3: Add status column to pending_enrollment_changes if it doesn't exist
    if (await tableExists('pending_enrollment_changes')) {
      if (!await columnExists('pending_enrollment_changes', 'status')) {
        await executeQuery(
          "Adding status column to pending_enrollment_changes table",
          `ALTER TABLE pending_enrollment_changes ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';`
        );
      }
    }
    
    // Fix 4: Create loom_instance_status enum type if it doesn't exist
    if (!await enumTypeExists('loom_instance_status')) {
      await executeQuery(
        "Creating loom_instance_status enum type",
        `CREATE TYPE loom_instance_status AS ENUM (
          'draft',
          'planned',
          'staffed',
          'transport_assigned',
          'ready',
          'in_progress',
          'completed',
          'cancelled',
          'needs_attention'
        );`
      );
    }
    
    // Fix 5: Add status column to tgl_loom_instances if it exists but missing the column
    if (await tableExists('tgl_loom_instances')) {
      if (!await columnExists('tgl_loom_instances', 'status')) {
        // First check if the enum type exists
        if (await enumTypeExists('loom_instance_status')) {
          await executeQuery(
            "Adding status column to tgl_loom_instances table",
            `ALTER TABLE tgl_loom_instances ADD COLUMN status loom_instance_status NOT NULL DEFAULT 'planned';`
          );
        } else {
          // If enum doesn't exist, add as text first
          await executeQuery(
            "Adding status column to tgl_loom_instances table as TEXT",
            `ALTER TABLE tgl_loom_instances ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';`
          );
        }
      }
    }
    
    // Fix 6: Add status column to program_participants if it exists
    if (await tableExists('program_participants')) {
      if (!await columnExists('program_participants', 'status')) {
        await executeQuery(
          "Adding status column to program_participants table",
          `ALTER TABLE program_participants ADD COLUMN status TEXT NOT NULL DEFAULT 'active';`
        );
      }
    }
    
    // Fix 7: Ensure tgl_loom_audit_log table exists
    if (!await tableExists('tgl_loom_audit_log')) {
      await executeQuery(
        "Creating tgl_loom_audit_log table",
        `CREATE TABLE tgl_loom_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          instance_id UUID,
          severity TEXT DEFAULT 'INFO',
          category TEXT DEFAULT 'SYSTEM',
          action TEXT,
          message TEXT,
          details JSONB,
          affected_entities JSONB,
          resolution_required BOOLEAN DEFAULT false,
          resolution_suggestions JSONB
        );`
      );
    }
    
    // Fix 8: Ensure program_enrollments table exists
    if (!await tableExists('program_enrollments')) {
      await executeQuery(
        "Creating program_enrollments table",
        `CREATE TABLE program_enrollments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          participant_id UUID NOT NULL,
          program_id UUID NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
          CONSTRAINT fk_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
          CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
        );`
      );
    }
    
    // Fix 9: Ensure pending_enrollment_changes table exists
    if (!await tableExists('pending_enrollment_changes')) {
      await executeQuery(
        "Creating pending_enrollment_changes table",
        `CREATE TABLE pending_enrollment_changes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          participant_id UUID NOT NULL,
          program_id UUID NOT NULL,
          action TEXT NOT NULL,
          effective_date DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
          CONSTRAINT fk_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
        );`
      );
    }
    
    // Fix 10: Add missing columns to participants table
    if (await tableExists('participants')) {
      // Add NDIS-related columns if they don't exist
      const columnsToAdd = [
        { name: 'ndis_number', type: 'VARCHAR(15)', default: null },
        { name: 'ndis_plan_start', type: 'DATE', default: null },
        { name: 'ndis_plan_end', type: 'DATE', default: null },
        { name: 'ndis_plan_budget', type: 'DECIMAL(10,2)', default: null },
        { name: 'requires_wheelchair', type: 'BOOLEAN', default: 'false' },
        { name: 'requires_transport', type: 'BOOLEAN', default: 'false' },
        { name: 'active', type: 'BOOLEAN', default: 'true' }
      ];
      
      for (const column of columnsToAdd) {
        if (!await columnExists('participants', column.name)) {
          await executeQuery(
            `Adding ${column.name} column to participants table`,
            `ALTER TABLE participants ADD COLUMN ${column.name} ${column.type}${column.default !== null ? ` DEFAULT ${column.default}` : ''};`
          );
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Database schema fixes completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
fixDatabaseSchema()
  .then(() => {
    console.log('Database schema fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error fixing database schema:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
