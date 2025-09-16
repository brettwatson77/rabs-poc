/**
 * check-vehicle-schema.js
 * 
 * Utility script to check the actual schema of the vehicles table
 * in the PostgreSQL database. This helps identify column mismatches
 * between the service code and the actual database schema.
 */

const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'rabspocdb'
});

async function checkVehicleSchema() {
  try {
    console.log('Connecting to PostgreSQL database...');
    
    // Query to get column information for vehicles table
    const columnQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM 
        information_schema.columns 
      WHERE 
        table_name = 'vehicles'
      ORDER BY 
        ordinal_position;
    `;
    
    // Execute query
    const { rows } = await pool.query(columnQuery);
    
    if (rows.length === 0) {
      console.log('No columns found. The vehicles table might not exist.');
      return;
    }
    
    // Display results
    console.log('\n=== VEHICLES TABLE SCHEMA ===');
    console.log('Column Name'.padEnd(25) + 'Data Type'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default');
    console.log('='.repeat(75));
    
    rows.forEach(col => {
      console.log(
        col.column_name.padEnd(25) + 
        col.data_type.padEnd(20) + 
        col.is_nullable.padEnd(10) + 
        (col.column_default || '')
      );
    });
    
    // Also check if there are any rows in the table
    const countQuery = 'SELECT COUNT(*) as count FROM vehicles';
    const countResult = await pool.query(countQuery);
    const rowCount = parseInt(countResult.rows[0].count);
    
    console.log('\nTotal rows in vehicles table:', rowCount);
    
    if (rowCount > 0) {
      // Get sample row to see actual data structure
      const sampleQuery = 'SELECT * FROM vehicles LIMIT 1';
      const sampleResult = await pool.query(sampleQuery);
      
      console.log('\nSample row data:');
      console.log(JSON.stringify(sampleResult.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error checking vehicle schema:', error);
  } finally {
    // Close pool
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

// Run the function
checkVehicleSchema();
