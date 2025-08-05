-- =============================================
-- RABS Simple Database Schema Snapshot Generator
-- =============================================
-- This script extracts a complete picture of the database schema
-- using simple SELECT statements instead of complex PL/pgSQL blocks
-- Run with: psql -U postgres -d rabspocdb -f database-simple-snapshot.sql > CURRENT_DATABASE.md

\pset format wrapped
\pset columns 10000
\pset tuples_only on
\pset border 0

\echo '# RABS Database Schema Snapshot'
\echo '## Generated: ' `date`
\echo ''

-- =============================================
-- 1. Database Information
-- =============================================
\echo '## 1. Database Information'
\echo ''
SELECT '- **Database:** ' || current_database();
SELECT '- **PostgreSQL Version:** ' || version();
\echo ''

-- =============================================
-- 2. Enum Types
-- =============================================
\echo '## 2. Enum Types'
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

-- =============================================
-- 3. Tables and Columns
-- =============================================
\echo '## 3. Tables and Columns'
\echo ''

-- Get list of tables
SELECT '### Table: ' || table_name || E'\n' ||
       '**Row count:** ' || (SELECT COUNT(*) FROM ' || table_name::regclass || E') || '\n\n' ||
       '| Column Name | Data Type | Length | Nullable | Default |' || E'\n' ||
       '|-------------|-----------|--------|----------|---------|'
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Get columns for each table
SELECT '| ' || column_name || ' | ' || 
       data_type || ' | ' || 
       COALESCE(character_maximum_length::text, '') || ' | ' || 
       CASE WHEN is_nullable = 'YES' THEN 'YES' ELSE 'NO' END || ' | ' || 
       COALESCE(column_default, '') || ' |'
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- =============================================
-- 4. Primary Keys
-- =============================================
\echo '## 4. Primary Keys'
\echo ''
\echo '| Table | Constraint Name | Columns |'
\echo '|-------|-----------------|---------|'

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

-- =============================================
-- 5. Foreign Keys
-- =============================================
\echo '## 5. Foreign Keys'
\echo ''
\echo '| Table | Column | References Table | References Column | Constraint Name |'
\echo '|-------|--------|-----------------|------------------|-----------------|'

SELECT '| ' || tc.table_name || ' | ' || 
       kcu.column_name || ' | ' || 
       ccu.table_name || ' | ' || 
       ccu.column_name || ' | ' || 
       tc.constraint_name || ' |'
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

-- =============================================
-- 6. Unique Constraints
-- =============================================
\echo '## 6. Unique Constraints'
\echo ''
\echo '| Table | Constraint Name | Columns |'
\echo '|-------|-----------------|---------|'

SELECT '| ' || tc.table_name || ' | ' || 
       tc.constraint_name || ' | ' || 
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) || ' |'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;
\echo ''

-- =============================================
-- 7. Check Constraints
-- =============================================
\echo '## 7. Check Constraints'
\echo ''
\echo '| Table | Constraint Name | Check Clause |'
\echo '|-------|-----------------|-------------|'

SELECT '| ' || nr.nspname || '.' || r.relname || ' | ' || 
       c.conname || ' | ' || 
       pg_get_constraintdef(c.oid) || ' |'
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_namespace nr ON nr.oid = r.relnamespace
WHERE c.contype = 'c'
AND nr.nspname = 'public'
ORDER BY nr.nspname, r.relname, c.conname;
\echo ''

-- =============================================
-- 8. Indexes
-- =============================================
\echo '## 8. Indexes'
\echo ''
\echo '| Table | Index Name | Columns | Type | Unique |'
\echo '|-------|------------|---------|------|--------|'

SELECT '| ' || t.relname || ' | ' || 
       i.relname || ' | ' || 
       pg_get_indexdef(i.oid) || ' | ' || 
       am.amname || ' | ' || 
       CASE WHEN ix.indisunique THEN 'YES' ELSE 'NO' END || ' |'
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_am am ON am.oid = i.relam
WHERE t.relkind = 'r'
AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY t.relname, i.relname;
\echo ''

-- =============================================
-- 9. Table Row Counts
-- =============================================
\echo '## 9. Table Row Counts'
\echo ''
\echo '| Table | Row Count |'
\echo '|-------|-----------|'

SELECT '| ' || table_name || ' | ' || 
       (SELECT COUNT(*) FROM ' || table_name::regclass || ') || ' |'
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
\echo ''

-- =============================================
-- 10. Database Size
-- =============================================
\echo '## 10. Database Size'
\echo ''

SELECT '- **Total Size:** ' || pg_size_pretty(pg_database_size(current_database()));

\echo ''
\echo '| Table | Size | Total Size (with indexes) |'
\echo '|-------|------|---------------------------|'

SELECT 
    '| ' || relname || ' | ' || 
    pg_size_pretty(pg_table_size(c.oid)) || ' | ' ||
    pg_size_pretty(pg_total_relation_size(c.oid)) || ' |'
FROM 
    pg_class c
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE 
    n.nspname = 'public'
    AND c.relkind = 'r'
ORDER BY 
    pg_total_relation_size(c.oid) DESC;
