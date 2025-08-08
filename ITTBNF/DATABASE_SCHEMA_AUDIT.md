# Database Schema Audit

_Generated on 2025-08-05_

## Database Overview

Total tables: 43

## Enum Types

### allocation_status

```
planned, attended, cancelled, no_show
```

### cancellation_type

```
participant_request, medical, program_change, staff_shortage, venue_issue, transportation_issue, weather, other
```

### loom_actor

```
loom_engine, human
```

### loom_instance_status

```
draft, planned, staffed, transport_assigned, ready, in_progress, completed, cancelled, needs_attention
```

### plan_management_enum

```
plan_managed, self_managed, agency_managed, self_funded
```

### staff_role

```
lead, support, specialist, driver
```

### staff_shift_status

```
planned, confirmed, completed, sick, cancelled
```

### tgl_card_type

```
PICKUP, ACTIVITY, DROPOFF, PROGRAM
```

### tgl_exception_type

```
participant_absence, staff_absence, venue_unavailable, program_cancellation, program_reschedule, transport_change, billing_exception, note
```

### tgl_intent_type

```
participant_enrollment, participant_departure, program_transfer, staff_assignment, venue_change, program_modification, billing_code_change, resource_requirement, CREATE_PROGRAM
```

### vehicle_run_status

```
planned, confirmed
```

## Tables

### billing_codes

**Type:** BASE TABLE

**Row count:** 8

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| code | character varying | 50 | NO |  |
| description | text |  | NO |  |
| rate | numeric |  | NO |  |
| active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: billing_codes_pkey
- Columns: id

#### Unique Constraints

- billing_codes_code_key: code

#### Indexes

- billing_codes_code_key (UNIQUE): code
- billing_codes_pkey (PRIMARY KEY): id

---

### change_log

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| change_date | timestamp with time zone |  | NO | now() |
| change_type | text |  | NO |  |
| description | text |  | NO |  |
| participant_id | uuid |  | YES |  |
| billing_impact | boolean |  | NO | false |
| billing_status | text |  | NO | 'NA'::text |

#### Primary Key

- Constraint Name: change_log_pkey
- Columns: id

#### Indexes

- change_log_pkey (PRIMARY KEY): id
- idx_change_log_billing_impact (INDEX): billing_impact
- idx_change_log_billing_status (INDEX): billing_status
- idx_change_log_participant_date (INDEX): change_date, participant_id
- idx_change_log_participant_type (INDEX): change_type, participant_id

---

### event_card_map

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| loom_instance_id | uuid |  | NO |  |
| card_type | text |  | NO |  |
| card_order | integer |  | NO |  |
| display_title | text |  | NO |  |
| display_subtitle | text |  | YES |  |
| display_time_start | timestamp with time zone |  | NO |  |
| display_time_end | timestamp with time zone |  | NO |  |
| card_color | text |  | YES |  |
| card_icon | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: event_card_map_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| event_card_map_loom_instance_id_fkey | loom_instance_id | loom_instances | id |

#### Indexes

- event_card_map_pkey (PRIMARY KEY): id
- idx_event_card_map_loom (INDEX): loom_instance_id

---

### history_pinned_artifacts

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| history_shift_id | uuid |  | NO |  |
| artifact_type | text |  | NO |  |
| title | text |  | NO |  |
| content | text |  | YES |  |
| severity | text |  | YES |  |
| created_by | text |  | NO |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| embedding | USER-DEFINED |  | YES |  |

#### Primary Key

- Constraint Name: history_pinned_artifacts_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| history_pinned_artifacts_history_shift_id_fkey | history_shift_id | history_ribbon_shifts | id |

#### Indexes

- history_pinned_artifacts_pkey (PRIMARY KEY): id
- idx_history_pinned_artifacts_type (INDEX): artifact_type

---

### history_ribbon_participants

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| history_shift_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| participant_name | text |  | NO |  |
| attendance_status | text |  | NO |  |
| pickup_provided | boolean |  | YES |  |
| dropoff_provided | boolean |  | YES |  |
| notes | text |  | YES |  |

#### Primary Key

- Constraint Name: history_ribbon_participants_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| history_ribbon_participants_history_shift_id_fkey | history_shift_id | history_ribbon_shifts | id |

#### Indexes

- history_ribbon_participants_pkey (PRIMARY KEY): id

---

### history_ribbon_shifts

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| original_loom_id | uuid |  | NO |  |
| program_name | text |  | NO |  |
| program_description | text |  | YES |  |
| instance_date | date |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_name | text |  | NO |  |
| venue_address | text |  | YES |  |
| participant_count | integer |  | NO |  |
| staff_count | integer |  | NO |  |
| vehicle_count | integer |  | NO |  |
| completion_status | text |  | NO |  |
| woven_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| archived | boolean |  | YES | false |

#### Primary Key

- Constraint Name: history_ribbon_shifts_pkey
- Columns: id

#### Indexes

- history_ribbon_shifts_pkey (PRIMARY KEY): id
- idx_history_ribbon_date (INDEX): instance_date

---

### history_ribbon_staff

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| history_shift_id | uuid |  | NO |  |
| staff_id | uuid |  | NO |  |
| staff_name | text |  | NO |  |
| role | text |  | NO |  |
| hours_worked | numeric |  | NO |  |
| notes | text |  | YES |  |

#### Primary Key

- Constraint Name: history_ribbon_staff_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| history_ribbon_staff_history_shift_id_fkey | history_shift_id | history_ribbon_shifts | id |

#### Indexes

- history_ribbon_staff_pkey (PRIMARY KEY): id

---

### history_ribbon_tags

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| history_shift_id | uuid |  | NO |  |
| tag_key | text |  | NO |  |
| tag_value | text |  | NO |  |
| embedding | USER-DEFINED |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: history_ribbon_tags_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| history_ribbon_tags_history_shift_id_fkey | history_shift_id | history_ribbon_shifts | id |

