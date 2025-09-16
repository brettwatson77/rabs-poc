# ð Database Schema: rabspocdb
_Generated on Sat 09 Aug 2025 09:11:40 AEST_ by â¨ BrettGPT â¨


---

## ðï¸ Table: `billing_rates`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **code** | `character varying(50)` | f | - | - |
| **description** | `text` | f | - | - |
| **base_rate** | `numeric(10` | 2) | f | - |
| **ratio_1_1** | `numeric(10` | 2) | f | - |
| **ratio_1_2** | `numeric(10` | 2) | f | - |
| **ratio_1_3** | `numeric(10` | 2) | f | - |
| **ratio_1_4** | `numeric(10` | 2) | f | - |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | billing_rates | id |
| UNIQUE | `code` | billing_rates | code |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **billing_rates_pkey**: `CREATE UNIQUE INDEX billing_rates_pkey ON public.billing_rates USING btree (id)`
- **billing_rates_code_key**: `CREATE UNIQUE INDEX billing_rates_code_key ON public.billing_rates USING btree (code)`

---

## ðï¸ Table: `event_card_map`

> _ Maps a single logical event to multiple UI cards (bus runs, activity, roster)_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **card_type** | `text` | f | - | - |
| **card_order** | `integer` | f | - | - |
| **display_title** | `text` | f | - | - |
| **display_subtitle** | `text` | t | - | - |
| **display_time_start** | `timestamp with time zone` | f | - | - |
| **display_time_end** | `timestamp with time zone` | f | - | - |
| **card_color** | `text` | t | - | - |
| **card_icon** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | event_card_map | id |
| FOREIGN KEY | `loom_instance_id` | loom_instances | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **event_card_map_pkey**: `CREATE UNIQUE INDEX event_card_map_pkey ON public.event_card_map USING btree (id)`
- **idx_event_card_map_loom**: `CREATE INDEX idx_event_card_map_loom ON public.event_card_map USING btree (loom_instance_id)`

---

## ðï¸ Table: `migrations`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 48 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `integer` | f | nextval('migrations_id_seq'::regclass) | - |
| **name** | `text` | f | - | - |
| **applied_at** | `timestamp without time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | migrations | id |
| UNIQUE | `name` | migrations | name |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **migrations_pkey**: `CREATE UNIQUE INDEX migrations_pkey ON public.migrations USING btree (id)`
- **migrations_name_key**: `CREATE UNIQUE INDEX migrations_name_key ON public.migrations USING btree (name)`

---

## ðï¸ Table: `venues`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 80 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **name** | `character varying(100)` | f | - | - |
| **address** | `text` | f | - | - |
| **suburb** | `character varying(100)` | t | - | - |
| **state** | `character varying(50)` | t | - | - |
| **postcode** | `character varying(10)` | t | - | - |
| **capacity** | `integer` | t | - | - |
| **facilities** | `text` | t | - | - |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **location_lat** | `numeric(10` | 8) | t | - |
| **location_lng** | `numeric(11` | 8) | t | - |
| **status** | `character varying(50)` | f | 'active'::character varying | - |
| **notes** | `text` | t | - | - |
| **website** | `text` | t | - | - |
| **image_url** | `text` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | venues | id |
| CHECK | `` | venues | status |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_venues_status**: `CREATE INDEX idx_venues_status ON public.venues USING btree (status)`
- **venues_pkey**: `CREATE UNIQUE INDEX venues_pkey ON public.venues USING btree (id)`
- **idx_venues_name**: `CREATE INDEX idx_venues_name ON public.venues USING btree (name)`
- **idx_venues_location**: `CREATE INDEX idx_venues_location ON public.venues USING btree (location_lat, location_lng)`

---

## ðï¸ Table: `participants`

> _ Participants with dual approach for support needs: boolean flags for filtering and text fields for details_

- **Estimated Rows**: `       120`
- **Estimated Disk Size**: ` 176 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **first_name** | `character varying(100)` | f | - | - |
| **last_name** | `character varying(100)` | f | - | - |
| **date_of_birth** | `date` | t | - | - |
| **ndis_number** | `character varying(50)` | t | - | - |
| **address** | `text` | t | - | - |
| **suburb** | `character varying(100)` | t | - | - |
| **state** | `character varying(50)` | t | - | - |
| **postcode** | `character varying(10)` | t | - | - |
| **phone** | `character varying(20)` | t | - | - |
| **email** | `character varying(100)` | t | - | - |
| **emergency_contact_name** | `character varying(100)` | t | - | - |
| **emergency_contact_phone** | `character varying(20)` | t | - | - |
| **notes** | `text` | t | - | - |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **photo_url** | `text` | t | - | - |
| **location_lat** | `numeric(10` | 8) | t | - |
| **location_lng** | `numeric(11` | 8) | t | - |
| **supervision_multiplier** | `numeric(3` | 2) | f | 1.0 |
| **ndis_plan_start** | `date` | t | - | - |
| **ndis_plan_end** | `date` | t | - | - |
| **ndis_plan_budget** | `numeric(10` | 2) | t | - |
| **requires_wheelchair** | `boolean` | t | false | - |
| **requires_transport** | `boolean` | t | false | - |
| **gender** | `character varying(20)` | t | - | - |
| **plan_management_type** | `plan_management_enum` | f | 'agency_managed'::plan_management_enum | - |
| **plan_manager_name** | `character varying(100)` | t | - | - |
| **plan_manager_email** | `character varying(100)` | t | - | - |
| **plan_manager_phone** | `character varying(20)` | t | - | - |
| **support_coordinator_name** | `character varying(100)` | t | - | - |
| **support_coordinator_email** | `character varying(100)` | t | - | - |
| **support_coordinator_phone** | `character varying(20)` | t | - | - |
| **guardian_name** | `character varying(100)` | t | - | - |
| **guardian_relationship** | `character varying(50)` | t | - | - |
| **guardian_contact** | `character varying(100)` | t | - | - |
| **has_behavior_support_plan** | `boolean` | t | false | - |
| **has_medical_plan** | `boolean` | t | false | - |
| **allergies** | `text` | t | - | - |
| **medication_needs** | `text` | t | - | - |
| **mobility_needs** | `text` | t | - | - |
| **communication_needs** | `text` | t | - | - |
| **photo_consent** | `boolean` | t | false | - |
| **transport_consent** | `boolean` | t | false | - |
| **medication_consent** | `boolean` | t | false | - |
| **has_wheelchair_access** | `boolean` | f | false | Boolean flag for wheelchair access needs. Use with mobility_requirements text field for details. |
| **has_dietary_requirements** | `boolean` | f | false | Boolean flag for any dietary requirements. Use with dietary_requirements text field for details. |
| **has_medical_requirements** | `boolean` | f | false | Boolean flag for medical requirements. Use with medical_requirements text field for details. |
| **has_behavioral_support** | `boolean` | f | false | Boolean flag for behavioral support needs. Corresponds to behavior_support_plan field. |
| **has_visual_impairment** | `boolean` | f | false | Boolean flag for visual impairment support needs. |
| **has_hearing_impairment** | `boolean` | f | false | Boolean flag for hearing impairment support needs. |
| **has_cognitive_support** | `boolean` | f | false | Boolean flag for cognitive support needs. |
| **has_communication_needs** | `boolean` | f | false | Boolean flag for communication support needs. |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | participants | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_participant_support_flags**: `CREATE INDEX idx_participant_support_flags ON public.participants USING btree (has_wheelchair_access, has_dietary_requirements, has_medical_requirements, has_behavioral_support, has_visual_impairment, has_hearing_impairment, has_cognitive_support, has_communication_needs)`
- **participants_pkey**: `CREATE UNIQUE INDEX participants_pkey ON public.participants USING btree (id)`
- **idx_participants_name**: `CREATE INDEX idx_participants_name ON public.participants USING btree (last_name, first_name)`
- **idx_participants_ndis**: `CREATE INDEX idx_participants_ndis ON public.participants USING btree (ndis_number)`
- **idx_participants_location**: `CREATE INDEX idx_participants_location ON public.participants USING btree (location_lat, location_lng)`
- **idx_participant_ndis_number**: `CREATE INDEX idx_participant_ndis_number ON public.participants USING btree (ndis_number)`
- **idx_participant_plan_management**: `CREATE INDEX idx_participant_plan_management ON public.participants USING btree (plan_management_type)`

