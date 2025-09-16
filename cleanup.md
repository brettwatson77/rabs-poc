# RABS v3 – Cleanup Plan and File Categorization

This document lists what is required for the current app to run, what is only needed for development or docs, what looks unused, and what still needs investigation.  
Scope: based on import tracing and file inspection done to date. When in doubt an item is placed in **Uncertain**, not moved.

---

## Categories

* Essential (runtime)
* Development / Build
* Documentation
* Archive candidates (appear unused)
* Uncertain (investigate before moving)

---

## Essential (runtime)

### Backend
* `backend/server.js` – Express entrypoint, env, pg Pool, logger, health routes, route mounting  
* `backend/logger.js` – central logging (DB + SSE)  
* `backend/routes/index.js` – mounts all API modules  
* Route modules in active use  
  * `backend/routes/participants.js`  
  * `backend/routes/staff.js`  
  * `backend/routes/programs.js`  
  * `backend/routes/loom.js`  
  * `backend/routes/templates.js`  
  * `backend/routes/roster.js`  
  * `backend/routes/finance.js`  
  * `backend/routes/settings.js`  
  * `backend/routes/venues.js`  
  * `backend/routes/vehicles.js`  
  * `backend/routes/dashboard.js`  
  * `backend/routes/logs.js`  
  * `backend/routes/intentions.js`  
  * `backend/routes/system.js`  
  * `backend/routes/changes.js`  
  * `backend/routes/calendar.js`  
* `backend/routes/util_syncRethread.js` – helper used by templates/loom flows

### Frontend
* `frontend/src/App.jsx` – React shell & routing  
* `frontend/src/api/api.js` – axios instance + helpers (base `/api/v1`)  
* Page components currently routed in `App.jsx`  
  * `frontend/src/pages/Dashboard.jsx`  
  * `frontend/src/pages/MasterSchedule.jsx`  
  * `frontend/src/pages/Roster.jsx`  
  * `frontend/src/pages/Finance.jsx`  
  * `frontend/src/pages/Settings.jsx`  
  * `frontend/src/pages/Participants.jsx`  
  * `frontend/src/pages/Staff.jsx`  
  * `frontend/src/pages/VehiclesFull.jsx`  
  * `frontend/src/pages/Venues.jsx`  
  * `frontend/src/pages/ProgramTemplateWizard.jsx`  
* `frontend/src/components/SystemLogPanel.jsx` (consumes `/api/v1/logs` SSE)  
* `frontend/src/styles/**`

> **Why essential?**  These files are imported directly by the app entrypoints or referenced via live routes; moving them breaks runtime.

---

## Development / Build

| Path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json`, `.gitignore` | root tooling |
| `frontend/package.json` | FE deps/scripts |
| `frontend/vite.config.js` | dev server & proxy |
| `frontend/.eslintrc.cjs` | lint rules |
| `.husky/**` | pre-commit hooks |
| `scripts/precommit-guard.js` | file guard |
| `scripts/getreport*.js` | ad-hoc report helpers |

---

## Documentation

Root-level markdown references (runtime-neutral):

* `README.md`
* `MASTER_SPEC.md`
* `CURRENT_API.md`
* `CURRENT_DATABASE.md`
* `introduction.md`
* `DEVELOPMENT_WORKFLOW.md`
* `FACTORYAI_RUNBOOK.md`
* `COMPREHENSIVE_SYSTEM_AUDIT.md`
* `TREE.md`

---

## Archive candidates (appear unused)

Path | Notes
--- | ---
`ITTBNF/**` | legacy experiments
`FactoryAI_Code_Stubs/**` | scaffold stubs
`Workshed_Loom_Starter_Pack/**` | old starter pack
`reportcards/**` | generated reports
`resources/BILLINGexamples/**` | sample CSVs
`backend/database.js` | standalone Pool – **not imported**
`backend/routes/._*.js` | macOS resource junk
`scripts/CURRENT_API.md`, `scripts/CURRENT_DATABASE.md` | duplicate docs
`backend/routes/master-schedule.js` | legacy route (FE now uses `/loom/*`), creates its own Pool & outdated log schema

_No runtime references detected; safe to quarantine first._

---

## Uncertain (investigate before moving)

Path | Reason to keep for now
--- | ---
`backend/routes/calendar.js` | mounted; not yet referenced by UI but may serve future features
`backend/routes/changes.js` vs FE helper `getWeeklyChangeLog` | endpoint mismatch; verify before removal
Any other small util modules indirectly required by routes above | double-check import graph before archiving

---

## Recommended cleanup workflow

1. **Create feature branch**  
   `git checkout -b chore/cleanup-archive-sweep`

2. **Add `/archive` folder** at repo root.  
   Move only items listed under *Archive candidates*.

3. **Smoke-test full app:**  
   * Run backend `npm start` → check `/health`.  
   * Run frontend `npm run dev` → click through Dashboard → Schedule → Roster → Wizard → Finance → Settings.  
   * Watch console/server for 404/500.

4. **If something breaks:**  
   Move the file back or `git revert` the move commit.

5. **Open PR** with:  
   * Link to this document  
   * Summary of moved paths  
   * Evidence (screenshots / logs) that key flows still work.

6. **After merge:**  
   * Optionally add `/archive/**` to lint/CI ignore.  
   * Delete archived code permanently once confidence is high.

---

### Why “move then test” is preferred

* Zero-risk rollback (git revert).  
* Makes unused code obvious without deleting history.  
* Common industry practice for large refactors.  
* Encourages incremental cleanup in later passes.

---

_Approved items can be archived now; “Uncertain” items stay put until verified._
