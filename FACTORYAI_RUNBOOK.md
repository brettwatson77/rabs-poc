FACTORYAI_RUNBOOK.md
RABS-POC — Workshed + Loom (SYNC-RETHREAD) — Build-to-Demo Today

Purpose
This is the single source of instructions for the coding agent inside Factory.ai. Assume Schedule, Dashboard, and Roster pages are not working. We will rebuild a minimal, end-to-end vertical slice that persists everything to the database during template setup and rethreads synchronously on finalization or calendar changes. Do not refactor the Filing Cabinet UI; only expose what it needs.

DB‑Backed Dynamics (one pager)
1) Persist early: the moment a template is started, insert a draft rule row; every edit writes to DB.
2) Derive, don’t remember: counts, required staff/vehicles, and all cards are derived from DB tables (rules_* → loom_* / event_card_map).
3) Idempotent regeneration: rethread for the same inputs yields the same outputs; safe to rerun.
4) No hidden state: no wizard-only arrays; everything lands in DB immediately.
5) Permanent vs temporary: permanent = update the rule + rethread future; temporary = record an exception + rethread only affected dates.

Non‑negotiables
1) DB-first. Persist as you build. No hidden state in memory for core logic.
2) SYNC-RETHREAD. Finalize and calendar changes rethread immediately (blocking); no worker queue for this POC.
3) Add‑only. Do not drop or alter legacy tables. Do not touch any tgl_* tables. Do not break Filing Cabinet endpoints.
4) Acceptance before polish. Ship the demo path first, then iterate.

Current Database (what to use)
Wall (rules/templates): rules_programs, rules_program_exceptions
Wall (new in 002): rules_program_slots, rules_program_participants, rules_program_participant_billing (optional), rules_program_requirements, v_rules_program_summary
Loom (instances): loom_instances
Dashboard cards: event_card_map
Assignments/attendance: loom_staff_assignments, loom_vehicle_assignments, loom_participant_attendance
Filing Cabinet: participants, staff, vehicles, venues, billing_rates, billing_codes, settings
Legacy to ignore for new path: programs, program_participants, program_enrollments, all tgl_*

Settings (read from settings.value JSON at key=org when present)
- staff_threshold_per_wpu  (default 5)
- default_bus_capacity     (default 10)
If not present, use defaults. Never 500 on missing settings—fallback and continue.

Fortnight / day‑of‑week model
- rules_programs has weekly/fortnightly semantics. Use fields: day_of_week (1=Mon..7=Sun), week_in_cycle (1 or 2), start_time, end_time, venue_id, pickup_runs, dropoff_runs, status.
- Implement a single helper isRuleActiveOnDate(rule, date). Do not scatter DOW math.

API Surface (minimal, stable)
POST   /api/templates/rules                       → create draft rule, return { id, status:'draft' }
PATCH  /api/templates/rules/:id                   → patch any subset of rule fields
POST   /api/templates/rules/:id/slots             → bulk/single add slots
POST   /api/templates/rules/:id/participants      → add one participant
POST   /api/templates/rules/:id/participants/:rppId/billing  → add per‑participant billing (optional)
GET    /api/templates/rules/:id/requirements      → read live counters
POST   /api/templates/rules/:id/finalize          → set active + syncRethread over window or given range
POST   /api/calendar/exception                    → write rules_program_exceptions + syncRethread (temporary or permanent)
GET    /api/loom/instances?startDate&endDate      → list instances
GET    /api/dashboard/cards?date                  → ordered cards for date

Implementation Details
A) Data model deltas (already applied by 002_rules_wall_syncrethread.sql)
  - rules_program_slots(rule_id, seq, slot_type, start_time, end_time, route_run_number, label)
  - rules_program_participants(rule_id, participant_id) with trigger → rules_program_requirements
  - rules_program_requirements(rule_id, participant_count, wpu_total, staff_required, vehicles_required)
  - rules_programs: ensure week_in_cycle, pickup_runs, dropoff_runs, status exist
  - rules_program_exceptions: ensure metadata jsonb exists
  - v_rules_program_summary roll‑up view

B) syncRethread service (no worker)
  syncRethread({ ruleId?:uuid, dateFrom?:date, dateTo?:date, windowDays?:int, futureOnly?:bool })
  Steps:
    1) Resolve range (default tomorrow..+14); clamp futureOnly to >= tomorrow.
    2) For each date:
       - rules = ruleId ? [ruleId] : all rules active for that date (day_of_week + week_in_cycle + status='active').
       - Upsert loom_instances(source_rule_id, instance_date, start_time, end_time, venue_id, …).
       - Delete then insert event_card_map rows from rules_program_slots; times resolved to that date; seq → card_order.
       - Apply temporary exceptions (MVP: persist record; UI can read metadata; advanced: mutate cards/assignments as needed).
    3) Return summary { datesProcessed, rulesTouched, instancesUpserted, cardsWritten }.

C) Schedule/Wall (Program Template Wizard)
  - New Program → POST /templates/rules (status='draft').
  - Each field edit → PATCH rules; after each write GET /templates/rules/:id/requirements to refresh counts (participants, WPU, staff, vehicles).
  - Participant add → POST participants; optional per‑participant billing; DB triggers recompute requirements.
  - Slots → POST bulk or one‑by‑one (pickup/activity/meal/other/dropoff; route_run_number for multi‑runs).
  - Finalize → POST /templates/rules/:id/finalize → syncRethread window; toast the returned summary.
  - Abandoned drafts cleaner: delete drafts older than N days with zero participants and zero slots.

D) Dashboard
  - Data source: event_card_map joined via loom_instances for date.
  - UI: five columns (earlier, before, now, next, later) derived from display_time_* relative to now.
  - Actions: POST /calendar/exception (temporary) then syncRethread that date; re‑query cards.

E) Roster
  - Read staff_required and vehicles_required from /templates/rules/:id/requirements (or compute per instance on finalize).
  - Persist assignments to loom_staff_assignments and loom_vehicle_assignments (already present).

F) Finance Preview (MVP)
  - Sum template per‑participant billing × attendance flags. Short‑notice via rules_program_exceptions.metadata { billable:true }.
  - Export can wait; preview must sum correctly.

G) Contracts and Validation
  - Validate inputs; reject unknown fields; time "HH:MM", date "YYYY‑MM‑DD".
  - Return ids (uuid) and timestamps when available.

H) Logging/Observability
  - Correlation id per request; log route, subject id (rule/instance), date range, counts written, duration.
  - syncRethread returns a summary for UI toast.

I) Acceptance Tests
  1) Template build → counters reflect participant add/remove immediately.
  2) Finalize → instances + cards exist for two Mondays in a fortnight window.
  3) Dashboard short‑notice cancel → exception recorded; cards reload post‑rethread.
  4) Roster → staff_required increases after WPU crosses threshold; assignment persists.
  5) Filing Cabinet endpoints unchanged; no regressions.

Do Not
  - Do not delete or modify tgl_* tables.
  - Do not repurpose legacy programs/program_participants for the new wizard path.
  - Do not introduce a worker/queue in this POC.
  - Do not block UI > 8s; shrink window if needed.
