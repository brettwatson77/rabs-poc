# Database Audit Report

**Generated:** 2025-07-28T16:35:56.592Z

## Database Summary

- **Database:** rabspocdb
- **Tables:** 26
- **Foreign Keys:** 15

## API Summary

- **Endpoints:** 0
- **Tables Referenced:** 0

## Missing Tables

No missing tables found.

## Missing Columns

| Table | Column | Referenced In | Query |
|-------|--------|--------------|-------|
| `loom_participant_attendance` | `instance_id` | dashboardFinanceService.js | `
        SELECT COALESCE(SUM(rli.unit_price), 0) as total_revenue
        FROM loom_participant_atte...` |
| `loom_instances` | `program_id` | dashboardFinanceService.js | `
        SELECT COALESCE(SUM(rli.unit_price), 0) as total_revenue
        FROM loom_participant_atte...` |
| `loom_instances` | `date` | dashboardFinanceService.js | `
        SELECT COALESCE(SUM(rli.unit_price), 0) as total_revenue
        FROM loom_participant_atte...` |
| `loom_instances` | `quality_flag` | eventCardService.js | `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_car...` |
| `loom_instances` | `override_status` | eventCardService.js | `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_car...` |
| `payment_diamonds` | `attendance_id` | dashboardFinanceService.js | `
        SELECT COALESCE(SUM(rli.unit_price), 0) as total_revenue
        FROM loom_participant_atte...` |
| `loom_staff_assignments` | `end_time` | dashboardFinanceService.js | `
        SELECT 
          s.id,
          s.schads_level,
          EXTRACT(EPOCH FROM (lsa.end_tim...` |
| `loom_staff_assignments` | `start_time` | dashboardFinanceService.js | `
        SELECT 
          s.id,
          s.schads_level,
          EXTRACT(EPOCH FROM (lsa.end_tim...` |
| `loom_staff_assignments` | `instance_id` | dashboardFinanceService.js | `
        SELECT 
          s.id,
          s.schads_level,
          EXTRACT(EPOCH FROM (lsa.end_tim...` |
| `loom_staff_assignments` | `assignment_type` | timesheetService.js | `
        SELECT 
          lsa.id AS assignment_id,
          lsa.staff_id,
          s.first_name,
...` |
| `programs` | `day_of_week` | dynamicResourceService.js | `
      SELECT 
        pi.id,
        pi.program_id,
        pi.date,
        pi.start_time,
       ...` |
| `programs` | `venue_id` | dynamicResourceService.js | `
      SELECT 
        pi.id,
        pi.program_id,
        pi.date,
        pi.start_time,
       ...` |
| `programs` | `start_time` | plannerService.js | `
      SELECT 
        pe.id,
        pe.participant_id,
        pe.program_id,
        pe.start_dat...` |
| `programs` | `end_time` | plannerService.js | `
      SELECT 
        pe.id,
        pe.participant_id,
        pe.program_id,
        pe.start_dat...` |
| `programs` | `is_weekend` | plannerService.js | `
      SELECT 
        pe.id,
        pe.participant_id,
        pe.program_id,
        pe.start_dat...` |
| `programs` | `is_centre_based` | plannerService.js | `
      SELECT 
        pe.id,
        pe.participant_id,
        pe.program_id,
        pe.start_dat...` |
| `programs` | `active` | plannerService.js | `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.day_of_week,
        p...` |
| `event_card_map` | `instance_id` | eventCardService.js | `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_car...` |
| `event_card_map` | `start_time` | eventCardService.js | `
      SELECT cm.*, li.program_id, li.date, li.quality_flag, li.override_status
      FROM event_car...` |
| `staff` | `name` | eventCardService.js | `
      SELECT sa.*, s.name as staff_name, s.qualifications
      FROM loom_staff_assignments sa
    ...` |
| `staff` | `qualifications` | eventCardService.js | `
      SELECT sa.*, s.name as staff_name, s.qualifications
      FROM loom_staff_assignments sa
    ...` |

## Column Name Mismatches

| Table | Expected Column | Actual Column | Service File |
|-------|----------------|---------------|-------------|
| `event_card_map` | `instance_id` | `loom_instance_id` | eventCardService.js |

## Action Plan

### Simple Pages (Vehicles, Venues, Participants)

| Action | Target | Related Pages | Description |
|--------|--------|--------------|-------------|
| Add Column | `loom_participant_attendance.instance_id` |  | Add missing column 'instance_id' to table 'loom_participant_attendance' referenced in dashboardFinanceService.js |
| Add Column | `loom_instances.program_id` |  | Add missing column 'program_id' to table 'loom_instances' referenced in dashboardFinanceService.js |
| Add Column | `loom_instances.date` |  | Add missing column 'date' to table 'loom_instances' referenced in dashboardFinanceService.js |
| Add Column | `loom_instances.quality_flag` |  | Add missing column 'quality_flag' to table 'loom_instances' referenced in eventCardService.js |
| Add Column | `loom_instances.override_status` |  | Add missing column 'override_status' to table 'loom_instances' referenced in eventCardService.js |
| Add Column | `payment_diamonds.attendance_id` |  | Add missing column 'attendance_id' to table 'payment_diamonds' referenced in dashboardFinanceService.js |
| Add Column | `loom_staff_assignments.end_time` |  | Add missing column 'end_time' to table 'loom_staff_assignments' referenced in dashboardFinanceService.js |
| Add Column | `loom_staff_assignments.start_time` |  | Add missing column 'start_time' to table 'loom_staff_assignments' referenced in dashboardFinanceService.js |
| Add Column | `loom_staff_assignments.instance_id` |  | Add missing column 'instance_id' to table 'loom_staff_assignments' referenced in dashboardFinanceService.js |
| Add Column | `loom_staff_assignments.assignment_type` |  | Add missing column 'assignment_type' to table 'loom_staff_assignments' referenced in timesheetService.js |
| Add Column | `programs.day_of_week` |  | Add missing column 'day_of_week' to table 'programs' referenced in dynamicResourceService.js |
| Add Column | `programs.venue_id` |  | Add missing column 'venue_id' to table 'programs' referenced in dynamicResourceService.js |
| Add Column | `programs.start_time` |  | Add missing column 'start_time' to table 'programs' referenced in plannerService.js |
| Add Column | `programs.end_time` |  | Add missing column 'end_time' to table 'programs' referenced in plannerService.js |
| Add Column | `programs.is_weekend` |  | Add missing column 'is_weekend' to table 'programs' referenced in plannerService.js |
| Add Column | `programs.is_centre_based` |  | Add missing column 'is_centre_based' to table 'programs' referenced in plannerService.js |
| Add Column | `programs.active` |  | Add missing column 'active' to table 'programs' referenced in plannerService.js |
| Add Column | `event_card_map.instance_id` |  | Add missing column 'instance_id' to table 'event_card_map' referenced in eventCardService.js |
| Add Column | `event_card_map.start_time` |  | Add missing column 'start_time' to table 'event_card_map' referenced in eventCardService.js |
| Add Column | `staff.name` |  | Add missing column 'name' to table 'staff' referenced in eventCardService.js |
| Add Column | `staff.qualifications` |  | Add missing column 'qualifications' to table 'staff' referenced in eventCardService.js |

### Moderate Pages (Staff, Finance)

No actions needed for moderate pages.

### Complex Pages (Dashboard, Master Schedule, Roster, Cards)

No actions needed for complex pages.

## Tables by Page

