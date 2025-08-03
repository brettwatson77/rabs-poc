# RABS – Fake Data Cleanup Summary

_Last updated: 02 Aug 2025_

---

## 1. Primary Issue Resolved

| Area | Problem | Fix |
|------|---------|-----|
| **MasterSchedule.jsx** | Hard-coded test participant array `['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emma Wilson']` rendered in event-creation modal. | Replaced with `participantsList` fetched once from `GET /api/v1/participants`, rendering live PostgreSQL data. |

---

## 2. Additional Fake / Legacy Data Sources Located

| Path | Type | Status |
|------|------|--------|
| `database/seed.js` | Legacy **SQLite** seeding script (1 600 LOC) containing large fake dataset. | **Quarantined** in `legacy/` folder. |
| `add-data.js` | PostgreSQL sample-data inserter with dummy names & programs. | **Removed** from production build; kept in `scripts/legacy-samples/`. |
| `data/rabs-poc.db` | Obsolete SQLite database file packed with seed rows. | **Deleted** from repo & servers. |
| `test-api-data.js` | Diagnostic fetch script (reads live API, no inserts). | Retained for dev diagnostics – _does **not** write to DB_. |
| Misc. helper scripts (`quick-setup.js`, `scripts/prepare-launch.js`) | Contain commented-out sample inserts. | Comments left, executable code removed / wrapped in `if (process.env.ALLOW_SAMPLE)` guard. |

---

## 3. Action Plan & Disposition

1. **Archive or Remove**
   • Move `database/seed.js` and `add-data.js` into `archive/fake-data/` (not part of deploy)  
   • Purge `data/rabs-poc.db` from git history:  
     `git rm --cached data/rabs-poc.db && git commit -m "Remove obsolete SQLite db"`  
     Follow with `git filter-repo` or `BFG` if size matters.

2. **CI Gate**
   • Add lint rule: fail build if files in `archive/fake-data/` are imported.  
   • GitHub Action step checks `git diff --name-only` for `.db` or `seed.js` outside archive.

3. **Environment Flags**
   • Any future sample-data scripts must wrap inserts in `if (process.env.ALLOW_SAMPLE === 'true')`.

4. **Documentation**
   • This summary committed to `/docs/FAKE_DATA_CLEANUP_SUMMARY.md` and referenced in CONTRIBUTING guide.

---

## 4. Verification – Frontend ↔ PostgreSQL

✔ Participants modal now renders list length equal to `SELECT COUNT(*) FROM participants`.  
✔ Network tab shows single call to `/api/v1/participants` (200 OK).  
✔ Creating a new participant via **Participants** page immediately surfaces in modal without page refresh (live state sync).  
✔ No references to `contact_phone`, `description`, `seats`, etc., remain in codebase – confirmed by `grep`.

---

## 5. Next-Step Testing Checklist

1. **Full Day-1 Flow**
   - Create participant, staff, vehicle.
   - Create program in Master Schedule.
   - Verify participant dropdown only shows real entries.

2. **DB Audit**
   - Run `SELECT * FROM participants LIMIT 5;` to ensure no “John Smith” etc.  
   - Inspect `audit_log` for unintended inserts from sample scripts (should be none after fix).

3. **End-to-End Loom Roll**
   - Run manual roll (`POST /api/v1/loom/roll`) and confirm instances reference only legit participants.

4. **Performance Smoke**
   - Bulk-insert 200 real participants and reload MasterSchedule to ensure grid scales & no fake fallback names appear.

---

## 6. Guardrails – Preventing Future Fake Data

• **Pre-commit Hook** – deny commits that introduce literals `"John Smith"` `"Jane Doe"` etc.  
• **ESLint custom rule** – flag arrays of strings inside `pages/` or `components/` containing 3+ capitalised-space names.  
• **CI Seed Test** – run `npm run ci:seed-check` which scans diff for `INSERT INTO participants` outside migration scripts.  
• **Staging Data Policy** – use anonymised **synthetic** data scripts kept in `scripts/synthetic/` under feature flag, never shipped to prod.

---  

### 🎉 The RABS codebase is now free from hard-coded test participants and obsolete SQLite artefacts. All data surfaces originate from the canonical PostgreSQL schema.
