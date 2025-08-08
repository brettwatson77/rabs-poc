# RABS Database Schema
Generated: Tue 05 Aug 2025 23:24:29 AEST

## Database Information

 PostgreSQL 17.5 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.1.1 20250425, 64-bit


## Schemas

      List of schemas
  Name  |       Owner       
--------+-------------------
 public | pg_database_owner
(1 row)


## Tables and Row Counts

| Table Name | Row Count |
|------------|-----------|
| billing_codes | 8 |
| change_log | 0 |
| event_card_map | 0 |
| history_pinned_artifacts | 0 |
| history_ribbon_participants | 0 |
| history_ribbon_shifts | 0 |
| history_ribbon_staff | 0 |
| history_ribbon_tags | 0 |
| loom_instances | 0 |
| loom_participant_attendance | 0 |
| loom_staff_assignments | 0 |
| loom_vehicle_assignments | 0 |
| master_schedule_items | 14 |
| migrations | 4 |
| participant_billing_codes | 0 |
| participants | 120 |
| payment_diamonds | 0 |
| pending_enrollment_changes | 0 |
| program_enrollments | 0 |
| program_participants | 2 |
| programs | 2 |
| rules_participant_schedule | 0 |
| rules_program_exceptions | 0 |
| rules_programs | 0 |
| rules_staff_roster | 0 |
| schedule | 0 |
| settings | 4 |
| staff | 58 |
| staff_unavailabilities | 0 |
| system_logs | 5 |
| tgl_config | 4 |
| tgl_loom_audit_log | 4 |
| tgl_loom_instances | 1 |
| tgl_loom_participant_allocations | 0 |
| tgl_loom_staff_shifts | 0 |
| tgl_loom_time_slots | 3 |
| tgl_loom_vehicle_runs | 0 |
| tgl_operator_intents | 0 |
| tgl_settings | 17 |
| tgl_temporal_exceptions | 0 |
| vehicle_blackouts | 0 |
| vehicles | 16 |
| venues | 2 |

## Enum Types

                                                                                            List of data types
 Schema |         Name         |    Internal name     | Size |        Elements        |  Owner   | Access privileges |                                     Description                                     
--------+----------------------+----------------------+------+------------------------+----------+-------------------+-------------------------------------------------------------------------------------
 public | allocation_status    | allocation_status    | 4    | planned               +| postgres |                   | 
        |                      |                      |      | attended              +|          |                   | 
        |                      |                      |      | cancelled             +|          |                   | 
        |                      |                      |      | no_show                |          |                   | 
 public | cancellation_type    | cancellation_type    | 4    | participant_request   +| postgres |                   | 
        |                      |                      |      | medical               +|          |                   | 
        |                      |                      |      | program_change        +|          |                   | 
        |                      |                      |      | staff_shortage        +|          |                   | 
        |                      |                      |      | venue_issue           +|          |                   | 
        |                      |                      |      | transportation_issue  +|          |                   | 
        |                      |                      |      | weather               +|          |                   | 
        |                      |                      |      | other                  |          |                   | 
 public | halfvec              | halfvec              | var  |                        | postgres |                   | 
 public | loom_actor           | loom_actor           | 4    | loom_engine           +| postgres |                   | 
        |                      |                      |      | human                  |          |                   | 
 public | loom_instance_status | loom_instance_status | 4    | draft                 +| postgres |                   | 
        |                      |                      |      | planned               +|          |                   | 
        |                      |                      |      | staffed               +|          |                   | 
        |                      |                      |      | transport_assigned    +|          |                   | 
        |                      |                      |      | ready                 +|          |                   | 
        |                      |                      |      | in_progress           +|          |                   | 
        |                      |                      |      | completed             +|          |                   | 
        |                      |                      |      | cancelled             +|          |                   | 
        |                      |                      |      | needs_attention        |          |                   | 
 public | plan_management_enum | plan_management_enum | 4    | plan_managed          +| postgres |                   | 
        |                      |                      |      | self_managed          +|          |                   | 
        |                      |                      |      | agency_managed        +|          |                   | 
        |                      |                      |      | self_funded            |          |                   | 
 public | sparsevec            | sparsevec            | var  |                        | postgres |                   | 
 public | staff_role           | staff_role           | 4    | lead                  +| postgres |                   | 
        |                      |                      |      | support               +|          |                   | 
        |                      |                      |      | specialist            +|          |                   | 
        |                      |                      |      | driver                 |          |                   | 
 public | staff_shift_status   | staff_shift_status   | 4    | planned               +| postgres |                   | 
        |                      |                      |      | confirmed             +|          |                   | 
        |                      |                      |      | completed             +|          |                   | 
        |                      |                      |      | sick                  +|          |                   | 
        |                      |                      |      | cancelled              |          |                   | 
 public | tgl_card_type        | tgl_card_type        | 4    | PICKUP                +| postgres |                   | 
        |                      |                      |      | ACTIVITY              +|          |                   | 
        |                      |                      |      | DROPOFF               +|          |                   | 
        |                      |                      |      | PROGRAM                |          |                   | 
 public | tgl_exception_type   | tgl_exception_type   | 4    | participant_absence   +| postgres |                   | 
        |                      |                      |      | staff_absence         +|          |                   | 
        |                      |                      |      | venue_unavailable     +|          |                   | 
        |                      |                      |      | program_cancellation  +|          |                   | 
        |                      |                      |      | program_reschedule    +|          |                   | 
        |                      |                      |      | transport_change      +|          |                   | 
        |                      |                      |      | billing_exception     +|          |                   | 
        |                      |                      |      | note                   |          |                   | 
 public | tgl_intent_type      | tgl_intent_type      | 4    | participant_enrollment+| postgres |                   | Intent types for operator actions including CREATE_PROGRAM for new program creation
        |                      |                      |      | participant_departure +|          |                   | 
        |                      |                      |      | program_transfer      +|          |                   | 
        |                      |                      |      | staff_assignment      +|          |                   | 
        |                      |                      |      | venue_change          +|          |                   | 
        |                      |                      |      | program_modification  +|          |                   | 
        |                      |                      |      | billing_code_change   +|          |                   | 
        |                      |                      |      | resource_requirement  +|          |                   | 
        |                      |                      |      | CREATE_PROGRAM         |          |                   | 
 public | vector               | vector               | var  |                        | postgres |                   | 
 public | vehicle_run_status   | vehicle_run_status   | 4    | planned               +| postgres |                   | 
        |                      |                      |      | confirmed              |          |                   | 
(14 rows)


## Table Structures

### billing_codes

                                                      Table "public.billing_codes"
   Column    |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id          | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 code        | character varying(50)    |           | not null |                   | extended |             |              | 
 description | text                     |           | not null |                   | extended |             |              | 
 rate        | numeric(10,2)            |           | not null |                   | main     |             |              | 
 active      | boolean                  |           | not null | true              | plain    |             |              | 
 created_at  | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at  | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "billing_codes_pkey" PRIMARY KEY, btree (id)
    "billing_codes_code_key" UNIQUE CONSTRAINT, btree (code)
Referenced by:
    TABLE "program_participants" CONSTRAINT "program_participants_billing_code_id_fkey" FOREIGN KEY (billing_code_id) REFERENCES billing_codes(id) ON DELETE SET NULL
    TABLE "tgl_loom_participant_allocations" CONSTRAINT "tgl_loom_participant_allocations_billing_code_id_fkey" FOREIGN KEY (billing_code_id) REFERENCES billing_codes(id) ON DELETE SET NULL
Triggers:
    update_billing_codes_modtime BEFORE UPDATE ON billing_codes FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### change_log

                                                          Table "public.change_log"
     Column     |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id             | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 change_date    | timestamp with time zone |           | not null | now()              | plain    |             |              | 
 change_type    | text                     |           | not null |                    | extended |             |              | 
 description    | text                     |           | not null |                    | extended |             |              | 
 participant_id | uuid                     |           |          |                    | plain    |             |              | 
 billing_impact | boolean                  |           | not null | false              | plain    |             |              | 
 billing_status | text                     |           | not null | 'NA'::text         | extended |             |              | 
Indexes:
    "change_log_pkey" PRIMARY KEY, btree (id)
    "idx_change_log_billing_impact" btree (billing_impact) WHERE billing_impact = true
    "idx_change_log_billing_status" btree (billing_status) WHERE billing_status <> 'NA'::text
    "idx_change_log_participant_date" btree (participant_id, change_date)
    "idx_change_log_participant_type" btree (participant_id, change_type)
Triggers:
    trigger_update_change_log_change_date BEFORE UPDATE ON change_log FOR EACH ROW EXECUTE FUNCTION update_change_log_change_date()
Access method: heap


### event_card_map

                                                          Table "public.event_card_map"
       Column       |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
--------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                 | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 loom_instance_id   | uuid                     |           | not null |                    | plain    |             |              | 
 card_type          | text                     |           | not null |                    | extended |             |              | 
 card_order         | integer                  |           | not null |                    | plain    |             |              | 
 display_title      | text                     |           | not null |                    | extended |             |              | 
 display_subtitle   | text                     |           |          |                    | extended |             |              | 
 display_time_start | timestamp with time zone |           | not null |                    | plain    |             |              | 
 display_time_end   | timestamp with time zone |           | not null |                    | plain    |             |              | 
 card_color         | text                     |           |          |                    | extended |             |              | 
 card_icon          | text                     |           |          |                    | extended |             |              | 
 created_at         | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "event_card_map_pkey" PRIMARY KEY, btree (id)
    "idx_event_card_map_loom" btree (loom_instance_id)
Foreign-key constraints:
    "event_card_map_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
Access method: heap


### history_pinned_artifacts

                                                    Table "public.history_pinned_artifacts"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 history_shift_id | uuid                     |           | not null |                    | plain    |             |              | 
 artifact_type    | text                     |           | not null |                    | extended |             |              | 
 title            | text                     |           | not null |                    | extended |             |              | 
 content          | text                     |           |          |                    | extended |             |              | 
 severity         | text                     |           |          |                    | extended |             |              | 
 created_by       | text                     |           | not null |                    | extended |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 embedding        | vector(768)              |           |          |                    | external |             |              | 
Indexes:
    "history_pinned_artifacts_pkey" PRIMARY KEY, btree (id)
    "idx_history_pinned_artifacts_type" btree (artifact_type)
Foreign-key constraints:
    "history_pinned_artifacts_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Access method: heap


### history_ribbon_participants

                                          Table "public.history_ribbon_participants"
      Column       |  Type   | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
-------------------+---------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                | uuid    |           | not null | uuid_generate_v4() | plain    |             |              | 
 history_shift_id  | uuid    |           | not null |                    | plain    |             |              | 
 participant_id    | uuid    |           | not null |                    | plain    |             |              | 
 participant_name  | text    |           | not null |                    | extended |             |              | 
 attendance_status | text    |           | not null |                    | extended |             |              | 
 pickup_provided   | boolean |           |          |                    | plain    |             |              | 
 dropoff_provided  | boolean |           |          |                    | plain    |             |              | 
 notes             | text    |           |          |                    | extended |             |              | 
Indexes:
    "history_ribbon_participants_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "history_ribbon_participants_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Access method: heap


### history_ribbon_shifts

                                                       Table "public.history_ribbon_shifts"
       Column        |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
