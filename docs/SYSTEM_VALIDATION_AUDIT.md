# SYSTEM VALIDATION AUDIT  
_RABS-POC – August 2025_

This document is a technical “health-check” of the entire proof-of-concept code-base.  
For every major functional area we verify:

• Front-end capability  
• Back-end API / service coverage  
• Database schema readiness  
• Gaps or missing work

---

## 1. MASTER SCHEDULE PAGE AUDIT
### 1.1 Front-end Capabilities
✔ Create one-off or repeating programs (daily / weekly / custom)  
✔ Drag-drop and modal-based editing  
✔ Assign multiple participants per program instance  
✔ Per-participant multi-billing-code picker with individual hours  
✔ Intent-aware editing (creates operator intents instead of direct DB writes)  
✔ Future date-picker for “from this date forward” planning  
❑ UI to set *vehicle maintenance blackout* **(not present)**  

### 1.2 Required Back-end APIs
| Function | Route / Controller | Status |
|----------|-------------------|--------|
|Create / update program template|`POST /api/v1/programs` – _programController_|OK|
|Generate repeating instances (Loom)|`POST /api/v1/loom/instances/generate` – _loomController_|OK|
|Assign / update participant billing codes|`POST /api/v1/intentions` with `ASSIGN_BILLING` payload|OK|
|Fetch schedule window|`GET /api/v1/loom/instances?start=&end=`|OK|
|Vehicle assignment|`POST /api/v1/loom/vehicles/assign` |OK|
|Vehicle maintenance window|**MISSING**|✘|

### 1.3 Database Requirements
- `tgl_loom_instances` – base instance rows ✅  
- `tgl_loom_participant_allocations` – columns for `billing_codes JSONB`, `hours NUMERIC` ✅  
- `billing_codes` master table ✅  
 - `vehicle_blackouts` table **(added by migration 007 – pending deploy)** ✅

### 1.4 Gaps
* UI/API wiring for vehicle maintenance blackout windows still **pending**  
* Conflict checks for “vehicle unavailable” not executed in UI (engine helpers ready)  
* Need UI toggle to mark repeating program as “transport free” (if no bus required)

---

## 2. PARTICIPANT PLANNER PAGE AUDIT
### 2.1 Front-end Capabilities
✔ Profile CRUD, photo, contact, flags  
✔ Tabbed interface: Supervision, Programs, Reports, **History**  
✔ Compact “scrabble-tile” selector grid  
✔ History tab renders change timeline with badges & billing impact  
✔ Financial impact calculator (supervision multiplier)  
❑ Bulk document upload / file store (future)

### 2.2 Back-end API Support
- `GET /api/v1/participants/:id` – details ✅  
- `GET /api/v1/changes/participant/:id/changes` – history ✅  
- `POST /api/v1/intentions` – enrol/withdraw ✅  
- `GET /api/v1/reports/participant/:id` – financials ✅  

### 2.3 Database Completeness
- `participants` table – full demographic columns ✅  
- `change_log` table – id, change_date, type, description, participant_id ✅  
- `program_participants` replaced by loom allocations ✅  

### 2.4 Identified Gaps
- No soft-delete flag on change_log (`is_deleted`) – optional  
- No participant document storage table yet  
- No audit trail for *participant attribute edits* (only program-related right now)

---

## 3. VEHICLE MANAGEMENT AUDIT
### 3.1 Current Capabilities
✔ Vehicle CRUD page (make, model, seats, wheelchair spots)  
✔ Assignment engine chooses vehicle per instance based on capacity  
✔ Vehicle runs table with driver / timings  

### 3.2 Missing Feature – Maintenance / Unavailability
**Requirement:** ability to block a vehicle for a date-time range; Loom must auto-re-assign.

#### Required Additions
• Front-end: calendar modal in Vehicles page (“Schedule maintenance”)  
• API:  
 `POST /api/v1/vehicles/:id/maintenance` – create blackout  
 `GET /api/v1/vehicles/:id/availability?start=&end=` – for engine  
• DB: new table `vehicle_blackouts`  
```
id UUID PK
vehicle_id UUID
start_ts TIMESTAMPTZ
end_ts   TIMESTAMPTZ
reason TEXT
created_at, updated_at
```
• Loom logic: during allocation exclude vehicles with overlapping blackout.

---

