# RABS Core Concepts: A Deeper Dive



## The "Woven Strands" Metaphor



* **The Unwoven Future:** Independent strands representing **rules and intentions**, not concrete events. Example: *"Simon intends to attend the 'Centre Based' program every Monday, indefinitely."*
* **The Loom of the Present:** A rolling processing window (e.g., the next 6 weeks). Within this window, the system takes the unwoven strands (the rules) and weaves them into a concrete, operational schedule of shifts and resource allocations.
* **The Woven Past:** The immutable log of what has already happened—who attended what, who was billed, which staff worked. As each day passes, it moves from the Loom into the Woven Past.

## The "Rules, Overrides, and Projections" Pattern

\*   \*\*The Unwoven Future:\*\* These are the independent strands representing \*\*rules and intentions\*\*, not concrete events. For example: \*"Simon intends to attend the 'Centre Based' program every Monday, indefinitely."\*

1. **The System of Record is a set of Rule Tables.**  
   These tables define the recurring schedules, staff rosters, participant intentions, and one-off events. They are the **source of truth** for the future. They don't store what *is* happening tomorrow, but the *rules* for what *should* happen.

2. **A Projector process generates a concrete schedule.**  
   This background worker (the "Weaver") runs continuously, reading from the Rule Tables to generate an operational schedule for the rolling Loom window. This projected schedule lives in its own materialised‐view tables (e.g., `GeneratedShifts`).

3. **User changes are either Permanent or Temporary.**  
   * **Permanent changes** update the core Rule Tables, affecting all future projections. Example: a staff member is permanently reassigned to a new program.  
   * **Temporary changes** directly modify a single record in the projected schedule, creating an **override** (`is_overridden = TRUE`) to prevent the Projector from overwriting this "just-for-now" change.

## The "History Ribbon" as a Relational Anchor

2\.  \*\*A 'Projector' process generates a concrete schedule.\*\*

* **Immutable Fact vs. Mutable Status:** Once a shift is in the past, the core facts (who, what, when, where) are immutable. However, its workflow status is mutable. We track its journey through business processes like billing (`pending → invoiced → reconciled`) and payroll.
* **"Pinning" Data:** The `ShiftHistory` table acts as the central cord of the ribbon. All other related data—notes, incident reports, attendance details, photos—are *pinned* to it via a foreign key (`shift_history_id`). This allows for an infinitely extensible and queryable history.

## The System as a Proactive Quality Agent

&nbsp;   \*   \*\*Temporary Changes\*\* directly modify a single record in the projected schedule, creating an \*\*'Override'\*\*. This record is flagged (e.g., `is\_overridden = TRUE`) to prevent the Projector from overwriting this "just for now" change.

* **The Analysis Engine:** By propagating descriptive tags from the Rule Tables down to the History Ribbon, the system becomes a powerful data lake. It can be queried to identify trends, compare outcomes, and generate strategic reports (e.g., "Compare incident rates in community-based vs centre-based programs").
* **The "Spot Audit" Workflow:** The Projector process randomly applies a `spot_audit_pending` tag to a small percentage of generated shifts. When a tagged shift is completed, a background *Audit Conductor* triggers a quality-assurance workflow: verifying data, checking compliance, and automatically sending satisfaction surveys to participants and staff. This turns the system from a simple memory into a self-testing nervous system.

The "Woven Past" is more than a simple archive; it's a \*\*relational anchor\*\* for all operational data.



\*   \*\*Immutable Fact vs. Mutable Status:\*\* Once a shift is in the past, the core facts (who, what, when, where) are immutable. However, its workflow status is mutable. We track its journey through business processes like billing (`pending` -> `invoiced` -> `reconciled`) and payroll.



\*   \*\*"Pinning" Data:\*\* The `ShiftHistory` table acts as the central cord of the ribbon. All other related data—notes, incident reports, attendance details, photos—are "pinned" to it. In technical terms, these other tables hold a foreign key (`shift\_history\_id`) that links back to the central ribbon. This allows for an infinitely extensible and queryable history.



\## The System as a Proactive Quality Agent



RABS is designed to be more than a passive record-keeper; it's an active participant in ensuring quality.



\*   \*\*The Analysis Engine:\*\* By propagating descriptive tags from the Rule Tables down to the History Ribbon, the system becomes a powerful data lake. It can be queried to identify trends, compare outcomes, and generate strategic reports (e.g., "Compare incident rates in community-based vs. centre-based programs").



\*   \*\*The "Spot Audit" Workflow:\*\* The Projector process will randomly apply an `'spot\_audit\_pending'` tag to a small percentage of generated shifts. When a tagged shift is completed, a background "Audit Conductor" triggers a quality assurance workflow: verifying data, checking compliance, and automatically sending satisfaction surveys to participants and staff. This turns the system from a simple memory into a self-testing nervous system.