---

## ðï¸ Table: `pending_enrollment_changes`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 40 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **participant_id** | `uuid` | f | - | - |
| **program_id** | `uuid` | f | - | - |
| **action** | `text` | f | - | - |
| **effective_date** | `date` | f | - | - |
| **status** | `text` | t | 'pending'::text | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | pending_enrollment_changes | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **pending_enrollment_changes_pkey**: `CREATE UNIQUE INDEX pending_enrollment_changes_pkey ON public.pending_enrollment_changes USING btree (id)`
- **idx_pending_enrollment_changes_status**: `CREATE INDEX idx_pending_enrollment_changes_status ON public.pending_enrollment_changes USING btree (status)`
- **idx_pending_changes_effective_date**: `CREATE INDEX idx_pending_changes_effective_date ON public.pending_enrollment_changes USING btree (effective_date)`
- **idx_pending_changes_status**: `CREATE INDEX idx_pending_changes_status ON public.pending_enrollment_changes USING btree (status)`

---

## ðï¸ Table: `program_enrollments`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 40 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **participant_id** | `uuid` | f | - | - |
| **program_id** | `uuid` | f | - | - |
| **start_date** | `date` | f | - | - |
| **end_date** | `date` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | program_enrollments | id |
| UNIQUE | `participant_id` | program_enrollments | participant_id |
| UNIQUE | `participant_id` | program_enrollments | program_id |
| UNIQUE | `participant_id` | program_enrollments | start_date |
| UNIQUE | `program_id` | program_enrollments | participant_id |
| UNIQUE | `program_id` | program_enrollments | program_id |
| UNIQUE | `program_id` | program_enrollments | start_date |
| UNIQUE | `start_date` | program_enrollments | participant_id |
| UNIQUE | `start_date` | program_enrollments | program_id |
| UNIQUE | `start_date` | program_enrollments | start_date |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **program_enrollments_pkey**: `CREATE UNIQUE INDEX program_enrollments_pkey ON public.program_enrollments USING btree (id)`
- **program_enrollments_participant_id_program_id_start_date_key**: `CREATE UNIQUE INDEX program_enrollments_participant_id_program_id_start_date_key ON public.program_enrollments USING btree (participant_id, program_id, start_date)`
- **idx_program_enrollments_participant**: `CREATE INDEX idx_program_enrollments_participant ON public.program_enrollments USING btree (participant_id)`
- **idx_program_enrollments_program**: `CREATE INDEX idx_program_enrollments_program ON public.program_enrollments USING btree (program_id)`
- **idx_program_enrollments_dates**: `CREATE INDEX idx_program_enrollments_dates ON public.program_enrollments USING btree (start_date, end_date)`

---

## ðï¸ Table: `master_schedule_items`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 32 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **program_name** | `text` | f | - | - |
| **date** | `date` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **participant_count** | `integer` | t | 0 | - |
| **supervision_multiplier** | `numeric(3` | 2) | t | 1.0 |
| **status** | `text` | t | 'scheduled'::text | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | master_schedule_items | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **master_schedule_items_pkey**: `CREATE UNIQUE INDEX master_schedule_items_pkey ON public.master_schedule_items USING btree (id)`

---

## ðï¸ Table: `tgl_loom_vehicle_runs`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 48 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **vehicle_id** | `uuid` | f | - | - |
| **driver_id** | `uuid` | t | - | - |
| **route_data** | `jsonb` | f | '{}'::jsonb | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **estimated_duration** | `integer` | t | - | - |
| **estimated_distance** | `integer` | t | - | - |
| **manually_configured** | `boolean` | f | false | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_vehicle_runs | id |
| FOREIGN KEY | `loom_instance_id` | tgl_loom_instances | id |
| FOREIGN KEY | `vehicle_id` | vehicles | id |
| FOREIGN KEY | `driver_id` | staff | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_loom_vehicle_runs_pkey**: `CREATE UNIQUE INDEX tgl_loom_vehicle_runs_pkey ON public.tgl_loom_vehicle_runs USING btree (id)`
- **idx_loom_vehicle_runs_instance**: `CREATE INDEX idx_loom_vehicle_runs_instance ON public.tgl_loom_vehicle_runs USING btree (loom_instance_id)`
- **idx_loom_vehicle_runs_vehicle**: `CREATE INDEX idx_loom_vehicle_runs_vehicle ON public.tgl_loom_vehicle_runs USING btree (vehicle_id)`
- **idx_loom_vehicle_runs_driver**: `CREATE INDEX idx_loom_vehicle_runs_driver ON public.tgl_loom_vehicle_runs USING btree (driver_id)`
- **idx_loom_vehicle_runs_timerange**: `CREATE INDEX idx_loom_vehicle_runs_timerange ON public.tgl_loom_vehicle_runs USING btree (start_time, end_time)`

---

## ðï¸ Table: `tgl_operator_intents`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 80 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **intent_type** | `tgl_intent_type` | f | - | - |
| **start_date** | `date` | f | - | - |
| **end_date** | `date` | t | - | - |
| **program_id** | `uuid` | t | - | - |
| **participant_id** | `uuid` | t | - | - |
| **staff_id** | `uuid` | t | - | - |
| **venue_id** | `uuid` | t | - | - |
| **vehicle_id** | `uuid` | t | - | - |
| **metadata** | `jsonb` | f | '{}'::jsonb | - |
| **modified_fields** | `jsonb` | t | - | - |
| **billing_codes** | `jsonb` | t | - | - |
| **created_by** | `text` | f | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| CHECK | `` | tgl_operator_intents | end_date |
| CHECK | `` | tgl_operator_intents | start_date |
| PRIMARY KEY | `id` | tgl_operator_intents | id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `participant_id` | participants | id |
| FOREIGN KEY | `staff_id` | staff | id |
| FOREIGN KEY | `venue_id` | venues | id |
| FOREIGN KEY | `vehicle_id` | vehicles | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_operator_intents_pkey**: `CREATE UNIQUE INDEX tgl_operator_intents_pkey ON public.tgl_operator_intents USING btree (id)`
- **idx_operator_intents_date_range**: `CREATE INDEX idx_operator_intents_date_range ON public.tgl_operator_intents USING btree (start_date, end_date)`
- **idx_operator_intents_program**: `CREATE INDEX idx_operator_intents_program ON public.tgl_operator_intents USING btree (program_id) WHERE (program_id IS NOT NULL)`
- **idx_operator_intents_participant**: `CREATE INDEX idx_operator_intents_participant ON public.tgl_operator_intents USING btree (participant_id) WHERE (participant_id IS NOT NULL)`
- **idx_operator_intents_type**: `CREATE INDEX idx_operator_intents_type ON public.tgl_operator_intents USING btree (intent_type)`

