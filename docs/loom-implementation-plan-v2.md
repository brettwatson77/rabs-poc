# Loom Implementation Plan (v2)

A practical roadmap for rebuilding the Loom engine into a perpetual, calendar-driven resource-allocation system that preserves operator intent while limiting daily operational focus to a configurable rolling window.

---

## 1. Current State Assessment

| Area | What Exists (v1) | Gap / Problem |
|------|------------------|---------------|
| DB schema | `tgl_loom_*` tables for instances, allocations, staff, vehicles, audit | No separate layers for persistent intent & exceptions |
| Engine logic | Batch ‑ style `generateWindow`, manual “Generate” button, hard delete/recreate instances on resize | Needs daily auto-roll & persistence of operator changes |
| API | Window-size endpoints, basic instance CRUD | Calendar-based endpoints & intent endpoints missing |
| Front-end | Loom Settings UI, manual generate/resize | Must reflect live rolling window & show future intent state |
| Ops workflow | User presses *Generate* | Should be automatic; operator only records intent/exceptions |

---

## 2. Architecture Redesign

### 2.1 Layered Persistence Model

1. **Template Layer** – `program_templates` (existing `programs`)
2. **Instance Layer** – `tgl_loom_instances` (within active window, recreatable)
3. **Intent Layer** – new `tgl_operator_intents`
   * participant_enrolments
   * staff_overrides
   * venue_overrides
4. **Exception Layer** – new `tgl_temporal_exceptions`
   * cancellations
   * one-off changes

### 2.2 New / Updated Tables (DDL sketch)

| Table | Purpose |
|-------|---------|
| `tgl_operator_intents` | Persistent future plans (start / end date ranges) |
| `tgl_temporal_exceptions` | Single-date overrides & cancellations |
| `settings` | Already present; add `loom_window_weeks` + `auto_roll_enabled` |

All foreign keys reference canonical `participants`, `staff`, `programs`, etc.

---

## 3. Implementation Phases

| Phase | Goal | Deliverables |
|-------|------|--------------|
| 0 | Spike & schema migration scripts | SQL migrations for new tables |
| 1 | Core Daily Roller Service | `loomRoller.js` cron (node-cron / agenda) |
| 2 | Intent & Exception APIs | REST endpoints + controller logic |
| 3 | Front-end refactor | Live window view, intent/exception forms |
| 4 | Data migration | Scripts to promote existing allocations to intents where needed |
| 5 | Extended testing & UAT | Automated + operator scenario tests |
| 6 | Production cut-over | Feature flag flip, monitor, rollback plan |

---

## 4. Core Engine Redesign

### 4.1 Daily Rolling Algorithm

```
For each day at 00:05:
  today = current date (local tz)
  windowEnd = today + (windowWeeks * 7)
  generateMissingInstances(today, windowEnd)
  applyOperatorIntents(today, windowEnd)
  applyTemporalExceptions(today)
  purgeInstancesBefore(today)   // Optional housekeeping
```

### 4.2 Key Responsibilities

| Responsibility | Layer used |
|----------------|------------|
| Generate default instances | Template + Instance |
| Persist operator enrolment | Intent |
| Drop/add instances as window resizes | Instance only |
| Reinstate enrolments after regen | Intent replay |
| Handle cancellations | Exception |

---

## 5. API Changes

| Endpoint | Verb | Description |
|----------|------|-------------|
| `/loom/window` | GET | Current weeks & calendar range |
| `/loom/window` | PATCH | Update weeks (2-16) |
| `/loom/instances` | GET | Query by date range |
| `/loom/intents` | POST/GET/DELETE | CRUD persistent intents |
| `/loom/exceptions` | POST/GET/DELETE | CRUD date-specific exceptions |
| `/loom/roll` | POST | (Admin) trigger immediate daily roll |

All dates are ISO-8601 `YYYY-MM-DD`; no “week 4” concepts.

---

## 6. Front-end Updates

1. **Loom Dashboard**
   * Continuous calendar strip (e.g., 42-day slider)
   * Colour-coded: generated, intent-modified, exception
2. **Intent Forms**
   * “Add Participant to Program” wizard (start/end dates)
   * Permanent transfers & staff overrides
3. **Exception Forms**
   * Single-date cancellation / change screens
4. **Settings**
   * Window size selector – no “Generate” button; shows “Next auto-roll at …”

---

## 7. Data Migration

1. Backup existing `tgl_loom_*`
2. Create new tables via migration `005_loom_layers.sql`
3. Move manual modifications detected in audit logs → `operator_intents`
4. Verify counts with reconciliation script
5. Set feature flag `loom_v2_enabled=false` for dual-run
6. Switch flag once parity reached

---

## 8. Testing Strategy

| Layer | Tests |
|-------|-------|
| Unit | Generation logic, intent replay, exception application |
| Integration | Daily roller end-to-end with in-memory Postgres |
| Regression | Compare v1 vs v2 outputs for same date range |
| Scenario | “Reduce to 2 weeks then back to 16” – expect identical results |
| Performance | Generate 10-year horizon intents, roll 16-week window for 30 simulated days |
| UAT | Operators walk through enrol/cancel scenarios in staging |

---

## 9. Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Data loss during window shrink | High | Never delete intents/exceptions; only instances |
| Roller cron failure | Medium | Health check + retry queue |
| Time-zone edge cases | Medium | All dates stored as local date, 00:00 time, TZ documented |
| Migration script errors | High | Dry-run in copy of prod DB, checklist sign-off |
| Front-end confusion | Medium | Clear “Rolls nightly” messaging, tooltips |

---

## 10. Timeline Estimates (realistic)

| Phase | Duration | Calendar Weeks |
|-------|----------|----------------|
| 0  – Schema & scaffolding | 3 days | Week 1 |
| 1  – Daily Roller MVP | 1 week | Week 2 |
| 2  – Intent/Exception APIs | 1 week | Week 3 |
| 3  – Front-end refactor | 2 weeks | Weeks 4-5 |
| 4  – Data migration scripts | 1 week parallel | Week 4-5 |
| 5  – Automated & scenario tests | 1 week | Week 6 |
| 6  – UAT & feedback | 1 week | Week 7 |
| 7  – Cut-over & monitoring | 1 week | Week 8 |
| **Total** | **≈ 8 calendar weeks** |

---

### Success Criteria

* Daily roller generates next-day instances automatically.
* Operator intents applied on correct future dates after window resize.
* Cancellations in future beyond window are honoured once date rolls in.
* No manual “Generate” action required.