#### Indexes

- history_ribbon_tags_pkey (PRIMARY KEY): id
- idx_history_ribbon_tags_embedding (INDEX): embedding

---

### loom_instances

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| source_rule_id | uuid |  | NO |  |
| instance_date | date |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| transport_required | boolean |  | YES | true |
| staffing_ratio | text |  | YES | '1:4'::text |
| is_overridden | boolean |  | YES | false |
| override_source | text |  | YES |  |
| override_reason | text |  | YES |  |
| quality_audit_flag | boolean |  | YES | false |
| projection_hash | text |  | YES |  |
| projected_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: loom_instances_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| loom_instances_source_rule_id_fkey | source_rule_id | rules_programs | id |

#### Unique Constraints

- loom_instances_source_rule_id_instance_date_key: source_rule_id, instance_date

#### Indexes

- loom_instances_pkey (PRIMARY KEY): id
- loom_instances_source_rule_id_instance_date_key (UNIQUE): source_rule_id, instance_date

---

### loom_participant_attendance

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| loom_instance_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| source_rule_id | uuid |  | YES |  |
| status | text |  | NO | 'confirmed'::text |
| is_overridden | boolean |  | YES | false |
| override_source | text |  | YES |  |
| override_reason | text |  | YES |  |
| pickup_required | boolean |  | YES | true |
| dropoff_required | boolean |  | YES | true |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: loom_participant_attendance_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| loom_participant_attendance_loom_instance_id_fkey | loom_instance_id | loom_instances | id |
| loom_participant_attendance_source_rule_id_fkey | source_rule_id | rules_participant_schedule | id |

#### Unique Constraints

- loom_participant_attendance_loom_instance_id_participant_id_key: loom_instance_id, participant_id

#### Indexes

- loom_participant_attendance_loom_instance_id_participant_id_key (UNIQUE): loom_instance_id, participant_id
- loom_participant_attendance_pkey (PRIMARY KEY): id

---

### loom_staff_assignments

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| loom_instance_id | uuid |  | NO |  |
| staff_id | uuid |  | NO |  |
| source_rule_id | uuid |  | YES |  |
| role | text |  | NO | 'support'::text |
| is_overridden | boolean |  | YES | false |
| override_source | text |  | YES |  |
| override_reason | text |  | YES |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: loom_staff_assignments_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| loom_staff_assignments_loom_instance_id_fkey | loom_instance_id | loom_instances | id |
| loom_staff_assignments_source_rule_id_fkey | source_rule_id | rules_staff_roster | id |

#### Unique Constraints

- loom_staff_assignments_loom_instance_id_staff_id_key: loom_instance_id, staff_id

#### Indexes

- loom_staff_assignments_loom_instance_id_staff_id_key (UNIQUE): loom_instance_id, staff_id
- loom_staff_assignments_pkey (PRIMARY KEY): id

---

### loom_vehicle_assignments

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| loom_instance_id | uuid |  | NO |  |
| vehicle_id | uuid |  | NO |  |
| driver_staff_id | uuid |  | YES |  |
| is_overridden | boolean |  | YES | false |
| override_source | text |  | YES |  |
| override_reason | text |  | YES |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: loom_vehicle_assignments_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| loom_vehicle_assignments_loom_instance_id_fkey | loom_instance_id | loom_instances | id |

#### Unique Constraints

- loom_vehicle_assignments_loom_instance_id_vehicle_id_key: loom_instance_id, vehicle_id

#### Indexes

- loom_vehicle_assignments_loom_instance_id_vehicle_id_key (UNIQUE): loom_instance_id, vehicle_id
- loom_vehicle_assignments_pkey (PRIMARY KEY): id

---

### master_schedule_items

**Type:** BASE TABLE

**Row count:** 14

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| program_name | text |  | NO |  |
| date | date |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| participant_count | integer |  | YES | 0 |
| supervision_multiplier | numeric |  | YES | 1.0 |
| status | text |  | YES | 'scheduled'::text |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: master_schedule_items_pkey
- Columns: id

#### Indexes

- master_schedule_items_pkey (PRIMARY KEY): id

---

### migrations

**Type:** BASE TABLE

**Row count:** 4

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | integer |  | NO | nextval('migrations_id_seq'::regclass) |
| name | text |  | NO |  |
| applied_at | timestamp without time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: migrations_pkey
- Columns: id

#### Unique Constraints

- migrations_name_key: name

#### Indexes

- migrations_name_key (UNIQUE): name
- migrations_pkey (PRIMARY KEY): id

---

### participant_billing_codes

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| program_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| billing_code | text |  | NO |  |
| hours | numeric |  | NO | 0 |
| start_date | date |  | NO |  |
| end_date | date |  | YES |  |
| is_active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: participant_billing_codes_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| participant_billing_codes_program_id_fkey | program_id | programs | id |
| participant_billing_codes_participant_id_fkey | participant_id | participants | id |

#### Indexes

- participant_billing_codes_pkey (PRIMARY KEY): id

---

### participants

**Type:** BASE TABLE

