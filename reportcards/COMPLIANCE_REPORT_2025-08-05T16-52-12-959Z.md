# RABS Spec Compliance Report

Generated on: 06/08/2025, 02:52:16

## Summary

- API Endpoints: 18
- Missing Directories: 3
- Missing Files: 0

## Progress Trajectory

Comparing with previous report from Invalid Date:

| Metric | Previous | Current | Change | Status |
|--------|----------|---------|--------|--------|
| API Endpoints | 0 | 18 | +18 | ⬆️  |
| Missing Directories | 11 | 3 | +8 | ⬆️  |
| Missing Files | 5 | 0 | +5 | ⬆️  |
| Total Issues | 16 | -15 | +31 | ⬆️  |

### Trend Over Time

Last 4 reports:

```
Issues |---->
    16 |  * 
    15 |  * 
    14 |  * 
    13 |  * 
    12 |  * 
    11 |  * 
    10 |  * 
     9 |  * 
     8 |*** 
     7 |*** 
     6 |*** 
     5 |*** 
     4 |*** 
     3 |*** 
     2 |*** 
     1 |*** 
       +----
        1 2 3 4
```

## API Endpoints

Found 18 API endpoints.

| Method | Path | Handler |
|--------|------|--------|
| GET | /api/v1/cards | async |
| GET | /api/v1/cards/:id | async |
| GET | /api/v1/summary | async |
| GET | /api/v1/alerts | async |
| GET | /api/v1/ | unknown |
| GET | /api/v1/ | async |
| GET | /api/v1/:id | async |
| GET | /api/v1/ | async |
| GET | /api/v1/:id | async |
| POST | /api/v1/ | async |
| GET | /api/v1/:programId/time-slots | async |
| POST | /api/v1/:programId/time-slots | async |
| GET | /api/v1/:programId/participants | async |
| POST | /api/v1/:programId/participants | async |
| GET | /api/v1/ | async |
| GET | /api/v1/:id | async |
| GET | /api/v1/ | async |
| GET | /api/v1/:id | async |

## Missing Directories

The following directories are missing and should be created:

- ../backend/controllers
- ../backend/services
- ../backend/models

## Missing Files

All required files exist.

## Database Information

Database snapshot available at: ../CURRENT_DATABASE.md

### Tables and Row Counts

| Table Name | Row Count |
|------------|-----------|
| billing_codes | 8 |
| change_log | 0 |
| event_card_map | 0 |
| history_pinned_artifacts | 0 |
| history_ribbon_participants | 0 |
| history_ribbon_shifts | 0 |
| history_ribbon_staff | 0 |
| history_ribbon_tags | 0 |
| loom_instances | 0 |
| loom_participant_attendance | 0 |
| loom_staff_assignments | 0 |
| loom_vehicle_assignments | 0 |
| master_schedule_items | 14 |
| migrations | 4 |
| participant_billing_codes | 0 |
| participants | 120 |
| payment_diamonds | 0 |
| pending_enrollment_changes | 0 |
| program_enrollments | 0 |
| program_participants | 2 |
| programs | 2 |
| rules_participant_schedule | 0 |
| rules_program_exceptions | 0 |
| rules_programs | 0 |
| rules_staff_roster | 0 |
| schedule | 0 |
| settings | 4 |
| staff | 58 |
| staff_unavailabilities | 0 |
| system_logs | 5 |
| tgl_config | 4 |
| tgl_loom_audit_log | 4 |
| tgl_loom_instances | 1 |
| tgl_loom_participant_allocations | 0 |
| tgl_loom_staff_shifts | 0 |
| tgl_loom_time_slots | 3 |
| tgl_loom_vehicle_runs | 0 |
| tgl_operator_intents | 0 |
| tgl_settings | 17 |
| tgl_temporal_exceptions | 0 |
| vehicle_blackouts | 0 |
| vehicles | 16 |
| venues | 2 |