---

## ðï¸ Table: `tgl_config`

> _ Configuration for The Great Loom architecture_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 32 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **key** | `text` | f | - | - |
| **value** | `text` | f | - | - |
| **description** | `text` | t | - | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_by** | `text` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `key` | tgl_config | key |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_config_pkey**: `CREATE UNIQUE INDEX tgl_config_pkey ON public.tgl_config USING btree (key)`

---

## ðï¸ Table: `rules_programs`

> _ The "Unwoven Future" - rules and intentions for recurring programs_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 16 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **name** | `text` | f | - | - |
| **description** | `text` | t | - | - |
| **day_of_week** | `integer` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **is_recurring** | `boolean` | t | true | - |
| **recurrence_pattern** | `text` | t | 'weekly'::text | - |
| **transport_required** | `boolean` | t | true | - |
| **staffing_ratio** | `text` | t | '1:4'::text | - |
| **active** | `boolean` | t | true | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | rules_programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **rules_programs_pkey**: `CREATE UNIQUE INDEX rules_programs_pkey ON public.rules_programs USING btree (id)`

---

## ðï¸ Table: `rules_program_exceptions`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **program_id** | `uuid` | f | - | - |
| **exception_date** | `date` | f | - | - |
| **exception_type** | `text` | f | - | - |
| **start_time** | `time without time zone` | t | - | - |
| **end_time** | `time without time zone` | t | - | - |
| **venue_id** | `uuid` | t | - | - |
| **reason** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | rules_program_exceptions | id |
| UNIQUE | `program_id` | rules_program_exceptions | exception_date |
| UNIQUE | `program_id` | rules_program_exceptions | program_id |
| UNIQUE | `exception_date` | rules_program_exceptions | exception_date |
| UNIQUE | `exception_date` | rules_program_exceptions | program_id |
| FOREIGN KEY | `program_id` | rules_programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **rules_program_exceptions_pkey**: `CREATE UNIQUE INDEX rules_program_exceptions_pkey ON public.rules_program_exceptions USING btree (id)`
- **rules_program_exceptions_program_id_exception_date_key**: `CREATE UNIQUE INDEX rules_program_exceptions_program_id_exception_date_key ON public.rules_program_exceptions USING btree (program_id, exception_date)`

---

## ðï¸ Table: `rules_participant_schedule`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **participant_id** | `uuid` | f | - | - |
| **program_id** | `uuid` | f | - | - |
| **start_date** | `date` | f | - | - |
| **end_date** | `date` | t | - | - |
| **pickup_required** | `boolean` | t | true | - |
| **dropoff_required** | `boolean` | t | true | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | rules_participant_schedule | id |
| UNIQUE | `participant_id` | rules_participant_schedule | participant_id |
| UNIQUE | `participant_id` | rules_participant_schedule | program_id |
| UNIQUE | `participant_id` | rules_participant_schedule | start_date |
| UNIQUE | `program_id` | rules_participant_schedule | participant_id |
| UNIQUE | `program_id` | rules_participant_schedule | program_id |
| UNIQUE | `program_id` | rules_participant_schedule | start_date |
| UNIQUE | `start_date` | rules_participant_schedule | participant_id |
| UNIQUE | `start_date` | rules_participant_schedule | program_id |
| UNIQUE | `start_date` | rules_participant_schedule | start_date |
| FOREIGN KEY | `program_id` | rules_programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **rules_participant_schedule_pkey**: `CREATE UNIQUE INDEX rules_participant_schedule_pkey ON public.rules_participant_schedule USING btree (id)`
- **rules_participant_schedule_participant_id_program_id_start__key**: `CREATE UNIQUE INDEX rules_participant_schedule_participant_id_program_id_start__key ON public.rules_participant_schedule USING btree (participant_id, program_id, start_date)`

---

## ðï¸ Table: `rules_staff_roster`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **staff_id** | `uuid` | f | - | - |
| **program_id** | `uuid` | f | - | - |
| **role** | `text` | f | 'support'::text | - |
| **start_date** | `date` | f | - | - |
| **end_date** | `date` | t | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | rules_staff_roster | id |
| UNIQUE | `staff_id` | rules_staff_roster | program_id |
| UNIQUE | `staff_id` | rules_staff_roster | staff_id |
| UNIQUE | `staff_id` | rules_staff_roster | start_date |
| UNIQUE | `program_id` | rules_staff_roster | program_id |
| UNIQUE | `program_id` | rules_staff_roster | staff_id |
| UNIQUE | `program_id` | rules_staff_roster | start_date |
| UNIQUE | `start_date` | rules_staff_roster | program_id |
| UNIQUE | `start_date` | rules_staff_roster | staff_id |
| UNIQUE | `start_date` | rules_staff_roster | start_date |
| FOREIGN KEY | `program_id` | rules_programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **rules_staff_roster_pkey**: `CREATE UNIQUE INDEX rules_staff_roster_pkey ON public.rules_staff_roster USING btree (id)`
- **rules_staff_roster_staff_id_program_id_start_date_key**: `CREATE UNIQUE INDEX rules_staff_roster_staff_id_program_id_start_date_key ON public.rules_staff_roster USING btree (staff_id, program_id, start_date)`

---

## ðï¸ Table: `change_log`

> _ Comprehensive audit trail of all participant and program changes_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 48 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **change_date** | `timestamp with time zone` | f | now() | - |
| **change_type** | `text` | f | - | - |
| **description** | `text` | f | - | - |
| **participant_id** | `uuid` | t | - | - |
| **billing_impact** | `boolean` | f | false | - |
| **billing_status** | `text` | f | 'NA'::text | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | change_log | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **change_log_pkey**: `CREATE UNIQUE INDEX change_log_pkey ON public.change_log USING btree (id)`
- **idx_change_log_participant_date**: `CREATE INDEX idx_change_log_participant_date ON public.change_log USING btree (participant_id, change_date)`
- **idx_change_log_billing_impact**: `CREATE INDEX idx_change_log_billing_impact ON public.change_log USING btree (billing_impact) WHERE (billing_impact = true)`
- **idx_change_log_participant_type**: `CREATE INDEX idx_change_log_participant_type ON public.change_log USING btree (participant_id, change_type)`
- **idx_change_log_billing_status**: `CREATE INDEX idx_change_log_billing_status ON public.change_log USING btree (billing_status) WHERE (billing_status <> 'NA'::text)`

---

## ðï¸ Table: `loom_instances`

> _ The "Loom of the Present" - concrete instances projected from rules_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **source_rule_id** | `uuid` | f | - | - |
| **instance_date** | `date` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **transport_required** | `boolean` | t | true | - |
| **staffing_ratio** | `text` | t | '1:4'::text | - |
| **is_overridden** | `boolean` | t | false | - |
| **override_source** | `text` | t | - | - |
| **override_reason** | `text` | t | - | - |
| **quality_audit_flag** | `boolean` | t | false | - |
| **projection_hash** | `text` | t | - | - |
| **projected_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | loom_instances | id |
| UNIQUE | `source_rule_id` | loom_instances | instance_date |
| UNIQUE | `source_rule_id` | loom_instances | source_rule_id |
| UNIQUE | `instance_date` | loom_instances | instance_date |
| UNIQUE | `instance_date` | loom_instances | source_rule_id |
| FOREIGN KEY | `source_rule_id` | rules_programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **loom_instances_pkey**: `CREATE UNIQUE INDEX loom_instances_pkey ON public.loom_instances USING btree (id)`
- **loom_instances_source_rule_id_instance_date_key**: `CREATE UNIQUE INDEX loom_instances_source_rule_id_instance_date_key ON public.loom_instances USING btree (source_rule_id, instance_date)`