## 4. STAFF MANAGEMENT AUDIT
### 4.1 Implemented
✔ Staff CRUD (qualifications, contact, photo)  
✔ Shift generation via loom_staff_shifts  
✔ Ratio calculation 1 lead + supports per 5 participants  

### 4.2 Requirements vs Gaps
| Feature | Status | Gap |
|---------|--------|-----|
|Qualification tags / filters|Present|Need UI multi-select search|
|Recurring staff availability (not rostered)|Partial (simple boolean)|Need calendared unavailability table|
|Sickness / emergency flag|API present (`/intentions` type `STAFF_SICK`)|UI missing quick-mark dialogue|
|Licence / clearance expiry|Not captured|Add `expiry_dates JSONB` column, reminders|

DB gap: table `staff_unavailabilities` similar to vehicle_blackouts.

---

## 5. LOOM SYSTEM AUDIT
### 5.1 Engine Completeness
✔ Daily roller, verification job  
✔ Operator intent layer + temporal exceptions  
✔ Staff ratio + supervision multiplier logic  
✔ Vehicle optimisation with duration slider  
✔ Auto card generation (pickup/activity/drop-off/roster)  

### 5.2 API Coverage
- `/api/v1/loom/instances` CRUD ✅  
- `/api/v1/loom/roll` manual trigger ✅  
- `/api/v1/loom/config` GET/PUT ✅  
- **No endpoint** to “simulate date with blackout inputs” (low priority)

### 5.3 Database Support
All core `tgl_` tables exist with indexes.  Rolling window & intent linkage columns present. ✅

### 5.4 Gaps
- Conflict resolution UI for optimisation clashes (only log warns)  
- No machine-learning optimiser for route ordering (future)  

---

## 6. BILLING SYSTEM AUDIT
### 6.1 Capabilities
✔ Master billing code list with real NDIS rates  
✔ Multi-code allocation per participant per program instance  
✔ Billing impact tracking in change_log  
✔ Finance page shows projected and actual totals  

### 6.2 Back-end / DB
- `billing_codes` table with `rate` field ✅  
- Participant allocation row stores `billing_codes JSONB`+hours ✅  
- `/api/v1/billing/export` route _planned_ but **not implemented**  

### 6.3 Gaps
- Bulk generation of Xero-ready CSV not done  
- GST / admin cost slider feeds UI but not persisted in DB (`settings` row missing)  
- Need scheduled job to flag “PENDING” billing rows older than X days

---

## 7. SOLUTIONS IMPLEMENTED (Sprint ✓)
* **Migration 007 – vehicle & staff availability**  
  • Added `vehicle_blackouts` and `staff_unavailabilities` tables  
  • Enhanced `tgl_loom_participant_allocations` with `billing_codes JSONB` + `hours NUMERIC`  
* **availabilityController.js** – full CRUD & availability-check endpoints for vehicles and staff, plus helper functions for Loom engine  
* Engine hooks (`isVehicleAvailable`, `isStaffAvailable`) ready for integration  
* **Vehicle Maintenance System – COMPLETE** ✅  
  • Migration deployed, API live, `Vehicles.jsx` enhanced with **Schedule Maintenance** modal  
  • Full CRUD for blackouts, professional CSS, visual indicators on cards  
* **Staff Leave Management – COMPLETE** ✅  
  • `Staff.jsx` now has **Manage Leave** modal with CRUD for unavailabilities  
  • Drop-down leave types (Sick, Annual, Training, etc.) and matching CSS  
* **End-to-End Availability Integration** ✅  
  • Routes mounted at `/api/v1/availability`  
  • UI ↔ API flow confirmed; real-time checks ready for Loom engine

---

## 8. OUTSTANDING GAPS
1. **Engine conflict-resolution surfacing** – mark needs-attention cards and provide operator tools  
2. **Billing export & ageing workflow** – CSV / API integration  
3. **Participant document storage & audit of profile edits**  
4. **Qualification / licence expiry reminders for staff & vehicles**

---

### Recommended Next Sprint
1. Connect Loom engine conflict detection outputs to UI (“needs attention” manager)  
2. Build billing export endpoint + nightly job  
3. Extend `change_log` for profile-edit auditing & soft-delete handling  
4. Document store & qualification-expiry reminder system  

With these gaps closed the RABS-POC will provide a fully operational prototype ready for real user accounts in the full RABS build.  
