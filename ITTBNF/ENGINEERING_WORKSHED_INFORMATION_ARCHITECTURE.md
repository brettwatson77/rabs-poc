# Engineering Workshed – Information Architecture

A pragmatic map of **where every piece of RABS data should live** using the engineering-workshed metaphor.

Legend  
✅ = column/table exists in DB ❌ = missing / to-create

---

## 1. WALL (Program Templates & Blueprints)
*The repeating patterns that form the foundation of the loom system*

| Blueprint Component | Purpose | DB Source | Exists |
|------------|-------------------|-------------------|--------|
| Program Definition | Name, type, description, venue | `programs` table | ✅ |
| Time Slots | Standard start/end times for program segments | `programs.time_slots` JSONB | ✅ |
| Repeat Pattern | Weekly/fortnightly/once, days of week | `programs.repeat_pattern`, `programs.days_of_week` | ✅ |
| Participant Enrollment | Who regularly attends this program | `program_participants` join table | ❌ |
| Staff Ratios | Required staff:participant ratios | `programs.staff_ratio` | ✅ |
| Billing Codes | Standard billing codes for program | `programs.billing_code_id` | ❌ |
| Vehicle Requirements | Standard vehicle needs | `program_vehicle_requirements` | ❌ |
| Route Templates | Standard pickup/dropoff routes | `route_templates` | ❌ |

---

## 2. CALENDAR (Temporary & Permanent Changes)
*The exceptions and modifications to wall blueprints, with effective dates*

| Calendar Entry Type | What It Records | DB Source | Exists |
|----------------|---------------|-----------|--------|
| Participant Absence | Single-day absence from program | `tgl_operator_intents` (`participant_absence`) | ✅ |
| Participant Transfer | Permanent program change | `tgl_operator_intents` (`participant_transfer`) | ✅ |
| Staff Absence | Staff unavailable on specific date | `tgl_operator_intents` (`staff_absence`) | ✅ |
| Venue Change | Temporary or permanent venue switch | `tgl_operator_intents` (`venue_change`) | ✅ |
| Program Cancellation | One-time program cancellation | `tgl_operator_intents` (`program_cancellation`) | ✅ |
| Program Reschedule | Time change for specific instance | `tgl_operator_intents` (`program_reschedule`) | ✅ |
| Vehicle Maintenance | Vehicle unavailable dates | `vehicle_maintenance` | ✅ |
| Billing Exception | One-time billing code override | `tgl_operator_intents` (`billing_exception`) | ✅ |
| Program Modification | Change to program structure | `tgl_operator_intents` (`program_modification`) | ✅ |
| Loom Window Expansion | Calendar date when window expands | `loom_settings.last_roll`, `loom_settings.next_roll_due` | ✅ |

---

## 3. FILING CABINET (Reference Data)
*The detailed information needed to execute programs*

### 3.1 Participant Files

| Data Category | Fields Required | DB Source | Exists |
|---------|-----------------|-----------|--------|
| Identity | first_name, last_name, date_of_birth, ndis_number | `participants` table | ✅ |
| Contact | phone, email, address, suburb/state/postcode | `participants` table | ✅ |
| Location | lat/lng coordinates for routing | `participants.location_lat/lng` | ✅ |
| Supervision | supervision_multiplier for staff ratio calc | `participants.supervision_multiplier` | ✅ |
| Plan Management | plan_management type (enum exists) | `participants.plan_management` | ✅ |
| Funding Period | plan_start_date, plan_end_date | `participants.plan_start`, `participants.plan_end` | ❌ |
| Photo | photo_url for identification | `participants.photo_url` | ✅ |
| Care Notes | care_plan details | `participants.care_plan` | ❌ |
| History | change_log of all modifications | `change_log` table | ✅ |

### 3.2 Staff Files

| Data Category | Fields | DB Source | Exists |
|---------|--------|-----------|--------|
| Identity | first_name, last_name, position | `staff` table | ✅ |
| Contact | phone, email, address, suburb/state/postcode | `staff` table | ✅ |
| Employment | contracted_hours, base_pay_rate, schads_level | `staff` table | ✅ |
| Qualifications | qualifications text, certification types | `staff.qualifications` | ✅ |
| Certification Expiry | dates when qualifications expire | `staff.qual_expiry_dates` | ❌ |
| Availability | recurring availability patterns | `staff_availability` table | ✅ |
| Location | lat/lng for routing and proximity | `staff.location_lat/lng` | ✅ |
| Photo | photo_url for identification | `staff.photo_url` | ✅ |

