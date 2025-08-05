# RABS – Program Creation Implementation Checklist
_Actions required to deliver the “95 % core workflow” described by the user._

---

## 1. Database Tasks
- [ ] **Run migration 010** – `programs_schema_update.sql`  
  • Adds repeat_pattern, days_of_week (JSONB), time_slots (JSONB), start/end dates, staff fields.  
- [ ] **Run migration 011** – `time_slots_table.sql`  
  • Creates `tgl_card_type` enum & `tgl_loom_time_slots` table.  
  • Adds `status` column to `tgl_loom_audit_log`.  
  • Relaxes `tgl_loom_vehicle_runs` mandatory columns.  
- [ ] **Seed `settings`** table with `loom_window_weeks = 8` (or desired default).  
- [ ] **Verify / add indexes**  
  • `idx_programs_dates`, `idx_programs_active`, `idx_time_slots_instance`, `idx_time_slots_card_type`.  
- [ ] **Back-fill existing data**  
  • Convert legacy `day_of_week` into `days_of_week` JSONB array.  
  • Set `repeat_pattern = 'none'` for existing one-off rows.  
- [ ] **Grant permissions** – ensure API role can `INSERT/UPDATE` new columns & tables.

---

## 2. Backend Tasks
### Core Services
- [ ] **programService.js**  
  • `createProgram`, `updateProgram`, `deleteProgram`  
  • `generateInstances` (recurrence logic: none / weekly / fortnightly / monthly)  
  • `createInstance` (schedule, loom instance, participant allocations, staff shifts, vehicle runs, time-slot cards)  
  • `getCardsByDate` (dashboard query)  
- [ ] **programController.js** – REST endpoints  
  • `POST /programs` (create)  
  • `PUT /programs/:id` (update)  
  • `GET /programs` (filter by window)  
  • `GET /programs/:id` (details)  
  • `DELETE /programs/:id`  
  • `POST /programs/:id/generate` (manual regen)  
  • `GET /dashboard/cards/:date`

### Support Utilities
- [ ] `calculateStaffShifts(participantCount, additionalStaff)`  
- [ ] `determineCardType(label)`  
- [ ] Date helpers: `isValidDate`, `addWeeks`, `formatDateForDb`

---

## 3. Frontend Tasks
- [ ] **MasterSchedule.jsx**  
  • Replace intent POST with `POST /api/v1/programs`.  
  • Ensure modal captures: title, type, venue, repeat toggle, days_of_week, repeat_pattern, start/end dates, time_slots array, participants + billing codes, staff assignment mode, additional_staff_count, notes.  
  • After success: refresh program list & render cards in calendar.  
- [ ] **Dashboard page**  
  • Fetch `/api/v1/dashboard/cards/:date` and render PICKUP / ACTIVITY / DROPOFF cards.  
- [ ] **Roster page**  
  • Render staff shifts created by backend (`tgl_loom_staff_shifts`).  
- [ ] **Finance page**  
  • Use `participant_billing_codes` rows for billing calculations.  
- [ ] **Venue selector**  
  • Provide “+ New Venue” inline creation; on save, refresh venue list.  
- [ ] **Form validation** – block save until mandatory fields met.

---

## 4. Testing Tasks
- [ ] **Unit tests** – programService.createProgram & generateInstances logic.  
- [ ] **API integration tests** –  
  • Create one-off program (repeat_pattern = none) -> expect 1 instance inside window.  
  • Create weekly program (Mon/Wed) -> expect instances on both days for window.  
  • Create fortnightly program starting current week -> expect every second week.  
  • Delete program -> related instances & cards removed.  
- [ ] **Frontend E2E (Cypress/playwright)** –  
  • Fill modal, submit, verify calendar & dashboard show cards.  
- [ ] **Load test** – generate 500 programs & roll loom; ensure < 2 s card query.

---

## 5. Fixes Needed / Known Issues
- [ ] **plannerService `db.close is not a function`** – switch to pooled client.  
- [ ] **Audit log schema mismatch** – migrate `tgl_loom_audit_log` (`status` column added in migration 011).  
- [ ] **JSON stringify bug** – ensure `programService.processBillingCodes` never passes raw object where JSON string expected.  
- [ ] Remove stale CREATE_PROGRAM intent logic once new flow confirmed working.  
- [ ] Verify triggers update `updated_at` for all new/altered tables.

---

## 6. Integration Tasks
- [ ] **Update server.js** – ensure `programsRouter` & `dashboardRouter` loaded (already mounted).  
- [ ] **Cron roll** – daily loom roll must respect new `schedule` rows & time slots.  
- [ ] **Permissions / CORS** – allow frontend origin to hit new endpoints.  
- [ ] **Docs** – update API reference & onboarding guide with new workflow.  
- [ ] **Remove/deprecate** CREATE_PROGRAM intent from Master Schedule once migration complete.

---

### ✅ Completion Definition
* A coordinator can open Master Schedule, create a recurring program (with participants, billing codes, time slots, staff mode), press **Save**, and immediately see:
  * Program card(s) on Master Schedule for all dates in loom window  
  * Corresponding time-slot cards scheduled on Dashboard  
  * Staff shift cards auto-created on Roster  
  * Billing entries visible on Finance page  
* Shrinking/expanding loom window regenerates instances correctly.  
* Subsequent changes (sick leave, cancellations) handled through **Intents** workflow.

_Target delivery: **End of current sprint**_ – sign-off by Brett.
