-- =============================================
-- RABS Database Schema Snapshot Generator
-- =============================================
-- This script extracts a complete picture of the database schema
-- including tables, columns, constraints, relationships, and more.
-- Run with: psql -U postgres -d rabspocdb -f database-snapshot.sql > schema_snapshot.md

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
-- 3. Tables with Column Details
-- =============================================
\echo '## 3. Tables with Column Details'
\echo ''

DO $$
DECLARE
    table_rec RECORD;
    count_result BIGINT; -- holds row count for each table
BEGIN
    FOR table_rec IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '### Table: %', table_rec.table_name;
        
        -- Get row count
        EXECUTE format('SELECT COUNT(*) FROM %I', table_rec.table_name) INTO STRICT count_result;
        RAISE NOTICE '**Row count:** %', count_result;
        RAISE NOTICE '';
        
        -- Column details
        RAISE NOTICE '| Column Name | Data Type | Length | Nullable | Default |';
        RAISE NOTICE '|-------------|-----------|--------|----------|---------|';
        
        FOR col_rec IN 
            SELECT 
                c.column_name,
                c.data_type,
                CASE 
                    WHEN c.character_maximum_length IS NOT NULL THEN c.character_maximum_length::text
                    ELSE ''
                END AS length,
                CASE 
                    WHEN c.is_nullable = 'YES' THEN 'YES'
                    ELSE 'NO'
                END AS nullable,
                COALESCE(c.column_default, '') AS default_value
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = table_rec.table_name
            ORDER BY c.ordinal_position
        LOOP
            RAISE NOTICE '| % | % | % | % | % |',
                col_rec.column_name,
                col_rec.data_type,
                col_rec.length,
                col_rec.nullable,
                col_rec.default_value;
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Primary Key
        RAISE NOTICE '#### Primary Key';
        FOR pk_rec IN
            SELECT 
                tc.constraint_name,
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = table_rec.table_name
            AND tc.table_schema = 'public'
            GROUP BY tc.constraint_name
        LOOP
            RAISE NOTICE '- Constraint Name: %', pk_rec.constraint_name;
            RAISE NOTICE '- Columns: %', pk_rec.columns;
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Foreign Keys
        RAISE NOTICE '#### Foreign Keys';
        FOR fk_rec IN
            SELECT 
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS references_table,
                ccu.column_name AS references_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = table_rec.table_name
            AND tc.table_schema = 'public'
            ORDER BY kcu.ordinal_position
        LOOP
            RAISE NOTICE '- Constraint Name: %', fk_rec.constraint_name;
            RAISE NOTICE '- Column: % → References: %.%', 
                fk_rec.column_name, 
                fk_rec.references_table,
                fk_rec.references_column;
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Unique Constraints
        RAISE NOTICE '#### Unique Constraints';
        FOR uc_rec IN
            SELECT 
                tc.constraint_name,
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = table_rec.table_name
            AND tc.table_schema = 'public'
            GROUP BY tc.constraint_name
        LOOP
            RAISE NOTICE '- Constraint Name: %', uc_rec.constraint_name;
            RAISE NOTICE '- Columns: %', uc_rec.columns;
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Check Constraints
        RAISE NOTICE '#### Check Constraints';
        FOR cc_rec IN
            SELECT 
                tc.constraint_name,
                pg_get_constraintdef(pgc.oid) AS check_clause
            FROM information_schema.table_constraints tc
            JOIN pg_constraint pgc
                ON tc.constraint_name = pgc.conname
            JOIN pg_class cls
                ON cls.oid = pgc.conrelid
            WHERE tc.constraint_type = 'CHECK'
            AND tc.table_name = table_rec.table_name
            AND tc.table_schema = 'public'
        LOOP
            RAISE NOTICE '- Constraint Name: %', cc_rec.constraint_name;
            RAISE NOTICE '- Check Clause: %', cc_rec.check_clause;
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Indexes
        RAISE NOTICE '#### Indexes';
        FOR idx_rec IN
            SELECT
                i.relname AS index_name,
                string_agg(a.attname, ', ' ORDER BY c.ordinality) AS columns,
                am.amname AS index_type,
                CASE 
                    WHEN i.indisunique THEN 'UNIQUE'
                    ELSE 'NON-UNIQUE'
                END AS uniqueness
            FROM
                pg_index ix
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_class t ON t.oid = ix.indrelid
                JOIN pg_am am ON am.oid = i.relam
                JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS c(colnum, ordinality) ON TRUE
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.colnum
            WHERE
                t.relname = table_rec.table_name
                AND t.relkind = 'r'
                AND i.relkind = 'i'
                AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            GROUP BY
                i.relname, am.amname, i.indisunique
            ORDER BY
                i.relname
        LOOP
            RAISE NOTICE '- Index Name: %', idx_rec.index_name;
            RAISE NOTICE '- Columns: %', idx_rec.columns;
            RAISE NOTICE '- Type: % (%)', idx_rec.index_type, idx_rec.uniqueness;
        END LOOP;
        
        RAISE NOTICE '---';
    END LOOP;
END $$;

-- =============================================
-- 4. Views
-- =============================================
\echo '## 4. Views'
\echo ''

DO $$
DECLARE
    view_rec RECORD;
    def_rec  RECORD; -- holds each view definition row
BEGIN
    FOR view_rec IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '### View: %', view_rec.table_name;
        
        -- View definition
        FOR def_rec IN
            SELECT pg_get_viewdef(c.oid, true) AS view_definition
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = view_rec.table_name
            AND n.nspname = 'public'
            AND c.relkind = 'v'
        LOOP
            RAISE NOTICE '```sql';
            RAISE NOTICE '%', def_rec.view_definition;
            RAISE NOTICE '```';
        END LOOP;
        
        RAISE NOTICE '';
        
        -- Column details
        RAISE NOTICE '| Column Name | Data Type |';
        RAISE NOTICE '|-------------|-----------|';
        
        FOR col_rec IN 
            SELECT 
                c.column_name,
                c.data_type
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
            AND c.table_name = view_rec.table_name
            ORDER BY c.ordinal_position
        LOOP
            RAISE NOTICE '| % | % |',
                col_rec.column_name,
                col_rec.data_type;
        END LOOP;
        
        RAISE NOTICE '---';
    END LOOP;
END $$;

-- =============================================
-- 5. Relationships Diagram (Text-based)
-- =============================================
\echo '## 5. Relationships'
\echo ''
\echo 'Tables with their foreign key relationships:'
\echo ''

WITH fk_relationships AS (
    SELECT
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        tc.constraint_name
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
)
SELECT
    '- **' || source_table || '.' || source_column || '** → **' ||
    target_table || '.' || target_column || '** (' || constraint_name || ')'
FROM
    fk_relationships
ORDER BY
    source_table, target_table;

\echo ''
\echo '## 6. Database Statistics'
\echo ''
\echo '| Table Name | Row Count |'
\echo '|------------|-----------|'

DO $$
DECLARE
    tbl_rec RECORD;
    row_count INTEGER;
BEGIN
    FOR tbl_rec IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', tbl_rec.table_name) INTO row_count;
        RAISE NOTICE '| % | % |', tbl_rec.table_name, row_count;
    END LOOP;
END $$;

\echo ''
\echo '## 7. Database Size'
\echo ''

SELECT '- **Total Size:** ' || pg_size_pretty(pg_database_size(current_database()));

\echo ''
\echo '| Table Name | Size | Total Size (with indexes) |'
\echo '|------------|------|---------------------------|'

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