**Row count:** 120

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| first_name | character varying | 100 | NO |  |
| last_name | character varying | 100 | NO |  |
| date_of_birth | date |  | YES |  |
| ndis_number | character varying | 50 | YES |  |
| address | text |  | YES |  |
| suburb | character varying | 100 | YES |  |
| state | character varying | 50 | YES |  |
| postcode | character varying | 10 | YES |  |
| phone | character varying | 20 | YES |  |
| email | character varying | 100 | YES |  |
| emergency_contact_name | character varying | 100 | YES |  |
| emergency_contact_phone | character varying | 20 | YES |  |
| notes | text |  | YES |  |
| active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| photo_url | text |  | YES |  |
| location_lat | numeric |  | YES |  |
| location_lng | numeric |  | YES |  |
| supervision_multiplier | numeric |  | NO | 1.0 |
| ndis_plan_start | date |  | YES |  |
| ndis_plan_end | date |  | YES |  |
| ndis_plan_budget | numeric |  | YES |  |
| requires_wheelchair | boolean |  | YES | false |
| requires_transport | boolean |  | YES | false |
| gender | character varying | 20 | YES |  |
| plan_management_type | USER-DEFINED |  | NO | 'agency_managed'::plan_management_enum |
| plan_manager_name | character varying | 100 | YES |  |
| plan_manager_email | character varying | 100 | YES |  |
| plan_manager_phone | character varying | 20 | YES |  |
| support_coordinator_name | character varying | 100 | YES |  |
| support_coordinator_email | character varying | 100 | YES |  |
| support_coordinator_phone | character varying | 20 | YES |  |
| guardian_name | character varying | 100 | YES |  |
| guardian_relationship | character varying | 50 | YES |  |
| guardian_contact | character varying | 100 | YES |  |
| has_behavior_support_plan | boolean |  | YES | false |
| has_medical_plan | boolean |  | YES | false |
| allergies | text |  | YES |  |
| medication_needs | text |  | YES |  |
| mobility_needs | text |  | YES |  |
| communication_needs | text |  | YES |  |
| photo_consent | boolean |  | YES | false |
| transport_consent | boolean |  | YES | false |
| medication_consent | boolean |  | YES | false |
| has_wheelchair_access | boolean |  | NO | false |
| has_dietary_requirements | boolean |  | NO | false |
| has_medical_requirements | boolean |  | NO | false |
| has_behavioral_support | boolean |  | NO | false |
| has_visual_impairment | boolean |  | NO | false |
| has_hearing_impairment | boolean |  | NO | false |
| has_cognitive_support | boolean |  | NO | false |
| has_communication_needs | boolean |  | NO | false |

#### Primary Key

- Constraint Name: participants_pkey
- Columns: id

#### Indexes

- idx_participant_ndis_number (INDEX): ndis_number
- idx_participant_plan_management (INDEX): plan_management_type
- idx_participant_support_flags (INDEX): has_wheelchair_access, has_dietary_requirements, has_medical_requirements, has_behavioral_support, has_visual_impairment, has_hearing_impairment, has_cognitive_support, has_communication_needs
- idx_participants_location (INDEX): location_lat, location_lng
- idx_participants_name (INDEX): first_name, last_name
- idx_participants_ndis (INDEX): ndis_number
- participants_pkey (PRIMARY KEY): id

---

### payment_diamonds

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| history_shift_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| support_item_number | text |  | NO |  |
| unit_price | numeric |  | NO |  |
| quantity | numeric |  | NO |  |
| total_amount | numeric |  | NO |  |
| gst_code | text |  | NO |  |
| status | text |  | NO | 'completed'::text |
| invoice_number | text |  | YES |  |
| invoice_date | date |  | YES |  |
| payment_date | date |  | YES |  |
| retention_end_date | date |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: payment_diamonds_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| payment_diamonds_history_shift_id_fkey | history_shift_id | history_ribbon_shifts | id |

#### Indexes

- idx_payment_diamonds_status (INDEX): status
- payment_diamonds_pkey (PRIMARY KEY): id

---

### pending_enrollment_changes

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| participant_id | uuid |  | NO |  |
| program_id | uuid |  | NO |  |
| action | text |  | NO |  |
| effective_date | date |  | NO |  |
| status | text |  | YES | 'pending'::text |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: pending_enrollment_changes_pkey
- Columns: id

#### Indexes

- idx_pending_changes_effective_date (INDEX): effective_date
- idx_pending_changes_status (INDEX): status
- idx_pending_enrollment_changes_status (INDEX): status
- pending_enrollment_changes_pkey (PRIMARY KEY): id

---

### program_enrollments

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| participant_id | uuid |  | NO |  |
| program_id | uuid |  | NO |  |
| start_date | date |  | NO |  |
| end_date | date |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: program_enrollments_pkey
- Columns: id

#### Unique Constraints

- program_enrollments_participant_id_program_id_start_date_key: participant_id, program_id, start_date

#### Indexes

- idx_program_enrollments_dates (INDEX): start_date, end_date
- idx_program_enrollments_participant (INDEX): participant_id
- idx_program_enrollments_program (INDEX): program_id
- program_enrollments_participant_id_program_id_start_date_key (UNIQUE): participant_id, program_id, start_date
- program_enrollments_pkey (PRIMARY KEY): id

---

### program_participants

**Type:** BASE TABLE

**Row count:** 2

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| program_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| billing_code_id | uuid |  | YES |  |
| start_date | date |  | YES |  |
| end_date | date |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| status | text |  | NO | 'active'::text |

#### Primary Key

- Constraint Name: program_participants_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| program_participants_program_id_fkey | program_id | programs | id |
| program_participants_participant_id_fkey | participant_id | participants | id |
| program_participants_billing_code_id_fkey | billing_code_id | billing_codes | id |

#### Unique Constraints

- program_participants_program_id_participant_id_key: program_id, participant_id

#### Indexes

- idx_program_participants_dates (INDEX): start_date, end_date
- idx_program_participants_participant (INDEX): participant_id
- idx_program_participants_program (INDEX): program_id
- idx_program_participants_status (INDEX): status
- program_participants_pkey (PRIMARY KEY): id
- program_participants_program_id_participant_id_key (UNIQUE): program_id, participant_id

---

### programs

**Type:** BASE TABLE

