# Refinements Completed – July 2025

This document captures every refinement implemented after the first milestone, based on Brett Watson’s feedback. Each section shows “Before ➜ After” so you can see the impact at a glance.

---

## 1. Dashboard

| Area | Before | After |
|------|--------|-------|
| **Bus-run tile names** | Titles read “CB-Pickup”, “Bowling-Dropoff” – no vehicle info. | Tiles now use the compact `CODE{PU|DO}{#}-{REG}` format, e.g. **CBPU1-DSW004**, **CBDO1-DSW004**. Instantly reveals program, direction & rego. |
| **Widgets / KPIs** | Blank white space above columns. | “Metrics dashboard” showing:<br>• Participants today<br>• Total service hours<br>• Estimated revenue (fortnight)<br>• # of programs<br>• Vehicles in service. |
| **Quick-action bar** | None. | Buttons for Master Schedule, Billing CSV, Staff Roster, Cancellation Manager. |

---

## 2. Master Schedule (Fortnight View)

| Aspect | Before | After |
|--------|--------|-------|
| **Layout** | Fixed 2-row grid; large empty vertical gap pushed week-2 out of view. | Dynamic grid – each week stacks directly under the other; height auto-grows to tallest day column. Mobile breakpoints added. |
| **Staff progress info** | Colour bar only. | Bar **+ numeric** `(allocated/contract)` in modal for instant utilisation reading. |
| **Staff replacement** | “Single” worked, “Forever” failed with UNIQUE constraint error. | Robust transactional logic – if new staff already on instance, old row is deleted; otherwise row is updated. No constraint errors. |
| **Cancellation buttons** | Enabled/disabled by “week-position” causing wrong logic when scrolled. | 7-day test now uses **current simulated date vs. instance date** so every button is correct no matter which fortnight is in view. |

---

## 3. Cancellation Engine

| Rule | Before | After |
|------|--------|-------|
| Notice period | Evaluated relative to page range; caused false “short notice”. | SQL & front-end both check **date diff ≤/≥ 7 days** from NOW only. |
| Billing impact | Normal cancel sometimes still billed; short-notice sometimes voided. | • Normal (≥7 days) → attendance row deleted + unbilled items `void`.<br>• Short notice (<7 days) → attendance status `cancelled` + billing kept. Logged in `activity_log`. |

---

## 4. Participant Planner

| Feature | Before | After |
|---------|--------|-------|
| **History panel** | Mixed attendance, cancellations & enrolment actions – noisy. | Dedicated “Enrollment Planning History” – shows *only* adds/removes queued via Planner. Icons removed for clarity, colour codes remain. |
| **Back-end support** | Single `/history` endpoint. | New `/enrollment-history` endpoint + service query limited to `pending_enrollment_changes`. |

---

## 5. Staff Hours & Utilisation

| Location | Improvement |
|----------|-------------|
| **Staff page** | Progress bars now include numeric totals and turn red when over-allocated. |
| **Master Schedule Modal** | Same bar + numbers beside each staff name. |
| **API** | `/staff-assignments/hours/:staffId` returns `allocated`, `remaining`, `percent_allocated`, `over_allocated` plus assignment list. |

---

## 6. Database & Seed Data

| Table / Script | Change |
|----------------|--------|
| `staff` | Added `contracted_hours INTEGER DEFAULT 30`. |
| `schema.sql` | Constraints updated; composite DELETE logic unchanged. |
| `seed.js` | Random contract hours (30 / 50 / 76) for demo staff; ensures utilisation bars vary. |

---

## 7. CSS / UI Polish

* New **Dashboard.css** and extended **CalendarView.css** for responsive KPIs, quick-action bar and two-week stacking grid.
* Colour tweaks for progress bars, understaffed highlight, and modal sections.

---

### ✅ Outcome

These refinements:

1. Deliver at-a-glance operational clarity (tile names & KPIs).
2. Fix critical data integrity bugs (staff swap constraint, cancellation billing).
3. Provide true fortnight logic across pages.
4. Give coordinators cleaner audit trails and utilisation insights.

The platform is now solid for **dynamic routing and optimisation** work. 🚀
