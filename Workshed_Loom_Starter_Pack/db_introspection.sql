-- DB Introspection (run via psql -f db_introspection.sql)
-- 1) Version
SELECT now() AS captured_at, version();

-- 2) Schemas
SELECT nspname AS schema FROM pg_namespace ORDER BY 1;

-- 3) Tables (public)
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY 1;

-- 4) Columns (public)
SELECT table_name, ordinal_position, column_name, data_type, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema='public'
ORDER BY table_name, ordinal_position;

-- 5) Primary keys
SELECT tc.table_name, kc.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kc
  ON tc.constraint_name = kc.constraint_name
WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY'
ORDER BY tc.table_name, kc.ordinal_position;

-- 6) Foreign keys
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table, ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

-- 7) Indexes
SELECT t.relname AS table_name, i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS index_def
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON ix.indexrelid = i.oid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='public'
ORDER BY t.relname, i.relname;

-- 8) Enums
SELECT n.nspname AS enum_schema, t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
ORDER BY enum_name, e.enumsortorder;

-- 9) Views
SELECT table_name AS view_name, view_definition
FROM information_schema.views
WHERE table_schema='public'
ORDER BY 1;

-- 10) Triggers
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema='public'
ORDER BY 1,2;

-- 11) Sequences
SELECT sequence_schema, sequence_name, data_type
FROM information_schema.sequences
ORDER BY 1,2;

-- 12) Row counts (fast estimates)
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY 1;
