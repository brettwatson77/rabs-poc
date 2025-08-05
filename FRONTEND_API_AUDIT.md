# Front-End ⇆ Back-End API Audit  
Comprehensive reference of every HTTP request **initiated by the React front-end** (pages & major shared components).  
The list is strictly what the UI tries to call—​it does **not** guarantee the route really exists or is working.

---

## Legend  

• **Method** – HTTP verb used.  
• **Endpoint** – Path as requested by the browser (relative to `http://{HOST}:3009`).  
• **Request Payload** – What the frontend SENDS (query parameters, JSON body, form data).  
• **Expected Response** – What the frontend EXPECTS to RECEIVE back.  
• `…` denotes "other unchanged keys".  

---

## 1. Dashboard.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/dashboard/cards` | **Query**: `date=YYYY-MM-DD` (ISO format date string) | **Success**: `{ success: true, data: [{ instanceId, programName, startTime, endTime, participants: [{ id, firstName, lastName, supervisionMultiplier }], staff: [{ id, firstName, lastName, role }], venueName, venueAddress }] }` <br>**Error**: `{ success: false, message: string }` |
| 2 | GET | `/api/v1/loom/instances` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (date range) | **Success**: `{ success: true, data: [{ id, program_id, instance_date, date, start_time, end_time, venue_id, status, participants_count, staff_count, manually_modified, notes, program_name, participant_count, vehicle_count }] }` |
| 3 | GET | `/api/v1/finance/metrics` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | **Success**: `{ success: true, data: { totalRevenue, totalCost, grossMargin, participantHours, staffHours, staffUtilization } }` |

---

## 2. MasterSchedule.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | POST | `/api/v1/programs` | **JSON Body**: <pre>{<br>  name: string,<br>  description: string,<br>  venueId: uuid,<br>  startDate: "YYYY-MM-DD",<br>  endDate: "YYYY-MM-DD",<br>  timeSlots: [{ start: "HH:MM", end: "HH:MM" }],<br>  repeatPattern: "weekly"&#124;"fortnightly"&#124;"once",<br>  participants: [uuid, uuid, ...],<br>  staffRatio: number,<br>  program_type: string,<br>  days_of_week: [0,1,2,3,4,5,6]<br>}</pre> | **Success**: `{ success: true, data: { id: uuid, ...programData } }` <br>**Error**: `{ success: false, message: string }` |
| 2 | GET | `/api/v1/programs` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (optional) | **Success**: `{ success: true, data: [{ id, name, description, venue_id, start_date, end_date, time_slots, repeat_pattern, days_of_week, program_type, active }] }` |
| 3 | PATCH | `/api/v1/programs/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: Any subset of program fields to update | **Success**: `{ success: true, data: { ...updatedProgram } }` |
| 4 | DELETE | `/api/v1/programs/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 5 | GET | `/api/v1/venues` | **Query**: None or `?search=searchText` | **Success**: `{ success: true, data: [{ id, name, address, suburb, state, postcode, capacity, lat, lng }] }` |
| 6 | GET | `/api/v1/participants` | **Query**: `active=true&search=searchText` (both optional) | **Success**: Array of participants `[{ id, first_name, last_name, supervision_multiplier, postcode, lat, lng, address, suburb, state, active }]` |
| 7 | GET | `/api/v1/staff` | **Query**: `active=true&search=searchText` (both optional) | **Success**: `{ success: true, data: [{ id, first_name, last_name, schads_level, position, contracted_hours, base_pay_rate }] }` |

---