---------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                  | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 original_loom_id    | uuid                     |           | not null |                    | plain    |             |              | 
 program_name        | text                     |           | not null |                    | extended |             |              | 
 program_description | text                     |           |          |                    | extended |             |              | 
 instance_date       | date                     |           | not null |                    | plain    |             |              | 
 start_time          | time without time zone   |           | not null |                    | plain    |             |              | 
 end_time            | time without time zone   |           | not null |                    | plain    |             |              | 
 venue_name          | text                     |           | not null |                    | extended |             |              | 
 venue_address       | text                     |           |          |                    | extended |             |              | 
 participant_count   | integer                  |           | not null |                    | plain    |             |              | 
 staff_count         | integer                  |           | not null |                    | plain    |             |              | 
 vehicle_count       | integer                  |           | not null |                    | plain    |             |              | 
 completion_status   | text                     |           | not null |                    | extended |             |              | 
 woven_at            | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 archived            | boolean                  |           |          | false              | plain    |             |              | 
Indexes:
    "history_ribbon_shifts_pkey" PRIMARY KEY, btree (id)
    "idx_history_ribbon_date" btree (instance_date)
Referenced by:
    TABLE "history_pinned_artifacts" CONSTRAINT "history_pinned_artifacts_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
    TABLE "history_ribbon_participants" CONSTRAINT "history_ribbon_participants_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
    TABLE "history_ribbon_staff" CONSTRAINT "history_ribbon_staff_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
    TABLE "history_ribbon_tags" CONSTRAINT "history_ribbon_tags_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
    TABLE "payment_diamonds" CONSTRAINT "payment_diamonds_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Access method: heap


### history_ribbon_staff

                                                Table "public.history_ribbon_staff"
      Column      |     Type     | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid         |           | not null | uuid_generate_v4() | plain    |             |              | 
 history_shift_id | uuid         |           | not null |                    | plain    |             |              | 
 staff_id         | uuid         |           | not null |                    | plain    |             |              | 
 staff_name       | text         |           | not null |                    | extended |             |              | 
 role             | text         |           | not null |                    | extended |             |              | 
 hours_worked     | numeric(5,2) |           | not null |                    | main     |             |              | 
 notes            | text         |           |          |                    | extended |             |              | 
Indexes:
    "history_ribbon_staff_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "history_ribbon_staff_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Access method: heap


### history_ribbon_tags

                                                      Table "public.history_ribbon_tags"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 history_shift_id | uuid                     |           | not null |                    | plain    |             |              | 
 tag_key          | text                     |           | not null |                    | extended |             |              | 
 tag_value        | text                     |           | not null |                    | extended |             |              | 
 embedding        | vector(768)              |           |          |                    | external |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "history_ribbon_tags_pkey" PRIMARY KEY, btree (id)
    "idx_history_ribbon_tags_embedding" ivfflat (embedding vector_cosine_ops)
Foreign-key constraints:
    "history_ribbon_tags_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Access method: heap


### loom_instances

                                                          Table "public.loom_instances"
       Column       |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
--------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                 | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 source_rule_id     | uuid                     |           | not null |                    | plain    |             |              | 
 instance_date      | date                     |           | not null |                    | plain    |             |              | 
 start_time         | time without time zone   |           | not null |                    | plain    |             |              | 
 end_time           | time without time zone   |           | not null |                    | plain    |             |              | 
 venue_id           | uuid                     |           |          |                    | plain    |             |              | 
 transport_required | boolean                  |           |          | true               | plain    |             |              | 
 staffing_ratio     | text                     |           |          | '1:4'::text        | extended |             |              | 
 is_overridden      | boolean                  |           |          | false              | plain    |             |              | 
 override_source    | text                     |           |          |                    | extended |             |              | 
 override_reason    | text                     |           |          |                    | extended |             |              | 
 quality_audit_flag | boolean                  |           |          | false              | plain    |             |              | 
 projection_hash    | text                     |           |          |                    | extended |             |              | 
 projected_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at         | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "loom_instances_pkey" PRIMARY KEY, btree (id)
    "loom_instances_source_rule_id_instance_date_key" UNIQUE CONSTRAINT, btree (source_rule_id, instance_date)
Foreign-key constraints:
    "loom_instances_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_programs(id)
Referenced by:
    TABLE "event_card_map" CONSTRAINT "event_card_map_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
    TABLE "loom_participant_attendance" CONSTRAINT "loom_participant_attendance_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
    TABLE "loom_staff_assignments" CONSTRAINT "loom_staff_assignments_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
    TABLE "loom_vehicle_assignments" CONSTRAINT "loom_vehicle_assignments_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
Triggers:
    update_loom_instances_timestamp BEFORE UPDATE ON loom_instances FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### loom_participant_attendance

                                                  Table "public.loom_participant_attendance"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 loom_instance_id | uuid                     |           | not null |                    | plain    |             |              | 
 participant_id   | uuid                     |           | not null |                    | plain    |             |              | 
 source_rule_id   | uuid                     |           |          |                    | plain    |             |              | 
 status           | text                     |           | not null | 'confirmed'::text  | extended |             |              | 
 is_overridden    | boolean                  |           |          | false              | plain    |             |              | 
 override_source  | text                     |           |          |                    | extended |             |              | 
 override_reason  | text                     |           |          |                    | extended |             |              | 
 pickup_required  | boolean                  |           |          | true               | plain    |             |              | 
 dropoff_required | boolean                  |           |          | true               | plain    |             |              | 
 notes            | text                     |           |          |                    | extended |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "loom_participant_attendance_pkey" PRIMARY KEY, btree (id)
    "loom_participant_attendance_loom_instance_id_participant_id_key" UNIQUE CONSTRAINT, btree (loom_instance_id, participant_id)
Foreign-key constraints:
    "loom_participant_attendance_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
    "loom_participant_attendance_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_participant_schedule(id)
Triggers:
    update_loom_participant_attendance_timestamp BEFORE UPDATE ON loom_participant_attendance FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### loom_staff_assignments

                                                     Table "public.loom_staff_assignments"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 loom_instance_id | uuid                     |           | not null |                    | plain    |             |              | 
 staff_id         | uuid                     |           | not null |                    | plain    |             |              | 
 source_rule_id   | uuid                     |           |          |                    | plain    |             |              | 
 role             | text                     |           | not null | 'support'::text    | extended |             |              | 
 is_overridden    | boolean                  |           |          | false              | plain    |             |              | 
 override_source  | text                     |           |          |                    | extended |             |              | 
 override_reason  | text                     |           |          |                    | extended |             |              | 
 notes            | text                     |           |          |                    | extended |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "loom_staff_assignments_pkey" PRIMARY KEY, btree (id)
    "loom_staff_assignments_loom_instance_id_staff_id_key" UNIQUE CONSTRAINT, btree (loom_instance_id, staff_id)
Foreign-key constraints:
    "loom_staff_assignments_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
    "loom_staff_assignments_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_staff_roster(id)
Triggers:
    update_loom_staff_assignments_timestamp BEFORE UPDATE ON loom_staff_assignments FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### loom_vehicle_assignments

                                                    Table "public.loom_vehicle_assignments"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 loom_instance_id | uuid                     |           | not null |                    | plain    |             |              | 
 vehicle_id       | uuid                     |           | not null |                    | plain    |             |              | 
 driver_staff_id  | uuid                     |           |          |                    | plain    |             |              | 
 is_overridden    | boolean                  |           |          | false              | plain    |             |              | 
 override_source  | text                     |           |          |                    | extended |             |              | 
 override_reason  | text                     |           |          |                    | extended |             |              | 
 notes            | text                     |           |          |                    | extended |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "loom_vehicle_assignments_pkey" PRIMARY KEY, btree (id)
    "loom_vehicle_assignments_loom_instance_id_vehicle_id_key" UNIQUE CONSTRAINT, btree (loom_instance_id, vehicle_id)
Foreign-key constraints:
    "loom_vehicle_assignments_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES loom_instances(id) ON DELETE CASCADE
Triggers:
    update_loom_vehicle_assignments_timestamp BEFORE UPDATE ON loom_vehicle_assignments FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### master_schedule_items

                                                        Table "public.master_schedule_items"
         Column         |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                     | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 program_name           | text                     |           | not null |                    | extended |             |              | 
 date                   | date                     |           | not null |                    | plain    |             |              | 
 start_time             | time without time zone   |           | not null |                    | plain    |             |              | 
 end_time               | time without time zone   |           | not null |                    | plain    |             |              | 
 venue_id               | uuid                     |           |          |                    | plain    |             |              | 
 participant_count      | integer                  |           |          | 0                  | plain    |             |              | 
 supervision_multiplier | numeric(3,2)             |           |          | 1.0                | main     |             |              | 
 status                 | text                     |           |          | 'scheduled'::text  | extended |             |              | 
 created_at             | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "master_schedule_items_pkey" PRIMARY KEY, btree (id)
Access method: heap


### migrations

                                                                   Table "public.migrations"
   Column   |            Type             | Collation | Nullable |                Default                 | Storage  | Compression | Stats target | Description 
------------+-----------------------------+-----------+----------+----------------------------------------+----------+-------------+--------------+-------------
 id         | integer                     |           | not null | nextval('migrations_id_seq'::regclass) | plain    |             |              | 
 name       | text                        |           | not null |                                        | extended |             |              | 
 applied_at | timestamp without time zone |           |          | CURRENT_TIMESTAMP                      | plain    |             |              | 
Indexes:
    "migrations_pkey" PRIMARY KEY, btree (id)
    "migrations_name_key" UNIQUE CONSTRAINT, btree (name)
Access method: heap


### participant_billing_codes

                                                  Table "public.participant_billing_codes"
     Column     |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id             | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 program_id     | uuid                     |           | not null |                   | plain    |             |              | 
 participant_id | uuid                     |           | not null |                   | plain    |             |              | 
 billing_code   | text                     |           | not null |                   | extended |             |              | 
 hours          | numeric(5,2)             |           | not null | 0                 | main     |             |              | 
 start_date     | date                     |           | not null |                   | plain    |             |              | 
 end_date       | date                     |           |          |                   | plain    |             |              | 
 is_active      | boolean                  |           | not null | true              | plain    |             |              | 
 created_at     | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at     | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "participant_billing_codes_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "participant_billing_codes_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    "participant_billing_codes_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
Access method: heap


### participants

                                                                                                                   Table "public.participants"
          Column           |           Type           | Collation | Nullable |                Default                 | Storage  | Compression | Stats target |                                           Description                                            
