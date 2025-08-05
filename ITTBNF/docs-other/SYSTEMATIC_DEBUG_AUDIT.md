# SYSTEMATIC_DEBUG_AUDIT.md  
_A playbook for aligning the RABS-POC backend & frontend_  
Author: AI Factory Assistant – 2025-07-28

---

## 0  Purpose & Scope
This audit provides a **fundamentals-first debugging path** that mirrors how experienced dev teams trace mismatches between independent backend / frontend efforts.  
It is **not** the fix itself—it's the checklist that guarantees we reveal every inconsistency.

---

## 1  Infrastructure Fundamentals

| Area | Critical Checks | Verification Commands | Notes |
|------|-----------------|-----------------------|-------|
| **Environment (.env)** | `USE_POSTGRES=true`, port `3009`, DB creds match pgAdmin | `cat backend/.env` | Any wrong flag breaks every service. |
| **Server (backend/server.js)** | All routers mounted, CORS whitelist, body-parser | `grep "app.use" backend/server.js` | Missing mount = instant 404. |
| **Database Wrapper (backend/database.js)** | `convertPlaceholders()` correctness, pool export, wrapper methods (`all`,`get`) | Run unit test `node scripts/test-pg.js` | Bug currently turns `?` → `$33` etc. |
| **Migrations folder** | `000_operational_base.sql`, `001_tgl_core.sql` fully applied | `psql rabspocdb \\\d` | Missing tables trigger 42P01 / 42703 errors. |
| **CORS / Proxy** | Vite dev host (`3008`) allowed | curl from browser console | Blocked origin looks like ECONNREFUSED but backend never logs. |

---

## 2  Backend Route & Service Inventory

| Route Prefix | Controller File | Service File | Status | Key Issues Found |
|--------------|-----------------|-------------|--------|------------------|
| `/api/v1/venues` | routes/venues.js → **OK** | services/venueService.js | ✅ Working after direct-pg patch |
| `/api/v1/vehicles` | routes/vehicles.js | services/vehicleService.js | ⚠️ Uses SQLite wrapper → placeholder bug |
| `/api/v1/participants` | routes/participants.js | services/participantService.js | ⚠️ Same bug; missing new columns added |
| `/api/v1/staff` | routes/staff.js | services/staffService.js | ⚠️ Works for list, fails on `/hours` (needs `staff_assignments`) |
| `/api/v1/cards` | routes/api/v1/cards.js | services/eventCardService.js | ❌ Column `cm.instance_id` missing (`event_card_map` table not migrated) |
| `/api/v1/dashboard` | routes/api/v1/dashboard.js | services/dashboardService.js | ⚠️ Controllers skeleton only |
| `/api/v1/finance` | routes/finance.js | services/financeService.js | ✅ Returns summary & pnl but JSON shape nested |
| `/api/v1/planner` | routes/planner.js | services/plannerService.js | 🛠️ supervision logic TODO |
| (others…) |  |  |  |  |

---

## 3  Frontend API Call Catalogue

| Page Component | Detected Calls (api.js) | Params Expected | Data Shape Expected |
|----------------|-------------------------|-----------------|---------------------|
| `Dashboard.jsx` | `/dashboard/metrics`, `/dashboard/timeline` | none yet | `{revenue,costs}` flat arrays |
| `MasterSchedule.jsx` | `/cards/master?startDate&endDate` | `startDate`,`endDate` | `[ { id, title, staff[], participants[] } ]` |
| `Roster.jsx` | `/roster/timesheet?from&to`, `/roster/export/csv` | `from`,`to` | CSV blob |
| `Vehicles.jsx` | `/vehicles` | — | `[ { id, name, capacity, status } ]` |
| `Venues.jsx` | `/venues` | — | `[ { id, name, capacity, amenities{} } ]` |
| `Participants.jsx` | `/participants` | optional `page,limit` | `[ { id, name, supervision_multiplier } ]` |
| `Staff.jsx` | `/staff`, `/staff/hours?from&to` | optional | `[ { id, level, hours } ]` |

---

## 4  Gap Analysis (Backend ↔ Frontend)

| Page | Gap Type | Detail | Action |
|------|----------|--------|--------|
| Vehicles | ⚠️ Wrapper bug | Placeholder conversion hangs | Convert service to direct-pg |
| Venues | ✅ Fixed | — | — |
| Participants | ⚠️ Wrapper bug, two new columns missing in UI | Direct-pg + map `support_needs` | |
| Staff | ❌ Missing `staff_assignments` table | Create table + service | |
| MasterSchedule | ⚠️ Param names mismatch (`startDate` vs `start`) | Alias or refactor | |
| Dashboard | ❌ Controllers incomplete, frontend old | Build metrics & timeline controllers; new UI | |
| Finance | ⚠️ Shape mismatch | Map nested metrics or flatten API | |

---

## 5  Debugging Workflow (Brett-Style)

1. **Sanity Smoke:**  
   `curl http://localhost:3009/api/v1` → expect JSON welcome  
   `curl http://localhost:3009/api/v1/venues` → expect rows

2. **Infrastructure Checklist:**  
   • `grep USE_POSTGRES backend/.env`  
   • `psql -c "\dt"` confirm tables  

3. **Service Unit Test:**  
   For each service `node scripts/test-<service>.js` (pattern used by `test-venues-endpoint.js`)

4. **Page Connect:**  
   In browser dev-tools Network tab verify `/api/v1/...` returns 200 + expected JSON.

5. **Iterate:**  
   Fix backend first (fast), then adjust component props mapping.

---

## 6  Immediate Action Queue (Phase 1 – Simple Pages)

| Priority | Task | Assignee |
|----------|------|----------|
| P1 | Rewrite `vehicleService.js` to match venue pattern | backend |
| P1 | Rewrite `participantService.js` (direct-pg) | backend |
| P1 | Create `staff_assignments` table + minimal sample data | dba |
| P2 | Patch `convertPlaceholders()` or remove wrapper reliance | backend |
| P2 | Participants & Vehicles UI: add new fields/badges | frontend |
| P3 | Alias route param names in cardsRouter | backend |

---

## 7  Useful One-Liners

```bash
# List postgres tables
psql rabspocdb -c "\dt"
# Quick wrapper health check
node -e "require('./backend/database').getDbConnection().then(db=>console.log('OK')||db.close())"
# Test any endpoint with 3s timeout
curl -m 3 http://localhost:3009/api/v1/vehicles
```

---

## 8  Next Review
Once **Phase 1 tasks** are complete, re-run this audit and update the Gap table.  
> **Goal:** four simple pages fully functional before tackling TGL timeline.
