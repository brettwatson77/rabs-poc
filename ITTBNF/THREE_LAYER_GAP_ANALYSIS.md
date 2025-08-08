# Three-Layer Gap Analysis  
_Compares **Frontend expectations**, **Backend implementation**, and **Database schema**_  
Generated 2025-08-05  

Legend: ✅ = Match / implemented & wired correctly ❌ = Missing or mismatch  

| Area / Feature | Endpoint(s) (Frontend expectation) | Frontend → Backend | Backend → Database | Notes |
|----------------|------------------------------------|--------------------|--------------------|-------|
| Participants CRUD | `GET/POST/PATCH/DELETE /participants` | ✅ | ✅ | Columns & PKs match audit |
| Participant Details | `GET /participants/:id` + `/history` | ✅ (`:id`) / ❌ (`/history`) | ✅ / ❌ | History route not in backend |
| Staff CRUD | `GET/POST/PATCH/DELETE /staff` | ✅ | ✅ | `schads_level` column now exists |
| Staff Detail | `GET /staff/:id` | ✅ | ✅ | — |
| Vehicles CRUD | `GET/POST/PATCH/DELETE /vehicles` | ✅ | ✅ | Fuel-type enum aligns with DB |
| Vehicles Detail | `GET /vehicles/:id` | ✅ | ✅ | — |
| Venues CRUD | `GET/POST/PATCH/DELETE /venues` | ✅ | ✅ | — |
| Programs CRUD | `GET/POST/PATCH/DELETE /programs` | ✅ | ✅ | Date constraints fixed in DB |
| Dashboard Cards | `GET /dashboard/cards?date=` | ❌ | ✅ | Path/query mismatch (backend uses `/cards/:date`) |
| Roster View | `GET /roster` | ✅ | ✅ | Column names fixed (`loom_instance_id`) |
| Roster Metrics | `GET /roster/metrics` | ✅ | ✅ | — |
| Roster Add Shift | `POST /roster/staff-shift` | ❌ | 🔸 *stub* | Controller exists but logic TODO |
| Finance Billing Codes | `GET /finance/billing-codes` | ✅ | ✅ | Table `billing_codes` present |
| Finance Metrics | `GET /finance/metrics` | ✅ | ✅ | — |
| Finance Bulk Upload | `POST /finance/bulk-upload` | ✅ | ✅ | Uses CSV import |
| Finance Generate Invoices | `POST /finance/generate-invoices` | ❌ | ❌ | Route & logic missing |
| Planner View | `GET /planner` | ✅ | ✅ | — |
| Planner Set Goals | `POST /planner/set-goals` | ✅ | ✅ | Goals stored in JSONB |
| Planner Generate Report | `POST /planner/generate-report` | ❌ | ❌ | Route missing |
| Loom Settings | `GET/PATCH /loom/settings` | ✅ | ✅ | Settings table exists |
| Loom Roll | `POST /loom/roll` | ✅ | ✅ | Window expansion works |
| Loom Instances CRUD | `GET/PATCH/DELETE /loom/instances` | ✅ | ✅ | Enum status matches DB |
| Loom Logs | `GET /loom/logs`, `DELETE /loom/logs/clear` | ✅ | ✅ | System_logs table present |
| Intentions CRUD | `POST /intentions` (FE) + full CRUD (BE) | ✅ (create) | ✅ | Enum updated with `CREATE_PROGRAM` |
| System Health | `GET /system/health` | ✅ | ✅ | — |
| System DB Status | `GET /system/db-status` | ✅ | ✅ | — |
| System Clear Cache | `POST /system/clear-cache` | ❌ | ❌ | Route not implemented |

### Key Gaps  
1. **Dashboard Cards route mismatch** – simplest high-impact fix (`/cards?date` vs `/cards/:date`).  
2. **Finance Generate Invoices** – entirely missing; required for billing workflow.  
3. **Planner Generate Report** – not implemented.  
4. **System Clear Cache** – missing (low risk for demo).  
5. **Roster Add Staff Shift** – controller stub; needs completion for live rostering.  
6. **Participant History endpoint** – referenced by UI, absent in backend.  

### Prioritised Fix List  
1. Align Dashboard cards route (or change FE to use path param).  
2. Implement `POST /finance/generate-invoices` (basic stub returning totals).  
3. Add `POST /planner/generate-report` (can return dummy PDF URL for demo).  
4. Finish logic in `rosterController.addStaffShift`.  
5. Add `/participants/:id/history` endpoint.  
6. Add `/system/clear-cache` route (wrapper around cache service).

Once these ✅ items are addressed, the three layers will be fully aligned for all critical demo paths.  
