# R.A.B.S. Proof-of-Concept (rabs-poc)

Welcome to the RABS-POC project. This repository contains the source code for the testing environment that proves the core concepts of the main RABS application.

## 🚀 Full Project Documentation

All project documentation, including architectural blueprints, setup guides, development plans, and implementation history, has been consolidated in the `/docs` directory.

**To get started, please begin with the main documentation hub:**

➡️ **[`/docs/00_START_HERE.md`](/docs/00_START_HERE.md)** ⬅️


---

## Quick Run Commands

- Backend: `npm start`
- Frontend: `cd frontend && npm run dev`
- Health check: `curl http://localhost:3009/health`

## Demo Script (5 steps)

1. **Open the Wizard:** Navigate to `http://localhost:3008/#/template-wizard` (or your frontend dev port).
2. **Save Details:** Set name/day/time/venue, click **“Save Details”**; counters auto-refresh via Requirements.
3. **Add Slots:** Click **“Add Default Slots”** (pickup/activity/dropoff rows are created in the DB).
4. **Add Participants:** Choose a few from the dropdown and click **“Add”**; watch Requirements update.
5. **Finalize:** Click **“Finalize Program”**; a toast shows the summary. Then open **Dashboard**; it reads cards via `GET /api/v1/dashboard/cards?date=YYYY-MM-DD`.

### Notes

- All new endpoints are available under `/api/v1` and a compatibility alias `/api`.
- No fake data is seeded; the flow uses your existing participants, venues, vehicles and billing codes.
- `syncRethread` defaults: tomorrow → +14 days, clamps to future dates, and automatically shrinks the window if processing exceeds 8 seconds.
