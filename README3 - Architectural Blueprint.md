# newRABS.md - Architectural Blueprint & Project Structure

## 1. Executive Summary

RABS (Realtime Adaptive Back-end System) is designed to be more than a simple scheduling tool; it is a strategic asset for the organization. It moves beyond a static spreadsheet model to a dynamic system that understands temporal dependencies, manages cascading changes, and provides deep analytical insight.

The architecture is built on the **"Rules, Overrides, and Projections"** model. This allows us to manage an indefinite future and a long history without performance degradation, while providing the flexibility to handle the complexities of daily operations. The system will not only streamline administration but also become an engine for proactive quality assurance and long-term strategic analysis.

---

## 2. Core Concepts (The RABS Metaphor)

*   **The Unwoven Future (Rules & Intentions):** The system's source of truth is not a list of future events, but a set of *rules* and *templates*. This includes recurring program schedules, staff and participant default assignments, and business logic (e.g., staffing ratios). This layer represents *intent*.

*   **The Loom of the Present (The Projection Window):** This is a rolling, operational window (e.g., the next 6 weeks) where the system takes the abstract rules and "weaves" them into concrete, editable shifts. This is the active, operational view where temporary overrides are managed.

*   **The Woven Past (The History Ribbon):** Once a shift is completed, it becomes part of an immutable historical log. This "ribbon" is a permanent record of what happened. It serves as a relational anchor to which all related data (notes, reports, billing status) is "pinned," creating a rich, queryable history.

---

## 3. Key Architectural Features

*   **The Configurable Loom Window:** The projection window is not fixed. A central configuration setting will control its length (e.g., `LOOM_DURATION_WEEKS = 6`). This allows administrators to shrink the window (e.g., to 2 weeks) at the end of a year to prevent auto-generation of the new year's shifts before final reviews are complete, or expand it for long-term planning.

*   **Permanent vs. Temporary Changes:** The system clearly distinguishes between changing a core rule (a permanent change affecting the future) and overriding a single instance in the Loom (a temporary, "just for now" change).

*   **The Analysis Engine:** By propagating tags from the rule level down to the History Ribbon, the system becomes a powerful data analysis tool. It can perform complex queries to identify trends, compare outcomes, and generate strategic reports.

*   **The Proactive Quality Agent:** The system actively participates in quality assurance by randomly flagging shifts for "spot audits," triggering a workflow that includes data verification and automated feedback collection from staff and participants.

---

## 4. Proposed Project Folder Structure

```
newRABS/
├── config/
│   ├── app.js
│   └── database.js
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   └── newRABS.md
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes.js
│   ├── core/
│   │   ├── conflictResolver.js
│   │   └── rulesEngine.js
│   ├── jobs/
│   │   ├── projector.js
│   │   └── qualityAgent.js
│   ├── models/
│   │   ├── ProgramTemplate.js
│   │   ├── StaffRosterRule.js
│   │   ├── ParticipantScheduleRule.js
│   │   ├── AdHocEvent.js
│   │   ├── GeneratedShift.js
│   │   ├── ShiftHistory.js
│   │   ├── ShiftNote.js
│   │   ├── IncidentReport.js
│   │   └── ... (other pinned models)
│   └── services/
│       ├── emailService.js
│       └── reportGenerator.js
└── package.json
```

---

## 5. File & Module Descriptions

### `/config/`
*   **`app.js`**:
    *   Stores global application configuration.
    *   **Crucially, this is where `LOOM_DURATION_WEEKS` is defined.**
    *   Holds settings for logging, ports, and other environment-specific variables.
*   **`database.js`**:
    *   Contains connection details for the database (PostgreSQL, MySQL, etc.).

### `/database/`
*   **`/migrations/`**:
    *   Contains ordered scripts for creating and altering database tables. This ensures the database schema is version-controlled and repeatable.
*   **`/seeds/`**:
    *   Contains scripts to populate the database with initial data (e.g., default program templates, fake staff/participants for the POC).

### `/docs/`
*   **`newRABS.md`**:
    *   This document. The project's living blueprint.

### `/src/` - The Application Core

#### `/src/api/` (The User Interface Layer)
*   **`routes.js`**: Defines all the API endpoints (e.g., `POST /shifts/:id/override`, `POST /rules/staff`).
*   **`/controllers/`**: Contains the logic for handling user requests. They orchestrate calls to the core logic and models to fulfill a request. For example, a controller determines if a change is "permanent" (update a Rule model) or "temporary" (update a `GeneratedShift` instance).
*   **`/middleware/`**: Handles cross-cutting concerns like user authentication and authorization.

#### `/src/core/` (The Brains of the Operation)
*   **`rulesEngine.js`**:
    *   Contains the business logic for things like staffing ratios (`if participants > 4, then staff_needed = 2`).
    *   Externalizes these rules so they can be changed without rewriting application code.
*   **`conflictResolver.js`**:
    *   A critical module that checks for conflicts when a new permanent rule is proposed.
    *   Example: "Does this new permanent assignment for Toby conflict with a pre-existing one-off event he's committed to?"

#### `/src/jobs/` (The Background Workers)
*   **`projector.js`**:
    *   **AKA "The Weaver" or "The Loom Writer".**
    *   Runs on a schedule (e.g., nightly).
    *   Reads the `LOOM_DURATION_WEEKS` from the config.
    *   Reads all the Rule models (`ProgramTemplate`, `StaffRosterRule`, etc.).
    *   Generates the concrete `GeneratedShift` instances for the Loom window.
    *   Propagates tags from the rules to the instances.
    *   Ignores and preserves any instances that are flagged with an override.
*   **`qualityAgent.js`**:
    *   **AKA "The Audit Conductor".**
    *   Randomly applies the `'spot_audit_pending'` tag to shifts generated by the Projector.
    *   Scans for completed shifts with this tag and triggers the audit workflow (sends notifications, fires off feedback surveys via the `emailService`).

#### `/src/models/` (The Data Representation)
*   **`ProgramTemplate.js`, `StaffRosterRule.js`, etc.**:
    *   These represent the "Unwoven Future." They define the rules and intentions of the system.
*   **`GeneratedShift.js`**:
    *   Represents a single shift instance within the "Loom." Contains an `is_overridden` flag. This is a volatile, operational table.
*   **`ShiftHistory.js`**:
    *   Represents a single record in the "Woven Past" or "History Ribbon." This table is append-only for its core facts. It contains the `billing_status` and other mutable workflow fields.
*   **`ShiftNote.js`, `IncidentReport.js`**:
    *   Examples of "pinned" data. These tables have a foreign key relationship back to a record in `ShiftHistory`, creating the rich, interconnected archive.

#### `/src/services/` (Shared Utilities)
*   **`emailService.js`**:
    *   A generic service for sending emails (e.g., password resets, notifications, spot audit feedback surveys).
*   **`reportGenerator.js`**:
    *   Contains the logic for running the complex analytical queries against the History Ribbon and formatting the output (e.g., into a PDF or CSV).