---------------------------+--------------------------+-----------+----------+----------------------------------------+----------+-------------+--------------+--------------------------------------------------------------------------------------------------
 id                        | uuid                     |           | not null | gen_random_uuid()                      | plain    |             |              | 
 first_name                | character varying(100)   |           | not null |                                        | extended |             |              | 
 last_name                 | character varying(100)   |           | not null |                                        | extended |             |              | 
 date_of_birth             | date                     |           |          |                                        | plain    |             |              | 
 ndis_number               | character varying(50)    |           |          |                                        | extended |             |              | 
 address                   | text                     |           |          |                                        | extended |             |              | 
 suburb                    | character varying(100)   |           |          |                                        | extended |             |              | 
 state                     | character varying(50)    |           |          |                                        | extended |             |              | 
 postcode                  | character varying(10)    |           |          |                                        | extended |             |              | 
 phone                     | character varying(20)    |           |          |                                        | extended |             |              | 
 email                     | character varying(100)   |           |          |                                        | extended |             |              | 
 emergency_contact_name    | character varying(100)   |           |          |                                        | extended |             |              | 
 emergency_contact_phone   | character varying(20)    |           |          |                                        | extended |             |              | 
 notes                     | text                     |           |          |                                        | extended |             |              | 
 active                    | boolean                  |           | not null | true                                   | plain    |             |              | 
 created_at                | timestamp with time zone |           | not null | now()                                  | plain    |             |              | 
 updated_at                | timestamp with time zone |           | not null | now()                                  | plain    |             |              | 
 photo_url                 | text                     |           |          |                                        | extended |             |              | 
 location_lat              | numeric(10,8)            |           |          |                                        | main     |             |              | 
 location_lng              | numeric(11,8)            |           |          |                                        | main     |             |              | 
 supervision_multiplier    | numeric(3,2)             |           | not null | 1.0                                    | main     |             |              | 
 ndis_plan_start           | date                     |           |          |                                        | plain    |             |              | 
 ndis_plan_end             | date                     |           |          |                                        | plain    |             |              | 
 ndis_plan_budget          | numeric(10,2)            |           |          |                                        | main     |             |              | 
 requires_wheelchair       | boolean                  |           |          | false                                  | plain    |             |              | 
 requires_transport        | boolean                  |           |          | false                                  | plain    |             |              | 
 gender                    | character varying(20)    |           |          |                                        | extended |             |              | 
 plan_management_type      | plan_management_enum     |           | not null | 'agency_managed'::plan_management_enum | plain    |             |              | 
 plan_manager_name         | character varying(100)   |           |          |                                        | extended |             |              | 
 plan_manager_email        | character varying(100)   |           |          |                                        | extended |             |              | 
 plan_manager_phone        | character varying(20)    |           |          |                                        | extended |             |              | 
 support_coordinator_name  | character varying(100)   |           |          |                                        | extended |             |              | 
 support_coordinator_email | character varying(100)   |           |          |                                        | extended |             |              | 
 support_coordinator_phone | character varying(20)    |           |          |                                        | extended |             |              | 
 guardian_name             | character varying(100)   |           |          |                                        | extended |             |              | 
 guardian_relationship     | character varying(50)    |           |          |                                        | extended |             |              | 
 guardian_contact          | character varying(100)   |           |          |                                        | extended |             |              | 
 has_behavior_support_plan | boolean                  |           |          | false                                  | plain    |             |              | 
 has_medical_plan          | boolean                  |           |          | false                                  | plain    |             |              | 
 allergies                 | text                     |           |          |                                        | extended |             |              | 
 medication_needs          | text                     |           |          |                                        | extended |             |              | 
 mobility_needs            | text                     |           |          |                                        | extended |             |              | 
 communication_needs       | text                     |           |          |                                        | extended |             |              | 
 photo_consent             | boolean                  |           |          | false                                  | plain    |             |              | 
 transport_consent         | boolean                  |           |          | false                                  | plain    |             |              | 
 medication_consent        | boolean                  |           |          | false                                  | plain    |             |              | 
 has_wheelchair_access     | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for wheelchair access needs. Use with mobility_requirements text field for details.
 has_dietary_requirements  | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for any dietary requirements. Use with dietary_requirements text field for details.
 has_medical_requirements  | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for medical requirements. Use with medical_requirements text field for details.
 has_behavioral_support    | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for behavioral support needs. Corresponds to behavior_support_plan field.
 has_visual_impairment     | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for visual impairment support needs.
 has_hearing_impairment    | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for hearing impairment support needs.
 has_cognitive_support     | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for cognitive support needs.
 has_communication_needs   | boolean                  |           | not null | false                                  | plain    |             |              | Boolean flag for communication support needs.
Indexes:
    "participants_pkey" PRIMARY KEY, btree (id)
    "idx_participant_ndis_number" btree (ndis_number)
    "idx_participant_plan_management" btree (plan_management_type)
    "idx_participant_support_flags" btree (has_wheelchair_access, has_dietary_requirements, has_medical_requirements, has_behavioral_support, has_visual_impairment, has_hearing_impairment, has_cognitive_support, has_communication_needs)
    "idx_participants_location" btree (location_lat, location_lng)
    "idx_participants_name" btree (last_name, first_name)
    "idx_participants_ndis" btree (ndis_number)
Referenced by:
    TABLE "participant_billing_codes" CONSTRAINT "participant_billing_codes_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    TABLE "program_participants" CONSTRAINT "program_participants_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    TABLE "tgl_loom_participant_allocations" CONSTRAINT "tgl_loom_participant_allocations_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    TABLE "tgl_operator_intents" CONSTRAINT "tgl_operator_intents_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
Triggers:
    update_participants_modtime BEFORE UPDATE ON participants FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### payment_diamonds

                                                         Table "public.payment_diamonds"
       Column        |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
---------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                  | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 history_shift_id    | uuid                     |           | not null |                    | plain    |             |              | 
 participant_id      | uuid                     |           | not null |                    | plain    |             |              | 
 support_item_number | text                     |           | not null |                    | extended |             |              | 
 unit_price          | numeric(10,2)            |           | not null |                    | main     |             |              | 
 quantity            | numeric(6,2)             |           | not null |                    | main     |             |              | 
 total_amount        | numeric(10,2)            |           | not null |                    | main     |             |              | 
 gst_code            | text                     |           | not null |                    | extended |             |              | 
 status              | text                     |           | not null | 'completed'::text  | extended |             |              | 
 invoice_number      | text                     |           |          |                    | extended |             |              | 
 invoice_date        | date                     |           |          |                    | plain    |             |              | 
 payment_date        | date                     |           |          |                    | plain    |             |              | 
 retention_end_date  | date                     |           |          |                    | plain    |             |              | 
 created_at          | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at          | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "payment_diamonds_pkey" PRIMARY KEY, btree (id)
    "idx_payment_diamonds_status" btree (status)
Foreign-key constraints:
    "payment_diamonds_history_shift_id_fkey" FOREIGN KEY (history_shift_id) REFERENCES history_ribbon_shifts(id) ON DELETE CASCADE
Triggers:
    set_payment_diamond_retention BEFORE UPDATE ON payment_diamonds FOR EACH ROW EXECUTE FUNCTION set_diamond_retention_date()
    update_payment_diamonds_timestamp BEFORE UPDATE ON payment_diamonds FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### pending_enrollment_changes

                                                  Table "public.pending_enrollment_changes"
     Column     |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id             | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 participant_id | uuid                     |           | not null |                    | plain    |             |              | 
 program_id     | uuid                     |           | not null |                    | plain    |             |              | 
 action         | text                     |           | not null |                    | extended |             |              | 
 effective_date | date                     |           | not null |                    | plain    |             |              | 
 status         | text                     |           |          | 'pending'::text    | extended |             |              | 
 created_at     | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "pending_enrollment_changes_pkey" PRIMARY KEY, btree (id)
    "idx_pending_changes_effective_date" btree (effective_date)
    "idx_pending_changes_status" btree (status)
    "idx_pending_enrollment_changes_status" btree (status)
Access method: heap


### program_enrollments

                                                     Table "public.program_enrollments"
     Column     |           Type           | Collation | Nullable |      Default       | Storage | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+--------------------+---------+-------------+--------------+-------------
 id             | uuid                     |           | not null | uuid_generate_v4() | plain   |             |              | 
 participant_id | uuid                     |           | not null |                    | plain   |             |              | 
 program_id     | uuid                     |           | not null |                    | plain   |             |              | 
 start_date     | date                     |           | not null |                    | plain   |             |              | 
 end_date       | date                     |           |          |                    | plain   |             |              | 
 created_at     | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain   |             |              | 
Indexes:
    "program_enrollments_pkey" PRIMARY KEY, btree (id)
    "idx_program_enrollments_dates" btree (start_date, end_date)
    "idx_program_enrollments_participant" btree (participant_id)
    "idx_program_enrollments_program" btree (program_id)
    "program_enrollments_participant_id_program_id_start_date_key" UNIQUE CONSTRAINT, btree (participant_id, program_id, start_date)
Access method: heap


### program_participants

                                                     Table "public.program_participants"
     Column      |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-----------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id              | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 program_id      | uuid                     |           | not null |                   | plain    |             |              | 
 participant_id  | uuid                     |           | not null |                   | plain    |             |              | 
 billing_code_id | uuid                     |           |          |                   | plain    |             |              | 
 start_date      | date                     |           |          |                   | plain    |             |              | 
 end_date        | date                     |           |          |                   | plain    |             |              | 
 created_at      | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at      | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 status          | text                     |           | not null | 'active'::text    | extended |             |              | 
Indexes:
    "program_participants_pkey" PRIMARY KEY, btree (id)
    "idx_program_participants_dates" btree (start_date, end_date)
    "idx_program_participants_participant" btree (participant_id)
    "idx_program_participants_program" btree (program_id)
    "idx_program_participants_status" btree (status)
    "program_participants_program_id_participant_id_key" UNIQUE CONSTRAINT, btree (program_id, participant_id)
Foreign-key constraints:
    "program_participants_billing_code_id_fkey" FOREIGN KEY (billing_code_id) REFERENCES billing_codes(id) ON DELETE SET NULL
    "program_participants_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    "program_participants_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
Triggers:
    update_program_participants_modtime BEFORE UPDATE ON program_participants FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### programs

                                                                                                        Table "public.programs"
         Column         |           Type           | Collation | Nullable |                Default                | Storage  | Compression | Stats target |                                 Description                                 
------------------------+--------------------------+-----------+----------+---------------------------------------+----------+-------------+--------------+-----------------------------------------------------------------------------
 id                     | uuid                     |           | not null | gen_random_uuid()                     | plain    |             |              | 
 name                   | character varying(100)   |           | not null |                                       | extended |             |              | 
 description            | text                     |           |          |                                       | extended |             |              | 
 day_of_week            | integer                  |           |          |                                       | plain    |             |              | DEPRECATED: Use days_of_week JSONB array instead
 start_time             | time without time zone   |           | not null |                                       | plain    |             |              | 
 end_time               | time without time zone   |           | not null |                                       | plain    |             |              | 
 venue_id               | uuid                     |           |          |                                       | plain    |             |              | 
 capacity               | integer                  |           |          |                                       | plain    |             |              | 
 recurring              | boolean                  |           | not null | true                                  | plain    |             |              | DEPRECATED: Use repeat_pattern instead (none = false, anything else = true)
 active                 | boolean                  |           | not null | true                                  | plain    |             |              | 
 created_at             | timestamp with time zone |           | not null | now()                                 | plain    |             |              | 
 updated_at             | timestamp with time zone |           | not null | now()                                 | plain    |             |              | 
 status                 | character varying(50)    |           | not null | 'active'::character varying           | extended |             |              | 
 program_type           | character varying(50)    |           |          | 'community_access'::character varying | extended |             |              | Type of program (community_access, training, etc.)
 start_date             | date                     |           | not null | CURRENT_DATE                          | plain    |             |              | Date when program starts
 end_date               | date                     |           |          |                                       | plain    |             |              | Date when program ends (NULL = no end date)
 repeat_pattern         | character varying(20)    |           |          | 'weekly'::character varying           | extended |             |              | How program repeats: none (one-off), weekly, fortnightly, monthly
 time_slots             | jsonb                    |           |          | '[]'::jsonb                           | extended |             |              | Array of time slots with activities for dashboard cards
 notes                  | text                     |           |          |                                       | extended |             |              | 
 staff_assignment_mode  | character varying(20)    |           |          | 'auto'::character varying             | extended |             |              | How staff are assigned: auto (by loom) or manual (fixed)
 additional_staff_count | integer                  |           |          | 0                                     | plain    |             |              | Extra staff beyond the 1:4 ratio
 created_by             | text                     |           |          |                                       | extended |             |              | 
 days_of_week           | jsonb                    |           |          | '[]'::jsonb                           | extended |             |              | Array of days this program runs on (0=Sunday, 1=Monday, etc.)