**Row count:** 2

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| name | character varying | 100 | NO |  |
| description | text |  | YES |  |
| day_of_week | integer |  | YES |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| capacity | integer |  | YES |  |
| recurring | boolean |  | NO | true |
| active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| status | character varying | 50 | NO | 'active'::character varying |
| program_type | character varying | 50 | YES | 'community_access'::character varying |
| start_date | date |  | NO | CURRENT_DATE |
| end_date | date |  | YES |  |
| repeat_pattern | character varying | 20 | YES | 'weekly'::character varying |
| time_slots | jsonb |  | YES | '[]'::jsonb |
| notes | text |  | YES |  |
| staff_assignment_mode | character varying | 20 | YES | 'auto'::character varying |
| additional_staff_count | integer |  | YES | 0 |
| created_by | text |  | YES |  |
| days_of_week | jsonb |  | YES | '[]'::jsonb |

#### Primary Key

- Constraint Name: programs_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| programs_venue_id_fkey | venue_id | venues | id |

#### Check Constraints

- programs_status_check: `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'completed'::character varying, 'draft'::character varying, 'pending'::character varying])::text[])))`
- valid_repeat_pattern: `CHECK (((repeat_pattern)::text = ANY ((ARRAY['none'::character varying, 'weekly'::character varying, 'fortnightly'::character varying, 'monthly'::character varying])::text[])))`
- valid_staff_assignment_mode: `CHECK (((staff_assignment_mode)::text = ANY ((ARRAY['auto'::character varying, 'manual'::character varying])::text[])))`
- valid_program_dates: `CHECK (((end_date IS NULL) OR (end_date >= start_date)))`

#### Indexes

- idx_programs_active (INDEX): active
- idx_programs_dates (INDEX): start_date, end_date
- idx_programs_day_time (INDEX): day_of_week, start_time
- idx_programs_status (INDEX): status
- idx_programs_venue (INDEX): venue_id
- programs_pkey (PRIMARY KEY): id

---

### rules_participant_schedule

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| participant_id | uuid |  | NO |  |
| program_id | uuid |  | NO |  |
| start_date | date |  | NO |  |
| end_date | date |  | YES |  |
| pickup_required | boolean |  | YES | true |
| dropoff_required | boolean |  | YES | true |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: rules_participant_schedule_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| rules_participant_schedule_program_id_fkey | program_id | rules_programs | id |

#### Unique Constraints

- rules_participant_schedule_participant_id_program_id_start__key: participant_id, program_id, start_date

#### Indexes

- rules_participant_schedule_participant_id_program_id_start__key (UNIQUE): participant_id, program_id, start_date
- rules_participant_schedule_pkey (PRIMARY KEY): id

---

### rules_program_exceptions

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| program_id | uuid |  | NO |  |
| exception_date | date |  | NO |  |
| exception_type | text |  | NO |  |
| start_time | time without time zone |  | YES |  |
| end_time | time without time zone |  | YES |  |
| venue_id | uuid |  | YES |  |
| reason | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: rules_program_exceptions_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| rules_program_exceptions_program_id_fkey | program_id | rules_programs | id |

#### Unique Constraints

- rules_program_exceptions_program_id_exception_date_key: program_id, exception_date

#### Indexes

- rules_program_exceptions_pkey (PRIMARY KEY): id
- rules_program_exceptions_program_id_exception_date_key (UNIQUE): program_id, exception_date

---

### rules_programs

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| name | text |  | NO |  |
| description | text |  | YES |  |
| day_of_week | integer |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| is_recurring | boolean |  | YES | true |
| recurrence_pattern | text |  | YES | 'weekly'::text |
| transport_required | boolean |  | YES | true |
| staffing_ratio | text |  | YES | '1:4'::text |
| active | boolean |  | YES | true |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: rules_programs_pkey
- Columns: id

#### Indexes

- rules_programs_pkey (PRIMARY KEY): id

---

### rules_staff_roster

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | uuid_generate_v4() |
| staff_id | uuid |  | NO |  |
| program_id | uuid |  | NO |  |
| role | text |  | NO | 'support'::text |
| start_date | date |  | NO |  |
| end_date | date |  | YES |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |

#### Primary Key

- Constraint Name: rules_staff_roster_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| rules_staff_roster_program_id_fkey | program_id | rules_programs | id |

#### Unique Constraints

- rules_staff_roster_staff_id_program_id_start_date_key: staff_id, program_id, start_date

#### Indexes

- rules_staff_roster_pkey (PRIMARY KEY): id
- rules_staff_roster_staff_id_program_id_start_date_key (UNIQUE): staff_id, program_id, start_date

---

### schedule

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| program_id | uuid |  | NO |  |
| scheduled_date | date |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: schedule_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| schedule_program_id_fkey | program_id | programs | id |
| schedule_venue_id_fkey | venue_id | venues | id |

#### Indexes

- idx_schedule_date (INDEX): scheduled_date
- idx_schedule_program (INDEX): program_id
- schedule_pkey (PRIMARY KEY): id

---

### settings

**Type:** BASE TABLE

**Row count:** 4

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| key | text |  | NO |  |
| value | text |  | NO |  |
| description | text |  | YES |  |

#### Primary Key

- Constraint Name: settings_pkey
- Columns: key

#### Indexes

- settings_pkey (PRIMARY KEY): key

---

### staff

**Type:** BASE TABLE

**Row count:** 58

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| first_name | character varying | 100 | NO |  |
| last_name | character varying | 100 | NO |  |
| position | character varying | 100 | YES |  |
| email | character varying | 100 | YES |  |
| phone | character varying | 20 | YES |  |
| address | text |  | YES |  |
| suburb | character varying | 100 | YES |  |
| state | character varying | 50 | YES |  |
| postcode | character varying | 10 | YES |  |
| qualifications | text |  | YES |  |
| active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| photo_url | text |  | YES |  |
| location_lat | numeric |  | YES |  |
| location_lng | numeric |  | YES |  |
| status | character varying | 50 | NO | 'active'::character varying |
| contracted_hours | numeric |  | YES |  |
| base_pay_rate | numeric |  | YES |  |
| schads_level | integer |  | YES | 2 |

#### Primary Key

