# System Dependency Map (RABS + Loom)

This document is the **master reference** for understanding how every piece of the RABS application fits together.  
Use it to debug holistically, plan refactors, or on-board new devs.

---

## 1. Bird’s-Eye Architecture

```
┌──────────┐    REST/WS     ┌──────────────┐
│ Frontend │ ──────────────►│  API Layer   │
└──────────┘                │ (Express.js) │
   ▲   ▲                    └──────┬───────┘
   │   │                            │
   │   │ WebSockets                 │ Postgres (pg pool)
   │   └────────────────────────────▼─────────────┐
   │                                  ┌───────────▼───────────┐
   │                                  │  Loom Logic Engine    │
   │                                  │ (cron + services)     │
   │                                  └───────────┬───────────┘
   │                                              │
   │       Change events / audit                  │
   │                                              ▼
   │                                  ┌───────────────────────┐
   │                                  │  Audit / Logger       │
   │                                  └───────────────────────┘
   │
User Browser (pages)  <──────── business data ────────►  Reports / Exports
```

---

## 2. Core Components & Relationships

| Component | Description | Direct Dependencies |
|-----------|-------------|---------------------|
| **Master Schedule** | Calendar UI (primary UX) | Loom API, Participant, Staff, Vehicle, Venue, Rates |
| **Dashboard (Timeline Cards)** | KPI snapshots & alerts | Finance API, Audit Log, Loom Status |
| **Loom Engine** | Perpetual calendar roller + optimisation | Postgres (`tgl_*` tables), Settings, Availability, Google Maps |
| **Finance System** | Billing, rates, exports | Participants, Programs, Rates, Timesheets |
| **Audit / Logger** | Change tracking + alert feed | Every controller & service |

---

## 3. Data-Flow Dependencies

```
Participants ─▶ Programs ─▶ Master Schedule
       │                │
       │                └▶ Finance (costs)
       └─▶ Rates ─▶ Finance ─▶ Billing Exports
Staff & Vehicles ────────────► Loom Allocation ──► Master Schedule
Venues ──────────────────────► Route Optimiser ──► Loom
```

*Breaking any upstream node blocks every downstream arrow.*

---

## 4. Page / UI Dependencies

| Page (Route) | Depends on Services | Critical Tables / Columns |
|--------------|--------------------|---------------------------|
| `/master-schedule` | loomInstances, participants, staff, vehicles, venues, rates | `tgl_loom_instances`, `participants.supervision_multiplier`, `vehicles.status` |
| `/dashboard` | financeMetrics, auditFeed | `program_participants.status`, `tgl_loom_audit_log.action` |
| `/participants` | participantService | `participants.*`, `rates.*` |
| `/staff` | staffService, availabilityService | `staff_unavailabilities` |
| `/vehicles` | vehicleService, availabilityService | `vehicle_blackouts` |
| `/loom-controls` | loomConfigService | `tgl_settings.*` |

---

## 5. Database Schema Dependencies

| Feature | Must-have Tables / Columns | Missing column error knocks out |
|---------|---------------------------|---------------------------------|
| Finance metrics | `program_participants.status` | Dashboard cards & exports |
| Supervision logic | `participants.supervision_multiplier` | Staff allocation, alerting |
| Loom audit | `tgl_loom_audit_log.action` | Change history, real-time alerts |
| Loom settings | `tgl_settings` table | All LoomControls operations |
| Enrollment changes | `pending_enrollment_changes.status` | Recalculation endpoint |

---

## 6. Service Layer Dependencies

```
availabilityService
   ├─ uses vehicleService & staffService
   └─ feeds → loomLogicEngine

loomLogicEngine
   ├─ consumes settingsService
   ├─ calls routeOptimizationService (Google Maps)
   ├─ writes audit via loomLogger
   └─ emits instances to masterScheduleService

financeService
   ├─ consumes rateService
   ├─ aggregates timesheetService
   └─ supplies dashboardFinanceService
```

*Circular calls are prohibited; audit logging is the only side-effect permitted across boundaries.*

---

## 7. Error Propagation Chains

| Origin Error | Downstream Effects | Observed Log Lines |
|--------------|-------------------|--------------------|
| `column "status" does not exist` in `program_participants` | Finance metrics ➜ Dashboard cards fail ➜ Master Schedule cost badges blank | `dashboard.js:51,120,170` |
| SQLite wrapper `db.close is not a function` | Vehicle/Venue services fallback ➜ Resource views empty ➜ Loom allocation cannot assign vehicles | Wrapper failed… |
| Invalid staff ID `"with-schads"` | Staff profile fetch fails ➜ Master Schedule sidebar blank ➜ Allocation engine skips staff | `staffService: getStaffById` |
| `tgl_loom_audit_log.action` missing | Updates still process but no change feed ➜ Dashboard alerts silent ➜ Compliance gap | LoomConfig update error |

---

## 8. Current Error–Impact Matrix (2025-08-02)

| Priority | Error | Root Cause | Affected Pages | Blocker? |
|----------|-------|-----------|----------------|----------|
| P0 | Missing `status` columns | Old schema versions | Dashboard, Finance exports, MasterSchedule cost badges | **Yes** |
| P0 | Missing `action` column in audit log | Partial table creation | LoomControls save, real-time alerts | **Yes** |
| P1 | SQLite wrapper still used | Legacy service code | Vehicles, Venues lists | Partial |
| P1 | Staff ID routing bug | React-router param mismatch | Staff modal, allocations | Partial |
| P2 | Fake simulation alerts | Demo seed script auto-running | Dashboard noise | Cosmetic |

---

## 9. Fix-Priority Matrix

| Fix | Unlocks | Effort | Priority |
|-----|---------|--------|----------|
| ① Add `status` & `action` columns via migration | Dashboard + Finance + Audit | Low | 🔴 High |
| ② Remove SQLite wrappers; switch to pg pool in `vehicleService` & `venueService` | Resource lists, allocation | Medium | 🟠 Med |
| ③ Router param sanity (`with-schads` bug) | Staff fetch, assignments | Low | 🟠 Med |
| ④ Disable demo seed generator | Clean prod logs | Very Low | 🟢 Low |
| ⑤ Full refactor of legacy *recalculationService* (if still needed) | Future-proofing | High | 🟢 Later |

---

## 10. How to Use This Map

1. **Pick Highest-Priority Error** (section 8).  
2. **Check Dependency Tables** (section 5) → create migration if missing.  
3. **Verify Upstream Services** (section 6) compile with no legacy wrappers.  
4. **Run the app** – if downstream pages now work, move to next error.  
5. Document each round of fixes directly in this map.

Keep this file updated after every migration or major refactor – it’s the single source of truth for the *interconnected loom mystery*.
