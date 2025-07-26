\# RABS-POC: API Reference (Version 1)



This document provides a summary of the key REST API endpoints available in the `rabs-poc` backend.



\*Base URL for all endpoints: `/api/v1`\*



---



\## 1. Schedule \& Enrollment



These endpoints manage the core schedule and participant enrollments.



| Method | Path | Description |

| :--- | :--- | :--- |

| `GET` | `/schedule?weekOffset=0` | Retrieves the program schedule for a given week. The `weekOffset` is relative to the current simulated date. |

| `POST` | `/enrolment` | Creates a new program enrollment for a participant. Body: `{participantId, startDate, programIds\[]}` |

| `POST` | `/cancel` | Cancels a participant's attendance for a specific instance. Body: `{participantId, date, programId}` |



---



\## 2. Dynamic Resource Management



These endpoints interact with the dynamic resource allocation engine.



| Method | Path | Description |

| :--- | :--- | :--- |

| `GET` | `/dynamic-resources/status/:programInstanceId` | Gets the current resource status (participant count, staff needed vs. assigned, etc.) for a program instance. |

| `POST` | `/dynamic-resources/rebalance/:programInstanceId` | Forces a full recalculation of staff, vehicles, and routes for a program instance. |

| `POST` | `/dynamic-resources/participant-change` | The primary endpoint to signal a change in attendance (add/cancel). Triggers an automatic rebalance. Body: `{ participantId, programInstanceId, changeType }` |

| `POST` | `/dynamic-resources/optimize-routes/:programInstanceId`| Triggers only the Google Maps route optimization part of the resource engine. |

| `GET` | `/dynamic-resources/routes/:programInstanceId` | Retrieves the detailed, optimized route data (stops, ETAs, polyline) for a program instance's vehicles. |

| `POST`| `/dynamic-resources/programs` | Creates a new dynamic program with a recurring pattern. |



---



\## 3. Finance \& Billing



These endpoints are used for generating billing artifacts.



| Method | Path | Description |

| :--- | :--- | :--- |

| `POST` | `/finance/bulkBilling` | Generates a CSV for agency-managed billing up to a specified date. Body: `{cutOffDate}` |

| `POST` | `/finance/invoices` | Generates a CSV for plan-managed billing up to a specified date. Body: `{cutOffDate}` |



---



\## 4. Rates \& Configuration



These endpoints manage the billing rate table.



| Method | Path | Description |

| :--- | :--- | :--- |

| `GET` | `/rates` | Retrieves the current billing rate table. |

| `POST` | `/rates` | Updates the billing rate table. Body: `\[{programId, ratio, baseHourly, ...}]` |



---



\## 5. Transport \& Rosters



| Method | Path | Description |

| :--- | :--- | :--- |

| `GET` | `/routeSheet/:date` | Retrieves a consolidated roster and route sheet for a given date, suitable for printing. |