- Constraint Name: staff_pkey
- Columns: id

#### Check Constraints

- staff_status_check: `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'leave'::character varying, 'inactive'::character varying, 'terminated'::character varying, 'pending'::character varying])::text[])))`

#### Indexes

- idx_staff_contracted_hours (INDEX): contracted_hours
- idx_staff_financial (INDEX): contracted_hours, base_pay_rate
- idx_staff_location (INDEX): location_lat, location_lng
- idx_staff_name (INDEX): first_name, last_name
- idx_staff_pay_rate (INDEX): base_pay_rate
- idx_staff_status (INDEX): status
- staff_pkey (PRIMARY KEY): id

---

### staff_unavailabilities

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| staff_id | uuid |  | NO |  |
| start_time | timestamp with time zone |  | NO |  |
| end_time | timestamp with time zone |  | NO |  |
| reason | text |  | NO |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: staff_unavailabilities_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| staff_unavailabilities_staff_id_fkey | staff_id | staff | id |

#### Check Constraints

- valid_unavailability_timerange: `CHECK ((end_time > start_time))`

#### Indexes

- idx_staff_unavailabilities_active (INDEX): staff_id, start_time, end_time
- idx_staff_unavailabilities_staff (INDEX): staff_id
- idx_staff_unavailabilities_timerange (INDEX): start_time, end_time
- staff_unavailabilities_pkey (PRIMARY KEY): id

---

### system_logs

**Type:** BASE TABLE

**Row count:** 5

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO |  |
| timestamp | timestamp with time zone |  | NO | now() |
| severity | text |  | NO |  |
| category | text |  | NO |  |
| message | text |  | NO |  |
| details | jsonb |  | YES | '{}'::jsonb |
| affected_entities | jsonb |  | YES | '[]'::jsonb |
| resolution_required | boolean |  | NO | false |
| resolution_suggestions | jsonb |  | YES | '[]'::jsonb |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: system_logs_pkey
- Columns: id

#### Check Constraints

- system_logs_severity_check: `CHECK ((severity = ANY (ARRAY['INFO'::text, 'WARN'::text, 'ERROR'::text, 'CRITICAL'::text])))`
- system_logs_category_check: `CHECK ((category = ANY (ARRAY['RESOURCE'::text, 'OPTIMIZATION'::text, 'CONSTRAINT'::text, 'SYSTEM'::text, 'OPERATIONAL'::text, 'FINANCIAL'::text])))`

#### Indexes

- idx_system_logs_category (INDEX): category
- idx_system_logs_resolution_required (INDEX): resolution_required
- idx_system_logs_severity (INDEX): severity
- idx_system_logs_timestamp (INDEX): timestamp
- idx_system_logs_timestamp_severity (INDEX): timestamp, severity
- system_logs_pkey (PRIMARY KEY): id

---

### tgl_config

**Type:** BASE TABLE

**Row count:** 4

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| key | text |  | NO |  |
| value | text |  | NO |  |
| description | text |  | YES |  |
| updated_at | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| updated_by | text |  | YES |  |

#### Primary Key

- Constraint Name: tgl_config_pkey
- Columns: key

#### Indexes

- tgl_config_pkey (PRIMARY KEY): key

---

### tgl_loom_audit_log

**Type:** BASE TABLE

**Row count:** 4

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| action_type | character varying | 50 | NO |  |
| entity_type | character varying | 50 | NO |  |
| entity_id | uuid |  | NO |  |
| user_id | character varying | 100 | YES |  |
| previous_state | jsonb |  | YES |  |
| new_state | jsonb |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| action | character varying | 100 | NO | 'system_event'::character varying |
| category | character varying | 50 | YES | 'system'::character varying |
| severity | character varying | 20 | YES | 'info'::character varying |
| timestamp | timestamp with time zone |  | YES | CURRENT_TIMESTAMP |
| related_entity_id | uuid |  | YES |  |
| related_entity_type | character varying | 50 | YES |  |
| details | jsonb |  | YES | '{}'::jsonb |
| message | text |  | YES |  |
| status | character varying | 20 | YES |  |

#### Primary Key

- Constraint Name: tgl_loom_audit_log_pkey
- Columns: id

#### Check Constraints

- tgl_loom_audit_log_severity_check: `CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'error'::character varying, 'critical'::character varying])::text[])))`

#### Indexes

- idx_audit_log_entity (INDEX): related_entity_id, related_entity_type
- idx_audit_log_severity_timestamp (INDEX): severity, timestamp
- idx_tgl_loom_audit_log_action (INDEX): action
- idx_tgl_loom_audit_log_details_gin (INDEX): details
- idx_tgl_loom_audit_log_user (INDEX): user_id
- tgl_loom_audit_log_pkey (PRIMARY KEY): id

---

### tgl_loom_instances

**Type:** BASE TABLE

**Row count:** 1

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| program_id | uuid |  | NO |  |
| instance_date | date |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| venue_id | uuid |  | YES |  |
| status | USER-DEFINED |  | NO | 'draft'::loom_instance_status |
| participants_count | integer |  | NO | 0 |
| staff_count | integer |  | NO | 0 |
| manually_modified | boolean |  | NO | false |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| data_json | jsonb |  | YES | '{}'::jsonb |
| date | date |  | NO | CURRENT_DATE |

#### Primary Key

- Constraint Name: tgl_loom_instances_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_loom_instances_program_id_fkey | program_id | programs | id |
| tgl_loom_instances_venue_id_fkey | venue_id | venues | id |

#### Unique Constraints

- tgl_loom_instances_program_id_instance_date_key: program_id, instance_date

#### Indexes

- idx_loom_instances_date (INDEX): instance_date
- idx_loom_instances_program (INDEX): program_id
- idx_loom_instances_status (INDEX): status
- idx_tgl_loom_instances_data_gin (INDEX): data_json
- idx_tgl_loom_instances_status (INDEX): status
- tgl_loom_instances_pkey (PRIMARY KEY): id
- tgl_loom_instances_program_id_instance_date_key (UNIQUE): program_id, instance_date

