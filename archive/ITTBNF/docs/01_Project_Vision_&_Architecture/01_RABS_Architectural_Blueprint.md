# RABS Architectural Blueprint & Project Structure



# 1. Executive Summary



RABS (Realtime Adaptive Back-end System) is designed to be more than a simple scheduling tool; it is a strategic asset for the organization. It moves beyond a static spreadsheet model to a dynamic system that understands temporal dependencies, manages cascading changes, and provides deep analytical insight.



The architecture is built on the **“Rules, Overrides, and Projections”** model. This allows us to manage an indefinite future and a long history without performance degradation, while providing the flexibility to handle the complexities of daily operations. The system will not only streamline administration but also become an engine for proactive quality assurance and long-term strategic analysis.



# 2. Core Concepts (The RABS Metaphor)



\* **The Unwoven Future (Rules & Intentions):** The system's source of truth is not a list of future events, but a set of *rules* and *templates*. This includes recurring program schedules, staff and participant default assignments, and business logic (e.g., staffing ratios). This layer represents *intent*.



\* **The Loom of the Present (The Projection Window):** This is a rolling, operational window (e.g., the next 6 weeks) where the system takes the abstract rules and “weaves” them into concrete, editable shifts. This is the active, operational view where temporary overrides are managed.



\* **The Woven Past (The History Ribbon):** Once a shift is completed, it becomes part of an immutable historical log. This “ribbon” is a permanent record of what happened. It serves as a relational anchor to which all related data (notes, reports, billing status) is “pinned,” creating a rich, queryable history.



# 3. Key Architectural Features



\* **The Configurable Loom Window:** The projection window is not fixed. A central configuration setting controls its length (e.g., `LOOM_DURATION_WEEKS = 6`). Administrators can shrink the window (e.g., to 2 weeks) at year-end to prevent premature generation of the new year’s shifts or expand it for long-term planning.



\* **Permanent vs. Temporary Changes:** The system clearly distinguishes between changing a core rule (a permanent change affecting the future) and overriding a single instance in the Loom (a temporary, “just for now” change).



\* **The Analysis Engine:** By propagating tags from the rule level down to the History Ribbon, the system becomes a powerful data-analysis tool. It can perform complex queries to identify trends, compare outcomes, and generate strategic reports.



\* **The Proactive Quality Agent:** The system actively participates in quality assurance by randomly flagging shifts for “spot audits,” triggering a workflow that includes data verification and automated feedback collection from staff and participants.



# 4. Proposed Project Folder Structure



```newRABS/

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

# 5. File & Module Descriptions

This section describes the intended structure for the full RABS production application, not necessarily the current POC.
/config/

    app.js: Stores global application configuration. Crucially, this is where LOOM_DURATION_WEEKS is defined.

    database.js: Contains connection details for the database.

/database/

    /migrations/: Contains ordered scripts for creating and altering database tables.

    /seeds/: Contains scripts to populate the database with initial data.

/src/ - The Application Core
/src/api/ (The User Interface Layer)

    routes.js: Defines all the API endpoints.

    /controllers/: Contains the logic for handling user requests. They determine if a change is "permanent" (update a Rule model) or "temporary" (update a GeneratedShift instance).

    /middleware/: Handles cross-cutting concerns like user authentication.

/src/core/ (The Brains of the Operation)

    rulesEngine.js: Contains the business logic for things like staffing ratios.

    conflictResolver.js: A critical module that checks for conflicts when a new permanent rule is proposed.

/src/jobs/ (The Background Workers)

    projector.js: AKA "The Weaver" or "The Loom Writer". Runs on a schedule, reads the LOOM_DURATION_WEEKS, reads Rule models, and generates the concrete GeneratedShift instances for the Loom window.

    qualityAgent.js: AKA "The Audit Conductor". Randomly applies the 'spot_audit_pending' tag to shifts and triggers the audit workflow.

/src/models/ (The Data Representation)

    ProgramTemplate.js, StaffRosterRule.js, etc.: Represent the "Unwoven Future."

    GeneratedShift.js: Represents a single shift instance within the "Loom."

    ShiftHistory.js: Represents a single record in the "Woven Past" or "History Ribbon."

    ShiftNote.js, IncidentReport.js: Examples of "pinned" data with a foreign key back to ShiftHistory.

/src/services/ (Shared Utilities)

    emailService.js: A generic service for sending emails.

    reportGenerator.js: Contains the logic for running complex analytical queries against the History Ribbon.