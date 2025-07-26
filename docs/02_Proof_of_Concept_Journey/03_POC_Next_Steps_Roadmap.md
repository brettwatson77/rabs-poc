\# RABS-POC – Next Steps Road-Map

\*(focus: Cancellations, Reactive Updates, Resource Recalculation, Billing)\_



---



\## 0. Guiding Principle

Follow the Blueprint’s “Rules → Loom → History” cycle.

• All user actions must immediately update the Loom tables (`program\_instances`, `attendance`, `routes`, etc.) \*\*and\*\* leave an immutable trace in History (`activity\_log`, `pending\_enrollment\_changes`, `billing\_records`).

• Background workers (recalculation engine) must react to those traces and rebalance resources.



---



\## 1. CANCELLATIONS



| Step | Task | Code Hot-Spots / Checkpoints |

|------|------|------------------------------|

| 1.1 | \*\*Verify persistence path\*\* – confirm `cancellationController → cancellationService` inserts into both `attendance` (status =`'cancelled'`) \*and\* `activity\_log`. | `backend/controllers/cancellationController.js` <br>`backend/services/cancellationService.js` |

| 1.2 | \*\*Front-end feedback\*\* – after POST `/cancellations` the UI should refresh roster card \& planner history. | `frontend/src/api/api.js :: createCancellation` <br>`Dashboard.jsx` \& `MasterSchedule.jsx` |

| 1.3 | \*\*Short-vs-Normal flag\*\* – ensure service sets `type` correctly based on (today – instanceDate) <= 7 days. | same service file, lines ~60–110 |

| 1.4 | \*\*Re-load MasterSchedule\*\* – add `await getWeeklyChangeLog()` after cancellation completes. | `MasterSchedule.jsx` |

| 1.5 | \*\*Unit test\*\* simple flow (Mocha/Chai or Jest) inserting a cancellation and asserting: <br>• `attendance.status='cancelled'` <br>• row exists in `activity\_log` | `test/cancellation.test.js` (new) |



---



\## 2. REACTIVE UPDATES \& RESOURCE RECALCULATION



| Step | Task | Code Hot-Spots / Checkpoints |

|------|------|------------------------------|

| 2.1 | \*\*Signal rebalance\*\* – after every `attendance` change (add/remove/cancel) call `dynamicResourceService.handleParticipantChange`. | `cancellationService`, `participantService`, `attendance triggers` |

| 2.2 | \*\*Fix update cascade\*\* – in `dynamicResourceService.js` inspect `allocateVehicles()` and `reassignStaff()`. Ensure they fetch \*current\* participant count (`attendance where status='confirmed'`). |

| 2.3 | \*\*Idempotency\*\* – add “last\_calculated\_at” on `routes`, `staff\_assignments`, prevent infinite loops. |

| 2.4 | \*\*UI Hook\*\* – on roster modal “Re-balance” button -> `/dynamic-resources/rebalance/:instanceId`. | `BusRunAnalysisTerminal.jsx` |

| 2.5 | \*\*Background job\*\* – daily cron (`projector.js` placeholder) to sweep tomorrow+ instances and run auto-balance. |



---



\## 3. BILLING FLOW



| Step | Task | Code Hot-Spots / Checkpoints |

|------|------|------------------------------|

| 3.1 | \*\*Late-cancel rule\*\* – in `financeService.createBillingRecords()` confirm logic: <br>• ‘short\_notice’ cancellations \*bill at 90 %\* <br>• normal cancellations \*bill 0 %\* | `backend/services/financeService.js` |

| 3.2 | \*\*CSV generation sanity\*\* – ensure query filters `attendance.status IN ('attended','cancelled')` AND joins `activity\_log.type`. |

| 3.3 | \*\*Regression test\*\* – seed scenario: <br>• attend, short-cancel, normal-cancel <br>Generate CSV \& assert $$ lines. |

| 3.4 | \*\*Invoice status update\*\* – after CSV download mark `billing\_records.status='billed'`. |



---



\## 4. INVESTIGATION CHECKPOINTS



1\.  \*\*Why short-notice cancels disappear?\*\*

&nbsp;   • Confirm POST payload ok (console devtools).

&nbsp;   • Add `console.log` inside `cancellationService` to dump inserted rows.

&nbsp;   • Query DB directly:

&nbsp;     `SELECT \* FROM attendance WHERE participant\_id=? AND program\_instance\_id=?;`



2\.  \*\*Route recalculation performance\*\*

&nbsp;   • Time Google Maps call vs fallback.

&nbsp;   • Check `settings.max\_ride\_time` obeyed.



3\.  \*\*Simulated Date drift\*\*

&nbsp;   • Ensure `settings.current\_date` updated only via `/recalculate` endpoint.



---



\## 5. PRIORITY TODO LIST (TL;DR)



1\. \[ ] Fix cancellation persistence (1.1–1.3)

2\. \[ ] Auto refresh MasterSchedule after cancel (1.4)

3\. \[ ] Wire cancellations → resource rebalance (2.1)

4\. \[ ] Patch dynamicResourceService allocation maths (2.2)

5\. \[ ] Verify billing rules \& CSV (3.1–3.2)

6\. \[ ] Regression tests for above flows (1.5, 3.3)

7\. \[ ] Background daily auto-balance job (2.5)



---



\### Owner / ETA suggestion

| Area | Dev Owner | Target Date |

|------|-----------|-------------|

| Cancellations persistence | Brett | \*\*D+1\*\* |

| Reactive rebalance | Assistant + Brett | D+3 |

| Billing verification | Assistant | D+5 |

| Automated tests | TBD | D+6 |



---



\*\*Keep notes in `/docs/dev-journal.md` as fixes land.\*\*

When a section is complete, tick it off and move ticket to “Done” in Trello board `RABS-POC`.