---

### tgl_loom_participant_allocations

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| loom_instance_id | uuid |  | NO |  |
| participant_id | uuid |  | NO |  |
| billing_code_id | uuid |  | YES |  |
| allocation_status | USER-DEFINED |  | NO | 'planned'::allocation_status |
| cancellation_type | USER-DEFINED |  | YES |  |
| manually_added | boolean |  | NO | false |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| billing_codes | jsonb |  | YES | '[]'::jsonb |
| hours | numeric |  | YES | 0 |

#### Primary Key

- Constraint Name: tgl_loom_participant_allocations_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_loom_participant_allocations_loom_instance_id_fkey | loom_instance_id | tgl_loom_instances | id |
| tgl_loom_participant_allocations_participant_id_fkey | participant_id | participants | id |
| tgl_loom_participant_allocations_billing_code_id_fkey | billing_code_id | billing_codes | id |

#### Indexes

- idx_loom_participant_allocations_instance (INDEX): loom_instance_id
- idx_loom_participant_allocations_participant (INDEX): participant_id
- idx_loom_participant_allocations_status (INDEX): allocation_status
- idx_participant_allocations_billing_codes (INDEX): billing_codes
- tgl_loom_participant_allocations_pkey (PRIMARY KEY): id

---

### tgl_loom_staff_shifts

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| loom_instance_id | uuid |  | NO |  |
| staff_id | uuid |  | NO |  |
| role | USER-DEFINED |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| status | USER-DEFINED |  | NO | 'planned'::staff_shift_status |
| manually_assigned | boolean |  | NO | false |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_loom_staff_shifts_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_loom_staff_shifts_loom_instance_id_fkey | loom_instance_id | tgl_loom_instances | id |
| tgl_loom_staff_shifts_staff_id_fkey | staff_id | staff | id |

#### Indexes

- idx_loom_staff_shifts_instance (INDEX): loom_instance_id
- idx_loom_staff_shifts_staff (INDEX): staff_id
- idx_loom_staff_shifts_status (INDEX): status
- idx_loom_staff_shifts_timerange (INDEX): start_time, end_time
- tgl_loom_staff_shifts_pkey (PRIMARY KEY): id

---

### tgl_loom_time_slots

**Type:** BASE TABLE

**Row count:** 3

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| instance_id | uuid |  | NO |  |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| label | text |  | NO |  |
| card_type | USER-DEFINED |  | NO | 'ACTIVITY'::tgl_card_type |
| details | jsonb |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_loom_time_slots_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_loom_time_slots_instance_id_fkey | instance_id | tgl_loom_instances | id |

#### Indexes

- idx_time_slots_card_type (INDEX): card_type
- idx_time_slots_instance (INDEX): instance_id
- tgl_loom_time_slots_pkey (PRIMARY KEY): id

---

### tgl_loom_vehicle_runs

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| loom_instance_id | uuid |  | NO |  |
| vehicle_id | uuid |  | NO |  |
| driver_id | uuid |  | YES |  |
| route_data | jsonb |  | NO | '{}'::jsonb |
| start_time | time without time zone |  | NO |  |
| end_time | time without time zone |  | NO |  |
| estimated_duration | integer |  | YES |  |
| estimated_distance | integer |  | YES |  |
| manually_configured | boolean |  | NO | false |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_loom_vehicle_runs_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_loom_vehicle_runs_loom_instance_id_fkey | loom_instance_id | tgl_loom_instances | id |
| tgl_loom_vehicle_runs_vehicle_id_fkey | vehicle_id | vehicles | id |
| tgl_loom_vehicle_runs_driver_id_fkey | driver_id | staff | id |

#### Indexes

- idx_loom_vehicle_runs_driver (INDEX): driver_id
- idx_loom_vehicle_runs_instance (INDEX): loom_instance_id
- idx_loom_vehicle_runs_timerange (INDEX): start_time, end_time
- idx_loom_vehicle_runs_vehicle (INDEX): vehicle_id
- tgl_loom_vehicle_runs_pkey (PRIMARY KEY): id

---

### tgl_operator_intents

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| intent_type | USER-DEFINED |  | NO |  |
| start_date | date |  | NO |  |
| end_date | date |  | YES |  |
| program_id | uuid |  | YES |  |
| participant_id | uuid |  | YES |  |
| staff_id | uuid |  | YES |  |
| venue_id | uuid |  | YES |  |
| vehicle_id | uuid |  | YES |  |
| metadata | jsonb |  | NO | '{}'::jsonb |
| modified_fields | jsonb |  | YES |  |
| billing_codes | jsonb |  | YES |  |
| created_by | text |  | NO |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_operator_intents_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_operator_intents_program_id_fkey | program_id | programs | id |
| tgl_operator_intents_participant_id_fkey | participant_id | participants | id |
| tgl_operator_intents_staff_id_fkey | staff_id | staff | id |
| tgl_operator_intents_venue_id_fkey | venue_id | venues | id |
| tgl_operator_intents_vehicle_id_fkey | vehicle_id | vehicles | id |

#### Check Constraints

- valid_date_range: `CHECK (((end_date IS NULL) OR (end_date > start_date)))`

#### Indexes

- idx_operator_intents_date_range (INDEX): start_date, end_date
- idx_operator_intents_participant (INDEX): participant_id
- idx_operator_intents_program (INDEX): program_id
- idx_operator_intents_type (INDEX): intent_type
- tgl_operator_intents_pkey (PRIMARY KEY): id

---

### tgl_settings

**Type:** BASE TABLE

**Row count:** 17

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| key | text |  | NO |  |
| value | text |  | NO |  |
| data_type | text |  | NO | 'string'::text |
| category | text |  | NO | 'general'::text |
| description | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_settings_pkey
- Columns: id

