/**
 * scripts/prepare-launch.js
 * 
 * Prepares the RABS-POC system for launch:
 * - Checks database status
 * - Runs necessary migrations
 * - Imports data from CSV files (optional)
 * - Sets up initial configuration
 * - Verifies everything is ready
 * 
 * Usage:
 * node scripts/prepare-launch.js [options]
 * 
 * Options:
 *  --reset              Reset the database (WARNING: Deletes all data)
 *  --import-staff=file  Import staff from CSV file
 *  --import-participants=file  Import participants from CSV file
 *  --import-vehicles=file  Import vehicles from CSV file
 *  --import-venues=file  Import venues from CSV file
 *  --sample-data        Create sample data if starting with blank slate
 *  --admin-percent=18   Set admin expense percentage (default: 18%)
 *  --pg                 Use PostgreSQL instead of SQLite (TGL architecture)
 *  --pg-host=localhost  PostgreSQL host (default: localhost)
 *  --pg-port=5432       PostgreSQL port (default: 5432)
 *  --pg-user=postgres   PostgreSQL username (default: postgres)
 *  --pg-password=pass   PostgreSQL password
 *  --pg-database=rabs   PostgreSQL database name (default: rabs)
 *  --help               Show this help message
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const csv = require('csv-parser');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

// Try to load PostgreSQL client if available
let pg;
try {
  pg = require('pg');
} catch (e) {
  // PostgreSQL client not installed, will handle this later
}

// Configuration
const config = {
  dbPath: process.env.DB_PATH || 'data/rabs-poc.db',
  schemaPath: path.join(__dirname, '../database/schema.sql'),
  tglSchemaPath: path.join(__dirname, '../database/migrations/001_tgl_core.sql'),
  migrationsPath: path.join(__dirname, '../database/migrations'),
  dataDir: path.join(__dirname, '../data'),
  reset: false,
  importFiles: {
    staff: null,
    participants: null,
    vehicles: null,
    venues: null
  },
  sampleData: false,
  adminPercent: 18,
  usePostgres: false,
  postgres: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'rabs'
  }
};

// Parse command line arguments
function parseArgs() {
  process.argv.slice(2).forEach(arg => {
    if (arg === '--reset') {
      config.reset = true;
    } else if (arg === '--sample-data') {
      config.sampleData = true;
    } else if (arg === '--pg') {
      config.usePostgres = true;
    } else if (arg === '--help') {
      showHelp();
      process.exit(0);
    } else if (arg.startsWith('--import-staff=')) {
      config.importFiles.staff = arg.split('=')[1];
    } else if (arg.startsWith('--import-participants=')) {
      config.importFiles.participants = arg.split('=')[1];
    } else if (arg.startsWith('--import-vehicles=')) {
      config.importFiles.vehicles = arg.split('=')[1];
    } else if (arg.startsWith('--import-venues=')) {
      config.importFiles.venues = arg.split('=')[1];
    } else if (arg.startsWith('--admin-percent=')) {
      config.adminPercent = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--pg-host=')) {
      config.postgres.host = arg.split('=')[1];
    } else if (arg.startsWith('--pg-port=')) {
      config.postgres.port = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--pg-user=')) {
      config.postgres.user = arg.split('=')[1];
    } else if (arg.startsWith('--pg-password=')) {
      config.postgres.password = arg.split('=')[1];
    } else if (arg.startsWith('--pg-database=')) {
      config.postgres.database = arg.split('=')[1];
    }
  });
}

// Show help message
function showHelp() {
  console.log(`
RABS-POC Launch Preparation Script

Usage:
  node scripts/prepare-launch.js [options]

Options:
  --reset              Reset the database (WARNING: Deletes all data)
  --import-staff=file  Import staff from CSV file
  --import-participants=file  Import participants from CSV file
  --import-vehicles=file  Import vehicles from CSV file
  --import-venues=file  Import venues from CSV file
  --sample-data        Create sample data if starting with blank slate
  --admin-percent=18   Set admin expense percentage (default: 18%)
  --pg                 Use PostgreSQL instead of SQLite (TGL architecture)
  --pg-host=localhost  PostgreSQL host (default: localhost)
  --pg-port=5432       PostgreSQL port (default: 5432)
  --pg-user=postgres   PostgreSQL username (default: postgres)
  --pg-password=pass   PostgreSQL password
  --pg-database=rabs   PostgreSQL database name (default: rabs)
  --help               Show this help message

Examples:
  # Start with SQLite and sample data
  node scripts/prepare-launch.js --sample-data

  # Use PostgreSQL with TGL architecture
  node scripts/prepare-launch.js --pg --pg-password=mypassword

  # Import staff from CSV and set admin percentage
  node scripts/prepare-launch.js --import-staff=staff.csv --admin-percent=20
  `);
}

// Create database directory if it doesn't exist
function ensureDatabaseDirectory() {
  if (!config.usePostgres) {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      console.log(`Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }
}

// Check if database exists
async function checkDatabase() {
  if (config.usePostgres) {
    // Check if PostgreSQL client is installed
    if (!pg) {
      console.log('⚠️ PostgreSQL client not installed. Please run:');
      console.log('npm install pg --save');
      console.log('⚠️ Falling back to SQLite for now');
      config.usePostgres = false;
      return checkSqliteDatabase();
    }
    
    console.log('🚀 REVOLUTIONARY MODE: Using PostgreSQL with TGL architecture');
    
    try {
      // Try to connect to PostgreSQL server
      const client = new pg.Client({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: 'postgres' // Connect to default database first
      });
      
      await client.connect();
      
      // Check if our database exists
      const result = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_database WHERE datname = $1
        )
      `, [config.postgres.database]);
      
      const dbExists = result.rows[0].exists;
      
      if (dbExists) {
        console.log(`✅ PostgreSQL database '${config.postgres.database}' found`);
        
        if (config.reset) {
          console.log(`⚠️ Resetting database as requested...`);
          
          // Terminate all connections to the database
          await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
          `, [config.postgres.database]);
          
          // Drop and recreate the database
          await client.query(`DROP DATABASE ${config.postgres.database}`);
          await client.query(`CREATE DATABASE ${config.postgres.database}`);
          
          console.log(`✅ Database reset complete`);
          await client.end();
          return false;
        }
      } else {
        console.log(`⚠️ PostgreSQL database '${config.postgres.database}' not found. Will create new database.`);
        await client.query(`CREATE DATABASE ${config.postgres.database}`);
        console.log(`✅ Created PostgreSQL database '${config.postgres.database}'`);
        await client.end();
        return false;
      }
      
      await client.end();
      return dbExists;
    } catch (error) {
      console.error('❌ Error connecting to PostgreSQL:', error.message);
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Would you like to fall back to SQLite? (Y/n) ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'n') {
        console.log('⚠️ Falling back to SQLite');
        config.usePostgres = false;
        return checkSqliteDatabase();
      } else {
        console.log('Exiting...');
        process.exit(1);
      }
    }
  } else {
    return checkSqliteDatabase();
  }
}

// Check if SQLite database exists
function checkSqliteDatabase() {
  return new Promise(resolve => {
    const dbExists = fs.existsSync(config.dbPath);
    
    if (dbExists) {
      console.log(`✅ SQLite database found: ${config.dbPath}`);
      if (config.reset) {
        console.log(`⚠️ Resetting database as requested...`);
        fs.unlinkSync(config.dbPath);
        resolve(false);
      } else {
        resolve(true);
      }
    } else {
      console.log(`⚠️ SQLite database not found. Will create new database.`);
      resolve(false);
    }
  });
}

// Run SQL file on SQLite
function runSqliteFile(db, filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Running SQL file on SQLite: ${filePath}`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split the SQL file into separate statements
    const statements = sql
      .replace(/--.*$/gm, '') // Remove comments
      .split(';')
      .filter(statement => statement.trim() !== '');
    
    // Execute each statement in a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let success = true;
      statements.forEach(statement => {
        db.run(statement, err => {
          if (err) {
            console.error(`Error executing statement: ${statement}`);
            console.error(err);
            success = false;
          }
        });
      });
      
      if (success) {
        db.run('COMMIT', err => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        db.run('ROLLBACK');
        reject(new Error('Error executing SQL file'));
      }
    });
  });
}

// Run SQL file on PostgreSQL
async function runPostgresFile(client, filePath) {
  console.log(`Running SQL file on PostgreSQL: ${filePath}`);
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing PostgreSQL file:', error);
    throw error;
  }
}

// Initialize database
async function initializeDatabase(dbExists) {
  if (config.usePostgres) {
    return initializePostgres(dbExists);
  } else {
    return initializeSqlite(dbExists);
  }
}

// Initialize SQLite database
async function initializeSqlite(dbExists) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(config.dbPath, async err => {
      if (err) {
        console.error('Error connecting to SQLite database:', err);
        reject(err);
        return;
      }
      
      try {
        if (!dbExists) {
          console.log('Initializing new SQLite database...');
          await runSqliteFile(db, config.schemaPath);
          console.log('✅ SQLite database schema created successfully');
        }
        
        // Run migrations
        await runSqliteMigrations(db);
        
        // Set admin expense percentage
        await setSqliteAdminPercentage(db);
        
        resolve(db);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Initialize PostgreSQL database
async function initializePostgres(dbExists) {
  try {
    const client = new pg.Client({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database
    });
    
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    if (!dbExists) {
      console.log('Initializing new PostgreSQL database with TGL architecture...');
      
      // Check if pgvector extension is available
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ pgvector extension enabled');
      } catch (error) {
        console.warn('⚠️ pgvector extension not available. Some features may be limited.');
        console.warn('   To enable full semantic search, install pgvector:');
        console.warn('   https://github.com/pgvector/pgvector#installation');
      }
      
      // Initialize TGL schema
      await runPostgresFile(client, config.tglSchemaPath);
      console.log('✅ TGL database schema created successfully');
    }
    
    // Run migrations
    await runPostgresMigrations(client);
    
    // Set admin expense percentage
    await setPostgresAdminPercentage(client);
    
    return client;
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Would you like to fall back to SQLite? (Y/n) ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'n') {
      console.log('⚠️ Falling back to SQLite');
      config.usePostgres = false;
      return initializeSqlite(false); // Force new SQLite database
    } else {
      throw error;
    }
  }
}

// Run migrations on SQLite
async function runSqliteMigrations(db) {
  console.log('Checking for SQLite migrations...');
  
  if (!fs.existsSync(config.migrationsPath)) {
    console.log('No migrations directory found. Skipping migrations.');
    return;
  }
  
  const migrationFiles = fs.readdirSync(config.migrationsPath)
    .filter(file => file.endsWith('.sql') && !file.startsWith('001_tgl_core'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('No applicable migration files found. Skipping migrations.');
    return;
  }
  
  console.log(`Found ${migrationFiles.length} migration files.`);
  
  // Create migrations table if it doesn't exist
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, err => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  // Get applied migrations
  const appliedMigrations = await new Promise((resolve, reject) => {
    db.all('SELECT name FROM migrations', (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.name));
    });
  });
  
  // Apply pending migrations
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file)) {
      console.log(`Applying migration: ${file}`);
      
      try {
        await runSqliteFile(db, path.join(config.migrationsPath, file));
        
        // Record migration
        await new Promise((resolve, reject) => {
          db.run('INSERT INTO migrations (name) VALUES (?)', [file], err => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        console.log(`✅ Migration applied: ${file}`);
      } catch (error) {
        console.error(`❌ Error applying migration ${file}:`, error);
        throw error;
      }
    } else {
      console.log(`✅ Migration already applied: ${file}`);
    }
  }
  
  console.log('✅ All SQLite migrations applied successfully');
}

// Run migrations on PostgreSQL
async function runPostgresMigrations(client) {
  console.log('Checking for PostgreSQL migrations...');
  
  if (!fs.existsSync(config.migrationsPath)) {
    console.log('No migrations directory found. Skipping migrations.');
    return;
  }
  
  // We skip the TGL core schema as it's already applied
  const migrationFiles = fs.readdirSync(config.migrationsPath)
    .filter(file => file.endsWith('.sql') && !file.startsWith('001_tgl_core'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('No applicable migration files found. Skipping migrations.');
    return;
  }
  
  console.log(`Found ${migrationFiles.length} migration files.`);
  
  // Create migrations table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Get applied migrations
  const appliedResult = await client.query('SELECT name FROM migrations');
  const appliedMigrations = appliedResult.rows.map(row => row.name);
  
  // Apply pending migrations
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file)) {
      console.log(`Applying migration: ${file}`);
      
      try {
        // Check if file has PostgreSQL-specific version
        const pgFilePath = path.join(config.migrationsPath, `pg_${file}`);
        const filePath = fs.existsSync(pgFilePath) ? pgFilePath : path.join(config.migrationsPath, file);
        
        await runPostgresFile(client, filePath);
        
        // Record migration
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        
        console.log(`✅ Migration applied: ${file}`);
      } catch (error) {
        console.error(`❌ Error applying migration ${file}:`, error);
        throw error;
      }
    } else {
      console.log(`✅ Migration already applied: ${file}`);
    }
  }
  
  console.log('✅ All PostgreSQL migrations applied successfully');
}

// Set admin expense percentage in SQLite
async function setSqliteAdminPercentage(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR REPLACE INTO settings (key, value) 
      VALUES ('admin_expense_percentage', ?)
    `, [config.adminPercent.toString()], err => {
      if (err) {
        console.error('Error setting admin expense percentage:', err);
        reject(err);
      } else {
        console.log(`✅ Admin expense percentage set to ${config.adminPercent}%`);
        resolve();
      }
    });
  });
}

// Set admin expense percentage in PostgreSQL
async function setPostgresAdminPercentage(client) {
  try {
    // Check if settings table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'settings'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Create settings table
      await client.query(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Upsert admin percentage
    await client.query(`
      INSERT INTO settings (key, value) 
      VALUES ('admin_expense_percentage', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
    `, [config.adminPercent.toString()]);
    
    console.log(`✅ Admin expense percentage set to ${config.adminPercent}%`);
  } catch (error) {
    console.error('Error setting admin expense percentage:', error);
    throw error;
  }
}

// Import data from CSV
async function importFromCsv(db, type, filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      reject(new Error(`File not found: ${filePath}`));
      return;
    }
    
    console.log(`Importing ${type} from ${filePath}...`);
    
    const records = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => records.push(data))
      .on('end', async () => {
        console.log(`Found ${records.length} ${type} records to import`);
        
        try {
          if (config.usePostgres) {
            switch (type) {
              case 'staff':
                await importPostgresStaff(db, records);
                break;
              case 'participants':
                await importPostgresParticipants(db, records);
                break;
              case 'vehicles':
                await importPostgresVehicles(db, records);
                break;
              case 'venues':
                await importPostgresVenues(db, records);
                break;
            }
          } else {
            switch (type) {
              case 'staff':
                await importStaff(db, records);
                break;
              case 'participants':
                await importParticipants(db, records);
                break;
              case 'vehicles':
                await importVehicles(db, records);
                break;
              case 'venues':
                await importVenues(db, records);
                break;
            }
          }
          
          console.log(`✅ Successfully imported ${records.length} ${type} records`);
          resolve();
        } catch (error) {
          console.error(`❌ Error importing ${type}:`, error);
          reject(error);
        }
      })
      .on('error', err => {
        console.error(`❌ Error reading CSV file:`, err);
        reject(err);
      });
  });
}

// Import staff to SQLite
async function importStaff(db, records) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO staff (
          id, first_name, last_name, address, suburb, state, postcode,
          contact_phone, contact_email, contracted_hours, notes,
          schads_level, base_rate, apply_penalty_rates, payroll_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      records.forEach(record => {
        const schadsLevel = parseInt(record.schads_level || '3');
        const baseRate = parseFloat(record.base_rate) || getSchadsRate(schadsLevel);
        
        stmt.run(
          record.id || `S${Math.floor(Math.random() * 10000)}`,
          record.first_name,
          record.last_name,
          record.address || '',
          record.suburb || '',
          record.state || 'NSW',
          record.postcode || '',
          record.contact_phone || '',
          record.contact_email || '',
          parseInt(record.contracted_hours || '30'),
          record.notes || '',
          schadsLevel,
          baseRate,
          record.apply_penalty_rates === 'false' ? 0 : 1,
          record.payroll_id || ''
        );
      });
      
      stmt.finalize();
      
      db.run('COMMIT', err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Import staff to PostgreSQL
async function importPostgresStaff(client, records) {
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      const schadsLevel = parseInt(record.schads_level || '3');
      const baseRate = parseFloat(record.base_rate) || getSchadsRate(schadsLevel);
      // If no UUID supplied let PostgreSQL generate one via uuid_generate_v4()
      const staffId = record.id || null;
      
      await client.query(`
        INSERT INTO staff (
          id, first_name, last_name, address, suburb, state, postcode,
          contact_phone, contact_email, contracted_hours, notes,
          schads_level, base_rate, apply_penalty_rates, payroll_id, created_at
        ) VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7,
                  $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO UPDATE SET
          first_name = $2,
          last_name = $3,
          address = $4,
          suburb = $5,
          state = $6,
          postcode = $7,
          contact_phone = $8,
          contact_email = $9,
          contracted_hours = $10,
          notes = $11,
          schads_level = $12,
          base_rate = $13,
          apply_penalty_rates = $14,
          payroll_id = $15,
          updated_at = NOW()
      `, [
        staffId,
        record.first_name,
        record.last_name,
        record.address || '',
        record.suburb || '',
        record.state || 'NSW',
        record.postcode || '',
        record.contact_phone || '',
        record.contact_email || '',
        parseInt(record.contracted_hours || '30'),
        record.notes || '',
        schadsLevel,
        baseRate,
        record.apply_penalty_rates === 'false' ? false : true,
        record.payroll_id || ''
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Import participants to SQLite
async function importParticipants(db, records) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO participants (
          id, first_name, last_name, address, suburb, state, postcode,
          latitude, longitude, ndis_number, is_plan_managed, contact_phone,
          contact_email, notes, supervision_multiplier
        ) VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7,
                  $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      `);
      
      records.forEach(record => {
        stmt.run(
          parseInt(record.id) || null,
          record.first_name,
          record.last_name,
          record.address || '',
          record.suburb || '',
          record.state || 'NSW',
          record.postcode || '',
          parseFloat(record.latitude) || null,
          parseFloat(record.longitude) || null,
          record.ndis_number || '',
          record.is_plan_managed === 'true' ? 1 : 0,
          record.contact_phone || '',
          record.contact_email || '',
          record.notes || '',
          parseFloat(record.supervision_multiplier || '1.0')
        );
      });
      
      stmt.finalize();
      
      db.run('COMMIT', err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Import participants to PostgreSQL
async function importPostgresParticipants(client, records) {
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      await client.query(`
        INSERT INTO participants (
          first_name, last_name, address, suburb, state, postcode,
          latitude, longitude, ndis_number, is_plan_managed, contact_phone,
          contact_email, notes, supervision_multiplier, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (id) DO UPDATE SET
          first_name = $1,
          last_name = $2,
          address = $3,
          suburb = $4,
          state = $5,
          postcode = $6,
          latitude = $7,
          longitude = $8,
          ndis_number = $9,
          is_plan_managed = $10,
          contact_phone = $11,
          contact_email = $12,
          notes = $13,
          supervision_multiplier = $14,
          updated_at = NOW()
      `, [
        record.first_name,
        record.last_name,
        record.address || '',
        record.suburb || '',
        record.state || 'NSW',
        record.postcode || '',
        parseFloat(record.latitude) || null,
        parseFloat(record.longitude) || null,
        record.ndis_number || '',
        record.is_plan_managed === 'true',
        record.contact_phone || '',
        record.contact_email || '',
        record.notes || '',
        parseFloat(record.supervision_multiplier || '1.0')
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Import vehicles to SQLite
async function importVehicles(db, records) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO vehicles (
          id, description, seats, registration, notes
        ) VALUES (?, ?, ?, ?, ?)
      `);
      
      records.forEach(record => {
        stmt.run(
          record.id || `V${Math.floor(Math.random() * 10000)}`,
          record.description || '',
          parseInt(record.seats || '10'),
          record.registration || '',
          record.notes || ''
        );
      });
      
      stmt.finalize();
      
      db.run('COMMIT', err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Import vehicles to PostgreSQL
async function importPostgresVehicles(client, records) {
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      const vehicleId = record.id || `V${Math.floor(Math.random() * 10000)}`;
      
      await client.query(`
        INSERT INTO vehicles (
          id, description, seats, registration, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          description = $2,
          seats = $3,
          registration = $4,
          notes = $5,
          updated_at = NOW()
      `, [
        vehicleId,
        record.description || '',
        parseInt(record.seats || '10'),
        record.registration || '',
        record.notes || ''
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Import venues to SQLite
async function importVenues(db, records) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO venues (
          id, name, address, suburb, state, postcode, latitude, longitude, is_main_centre, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      records.forEach(record => {
        stmt.run(
          parseInt(record.id) || null,
          record.name,
          record.address || '',
          record.suburb || '',
          record.state || 'NSW',
          record.postcode || '',
          parseFloat(record.latitude) || null,
          parseFloat(record.longitude) || null,
          record.is_main_centre === 'true' ? 1 : 0,
          record.notes || ''
        );
      });
      
      stmt.finalize();
      
      db.run('COMMIT', err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// Import venues to PostgreSQL
async function importPostgresVenues(client, records) {
  try {
    await client.query('BEGIN');
    
    for (const record of records) {
      await client.query(`
        INSERT INTO venues (
          name, address, suburb, state, postcode, latitude, longitude, is_main_centre, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = $1,
          address = $2,
          suburb = $3,
          state = $4,
          postcode = $5,
          latitude = $6,
          longitude = $7,
          is_main_centre = $8,
          notes = $9,
          updated_at = NOW()
      `, [
        record.name,
        record.address || '',
        record.suburb || '',
        record.state || 'NSW',
        record.postcode || '',
        parseFloat(record.latitude) || null,
        parseFloat(record.longitude) || null,
        record.is_main_centre === 'true',
        record.notes || ''
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// Create sample data
async function createSampleData(db) {
  console.log('Creating sample data...');
  
  // Check if we already have data
  let counts;
  
  if (config.usePostgres) {
    const staffCount = await db.query('SELECT COUNT(*) as count FROM staff');
    const participantCount = await db.query('SELECT COUNT(*) as count FROM participants');
    const vehicleCount = await db.query('SELECT COUNT(*) as count FROM vehicles');
    const venueCount = await db.query('SELECT COUNT(*) as count FROM venues');
    
    counts = [
      parseInt(staffCount.rows[0].count),
      parseInt(participantCount.rows[0].count),
      parseInt(vehicleCount.rows[0].count),
      parseInt(venueCount.rows[0].count)
    ];
  } else {
    counts = await Promise.all([
      checkTableCount(db, 'staff'),
      checkTableCount(db, 'participants'),
      checkTableCount(db, 'vehicles'),
      checkTableCount(db, 'venues')
    ]);
  }
  
  if (counts.some(count => count > 0)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Data already exists in the database. Create sample data anyway? (y/N) ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Skipping sample data creation.');
      return;
    }
  }
  
  try {
    if (config.usePostgres) {
      // Create sample staff
      await db.query('TRUNCATE TABLE staff CASCADE');
      await importPostgresStaff(db, [
        { first_name: 'John', last_name: 'Smith', schads_level: '3', contracted_hours: '40' },
        { first_name: 'Sarah', last_name: 'Johnson', schads_level: '4', contracted_hours: '38' },
        { first_name: 'Michael', last_name: 'Brown', schads_level: '2', contracted_hours: '20' },
        { first_name: 'Emily', last_name: 'Davis', schads_level: '5', contracted_hours: '30' },
        { first_name: 'David', last_name: 'Wilson', schads_level: '3', contracted_hours: '40' }
      ]);
      
      // Create sample participants
      await db.query('TRUNCATE TABLE participants CASCADE');
      await importPostgresParticipants(db, [
        { first_name: 'Alex', last_name: 'Taylor', supervision_multiplier: '1.0' },
        { first_name: 'Jamie', last_name: 'Roberts', supervision_multiplier: '1.5' },
        { first_name: 'Sam', last_name: 'Walker', supervision_multiplier: '1.0' },
        { first_name: 'Jordan', last_name: 'Lee', supervision_multiplier: '1.25' },
        { first_name: 'Casey', last_name: 'Martin', supervision_multiplier: '1.0' },
        { first_name: 'Riley', last_name: 'Thompson', supervision_multiplier: '1.75' },
        { first_name: 'Taylor', last_name: 'White', supervision_multiplier: '1.0' },
        { first_name: 'Morgan', last_name: 'Clark', supervision_multiplier: '1.5' }
      ]);
      
      // Create sample vehicles
      await db.query('TRUNCATE TABLE vehicles CASCADE');
      await importPostgresVehicles(db, [
        { id: 'V1', description: 'Toyota HiAce', seats: '12', registration: 'ABC123' },
        { id: 'V2', description: 'Ford Transit', seats: '10', registration: 'DEF456' },
        { id: 'V3', description: 'Mercedes Sprinter', seats: '14', registration: 'GHI789' }
      ]);
      
      // Create sample venues
      await db.query('TRUNCATE TABLE venues CASCADE');
      await importPostgresVenues(db, [
        { name: 'Main Centre', address: '123 Main St', suburb: 'Sydney', is_main_centre: 'true' },
        { name: 'Community Hall', address: '456 Park Ave', suburb: 'Parramatta' },
        { name: 'Sports Complex', address: '789 Beach Rd', suburb: 'Bondi' }
      ]);
    } else {
      // Create sample staff
      await db.run('DELETE FROM staff');
      await importStaff(db, [
        { first_name: 'John', last_name: 'Smith', schads_level: '3', contracted_hours: '40' },
        { first_name: 'Sarah', last_name: 'Johnson', schads_level: '4', contracted_hours: '38' },
        { first_name: 'Michael', last_name: 'Brown', schads_level: '2', contracted_hours: '20' },
        { first_name: 'Emily', last_name: 'Davis', schads_level: '5', contracted_hours: '30' },
        { first_name: 'David', last_name: 'Wilson', schads_level: '3', contracted_hours: '40' }
      ]);
      
      // Create sample participants
      await db.run('DELETE FROM participants');
      await importParticipants(db, [
        { first_name: 'Alex', last_name: 'Taylor', supervision_multiplier: '1.0' },
        { first_name: 'Jamie', last_name: 'Roberts', supervision_multiplier: '1.5' },
        { first_name: 'Sam', last_name: 'Walker', supervision_multiplier: '1.0' },
        { first_name: 'Jordan', last_name: 'Lee', supervision_multiplier: '1.25' },
        { first_name: 'Casey', last_name: 'Martin', supervision_multiplier: '1.0' },
        { first_name: 'Riley', last_name: 'Thompson', supervision_multiplier: '1.75' },
        { first_name: 'Taylor', last_name: 'White', supervision_multiplier: '1.0' },
        { first_name: 'Morgan', last_name: 'Clark', supervision_multiplier: '1.5' }
      ]);
      
      // Create sample vehicles
      await db.run('DELETE FROM vehicles');
      await importVehicles(db, [
        { id: 'V1', description: 'Toyota HiAce', seats: '12', registration: 'ABC123' },
        { id: 'V2', description: 'Ford Transit', seats: '10', registration: 'DEF456' },
        { id: 'V3', description: 'Mercedes Sprinter', seats: '14', registration: 'GHI789' }
      ]);
      
      // Create sample venues
      await db.run('DELETE FROM venues');
      await importVenues(db, [
        { name: 'Main Centre', address: '123 Main St', suburb: 'Sydney', is_main_centre: 'true' },
        { name: 'Community Hall', address: '456 Park Ave', suburb: 'Parramatta' },
        { name: 'Sports Complex', address: '789 Beach Rd', suburb: 'Bondi' }
      ]);
    }
    
    console.log('✅ Sample data created successfully');
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    throw error;
  }
}

// Check table count in SQLite
function checkTableCount(db, table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

// Get SCHADS rate based on level
function getSchadsRate(level) {
  const rates = {
    1: 28.41,
    2: 32.54,
    3: 34.85,
    4: 36.88,
    5: 39.03,
    6: 43.26,
    7: 46.71,
    8: 50.15
  };
  
  return rates[level] || rates[3];
}

// Verify system readiness
async function verifySystemReadiness(db) {
  console.log('\n🔍 Verifying system readiness...');
  
  try {
    if (config.usePostgres) {
      // Check PostgreSQL tables
      const pgTables = config.usePostgres ? [
        // --- Operational base ---
        'staff', 'participants', 'vehicles', 'venues', 'settings',
        // --- TGL core ---
        'rules_programs', 'rules_program_exceptions', 'rules_participant_schedule',
        'rules_staff_roster', 'loom_instances', 'event_card_map',
        // --- History / Payments (optional but good sanity-check) ---
        'history_ribbon_shifts', 'payment_diamonds'
      ] : [];
      
      for (const table of pgTables) {
        try {
          const result = await db.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )
          `, [table]);
          
          if (result.rows[0].exists) {
            console.log(`✅ Table '${table}' exists`);
          } else {
            console.error(`❌ Table '${table}' is missing`);
            throw new Error(`Table '${table}' is missing`);
          }
        } catch (error) {
          console.error(`❌ Error checking table '${table}':`, error);
          throw error;
        }
      }
      
      // Check if we have staff
      const staffResult = await db.query('SELECT COUNT(*) as count FROM staff');
      const staffCount = parseInt(staffResult.rows[0].count);
      
      if (staffCount === 0) {
        console.log('⚠️ No staff records found. Consider importing staff data or creating sample data.');
      } else {
        console.log(`✅ Found ${staffCount} staff records`);
      }
      
      // Check if we have participants
      const participantResult = await db.query('SELECT COUNT(*) as count FROM participants');
      const participantCount = parseInt(participantResult.rows[0].count);
      
      if (participantCount === 0) {
        console.log('⚠️ No participant records found. Consider importing participant data or creating sample data.');
      } else {
        console.log(`✅ Found ${participantCount} participant records`);
      }
      
      // Check if we have vehicles
      const vehicleResult = await db.query('SELECT COUNT(*) as count FROM vehicles');
      const vehicleCount = parseInt(vehicleResult.rows[0].count);
      
      if (vehicleCount === 0) {
        console.log('⚠️ No vehicle records found. Consider importing vehicle data or creating sample data.');
      } else {
        console.log(`✅ Found ${vehicleCount} vehicle records`);
      }
      
      // Check if we have venues
      const venueResult = await db.query('SELECT COUNT(*) as count FROM venues');
      const venueCount = parseInt(venueResult.rows[0].count);
      
      if (venueCount === 0) {
        console.log('⚠️ No venue records found. Consider importing venue data or creating sample data.');
      } else {
        console.log(`✅ Found ${venueCount} venue records`);
      }
      
      // Check admin percentage setting
      const settingResult = await db.query("SELECT value FROM settings WHERE key = 'admin_expense_percentage'");
      const adminPercentage = settingResult.rows.length > 0 ? settingResult.rows[0].value : null;
      
      if (adminPercentage) {
        console.log(`✅ Admin expense percentage set to ${adminPercentage}%`);
      } else {
        console.log('⚠️ Admin expense percentage not set');
      }
      
      // Check pgvector extension
      try {
        const vectorResult = await db.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          )
        `);
        
        if (vectorResult.rows[0].exists) {
          console.log('✅ pgvector extension is enabled (semantic search available)');
        } else {
          console.log('⚠️ pgvector extension is not enabled (semantic search will be limited)');
        }
      } catch (error) {
        console.log('⚠️ Could not check pgvector extension status');
      }
    } else {
      // Check SQLite tables
      const sqliteTables = [
        'staff', 'participants', 'vehicles', 'venues', 'programs',
        'rate_line_items', 'event_card_map', 'settings'
      ];
      
      for (const table of sqliteTables) {
        try {
          await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });
          console.log(`✅ Table '${table}' exists`);
        } catch (error) {
          console.error(`❌ Table '${table}' is missing or has errors`);
          throw error;
        }
      }
      
      // Check if we have staff
      const staffCount = await checkTableCount(db, 'staff');
      if (staffCount === 0) {
        console.log('⚠️ No staff records found. Consider importing staff data or creating sample data.');
      } else {
        console.log(`✅ Found ${staffCount} staff records`);
      }
      
      // Check if we have participants
      const participantCount = await checkTableCount(db, 'participants');
      if (participantCount === 0) {
        console.log('⚠️ No participant records found. Consider importing participant data or creating sample data.');
      } else {
        console.log(`✅ Found ${participantCount} participant records`);
      }
      
      // Check if we have vehicles
      const vehicleCount = await checkTableCount(db, 'vehicles');
      if (vehicleCount === 0) {
        console.log('⚠️ No vehicle records found. Consider importing vehicle data or creating sample data.');
      } else {
        console.log(`✅ Found ${vehicleCount} vehicle records`);
      }
      
      // Check if we have venues
      const venueCount = await checkTableCount(db, 'venues');
      if (venueCount === 0) {
        console.log('⚠️ No venue records found. Consider importing venue data or creating sample data.');
      } else {
        console.log(`✅ Found ${venueCount} venue records`);
      }
      
      // Check admin percentage setting
      const adminPercentage = await new Promise((resolve, reject) => {
        db.get("SELECT value FROM settings WHERE key = 'admin_expense_percentage'", (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.value : null);
        });
      });
      
      if (adminPercentage) {
        console.log(`✅ Admin expense percentage set to ${adminPercentage}%`);
      } else {
        console.log('⚠️ Admin expense percentage not set');
      }
    }
  } catch (error) {
    console.error('❌ Error during system verification:', error);
    throw error;
  }
  
  console.log('\n✅ System verification complete');
}

// Update environment files for database connection
async function updateEnvFiles() {
  if (!config.usePostgres) return;
  
  console.log('\n📝 Updating environment files for PostgreSQL connection...');
  
  try {
    // Update backend .env
    const backendEnvPath = path.join(__dirname, '../backend/.env');
    let backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
    
    // Add or update PostgreSQL connection info
    const pgEnvVars = `
# --- PostgreSQL Connection (TGL Architecture) ---
PG_HOST=${config.postgres.host}
PG_PORT=${config.postgres.port}
PG_USER=${config.postgres.user}
PG_PASSWORD=${config.postgres.password}
PG_DATABASE=${config.postgres.database}
USE_POSTGRES=true
`;
    
    if (backendEnv.includes('# --- PostgreSQL Connection')) {
      // Replace existing PostgreSQL section
      backendEnv = backendEnv.replace(/# --- PostgreSQL Connection[\s\S]*?(?=\n\n|$)/, pgEnvVars);
    } else {
      // Add new PostgreSQL section
      backendEnv += pgEnvVars;
    }
    
    fs.writeFileSync(backendEnvPath, backendEnv);
    console.log('✅ Updated backend .env file with PostgreSQL connection');
    
    // Update frontend .env if needed
    const frontendEnvPath = path.join(__dirname, '../frontend/.env');
    if (fs.existsSync(frontendEnvPath)) {
      let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
      
      if (!frontendEnv.includes('VITE_USE_POSTGRES')) {
        frontendEnv += '\n# Using TGL Architecture with PostgreSQL\nVITE_USE_POSTGRES=true\n';
        fs.writeFileSync(frontendEnvPath, frontendEnv);
        console.log('✅ Updated frontend .env file with PostgreSQL flag');
      }
    }
  } catch (error) {
    console.error('❌ Error updating environment files:', error);
  }
}

// Generate pgAdmin connection instructions
function generatePgAdminInstructions() {
  if (!config.usePostgres) return;
  
  console.log('\n📋 pgAdmin Connection Instructions:');
  console.log('--------------------------------');
  console.log('1. Open pgAdmin on Lucas (Windows box)');
  console.log('2. Right-click on "Servers" and select "Create" > "Server..."');
  console.log('3. In the "General" tab:');
  console.log(`   • Name: RABS-POC`);
  console.log('4. In the "Connection" tab:');
  console.log(`   • Host: ${config.postgres.host}`);
  console.log(`   • Port: ${config.postgres.port}`);
  console.log(`   • Maintenance database: ${config.postgres.database}`);
  console.log(`   • Username: ${config.postgres.user}`);
  console.log(`   • Password: ${config.postgres.password}`);
  console.log('5. Click "Save" to connect');
  console.log('--------------------------------');
}

// Main function
async function main() {
  console.log('🚀 RABS-POC Launch Preparation Script');
  console.log('====================================');
  
  try {
    parseArgs();
    ensureDatabaseDirectory();
    
    const dbExists = await checkDatabase();
    const db = await initializeDatabase(dbExists);
    
    // Import data if specified
    for (const [type, filePath] of Object.entries(config.importFiles)) {
      if (filePath) {
        await importFromCsv(db, type, filePath);
      }
    }
    
    // Create sample data if requested
    if (config.sampleData) {
      await createSampleData(db);
    }
    
    // Update environment files for database connection
    await updateEnvFiles();
    
    // Verify system readiness
    await verifySystemReadiness(db);
    
    // Generate pgAdmin connection instructions
    generatePgAdminInstructions();
    
    console.log('\n🎉 RABS-POC is ready for launch!');
    console.log('\nNext steps:');
    console.log('1. Start the backend:');
    console.log('   cd backend && npm run dev');
    console.log('2. Start the frontend:');
    console.log('   cd frontend && npm run dev');
    console.log(`\n${config.usePostgres ? '🚀 REVOLUTIONARY' : '🔄 STANDARD'} mode activated!`);
    console.log('\nHappy scheduling! 🚀');
    
    // Close database connection
    if (config.usePostgres) {
      await db.end();
    } else {
      db.close();
    }
  } catch (error) {
    console.error('\n❌ Error preparing for launch:', error);
    process.exit(1);
  }
}

// Run the script
main();
