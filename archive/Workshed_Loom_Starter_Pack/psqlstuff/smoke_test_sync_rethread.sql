-- smoke_test_sync_rethread.sql
-- Sanity-run after applying 002_rules_wall_syncrethread.sql
-- 1) Create a draft rule
INSERT INTO rules_programs(name, day_of_week, start_time, end_time, venue_id, status, recurrence_pattern, week_in_cycle, pickup_runs, dropoff_runs)
SELECT 'Center Based W1 Mon', 1, '08:30','16:30', NULL, 'draft','fortnightly', 1, 2, 3
RETURNING id;

-- Copy the returned id into the \set var when running manually:
-- \set rule '00000000-0000-0000-0000-000000000000'

-- 2) Add slots
INSERT INTO rules_program_slots(rule_id, seq, slot_type, start_time, end_time, route_run_number, label)
VALUES
  (:'rule', 10, 'pickup',  '08:30','10:00', 1, 'Pickup A'),
  (:'rule', 11, 'pickup',  '08:30','10:00', 2, 'Pickup B'),
  (:'rule', 12, 'activity','10:00','12:00', NULL, 'Activity 1'),
  (:'rule', 13, 'meal',    '12:00','12:30', NULL, 'Meal'),
  (:'rule', 14, 'activity','12:30','15:00', NULL, 'Activity 2'),
  (:'rule', 15, 'dropoff', '15:00','16:30', 1, 'Drop A'),
  (:'rule', 16, 'dropoff', '15:00','16:30', 2, 'Drop B'),
  (:'rule', 17, 'dropoff', '15:00','16:30', 3, 'Drop C');

-- 3) Add two fake participants (assumes you have at least 2 in participants)
-- Replace UUIDs below with real participant ids from your DB, then:
-- INSERT INTO rules_program_participants(rule_id, participant_id) VALUES (:'rule','<p1>'), (:'rule','<p2>');
-- SELECT recompute_rule_requirements(:'rule');
-- SELECT * FROM v_rules_program_summary WHERE rule_id = :'rule';

-- 4) (Manual) Implement the finalize endpoint to:
--   - set status='active'
--   - upsert loom_instances(source_rule_id, instance_date, start_time, end_time, venue_id, ...)
--   - delete+recreate event_card_map rows from rules_program_slots for each generated instance date
-- See your existing tables: loom_instances and event_card_map.