---

## ðï¸ Table: `loom_participant_attendance`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **source_rule_id** | `uuid` | t | - | - |
| **status** | `text` | f | 'confirmed'::text | - |
| **is_overridden** | `boolean` | t | false | - |
| **override_source** | `text` | t | - | - |
| **override_reason** | `text` | t | - | - |
| **pickup_required** | `boolean` | t | true | - |
| **dropoff_required** | `boolean` | t | true | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | loom_participant_attendance | id |
| UNIQUE | `loom_instance_id` | loom_participant_attendance | loom_instance_id |
| UNIQUE | `loom_instance_id` | loom_participant_attendance | participant_id |
| UNIQUE | `participant_id` | loom_participant_attendance | loom_instance_id |
| UNIQUE | `participant_id` | loom_participant_attendance | participant_id |
| FOREIGN KEY | `loom_instance_id` | loom_instances | id |
| FOREIGN KEY | `source_rule_id` | rules_participant_schedule | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **loom_participant_attendance_pkey**: `CREATE UNIQUE INDEX loom_participant_attendance_pkey ON public.loom_participant_attendance USING btree (id)`
- **loom_participant_attendance_loom_instance_id_participant_id_key**: `CREATE UNIQUE INDEX loom_participant_attendance_loom_instance_id_participant_id_key ON public.loom_participant_attendance USING btree (loom_instance_id, participant_id)`

---

## ðï¸ Table: `loom_staff_assignments`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **staff_id** | `uuid` | f | - | - |
| **source_rule_id** | `uuid` | t | - | - |
| **role** | `text` | f | 'support'::text | - |
| **is_overridden** | `boolean` | t | false | - |
| **override_source** | `text` | t | - | - |
| **override_reason** | `text` | t | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | loom_staff_assignments | id |
| UNIQUE | `loom_instance_id` | loom_staff_assignments | loom_instance_id |
| UNIQUE | `loom_instance_id` | loom_staff_assignments | staff_id |
| UNIQUE | `staff_id` | loom_staff_assignments | loom_instance_id |
| UNIQUE | `staff_id` | loom_staff_assignments | staff_id |
| FOREIGN KEY | `loom_instance_id` | loom_instances | id |
| FOREIGN KEY | `source_rule_id` | rules_staff_roster | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **loom_staff_assignments_pkey**: `CREATE UNIQUE INDEX loom_staff_assignments_pkey ON public.loom_staff_assignments USING btree (id)`
- **loom_staff_assignments_loom_instance_id_staff_id_key**: `CREATE UNIQUE INDEX loom_staff_assignments_loom_instance_id_staff_id_key ON public.loom_staff_assignments USING btree (loom_instance_id, staff_id)`

---

## ðï¸ Table: `loom_vehicle_assignments`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **vehicle_id** | `uuid` | f | - | - |
| **driver_staff_id** | `uuid` | t | - | - |
| **is_overridden** | `boolean` | t | false | - |
| **override_source** | `text` | t | - | - |
| **override_reason** | `text` | t | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | loom_vehicle_assignments | id |
| UNIQUE | `loom_instance_id` | loom_vehicle_assignments | loom_instance_id |
| UNIQUE | `loom_instance_id` | loom_vehicle_assignments | vehicle_id |
| UNIQUE | `vehicle_id` | loom_vehicle_assignments | loom_instance_id |
| UNIQUE | `vehicle_id` | loom_vehicle_assignments | vehicle_id |
| FOREIGN KEY | `loom_instance_id` | loom_instances | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **loom_vehicle_assignments_pkey**: `CREATE UNIQUE INDEX loom_vehicle_assignments_pkey ON public.loom_vehicle_assignments USING btree (id)`
- **loom_vehicle_assignments_loom_instance_id_vehicle_id_key**: `CREATE UNIQUE INDEX loom_vehicle_assignments_loom_instance_id_vehicle_id_key ON public.loom_vehicle_assignments USING btree (loom_instance_id, vehicle_id)`

---

## ðï¸ Table: `history_ribbon_shifts`

> _ The "Woven Past" - immutable record of completed shifts_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **original_loom_id** | `uuid` | f | - | - |
| **program_name** | `text` | f | - | - |
| **program_description** | `text` | t | - | - |
| **instance_date** | `date` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_name** | `text` | f | - | - |
| **venue_address** | `text` | t | - | - |
| **participant_count** | `integer` | f | - | - |
| **staff_count** | `integer` | f | - | - |
| **vehicle_count** | `integer` | f | - | - |
| **completion_status** | `text` | f | - | - |
| **woven_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **archived** | `boolean` | t | false | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **history_ribbon_shifts_pkey**: `CREATE UNIQUE INDEX history_ribbon_shifts_pkey ON public.history_ribbon_shifts USING btree (id)`
- **idx_history_ribbon_date**: `CREATE INDEX idx_history_ribbon_date ON public.history_ribbon_shifts USING btree (instance_date)`

---

## ðï¸ Table: `history_ribbon_participants`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 16 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **history_shift_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **participant_name** | `text` | f | - | - |
| **attendance_status** | `text` | f | - | - |
| **pickup_provided** | `boolean` | t | - | - |
| **dropoff_provided** | `boolean` | t | - | - |
| **notes** | `text` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | history_ribbon_participants | id |
| FOREIGN KEY | `history_shift_id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **history_ribbon_participants_pkey**: `CREATE UNIQUE INDEX history_ribbon_participants_pkey ON public.history_ribbon_participants USING btree (id)`

---

## ðï¸ Table: `history_ribbon_staff`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 16 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **history_shift_id** | `uuid` | f | - | - |
| **staff_id** | `uuid` | f | - | - |
| **staff_name** | `text` | f | - | - |
| **role** | `text` | f | - | - |
| **hours_worked** | `numeric(5` | 2) | f | - |
| **notes** | `text` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | history_ribbon_staff | id |
| FOREIGN KEY | `history_shift_id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **history_ribbon_staff_pkey**: `CREATE UNIQUE INDEX history_ribbon_staff_pkey ON public.history_ribbon_staff USING btree (id)`

---

## ðï¸ Table: `history_ribbon_tags`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 1224 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **history_shift_id** | `uuid` | f | - | - |
| **tag_key** | `text` | f | - | - |
| **tag_value** | `text` | f | - | - |
| **embedding** | `vector(768)` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | history_ribbon_tags | id |
| FOREIGN KEY | `history_shift_id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **history_ribbon_tags_pkey**: `CREATE UNIQUE INDEX history_ribbon_tags_pkey ON public.history_ribbon_tags USING btree (id)`
- **idx_history_ribbon_tags_embedding**: `CREATE INDEX idx_history_ribbon_tags_embedding ON public.history_ribbon_tags USING ivfflat (embedding vector_cosine_ops)`

---

## ðï¸ Table: `history_pinned_artifacts`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **history_shift_id** | `uuid` | f | - | - |
| **artifact_type** | `text` | f | - | - |
| **title** | `text` | f | - | - |
| **content** | `text` | t | - | - |
| **severity** | `text` | t | - | - |
| **created_by** | `text` | f | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **embedding** | `vector(768)` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | history_pinned_artifacts | id |
| FOREIGN KEY | `history_shift_id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **history_pinned_artifacts_pkey**: `CREATE UNIQUE INDEX history_pinned_artifacts_pkey ON public.history_pinned_artifacts USING btree (id)`
- **idx_history_pinned_artifacts_type**: `CREATE INDEX idx_history_pinned_artifacts_type ON public.history_pinned_artifacts USING btree (artifact_type)`

---

## ðï¸ Table: `payment_diamonds`

> _ The "Payment Python" - financial lifecycle tracking_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 24 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | uuid_generate_v4() | - |
| **history_shift_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **support_item_number** | `text` | f | - | - |
| **unit_price** | `numeric(10` | 2) | f | - |
| **quantity** | `numeric(6` | 2) | f | - |
| **total_amount** | `numeric(10` | 2) | f | - |
| **gst_code** | `text` | f | - | - |
| **status** | `text` | f | 'completed'::text | - |
| **invoice_number** | `text` | t | - | - |
| **invoice_date** | `date` | t | - | - |
| **payment_date** | `date` | t | - | - |
| **retention_end_date** | `date` | t | - | - |
| **created_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **updated_at** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | payment_diamonds | id |
| FOREIGN KEY | `history_shift_id` | history_ribbon_shifts | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **payment_diamonds_pkey**: `CREATE UNIQUE INDEX payment_diamonds_pkey ON public.payment_diamonds USING btree (id)`
- **idx_payment_diamonds_status**: `CREATE INDEX idx_payment_diamonds_status ON public.payment_diamonds USING btree (status)`

