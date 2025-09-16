FactoryAI Code Stubs (SYNC-RETHREAD)

What this is
- Minimal Express + PG endpoints that match the runbook.
- Writes to your existing tables and the new rules_* tables from migration 002.
- No worker/queue; finalize and exceptions rethread synchronously.

Quick start
1) cd FactoryAI_Code_Stubs
2) npm i
3) Set env:
   set PGHOST=127.0.0.1
   set PGPORT=5432
   set PGUSER=postgres
   set PGPASSWORD=YOUR_PASS
   set PGDATABASE=rabspocdb
4) npm start
5) Smoke:
   POST http://localhost:3009/api/templates/rules { "name":"Center Based", "day_of_week":1, "week_in_cycle":1, "start_time":"08:30", "end_time":"16:30" }
   → add /slots, /participants, GET /requirements, then POST /finalize.

Notes
- rules_program_exceptions uses program_id, not rule_id; stubs insert accordingly.
- If day_of_week or week cycle anchor differs, adjust services/syncRethread.js:isRuleActiveOnDate logic.
- All endpoints are add-only and should not break your Filing Cabinet UI.
