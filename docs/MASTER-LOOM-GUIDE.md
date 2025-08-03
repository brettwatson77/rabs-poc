# MASTER LOOM IMPLEMENTATION GUIDE  
*A perpetual calendar scheduling & resource-allocation engine for RABS*  

---

## 1. Complete Q & A Context (Quick Reference)

| Topic | Brett’s Answers / Clarifications |
|-------|----------------------------------|
| Interface Integration | Existing pages **are** the loom interface. • **MasterSchedule** – create / modify programs & recurring rules. • **ParticipantPlanner** – add / remove participants, cancellations, date-based edits. • **Vehicles / Staff / Venues** pages – add resources the loom can use immediately. |
| Blank Slate | No legacy schedules; only participants, staff, vehicles, venues exist. |
| Capacity | System does **not** hard-block over-capacity. It flags warnings and auto-adds staff/vehicles. |
| Operator Control | Operators can: 1) create/end programs, 2) add/remove participants (with start/end dates), 3) swap staff/vehicles, 4) cancel / reschedule single instances, 5) make program rule changes “from this date forward” and later revert. No formal approval workflow—two operators coordinate manually. |
| Temporal Model | All changes follow **“from this date forward”** propagation. Single-day overrides are done by change-and-revert method. |
| Rolling Window | Window size 2-16 weeks. Always calendar-date based (e.g., “Oct 1 → Oct 28”). Every midnight SYD time the window rolls one day and autogenerates the new last day. |
| Persistence | • Template layer (programs) permanent • Instance layer (generated) recreatable • Intent layer (operator plans) permanently stored • Exception layer (one-off cancellations, etc.) permanently stored. |
| Timezone & Roll Reliability | Sydney timezone. Auto-roll at 00:05, verification at 09:00; retry then alert. Manual “regenerate day” buttons in UI. |
| Billing | Multiple NDIS billing codes per participant per program. Real rates loaded (NF2F, Centre Capital, etc.). |
| No Week Numbers | Never talk “week 4”, always calendar dates. |
| Vehicle / Staff Rules | 1 lead + 1 support per 5 participants. Bus runs re-optimise automatically when allocations change. |
| Failure Handling | If DB/API down at roll: retry, then flag. Manual button visible under each day to regenerate. |

---

## 2. Key System Requirements

1. **Interface Integration**  
   The current React pages remain; backend endpoints feed them loom-aware data. No separate “loom UI”.

2. **Calendar-Based Dates**  
   All logic keyed on actual dates. Window is “today → today+N”.

3. **Automatic Daily Rolling**  
   Cron/task at 00:05 AEST adds the next day, deletes the day that rolled out, applies intents/exceptions, assigns resources.

4. **Persistence Layers**  
   • `programs` (templates)  
   • `tgl_loom_instances` (active window)  
   • `tgl_operator_intents` (persistent rules)  
   • `tgl_temporal_exceptions` (one-offs)  

5. **“From This Date Forward” Propagation**  
   Change recorded with `start_date`; system reapplies whenever future instances re-generate.

6. **Unlimited Capacity with Auto-Scaling**  
   System never rejects participant adds; instead auto-adds staff/vehicles and flags venue capacity issues.

7. **Sydney Timezone & Failure Handling**  
   Mid-night roll + 9 am verification + UI manual regenerate; logs + alerts.

---

## 3. Real-World Scenarios (Should Work End-to-End)

| Scenario | Expected Engine Behaviour |
|----------|--------------------------|
| Sarah joins Centre-Based Wednesdays starting **7 Oct** | Intent stored; all Wed instances ≥ 7 Oct include Sarah; staff & bus routes update. |
| John cancels Saturday Adventure on **6 Nov** | Exception stored; instance on 6 Nov marks John cancelled, re-optimises staff/vehicle. |
| John permanently leaves Sat Adventure **15 Dec** then joins Sun program **16 Dec** | Departure intent on 15 Dec removes him from Sat thereafter; transfer intent adds him to Sun from 16 Dec. |
| Temporary time change on **20 Sep** (+1 hr) then revert **27 Sep** | Two intents: modify 20 Sep forward; revert starting 27 Sep forward. Only 20 Sep extended. |
| Window shrinks 16 → 2 weeks then expands back | Instances outside new window deleted; intents/exceptions persist; when expanded, instances recreate with correct allocations. |