---

## ðï¸ Table: `tgl_temporal_exceptions`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 56 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **exception_type** | `tgl_exception_type` | f | - | - |
| **exception_date** | `date` | f | - | - |
| **program_id** | `uuid` | t | - | - |
| **participant_id** | `uuid` | t | - | - |
| **staff_id** | `uuid` | t | - | - |
| **venue_id** | `uuid` | t | - | - |
| **vehicle_id** | `uuid` | t | - | - |
| **loom_instance_id** | `uuid` | t | - | - |
| **metadata** | `jsonb` | f | '{}'::jsonb | - |
| **billing_override** | `jsonb` | t | - | - |
| **reason** | `text` | t | - | - |
| **created_by** | `text` | f | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_temporal_exceptions | id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `participant_id` | participants | id |
| FOREIGN KEY | `staff_id` | staff | id |
| FOREIGN KEY | `venue_id` | venues | id |
| FOREIGN KEY | `vehicle_id` | vehicles | id |
| FOREIGN KEY | `loom_instance_id` | tgl_loom_instances | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_temporal_exceptions_pkey**: `CREATE UNIQUE INDEX tgl_temporal_exceptions_pkey ON public.tgl_temporal_exceptions USING btree (id)`
- **idx_temporal_exceptions_date**: `CREATE INDEX idx_temporal_exceptions_date ON public.tgl_temporal_exceptions USING btree (exception_date)`
- **idx_temporal_exceptions_program**: `CREATE INDEX idx_temporal_exceptions_program ON public.tgl_temporal_exceptions USING btree (program_id) WHERE (program_id IS NOT NULL)`
- **idx_temporal_exceptions_participant**: `CREATE INDEX idx_temporal_exceptions_participant ON public.tgl_temporal_exceptions USING btree (participant_id) WHERE (participant_id IS NOT NULL)`
- **idx_temporal_exceptions_type**: `CREATE INDEX idx_temporal_exceptions_type ON public.tgl_temporal_exceptions USING btree (exception_type)`
- **idx_temporal_exceptions_instance**: `CREATE INDEX idx_temporal_exceptions_instance ON public.tgl_temporal_exceptions USING btree (loom_instance_id) WHERE (loom_instance_id IS NOT NULL)`

---

## ðï¸ Table: `program_participants`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 112 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **program_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **billing_code_id** | `uuid` | t | - | - |
| **start_date** | `date` | t | - | - |
| **end_date** | `date` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **status** | `text` | f | 'active'::text | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| UNIQUE | `program_id` | program_participants | participant_id |
| UNIQUE | `program_id` | program_participants | program_id |
| UNIQUE | `participant_id` | program_participants | participant_id |
| UNIQUE | `participant_id` | program_participants | program_id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `participant_id` | participants | id |
| FOREIGN KEY | `billing_code_id` | billing_codes | id |
| PRIMARY KEY | `id` | program_participants | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_program_participants_status**: `CREATE INDEX idx_program_participants_status ON public.program_participants USING btree (status)`
- **program_participants_pkey**: `CREATE UNIQUE INDEX program_participants_pkey ON public.program_participants USING btree (id)`
- **program_participants_program_id_participant_id_key**: `CREATE UNIQUE INDEX program_participants_program_id_participant_id_key ON public.program_participants USING btree (program_id, participant_id)`
- **idx_program_participants_program**: `CREATE INDEX idx_program_participants_program ON public.program_participants USING btree (program_id)`
- **idx_program_participants_participant**: `CREATE INDEX idx_program_participants_participant ON public.program_participants USING btree (participant_id)`
- **idx_program_participants_dates**: `CREATE INDEX idx_program_participants_dates ON public.program_participants USING btree (start_date, end_date)`

---

## ðï¸ Table: `tgl_loom_participant_allocations`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 56 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **billing_code_id** | `uuid` | t | - | - |
| **allocation_status** | `allocation_status` | f | 'planned'::allocation_status | - |
| **cancellation_type** | `cancellation_type` | t | - | - |
| **manually_added** | `boolean` | f | false | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **billing_codes** | `jsonb` | t | '[]'::jsonb | Array of billing code objects with code, hours, and rate |
| **hours** | `numeric(5` | 2) | t | 0,Total hours for this participant allocation |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_participant_allocations | id |
| FOREIGN KEY | `loom_instance_id` | tgl_loom_instances | id |
| FOREIGN KEY | `participant_id` | participants | id |
| FOREIGN KEY | `billing_code_id` | billing_codes | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_participant_allocations_billing_codes**: `CREATE INDEX idx_participant_allocations_billing_codes ON public.tgl_loom_participant_allocations USING gin (billing_codes)`
- **tgl_loom_participant_allocations_pkey**: `CREATE UNIQUE INDEX tgl_loom_participant_allocations_pkey ON public.tgl_loom_participant_allocations USING btree (id)`
- **idx_loom_participant_allocations_instance**: `CREATE INDEX idx_loom_participant_allocations_instance ON public.tgl_loom_participant_allocations USING btree (loom_instance_id)`
- **idx_loom_participant_allocations_participant**: `CREATE INDEX idx_loom_participant_allocations_participant ON public.tgl_loom_participant_allocations USING btree (participant_id)`
- **idx_loom_participant_allocations_status**: `CREATE INDEX idx_loom_participant_allocations_status ON public.tgl_loom_participant_allocations USING btree (allocation_status)`

---

## ðï¸ Table: `vehicle_blackouts`