Indexes:
    "programs_pkey" PRIMARY KEY, btree (id)
    "idx_programs_active" btree (active)
    "idx_programs_dates" btree (start_date, end_date)
    "idx_programs_day_time" btree (day_of_week, start_time)
    "idx_programs_status" btree (status)
    "idx_programs_venue" btree (venue_id)
Check constraints:
    "programs_status_check" CHECK (status::text = ANY (ARRAY['active'::character varying, 'cancelled'::character varying, 'completed'::character varying, 'draft'::character varying, 'pending'::character varying]::text[]))
    "valid_program_dates" CHECK (end_date IS NULL OR end_date >= start_date)
    "valid_repeat_pattern" CHECK (repeat_pattern::text = ANY (ARRAY['none'::character varying, 'weekly'::character varying, 'fortnightly'::character varying, 'monthly'::character varying]::text[]))
    "valid_staff_assignment_mode" CHECK (staff_assignment_mode::text = ANY (ARRAY['auto'::character varying, 'manual'::character varying]::text[]))
Foreign-key constraints:
    "programs_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Referenced by:
    TABLE "participant_billing_codes" CONSTRAINT "participant_billing_codes_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    TABLE "program_participants" CONSTRAINT "program_participants_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    TABLE "schedule" CONSTRAINT "schedule_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    TABLE "tgl_loom_instances" CONSTRAINT "tgl_loom_instances_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    TABLE "tgl_operator_intents" CONSTRAINT "tgl_operator_intents_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
Triggers:
    update_programs_modtime BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### rules_participant_schedule

                                                   Table "public.rules_participant_schedule"
      Column      |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 participant_id   | uuid                     |           | not null |                    | plain    |             |              | 
 program_id       | uuid                     |           | not null |                    | plain    |             |              | 
 start_date       | date                     |           | not null |                    | plain    |             |              | 
 end_date         | date                     |           |          |                    | plain    |             |              | 
 pickup_required  | boolean                  |           |          | true               | plain    |             |              | 
 dropoff_required | boolean                  |           |          | true               | plain    |             |              | 
 notes            | text                     |           |          |                    | extended |             |              | 
 created_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at       | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "rules_participant_schedule_pkey" PRIMARY KEY, btree (id)
    "rules_participant_schedule_participant_id_program_id_start__key" UNIQUE CONSTRAINT, btree (participant_id, program_id, start_date)
Foreign-key constraints:
    "rules_participant_schedule_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
Referenced by:
    TABLE "loom_participant_attendance" CONSTRAINT "loom_participant_attendance_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_participant_schedule(id)
Triggers:
    update_rules_participant_schedule_timestamp BEFORE UPDATE ON rules_participant_schedule FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### rules_program_exceptions

                                                   Table "public.rules_program_exceptions"
     Column     |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id             | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 program_id     | uuid                     |           | not null |                    | plain    |             |              | 
 exception_date | date                     |           | not null |                    | plain    |             |              | 
 exception_type | text                     |           | not null |                    | extended |             |              | 
 start_time     | time without time zone   |           |          |                    | plain    |             |              | 
 end_time       | time without time zone   |           |          |                    | plain    |             |              | 
 venue_id       | uuid                     |           |          |                    | plain    |             |              | 
 reason         | text                     |           |          |                    | extended |             |              | 
 created_at     | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at     | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "rules_program_exceptions_pkey" PRIMARY KEY, btree (id)
    "rules_program_exceptions_program_id_exception_date_key" UNIQUE CONSTRAINT, btree (program_id, exception_date)
Foreign-key constraints:
    "rules_program_exceptions_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
Triggers:
    update_rules_program_exceptions_timestamp BEFORE UPDATE ON rules_program_exceptions FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### rules_programs

                                                          Table "public.rules_programs"
       Column       |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
--------------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id                 | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 name               | text                     |           | not null |                    | extended |             |              | 
 description        | text                     |           |          |                    | extended |             |              | 
 day_of_week        | integer                  |           | not null |                    | plain    |             |              | 
 start_time         | time without time zone   |           | not null |                    | plain    |             |              | 
 end_time           | time without time zone   |           | not null |                    | plain    |             |              | 
 venue_id           | uuid                     |           |          |                    | plain    |             |              | 
 is_recurring       | boolean                  |           |          | true               | plain    |             |              | 
 recurrence_pattern | text                     |           |          | 'weekly'::text     | extended |             |              | 
 transport_required | boolean                  |           |          | true               | plain    |             |              | 
 staffing_ratio     | text                     |           |          | '1:4'::text        | extended |             |              | 
 active             | boolean                  |           |          | true               | plain    |             |              | 
 created_at         | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at         | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "rules_programs_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "loom_instances" CONSTRAINT "loom_instances_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_programs(id)
    TABLE "rules_participant_schedule" CONSTRAINT "rules_participant_schedule_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
    TABLE "rules_program_exceptions" CONSTRAINT "rules_program_exceptions_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
    TABLE "rules_staff_roster" CONSTRAINT "rules_staff_roster_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
Triggers:
    update_rules_programs_timestamp BEFORE UPDATE ON rules_programs FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### rules_staff_roster

                                                    Table "public.rules_staff_roster"
   Column   |           Type           | Collation | Nullable |      Default       | Storage  | Compression | Stats target | Description 
------------+--------------------------+-----------+----------+--------------------+----------+-------------+--------------+-------------
 id         | uuid                     |           | not null | uuid_generate_v4() | plain    |             |              | 
 staff_id   | uuid                     |           | not null |                    | plain    |             |              | 
 program_id | uuid                     |           | not null |                    | plain    |             |              | 
 role       | text                     |           | not null | 'support'::text    | extended |             |              | 
 start_date | date                     |           | not null |                    | plain    |             |              | 
 end_date   | date                     |           |          |                    | plain    |             |              | 
 notes      | text                     |           |          |                    | extended |             |              | 
 created_at | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
 updated_at | timestamp with time zone |           |          | CURRENT_TIMESTAMP  | plain    |             |              | 
Indexes:
    "rules_staff_roster_pkey" PRIMARY KEY, btree (id)
    "rules_staff_roster_staff_id_program_id_start_date_key" UNIQUE CONSTRAINT, btree (staff_id, program_id, start_date)
Foreign-key constraints:
    "rules_staff_roster_program_id_fkey" FOREIGN KEY (program_id) REFERENCES rules_programs(id) ON DELETE CASCADE
Referenced by:
    TABLE "loom_staff_assignments" CONSTRAINT "loom_staff_assignments_source_rule_id_fkey" FOREIGN KEY (source_rule_id) REFERENCES rules_staff_roster(id)
Triggers:
    update_rules_staff_roster_timestamp BEFORE UPDATE ON rules_staff_roster FOR EACH ROW EXECUTE FUNCTION update_timestamp()
Access method: heap


### schedule

                                                          Table "public.schedule"
     Column     |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
----------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id             | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 program_id     | uuid                     |           | not null |                   | plain    |             |              | 
 scheduled_date | date                     |           | not null |                   | plain    |             |              | 
 start_time     | time without time zone   |           | not null |                   | plain    |             |              | 
 end_time       | time without time zone   |           | not null |                   | plain    |             |              | 
 venue_id       | uuid                     |           |          |                   | plain    |             |              | 
 notes          | text                     |           |          |                   | extended |             |              | 
 created_at     | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at     | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "schedule_pkey" PRIMARY KEY, btree (id)
    "idx_schedule_date" btree (scheduled_date)
    "idx_schedule_program" btree (program_id)
Foreign-key constraints:
    "schedule_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    "schedule_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Triggers:
    update_schedule_modtime BEFORE UPDATE ON schedule FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### settings

                                          Table "public.settings"
   Column    | Type | Collation | Nullable | Default | Storage  | Compression | Stats target | Description 
-------------+------+-----------+----------+---------+----------+-------------+--------------+-------------
 key         | text |           | not null |         | extended |             |              | 
 value       | text |           | not null |         | extended |             |              | 
 description | text |           |          |         | extended |             |              | 
Indexes:
    "settings_pkey" PRIMARY KEY, btree (key)
Access method: heap


### staff

                                                                                                  Table "public.staff"
      Column      |           Type           | Collation | Nullable |           Default           | Storage  | Compression | Stats target |                                 Description                                  
------------------+--------------------------+-----------+----------+-----------------------------+----------+-------------+--------------+------------------------------------------------------------------------------
 id               | uuid                     |           | not null | gen_random_uuid()           | plain    |             |              | 
 first_name       | character varying(100)   |           | not null |                             | extended |             |              | 
 last_name        | character varying(100)   |           | not null |                             | extended |             |              | 
 position         | character varying(100)   |           |          |                             | extended |             |              | 
 email            | character varying(100)   |           |          |                             | extended |             |              | 
 phone            | character varying(20)    |           |          |                             | extended |             |              | 
 address          | text                     |           |          |                             | extended |             |              | 
 suburb           | character varying(100)   |           |          |                             | extended |             |              | 
 state            | character varying(50)    |           |          |                             | extended |             |              | 
 postcode         | character varying(10)    |           |          |                             | extended |             |              | 
 qualifications   | text                     |           |          |                             | extended |             |              | 
 active           | boolean                  |           | not null | true                        | plain    |             |              | 
 created_at       | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 updated_at       | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 photo_url        | text                     |           |          |                             | extended |             |              | 
 location_lat     | numeric(10,8)            |           |          |                             | main     |             |              | 
 location_lng     | numeric(11,8)            |           |          |                             | main     |             |              | 
 status           | character varying(50)    |           | not null | 'active'::character varying | extended |             |              | 
 contracted_hours | numeric(5,2)             |           |          |                             | main     |             |              | Number of hours per week a staff member is contracted for (e.g., 38.0, 20.5)
 base_pay_rate    | numeric(8,2)             |           |          |                             | main     |             |              | Hourly pay rate in dollars for the staff member (e.g., 28.50, 42.75)
 schads_level     | integer                  |           |          | 2                           | plain    |             |              | 
Indexes:
    "staff_pkey" PRIMARY KEY, btree (id)
    "idx_staff_contracted_hours" btree (contracted_hours)
    "idx_staff_financial" btree (base_pay_rate, contracted_hours)
    "idx_staff_location" btree (location_lat, location_lng)
    "idx_staff_name" btree (last_name, first_name)
    "idx_staff_pay_rate" btree (base_pay_rate)
    "idx_staff_status" btree (status)
