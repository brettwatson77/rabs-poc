\# RABS‑POC – PROOF‑OF‑CONCEPT SPECIFICATION

CONTENTS

1\. Mission and Demo Goals

2\. Technology and File Layout

3\. Core Data Entities

4\. Business and Operational Rules

5\. User Interface Workflows

6\. Routing Engine Choices and Integration Notes

7\. Persistence, Seeding and Runtime Behaviour

8\. Environment Variable Checklist (.env.example)

9\. API Surface (Version 1)

10\. Out‑of‑Scope / Mocked Items

11\. Acceptance Criteria and Demo Script

12\. Future‑Facing Notes

---

1\. MISSION AND DEMO GOALS

---

‑ Deliver a browser‑based sandbox that auto‑manages program scheduling, staffing, transport routing and billing for a disability‑services provider.

‑ Eight weeks of seed data are generated on first run; the user can slide the system date forward/backward to watch live recalculation.

‑ A single super‑user account suffices; no granular auth needed.

‑ Demo narrative: make a few enrolment changes, cancel a client, jump ahead in time, generate billing files, print route sheets, prove everything updates instantly.

---

2\. TECHNOLOGY AND FILE LAYOUT

---

Frontend  React + Vite  (Path / frontend)

Backend  Node 16+ / Express (Path / backend)

Database SQLite file stored at /data/rabs‑poc.db

Project root C:\\Users\\brett\\dev\\rabs‑poc\\\\

External domains

UI rabspoc.codexdiz.com

API rabspocb.codexdiz.com/api/v1

Ports are supplied later by Brett via .env.

Directory sketch

/README.md

/POC.md (this file)

/.env.example

/data/

rabs‑poc.db (generated)

/scripts/seed.sql

/backend/…

/frontend/…

---

3\. CORE DATA ENTITIES

---

Participants (10)

‑ id, firstName, lastName, managementType (plan|agency), street, suburb, postcode, attendanceHistory\\\[]

‑ addresses must fall inside Green Valley / Bonnyrigg / Fairfield NSW (synthetic but valid)

Staff (5)

‑ id, name, weeklyAvailability\\\[Mon‑Sun]\\\[timeRange], assignmentHistory\\\[]

Vehicles (4)

‑ id (V1‑V4)

‑ capacitySeats = 10 (driver counts as 1)

‑ preferredLoadPattern = 1 staff + 4 participants where practical

Venues

‑ Centre (90 Edensor Rd Green Valley)

‑ Alt Centre (3 Carramarr Close Picton)

‑ Bowlarama Wetherill Park

‑ Merrylands RSL

Programs (repeat weekly unless toggled)

‑ Centre‑Based Mon‑Fri 09:00‑15:00

‑ Bowling Night Tue 16:30‑20:30

‑ Spin \& Win Wed 16:30‑20:30

‑ Saturday Adventure Sat 08:30‑16:30 AI chooses activity text + venue

‑ Sunday Funday Sun 08:30‑15:30 AI chooses activity text + venue

RateTable (editable by user on /admin/rates)

‑ programId, ratio (1:3 | 1:2 | 1:1), baseHourly, centreFeeHourly, nf2fFeeHourly

Finance artefacts

‑ BulkBillingCSV (one line per billable activity, plan=agency)

‑ InvoiceCSV  (grouped by participant, managementType=plan)

---

4\. BUSINESS AND OPERATIONAL RULES

---

Staffing rule

‑ staffNeeded = ceil(participantCount / 4)

‑ recalc whenever enrolment changes.

Vehicle allocation

‑ choose minimum number of buses satisfying seats AND 60‑minute max ride‑time from last pickup to venue.

‑ if two buses with 4 clients each is faster than one bus with 8 clients, choose two buses.

Routing

‑ primary engine Google Directions + Distance Matrix (keys via .env)

‑ fallback internal nearest‑neighbour + Haversine distance if keys absent.

Program enrolment UI must allow

‑ select participant

‑ choose startDate

‑ check‑boxes for five programs (pre‑ticked where already enrolled)

‑ save updates; system prevents duplicate enrolments.

No‑shows and late cancels

‑ attendance record flagged “cancelled” but billing unchanged

‑ route sheet regenerated; system log entry: No SMS Module for POC – Intended message “…”.

Billing generation

