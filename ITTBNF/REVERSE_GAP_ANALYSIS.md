# Reverse Gap Analysis  
_What the **Database HAS** that is **NOT surfacing to the Front-end**_  
Generated 2025-08-05  

## 1  Purpose  
While the forward gap analysis showed where the data chain breaks **on the way _into_ the database**, this reverse analysis highlights rich data already **stored** that never makes the return journey to users. These blind-spots represent quick wins for product value and demo “wow-factor”.

---

## 2  Methodology  
1. Parsed `DATABASE_SCHEMA_AUDIT.md` (43 tables, 300+ columns, 10 enum types).  
2. Cross-referenced with:  
   • `BACKEND_API_AUDIT.md` — 80 exposed endpoints / payloads  
   • `FRONTEND_API_AUDIT.md` — 29 endpoints consumed by React  
3. Flagged items where **no route** or **no field in any response** exposes the data.  
4. Categorised as **Unused Table**, **Unused Column**, **Unused Enum Value**, **Unwired Relationship**.

Legend:  
❌ = not surfaced at all 🔸 = partially surfaced (backend returns but UI ignores) ✅ = fully used

---

## 3  Unused Tables (0 exposure)  

| Table | Row Count | Why It Matters | Status |
|-------|-----------|----------------|--------|
| `change_log` | 0 | Full audit trail of participant changes; ideal for “History” tab & compliance. | ❌ |
| `event_card_map` | 0 | Pre-built mapping of instance → visual cards (pickup, activity, drop-off). Could power beautiful timetable view. | ❌ |
| `history_pinned_artifacts` | 0 | Lets staff pin photos / docs to historical shifts. Great storytelling for clients. | ❌ |
| `route_analysis_cache`* | n/a | Distance, CO₂, cost cache. Could speed up transport metrics page. | ❌ |
| `staff_availability` | 58 | Already populated from CSV but no UI calendar yet. | ❌ |
| `vehicle_maintenance`* | n/a | Next-service reminders & cost forecasts. | ❌ |

\*table exists but holds zero rows; still valuable.

---

## 4  Partially Used Tables (columns ignored)  

| Table | Column(s) Ignored | Front-end Today | Opportunity |
|-------|-------------------|-----------------|-------------|
| `participants` | `plan_management`, `photo_url`, `location_lat/lng` | Shows name, address only | Map-view clustering, avatar chips, billing warnings |
| `staff` | `qualifications`, `photo_url`, `status`, `location_lat/lng` | Name + pay rate only | Cert expiry alerts, heat-map of nearest worker |
| `vehicles` | `fuel_consumption`, `last_service_date`, `next_service_due`, `photo_url` | Make/model only | Sustainability dashboard, maintenance alerts |
| `venues` | `description`, `amenities`, `lat/lng` | Name, capacity | Amenity filters, map picker |
| `loom_instances` | `notes`, `manually_modified` | Not displayed | Show amber “M” badge when human override |
| `programs` | `description`, `days_of_week`, `program_type` | Title only | Filter schedule by type, weekday chips |
| `billing_codes` | `updated_at`, `active` | Only code & rate used | Show in-active codes greyed-out |

Status: 🔸 (backend often returns the fields but React never renders them).

---

## 5  Unused Enum Values  

| Enum | Unused Values | Comment |
|------|---------------|---------|
| `loom_instance_status` | `transport_assigned`, `ready`, `needs_attention` | UI only handles `draft`, `planned`, `staffed`, `completed`, `cancelled`. |
| `staff_role` | `specialist` | Roster UI recognises `lead`, `support`, `driver` only. |
| `tgl_intent_type` | Many (`program_modification`, `billing_code_change`, `resource_requirement`) | Intent modal lists 5 of 9 options. |
| `allocation_status` | `no_show` | Dashboard treats absence as `cancelled`, loses nuance. |

These values could unlock richer state handling with minimal code.

---

## 6  Unwired Relationships / Foreign Keys  

| Source → Target | Constraint | Surfaced? |
|-----------------|------------|-----------|
| `event_card_map.loom_instance_id` → `loom_instances.id` | `event_card_map_loom_instance_id_fkey` | ❌ |
| `change_log.participant_id` → `participants.id` | `change_log_participant_id_fkey` | ❌ |
| `staff_availability.staff_id` → `staff.id` | `staff_availability_staff_id_fkey` | ❌ |
| `vehicle_maintenance.vehicle_id` → `vehicles.id` | `vehicle_maintenance_vehicle_id_fkey` | ❌ |

Exposing these would enable joined views (e.g., show cards per instance, see participant change log on profile).

---

## 7  Quick-Win Opportunities  

1. **History Tab** – Expose `change_log` & `history_pinned_artifacts` for each participant.  
2. **Card Visuals** – Leverage `event_card_map` to render pickup / activity / drop-off icons in Master Schedule.  
3. **Maintenance Alerts** – Display `next_service_due` with red banner on Vehicle cards (DB already tracks it).  
4. **Geo Visualisation** – Use `location_lat/lng` on Participants, Staff & Venues for map-based scheduling.  
5. **Advanced Status Chips** – Handle additional `loom_instance_status` values to guide staff workflow.  
6. **Specialist Staff Filter** – Enable roster filter for `staff_role = specialist` (DB & enum ready).  

---

## 8  Summary  

| Category | Count | % of Total |
|----------|-------|-----------|
| Unused Tables | 6 / 43 | **14 %** |
| Tables with Ignored Columns | 9 / 43 | **21 %** |
| Enum Sets with Unused Values | 4 / 10 | **40 %** |
| Unwired FK Relationships | 4 (key examples) | — |

The database is richer than what users see. Surfacing even a fraction of this hidden data will create new features **without additional migrations**—it’s already there, just untapped.

*End of Reverse Gap Analysis*  
