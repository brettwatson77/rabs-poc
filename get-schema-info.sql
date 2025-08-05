-- =============================================
-- RABS Simple Database Schema Extractor
-- =============================================
-- Run with: psql -U postgres -d rabspocdb -f get-schema-info.sql > CURRENT_DATABASE.md

\pset format wrapped
\pset columns 10000
\pset tuples_only on
\pset border 0

\echo '# RABS Database Schema'
\echo '## Generated: ' `date`
\echo ''

-- Database Info
\echo '## Database Information'
\echo ''
\echo '- **Database:** ' `echo :DBNAME`
\echo '- **Version:** ' `select version()`
\echo ''

-- List of tables with row counts
\echo '## Tables and Row Counts'
\echo ''
\echo '| Table Name | Row Count |'
\echo '|------------|-----------|'
SELECT '| ' || tablename || ' | ' || 
  (SELECT count(*) FROM ' || tablename || ') || ' |'
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
\echo ''

-- Enum types
\echo '## Enum Types'
\echo ''
\echo '| Enum Name | Values |'
\echo '|-----------|--------|'
SELECT '| ' || t.typname || ' | ' || 
       string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) || ' |'
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;
\echo ''

-- Table columns
\echo '## Table Columns'
\echo ''

SELECT '### ' || table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo '| Column Name | Data Type | Nullable | Default |'
\echo '|-------------|-----------|----------|---------|'

SELECT '| ' || column_name || ' | ' || 
       data_type || 
       CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
       END || ' | ' || 
       is_nullable || ' | ' || 
       COALESCE(column_default, '') || ' |'
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
\echo ''

-- Primary Keys
\echo '## Primary Keys'
\echo ''
\echo '| Table | Constraint Name | Column(s) |'
\echo '|-------|-----------------|-----------|'
SELECT '| ' || tc.table_name || ' | ' || 
       tc.constraint_name || ' | ' || 
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ' |'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;
\echo ''

-- Foreign Keys
\echo '## Foreign Keys'
\echo ''
\echo '| Table | Column | References |'
\echo '|-------|--------|-----------|'
SELECT '| ' || tc.table_name || ' | ' || 
       kcu.column_name || ' | ' || 
       ccu.table_name || '.' || ccu.column_name || ' |'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
\echo ''

-- Indexes
\echo '## Indexes'
\echo ''
\echo '| Table | Index Name | Unique | Definition |'
\echo '|-------|------------|--------|------------|'
SELECT '| ' || tablename || ' | ' || 
       indexname || ' | ' ||
       CASE WHEN indisunique THEN 'YES' ELSE 'NO' END || ' | ' ||
       indexdef || ' |'
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
\echo ''