> _ Tracks periods when vehicles are unavailable (maintenance, repairs, etc.)_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 40 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **vehicle_id** | `uuid` | f | - | - |
| **start_time** | `timestamp with time zone` | f | - | - |
| **end_time** | `timestamp with time zone` | f | - | - |
| **reason** | `text` | f | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| CHECK | `` | vehicle_blackouts | end_time |
| CHECK | `` | vehicle_blackouts | start_time |
| PRIMARY KEY | `id` | vehicle_blackouts | id |
| FOREIGN KEY | `vehicle_id` | vehicles | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **vehicle_blackouts_pkey**: `CREATE UNIQUE INDEX vehicle_blackouts_pkey ON public.vehicle_blackouts USING btree (id)`
- **idx_vehicle_blackouts_vehicle**: `CREATE INDEX idx_vehicle_blackouts_vehicle ON public.vehicle_blackouts USING btree (vehicle_id)`
- **idx_vehicle_blackouts_timerange**: `CREATE INDEX idx_vehicle_blackouts_timerange ON public.vehicle_blackouts USING btree (start_time, end_time)`
- **idx_vehicle_blackouts_active**: `CREATE INDEX idx_vehicle_blackouts_active ON public.vehicle_blackouts USING btree (vehicle_id, start_time, end_time)`

---

## ðï¸ Table: `staff_unavailabilities`

> _ Tracks periods when staff are unavailable (sick leave, annual leave, training, etc.)_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 40 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **staff_id** | `uuid` | f | - | - |
| **start_time** | `timestamp with time zone` | f | - | - |
| **end_time** | `timestamp with time zone` | f | - | - |
| **reason** | `text` | f | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| CHECK | `` | staff_unavailabilities | end_time |
| CHECK | `` | staff_unavailabilities | start_time |
| PRIMARY KEY | `id` | staff_unavailabilities | id |
| FOREIGN KEY | `staff_id` | staff | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **staff_unavailabilities_pkey**: `CREATE UNIQUE INDEX staff_unavailabilities_pkey ON public.staff_unavailabilities USING btree (id)`
- **idx_staff_unavailabilities_staff**: `CREATE INDEX idx_staff_unavailabilities_staff ON public.staff_unavailabilities USING btree (staff_id)`
- **idx_staff_unavailabilities_timerange**: `CREATE INDEX idx_staff_unavailabilities_timerange ON public.staff_unavailabilities USING btree (start_time, end_time)`
- **idx_staff_unavailabilities_active**: `CREATE INDEX idx_staff_unavailabilities_active ON public.staff_unavailabilities USING btree (staff_id, start_time, end_time)`

---

## ðï¸ Table: `tgl_settings`

> _ _

- **Estimated Rows**: `        17`
- **Estimated Disk Size**: ` 64 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **key** | `text` | f | - | - |
| **value** | `text` | f | - | - |
| **data_type** | `text` | f | 'string'::text | - |
| **category** | `text` | f | 'general'::text | - |
| **description** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_settings | id |
| UNIQUE | `key` | tgl_settings | key |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_tgl_settings_category**: `CREATE INDEX idx_tgl_settings_category ON public.tgl_settings USING btree (category)`
- **tgl_settings_pkey**: `CREATE UNIQUE INDEX tgl_settings_pkey ON public.tgl_settings USING btree (id)`
- **tgl_settings_key_key**: `CREATE UNIQUE INDEX tgl_settings_key_key ON public.tgl_settings USING btree (key)`

---

## ðï¸ Table: `settings`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 32 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **key** | `text` | f | - | - |
| **value** | `text` | f | - | - |
| **description** | `text` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `key` | settings | key |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **settings_pkey**: `CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key)`

---

## ðï¸ Table: `billing_codes`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 48 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **code** | `character varying(50)` | f | - | - |
| **description** | `text` | f | - | - |
| **rate** | `numeric(10` | 2) | f | - |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | billing_codes | id |
| UNIQUE | `code` | billing_codes | code |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **billing_codes_pkey**: `CREATE UNIQUE INDEX billing_codes_pkey ON public.billing_codes USING btree (id)`
- **billing_codes_code_key**: `CREATE UNIQUE INDEX billing_codes_code_key ON public.billing_codes USING btree (code)`

---

## ðï¸ Table: `system_logs`

> _ Stores system events, errors, and operational logs with structured data_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 112 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | - | Unique identifier for the log entry |
| **timestamp** | `timestamp with time zone` | f | now() | When the event occurred |
| **severity** | `text` | f | - | Log severity level: INFO, WARN, ERROR, CRITICAL |
| **category** | `text` | f | - | Log category: RESOURCE, OPTIMIZATION, CONSTRAINT, SYSTEM, OPERATIONAL, FINANCIAL |
| **message** | `text` | f | - | Human-readable log message |
| **details** | `jsonb` | t | '{}'::jsonb | Additional structured details as JSON |
| **affected_entities** | `jsonb` | t | '[]'::jsonb | Array of entities affected by this event |
| **resolution_required** | `boolean` | f | false | Whether this log requires operator resolution |
| **resolution_suggestions** | `jsonb` | t | '[]'::jsonb | Suggested actions for resolution |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| CHECK | `` | system_logs | severity |
| CHECK | `` | system_logs | category |
| PRIMARY KEY | `id` | system_logs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **system_logs_pkey**: `CREATE UNIQUE INDEX system_logs_pkey ON public.system_logs USING btree (id)`
- **idx_system_logs_timestamp**: `CREATE INDEX idx_system_logs_timestamp ON public.system_logs USING btree ("timestamp" DESC)`
- **idx_system_logs_severity**: `CREATE INDEX idx_system_logs_severity ON public.system_logs USING btree (severity)`
- **idx_system_logs_category**: `CREATE INDEX idx_system_logs_category ON public.system_logs USING btree (category)`
- **idx_system_logs_resolution_required**: `CREATE INDEX idx_system_logs_resolution_required ON public.system_logs USING btree (resolution_required) WHERE (resolution_required = true)`
- **idx_system_logs_timestamp_severity**: `CREATE INDEX idx_system_logs_timestamp_severity ON public.system_logs USING btree ("timestamp" DESC, severity)`

---

## ðï¸ Table: `schedule`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 32 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **program_id** | `uuid` | f | - | - |
| **scheduled_date** | `date` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | schedule | id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `venue_id` | venues | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **schedule_pkey**: `CREATE UNIQUE INDEX schedule_pkey ON public.schedule USING btree (id)`
- **idx_schedule_program**: `CREATE INDEX idx_schedule_program ON public.schedule USING btree (program_id)`
- **idx_schedule_date**: `CREATE INDEX idx_schedule_date ON public.schedule USING btree (scheduled_date)`

---

## ðï¸ Table: `vehicles`

> _ Stores vehicle information including make, model, fuel type, and accessibility features_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 112 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **name** | `character varying(100)` | f | - | - |
| **registration** | `character varying(20)` | f | - | - |
| **capacity** | `integer` | f | - | - |
| **wheelchair_capacity** | `integer` | f | 0 | - |
| **make** | `character varying(50)` | t | - | Vehicle manufacturer (e.g., Toyota, Renault) |
| **model** | `character varying(50)` | t | - | Vehicle model (e.g., Hiace, Koleos) |
| **year** | `integer` | t | - | Year the vehicle was manufactured |
| **active** | `boolean` | f | true | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **location_lat** | `numeric(10` | 8) | t | - |
| **location_lng** | `numeric(11` | 8) | t | - |
| **status** | `character varying(50)` | f | 'active'::character varying | - |
| **vin_number** | `text` | t | - | Vehicle Identification Number |
| **engine_number** | `text` | t | - | Engine serial number |
| **registration_expiry** | `date` | t | - | Date when vehicle registration expires |
| **fuel_type** | `text` | t | - | Type of fuel: Diesel, Petrol, Electric, Hybrid, etc. |
| **location** | `text` | t | - | Where the vehicle is typically parked/stored |
| **max_height** | `numeric(3` | 1) | t | ,Maximum vehicle height in meters |
| **wheelchair_accessible** | `boolean` | t | false | Whether the vehicle has wheelchair access |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| CHECK | `` | vehicles | status |
| PRIMARY KEY | `id` | vehicles | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_vehicles_status**: `CREATE INDEX idx_vehicles_status ON public.vehicles USING btree (status)`
- **idx_vehicles_fuel_type**: `CREATE INDEX idx_vehicles_fuel_type ON public.vehicles USING btree (fuel_type)`
- **idx_vehicles_make_model**: `CREATE INDEX idx_vehicles_make_model ON public.vehicles USING btree (make, model)`
- **vehicles_pkey**: `CREATE UNIQUE INDEX vehicles_pkey ON public.vehicles USING btree (id)`
- **idx_vehicles_registration**: `CREATE INDEX idx_vehicles_registration ON public.vehicles USING btree (registration)`
- **idx_vehicles_location**: `CREATE INDEX idx_vehicles_location ON public.vehicles USING btree (location_lat, location_lng)`

---

## ðï¸ Table: `staff`

> _ _

- **Estimated Rows**: `        58`
- **Estimated Disk Size**: ` 168 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **first_name** | `character varying(100)` | f | - | - |
| **last_name** | `character varying(100)` | f | - | - |
| **position** | `character varying(100)` | t | - | - |
| **email** | `character varying(100)` | t | - | - |
| **phone** | `character varying(20)` | t | - | - |
| **address** | `text` | t | - | - |
| **suburb** | `character varying(100)` | t | - | - |
| **state** | `character varying(50)` | t | - | - |
| **postcode** | `character varying(10)` | t | - | - |
| **qualifications** | `text` | t | - | - |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **photo_url** | `text` | t | - | - |
| **location_lat** | `numeric(10` | 8) | t | - |
| **location_lng** | `numeric(11` | 8) | t | - |
| **status** | `character varying(50)` | f | 'active'::character varying | - |
| **contracted_hours** | `numeric(5` | 2) | t | ,Number of hours per week a staff member is contracted for (e.g., 38.0, 20.5) |
| **base_pay_rate** | `numeric(8` | 2) | t | ,Hourly pay rate in dollars for the staff member (e.g., 28.50, 42.75) |
| **schads_level** | `integer` | t | 2 | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | staff | id |
| CHECK | `` | staff | status |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_staff_status**: `CREATE INDEX idx_staff_status ON public.staff USING btree (status)`
- **staff_pkey**: `CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id)`
- **idx_staff_name**: `CREATE INDEX idx_staff_name ON public.staff USING btree (last_name, first_name)`
- **idx_staff_location**: `CREATE INDEX idx_staff_location ON public.staff USING btree (location_lat, location_lng)`
- **idx_staff_contracted_hours**: `CREATE INDEX idx_staff_contracted_hours ON public.staff USING btree (contracted_hours)`
- **idx_staff_pay_rate**: `CREATE INDEX idx_staff_pay_rate ON public.staff USING btree (base_pay_rate)`
- **idx_staff_financial**: `CREATE INDEX idx_staff_financial ON public.staff USING btree (base_pay_rate, contracted_hours)`

