# The Loom System: Functional Specification

## 1. System Overview

The Loom is RABS's dynamic resource allocation and scheduling engine that manages a perpetually rolling window of program instances. Rather than generating the entire schedule for all time, the Loom maintains an "active window" (typically 2-16 weeks) where detailed resource allocation (staff, vehicles, participants) is performed, while still allowing for planning and modifications beyond this window.

**Core Purpose:** To provide a calendar-based, perpetually rolling scheduling system that automates resource allocation while preserving all operator decisions across window changes.

> 💡 **Key Insight:** The Loom is not a separate system - it's the intelligent engine behind the existing UI. The MasterSchedule, ParticipantPlanner, and other pages are the interfaces that control the Loom.

## 2. Key Concepts

### 2.1 Calendar-Based Rolling Window

* The system operates on actual calendar dates (e.g., "October 7th"), not abstract concepts like "Week 4"
* Every day at midnight (Sydney time), the window automatically rolls forward one day
* The window size is configurable (2-16 weeks) but must always include at least 2 weeks of future dates
* Only dates within the active window have fully generated instances with staff/vehicle allocations

### 2.2 Temporal Rule Propagation ("From This Date Forward")

* All changes follow a "from this date forward" model
* When a change is made to a program on a specific date, it affects all future instances from that date onward
* To make a temporary change, you make the change on the start date and then revert it on the end date
* Single-instance changes are made by changing one instance, then changing the next instance back

### 2.3 Layered Persistence Model

* **Template Layer:** Program definitions that generate instances (permanent)
* **Instance Layer:** Generated instances within the active window (recreatable)
* **Intent Layer:** Operator decisions about future dates (permanent)
* **Exception Layer:** One-off changes and cancellations (permanent)

### 2.4 Automatic Resource Allocation

* Staff assignments follow the 1 lead + 1 support per 5 participants rule
* Vehicle routes are automatically optimized based on participant locations
* When participants are added/removed, resources are automatically rebalanced

## 3. Interface Integration

> 🔑 **Critical Point:** The Loom is not a separate interface - it's the engine behind existing pages.

| Page | Loom Functionality |
|------|-------------------|
| **MasterSchedule** | Create/modify program templates, view/edit instances within window |
| **ParticipantPlanner** | Add/remove participants from programs, set enrollment dates, manage cancellations |
| **Roster** | View/modify staff assignments within the active window |
| **Vehicles** | Add/modify vehicle resources, view/adjust auto-generated routes |
| **Finance** | View billing generated from participant allocations |

All existing pages serve as the interface for viewing and controlling the Loom. When you add a new vehicle in the Vehicles page, it becomes available for the Loom to assign. When you create a program in MasterSchedule, the Loom generates instances for it.

## 4. Operational Examples

### 4.1 Program Creation & Auto-Generation

**Example: "Bowling Tuesday Night"**

1. Operator creates "Bowling Tuesday Night" in MasterSchedule
   * Sets time: 6pm-9pm
   * Adds 6 participants
   * Assigns billing codes
   * Sets venue: Bowling Alley

2. If Loom window = 4 weeks:
   * System automatically generates 4 instances (next 4 Tuesdays)
   * Assigns appropriate staff (2 staff for 6 participants)
   * Creates optimized vehicle runs to transport participants
   * All 4 instances appear in MasterSchedule view

3. One week later:
   * Daily roll automatically generates the 5th Tuesday instance
   * Previous instances remain unchanged
   * The window now shows Tuesdays 2-5

### 4.2 Participant Changes

**Example: One-time absence**

1. John will miss Bowling on November 6th
   * Operator opens ParticipantPlanner
   * Navigates to John's schedule
   * Marks "Cancel" for November 6th Bowling
   * System records this as an exception (not a permanent change)
   * Bus routes for November 6th are automatically re-optimized

**Example: Permanent program change**

1. Sarah joins Centre-Based Wednesdays starting October 7th
   * Operator opens ParticipantPlanner
   * Adds Sarah to Centre-Based Wednesday program
   * Sets start date: October 7th (no end date = indefinite)
   * System adds Sarah to all Wednesday instances from October 7th onward
   * Bus routes for all affected dates are re-optimized

**Example: Temporary program enrollment**

1. James wants to try Bowling for just one session on August 15th
   * Operator adds James to Bowling program (start date: August 15th)
   * Immediately sets end date: August 16th
   * Result: James appears only in the August 15th instance
   * Bus routes for only that date are re-optimized

### 4.3 Program Changes

**Example: Temporary time change**

1. Centre-Based Wednesday needs extended hours on September 20th only
   * Operator opens MasterSchedule for September 20th
   * Edits the Centre-Based program time: 9am-4pm (normally 9am-3pm)
   * Navigates to September 27th instance
   * Reverts time back to 9am-3pm
   * Result: Only September 20th has extended hours

**Example: Permanent venue change**

1. Bowling Tuesday moves to new venue from October 1st
   * Operator opens MasterSchedule for October 1st
   * Changes venue to "New Bowling Alley"
   * All future instances use the new venue
   * Bus routes for all future dates are re-optimized

### 4.4 Window Resizing

**Example: Expanding window from 4 to 12 weeks**

1. Operator changes Loom window size from 4 to 12 weeks
   * System generates 8 additional weeks of instances
   * All participant enrollments are applied to new instances
   * Staff and vehicles are automatically assigned
   * Bus routes are optimized for all new instances