Check constraints:
    "staff_status_check" CHECK (status::text = ANY (ARRAY['active'::character varying, 'leave'::character varying, 'inactive'::character varying, 'terminated'::character varying, 'pending'::character varying]::text[]))
Referenced by:
    TABLE "staff_unavailabilities" CONSTRAINT "staff_unavailabilities_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    TABLE "tgl_loom_staff_shifts" CONSTRAINT "tgl_loom_staff_shifts_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    TABLE "tgl_loom_vehicle_runs" CONSTRAINT "tgl_loom_vehicle_runs_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE SET NULL
    TABLE "tgl_operator_intents" CONSTRAINT "tgl_operator_intents_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
Triggers:
    update_staff_modtime BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### staff_unavailabilities

                                                 Table "public.staff_unavailabilities"
   Column   |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id         | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 staff_id   | uuid                     |           | not null |                   | plain    |             |              | 
 start_time | timestamp with time zone |           | not null |                   | plain    |             |              | 
 end_time   | timestamp with time zone |           | not null |                   | plain    |             |              | 
 reason     | text                     |           | not null |                   | extended |             |              | 
 notes      | text                     |           |          |                   | extended |             |              | 
 created_at | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "staff_unavailabilities_pkey" PRIMARY KEY, btree (id)
    "idx_staff_unavailabilities_active" btree (staff_id, start_time, end_time)
    "idx_staff_unavailabilities_staff" btree (staff_id)
    "idx_staff_unavailabilities_timerange" btree (start_time, end_time)
Check constraints:
    "valid_unavailability_timerange" CHECK (end_time > start_time)
Foreign-key constraints:
    "staff_unavailabilities_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
Triggers:
    update_staff_unavailabilities_modtime BEFORE UPDATE ON staff_unavailabilities FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### system_logs

                                                                                            Table "public.system_logs"
         Column         |           Type           | Collation | Nullable |   Default   | Storage  | Compression | Stats target |                                   Description                                    
------------------------+--------------------------+-----------+----------+-------------+----------+-------------+--------------+----------------------------------------------------------------------------------
 id                     | uuid                     |           | not null |             | plain    |             |              | Unique identifier for the log entry
 timestamp              | timestamp with time zone |           | not null | now()       | plain    |             |              | When the event occurred
 severity               | text                     |           | not null |             | extended |             |              | Log severity level: INFO, WARN, ERROR, CRITICAL
 category               | text                     |           | not null |             | extended |             |              | Log category: RESOURCE, OPTIMIZATION, CONSTRAINT, SYSTEM, OPERATIONAL, FINANCIAL
 message                | text                     |           | not null |             | extended |             |              | Human-readable log message
 details                | jsonb                    |           |          | '{}'::jsonb | extended |             |              | Additional structured details as JSON
 affected_entities      | jsonb                    |           |          | '[]'::jsonb | extended |             |              | Array of entities affected by this event
 resolution_required    | boolean                  |           | not null | false       | plain    |             |              | Whether this log requires operator resolution
 resolution_suggestions | jsonb                    |           |          | '[]'::jsonb | extended |             |              | Suggested actions for resolution
 created_at             | timestamp with time zone |           | not null | now()       | plain    |             |              | 
 updated_at             | timestamp with time zone |           | not null | now()       | plain    |             |              | 
Indexes:
    "system_logs_pkey" PRIMARY KEY, btree (id)
    "idx_system_logs_category" btree (category)
    "idx_system_logs_resolution_required" btree (resolution_required) WHERE resolution_required = true
    "idx_system_logs_severity" btree (severity)
    "idx_system_logs_timestamp" btree ("timestamp" DESC)
    "idx_system_logs_timestamp_severity" btree ("timestamp" DESC, severity)
Check constraints:
    "system_logs_category_check" CHECK (category = ANY (ARRAY['RESOURCE'::text, 'OPTIMIZATION'::text, 'CONSTRAINT'::text, 'SYSTEM'::text, 'OPERATIONAL'::text, 'FINANCIAL'::text]))
    "system_logs_severity_check" CHECK (severity = ANY (ARRAY['INFO'::text, 'WARN'::text, 'ERROR'::text, 'CRITICAL'::text]))
Access method: heap


### tgl_config

                                                        Table "public.tgl_config"
   Column    |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 key         | text                     |           | not null |                   | extended |             |              | 
 value       | text                     |           | not null |                   | extended |             |              | 
 description | text                     |           |          |                   | extended |             |              | 
 updated_at  | timestamp with time zone |           |          | CURRENT_TIMESTAMP | plain    |             |              | 
 updated_by  | text                     |           |          |                   | extended |             |              | 
Indexes:
    "tgl_config_pkey" PRIMARY KEY, btree (key)
Access method: heap


### tgl_loom_audit_log

                                                                Table "public.tgl_loom_audit_log"
       Column        |           Type           | Collation | Nullable |              Default              | Storage  | Compression | Stats target | Description 
---------------------+--------------------------+-----------+----------+-----------------------------------+----------+-------------+--------------+-------------
 id                  | uuid                     |           | not null | gen_random_uuid()                 | plain    |             |              | 
 action_type         | character varying(50)    |           | not null |                                   | extended |             |              | 
 entity_type         | character varying(50)    |           | not null |                                   | extended |             |              | 
 entity_id           | uuid                     |           | not null |                                   | plain    |             |              | 
 user_id             | character varying(100)   |           |          |                                   | extended |             |              | 
 previous_state      | jsonb                    |           |          |                                   | extended |             |              | 
 new_state           | jsonb                    |           |          |                                   | extended |             |              | 
 created_at          | timestamp with time zone |           | not null | now()                             | plain    |             |              | 
 action              | character varying(100)   |           | not null | 'system_event'::character varying | extended |             |              | 
 category            | character varying(50)    |           |          | 'system'::character varying       | extended |             |              | 
 severity            | character varying(20)    |           |          | 'info'::character varying         | extended |             |              | 
 timestamp           | timestamp with time zone |           |          | CURRENT_TIMESTAMP                 | plain    |             |              | 
 related_entity_id   | uuid                     |           |          |                                   | plain    |             |              | 
 related_entity_type | character varying(50)    |           |          |                                   | extended |             |              | 
 details             | jsonb                    |           |          | '{}'::jsonb                       | extended |             |              | 
 message             | text                     |           |          |                                   | extended |             |              | 
 status              | character varying(20)    |           |          |                                   | extended |             |              | 
Indexes:
    "tgl_loom_audit_log_pkey" PRIMARY KEY, btree (id)
    "idx_audit_log_entity" btree (related_entity_type, related_entity_id)
    "idx_audit_log_severity_timestamp" btree (severity, "timestamp")
    "idx_tgl_loom_audit_log_action" btree (action)
    "idx_tgl_loom_audit_log_details_gin" gin (details)
    "idx_tgl_loom_audit_log_user" btree (user_id)
Check constraints:
    "tgl_loom_audit_log_severity_check" CHECK (severity::text = ANY (ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'critical'::character varying]::text[]))
Access method: heap


### tgl_loom_instances

                                                             Table "public.tgl_loom_instances"
       Column       |           Type           | Collation | Nullable |            Default            | Storage  | Compression | Stats target | Description 
--------------------+--------------------------+-----------+----------+-------------------------------+----------+-------------+--------------+-------------
 id                 | uuid                     |           | not null | gen_random_uuid()             | plain    |             |              | 
 program_id         | uuid                     |           | not null |                               | plain    |             |              | 
 instance_date      | date                     |           | not null |                               | plain    |             |              | 
 start_time         | time without time zone   |           | not null |                               | plain    |             |              | 
 end_time           | time without time zone   |           | not null |                               | plain    |             |              | 
 venue_id           | uuid                     |           |          |                               | plain    |             |              | 
 status             | loom_instance_status     |           | not null | 'draft'::loom_instance_status | plain    |             |              | 
 participants_count | integer                  |           | not null | 0                             | plain    |             |              | 
 staff_count        | integer                  |           | not null | 0                             | plain    |             |              | 
 manually_modified  | boolean                  |           | not null | false                         | plain    |             |              | 
 notes              | text                     |           |          |                               | extended |             |              | 
 created_at         | timestamp with time zone |           | not null | now()                         | plain    |             |              | 
 updated_at         | timestamp with time zone |           | not null | now()                         | plain    |             |              | 
 data_json          | jsonb                    |           |          | '{}'::jsonb                   | extended |             |              | 
 date               | date                     |           | not null | CURRENT_DATE                  | plain    |             |              | 
Indexes:
    "tgl_loom_instances_pkey" PRIMARY KEY, btree (id)
    "idx_loom_instances_date" btree (instance_date)
    "idx_loom_instances_program" btree (program_id)
    "idx_loom_instances_status" btree (status)
    "idx_tgl_loom_instances_data_gin" gin (data_json)
    "idx_tgl_loom_instances_status" btree (status)
    "tgl_loom_instances_program_id_instance_date_key" UNIQUE CONSTRAINT, btree (program_id, instance_date)