---

## 4. Technical Architecture

### 4.1 Database (PostgreSQL)

* All primary keys UUID.  
* Core tables shown below:  

```
participants, staff, vehicles, venues
programs
program_participants
tgl_loom_instances
tgl_loom_participant_allocations
tgl_loom_staff_shifts
tgl_loom_vehicle_runs
tgl_operator_intents
tgl_temporal_exceptions
tgl_loom_audit_log
settings
billing_codes
```

Indexes on dates, foreign keys, and status fields for window queries.

### 4.2 Backend Services

* **Loom Engine V2**
  * `dailyRoll()` – called by cron
  * `generateMissingInstances(start,end)`
  * `applyOperatorIntents(range)`
  * `applyTemporalExceptions(date)`
  * `assignStaffAndVehicles(instance)`
  * Transaction-safe, audit-logged.

* **API Endpoints** (prefix `/api/v1/loom`)
  * `GET /window-size`
  * `PATCH /window-size` (resize)
  * `GET  /window` – returns current calendar-range (start + end ISO dates)
  * `POST /roll` – **manual** “run daily roll now” trigger (admin/ops)
  * `POST /intents` / `/exceptions`
  * Resource regeneration endpoints per day.
  
  All dates in requests & responses **MUST** be ISO-8601 `YYYY-MM-DD`.

### 4.3 Frontend Integration

* **MasterSchedule.jsx** – **PRIMARY interface** (unchanged layout) that now reads `tgl_loom_instances`; program edit modal writes intents/exceptions.  
* **ParticipantPlanner.jsx** – CRUD participant intents / cancellations (tabs retained).  
* **Vehicles/Staff pages** – immediate resource list refresh (no restart).  
* **Navbar** unchanged—loom routes are *behind* the existing menu items.

> **NOTE — UI APPROACH**  
> • All existing pages remain the core workflow.  
> • Any new component (e.g., calendar strip) is **optional** and **never replaces** the MasterSchedule grid.  
> • Future-date planning beyond the active window is handled via a simple **date-picker dialog** launched from MasterSchedule/ParticipantPlanner.

**New Front-End Components / UX Tweaks**

| Component | Purpose |
|-----------|---------|
| **42-Day Calendar Strip (Optional)** | Horizontal slider (visual aid only) showing ~6-week window; colour-codes each instance:<br>• Grey = generated default<br>• Blue = intent-modified<br>• Orange = exception/cancellation |
| “Next Auto-Roll at …” Banner | Replaces *Generate* button; shows cron ETA; turns red if last roll failed. |
| Manual Roll Button | Only visible to admins; invokes `POST /api/v1/loom/roll`. |

---

## 5. Phase-By-Phase Implementation Checklist

| Phase | Deliverables |
|-------|--------------|
| 0. **Foundation (DONE)** | Nuclear schema with UUID + real billing codes ✔ |
| 1. Engine Core | Daily roller service + cron job; tests with dummy program |
| 2. Intent & Exception APIs | CRUD endpoints, validation, audit log |
| 3. Frontend Wiring | Modify MasterSchedule & ParticipantPlanner to call new APIs, show intents/exceptions badges |
| 4. Staff & Vehicle Automation | Auto-assign logic + route optimiser; update Roster & Vehicles pages |
| 5. Billing Integration | Generate billing lines from allocations; expose Finance reports |
| 6. Resilience & Ops | Verification job at 09:00, manual regenerate buttons, alerting hooks |
| 7. Performance & Scale | **Target:** roll 16-week window with 10-year future intents in **< 2 min**; index tuning |
| 8. UAT & Sign-off | Real data import (Week A/B), operator training, final polish |