‑ bulk billing export can be run any time and includes all agency‑managed, un‑billed attendance up to chosen cut‑off

‑ invoice export similar for plan‑managed

---

5\. USER INTERFACE WORKFLOWS

---

Master Schedule

‑ week and day views

‑ date slider with “add week” and “delete week” buttons

Participant Planner

‑ enrolment form (see rule above)

Roster / Route Sheet page

‑ table showing staff, buses, ordered pickup list, ETAs

‑ print‑friendly PDF per bus

Finance page

‑ rate table editor

‑ generate bulk billing CSV

‑ generate invoice CSV

‑ download PDF billing summary

Admin pages (optional plain list screens)

‑ participants, staff, vehicles

---

6\. ROUTING ENGINE CHOICES AND INTEGRATION NOTES

---

Preferred

‑ Google Maps APIs

Alternative self‑host or SaaS

‑ OSRM (open‑source, fastest, no traffic)

‑ GraphHopper (route‑optimisation feature, free tier)

‑ OpenRouteService (community server)

‑ Mapbox Directions

Exposure

‑ backend endpoint /api/v1/routes/\\:runId returns polyline + ordered stops

‑ frontend draws route with Leaflet or Google Maps JS SDK

---

7\. PERSISTENCE, SEEDING AND RUNTIME BEHAVIOUR

---

On first run

‑ create SQLite file

‑ run seed script: insert 10 participants, 5 staff, 4 vehicles, venues, rate table placeholders, generate 8 weeks of schedule

Runtime

‑ date slider changes a global “currentDate” in redux/store; backend returns schedule entries relative to this date

‑ seed weeks can be extended by clicking “add week”

---

8\. ENVIRONMENT VARIABLE CHECKLIST (.env.example)

---

PORT=

API\\\_PORT=

DB\\\_PATH=./data/rabs‑poc.db

GOOGLE\\\_MAPS\\\_KEY= (optional)

OPENAI\\\_KEY= (optional)

UI\\\_DOMAIN=rabspoc.codexdiz.com

API\\\_DOMAIN=rabspocb.codexdiz.com

---

9\. API SURFACE (VERSION 1)

---

GET /api/v1/schedule?weekOffset=0

POST /api/v1/enrolment   {participantId, startDate, programIds\\\[]}

POST /api/v1/cancel      {participantId, date, programId}

GET /api/v1/routeSheet/\\:date

POST /api/v1/finance/bulkBilling   {cutOffDate}

POST /api/v1/finance/invoices     {cutOffDate}

GET /api/v1/rates

POST /api/v1/rates       \\\[…]

(configurable ports added in .env)

---

10\. OUT‑OF‑SCOPE / MOCKED ITEMS

---

‑ SMS / email comms (logged only)

‑ Multi‑role authentication

‑ Xero integration

‑ Behaviour plans, medication tracking, dietary data

‑ Live traffic data (unless Google API used)

---

11\. ACCEPTANCE CRITERIA AND DEMO SCRIPT

---

1\. Launch app; master schedule displays week 0.

2\. Slider to week +3 shows identical baseline schedule.

3\. Enrol Participant #3 into Saturday Adventure starting week +2.

4\. Slider to week +2 verifies new enrolment, staff and bus counts updated, route sheet shows Participant #3.

5\. Cancel Participant #7 for next Wednesday Spin \& Win.

6\. Observe roster refresh and “cancelled” tag; Finance page still bills the session.

7\. Generate bulk billing for previous day; CSV downloads with one line per agency‑managed attendance item.

8\. Generate invoices for previous week; CSV grouped by plan‑managed clients.

9\. Print route sheet PDF for next Tuesday; pickups listed in time order.

10\. Toggle Add Week button twice, verify schedule extends; Delete Week removes.

---

12\. FUTURE‑FACING NOTES

---

‑ Replace nearest‑neighbour fallback with full vehicle‑routing optimisation (VRP) once OSRM or GraphHopper is deployed.

‑ Hook finance exports to Xero webhook for automatic reconciliation.

‑ Introduce SMS/Push via Twilio, resend new route sheets on changes.

‑ Split API and UI into separate repos, dockerise for easier deployment.

‑ Migrate seed data to migrations + fixtures for production.

---

\# RABS‑POC ADDITIONAL DETAILS AND SCOPE

additional project information as the scope expands can be listed here.