Foreign-key constraints:
    "tgl_loom_instances_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    "tgl_loom_instances_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Referenced by:
    TABLE "tgl_loom_participant_allocations" CONSTRAINT "tgl_loom_participant_allocations_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    TABLE "tgl_loom_staff_shifts" CONSTRAINT "tgl_loom_staff_shifts_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    TABLE "tgl_loom_time_slots" CONSTRAINT "tgl_loom_time_slots_instance_id_fkey" FOREIGN KEY (instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    TABLE "tgl_loom_vehicle_runs" CONSTRAINT "tgl_loom_vehicle_runs_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE SET NULL
Triggers:
    update_loom_instances_modtime BEFORE UPDATE ON tgl_loom_instances FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_loom_participant_allocations

                                                                            Table "public.tgl_loom_participant_allocations"
      Column       |           Type           | Collation | Nullable |           Default            | Storage  | Compression | Stats target |                       Description                        
-------------------+--------------------------+-----------+----------+------------------------------+----------+-------------+--------------+----------------------------------------------------------
 id                | uuid                     |           | not null | gen_random_uuid()            | plain    |             |              | 
 loom_instance_id  | uuid                     |           | not null |                              | plain    |             |              | 
 participant_id    | uuid                     |           | not null |                              | plain    |             |              | 
 billing_code_id   | uuid                     |           |          |                              | plain    |             |              | 
 allocation_status | allocation_status        |           | not null | 'planned'::allocation_status | plain    |             |              | 
 cancellation_type | cancellation_type        |           |          |                              | plain    |             |              | 
 manually_added    | boolean                  |           | not null | false                        | plain    |             |              | 
 notes             | text                     |           |          |                              | extended |             |              | 
 created_at        | timestamp with time zone |           | not null | now()                        | plain    |             |              | 
 updated_at        | timestamp with time zone |           | not null | now()                        | plain    |             |              | 
 billing_codes     | jsonb                    |           |          | '[]'::jsonb                  | extended |             |              | Array of billing code objects with code, hours, and rate
 hours             | numeric(5,2)             |           |          | 0                            | main     |             |              | Total hours for this participant allocation
Indexes:
    "tgl_loom_participant_allocations_pkey" PRIMARY KEY, btree (id)
    "idx_loom_participant_allocations_instance" btree (loom_instance_id)
    "idx_loom_participant_allocations_participant" btree (participant_id)
    "idx_loom_participant_allocations_status" btree (allocation_status)
    "idx_participant_allocations_billing_codes" gin (billing_codes)
Foreign-key constraints:
    "tgl_loom_participant_allocations_billing_code_id_fkey" FOREIGN KEY (billing_code_id) REFERENCES billing_codes(id) ON DELETE SET NULL
    "tgl_loom_participant_allocations_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    "tgl_loom_participant_allocations_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
Triggers:
    update_loom_participant_allocations_modtime BEFORE UPDATE ON tgl_loom_participant_allocations FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_loom_staff_shifts

                                                           Table "public.tgl_loom_staff_shifts"
      Column       |           Type           | Collation | Nullable |            Default            | Storage  | Compression | Stats target | Description 
-------------------+--------------------------+-----------+----------+-------------------------------+----------+-------------+--------------+-------------
 id                | uuid                     |           | not null | gen_random_uuid()             | plain    |             |              | 
 loom_instance_id  | uuid                     |           | not null |                               | plain    |             |              | 
 staff_id          | uuid                     |           | not null |                               | plain    |             |              | 
 role              | staff_role               |           | not null |                               | plain    |             |              | 
 start_time        | time without time zone   |           | not null |                               | plain    |             |              | 
 end_time          | time without time zone   |           | not null |                               | plain    |             |              | 
 status            | staff_shift_status       |           | not null | 'planned'::staff_shift_status | plain    |             |              | 
 manually_assigned | boolean                  |           | not null | false                         | plain    |             |              | 
 notes             | text                     |           |          |                               | extended |             |              | 
 created_at        | timestamp with time zone |           | not null | now()                         | plain    |             |              | 
 updated_at        | timestamp with time zone |           | not null | now()                         | plain    |             |              | 
Indexes:
    "tgl_loom_staff_shifts_pkey" PRIMARY KEY, btree (id)
    "idx_loom_staff_shifts_instance" btree (loom_instance_id)
    "idx_loom_staff_shifts_staff" btree (staff_id)
    "idx_loom_staff_shifts_status" btree (status)
    "idx_loom_staff_shifts_timerange" btree (start_time, end_time)
Foreign-key constraints:
    "tgl_loom_staff_shifts_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    "tgl_loom_staff_shifts_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
Triggers:
    update_loom_staff_shifts_modtime BEFORE UPDATE ON tgl_loom_staff_shifts FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_loom_time_slots

                                                                          Table "public.tgl_loom_time_slots"
   Column    |           Type           | Collation | Nullable |          Default          | Storage  | Compression | Stats target |                   Description                    
-------------+--------------------------+-----------+----------+---------------------------+----------+-------------+--------------+--------------------------------------------------
 id          | uuid                     |           | not null | gen_random_uuid()         | plain    |             |              | 
 instance_id | uuid                     |           | not null |                           | plain    |             |              | 
 start_time  | time without time zone   |           | not null |                           | plain    |             |              | 
 end_time    | time without time zone   |           | not null |                           | plain    |             |              | 
 label       | text                     |           | not null |                           | extended |             |              | Display label for the card
 card_type   | tgl_card_type            |           | not null | 'ACTIVITY'::tgl_card_type | plain    |             |              | Type of card: PICKUP, ACTIVITY, DROPOFF, PROGRAM
 details     | jsonb                    |           |          |                           | extended |             |              | Additional card-specific details as JSON
 created_at  | timestamp with time zone |           | not null | now()                     | plain    |             |              | 
 updated_at  | timestamp with time zone |           | not null | now()                     | plain    |             |              | 
Indexes:
    "tgl_loom_time_slots_pkey" PRIMARY KEY, btree (id)
    "idx_time_slots_card_type" btree (card_type)
    "idx_time_slots_instance" btree (instance_id)
Foreign-key constraints:
    "tgl_loom_time_slots_instance_id_fkey" FOREIGN KEY (instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
Triggers:
    update_time_slots_updated_at BEFORE UPDATE ON tgl_loom_time_slots FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_loom_vehicle_runs

                                                      Table "public.tgl_loom_vehicle_runs"
       Column        |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
---------------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id                  | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 loom_instance_id    | uuid                     |           | not null |                   | plain    |             |              | 
 vehicle_id          | uuid                     |           | not null |                   | plain    |             |              | 
 driver_id           | uuid                     |           |          |                   | plain    |             |              | 
 route_data          | jsonb                    |           | not null | '{}'::jsonb       | extended |             |              | 
 start_time          | time without time zone   |           | not null |                   | plain    |             |              | 
 end_time            | time without time zone   |           | not null |                   | plain    |             |              | 
 estimated_duration  | integer                  |           |          |                   | plain    |             |              | 
 estimated_distance  | integer                  |           |          |                   | plain    |             |              | 
 manually_configured | boolean                  |           | not null | false             | plain    |             |              | 
 notes               | text                     |           |          |                   | extended |             |              | 
 created_at          | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at          | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "tgl_loom_vehicle_runs_pkey" PRIMARY KEY, btree (id)
    "idx_loom_vehicle_runs_driver" btree (driver_id)
    "idx_loom_vehicle_runs_instance" btree (loom_instance_id)
    "idx_loom_vehicle_runs_timerange" btree (start_time, end_time)
    "idx_loom_vehicle_runs_vehicle" btree (vehicle_id)
Foreign-key constraints:
    "tgl_loom_vehicle_runs_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES staff(id) ON DELETE SET NULL
    "tgl_loom_vehicle_runs_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE CASCADE
    "tgl_loom_vehicle_runs_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
Triggers:
    update_loom_vehicle_runs_modtime BEFORE UPDATE ON tgl_loom_vehicle_runs FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_operator_intents

                                                     Table "public.tgl_operator_intents"
     Column      |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-----------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id              | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 intent_type     | tgl_intent_type          |           | not null |                   | plain    |             |              | 
 start_date      | date                     |           | not null |                   | plain    |             |              | 
 end_date        | date                     |           |          |                   | plain    |             |              | 
 program_id      | uuid                     |           |          |                   | plain    |             |              | 
 participant_id  | uuid                     |           |          |                   | plain    |             |              | 
 staff_id        | uuid                     |           |          |                   | plain    |             |              | 
 venue_id        | uuid                     |           |          |                   | plain    |             |              | 
 vehicle_id      | uuid                     |           |          |                   | plain    |             |              | 
 metadata        | jsonb                    |           | not null | '{}'::jsonb       | extended |             |              | 
 modified_fields | jsonb                    |           |          |                   | extended |             |              | 
 billing_codes   | jsonb                    |           |          |                   | extended |             |              | 
 created_by      | text                     |           | not null |                   | extended |             |              | 
 created_at      | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at      | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "tgl_operator_intents_pkey" PRIMARY KEY, btree (id)
    "idx_operator_intents_date_range" btree (start_date, end_date)
    "idx_operator_intents_participant" btree (participant_id) WHERE participant_id IS NOT NULL
    "idx_operator_intents_program" btree (program_id) WHERE program_id IS NOT NULL
    "idx_operator_intents_type" btree (intent_type)
Check constraints:
    "valid_date_range" CHECK (end_date IS NULL OR end_date > start_date)
Foreign-key constraints:
    "tgl_operator_intents_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
    "tgl_operator_intents_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
    "tgl_operator_intents_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    "tgl_operator_intents_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
    "tgl_operator_intents_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Triggers:
    update_operator_intents_modtime BEFORE UPDATE ON tgl_operator_intents FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### tgl_settings

                                                       Table "public.tgl_settings"
   Column    |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id          | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 key         | text                     |           | not null |                   | extended |             |              | 
 value       | text                     |           | not null |                   | extended |             |              | 
 data_type   | text                     |           | not null | 'string'::text    | extended |             |              | 
 category    | text                     |           | not null | 'general'::text   | extended |             |              | 
 description | text                     |           |          |                   | extended |             |              | 
 created_at  | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at  | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "tgl_settings_pkey" PRIMARY KEY, btree (id)
    "idx_tgl_settings_category" btree (category)
    "tgl_settings_key_key" UNIQUE CONSTRAINT, btree (key)
Access method: heap


### tgl_temporal_exceptions

                                                    Table "public.tgl_temporal_exceptions"
      Column      |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
------------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id               | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 exception_type   | tgl_exception_type       |           | not null |                   | plain    |             |              | 
 exception_date   | date                     |           | not null |                   | plain    |             |              | 
 program_id       | uuid                     |           |          |                   | plain    |             |              | 
 participant_id   | uuid                     |           |          |                   | plain    |             |              | 
 staff_id         | uuid                     |           |          |                   | plain    |             |              | 
 venue_id         | uuid                     |           |          |                   | plain    |             |              | 
 vehicle_id       | uuid                     |           |          |                   | plain    |             |              | 
 loom_instance_id | uuid                     |           |          |                   | plain    |             |              | 
 metadata         | jsonb                    |           | not null | '{}'::jsonb       | extended |             |              | 
 billing_override | jsonb                    |           |          |                   | extended |             |              | 
 reason           | text                     |           |          |                   | extended |             |              | 
 created_by       | text                     |           | not null |                   | extended |             |              | 
 created_at       | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at       | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "tgl_temporal_exceptions_pkey" PRIMARY KEY, btree (id)
    "idx_temporal_exceptions_date" btree (exception_date)
    "idx_temporal_exceptions_instance" btree (loom_instance_id) WHERE loom_instance_id IS NOT NULL
    "idx_temporal_exceptions_participant" btree (participant_id) WHERE participant_id IS NOT NULL
    "idx_temporal_exceptions_program" btree (program_id) WHERE program_id IS NOT NULL
    "idx_temporal_exceptions_type" btree (exception_type)
Foreign-key constraints:
    "tgl_temporal_exceptions_loom_instance_id_fkey" FOREIGN KEY (loom_instance_id) REFERENCES tgl_loom_instances(id) ON DELETE SET NULL
    "tgl_temporal_exceptions_participant_id_fkey" FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
    "tgl_temporal_exceptions_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
    "tgl_temporal_exceptions_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    "tgl_temporal_exceptions_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
    "tgl_temporal_exceptions_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Triggers:
    update_temporal_exceptions_modtime BEFORE UPDATE ON tgl_temporal_exceptions FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### vehicle_blackouts

                                                    Table "public.vehicle_blackouts"
   Column   |           Type           | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
------------+--------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id         | uuid                     |           | not null | gen_random_uuid() | plain    |             |              | 
 vehicle_id | uuid                     |           | not null |                   | plain    |             |              | 
 start_time | timestamp with time zone |           | not null |                   | plain    |             |              | 
 end_time   | timestamp with time zone |           | not null |                   | plain    |             |              | 
 reason     | text                     |           | not null |                   | extended |             |              | 
 notes      | text                     |           |          |                   | extended |             |              | 
 created_at | timestamp with time zone |           | not null | now()             | plain    |             |              | 
 updated_at | timestamp with time zone |           | not null | now()             | plain    |             |              | 
Indexes:
    "vehicle_blackouts_pkey" PRIMARY KEY, btree (id)
    "idx_vehicle_blackouts_active" btree (vehicle_id, start_time, end_time)
    "idx_vehicle_blackouts_timerange" btree (start_time, end_time)
    "idx_vehicle_blackouts_vehicle" btree (vehicle_id)
Check constraints:
    "valid_blackout_timerange" CHECK (end_time > start_time)
Foreign-key constraints:
    "vehicle_blackouts_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
Triggers:
    update_vehicle_blackouts_modtime BEFORE UPDATE ON vehicle_blackouts FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### vehicles

                                                                                       Table "public.vehicles"
        Column         |           Type           | Collation | Nullable |           Default           | Storage  | Compression | Stats target |                     Description                      
-----------------------+--------------------------+-----------+----------+-----------------------------+----------+-------------+--------------+------------------------------------------------------
 id                    | uuid                     |           | not null | gen_random_uuid()           | plain    |             |              | 
 name                  | character varying(100)   |           | not null |                             | extended |             |              | 
 registration          | character varying(20)    |           | not null |                             | extended |             |              | 
 capacity              | integer                  |           | not null |                             | plain    |             |              | 
 wheelchair_capacity   | integer                  |           | not null | 0                           | plain    |             |              | 
 make                  | character varying(50)    |           |          |                             | extended |             |              | Vehicle manufacturer (e.g., Toyota, Renault)
 model                 | character varying(50)    |           |          |                             | extended |             |              | Vehicle model (e.g., Hiace, Koleos)
 year                  | integer                  |           |          |                             | plain    |             |              | Year the vehicle was manufactured
 active                | boolean                  |           | not null | true                        | plain    |             |              | 
 notes                 | text                     |           |          |                             | extended |             |              | 
 created_at            | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 updated_at            | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 location_lat          | numeric(10,8)            |           |          |                             | main     |             |              | 
 location_lng          | numeric(11,8)            |           |          |                             | main     |             |              | 
 status                | character varying(50)    |           | not null | 'active'::character varying | extended |             |              | 
 vin_number            | text                     |           |          |                             | extended |             |              | Vehicle Identification Number
 engine_number         | text                     |           |          |                             | extended |             |              | Engine serial number
 registration_expiry   | date                     |           |          |                             | plain    |             |              | Date when vehicle registration expires
 fuel_type             | text                     |           |          |                             | extended |             |              | Type of fuel: Diesel, Petrol, Electric, Hybrid, etc.
 location              | text                     |           |          |                             | extended |             |              | Where the vehicle is typically parked/stored
 max_height            | numeric(3,1)             |           |          |                             | main     |             |              | Maximum vehicle height in meters
 wheelchair_accessible | boolean                  |           |          | false                       | plain    |             |              | Whether the vehicle has wheelchair access
Indexes:
    "vehicles_pkey" PRIMARY KEY, btree (id)
    "idx_vehicles_fuel_type" btree (fuel_type)
    "idx_vehicles_location" btree (location_lat, location_lng)
    "idx_vehicles_make_model" btree (make, model)
    "idx_vehicles_registration" btree (registration)
    "idx_vehicles_status" btree (status)
Check constraints:
    "vehicles_status_check" CHECK (status::text = ANY (ARRAY['active'::character varying, 'maintenance'::character varying, 'inactive'::character varying, 'retired'::character varying, 'pending'::character varying]::text[]))
Referenced by:
    TABLE "tgl_loom_vehicle_runs" CONSTRAINT "tgl_loom_vehicle_runs_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    TABLE "tgl_operator_intents" CONSTRAINT "tgl_operator_intents_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
    TABLE "vehicle_blackouts" CONSTRAINT "vehicle_blackouts_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
Triggers:
    update_vehicles_modtime BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


### venues

                                                               Table "public.venues"
    Column    |           Type           | Collation | Nullable |           Default           | Storage  | Compression | Stats target | Description 
--------------+--------------------------+-----------+----------+-----------------------------+----------+-------------+--------------+-------------
 id           | uuid                     |           | not null | gen_random_uuid()           | plain    |             |              | 
 name         | character varying(100)   |           | not null |                             | extended |             |              | 
 address      | text                     |           | not null |                             | extended |             |              | 
 suburb       | character varying(100)   |           |          |                             | extended |             |              | 
 state        | character varying(50)    |           |          |                             | extended |             |              | 
 postcode     | character varying(10)    |           |          |                             | extended |             |              | 
 capacity     | integer                  |           |          |                             | plain    |             |              | 
 facilities   | text                     |           |          |                             | extended |             |              | 
 active       | boolean                  |           | not null | true                        | plain    |             |              | 
 created_at   | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 updated_at   | timestamp with time zone |           | not null | now()                       | plain    |             |              | 
 location_lat | numeric(10,8)            |           |          |                             | main     |             |              | 
 location_lng | numeric(11,8)            |           |          |                             | main     |             |              | 
 status       | character varying(50)    |           | not null | 'active'::character varying | extended |             |              | 
Indexes:
    "venues_pkey" PRIMARY KEY, btree (id)
    "idx_venues_location" btree (location_lat, location_lng)
    "idx_venues_name" btree (name)
    "idx_venues_status" btree (status)
Check constraints:
    "venues_status_check" CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'maintenance'::character varying, 'closed'::character varying]::text[]))
