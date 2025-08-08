# COMPREHENSIVE_REBUILD_CHECKLIST.md  
_A single-source roadmap for rebuilding the RABS platform without “mystery errors” or endless patching._

Each task is a concrete deliverable.  
Mark with ☑ when complete.

---

## PHASE 1 ALIGNMENT — “Stop the Bleeding”
**Objective:** Every request/response/DB operation lines up perfectly. No fake data, no guessing.

### 1 A. Endpoint Contract Audit
- [ ] ☑ Create master OpenAPI/Swagger spec from FRONTEND + BACKEND audits  
- [ ] ☑ Add missing routes:  
  - `/dashboard/cards?date=` (or change FE to path param)  
  - `/finance/generate-invoices`  
  - `/planner/generate-report`  
  - `/system/clear-cache`
- [ ] ☑ Unit test every route with super-test: success + failure cases

### 1 B. Payload & Schema Sync
- [ ] ☑ For each route, add JOI/Zod validation matching spec  
- [ ] ☑ Ensure database columns exist for every validated field  
- [ ] ☑ Remove / guard all sample data seeds

### 1 C. Bidirectional Data Checks
- [ ] ☑ Write Cypress test that loads each UI page and asserts JSON shapes  
- [ ] ☑ Add contract tests that hit DB -> API -> FE round-trip for one record of each type

### 1 D. Error-Handling Hardening
- [ ] ☑ Global error-handler returns `{ success:false, message }` everywhere  
- [ ] ☑ Frontend toast displays message & never white-screens

---

## PHASE 2 FILING CABINET — “Complete the Foundation”
**Objective:** All reference data (Participants, Staff, Vehicles, Venues, Finance) is present, queryable, and surfaced.

### 2 A. Schema Completeness
- [ ] ☑ Add missing columns:
  - `participants.plan_start_date`, `plan_end_date`, `care_plan`
  - `staff_certifications (staff_id, cert_type, expiry_date)`
  - `billing_code_ratios (code_id, ratio, adjusted_rate)`
- [ ] ☑ Create join tables:
  - `program_participants`
  - `program_vehicle_requirements`
  - `route_templates`

### 2 B. Data Import Pipelines
- [ ] ☑ CSV/Excel import for new tables, with dry-run & error report
- [ ] ☑ Photo upload endpoint & S3/local storage integration

### 2 C. Expose Reference Data
- [ ] ☑ Extend `/participants`, `/staff`, `/vehicles`, `/venues` responses to include new fields
- [ ] ☑ Frontend components display photos, geo-markers, qualification expiry alerts

---

## PHASE 3 LOGIC ENGINE — “Make the Brain Work”
**Objective:** Correct calculations for staff/vehicle requirements, billing, costs & card generation.

### 3 A. Program Template Logic (Wall → Loom)
- [ ] ☑ When a program is saved, auto-store staff ratio, default billing codes, route template
- [ ] ☑ Generate loom instances for entire window using template + ratio math

### 3 B. Calendar Exception Logic
- [ ] ☑ Create service that, on save of an Intent, finds affected instances and mutates them
- [ ] ☑ Permanent intent updates template (“Wall”) forward in time

### 3 C. Re-calculation Rules
- [ ] ☑ Staff requirement = `ceil(totalParticipants / ratio)`  
- [ ] ☑ Vehicle requirement = min vehicles satisfying capacity & wheelchair needs
- [ ] ☑ Billing lines per participant per hour = look-up (ratio, program default, exceptions)

### 3 D. Costing & Finance
- [ ] ☑ SCHADS award engine: base + penalties + OT  
- [ ] ☑ Vehicle cost = km × fuel consumption × fuel price + maintenance allocation  
- [ ] ☑ Invoice generator pulls billing lines & produces CSV/PDF

---

## PHASE 4 ACID TEST — “Watch It Work”
**Objective:** Demonstrate end-to-end reliability under real-world scenarios.

### 4 A. Golden Path Scenarios
- [ ] ☑ Create Monday Centre-Based template → verify 8-week loom generation
- [ ] ☑ Add/remove participants → see recalculated staff & vehicle counts
- [ ] ☑ Record three participant absences in calendar → instance updates confirmed

### 4 B. Edge/Stress Scenarios
- [ ] ☑ Staff call-out 1 h before shift → red-light flow, replacement suggestions
- [ ] ☑ Vehicle breakdown mid-window → re-route & re-card within 30 s
- [ ] ☑ Expand loom window to 16 weeks → performance benchmark <10 s

### 4 C. Regression & Performance Suite
- [ ] ☑ Jest/Cypress regression covering all CRUD + logic rules
- [ ] ☑ k6 load test 100 concurrent program creations / day rollover
- [ ] ☑ Automated DB migration diff checker before deploy

---

## DONE = SYSTEM READY FOR DEMO 🚀
