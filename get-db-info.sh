#!/bin/bash
# get-db-info.sh - Simple PostgreSQL Database Schema Extractor
# Generates a comprehensive markdown file with database structure
# using only basic psql commands

# Database connection parameters (use environment variables or defaults)
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-rabspocdb}
OUTPUT_FILE=${OUTPUT_FILE:-CURRENT_DATABASE.md}

echo "Extracting database schema to $OUTPUT_FILE..."

# Create the output file with a header
cat > "$OUTPUT_FILE" << EOF
# RABS Database Schema
Generated: $(date)

## Database Information

EOF

# Get database version
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" -t >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# List of schemas
echo "## Schemas" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
psql -U "$DB_USER" -d "$DB_NAME" -c "\dn" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# List of tables with row counts
echo "## Tables and Row Counts" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Table Name | Row Count |" >> "$OUTPUT_FILE"
echo "|------------|-----------|" >> "$OUTPUT_FILE"

# Get list of tables
tables=$(psql -U "$DB_USER" -d "$DB_NAME" -c "\dt public.*" -t | awk '{print $3}')

# For each table, get row count
for table in $tables; do
  count=$(psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM $table;" -t | tr -d ' ')
  echo "| $table | $count |" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

# Enum types
echo "## Enum Types" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
psql -U "$DB_USER" -d "$DB_NAME" -c "\dT+" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Detailed table structures
echo "## Table Structures" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for table in $tables; do
  echo "### $table" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  psql -U "$DB_USER" -d "$DB_NAME" -c "\d+ $table" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Foreign key relationships
echo "## Foreign Key Relationships" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Table | Column | References |" >> "$OUTPUT_FILE"
echo "|-------|--------|-----------|" >> "$OUTPUT_FILE"

# Simple query to get foreign keys
psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  tc.table_name as table_name,
  kcu.column_name as column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
FROM
  information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
" -t | while read line; do
  table=$(echo $line | awk '{print $1}')
  column=$(echo $line | awk '{print $2}')
  ref_table=$(echo $line | awk '{print $3}')
  ref_column=$(echo $line | awk '{print $4}')
  echo "| $table | $column | $ref_table.$ref_column |" >> "$OUTPUT_FILE"
done
echo "" >> "$OUTPUT_FILE"

# Indexes
echo "## Indexes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
psql -U "$DB_USER" -d "$DB_NAME" -c "\di" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Database size
echo "## Database Size" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" -t >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Table sizes
echo "## Table Sizes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Table | Size | Size with Indexes |" >> "$OUTPUT_FILE"
echo "|-------|------|-------------------|" >> "$OUTPUT_FILE"

for table in $tables; do
  table_size=$(psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_table_size('$table'));" -t | tr -d ' ')
  total_size=$(psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_total_relation_size('$table'));" -t | tr -d ' ')
  echo "| $table | $table_size | $total_size |" >> "$OUTPUT_FILE"
done

echo "Database schema extraction complete! Output saved to $OUTPUT_FILE"
