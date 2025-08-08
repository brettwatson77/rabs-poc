# Day-1 System Analysis (RABS-POC)

A practical review of what a brand-new user (empty database, clean deploy) sees, step-by-step, and what still blocks a successful first day of operation.

---

## 1. Entry Points & Global State

| Page / Module | Purpose | Depends on | Current Outcome | Status |
|---------------|---------|------------|-----------------|--------|
| **Login** *(dev-mode bypass)* | Auth gateway | none | Auto-logs in as Admin | ✅ |
| **App Context** | Supplies `simulatedDate`, global Axios | none | Working | ✅ |
| **DB Connectivity** | Postgres via `pool` | network/env vars | Server boots cleanly | ✅ |
| **Audit Log** | Change tracking | `tgl_loom_audit_log` | Writes now succeed | ✅ |

---

## 2. Core Workflow Pages

### 2.1 Master Schedule
* **Role**: Command centre calendar; visualises Loom instances.
* **Happy path (empty DB)**: Should render an empty grid.
* **Current result**: *“Failed to load”* banner.
* **Root causes**
  1. Axios `/api/v1/loom/instances` returns `success=false` when no rows – frontend treats as error.
  2. `scheduleData.map` expects `instance.participants` and `instance.staff` arrays that are **only joined in backend once real data exists** → undefined crash.
* **Actions**
  * API should return `success:true` with empty `data: []`.
  * Frontend needs empty-state handler (`if (scheduleData.length===0) show “No programs yet”`).

### 2.2 Participants
* **Role**: CRUD participant profiles.
* **Current result**: Creation fails until we removed `is_plan_managed` – **fixed**.
* **Missing UX**: Dropdown or radio for `plan_management_type` ENUM.

### 2.3 Staff
* CRUD works; UUID validator prevents bad IDs. No UI issue reported.  
  *Need sample data to confirm list rendering.*

### 2.4 Programs / Intentions
* Create Program modal posts to `/api/v1/intentions/intents`.
* With empty DB the intent succeeds but **roller sees zero participants and generates 0 instances** (expected).
* Needs user feedback (“Program saved, add participants”).

### 2.5 Loom Settings
* Save now shows **Success** ✅  
* Confirmed audit log writes.

---

## 3. Support Features

| Feature | Depends on | Ready? | Notes |
|---------|------------|--------|-------|
| **Cards Engine** (pickup, roster, etc.) | Instances + participants | 🟡 | Logic present, but never called until instances exist. |
| **Rostering & SCHADS cost calc** | Staff assignments | 🟡 | Works once staff & participants exist. |
| **Billing matrix** | Participant billing codes | 🟡 | UI present on MasterSchedule modal; requires participants & codes. |
| **Timesheets export** | Staff shifts | 🔸 | Endpoint not yet wired. |
| **Google Maps routing** | Addresses + API key | ❌ | Not started (next major). |

Legend: ✅ works • 🟡 partially ready • 🔸 stub • ❌ missing

---

## 4. Data & API Alignment Checklist

1. `participants` table – ENUM `plan_management_type` confirmed.  
2. `staff`, `vehicles`, `programs` – status columns added.  
3. `tgl_loom_instances` – financials JSON ok.  
4. **Missing table** `schema_migrations` (harmless but create it to silence NOTICEs).  

---

## 5. Day-1 User Journey Simulation

1. **Login** (auto) → Dashboard opens.
2. Navigate **Master Schedule** → sees error banner (blocker).
3. Switch to **Participants** → create first participant (works after fix) → Listed.
4. Create **Staff** member → Saved.
5. Open **Programs** modal → define program intent → Success banner.
6. Wait for **Loom Roller** (or hit manual roll) → should create 1 instance → MasterSchedule should now list it.
7. Edit instance → assign billing, staff etc. → Cards/Financials generate.

Current blockers for this happy path:
* A. MasterSchedule cannot render empty state.  
* B. Manual “Roll Loom Now” button missing on UI (roller cron waits until 00:05).

---

## 6. Priority Fix List

1. **MasterSchedule empty-state & API contract**  
   • Backend: return `{success:true,data:[]}` when no instances.  
   • Frontend: handle `scheduleData.length===0`.
2. **Add “Roll Loom Now”** control on LoomControls for immediate testing.
3. **Participant Form UI** – replace text-box with dropdown for `plan_management_type`.
4. **Seed Data Helpers** – quick “Add demo participants/staff” button for QA.
5. **Program Creation Wizard** – guide to “Step 2: add participants”.
6. **Timesheet export endpoint wiring** (low priority after visual flow fixed).
7. **Google Maps routing integration** (deferred).

---

## 7. Conclusion

Backend plumbing is now **stable**. Primary obstacle to visible progress is **frontend handling of empty datasets** and a way to roll the Loom on demand. Address the top two checklist items and a Day-1 user can:

• add participants & staff  
• create a program intent  
• generate first schedule instance  
• see it on Master Schedule

Once those are validated, secondary features (cards, billing, rostering) should work with minimal tweaks because their data contracts already align with the Loom instance shape.
