# COMPLETE_SYSTEM_AUDIT.md  
_Author: AI Factory Assistant – 2025-07-28_

## 1. Executive Summary
The **backend (PostgreSQL + TGL)** is largely complete while the **frontend React app** is still the legacy version baked for SQLite. Pages call endpoints that have moved or that now return richer objects. This audit maps every page ⇄ API pair, flags mismatches, and lists the exact work required to unify the system.

---

## 2. Legend
• ✅ Match – endpoint exists and response shape fits the component  
• ⚠️ Shape – endpoint exists but JSON structure/params differ  
• ❌ Missing – route or controller not present  
• 🛠️ TODO – component/UI not yet created or needs heavy refactor

---

## 3. Page ↔ API Matrix

| Page (Route) | API Call(s) Detected | Status | Notes / Fix Actions |
|--------------|---------------------|--------|---------------------|
| **Dashboard** (`/dashboard`) | `/api/v1/dashboard/metrics`<br>`/api/v1/dashboard/timeline`<br>`/api/v1/cards/master` | ❌ route registered, but controller incomplete<br>⚠️ param mismatch (`start/end` expected, component sends none) | 1. Finish dashboard controllers.<br>2. Update Dashboard.jsx to send `start`,`end` (ISO).<br>3. Build Timeline UI (+5 columns). |
| **Master Schedule** (`/schedule`) | `/api/v1/cards/master?startDate&endDate` | ⚠️ wrong param names<br> backend expects `start`,`end` | Rename params in MasterSchedule.jsx or add alias in route middleware. |
| **Roster** (`/roster`) | `/api/v1/roster/timesheet?from&to`<br>`/api/v1/roster/export/csv` | ✅ routes exist<br>⚠️ CSV download not wired to button | Wire timesheet export button. Add file-download helper. |
| **Finance** (`/finance`) | `/api/v1/finance/summary?period`<br>`/api/v1/finance/pnl?from&to` | ✅ endpoints exist | Component expects `revenue, costs` keys – backend returns nested `metrics`. Map or refactor. |
| **Participant Planner** (`/participants/planner`) | `/api/v1/participants`<br>`/api/v1/planner/supervision/:id` | ⚠️ second endpoint skeleton only | Build planner controller to compute supervision load per participant. |
| **Participants** (`/participants`) | `/api/v1/participants` | ⚠️ pagination not implemented | Add `?page&limit` support or remove from component. |
| **Staff** (`/staff`) | `/api/v1/staff`<br>`/api/v1/staff/hours?from&to` | ❌ `staff/hours` fails (missing `staff_assignments` table) | Create `staff_assignments` table + service OR remove stats widget until built. |
| **Vehicles** (`/vehicles`) | `/api/v1/vehicles` | ✅ endpoint and wrapper OK | UI shows but missing new columns (`vehicle_type`, etc.) – extend card component. |
| **Venues** (`/venues`) | `/api/v1/venues` | ✅ after direct-PG patch | Frontend loads after rebuild; add amenities/accessibility badges. |
| **Settings** (`/settings`) | none (static) | 🛠️ planned | Build settings page: edit `tgl_config`, `settings` tables. |

---

## 4. Global Backend Issues

| Issue | Impacted Pages | Fix |
|-------|---------------|-----|
| Broken `convertPlaceholders()` in DB wrapper | any SQLite-styled service | Rewrite function (regex counter bug) OR move all services to direct `pg` queries. |
| Missing TGL tables (`event_card_map`, `loom_instances`, `history_ribbon_*`) | Dashboard, MasterSchedule | Run `run-tgl-migration.js` fully; verify schema. |
| Missing `staff_assignments` table | Staff page, Payroll calc | Implement table + sample data generator. |
| Old SQLite services still referenced (participantsService, vehiclesService, etc.) | All simple pages | Replace each with direct-pg pattern used in `venueService`. |

---

## 5. Per-Page Detailed Checklist

### 5.1 Vehicles
Backend:
- [ ] Replace `vehiclesService` with direct-pg (wrapper fallback).
- [ ] Ensure columns `vehicle_type,wheelchair_access,status,rego_expiry,insurance_expiry`.

Frontend:
- [ ] Render new columns.
- [ ] Status colour badges.

### 5.2 Venues
Backend: **done** (direct-pg service).
Frontend:
- [ ] Amenities & accessibility icons.
- [ ] Booking-lead-time indicator.

### 5.3 Participants
Backend:
- [ ] Add columns `plan_management_type,support_needs` populated.
Frontend:
- [ ] Map `support_needs` JSON → chips list.
- [ ] Add supervision slider in modal (uses `/planner/supervision`).

### 5.4 Staff
Backend:
- [ ] Create `staff_assignments` table.
- [ ] Implement `getStaffHours(from,to)` query.

Frontend:
- [ ] Hours graph widget conditional until API ready.

### 5.5 Dashboard
Backend:
- [ ] Finish `dashboardController` (metrics, timeline).
- [ ] Expand `cards` service to explode master-cards.

Frontend:
- [ ] Build Timeline component (Earlier/Before/NOW/Next/Later).
- [ ] P&L panels, SCHADS cost overlay.
- [ ] Use WebSocket or polling for live updates.

### 5.6 Master Schedule
Backend:
- [ ] Alias param names or update component.
Frontend:
- [ ] Tabs for shift types (CB, Social, Night…).
- [ ] Column virtualisation (week/fortnight).

### 5.7 Roster
Backend:
- [ ] Confirm CSV generation path returns file.
Frontend:
- [ ] Hook export button → open file.
- [ ] Exclude staff without shift notes before export.

### 5.8 Finance
Backend: **complete**
Frontend:
- [ ] Map `metrics` to chart dataset (Recharts).
- [ ] Date-range picker glue.

### 5.9 Participant Planner
Backend:
- [ ] `/planner/supervision/:id` – aggregate events × multiplier.
Frontend:
- [ ] Supervision load gauge.
- [ ] Future-enrolment timeline.

---

## 6. Roadmap & Priorities

| Phase | Goal | Tasks |
|-------|------|-------|
| **Phase 1 – Simple Pages LIVE** | Have 4 pages fully functional | Vehicles, Venues, Participants, Staff (list) – complete direct-pg services + column patches + UI tweaks |
| **Phase 2 – Shared Services** | Remove placeholder bug | Rewrite/replace DB wrapper; finish `staff_assignments` and pagination helpers |
| **Phase 3 – Complex Timeline** | Bring TGL magic to UI | Finish MasterSchedule explosion logic, Dashboard metrics/timeline, Event-Card modals |
| **Phase 4 – Payroll / Exports** | End-to-end SCHADS → Xero | Finish timesheet CSV, penalty calculations, export UI |
| **Phase 5 – Polish & Settings** | Admin controls | Settings page, pgAdmin link, .env editor |

---

## 7. Immediate Next Actions (Today)

1. **Confirm Venues page** loads after patch ▸ _done?_
2. **Apply direct-pg pattern** to `vehiclesService`, `participantsService`, `staffService`.
3. Run `fix-simple-tables.js` (already adds columns) then refresh pages.
4. Verify `/api/v1/participants` returns data (curl).
5. Update Participants.jsx to show new fields.
6. Re-run audit ✔ once Phase 1 complete.

---

## 8. References
- Backend API Map: `docs/03_Development_&_Operations/04_API_Backend_Reference_Map.md`
- POC-LOG entries for timeline rules & supervision logic.