**Example: Shrinking window from 12 to 4 weeks**

1. Operator changes Loom window size from 12 to 4 weeks
   * Instances for weeks 5-12 are deleted from active view
   * All operator intents are preserved in the database
   * When window expands again, those intents will be reapplied

## 5. Data Architecture

### 5.1 Layered Persistence Model

1. **Template Layer** (Always Persistent)
   * Program definitions (days, times, venues)
   * Source: Existing `programs` table
   * Example: "Bowling Tuesday 6-9pm at Bowling Alley"

2. **Instance Layer** (Temporary/Recreatable)
   * Generated instances within the active window
   * Source: `tgl_loom_instances` table
   * Example: "Bowling on Tuesday, October 7th, 2025"
   * Can be deleted and recreated when window size changes

3. **Intent Layer** (Always Persistent)
   * Operator decisions about future dates
   * Source: `tgl_operator_intents` table
   * Example: "Sarah joins Centre-Based Wednesdays from October 7th"
   * Survives window resizing operations

4. **Exception Layer** (Always Persistent)
   * One-off changes and cancellations
   * Source: `tgl_temporal_exceptions` table
   * Example: "John absent from Bowling on November 6th"
   * Survives window resizing operations

### 5.2 Persistence Rules

* **What Persists:** All operator decisions (intents, exceptions, program changes)
* **What's Recreatable:** Generated instances, staff assignments, vehicle routes
* **What's Deleted:** Only instances outside the active window
* **What's Regenerated:** Instances that roll into the window, with all applicable intents applied

## 6. Daily Rolling Process

### 6.1 Automatic Rolling

* Executes at midnight Sydney time every day
* Generates the next day beyond the current window
* Applies all relevant intents and exceptions
* Assigns staff and vehicles according to rules
* Optimizes transportation routes

### 6.2 Failure Handling

* 9am check verifies successful midnight roll
* If roll failed, system attempts to regenerate
* If still unsuccessful, operators are notified
* Manual regeneration buttons available for each day
* All data needed for generation is preserved in the database

## 7. Operator Workflow

### 7.1 Program Management

* Create/modify programs in MasterSchedule
* Set recurring schedule, venue, activity details
* Changes follow "from this date forward" model
* Temporary changes require setting start and end dates

### 7.2 Participant Management

* Add/remove participants via ParticipantPlanner
* Set enrollment start/end dates for each program
* Record cancellations for specific dates
* All changes automatically trigger resource rebalancing

### 7.3 Resource Management

* Staff and vehicles are automatically assigned
* Manual overrides available for specific dates
* Adding new resources makes them available for auto-assignment
* No approval workflow - operators coordinate directly

## 8. Resource Allocation Rules

### 8.1 Staffing Rules

* 1 lead staff + 1 support staff per 5 participants
* Staff must be available during program hours
* Staff qualifications must match program requirements
* When participants are added/removed, staffing adjusts automatically

### 8.2 Vehicle Allocation

* Vehicle capacity must accommodate assigned participants
* Routes are optimized to minimize travel time
* When participants change, routes are re-optimized
* Accessibility requirements (wheelchair access) are respected

### 8.3 No Hard Capacity Limits

* System does not block additions that exceed "recommended" capacity
* Venue over-capacity is flagged but not prevented
* Resource conflicts are flagged for manual resolution
* System accommodates all operator decisions

## 9. Edge Cases & Special Scenarios

### 9.1 Daylight Saving Time

* All dates are stored as calendar dates in Sydney timezone
* DST transitions are handled automatically by the system
* No special operator action required

### 9.2 Program Cancellation

* Entire programs can be ended from a specific date
* Individual instances can be cancelled without affecting future dates
* Cancelled instances still appear in the schedule (marked cancelled)

### 9.3 Long-Range Planning

* System supports planning 10+ years in advance
* Only the active window (2-16 weeks) has fully generated instances
* Future intents are stored and applied when dates roll into the window

### 9.4 Multiple Operators

* Multiple operators can use the system simultaneously
* No formal approval workflow - operators coordinate manually
* All changes are logged with timestamp and operator ID

## 10. Technical Requirements

### 10.1 Database Structure

* Existing tables (`programs`, `participants`, `staff`, `vehicles`)
* New Loom-specific tables:
  * `tgl_loom_instances` - Generated instances within window
  * `tgl_loom_participant_allocations` - Who attends what
  * `tgl_loom_staff_shifts` - Staff assignments
  * `tgl_loom_vehicle_runs` - Vehicle routes
  * `tgl_operator_intents` - Persistent future plans
  * `tgl_temporal_exceptions` - One-off changes
  * `tgl_loom_audit_log` - Change history

### 10.2 System Behavior

* Automatic daily rolling at midnight Sydney time
* Secondary check at 9am with retry capability
* Manual regeneration options for operators
* All dates are calendar dates (not week numbers)
* Changes propagate forward until explicitly reverted

---

## Appendix: Glossary

* **Loom** - The dynamic resource allocation and scheduling engine
* **Active Window** - The date range (2-16 weeks) with fully generated instances
* **Instance** - A specific occurrence of a program on a specific date
* **Intent** - An operator decision that affects future dates
* **Exception** - A one-off change or cancellation for a specific date
* **Propagation** - How changes affect future dates until explicitly reverted
