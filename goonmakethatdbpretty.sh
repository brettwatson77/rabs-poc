#!/bin/bash

DB="rabspocdb"
USER="postgres"
OUT="CURRENT_DATABASE.md"

echo "# ð Database Schema: $DB" > $OUT
echo "_Generated on $(date)_ by â¨ BrettGPT â¨" >> $OUT
echo "" >> $OUT

# TABLES LOOP
tables=$(psql -U $USER -d $DB -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")

for tbl in $tables; do
  echo -e "\n---\n" >> $OUT
  echo "## ðï¸ Table: \`$tbl\`" >> $OUT

  # Get table comment
  comment=$(psql -U $USER -d $DB -t -c "SELECT obj_description('\"public\".\"$tbl\"'::regclass);")
  if [[ -n "$comment" ]]; then
    echo -e "\n> _${comment//[$'\t\r\n']}_\n" >> $OUT
  fi

  # Estimated row count
  row_count=$(psql -U $USER -d $DB -t -c "SELECT reltuples::bigint FROM pg_class WHERE relname = '$tbl';")
  echo "- **Estimated Rows**: \`$row_count\`" >> $OUT

  # Table size
  size=$(psql -U $USER -d $DB -t -c "SELECT pg_size_pretty(pg_total_relation_size('\"public\".\"$tbl\"'));")
  echo "- **Estimated Disk Size**: \`$size\`" >> $OUT

  # Columns
  echo -e "\n### Columns\n" >> $OUT
  echo "| Column | Type | Nullable | Default | Description |" >> $OUT
  echo "|--------|------|----------|---------|-------------|" >> $OUT

  psql -U $USER -d $DB -t -A -F ',' -c "
    SELECT
      a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
      NOT a.attnotnull AS is_nullable,
      pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
      col_description(a.attrelid, a.attnum) AS description
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    WHERE a.attrelid = '\"public\".\"$tbl\"'::regclass
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum;
  " | while IFS=',' read -r col type nullable def comment; do
    echo "| **$col** | \`$type\` | ${nullable:-NO} | ${def:--} | ${comment:--} |" >> $OUT
  done

  # Constraints
  echo -e "\n### Constraints\n" >> $OUT
  echo "| Type | Column | Ref Table | Ref Column |" >> $OUT
  echo "|------|--------|-----------|------------|" >> $OUT
  psql -U $USER -d $DB -t -A -F ',' -c "
    SELECT
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints AS tc
    LEFT JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = '$tbl';
  " | while IFS=',' read -r type col ref_tbl ref_col; do
    echo "| $type | \`$col\` | ${ref_tbl:--} | ${ref_col:--} |" >> $OUT
  done

  # Indexes
  echo -e "\n### Indexes\n" >> $OUT
  psql -U $USER -d $DB -t -A -F '|' -c "
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = '$tbl';
  " | while IFS='|' read -r idx def; do
    echo "- **$idx**: \`$def\`" >> $OUT
  done

done

# ENUM types
echo -e "\n---\n\n## ð§¬ ENUM Types\n" >> $OUT
psql -U $USER -d $DB -t -A -F '|' -c "
  SELECT n.nspname AS schema, t.typname AS name,
         string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY schema, name;
" | while IFS='|' read -r schema enum_name values; do
  echo "- **\`$enum_name\`**: $values" >> $OUT
done