## 3. Roster.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/roster` | **Query**: Either `date=YYYY-MM-DD` OR `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | **Success**: `{ success: true, data: { programInstances: [{ id, program_id, date, start_time, end_time, venue_name, program_name, staff: [...], participants: [...], requiredStaffCount, staffingStatus }], rosterByTimeSlot: { "08:30:00": [instances], "09:00:00": [instances] } } }` |
| 2 | GET | `/api/v1/roster/metrics` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | **Success**: `{ success: true, data: { totalShifts, totalStaffHours, totalStaffCost, averageHourlyRate, staffUtilization, schadsBreakdown: { "1": count, "2": count } } }` |
| 3 | POST | `/api/v1/roster/staff-shift` | **JSON Body**: <pre>{<br>  instanceId: uuid,<br>  staffId: uuid,<br>  role: "SUPPORT_WORKER"&#124;"TEAM_LEADER"&#124;"DRIVER",<br>  startTime: "HH:MM:SS",<br>  endTime: "HH:MM:SS"<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |
| 4 | DELETE | `/api/v1/roster/staff-shift/:shiftId` | **URL Param**: `shiftId` (uuid) | **Success**: `{ success: true }` |
| 5 | PATCH | `/api/v1/roster/staff-shift/:shiftId` | **URL Param**: `shiftId` (uuid)<br>**JSON Body**: Fields to update (startTime, endTime, role) | **Success**: `{ success: true, data: { ...updatedShift } }` |

---

## 4. Participants.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/participants` | **Query**: `search=searchText&active=true&page=1&limit=20` (all optional) | **Success**: `{ success: true, data: [{ id, first_name, last_name, email, phone, address, suburb, state, postcode, date_of_birth, ndis_number, supervision_multiplier, active, photo_url, location_lat, location_lng }], total: number, page: number, limit: number }` |
| 2 | POST | `/api/v1/participants` | **JSON Body**: <pre>{<br>  first_name: string,<br>  last_name: string,<br>  email: string,<br>  phone: string,<br>  address: string,<br>  suburb: string,<br>  state: string,<br>  postcode: string,<br>  date_of_birth: "YYYY-MM-DD",<br>  ndis_number: string,<br>  supervision_multiplier: number,<br>  active: boolean,<br>  photo_url?: string,<br>  location_lat?: number,<br>  location_lng?: number<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |
| 3 | PATCH | `/api/v1/participants/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: Any subset of participant fields to update | **Success**: `{ success: true, data: { ...updatedParticipant } }` |
| 4 | DELETE | `/api/v1/participants/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 5 | GET | `/api/v1/participants/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true, data: { ...participantDetails } }` |

---

## 5. Staff.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/staff` | **Query**: `search=searchText&active=true&page=1&limit=20` (all optional) | **Success**: `{ success: true, data: [{ id, first_name, last_name, position, email, phone, address, suburb, state, postcode, qualifications, active, photo_url, location_lat, location_lng, status, contracted_hours, base_pay_rate, schads_level }] }` |
| 2 | POST | `/api/v1/staff` | **JSON Body**: <pre>{<br>  first_name: string,<br>  last_name: string,<br>  position: string,<br>  email: string,<br>  phone: string,<br>  address: string,<br>  suburb: string,<br>  state: string,<br>  postcode: string,<br>  qualifications?: string,<br>  active: boolean,<br>  photo_url?: string,<br>  contracted_hours: number,<br>  base_pay_rate: number<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |
| 3 | PATCH | `/api/v1/staff/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: Any subset of staff fields to update | **Success**: `{ success: true, data: { ...updatedStaff } }` |
| 4 | DELETE | `/api/v1/staff/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 5 | GET | `/api/v1/staff/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true, data: { ...staffDetails } }` |

---

## 6. Vehicles.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/vehicles` | **Query**: `active=true&search=searchText` (both optional) | **Success**: `{ success: true, data: [{ id, code, make, model, year, registration, capacity, fuel_type, fuel_consumption, active, photo_url, last_service_date, next_service_due }] }` |
| 2 | POST | `/api/v1/vehicles` | **JSON Body**: <pre>{<br>  code: string,<br>  make: string,<br>  model: string,<br>  year: number,<br>  registration: string,<br>  capacity: number,<br>  fuel_type: "PETROL"&#124;"DIESEL"&#124;"ELECTRIC"&#124;"HYBRID",<br>  fuel_consumption: number,<br>  active: boolean,<br>  photo_url?: string,<br>  last_service_date?: "YYYY-MM-DD",<br>  next_service_due?: "YYYY-MM-DD"<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |
| 3 | PATCH | `/api/v1/vehicles/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: Any subset of vehicle fields to update | **Success**: `{ success: true, data: { ...updatedVehicle } }` |
| 4 | DELETE | `/api/v1/vehicles/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 5 | GET | `/api/v1/vehicles/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true, data: { ...vehicleDetails } }` |

---

## 7. Venues.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/venues` | **Query**: `search=searchText&active=true` (both optional) | **Success**: `{ success: true, data: [{ id, name, address, suburb, state, postcode, capacity, lat, lng, active, description, amenities }] }` |
| 2 | POST | `/api/v1/venues` | **JSON Body**: <pre>{<br>  name: string,<br>  address: string,<br>  suburb: string,<br>  state: string,<br>  postcode: string,<br>  capacity: number,<br>  lat?: number,<br>  lng?: number,<br>  active: boolean,<br>  description?: string,<br>  amenities?: string<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |
| 3 | PATCH | `/api/v1/venues/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: Any subset of venue fields to update | **Success**: `{ success: true, data: { ...updatedVenue } }` |
| 4 | DELETE | `/api/v1/venues/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 5 | GET | `/api/v1/venues/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true, data: { ...venueDetails } }` |

---

## 8. Finance.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/finance/billing-codes` | **Query**: None | **Success**: `{ success: true, data: [{ id, code, description, rate, ratioSplit: { "1:1": rate, "1:2": rate, "1:3": rate, "1:4": rate } }] }` |
| 2 | POST | `/api/v1/finance/bulk-upload` | **FormData**: <pre>{<br>  file: File (CSV/XLSX),<br>  type: "billing-codes"&#124;"rates"&#124;"invoices",<br>  overwrite: boolean<br>}</pre> | **Success**: `{ success: true, data: { imported: number, failed: number, errors: string[] } }` |
| 3 | GET | `/api/v1/finance/metrics` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | **Success**: `{ success: true, data: { totalRevenue, totalClaimable, gst, staffCosts, vehicleCosts, venueCosts, grossMargin, marginPercent } }` |
| 4 | GET | `/api/v1/finance/invoices` | **Query**: `month=YYYY-MM&status=draft|submitted|paid` (both optional) | **Success**: `{ success: true, data: [{ invoiceId, date, total, participantCount, status, submittedDate, paidDate }] }` |
| 5 | POST | `/api/v1/finance/generate-invoices` | **JSON Body**: <pre>{<br>  month: "YYYY-MM",<br>  participants: [uuid]  // Optional, if empty generates for all<br>}</pre> | **Success**: `{ success: true, data: { generated: number, updated: number } }` |
| 6 | PATCH | `/api/v1/finance/invoices/:id/status` | **URL Param**: `id` (uuid)<br>**JSON Body**: `{ status: "draft"|"submitted"|"paid" }` | **Success**: `{ success: true }` |

---

## 9. LoomControls.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/loom/settings` | **Query**: None | **Success**: `{ success: true, data: { windowWeeks: number, lastRoll: ISODate, nextRollDue: ISODate, autoRollEnabled: boolean } }` |
| 2 | PATCH | `/api/v1/loom/settings` | **JSON Body**: <pre>{<br>  windowWeeks?: number,<br>  autoRollEnabled?: boolean<br>}</pre> | **Success**: `{ success: true, data: { ...updatedSettings } }` |
| 3 | POST | `/api/v1/loom/roll` | **JSON Body**: <pre>{<br>  expandToDate: "YYYY-MM-DD",<br>  force?: boolean<br>}</pre> | **Success**: `{ success: true, data: { newInstances: number, updatedInstances: number, errors: string[] } }` |
| 4 | GET | `/api/v1/loom/instances` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&status=draft|confirmed|cancelled` | **Success**: `{ success: true, data: [{ id, program_id, instance_date, date, start_time, end_time, status, participants_count, staff_count, manually_modified, program_name }] }` |
| 5 | PATCH | `/api/v1/loom/instances/:id` | **URL Param**: `id` (uuid)<br>**JSON Body**: <pre>{<br>  status?: "draft"&#124;"confirmed"&#124;"cancelled",<br>  notes?: string,<br>  manually_modified?: boolean<br>}</pre> | **Success**: `{ success: true, data: { ...updatedInstance } }` |
| 6 | DELETE | `/api/v1/loom/instances/:id` | **URL Param**: `id` (uuid) | **Success**: `{ success: true }` |
| 7 | GET | `/api/v1/loom/logs` | **Query**: `level=info|warning|error&limit=100` (both optional) | **Success**: `{ success: true, data: [{ id, timestamp, level, message, details }] }` |
| 8 | DELETE | `/api/v1/loom/logs/clear` | **Query**: None | **Success**: `{ success: true, data: { deleted: number } }` |
| 9 | POST | `/api/v1/intentions` | **JSON Body**: <pre>{<br>  type: "ADD_PARTICIPANT"&#124;"REMOVE_PARTICIPANT"&#124;<br>       "MODIFY_TIME"&#124;"CHANGE_VENUE"&#124;<br>       "ASSIGN_STAFF"&#124;"CREATE_PROGRAM",<br>  date: "YYYY-MM-DD",<br>  programId?: uuid,<br>  participantId?: uuid,<br>  staffId?: uuid,<br>  venueId?: uuid,<br>  startTime?: "HH:MM:SS",<br>  endTime?: "HH:MM:SS",<br>  metadata?: object,<br>  permanent: boolean<br>}</pre> | **Success**: `{ success: true, data: { id: uuid } }` |

---

## 10. LoomSettings.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/loom/settings` | **Query**: None | **Success**: `{ success: true, data: { windowWeeks, lastRoll, nextRollDue, autoRollEnabled, staffRatios: { default: number, highSupport: number }, defaultValues: { ... } } }` |
| 2 | PATCH | `/api/v1/loom/settings` | **JSON Body**: Any subset of settings to update | **Success**: `{ success: true, data: { ...updatedSettings } }` |
| 3 | POST | `/api/v1/loom/settings/reset` | **Query**: None | **Success**: `{ success: true, message: "Settings reset to defaults" }` |

---

## 11. ParticipantPlanner.jsx

| # | Method | Endpoint | Request Payload | Expected Response |
|---|--------|----------|----------------|-------------------|
| 1 | GET | `/api/v1/planner` | **Query**: `participantId=uuid&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | **Success**: `{ success: true, data: { weeklySummary: [{ week: string, totalHours: number, programs: number }], dayBreakdown: { "2025-08-05": [{ programName, startTime, endTime, hours }] } } }` |
| 2 | POST | `/api/v1/planner/set-goals` | **JSON Body**: <pre>{<br>  participantId: uuid,<br>  goals: [<br>    { text: string, dueDate: "YYYY-MM-DD", category: string }<br>  ]<br>}</pre> | **Success**: `{ success: true, data: { updatedGoals: number } }` |
| 3 | GET | `/api/v1/participants/:id/history` | **URL Param**: `id` (uuid)<br>**Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (optional) | **Success**: `{ success: true, data: [{ date, programName, hours, billingCode, status }] }` |
| 4 | POST | `/api/v1/planner/generate-report` | **JSON Body**: <pre>{<br>  participantId: uuid,<br>  startDate: "YYYY-MM-DD",<br>  endDate: "YYYY-MM-DD",<br>  includeGoals: boolean,<br>  includeFinancial: boolean<br>}</pre> | **Success**: `{ success: true, data: { reportUrl: string } }` |

---

## 12. Schedule & Shared Components

The `ScheduleCard`, `TimelineColumn`, `CalendarView`, and `MasterCard` components **do not initiate their own fetches**; they consume data passed down from pages such as MasterSchedule or Roster.  

`BusRunAnalysisTerminal.jsx` makes a single call:  

| Method | Endpoint | Request Payload | Expected Response |
|--------|----------|----------------|-------------------|
| GET | `/api/v1/routes/analysis` | **Query**: `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&vehicleId=uuid` (vehicleId optional) | **Success**: `{ success: true, data: { runs: number, distanceKm: number, fuelLitres: number, costEstimate: number, co2Emissions: number } }` |

---

## 13. System / Health

Navbar "System" dropdown pings:  

| Method | Endpoint | Request Payload | Expected Response |
|--------|----------|----------------|-------------------|
| GET | `/api/v1/system/health` | **Query**: None | **Success**: `{ status: "ok", version: string, uptime: number, memory: { used: number, total: number } }` |
| GET | `/api/v1/system/db-status` | **Query**: None | **Success**: `{ status: "ok", connections: number, version: string }` |
| POST | `/api/v1/system/clear-cache` | **JSON Body**: `{ target: "all"|"programs"|"participants"|"staff" }` | **Success**: `{ success: true, message: "Cache cleared" }` |

---

## 14. Authentication (future placeholder)

The current POC bypasses auth, but stubs exist:

| Method | Endpoint | Request Payload | Expected Response |
|--------|----------|----------------|-------------------|
| POST | `/api/v1/auth/login` | **JSON Body**: `{ email: string, password: string }` | **Success**: `{ token: string, user: { id, name, role, permissions: [] } }` |
| GET | `/api/v1/auth/me` | **Headers**: `{ Authorization: "Bearer {token}" }` | **Success**: `{ id, name, email, role, permissions: [] }` |
| POST | `/api/v1/auth/logout` | **Headers**: `{ Authorization: "Bearer {token}" }` | **Success**: `{ success: true, message: "Logged out successfully" }` |

---

## 15. Summary of Endpoints (unique list)

```
/api/v1/dashboard/cards
/api/v1/roster
/api/v1/roster/metrics
/api/v1/roster/staff-shift
/api/v1/participants
/api/v1/staff
/api/v1/vehicles
/api/v1/venues
/api/v1/programs
/api/v1/finance/billing-codes
/api/v1/finance/metrics
/api/v1/finance/bulk-upload
/api/v1/finance/invoices
/api/v1/finance/generate-invoices
/api/v1/loom/settings
/api/v1/loom/roll
/api/v1/loom/instances
/api/v1/loom/logs
/api/v1/loom/logs/clear
/api/v1/planner
/api/v1/planner/set-goals
/api/v1/planner/generate-report
/api/v1/routes/analysis
/api/v1/system/health
/api/v1/system/db-status
/api/v1/system/clear-cache
/api/v1/auth/login
/api/v1/auth/me
/api/v1/auth/logout
/api/v1/intentions
```

---

### Next Steps

1. **Back-End validation:** verify each path actually exists and returns the documented payload.  
2. **Contract tests:** build automated tests that load the UI and assert shape conformity.  
3. **Iterative cleanup:** remove unused/hard-coded sample data & align naming conventions across layers.  
4. **Central Type Defs:** generate shared TypeScript interfaces or JSON Schema from this document.

*End of audit*  