Referenced by:
    TABLE "programs" CONSTRAINT "programs_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
    TABLE "schedule" CONSTRAINT "schedule_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
    TABLE "tgl_loom_instances" CONSTRAINT "tgl_loom_instances_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
    TABLE "tgl_operator_intents" CONSTRAINT "tgl_operator_intents_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
    TABLE "tgl_temporal_exceptions" CONSTRAINT "tgl_temporal_exceptions_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL
Triggers:
    update_venues_modtime BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_modified_column()
Access method: heap


## Foreign Key Relationships

| Table | Column | References |
|-------|--------|-----------|
| event_card_map | | | loom_instance_id.| |
| history_pinned_artifacts | | | history_shift_id.| |
| history_ribbon_participants | | | history_shift_id.| |
| history_ribbon_staff | | | history_shift_id.| |
| history_ribbon_tags | | | history_shift_id.| |
| loom_instances | | | source_rule_id.| |
| loom_participant_attendance | | | loom_instance_id.| |
| loom_participant_attendance | | | source_rule_id.| |
| loom_staff_assignments | | | loom_instance_id.| |
| loom_staff_assignments | | | source_rule_id.| |
| loom_vehicle_assignments | | | loom_instance_id.| |
| participant_billing_codes | | | participant_id.| |
| participant_billing_codes | | | program_id.| |
| payment_diamonds | | | history_shift_id.| |
| program_participants | | | billing_code_id.| |
| program_participants | | | participant_id.| |
| program_participants | | | program_id.| |
| programs | | | venue_id.| |
| rules_participant_schedule | | | program_id.| |
| rules_program_exceptions | | | program_id.| |
| rules_staff_roster | | | program_id.| |
| schedule | | | program_id.| |
| schedule | | | venue_id.| |
| staff_unavailabilities | | | staff_id.| |
| tgl_loom_instances | | | program_id.| |
| tgl_loom_instances | | | venue_id.| |
| tgl_loom_participant_allocations | | | billing_code_id.| |
| tgl_loom_participant_allocations | | | loom_instance_id.| |
| tgl_loom_participant_allocations | | | participant_id.| |
| tgl_loom_staff_shifts | | | loom_instance_id.| |
| tgl_loom_staff_shifts | | | staff_id.| |
| tgl_loom_time_slots | | | instance_id.| |
| tgl_loom_vehicle_runs | | | driver_id.| |
| tgl_loom_vehicle_runs | | | loom_instance_id.| |
| tgl_loom_vehicle_runs | | | vehicle_id.| |
| tgl_operator_intents | | | participant_id.| |
| tgl_operator_intents | | | program_id.| |
| tgl_operator_intents | | | staff_id.| |
| tgl_operator_intents | | | vehicle_id.| |
| tgl_operator_intents | | | venue_id.| |
| tgl_temporal_exceptions | | | loom_instance_id.| |
| tgl_temporal_exceptions | | | participant_id.| |
| tgl_temporal_exceptions | | | program_id.| |
| tgl_temporal_exceptions | | | staff_id.| |
| tgl_temporal_exceptions | | | vehicle_id.| |
| tgl_temporal_exceptions | | | venue_id.| |
| vehicle_blackouts | | | vehicle_id.| |
|  |  | . |

## Indexes

                                                       List of relations
 Schema |                              Name                               | Type  |  Owner   |              Table               
