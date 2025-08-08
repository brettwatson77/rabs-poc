# RABS Program-Creation Specification
_Definitive reference for implementing the core 95 % workflow._

---

## 1. Master Schedule Calendar Workflow
* **Calendar view** displays days within the current _loom window_ (N weeks, default = 8).  
* **Navigate** forward/backward inside the window; window size configurable in **Settings**.
* **Add Program**
  1. Click any date cell ⇒ open **Program Creation Modal**.
  2. Modal pre-fills _Start Date_ with the clicked day.
* **One-off vs Recurring**
  * Repeat = _off_ → `repeat_pattern:"none"`, `end_date = start_date`.
  * Repeat = _on_ → choose pattern (`weekly`, `fortnightly`, `monthly`) and optional `end_date`.  
    Generated instances appear for every occurrence that falls inside the current loom window.
* **Window resize behaviour**
  * Shrinking the window deletes instances _outside_ the new range (program definitions remain).
  * Expanding the window regenerates instances (incl. one-off programs that fall inside).

---

## 2. Program Creation Modal — Field Reference
| Group | Field | Type | Notes |
|-------|-------|------|-------|
| Basics | **Title** | string | Display name on cards |
|  | **Program Type** | enum[string] | `community_access`, `training`, … |
|  | **Venue** | select ➜ existing ‑or- “+ New Venue” inline form |
| Schedule | **Repeat?** | checkbox | toggles recurring controls |
|  | **Repeat Pattern** | radio | `none`, `weekly`, `fortnightly`, `monthly` |
|  | **Days of Week** | multiselect (0-6) | for patterns weekly/fortnightly |
|  | **Start Date** | date | mandatory |
|  | **End Date** | date? | null = no end |
| Time Slots | **Add Slot** | btn | each slot = `{ id, startTime, endTime, label }` |
| Participants | **Add Participant** | search & multiselect | each row ➜ billing codes editor |
|  | **Billing Codes** | list[{code,hours}] | ≥1 per participant |
| Staffing | **Assignment Mode** | `auto` / `manual` |
|  | **Additional Staff** | int 0-5 | extra above ratio |
| Notes | **Program Notes** | textarea | visible to all staff |

Ratio rule: _1 lead + 1 support per 4 participants_. 5 participants ⇒ 2nd shift auto-created.

---

## 3. Expected System Behaviour

### After pressing “Save”
1. **Program record** inserted/updated (see §4).
2. **Instance generation**
   * For every date inside loom window matching pattern, create **Program Card**.
3. **Dashboard cards**
   * For each instance & every time slot create a **Time-Slot Card**.
   * If slot label starts with “Pick-up”/“Drop-off” mark as **Bus Run**.
4. **Roster shifts**
   * Count participants → `ceil(n/4)` support shifts + 1 lead.
   * If `additional_staff_count` > 0 add extra support shifts.
5. **Finance**
   * Insert `participant_billing_codes` rows.  
   * Finance page aggregates hours × rates.
6. **Loom regeneration**
   * Daily roll expands window: new instances auto-generated.
   * Exceptions handled later through **Intents** (sick leave, cancellations, etc.).

---

## 4. Data Structures

### 4.1 Database (post-migration)
`programs`
```
id UUID PK
name text
program_type varchar(50)
start_date date
end_date date NULL
repeat_pattern varchar(20) -- none|weekly|fortnightly|monthly
days_of_week jsonb        -- [0,1,2]
time_slots   jsonb        -- [{id,start,end,label}]
venue_id UUID FK venues
notes text
staff_assignment_mode varchar(20) -- auto|manual
additional_staff_count int
active bool default true
created_by text
created_at, updated_at
```

Supporting tables  
* `program_participants(id, program_id, participant_id, start_date, end_date)`  
* `participant_billing_codes(id, program_id, participant_id, code, hours, start_date, end_date)`  
* `schedule` (generated instances)  
* `tgl_loom_instances`, `tgl_loom_participant_allocations`, `tgl_loom_staff_shifts`, `tgl_loom_vehicle_runs` (runtime records)

### 4.2 REST API
| Method | Path | Purpose | Body |
|--------|------|---------|------|
| POST | `/api/v1/programs` | Create program | Program object (see DB) |
| PUT  | `/api/v1/programs/:id` | Update | same |
| GET  | `/api/v1/programs?windowStart&windowEnd` | List programs inside dates | – |
| POST | `/api/v1/programs/:id/generate` | Force regenerate instances | `{start,end}` |
| GET  | `/api/v1/dashboard/cards?date=YYYY-MM-DD` | Cards for a day | – |

### 4.3 Frontend State
```
masterSchedule:
  windowStart, windowEnd
  programs[]         // API list
  creatingProgram: {modalState}
dashboard:
  cardsByDate[date]  // from /dashboard/cards
roster:
  shiftsByDate[date]
finance:
  billingSummary
```

---

## 5. Card Generation Logic

| Card Type | Source | Generation Rule |
|-----------|--------|-----------------|
| **Program Card** | `programs` | 1-per-program-per-date (instance) |
| **Time-Slot Card** | `time_slots` | For each slot of instance |
| **Bus Run Card** | time-slot with label starting `Pick`/`Drop` | One card; capacity from participants |
| **Staff Shift Card** | roster logic | Lead = 1 per instance, Support = ceil(participants/4) + `additional_staff_count` |

---

## 6. Future Intents (Out-of-scope for creation)
* `PARTICIPANT_CANCELLATION`
* `PROGRAM_MODIFICATION`
* `VEHICLE_UNAVAILABLE`
* `STAFF_LEAVE`
(See separate _Intents Spec_)

---

### 📌 Implementation Checklist
- [ ] Apply migration 010
- [ ] Build `/programs` CRUD service
- [ ] Write instance-generator util
- [ ] Hook Master Schedule modal → POST `/programs`
- [ ] Render program & slot cards in UI
- [ ] Auto-generate roster & bus runs
- [ ] Verify finance aggregation
- [ ] Integrate daily loom roll

**This document is the single source of truth for program creation in RABS.**
