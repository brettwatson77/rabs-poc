# Improvements Implemented — July 2025

This document summarises all functional, UI and data-model changes completed in this development cycle. Each section lists:

* **What was changed**
* **How it works now**
* **Operational benefit for the South-West Sydney disability service provider**

---

## 1. Dashboard – Bus Run Modal

| Area | Before | After |
|------|--------|-------|
| Card granularity | A single card mixed morning **pick-ups** and afternoon **drop-offs** for the same program/vehicle. | Each vehicle now produces **two** distinct events:<br> • `CB-Pickup`, `Bowling-Pickup`, etc.<br> • `CB-Dropoff`, `Bowling-Dropoff`, etc. |
| Modal detail | Participant list did not respect run direction. | Modal now shows **only** passengers relevant to the clicked run (pick-up *or* drop-off). Route stops list respects direction. |
| Naming | Long, hard-to-scan titles. | Concise “Program-RunType” titles (e.g. `CB-Pickup`). |

**Benefit:** Drivers and admin immediately see which run they are looking at, reducing dispatch confusion and on-the-day phone calls.

---

## 2. Master Schedule

### a.  Fortnight-View Calendar  
* Week navigation now jumps in **two-week blocks** and the header displays the full 14-day range.  
* `CalendarView` renders two rows of 7 days each.

### b.  Cancellation Workflow  
* Two buttons per participant: **Cancel** (≥ 7 days) and **Short Notice Cancel** (< 7 days).  
* Business-rule logic implemented in `cancellationService.js`  
  * Normal cancel → attendance row deleted + unbilled items voided.  
  * Short notice → attendance status set to *cancelled* and billing records retained.  
* Activity is logged in `activity_log` for audit.

### c.  Staff Management Upgrades  
| Function | Detail |
|----------|--------|
| **Inline swap** | Staff names in the modal are **dropdowns**. Admin selects a replacement from the availability list. |
| **One-off vs Forever** | Prompt asks if the change is just this instance or **all future** instances of the program. |
| **Hours progress bar** | Each staff member shows a utilisation bar: allocated / contracted hours this fortnight.<br>Colour turns red if over-allocated. |

Endpoints under `/staff-assignments/*` handle availability lookup, single and recurring updates, and hours reporting.

**Benefit:** Rapid roster fixes, visibility of over-time risk, and air-tight cancellation compliance for NDIS billing.

---

## 3. Participant Planner

| Improvement | Description |
|-------------|-------------|
| **Historical timeline** | Planner now merges **enrolment adds/removes**, **attendance statuses** and **cancellations** into a single 30-item log per participant. |
| **Iconography & colour** | ➕ / ➖ enrolments, ✔️ attended, ❌ cancelled, 🚫 no-show, ⚠️ short/normal cancellation. |

**Benefit:** Coordinators can trace attendance patterns and family queries without cross-checking multiple screens.

---

## 4. Fortnightly Billing & Staff Hours

* Billing CSV endpoints automatically respect the **14-day cycle**.  
* Short-notice cancellations remain billable, normal cancellations are excluded.  
* Staff contracted hours (0-80) drive utilisation bars on **Staff** page and Master Schedule modal.

**Benefit:** Mirrors provider’s real world pay cycle, prevents under-/over-invoicing and supports equitable workload distribution.

---

## 5. Database & Seed Data

| Change | Location |
|--------|----------|
| `contracted_hours INTEGER DEFAULT 30` | `staff` table in `schema.sql`. |
| Seed updates | `seed.js` populates realistic 30/50/76 hr contracts. |
| Cancellation & staff-assignment logic | New CRUD routes + transaction-safe service layers. |
| History query | Planner service now unifies three tables into a single timeline query. |

**Benefit:** Data model now stores employment contracts, enabling accurate utilisation analytics and future payroll integrations.

---

### ✅ Outcome

These combined improvements deliver:

1. Clearer operational picture for transport runs.
2. Bullet-proof cancellation handling aligned with 7-day policy.
3. Faster, safer roster adjustments with instant hour-tracking.
4. Participant-centric history for superior support coordination.
5. Data foundation for fortnightly payroll & billing processes.

The platform is now ready for the next phase: **route planning and optimisation**. 🚍✨