#### Unique Constraints

- tgl_settings_key_key: key

#### Indexes

- idx_tgl_settings_category (INDEX): category
- tgl_settings_key_key (UNIQUE): key
- tgl_settings_pkey (PRIMARY KEY): id

---

### tgl_temporal_exceptions

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| exception_type | USER-DEFINED |  | NO |  |
| exception_date | date |  | NO |  |
| program_id | uuid |  | YES |  |
| participant_id | uuid |  | YES |  |
| staff_id | uuid |  | YES |  |
| venue_id | uuid |  | YES |  |
| vehicle_id | uuid |  | YES |  |
| loom_instance_id | uuid |  | YES |  |
| metadata | jsonb |  | NO | '{}'::jsonb |
| billing_override | jsonb |  | YES |  |
| reason | text |  | YES |  |
| created_by | text |  | NO |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: tgl_temporal_exceptions_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| tgl_temporal_exceptions_program_id_fkey | program_id | programs | id |
| tgl_temporal_exceptions_participant_id_fkey | participant_id | participants | id |
| tgl_temporal_exceptions_staff_id_fkey | staff_id | staff | id |
| tgl_temporal_exceptions_venue_id_fkey | venue_id | venues | id |
| tgl_temporal_exceptions_vehicle_id_fkey | vehicle_id | vehicles | id |
| tgl_temporal_exceptions_loom_instance_id_fkey | loom_instance_id | tgl_loom_instances | id |

#### Indexes

- idx_temporal_exceptions_date (INDEX): exception_date
- idx_temporal_exceptions_instance (INDEX): loom_instance_id
- idx_temporal_exceptions_participant (INDEX): participant_id
- idx_temporal_exceptions_program (INDEX): program_id
- idx_temporal_exceptions_type (INDEX): exception_type
- tgl_temporal_exceptions_pkey (PRIMARY KEY): id

---

### vehicle_blackouts

**Type:** BASE TABLE

**Row count:** 0

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| vehicle_id | uuid |  | NO |  |
| start_time | timestamp with time zone |  | NO |  |
| end_time | timestamp with time zone |  | NO |  |
| reason | text |  | NO |  |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |

#### Primary Key

- Constraint Name: vehicle_blackouts_pkey
- Columns: id

#### Foreign Keys

| Constraint Name | Column | References Table | References Column |
|-----------------|--------|-----------------|------------------|
| vehicle_blackouts_vehicle_id_fkey | vehicle_id | vehicles | id |

#### Check Constraints

- valid_blackout_timerange: `CHECK ((end_time > start_time))`

#### Indexes

- idx_vehicle_blackouts_active (INDEX): vehicle_id, start_time, end_time
- idx_vehicle_blackouts_timerange (INDEX): start_time, end_time
- idx_vehicle_blackouts_vehicle (INDEX): vehicle_id
- vehicle_blackouts_pkey (PRIMARY KEY): id

---

### vehicles

**Type:** BASE TABLE

**Row count:** 16

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| name | character varying | 100 | NO |  |
| registration | character varying | 20 | NO |  |
| capacity | integer |  | NO |  |
| wheelchair_capacity | integer |  | NO | 0 |
| make | character varying | 50 | YES |  |
| model | character varying | 50 | YES |  |
| year | integer |  | YES |  |
| active | boolean |  | NO | true |
| notes | text |  | YES |  |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| location_lat | numeric |  | YES |  |
| location_lng | numeric |  | YES |  |
| status | character varying | 50 | NO | 'active'::character varying |
| vin_number | text |  | YES |  |
| engine_number | text |  | YES |  |
| registration_expiry | date |  | YES |  |
| fuel_type | text |  | YES |  |
| location | text |  | YES |  |
| max_height | numeric |  | YES |  |
| wheelchair_accessible | boolean |  | YES | false |

#### Primary Key

- Constraint Name: vehicles_pkey
- Columns: id

#### Check Constraints

- vehicles_status_check: `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'maintenance'::character varying, 'inactive'::character varying, 'retired'::character varying, 'pending'::character varying])::text[])))`

#### Indexes

- idx_vehicles_fuel_type (INDEX): fuel_type
- idx_vehicles_location (INDEX): location_lat, location_lng
- idx_vehicles_make_model (INDEX): make, model
- idx_vehicles_registration (INDEX): registration
- idx_vehicles_status (INDEX): status
- vehicles_pkey (PRIMARY KEY): id

---

### venues

**Type:** BASE TABLE

**Row count:** 2

#### Columns

| Column Name | Data Type | Length | Nullable | Default |
|-------------|-----------|--------|----------|----------|
| id | uuid |  | NO | gen_random_uuid() |
| name | character varying | 100 | NO |  |
| address | text |  | NO |  |
| suburb | character varying | 100 | YES |  |
| state | character varying | 50 | YES |  |
| postcode | character varying | 10 | YES |  |
| capacity | integer |  | YES |  |
| facilities | text |  | YES |  |
| active | boolean |  | NO | true |
| created_at | timestamp with time zone |  | NO | now() |
| updated_at | timestamp with time zone |  | NO | now() |
| location_lat | numeric |  | YES |  |
| location_lng | numeric |  | YES |  |
| status | character varying | 50 | NO | 'active'::character varying |

#### Primary Key

- Constraint Name: venues_pkey
- Columns: id

#### Check Constraints

- venues_status_check: `CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'maintenance'::character varying, 'closed'::character varying])::text[])))`

#### Indexes

- idx_venues_location (INDEX): location_lat, location_lng
- idx_venues_name (INDEX): name
- idx_venues_status (INDEX): status
- venues_pkey (PRIMARY KEY): id

---

## Relationships

### event_card_map

- **→ loom_instances** via `loom_instance_id` → `id` (event_card_map_loom_instance_id_fkey)