---

## ðï¸ Table: `programs`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 112 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **name** | `character varying(100)` | f | - | - |
| **description** | `text` | t | - | - |
| **day_of_week** | `integer` | t | - | DEPRECATED: Use days_of_week JSONB array instead |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **capacity** | `integer` | t | - | - |
| **recurring** | `boolean` | f | true | DEPRECATED: Use repeat_pattern instead (none = false, anything else = true) |
| **active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **status** | `character varying(50)` | f | 'active'::character varying | - |
| **program_type** | `character varying(50)` | t | 'community_access'::character varying | Type of program (community_access, training, etc.) |
| **start_date** | `date` | f | CURRENT_DATE | Date when program starts |
| **end_date** | `date` | t | - | Date when program ends (NULL = no end date) |
| **repeat_pattern** | `character varying(20)` | t | 'weekly'::character varying | How program repeats: none (one-off), weekly, fortnightly, monthly |
| **time_slots** | `jsonb` | t | '[]'::jsonb | Array of time slots with activities for dashboard cards |
| **notes** | `text` | t | - | - |
| **staff_assignment_mode** | `character varying(20)` | t | 'auto'::character varying | How staff are assigned: auto (by loom) or manual (fixed) |
| **additional_staff_count** | `integer` | t | 0 | Extra staff beyond the 1:4 ratio |
| **created_by** | `text` | t | - | - |
| **days_of_week** | `jsonb` | t | '[]'::jsonb | Array of days this program runs on (0=Sunday, 1=Monday, etc.) |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | programs | id |
| FOREIGN KEY | `venue_id` | venues | id |
| CHECK | `` | programs | status |
| CHECK | `` | programs | repeat_pattern |
| CHECK | `` | programs | staff_assignment_mode |
| CHECK | `` | programs | end_date |
| CHECK | `` | programs | start_date |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_programs_status**: `CREATE INDEX idx_programs_status ON public.programs USING btree (status)`
- **idx_programs_dates**: `CREATE INDEX idx_programs_dates ON public.programs USING btree (start_date, end_date)`
- **idx_programs_active**: `CREATE INDEX idx_programs_active ON public.programs USING btree (active)`
- **programs_pkey**: `CREATE UNIQUE INDEX programs_pkey ON public.programs USING btree (id)`
- **idx_programs_day_time**: `CREATE INDEX idx_programs_day_time ON public.programs USING btree (day_of_week, start_time)`
- **idx_programs_venue**: `CREATE INDEX idx_programs_venue ON public.programs USING btree (venue_id)`

---

## ðï¸ Table: `tgl_loom_staff_shifts`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 48 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **loom_instance_id** | `uuid` | f | - | - |
| **staff_id** | `uuid` | f | - | - |
| **role** | `staff_role` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **status** | `staff_shift_status` | f | 'planned'::staff_shift_status | - |
| **manually_assigned** | `boolean` | f | false | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_staff_shifts | id |
| FOREIGN KEY | `loom_instance_id` | tgl_loom_instances | id |
| FOREIGN KEY | `staff_id` | staff | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_loom_staff_shifts_pkey**: `CREATE UNIQUE INDEX tgl_loom_staff_shifts_pkey ON public.tgl_loom_staff_shifts USING btree (id)`
- **idx_loom_staff_shifts_instance**: `CREATE INDEX idx_loom_staff_shifts_instance ON public.tgl_loom_staff_shifts USING btree (loom_instance_id)`
- **idx_loom_staff_shifts_staff**: `CREATE INDEX idx_loom_staff_shifts_staff ON public.tgl_loom_staff_shifts USING btree (staff_id)`
- **idx_loom_staff_shifts_status**: `CREATE INDEX idx_loom_staff_shifts_status ON public.tgl_loom_staff_shifts USING btree (status)`
- **idx_loom_staff_shifts_timerange**: `CREATE INDEX idx_loom_staff_shifts_timerange ON public.tgl_loom_staff_shifts USING btree (start_time, end_time)`

---

