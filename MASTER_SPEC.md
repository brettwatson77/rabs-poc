# RP2 ‑ Master Specification  
_Single-source-of-truth contract for the clean rebuild_

---

## 1. Workshed Mental Model

| Component | Purpose | Editable Via |
|-----------|---------|--------------|
| **WALL – Program Templates** | Master blueprints that repeat: program name, venue, time-slot segments, default participants, staff ratio, vehicles, default billing codes, route templates. | “Edit Template” forms (changes affect every future instance generated after the edit). |
| **CALENDAR – Exceptions & Permanent Changes** | Dated instructions that override the Wall: absences, cancellations, venue/time shifts, staff swaps, vehicle outages, participant transfers. Permanent flags also trigger updates to the Wall moving forward. | Intention forms & red-light emergency UI. |
| **FILING CABINET – Reference Data** | Authoritative files for Participants, Staff, Vehicles, Venues, Finance Codes, Award Rules. Always up-to-date, directly edited through CRUD screens & imports. | CRUD pages & bulk importers. |

**Instance Generation Rule**  
`Instance = Template (Wall) ⊕ Calendar Entries (for that date)`  

---

## 2. Single Source of Truth Principle

**API IS KING**

1. API contracts (OpenAPI spec) are *canonical*.  
2. Frontend **must** send exactly the documented payloads & handle responses.  
3. Database schema **must** implement the data shapes & types the API defines.  
4. Any change to data shape **starts** by updating the API spec → backend code → migration → frontend typings.

_If FE sends X but API spec says Y → FE bug._  
_If DB lacks a column the API spec exposes → migration bug._  

---

## 3. Core Data Domains & Endpoints

| Domain | Wall / Calendar / File | Main Endpoint(s) | Key Payload |
|--------|-----------------------|------------------|-------------|
| Program Templates | Wall | `POST /programs` `PATCH /programs/:id` | `{ name, venueId, repeatPattern, daysOfWeek[], timeSlots[], staffRatio, billingCodeIds[], routeTemplateId }` |
| Loom Instances | — | `GET /loom/instances` | `?startDate&endDate` |
| Calendar Intents | Calendar | `POST /intentions` | `{ type, date, permanent, metadata{} }` |
| Participants | File | `/participants` CRUD | photo_url, address, plan_period, care_plan |
| Staff | File | `/staff` CRUD | base_rate, schads_level, certifications[] |
| Vehicles | File | `/vehicles` CRUD | capacity, fuel_type, next_service_due |
| Venues | File | `/venues` CRUD | capacity, amenities[] |
| Finance Codes | File | `/finance/billing-codes` | `{ ratioSplits: { "1:1": rate, … }}` |

---

## 4. Data-Flow & Validation Pipeline

1. **Frontend**  
   • Runs Zod validation matching OpenAPI → prevents bad requests.  
2. **API Layer**  
   • Express + Celebrate/Joi validates again.  
   • Returns `{ success, data | errors }`.

3. **Service Layer**  
   • Pure business logic, no SQL. Throws `ServiceError` on rule violation.

4. **Repository Layer**  
   • Maps DTOs to SQL. Uses parameterised queries only.

5. **Database**  
   • Constraints (PK, FK, CHECK) enforce invariants; never duplicates logic already in code except for critical integrity.

If a request fails at any level, lower layers **MUST NOT EXECUTE**.

---

## 5. Alignment Checklist (must always be green)

| Check | Tool |
|-------|------|
| OpenAPI ↔ Backend routes parity | `npm run test:routes` |
| OpenAPI ↔ DB schema parity | `npm run test:migrations` |
| Frontend ↔ OpenAPI payload parity | `npm run test:contracts` |
| Sample round-trip tests (create program → card appears) | Cypress E2E |

**Red = Spec violation.** No new feature merges with red checks.

---

## 6. Editing Rules

1. **Template edits (Wall)** affect future instance generations only.  
2. **Calendar temporary entry** overrides a single date; permanent flag updates Wall and back-populates Calendar for future dates.  
3. **Filing Cabinet edit** (e.g., staff rate) takes effect the moment it’s saved and will reflect in next calculation run.  
4. **No direct DB edits** outside migrations & seeders.

---

## 7. Naming & Format Conventions

• Dates: `YYYY-MM-DD` (no time).  
• Times: `HH:MM:SS`.  
• Datetimes in ISO UTC when required.  
• IDs: UUID v4.  
• Monetary: `numeric(12,2)` stored in cents (AUD).  
• Enums: lower_snake_case.

---

## 8. Minimum Viable Tables (initial RP2)

`participants, staff, vehicles, venues, programs, program_participants, route_templates, billing_codes, billing_code_ratios, intentions, loom_instances, staff_availability, vehicle_maintenance, invoices`

Each migrations file **MUST** reference this spec header.

---

## 9. Change Management

1. **Every pull-request must contain:**  
   • _Spec update_ – Keep `MASTER_SPEC.md` and the OpenAPI YAML in sync  
   • _Backend code_ – Routes, services, and tests  
   • _Migration file_ – Schema stays aligned with the spec  
   • _Frontend typings / tests_ – Ensure the UI still fulfils the contract

2. **Review workflow (two-person team edition):**  
   • Brett opens the PR, AI assistant auto-reviews & leaves comments.  
   • If the AI generates the PR, Brett reviews and approves.  
   • Merge only when both of us have explicitly ticked the “Spec aligned” checkbox.

3. **Fast-lane Fixes:**  
   Minor documentation tweaks or non-breaking style changes can be committed directly by either party, but **must not** modify API contracts or database schema without a PR review.

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| Instance | Concrete occurrence of a program on a specific date |
| Intent | Calendar entry describing a change to an instance or template |
| Ratio Split | Distribution of a 1:1 NDIS rate across multi-participant ratios |
| Wall / Calendar / File | See Workshed model above |

---

**This document is the constitution of RP2.  
If code, DB or tests disagree with this spec – the spec wins.**