---

## 6. Risk Prevention & Pitfalls

1. **Deleting Operator Data** – Always delete only `tgl_loom_instances`; never delete intents/exceptions.  
2. **Time-Zone Bugs** – Use `Australia/Sydney` everywhere; store timestamps with TZ.  
3. **Propagation Errors** – Unit-test date-range math for “from this date forward” and revert cases.  
4. **Long Transactions** – Daily roll must chunk by program/date to avoid long locks.  
5. **API Inconsistency** – Single source (`/api/v1/loom`) for all date-based actions to prevent duplicate business logic.  
6. **Capacity Blow-Out** – Auto-add staff/vehicles but surface warnings in UI dashboard.  
7. **Cron Failure** – 09:00 verifier + manual regenerate buttons; log error reason.  
8. **UI Drift** – Keep Figma / design tokens synced; master schedule column widths stable for 16-week view.
9. **Feature-Flag Mis-cut-over** – Dual-run with `loom_v2_enabled=false`; reconciliation script compares v1 vs v2 outputs until parity reached.

---

## 7. Testing Strategy

1. **Unit Tests**
   * Date utilities: nextRollDate, windowRange, propagation logic  
   * Engine functions: generateMissingInstances, applyIntent, applyException

2. **Integration Tests (Jest + Supertest)**
   * Create program → add participant intent → roll → assert allocation exists  
   * Shrink window → expand → allocations still correct
   * Run with **in-memory Postgres** (e.g., `pg-mem`) for speed & isolation

3. **Scenario Playback**
   * Load Week A template CSV into intents/exceptions import script  
   * Simulate 30-day roll in 5 minutes → verify counts & billing totals
   * **Regression:** compare v1 vs v2 JSON exports for identical date range

4. **Failure Injection**
   * Drop DB connection at midnight roll → ensure retry + alert  
   * Corrupt one vehicle route → ensure instance flagged `needs_attention`

5. **Performance**
   * 10-year future intents (≈ 500k rows) → roll job < 2 minutes  
   * 200+ concurrent operator edits without deadlock
   * House-keeping job `purgeInstancesBefore(today-90)` keeps instance table small

6. **User Acceptance**
   * Operators execute real workflows: create program, cancel participant, modify time.  
   * Compare generated Week A/B billing export with existing manual sheet.

---

## 8. Glossary (Quick Look-Up)

* **Active Window** – Calendar range [today, today+N] that has materialised instances.  
* **Intent** – Persistent rule (add/remove/modify) applied when date rolls into window.  
* **Exception** – One-off adjustment for a specific date.  
* **Instance** – Generated occurrence of a program on a date.  
* **Daily Roll** – Nightly job that advances window and regenerates final day.  

---

## 9. Contact & Ownership

* Product Owner: **Brett Watson**  
* Tech Lead: *(to assign)*  
* Documentation maintainer: **Engineering Team – Loom**  

> Keep this guide up-to-date with every requirement clarification. **If it’s not in here, it’s not in scope.**

---

### 🔗  Appendix — Implementation Tooling

* **Cron / Job Runner:** `node-cron` (simple) or `agenda` (Mongo-backed) – POC uses `node-cron` @ 00:05 AEST  
* **Health Check:** `/api/v1/loom/health` returns last roll timestamp, queue length  
* **Retry Queue:** Failed roll jobs pushed into BullMQ queue; retried every 10 minutes until success or manual resolution  
* **Data Migration:** `scripts/reconcile-loom.js` compares legacy data, promotes manual edits to `tgl_operator_intents`  
* **Back-ups:** Nightly pg_dump of `tgl_loom_*`, `tgl_operator_intents`, `tgl_temporal_exceptions` before any destructive migration  