## ðï¸ Table: `tgl_loom_audit_log`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 120 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **action_type** | `character varying(50)` | f | - | - |
| **entity_type** | `character varying(50)` | f | - | - |
| **entity_id** | `uuid` | f | - | - |
| **user_id** | `character varying(100)` | t | - | - |
| **previous_state** | `jsonb` | t | - | - |
| **new_state** | `jsonb` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **action** | `character varying(100)` | f | 'system_event'::character varying | - |
| **category** | `character varying(50)` | t | 'system'::character varying | - |
| **severity** | `character varying(20)` | t | 'info'::character varying | - |
| **timestamp** | `timestamp with time zone` | t | CURRENT_TIMESTAMP | - |
| **related_entity_id** | `uuid` | t | - | - |
| **related_entity_type** | `character varying(50)` | t | - | - |
| **details** | `jsonb` | t | '{}'::jsonb | - |
| **message** | `text` | t | - | - |
| **status** | `character varying(20)` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_audit_log | id |
| CHECK | `` | tgl_loom_audit_log | severity |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_tgl_loom_audit_log_action**: `CREATE INDEX idx_tgl_loom_audit_log_action ON public.tgl_loom_audit_log USING btree (action)`
- **idx_audit_log_entity**: `CREATE INDEX idx_audit_log_entity ON public.tgl_loom_audit_log USING btree (related_entity_type, related_entity_id)`
- **idx_audit_log_severity_timestamp**: `CREATE INDEX idx_audit_log_severity_timestamp ON public.tgl_loom_audit_log USING btree (severity, "timestamp")`
- **idx_tgl_loom_audit_log_details_gin**: `CREATE INDEX idx_tgl_loom_audit_log_details_gin ON public.tgl_loom_audit_log USING gin (details)`
- **idx_tgl_loom_audit_log_user**: `CREATE INDEX idx_tgl_loom_audit_log_user ON public.tgl_loom_audit_log USING btree (user_id)`
- **tgl_loom_audit_log_pkey**: `CREATE UNIQUE INDEX tgl_loom_audit_log_pkey ON public.tgl_loom_audit_log USING btree (id)`

---

## ðï¸ Table: `tgl_loom_time_slots`

> _ Stores time slots for dashboard cards_

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 64 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **instance_id** | `uuid` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **label** | `text` | f | - | Display label for the card |
| **card_type** | `tgl_card_type` | f | 'ACTIVITY'::tgl_card_type | Type of card: PICKUP, ACTIVITY, DROPOFF, PROGRAM |
| **details** | `jsonb` | t | - | Additional card-specific details as JSON |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **program_id** | `uuid` | t | - | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_time_slots | id |
| FOREIGN KEY | `instance_id` | tgl_loom_instances | id |
| FOREIGN KEY | `program_id` | programs | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **tgl_loom_time_slots_pkey**: `CREATE UNIQUE INDEX tgl_loom_time_slots_pkey ON public.tgl_loom_time_slots USING btree (id)`
- **idx_time_slots_instance**: `CREATE INDEX idx_time_slots_instance ON public.tgl_loom_time_slots USING btree (instance_id)`
- **idx_time_slots_card_type**: `CREATE INDEX idx_time_slots_card_type ON public.tgl_loom_time_slots USING btree (card_type)`

---

## ðï¸ Table: `tgl_loom_instances`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 136 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **program_id** | `uuid` | f | - | - |
| **instance_date** | `date` | f | - | - |
| **start_time** | `time without time zone` | f | - | - |
| **end_time** | `time without time zone` | f | - | - |
| **venue_id** | `uuid` | t | - | - |
| **status** | `loom_instance_status` | f | 'draft'::loom_instance_status | - |
| **participants_count** | `integer` | f | 0 | - |
| **staff_count** | `integer` | f | 0 | - |
| **manually_modified** | `boolean` | f | false | - |
| **notes** | `text` | t | - | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |
| **data_json** | `jsonb` | t | '{}'::jsonb | - |
| **date** | `date` | f | CURRENT_DATE | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | tgl_loom_instances | id |
| UNIQUE | `program_id` | tgl_loom_instances | instance_date |
| UNIQUE | `program_id` | tgl_loom_instances | program_id |
| UNIQUE | `instance_date` | tgl_loom_instances | instance_date |
| UNIQUE | `instance_date` | tgl_loom_instances | program_id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `venue_id` | venues | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **idx_tgl_loom_instances_status**: `CREATE INDEX idx_tgl_loom_instances_status ON public.tgl_loom_instances USING btree (status)`
- **idx_tgl_loom_instances_data_gin**: `CREATE INDEX idx_tgl_loom_instances_data_gin ON public.tgl_loom_instances USING gin (data_json)`
- **tgl_loom_instances_pkey**: `CREATE UNIQUE INDEX tgl_loom_instances_pkey ON public.tgl_loom_instances USING btree (id)`
- **tgl_loom_instances_program_id_instance_date_key**: `CREATE UNIQUE INDEX tgl_loom_instances_program_id_instance_date_key ON public.tgl_loom_instances USING btree (program_id, instance_date)`
- **idx_loom_instances_program**: `CREATE INDEX idx_loom_instances_program ON public.tgl_loom_instances USING btree (program_id)`
- **idx_loom_instances_date**: `CREATE INDEX idx_loom_instances_date ON public.tgl_loom_instances USING btree (instance_date)`
- **idx_loom_instances_status**: `CREATE INDEX idx_loom_instances_status ON public.tgl_loom_instances USING btree (status)`

---

## ðï¸ Table: `participant_billing_codes`

> _ _

- **Estimated Rows**: `        -1`
- **Estimated Disk Size**: ` 16 kB`

### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| **id** | `uuid` | f | gen_random_uuid() | - |
| **program_id** | `uuid` | f | - | - |
| **participant_id** | `uuid` | f | - | - |
| **billing_code** | `text` | f | - | - |
| **hours** | `numeric(5` | 2) | f | 0 |
| **start_date** | `date` | f | - | - |
| **end_date** | `date` | t | - | - |
| **is_active** | `boolean` | f | true | - |
| **created_at** | `timestamp with time zone` | f | now() | - |
| **updated_at** | `timestamp with time zone` | f | now() | - |

### Constraints

| Type | Column | Ref Table | Ref Column |
|------|--------|-----------|------------|
| PRIMARY KEY | `id` | participant_billing_codes | id |
| FOREIGN KEY | `program_id` | programs | id |
| FOREIGN KEY | `participant_id` | participants | id |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |
| CHECK | `` | - | - |

### Indexes

- **participant_billing_codes_pkey**: `CREATE UNIQUE INDEX participant_billing_codes_pkey ON public.participant_billing_codes USING btree (id)`

---

## ð§¬ ENUM Types

- **`allocation_status`**: planned, attended, cancelled, no_show
- **`cancellation_type`**: participant_request, medical, program_change, staff_shortage, venue_issue, transportation_issue, weather, other
- **`loom_actor`**: loom_engine, human
- **`loom_instance_status`**: draft, planned, staffed, transport_assigned, ready, in_progress, completed, cancelled, needs_attention
- **`plan_management_enum`**: plan_managed, self_managed, agency_managed, self_funded
- **`staff_role`**: lead, support, specialist, driver
- **`staff_shift_status`**: planned, confirmed, completed, sick, cancelled
- **`tgl_card_type`**: PICKUP, ACTIVITY, DROPOFF, PROGRAM
- **`tgl_exception_type`**: participant_absence, staff_absence, venue_unavailable, program_cancellation, program_reschedule, transport_change, billing_exception, note
- **`tgl_intent_type`**: participant_enrollment, participant_departure, program_transfer, staff_assignment, venue_change, program_modification, billing_code_change, resource_requirement, CREATE_PROGRAM
- **`vehicle_run_status`**: planned, confirmed