### history_pinned_artifacts

- **→ history_ribbon_shifts** via `history_shift_id` → `id` (history_pinned_artifacts_history_shift_id_fkey)

### history_ribbon_participants

- **→ history_ribbon_shifts** via `history_shift_id` → `id` (history_ribbon_participants_history_shift_id_fkey)

### history_ribbon_staff

- **→ history_ribbon_shifts** via `history_shift_id` → `id` (history_ribbon_staff_history_shift_id_fkey)

### history_ribbon_tags

- **→ history_ribbon_shifts** via `history_shift_id` → `id` (history_ribbon_tags_history_shift_id_fkey)

### loom_instances

- **→ rules_programs** via `source_rule_id` → `id` (loom_instances_source_rule_id_fkey)

### loom_participant_attendance

- **→ loom_instances** via `loom_instance_id` → `id` (loom_participant_attendance_loom_instance_id_fkey)
- **→ rules_participant_schedule** via `source_rule_id` → `id` (loom_participant_attendance_source_rule_id_fkey)

### loom_staff_assignments

- **→ loom_instances** via `loom_instance_id` → `id` (loom_staff_assignments_loom_instance_id_fkey)
- **→ rules_staff_roster** via `source_rule_id` → `id` (loom_staff_assignments_source_rule_id_fkey)

### loom_vehicle_assignments

- **→ loom_instances** via `loom_instance_id` → `id` (loom_vehicle_assignments_loom_instance_id_fkey)

### participant_billing_codes

- **→ programs** via `program_id` → `id` (participant_billing_codes_program_id_fkey)
- **→ participants** via `participant_id` → `id` (participant_billing_codes_participant_id_fkey)

### payment_diamonds

- **→ history_ribbon_shifts** via `history_shift_id` → `id` (payment_diamonds_history_shift_id_fkey)

### program_participants

- **→ programs** via `program_id` → `id` (program_participants_program_id_fkey)
- **→ participants** via `participant_id` → `id` (program_participants_participant_id_fkey)
- **→ billing_codes** via `billing_code_id` → `id` (program_participants_billing_code_id_fkey)

### programs

- **→ venues** via `venue_id` → `id` (programs_venue_id_fkey)

### rules_participant_schedule

- **→ rules_programs** via `program_id` → `id` (rules_participant_schedule_program_id_fkey)

### rules_program_exceptions

- **→ rules_programs** via `program_id` → `id` (rules_program_exceptions_program_id_fkey)

### rules_staff_roster

- **→ rules_programs** via `program_id` → `id` (rules_staff_roster_program_id_fkey)

### schedule

- **→ programs** via `program_id` → `id` (schedule_program_id_fkey)
- **→ venues** via `venue_id` → `id` (schedule_venue_id_fkey)

### staff_unavailabilities

- **→ staff** via `staff_id` → `id` (staff_unavailabilities_staff_id_fkey)

### tgl_loom_instances

- **→ programs** via `program_id` → `id` (tgl_loom_instances_program_id_fkey)
- **→ venues** via `venue_id` → `id` (tgl_loom_instances_venue_id_fkey)

### tgl_loom_participant_allocations

- **→ tgl_loom_instances** via `loom_instance_id` → `id` (tgl_loom_participant_allocations_loom_instance_id_fkey)
- **→ participants** via `participant_id` → `id` (tgl_loom_participant_allocations_participant_id_fkey)
- **→ billing_codes** via `billing_code_id` → `id` (tgl_loom_participant_allocations_billing_code_id_fkey)

### tgl_loom_staff_shifts

- **→ tgl_loom_instances** via `loom_instance_id` → `id` (tgl_loom_staff_shifts_loom_instance_id_fkey)
- **→ staff** via `staff_id` → `id` (tgl_loom_staff_shifts_staff_id_fkey)

### tgl_loom_time_slots

- **→ tgl_loom_instances** via `instance_id` → `id` (tgl_loom_time_slots_instance_id_fkey)

### tgl_loom_vehicle_runs

- **→ tgl_loom_instances** via `loom_instance_id` → `id` (tgl_loom_vehicle_runs_loom_instance_id_fkey)
- **→ vehicles** via `vehicle_id` → `id` (tgl_loom_vehicle_runs_vehicle_id_fkey)
- **→ staff** via `driver_id` → `id` (tgl_loom_vehicle_runs_driver_id_fkey)

### tgl_operator_intents

- **→ programs** via `program_id` → `id` (tgl_operator_intents_program_id_fkey)
- **→ participants** via `participant_id` → `id` (tgl_operator_intents_participant_id_fkey)
- **→ staff** via `staff_id` → `id` (tgl_operator_intents_staff_id_fkey)
- **→ venues** via `venue_id` → `id` (tgl_operator_intents_venue_id_fkey)
- **→ vehicles** via `vehicle_id` → `id` (tgl_operator_intents_vehicle_id_fkey)

### tgl_temporal_exceptions

- **→ programs** via `program_id` → `id` (tgl_temporal_exceptions_program_id_fkey)
- **→ participants** via `participant_id` → `id` (tgl_temporal_exceptions_participant_id_fkey)
- **→ staff** via `staff_id` → `id` (tgl_temporal_exceptions_staff_id_fkey)
- **→ venues** via `venue_id` → `id` (tgl_temporal_exceptions_venue_id_fkey)
- **→ vehicles** via `vehicle_id` → `id` (tgl_temporal_exceptions_vehicle_id_fkey)
- **→ tgl_loom_instances** via `loom_instance_id` → `id` (tgl_temporal_exceptions_loom_instance_id_fkey)

### vehicle_blackouts

- **→ vehicles** via `vehicle_id` → `id` (vehicle_blackouts_vehicle_id_fkey)

## Summary

- **Total tables:** 43
- **Total enum types:** 11
- **Total columns:** 515
- **Total relationships:** 47

