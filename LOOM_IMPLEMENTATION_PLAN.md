# LOOM_IMPLEMENTATION_PLAN.md

## 1. Overview – “The Loom”
The Loom is the active, sliding window of operational events that require continual optimisation.  
• Window size: configurable – 2 / 4 / 6 / 8 / 12 / 16 weeks from **NOW**  
• Ahead of the Loom: unscheduled “un-woven” future.  
• Behind the Loom: completed history.  
• Responsibilities  
  1. Auto-generate recurring program instances (event cards) from schedule rules.  
  2. Allocate participants, staff, vehicles, routes and billing in real time.  
  3. React to changes (cancellations, illness, availability) and re-optimise.  
  4. Surface exceptions (red-flagged shifts) for manual intervention.  

## 2. PostgreSQL Schema Requirements
New tables (all `tgl_` prefix to match current TGL architecture):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tgl_loom_instances` | one row per program instance inside the Loom | id PK, program_id FK, instance_date, status(enum: pending/generated/finalised), optimisation_state(jsonb), created_at |
| `tgl_loom_participant_allocations` | participants linked to loom_instances | id PK, loom_instance_id FK, participant_id FK, billing_code, planned_rate, allocation_status(enum: planned/cancelled/complete), cancellation_type(NULL/normal/short_notice), updated_at |
| `tgl_loom_staff_shifts` | staff shifts per instance | id PK, loom_instance_id FK, staff_id FK, role(enum: lead/support/driver), start_ts, end_ts, status(enum: planned/confirmed/replaced/flagged) |
| `tgl_loom_vehicle_runs` | vehicle & route details | id PK, loom_instance_id FK, vehicle_id FK, route_jsonb, seats_used, status(enum: planned/confirmed) |
| `tgl_loom_audit_log` | all automatic changes for traceability | id PK, loom_instance_id FK, action, before_jsonb, after_jsonb, actor(enum: loom_engine/human), ts |

Foreign keys connect back to existing `programs`, `participants`, `staff`, `vehicles`.  
Add supporting enums if not present.

## 3. Implementation Phases
1. **Schema Migration** – add new tables + enums.  
2. **Loom Engine Core** – backend service that generates/optimises instances.  
3. **Admin Controls UI** – frontend controls for window size & rule config.  
4. **Real-time Re-optimiser** – listeners for cancellations/illness.  
5. **Exception Dashboard** – surfacing flagged shifts.  
6. **Billing Sync** – connect loom allocations to billing code logic.  
7. **Performance Hardening & QA** – load test with large windows.

## 4. Integration Points
| Existing Component | Interaction with Loom |
|--------------------|-----------------------|
| `ParticipantPlanner.jsx` | rule editor for participant enrolment/exclusions; writes to existing `enrollments` table → loom engine reads |
| `MasterSchedule.jsx` | displays program templates; “Generate Loom” button triggers `/api/v1/loom/generate` |
| Billing modal (multi-code) | uses `tgl_loom_participant_allocations` for real-time totals |
| Dashboard cards | each event card comes from `tgl_loom_instances`; shift cards come from `tgl_loom_staff_shifts` |
| Route optimiser service | reused inside loom engine to populate `tgl_loom_vehicle_runs` |

## 5. Testing Strategy (Blank Slate)
1. **Reset DB** – migrate schema only; leave tables empty.  
2. **Manual Workflow:**  
   a. Create a program template in Master Schedule.  
   b. Use Participant Planner to enrol 2+ participants.  
   c. Set Loom window = 2 weeks via new UI control.  
   d. Trigger Loom generation.  
   e. Verify event cards appear, allocations correct, billing preview updates.  
3. **Mutation Tests:**  
   • Cancel participant (normal & short-notice) → verify billing + staffing.  
   • Mark staff sick → replacement or red-flag.  
   • Shrink Loom window → trailing instances deleted.  
   • Expand window → new instances generated.  

All tests run through UI; no seed scripts.

## 6. Detailed Implementation Steps
_Phase 1 – Schema_
1. Create SQL migration `database/migrations/004_create_loom_tables.sql` with DDL for the five tables + enums.
2. Run `npm run migrate` (or psql) and commit.

_Phase 2 – Backend Core_
3. Add route file `backend/routes/loom.js`:
   • `POST /api/v1/loom/generate` `{windowWeeks:4}`  
   • `PATCH /api/v1/loom/resize` `{windowWeeks:8}`  
   • `GET /api/v1/loom/instances?start=...&end=...`  
4. Create `backend/services/loomEngine.js` with methods:
   • `generateWindow(windowWeeks)`  
   • `resizeWindow(newWeeks)`  
   • `handleParticipantCancellation(allocationId, type)`  
   • `handleStaffSick(shiftId)`  
   • uses existing services: participantService, routeOptimizationService.  
5. Wire controller `backend/controllers/loomController.js`.

_Phase 3 – Frontend Controls_
6. Add Loom context slice in `frontend/src/context/AppContext.jsx`.
7. New page **LoomSettings** or modal (under Dashboard navbar):
   • window slider (2-16)  
   • “Generate / Resize” button → API call  
8. Modify MasterSchedule & Dashboard pages to consume `/loom/instances` for display.

_Phase 4 – Dynamic Updates_
9. WebSocket or polling endpoint `/api/v1/loom/updates` to push changes → colour-coded updates on UI.
10. Add toast / banner when a shift is red-flagged.

_Phase 5 – Billing Sync_
11. Extend `financeService.js` to read from `tgl_loom_participant_allocations` instead of legacy attendance when `status='finalised'`.

## 7. Rollback Plan
• **DB:** Each migration gets a down script to drop loom tables.  
• **Code:** feature branch `loom-integration`; merge only after tests pass.  
• **Config Flags:** `.env` flag `ENABLE_LOOM=true`; toggle off to hide routes/UI.  
• **Backup:** nightly pg_dump before running migrations.  
If failure:  
1. Toggle `ENABLE_LOOM=false`.  
2. Rollback SQL migration (`npm run migrate:down`).  
3. Redeploy previous commit.

## 8. Success Criteria
| Phase | KPI |
|-------|-----|
| Schema ✓ | Migration runs with zero errors; tables visible in `\dt` |
| Engine ✓ | `POST /loom/generate` returns 201 and creates rows for next X weeks |
| UI ✓ | Loom window slider adjusts instance count correctly |
| Dynamic ✓ | Cancelling participant auto-rebalances and billing preview updates in <3 s |
| Exception ✓ | Staff sickness shows red-flag on Dashboard |
| Billing ✓ | Finance export uses loom allocations; short-notice rules reflected |
| Performance ✓ | 16-week window with 200 participants, <5 s generation time |

When all KPIs pass in manual tests, the Loom is considered fully integrated.