### 3.3 Vehicle Files

| Data Category | Fields | DB Source | Exists |
|---------|--------|-----------|--------|
| Identity | code, registration, make, model, year | `vehicles` table | ✅ |
| Capacity | passenger capacity, wheelchair capacity | `vehicles.capacity` | ✅ |
| Fuel | fuel_type, fuel_consumption | `vehicles` table | ✅ |
| Maintenance | last_service_date, next_service_due | `vehicles` table | ✅ |
| Photo | photo_url for identification | `vehicles.photo_url` | ✅ |
| Status | active/inactive | `vehicles.active` | ✅ |

### 3.4 Venue Files

| Data Category | Fields | DB Source | Exists |
|---------|--------|-----------|--------|
| Identity | name, description | `venues` table | ✅ |
| Location | address, suburb, state, postcode, lat/lng | `venues` table | ✅ |
| Capacity | max occupancy | `venues.capacity` | ✅ |
| Amenities | available facilities | `venues.amenities` | ✅ |
| Status | active/inactive | `venues.active` | ✅ |

### 3.5 Finance Drawer

| Data Category | Fields | DB Source | Exists |
|---------|--------|-----------|--------|
| Billing Codes | code, description, rate | `billing_codes` table | ✅ |
| Ratio Splits | 1:1, 1:2, 1:3, 1:4 rate adjustments | `billing_codes.ratioSplit` | ❌ |
| Staff Rates | base rates by SCHADS level | `rates` table | ✅ |
| Award Rules | penalty rates, overtime rules | `award_rules` | ❌ |
| Invoices | generated invoices by participant | `invoices` | ❌ |
| Cost Centers | program cost allocation rules | `cost_centers` | ❌ |

---

## 4. RED FLASHING LIGHT (Emergency Overrides)
*Urgent changes that require immediate attention and recalculation*

| Emergency Type | What Triggers It | DB Source | Exists |
|----------------|-----------------|-----------|--------|
| Staff Call-out | Last-minute staff absence | `emergency_staff_changes` | ❌ |
| Vehicle Breakdown | Sudden vehicle unavailability | `emergency_vehicle_changes` | ❌ |
| Loom Window Change | Forced expansion of loom window | `loom_settings.force_roll` | ✅ |
| Participant Emergency | Urgent participant status change | `emergency_participant_changes` | ❌ |

---

## 5. Summary of Missing Schema Items

| Component | Missing Item | Suggested Implementation |
|-----------|-------------|--------------------------|
| WALL | Program participant enrollment | `program_participants(program_id, participant_id)` table |
| WALL | Program billing codes | `programs.billing_code_id` foreign key |
| WALL | Vehicle requirements | `program_vehicle_requirements(program_id, vehicle_count, wheelchair_count)` |
| WALL | Route templates | `route_templates(program_id, route_order, waypoints JSONB)` |
| FILING CABINET | Participant funding period | `participants.plan_start_date`, `participants.plan_end_date` |
| FILING CABINET | Participant care notes | `participants.care_plan TEXT` |
| FILING CABINET | Staff certification expiry | `staff_certifications(staff_id, cert_type, expiry_date)` |
| FILING CABINET | Billing code ratio splits | `billing_code_ratios(code_id, ratio_type, adjusted_rate)` |
| FILING CABINET | Award rules | `award_rules(level, condition, multiplier)` |
| FILING CABINET | Invoices | `invoices(participant_id, period_start, period_end, total, status)` |
| RED LIGHT | Emergency changes | `emergency_changes(type, affected_id, date, resolution_status)` |

---

## 6. Data Flow Between Components

1. **WALL → CALENDAR**: When permanent changes occur on a specific date (CALENDAR), they must update the master templates (WALL)
2. **WALL + FILING CABINET → LOOM**: Program templates (WALL) combined with reference data (FILING CABINET) generate loom instances
3. **CALENDAR → LOOM**: Exceptions and changes (CALENDAR) modify specific loom instances
4. **FILING CABINET → FINANCE**: Reference data powers all financial calculations and billing
5. **RED LIGHT → CALENDAR**: Emergencies become calendar entries once resolved

By implementing the missing schema items and ensuring proper data flow between these components, the workshed metaphor will be fully realized in the system architecture.