--------+-----------------------------------------------------------------+-------+----------+----------------------------------
 public | billing_codes_code_key                                          | index | postgres | billing_codes
 public | billing_codes_pkey                                              | index | postgres | billing_codes
 public | change_log_pkey                                                 | index | postgres | change_log
 public | event_card_map_pkey                                             | index | postgres | event_card_map
 public | history_pinned_artifacts_pkey                                   | index | postgres | history_pinned_artifacts
 public | history_ribbon_participants_pkey                                | index | postgres | history_ribbon_participants
 public | history_ribbon_shifts_pkey                                      | index | postgres | history_ribbon_shifts
 public | history_ribbon_staff_pkey                                       | index | postgres | history_ribbon_staff
 public | history_ribbon_tags_pkey                                        | index | postgres | history_ribbon_tags
 public | idx_audit_log_entity                                            | index | postgres | tgl_loom_audit_log
 public | idx_audit_log_severity_timestamp                                | index | postgres | tgl_loom_audit_log
 public | idx_change_log_billing_impact                                   | index | postgres | change_log
 public | idx_change_log_billing_status                                   | index | postgres | change_log
 public | idx_change_log_participant_date                                 | index | postgres | change_log
 public | idx_change_log_participant_type                                 | index | postgres | change_log
 public | idx_event_card_map_loom                                         | index | postgres | event_card_map
 public | idx_history_pinned_artifacts_type                               | index | postgres | history_pinned_artifacts
 public | idx_history_ribbon_date                                         | index | postgres | history_ribbon_shifts
 public | idx_history_ribbon_tags_embedding                               | index | postgres | history_ribbon_tags
 public | idx_loom_instances_date                                         | index | postgres | tgl_loom_instances
 public | idx_loom_instances_program                                      | index | postgres | tgl_loom_instances
 public | idx_loom_instances_status                                       | index | postgres | tgl_loom_instances
 public | idx_loom_participant_allocations_instance                       | index | postgres | tgl_loom_participant_allocations
 public | idx_loom_participant_allocations_participant                    | index | postgres | tgl_loom_participant_allocations
 public | idx_loom_participant_allocations_status                         | index | postgres | tgl_loom_participant_allocations
 public | idx_loom_staff_shifts_instance                                  | index | postgres | tgl_loom_staff_shifts
 public | idx_loom_staff_shifts_staff                                     | index | postgres | tgl_loom_staff_shifts
 public | idx_loom_staff_shifts_status                                    | index | postgres | tgl_loom_staff_shifts
 public | idx_loom_staff_shifts_timerange                                 | index | postgres | tgl_loom_staff_shifts
 public | idx_loom_vehicle_runs_driver                                    | index | postgres | tgl_loom_vehicle_runs
 public | idx_loom_vehicle_runs_instance                                  | index | postgres | tgl_loom_vehicle_runs
 public | idx_loom_vehicle_runs_timerange                                 | index | postgres | tgl_loom_vehicle_runs
 public | idx_loom_vehicle_runs_vehicle                                   | index | postgres | tgl_loom_vehicle_runs
 public | idx_operator_intents_date_range                                 | index | postgres | tgl_operator_intents
 public | idx_operator_intents_participant                                | index | postgres | tgl_operator_intents
 public | idx_operator_intents_program                                    | index | postgres | tgl_operator_intents
 public | idx_operator_intents_type                                       | index | postgres | tgl_operator_intents
 public | idx_participant_allocations_billing_codes                       | index | postgres | tgl_loom_participant_allocations
 public | idx_participant_ndis_number                                     | index | postgres | participants
 public | idx_participant_plan_management                                 | index | postgres | participants
 public | idx_participant_support_flags                                   | index | postgres | participants
 public | idx_participants_location                                       | index | postgres | participants
 public | idx_participants_name                                           | index | postgres | participants
 public | idx_participants_ndis                                           | index | postgres | participants
 public | idx_payment_diamonds_status                                     | index | postgres | payment_diamonds
 public | idx_pending_changes_effective_date                              | index | postgres | pending_enrollment_changes
 public | idx_pending_changes_status                                      | index | postgres | pending_enrollment_changes
 public | idx_pending_enrollment_changes_status                           | index | postgres | pending_enrollment_changes
 public | idx_program_enrollments_dates                                   | index | postgres | program_enrollments
 public | idx_program_enrollments_participant                             | index | postgres | program_enrollments
 public | idx_program_enrollments_program                                 | index | postgres | program_enrollments
 public | idx_program_participants_dates                                  | index | postgres | program_participants
 public | idx_program_participants_participant                            | index | postgres | program_participants
 public | idx_program_participants_program                                | index | postgres | program_participants
 public | idx_program_participants_status                                 | index | postgres | program_participants
 public | idx_programs_active                                             | index | postgres | programs
 public | idx_programs_dates                                              | index | postgres | programs
 public | idx_programs_day_time                                           | index | postgres | programs
 public | idx_programs_status                                             | index | postgres | programs
 public | idx_programs_venue                                              | index | postgres | programs
 public | idx_schedule_date                                               | index | postgres | schedule
 public | idx_schedule_program                                            | index | postgres | schedule
 public | idx_staff_contracted_hours                                      | index | postgres | staff
 public | idx_staff_financial                                             | index | postgres | staff
 public | idx_staff_location                                              | index | postgres | staff
 public | idx_staff_name                                                  | index | postgres | staff
 public | idx_staff_pay_rate                                              | index | postgres | staff
 public | idx_staff_status                                                | index | postgres | staff
 public | idx_staff_unavailabilities_active                               | index | postgres | staff_unavailabilities
 public | idx_staff_unavailabilities_staff                                | index | postgres | staff_unavailabilities
 public | idx_staff_unavailabilities_timerange                            | index | postgres | staff_unavailabilities
 public | idx_system_logs_category                                        | index | postgres | system_logs
 public | idx_system_logs_resolution_required                             | index | postgres | system_logs
 public | idx_system_logs_severity                                        | index | postgres | system_logs
 public | idx_system_logs_timestamp                                       | index | postgres | system_logs
 public | idx_system_logs_timestamp_severity                              | index | postgres | system_logs
 public | idx_temporal_exceptions_date                                    | index | postgres | tgl_temporal_exceptions
 public | idx_temporal_exceptions_instance                                | index | postgres | tgl_temporal_exceptions
 public | idx_temporal_exceptions_participant                             | index | postgres | tgl_temporal_exceptions
 public | idx_temporal_exceptions_program                                 | index | postgres | tgl_temporal_exceptions
 public | idx_temporal_exceptions_type                                    | index | postgres | tgl_temporal_exceptions
 public | idx_tgl_loom_audit_log_action                                   | index | postgres | tgl_loom_audit_log
 public | idx_tgl_loom_audit_log_details_gin                              | index | postgres | tgl_loom_audit_log
 public | idx_tgl_loom_audit_log_user                                     | index | postgres | tgl_loom_audit_log
 public | idx_tgl_loom_instances_data_gin                                 | index | postgres | tgl_loom_instances
 public | idx_tgl_loom_instances_status                                   | index | postgres | tgl_loom_instances
 public | idx_tgl_settings_category                                       | index | postgres | tgl_settings
 public | idx_time_slots_card_type                                        | index | postgres | tgl_loom_time_slots
 public | idx_time_slots_instance                                         | index | postgres | tgl_loom_time_slots
 public | idx_vehicle_blackouts_active                                    | index | postgres | vehicle_blackouts
 public | idx_vehicle_blackouts_timerange                                 | index | postgres | vehicle_blackouts
 public | idx_vehicle_blackouts_vehicle                                   | index | postgres | vehicle_blackouts
 public | idx_vehicles_fuel_type                                          | index | postgres | vehicles
 public | idx_vehicles_location                                           | index | postgres | vehicles
 public | idx_vehicles_make_model                                         | index | postgres | vehicles
 public | idx_vehicles_registration                                       | index | postgres | vehicles
 public | idx_vehicles_status                                             | index | postgres | vehicles
 public | idx_venues_location                                             | index | postgres | venues
 public | idx_venues_name                                                 | index | postgres | venues
 public | idx_venues_status                                               | index | postgres | venues
 public | loom_instances_pkey                                             | index | postgres | loom_instances
 public | loom_instances_source_rule_id_instance_date_key                 | index | postgres | loom_instances
 public | loom_participant_attendance_loom_instance_id_participant_id_key | index | postgres | loom_participant_attendance
 public | loom_participant_attendance_pkey                                | index | postgres | loom_participant_attendance
 public | loom_staff_assignments_loom_instance_id_staff_id_key            | index | postgres | loom_staff_assignments
 public | loom_staff_assignments_pkey                                     | index | postgres | loom_staff_assignments
 public | loom_vehicle_assignments_loom_instance_id_vehicle_id_key        | index | postgres | loom_vehicle_assignments
 public | loom_vehicle_assignments_pkey                                   | index | postgres | loom_vehicle_assignments
 public | master_schedule_items_pkey                                      | index | postgres | master_schedule_items
 public | migrations_name_key                                             | index | postgres | migrations
 public | migrations_pkey                                                 | index | postgres | migrations
 public | participant_billing_codes_pkey                                  | index | postgres | participant_billing_codes
 public | participants_pkey                                               | index | postgres | participants
 public | payment_diamonds_pkey                                           | index | postgres | payment_diamonds
 public | pending_enrollment_changes_pkey                                 | index | postgres | pending_enrollment_changes
 public | program_enrollments_participant_id_program_id_start_date_key    | index | postgres | program_enrollments
 public | program_enrollments_pkey                                        | index | postgres | program_enrollments
 public | program_participants_pkey                                       | index | postgres | program_participants
 public | program_participants_program_id_participant_id_key              | index | postgres | program_participants
 public | programs_pkey                                                   | index | postgres | programs
 public | rules_participant_schedule_participant_id_program_id_start__key | index | postgres | rules_participant_schedule
 public | rules_participant_schedule_pkey                                 | index | postgres | rules_participant_schedule
 public | rules_program_exceptions_pkey                                   | index | postgres | rules_program_exceptions
 public | rules_program_exceptions_program_id_exception_date_key          | index | postgres | rules_program_exceptions
 public | rules_programs_pkey                                             | index | postgres | rules_programs
 public | rules_staff_roster_pkey                                         | index | postgres | rules_staff_roster
 public | rules_staff_roster_staff_id_program_id_start_date_key           | index | postgres | rules_staff_roster
 public | schedule_pkey                                                   | index | postgres | schedule
 public | settings_pkey                                                   | index | postgres | settings
 public | staff_pkey                                                      | index | postgres | staff
 public | staff_unavailabilities_pkey                                     | index | postgres | staff_unavailabilities
 public | system_logs_pkey                                                | index | postgres | system_logs
 public | tgl_config_pkey                                                 | index | postgres | tgl_config
 public | tgl_loom_audit_log_pkey                                         | index | postgres | tgl_loom_audit_log
 public | tgl_loom_instances_pkey                                         | index | postgres | tgl_loom_instances
 public | tgl_loom_instances_program_id_instance_date_key                 | index | postgres | tgl_loom_instances
 public | tgl_loom_participant_allocations_pkey                           | index | postgres | tgl_loom_participant_allocations
 public | tgl_loom_staff_shifts_pkey                                      | index | postgres | tgl_loom_staff_shifts
 public | tgl_loom_time_slots_pkey                                        | index | postgres | tgl_loom_time_slots
 public | tgl_loom_vehicle_runs_pkey                                      | index | postgres | tgl_loom_vehicle_runs
 public | tgl_operator_intents_pkey                                       | index | postgres | tgl_operator_intents
 public | tgl_settings_key_key                                            | index | postgres | tgl_settings
 public | tgl_settings_pkey                                               | index | postgres | tgl_settings
 public | tgl_temporal_exceptions_pkey                                    | index | postgres | tgl_temporal_exceptions
 public | vehicle_blackouts_pkey                                          | index | postgres | vehicle_blackouts
 public | vehicles_pkey                                                   | index | postgres | vehicles
 public | venues_pkey                                                     | index | postgres | venues
(147 rows)


## Database Size

 12 MB


## Table Sizes

| Table | Size | Size with Indexes |
|-------|------|-------------------|
| billing_codes | 16kB | 48kB |
| change_log | 8192bytes | 48kB |
| event_card_map | 8192bytes | 24kB |
| history_pinned_artifacts | 8192bytes | 24kB |
| history_ribbon_participants | 8192bytes | 16kB |
| history_ribbon_shifts | 8192bytes | 24kB |
| history_ribbon_staff | 8192bytes | 16kB |
| history_ribbon_tags | 8192bytes | 1224kB |
| loom_instances | 8192bytes | 24kB |
| loom_participant_attendance | 8192bytes | 24kB |
| loom_staff_assignments | 8192bytes | 24kB |
| loom_vehicle_assignments | 8192bytes | 24kB |
| master_schedule_items | 16kB | 32kB |
| migrations | 16kB | 48kB |
| participant_billing_codes | 8192bytes | 16kB |
| participants | 64kB | 176kB |
| payment_diamonds | 8192bytes | 24kB |
| pending_enrollment_changes | 8192bytes | 40kB |
| program_enrollments | 0bytes | 40kB |
| program_participants | 16kB | 112kB |
| programs | 16kB | 112kB |
| rules_participant_schedule | 8192bytes | 24kB |
| rules_program_exceptions | 8192bytes | 24kB |
| rules_programs | 8192bytes | 16kB |
| rules_staff_roster | 8192bytes | 24kB |
| schedule | 8192bytes | 32kB |
| settings | 16kB | 32kB |
| staff | 56kB | 168kB |
| staff_unavailabilities | 8192bytes | 40kB |
| system_logs | 16kB | 112kB |
| tgl_config | 16kB | 32kB |
| tgl_loom_audit_log | 16kB | 120kB |
| tgl_loom_instances | 16kB | 136kB |
| tgl_loom_participant_allocations | 8192bytes | 56kB |
| tgl_loom_staff_shifts | 8192bytes | 48kB |
| tgl_loom_time_slots | 16kB | 64kB |
| tgl_loom_vehicle_runs | 8192bytes | 48kB |
| tgl_operator_intents | 16kB | 80kB |
| tgl_settings | 16kB | 64kB |
| tgl_temporal_exceptions | 8192bytes | 56kB |
| vehicle_blackouts | 8192bytes | 40kB |
| vehicles | 16kB | 112kB |
| venues | 16kB | 80kB |
