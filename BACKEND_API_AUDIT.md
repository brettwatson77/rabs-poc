# Back-End API Audit  
_Comprehensive inventory of **all Express routes that actually exist** in the current `backend/` source tree (as committed)._  
> Build: 2025-08-05  

Each section = one router file.  
• **Mounted at** = path used in `server.js`.  
• **Endpoint** = final path once router is mounted.  
• **Method(s)** = HTTP verbs exported.  
• **Handler** = controller function invoked.  
• **Notes** = empty handler, TODO, or special behaviour.

---

## 1. participants.js  
Mounted at `/api/v1/participants`

| Endpoint | Method | Handler | Notes |
|----------|--------|---------|-------|
| `/` | GET  | `participantController.getAll` | supports `search`, `active` query |
| `/` | POST | `participantController.create` | body-validated |
| `/:id` | GET | `participantController.getById` | — |
| `/:id` | PATCH | `participantController.update` | partial update |
| `/:id` | DELETE | `participantController.remove` | soft-delete flag |

---

## 2. staff.js  
Mounted at `/api/v1/staff`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET  | `staffController.getAll` |
| `/` | POST | `staffController.create` |
| `/:id` | GET | `staffController.getById` |
| `/:id` | PATCH | `staffController.update` |
| `/:id` | DELETE | `staffController.remove` |

---

## 3. vehicles.js  
Mounted at `/api/v1/vehicles`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET  | `vehicleController.getAll` |
| `/` | POST | `vehicleController.create` |
| `/:id` | GET | `vehicleController.getById` |
| `/:id` | PATCH | `vehicleController.update` |
| `/:id` | DELETE | `vehicleController.remove` |

---

## 4. venues.js  
Mounted at `/api/v1/venues`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET  | `venueController.getAll` |
| `/` | POST | `venueController.create` |
| `/:id` | GET | `venueController.getById` |
| `/:id` | PATCH | `venueController.update` |
| `/:id` | DELETE | `venueController.remove` |

---

## 5. programs.js  
Mounted at `/api/v1/programs`

| Endpoint | Method | Handler | Notes |
|----------|--------|---------|-------|
| `/` | GET  | `programController.list` | date-range optional |
| `/` | POST | `programController.create` |
| `/:id` | GET | `programController.get` |
| `/:id` | PATCH | `programController.update` |
| `/:id` | DELETE | `programController.remove` |

---

## 6. roster.js  
Mounted at `/api/v1/roster`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET | `rosterController.getRoster` |
| `/metrics` | GET | `rosterController.getRosterMetrics` |
| `/staff-shift` | POST | `rosterController.addStaffShift` *(stub, todo)* |
| `/staff-shift/:shiftId` | PATCH | `rosterController.updateStaffShift` |
| `/staff-shift/:shiftId` | DELETE | `rosterController.removeStaffShift` |

---

## 7. dashboard.js  
Mounted at `/api/v1/dashboard`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/cards/:date` | GET | `programController.getCardsByDate` | expects date param |

_No route for `/dashboard/cards?date=…` – frontend mismatch._

---

## 8. finance.js  
Mounted at `/api/v1/finance`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/billing-codes` | GET  | `financeController.getBillingCodes` |
| `/billing-codes` | POST | `financeController.createBillingCode` |
| `/metrics` | GET | `financeController.getMetrics` |
| `/bulk-upload` | POST | `financeController.bulkUpload` |
| `/invoices` | GET | `financeController.listInvoices` |
| `/generate-invoices` | POST | **NOT IMPLEMENTED** (route missing) |

---

## 9. rates.js  
Mounted at `/api/v1/rates`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET | `rateController.getAll` |
| `/` | POST | `rateController.create` |
| `/:id` | PATCH | `rateController.update` |
| `/:id` | DELETE | `rateController.remove` |

---

## 10. loom.js  
Mounted at `/api/v1/loom`

| Endpoint | Method | Handler | Notes |
|----------|--------|---------|-------|
| `/settings` | GET  | `loomConfigController.getSettings` |
| `/settings` | PATCH | `loomConfigController.updateSettings` |
| `/roll` | POST | `loomController.rollWindow` |
| `/instances` | GET | `loomController.getInstances` |
| `/instances/:id` | PATCH | `loomController.updateInstance` |
| `/instances/:id` | DELETE | `loomController.deleteInstance` |

---

## 11. loomLogs.js  
Mounted at `/api/v1/loom` (shares base)

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/logs` | GET | `loomLogController.getLogs` |
| `/logs/clear` | DELETE | `loomLogController.clearLogs` |

---

## 12. intentions.js  
Mounted at `/api/v1/intentions`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET | `intentionController.list` |
| `/` | POST | `intentionController.create` |
| `/:id` | PATCH | `intentionController.update` |
| `/:id` | DELETE | `intentionController.remove` |

---

## 13. planner.js  
Mounted at `/api/v1/planner`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/` | GET | `plannerController.getPlannerView` |
| `/set-goals` | POST | `plannerController.setGoals` |
| `/generate-report` | POST | **NOT IMPLEMENTED** (missing in router) |

---

## 14. system.js  
Mounted at `/api/v1/system`

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/health` | GET | `systemController.getHealth` |
| `/db-status` | GET | `systemController.getDbStatus` |
| `/clear-cache` | POST | **Route missing – not in file** |

---

## 15. dynamicResources.js  
Mounted at `/api/v1/dynamic-resources`

| Endpoint | Method | Handler | Notes |
|----------|--------|---------|-------|
| `/rebalance` | POST | `dynamicResourceController.rebalance` |
| `/route-optimise` | POST | `dynamicResourceController.optimiseRoutes` |

---

## 16. availability.js & cancellations.js  
Mounted at `/api/v1/availability` and `/api/v1/cancellations`  
Both routers are thin wrappers around `availabilityController` & `cancellationController` with standard CRUD (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`).  

---

## 17. Other Routers  
| Mount Path | Router File | Status |
|------------|-------------|--------|
| `/api/v1/schedule` | schedule.js | only GET `/` => `scheduleController.getSchedule` |
| `/api/v1/staff-assignments` | staffAssignments.js | full CRUD present |
| `/api/v1/recalculate` | recalculation.js | POST `/process` => `recalculationController.process` |
| `/api/v1/changelog` | changelog.js | GET `/` list, GET `/:id`, POST, etc. |

---

## Missing vs Front-End Expectations

| Needed by FE | Exists? | Comment |
|--------------|---------|---------|
| **`GET /dashboard/cards?date=`** | ❌ | only `/dashboard/cards/:date` present |
| **`GET /roster/metrics`** | ✅ | route exists |
| **`POST /roster/staff-shift`** | stub | implemented but logic TODO |
| **`PATCH /roster/staff-shift/:id`** | ✅ |
| **`/finance/generate-invoices`** | ❌ |
| **`/loom/logs/clear`** | ✅ |
| **`/planner/generate-report`** | ❌ route missing |
| **`/system/clear-cache`** | ❌ |

---

## Summary

- **Total routers discovered:** 24  
- **Unique operational endpoints:** ≈ 80  
- **High-risk gaps:** dashboard cards, finance invoice generation, planner report, cache clear.  
- **Data mismatch examples:** `/roster` staff subquery expects `schads_level` (fixed); frontend still queries `/dashboard/cards?date=` but backend expects param in path.

This audit provides the _literal_ contract currently enforced by the codebase and highlights critical divergences from the front-end contract.
