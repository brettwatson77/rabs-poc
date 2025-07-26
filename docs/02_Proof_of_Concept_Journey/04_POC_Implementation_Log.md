\# RABS-POC Implementation Log – July 2025



This document summarises all functional, UI, and data-model changes completed in the July 2025 development cycle. It combines the initial "improvements" and subsequent "refinements" into a single chronological log.



---



\## Part 1: Initial Improvements Implemented



\*This first set of changes established major new features and workflows.\*



\### 1. Dashboard – Bus Run Modal



| Area | Before | After |

|------|--------|-------|

| Card granularity | A single card mixed morning \*\*pick-ups\*\* and afternoon \*\*drop-offs\*\* for the same program/vehicle. | Each vehicle now produces \*\*two\*\* distinct events:<br> • `CB-Pickup`, `Bowling-Pickup`, etc.<br> • `CB-Dropoff`, `Bowling-Dropoff`, etc. |

| Modal detail | Participant list did not respect run direction. | Modal now shows \*\*only\*\* passengers relevant to the clicked run (pick-up \*or\* drop-off). Route stops list respects direction. |

| Naming | Long, hard-to-scan titles. | Concise “Program-RunType” titles (e.g. `CB-Pickup`). |



\*\*Benefit:\*\* Drivers and admin immediately see which run they are looking at, reducing dispatch confusion.



\### 2. Master Schedule



\#### a. Fortnight-View Calendar

\*   Week navigation now jumps in \*\*two-week blocks\*\* and the header displays the full 14-day range.

\*   `CalendarView` renders two rows of 7 days each.



\#### b. Cancellation Workflow

\*   Two buttons per participant: \*\*Cancel\*\* (≥ 7 days) and \*\*Short Notice Cancel\*\* (< 7 days).

\*   Business-rule logic implemented in `cancellationService.js`.

\*   Activity is logged in `activity\_log` for audit.



\#### c. Staff Management Upgrades

| Function | Detail |

|----------|--------|

| \*\*Inline swap\*\* | Staff names in the modal are \*\*dropdowns\*\*. Admin selects a replacement from the availability list. |

| \*\*One-off vs Forever\*\* | Prompt asks if the change is just this instance or \*\*all future\*\* instances of the program. |

| \*\*Hours progress bar\*\* | Each staff member shows a utilisation bar: allocated / contracted hours this fortnight. Colour turns red if over-allocated. |



\*\*Benefit:\*\* Rapid roster fixes, visibility of over-time risk, and air-tight cancellation compliance for NDIS billing.



\### 3. Participant Planner



| Improvement | Description |

|-------------|-------------|

| \*\*Historical timeline\*\* | Planner now merges \*\*enrolment adds/removes\*\*, \*\*attendance statuses\*\* and \*\*cancellations\*\* into a single 30-item log per participant. |

| \*\*Iconography \& colour\*\* | ➕ / ➖ enrolments, ✔️ attended, ❌ cancelled, 🚫 no-show, ⚠️ short/normal cancellation. |



\*\*Benefit:\*\* Coordinators can trace attendance patterns without cross-checking multiple screens.



\### 4. Fortnightly Billing \& Staff Hours



\*   Billing CSV endpoints automatically respect the \*\*14-day cycle\*\*.

\*   Short-notice cancellations remain billable, normal cancellations are excluded.

\*   Staff contracted hours (0-80) drive utilisation bars on \*\*Staff\*\* page and Master Schedule modal.



\### 5. Database \& Seed Data

\*   Added `contracted\_hours INTEGER DEFAULT 30` to `staff` table in `schema.sql`.

\*   Seed script (`seed.js`) updated to populate realistic 30/50/76 hr contracts.

\*   New CRUD routes and transaction-safe service layers for cancellation and staff assignments.



---



\## Part 2: Subsequent Refinements Completed



\*Based on feedback from the initial improvements, these refinements fixed bugs and polished the user experience.\*



\### 1. Dashboard Refinements



| Area | Before | After |

|------|--------|-------|

| \*\*Bus-run tile names\*\* | Titles read “CB-Pickup”, “Bowling-Dropoff” – no vehicle info. | Tiles now use the compact `CODE{PU|DO}{#}-{REG}` format, e.g. \*\*CBPU1-DSW004\*\*. |

| \*\*Widgets / KPIs\*\* | Blank white space. | Added a “Metrics dashboard” showing Participants today, Total service hours, Estimated revenue (fortnight), # of programs, Vehicles in service. |

| \*\*Quick-action bar\*\* | None. | Buttons for Master Schedule, Billing CSV, Staff Roster, Cancellation Manager. |



\### 2. Master Schedule (Fortnight View) Refinements



| Aspect | Before | After |

|--------|--------|-------|

| \*\*Layout\*\* | Fixed 2-row grid with large empty vertical gap. | Dynamic grid – each week stacks directly under the other; height auto-grows. Mobile breakpoints added. |

| \*\*Staff progress info\*\* | Colour bar only. | Bar \*\*+ numeric\*\* `(allocated/contract)` in modal for instant utilisation reading. |

| \*\*Staff replacement\*\* | “Forever” swap failed with a UNIQUE constraint error. | Implemented robust transactional logic to handle staff swaps without constraint errors. |

| \*\*Cancellation buttons\*\* | Logic was based on "week-position", causing errors when scrolled. | 7-day test now uses \*\*current simulated date vs. instance date\*\*, ensuring logic is always correct. |



\### 3. Cancellation Engine Refinements



| Rule | Before | After |

|------|--------|-------|

| Notice period | Evaluated relative to page range. | SQL \& front-end both check \*\*date diff ≤/≥ 7 days\*\* from NOW only. |

| Billing impact | Normal cancel sometimes still billed; short-notice sometimes voided. | • Normal (≥7 days) → attendance row deleted + unbilled items `void`.<br>• Short notice (<7 days) → attendance status `cancelled` + billing kept. Logged in `activity\_log`. |



\### 4. Participant Planner Refinements



| Feature | Before | After |

|---------|--------|-------|

| \*\*History panel\*\* | Mixed all actions, making it noisy. | Dedicated “Enrollment Planning History” – shows \*only\* adds/removes queued via Planner for a cleaner view. |

| \*\*Back-end support\*\* | Single `/history` endpoint. | New `/enrollment-history` endpoint + service query limited to `pending\_enrollment\_changes`. |



\### 5. Staff Hours \& Utilisation Refinements

\*   Progress bars on \*\*Staff page\*\* and \*\*Master Schedule Modal\*\* now include numeric totals and turn red when over-allocated.

\*   New API endpoint `/staff-assignments/hours/:staffId` returns detailed hour allocation data.



---



\### ✅ July 2025 Outcome



These combined changes delivered a clearer operational picture, bullet-proof cancellation handling, faster roster adjustments, and a solid data foundation for billing and payroll processes. The platform was declared ready for the next phase: \*\*dynamic routing and optimisation\*\*.

