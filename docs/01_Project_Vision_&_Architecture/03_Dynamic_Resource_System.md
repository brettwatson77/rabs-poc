\# Dynamic Resource Allocation System

\*(RABS-POC ― July 2025)\*



---



\## 1  System Overview \& Capabilities

RABS now moves from static rostering to an \*\*auto-orchestrated logistics engine\*\* that:



\* Calculates staff \& vehicle needs live from participant numbers

\* Chooses staff who still need contracted hours

\* Allocates 10-seater buses, preferring 5 clients per run for time efficiency

\* Calls Google Maps to build optimal pickup / drop-off routes

\* Reacts instantly to adds, cancels or leaves – re-balancing staff, buses \& routes

\* Works for \*\*all\*\* programs (existing \& new) and is exposed through REST APIs \& a Dynamic Demo UI.



This delivers true intelligent resource allocation before any ML layer is applied.



---



\## 2  Technical Architecture



Component | Responsibility

---|---

`dynamicResourceService.js` | Core engine – staffing, vehicle allocation, route optimisation, rebalancing

`routeOptimizationService.js` | Google Maps calls, distance matrix, polyline decode, traffic options

`dynamicResourceController.js` | Express controller wiring REST → services

`dynamicResources.js` | Router (`/api/v1/dynamic-resources/\*`)

DB tables | `staff\_assignments`, `vehicle\_assignments`, `routes`, `route\_stops`, plus existing participants / attendance

Frontend ‑ React | `DynamicResourceDemo.jsx` page (map visualisation, live add/remove, rebalance, optimise)

Settings | `settings.google\_maps\_enabled` + `.env` keys



---



\## 3  How It Works  (End-to-End Flow)



1\. \*\*Participant change\*\* (add / cancel / leave) hits `POST /dynamic-resources/participant-change`.

2\. `dynamicResourceService.handleParticipantChange()` updates `attendance` then calls `rebalanceResources()`.

3\. `rebalanceResources()`

&nbsp;  a. Reads live participant list → `calculateRequiredResources()`

&nbsp;  b. \*\*Staffing\*\* → `allocateStaff()` (1:4 rule, picks staff with highest remaining hours)

&nbsp;  c. \*\*Vehicles\*\* → `allocateVehicles()` (bus capacity logic)

&nbsp;  d. \*\*Routes\*\* → `optimizeRoutes()` which groups riders per bus and invokes Google Maps Directions.

4\. New allocations stored in `staff\_assignments`, `vehicle\_assignments`, `routes`, `route\_stops`.

5\. Client UI polls `GET /dynamic-resources/status/:piId` or sockets (future) and redraws.



---



\## 4  API End-points



Method \& Path | Purpose

---|---

`GET  /dynamic-resources/status/:programInstanceId` | Current participant count, staff/vehicle requirement vs assigned, route count

`POST /dynamic-resources/rebalance/:programInstanceId` | Force full recalculation

`POST /dynamic-resources/participant-change` `{ participantId, programInstanceId, changeType }` | Add / cancel / leave triggers auto-rebalance

`POST /dynamic-resources/optimize-routes/:programInstanceId` | Re-run Google Maps optimisation only

`GET  /dynamic-resources/routes/:programInstanceId` | Detailed route + stops for map

`POST /dynamic-resources/programs` | Create \*\*dynamic\*\* program (repeat pattern, instances auto-generated)



All live under `/api/v1`.



---



\## 5  Demo Scenarios \& Usage



Scenario | What to do | Expected System Behaviour

---|---|---

Create “Art Therapy” | Use \*\*New Program\*\* form → weekly Wed | 8 future instances generated, zero staff/vehicles until participants exist

Enroll participants 1-4 | In Demo page “Add Participant” | On 4th enrolment staff required=1, auto-assigns staff S\* with greatest remaining hrs

Enroll participant 5 | Auto-assigns 2nd staff, allocates 1 bus, builds pickup route Green Valley → venue

Scale to 35 | Continue adding → system grows to 9 staff, 4 buses, multi-route optimisation

Cancel one client | Remove participant → engine re-runs: maybe drops a bus, condenses routes

Click \*\*Rebalance Resources\*\* | Manual trigger | Forces immediate recalculation (useful after manual staff swap)

Click \*\*Optimize Routes\*\* | Re-optimises waypoints (e.g. after traffic spike)



---



\## 6  Google Maps Integration



Step | Detail

---|---

API key | `.env` → `GOOGLE\_MAPS\_API\_KEY` (backend) \& `VITE\_GOOGLE\_MAPS\_API\_KEY` (frontend)

Enable | `settings.google\_maps\_enabled = 1` (done by `enableGoogleMaps.js`)

Geocoding | `batchGeocodeParticipants()` fills missing lat/lng

Directions | `Directions API` with `waypoints=optimize:true`

Traffic | Optional `departure\_time=now`, `traffic\_model=best\_guess`

Fallback | If API key absent, Haversine sorting is used (still demo-able offline)



---



\## 7  Auto-Staffing Rules



Rule | Implementation

---|---

Base ratio | \*\*1 staff : 4 participants\*\* – ceiling division `Math.ceil(count/4)`

Lead assignment | First staff = `lead`, rest = `support`

Priority | Ordered by \*\*remaining contracted hours DESC\*\* so under-utilised staff fill first

Availability check | Cross-checked against `staff\_availability` day/time window

Transactions | All inserts in a single `BEGIN…COMMIT` to avoid UNIQUE violations



---



\## 8  Vehicle Allocation Logic



Constraint | Value

---|---

Vehicle type | 10-seater bus (9 clients + 1 driver)

Preferred load | \*\*5 participants\*\* per vehicle for faster runs

Hard cap | 9 participants max (safety margin)

Driver | Chosen from already assigned non-lead staff when possible

Availability | Vehicle free if no overlapping assignment on same date \& time window

Assignment table | `vehicle\_assignments` (links driver \& program\_instance)



---



\## 9  Route Optimisation Features



Feature | Description

---|---

Grouping | Participants divided across vehicles (target 5/vehicle) before optimisation

Optimiser | Google Maps Directions `optimize:true` returns waypoint order

Duration \& Distance | Stored in `routes` (minutes, km)

Stops | Saved in `route\_stops` with ETA back-calculated from program start (pickup) or end (drop-off)

Polylines | Encoded polyline returned for frontend map overlay

Re-optimisation | Triggered automatically on participant change or via `/optimize-routes`



---



\## 10  Dynamic Demo Page (`/dynamic-demo`)



Section | What You Can Do

---|---

Program List | Click any upcoming instance to load live status

Resource Status Card | View participants, required vs assigned staff/vehicles; press \*\*Rebalance\*\* or \*\*Optimize\*\*

Participant Management | Add (dropdown/random) or remove participants – watch metrics update in seconds

Route Visualisation | See per-bus itinerary, ETAs, and Google Map with markers \& coloured path (blue = pickup, orange = drop-off)

New Program Form | Create fresh dynamic programs that instantly adopt all logic



\*\*This single page is the showcase:\*\* in < 60 seconds you can demonstrate every rule above, proving that RABS automatically converts raw client changes into a fully resourced, mapped, and auditable service run.



---



\### 🚀  Why It Matters

Without any AI layer we already:

• Cut coordinator workload (no manual counts)

• Guarantee ratio compliance \& NHVAS capacity limits

• Produce driver run-sheets instantly

• Adapt live to cancellations



Add your future “Brainframe” NL reasoning on top and the system will not only react, it will \*\*predict\*\* and \*\*negotiate\*\* – but the intelligent foundation is now in place.

