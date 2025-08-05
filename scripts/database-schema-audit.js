/**
 * Database Schema Audit Script
 * 
 * This script performs a comprehensive audit of the PostgreSQL database schema,
 * extracting all tables, columns, data types, constraints, indexes, foreign keys,
 * and relationships. It generates a detailed markdown report to compare what
 * actually exists in the database vs. what the backend expects vs. what the frontend sends.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const util = require('util');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rabspocdb',
  password: 'postgres',
  port: 5432,
});

// Output file path
const outputFile = path.join(__dirname, '..', 'DATABASE_SCHEMA_AUDIT.md');

// Helper functions
const log = (message) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
};

/**
 * Get all tables in the database
 */
async function getTables() {
  const query = `
    SELECT 
      table_name,
      table_type
    FROM 
      information_schema.tables
    WHERE 
      table_schema = 'public'
    ORDER BY 
      table_name;
  `;
  
  const { rows } = await pool.query(query);
  return rows;
}

/**
 * Get columns for a specific table
 */
async function getTableColumns(tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable
    FROM 
      information_schema.columns
    WHERE 
      table_schema = 'public'
      AND table_name = $1
    ORDER BY 
      ordinal_position;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get primary key constraints for a table
 */
async function getPrimaryKeys(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE
      tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY
      kcu.ordinal_position;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get foreign key constraints for a table
 */
async function getForeignKeys(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY
      kcu.ordinal_position;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get unique constraints for a table
 */
async function getUniqueConstraints(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE
      tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY
      tc.constraint_name,
      kcu.ordinal_position;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get check constraints for a table
 */
async function getCheckConstraints(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      pg_get_constraintdef(pgc.oid) AS check_clause
    FROM
      information_schema.table_constraints tc
      JOIN pg_constraint pgc
        ON tc.constraint_name = pgc.conname
      JOIN pg_class cls
        ON cls.oid = pgc.conrelid
    WHERE
      tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get indexes for a table
 */
async function getIndexes(tableName) {
  const query = `
    SELECT
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary
    FROM
      pg_class t,
      pg_class i,
      pg_index ix,
      pg_attribute a
    WHERE
      t.oid = ix.indrelid
      AND i.oid = ix.indexrelid
      AND a.attrelid = t.oid
      AND a.attnum = ANY(ix.indkey)
      AND t.relkind = 'r'
      AND t.relname = $1
    ORDER BY
      i.relname,
      a.attnum;
  `;
  
  const { rows } = await pool.query(query, [tableName]);
  return rows;
}

/**
 * Get enum types defined in the database
 */
async function getEnumTypes() {
  const query = `
    SELECT
      t.typname AS enum_name,
      e.enumlabel AS enum_value
    FROM
      pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE
      n.nspname = 'public'
    ORDER BY
      t.typname,
      e.enumsortorder;
  `;
  
  const { rows } = await pool.query(query);
  return rows;
}

/**
 * Get table row counts
 */
async function getTableRowCounts(tables) {
  const counts = {};
  
  for (const table of tables) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${table.table_name}"`);
      counts[table.table_name] = parseInt(rows[0].count, 10);
    } catch (error) {
      counts[table.table_name] = `Error: ${error.message}`;
    }
  }
  
  return counts;
}

/**
 * Generate markdown report
 */
async function generateReport() {
  let markdown = `# Database Schema Audit\n\n`;
  markdown += `_Generated on ${new Date().toISOString().split('T')[0]}_\n\n`;
  
  // Get all tables
  log('Fetching tables...');
  const tables = await getTables();
  markdown += `## Database Overview\n\n`;
  markdown += `Total tables: ${tables.length}\n\n`;
  
  // Get enum types
  log('Fetching enum types...');
  const enumTypes = await getEnumTypes();
  const enumsByType = {};
  
  enumTypes.forEach(row => {
    if (!enumsByType[row.enum_name]) {
      enumsByType[row.enum_name] = [];
    }
    enumsByType[row.enum_name].push(row.enum_value);
  });
  
  // Add enum types section
  if (Object.keys(enumsByType).length > 0) {
    markdown += `## Enum Types\n\n`;
    
    for (const [enumName, values] of Object.entries(enumsByType)) {
      markdown += `### ${enumName}\n\n`;
      markdown += `\`\`\`\n${values.join(', ')}\n\`\`\`\n\n`;
    }
  }
  
  // Get row counts
  log('Counting rows in tables...');
  const rowCounts = await getTableRowCounts(tables);
  
  // Process each table
  markdown += `## Tables\n\n`;
  
  for (const table of tables) {
    const tableName = table.table_name;
    log(`Processing table: ${tableName}`);
    
    markdown += `### ${tableName}\n\n`;
    markdown += `**Type:** ${table.table_type}\n\n`;
    markdown += `**Row count:** ${rowCounts[tableName]}\n\n`;
    
    // Get columns
    const columns = await getTableColumns(tableName);
    markdown += `#### Columns\n\n`;
    markdown += `| Column Name | Data Type | Length | Nullable | Default |\n`;
    markdown += `|-------------|-----------|--------|----------|----------|\n`;
    
    for (const column of columns) {
      const length = column.character_maximum_length ? column.character_maximum_length : '';
      const nullable = column.is_nullable === 'YES' ? 'YES' : 'NO';
      const defaultVal = column.column_default ? column.column_default : '';
      
      markdown += `| ${column.column_name} | ${column.data_type} | ${length} | ${nullable} | ${defaultVal} |\n`;
    }
    
    markdown += `\n`;
    
    // Get primary keys
    const primaryKeys = await getPrimaryKeys(tableName);
    if (primaryKeys.length > 0) {
      markdown += `#### Primary Key\n\n`;
      markdown += `- Constraint Name: ${primaryKeys[0].constraint_name}\n`;
      markdown += `- Columns: ${primaryKeys.map(pk => pk.column_name).join(', ')}\n\n`;
    }
    
    // Get foreign keys
    const foreignKeys = await getForeignKeys(tableName);
    if (foreignKeys.length > 0) {
      markdown += `#### Foreign Keys\n\n`;
      markdown += `| Constraint Name | Column | References Table | References Column |\n`;
      markdown += `|-----------------|--------|-----------------|------------------|\n`;
      
      for (const fk of foreignKeys) {
        markdown += `| ${fk.constraint_name} | ${fk.column_name} | ${fk.foreign_table_name} | ${fk.foreign_column_name} |\n`;
      }
      
      markdown += `\n`;
    }
    
    // Get unique constraints
    const uniqueConstraints = await getUniqueConstraints(tableName);
    if (uniqueConstraints.length > 0) {
      markdown += `#### Unique Constraints\n\n`;
      
      // Group by constraint name
      const groupedUnique = {};
      uniqueConstraints.forEach(uc => {
        if (!groupedUnique[uc.constraint_name]) {
          groupedUnique[uc.constraint_name] = [];
        }
        groupedUnique[uc.constraint_name].push(uc.column_name);
      });
      
      for (const [constraintName, columns] of Object.entries(groupedUnique)) {
        markdown += `- ${constraintName}: ${columns.join(', ')}\n`;
      }
      
      markdown += `\n`;
    }
    
    // Get check constraints
    const checkConstraints = await getCheckConstraints(tableName);
    if (checkConstraints.length > 0) {
      markdown += `#### Check Constraints\n\n`;
      
      for (const cc of checkConstraints) {
        markdown += `- ${cc.constraint_name}: \`${cc.check_clause}\`\n`;
      }
      
      markdown += `\n`;
    }
    
    // Get indexes
    const indexes = await getIndexes(tableName);
    if (indexes.length > 0) {
      markdown += `#### Indexes\n\n`;
      
      // Group by index name
      const groupedIndexes = {};
      indexes.forEach(idx => {
        if (!groupedIndexes[idx.index_name]) {
          groupedIndexes[idx.index_name] = {
            columns: [],
            is_unique: idx.is_unique,
            is_primary: idx.is_primary
          };
        }
        groupedIndexes[idx.index_name].columns.push(idx.column_name);
      });
      
      for (const [indexName, info] of Object.entries(groupedIndexes)) {
        const type = info.is_primary ? 'PRIMARY KEY' : (info.is_unique ? 'UNIQUE' : 'INDEX');
        markdown += `- ${indexName} (${type}): ${info.columns.join(', ')}\n`;
      }
      
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
  }
  
  // Add relationships section
  markdown += `## Relationships\n\n`;
  
  // Build a relationships map
  const relationships = {};
  
  for (const table of tables) {
    const tableName = table.table_name;
    const foreignKeys = await getForeignKeys(tableName);
    
    for (const fk of foreignKeys) {
      const sourceTable = tableName;
      const targetTable = fk.foreign_table_name;
      
      if (!relationships[sourceTable]) {
        relationships[sourceTable] = [];
      }
      
      relationships[sourceTable].push({
        targetTable,
        sourceColumn: fk.column_name,
        targetColumn: fk.foreign_column_name,
        constraintName: fk.constraint_name
      });
    }
  }
  
  // Output relationships
  for (const [sourceTable, relations] of Object.entries(relationships)) {
    markdown += `### ${sourceTable}\n\n`;
    
    for (const rel of relations) {
      markdown += `- **→ ${rel.targetTable}** via \`${rel.sourceColumn}\` → \`${rel.targetColumn}\` (${rel.constraintName})\n`;
    }
    
    markdown += `\n`;
  }
  
  // Add summary section
  markdown += `## Summary\n\n`;
  markdown += `- **Total tables:** ${tables.length}\n`;
  markdown += `- **Total enum types:** ${Object.keys(enumsByType).length}\n`;
  
  // Count total columns
  let totalColumns = 0;
  for (const table of tables) {
    const columns = await getTableColumns(table.table_name);
    totalColumns += columns.length;
  }
  markdown += `- **Total columns:** ${totalColumns}\n`;
  
  // Count relationships
  let totalRelationships = 0;
  for (const relations of Object.values(relationships)) {
    totalRelationships += relations.length;
  }
  markdown += `- **Total relationships:** ${totalRelationships}\n\n`;
  
  // Write the report
  fs.writeFileSync(outputFile, markdown);
  log(`Report written to ${outputFile}`);
  
  return {
    tables: tables.length,
    columns: totalColumns,
    relationships: totalRelationships,
    enums: Object.keys(enumsByType).length
  };
}

// Main function
async function main() {
  log('Starting database schema audit...');
  
  try {
    const summary = await generateReport();
    
    log('\n================================================================================');
    log('AUDIT COMPLETE');
    log('================================================================================\n');
    
    log(`Tables: ${summary.tables}`);
    log(`Columns: ${summary.columns}`);
    log(`Relationships: ${summary.relationships}`);
    log(`Enum Types: ${summary.enums}`);
    
    log(`\nReport written to: ${outputFile}`);
    log('\nNext steps:');
    log('1. Review the generated report');
    log('2. Compare with frontend API expectations');
    log('3. Compare with backend controller implementations');
    log('4. Identify schema gaps and inconsistencies');
    
  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
