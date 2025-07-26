\# RABS Core Concepts: A Deeper Dive



This document captures the core metaphors and design principles that underpin the RABS architecture. These concepts evolved from a deep analysis of the system's temporal and relational complexities.



\## The "Woven Strands" Metaphor



The primary challenge of RABS is to manage a system with a long history and an indefinite future, where changes have cascading effects. The "Woven Strands" metaphor provides a powerful conceptual model for this.



\*   \*\*The Unwoven Future:\*\* These are the independent strands representing \*\*rules and intentions\*\*, not concrete events. For example: \*"Simon intends to attend the 'Centre Based' program every Monday, indefinitely."\*

\*   \*\*The Loom of the Present:\*\* This is a rolling processing window (e.g., the next 6 weeks). Within this window, the system takes the "unwoven strands" (the rules) and weaves them into a concrete, operational schedule of shifts and resource allocations.

\*   \*\*The Woven Past:\*\* This is the immutable log of what has already happened. It is the historical record—who attended what, who was billed, which staff worked. As each day passes, it moves from the "Loom" into the "Woven Past."



\## The "Rules, Overrides, and Projections" Pattern



This is the practical implementation of the "Woven Strands" metaphor, forming the architectural backbone of RABS.



1\.  \*\*The System of Record is a set of 'Rule Tables'.\*\*

&nbsp;   These tables define the recurring schedules, staff rosters, participant intentions, and one-off events. They are the \*\*Source of Truth\*\* for the future. They don't store what \*is\* happening tomorrow, but the \*rules\* for what \*should\* happen.



2\.  \*\*A 'Projector' process generates a concrete schedule.\*\*

&nbsp;   This background worker (the "Weaver") runs continuously, reading from the Rule Tables to generate an operational schedule for the rolling "Loom" window. This projected schedule lives in its own 'Materialized View' tables (e.g., `GeneratedShifts`).



3\.  \*\*User changes are either 'Permanent' or 'Temporary'.\*\*

&nbsp;   \*   \*\*Permanent Changes\*\* update the core Rule Tables, affecting all future projections. Example: A staff member is permanently reassigned to a new program.

&nbsp;   \*   \*\*Temporary Changes\*\* directly modify a single record in the projected schedule, creating an \*\*'Override'\*\*. This record is flagged (e.g., `is\_overridden = TRUE`) to prevent the Projector from overwriting this "just for now" change.



\## The "History Ribbon" as a Relational Anchor



The "Woven Past" is more than a simple archive; it's a \*\*relational anchor\*\* for all operational data.



\*   \*\*Immutable Fact vs. Mutable Status:\*\* Once a shift is in the past, the core facts (who, what, when, where) are immutable. However, its workflow status is mutable. We track its journey through business processes like billing (`pending` -> `invoiced` -> `reconciled`) and payroll.



\*   \*\*"Pinning" Data:\*\* The `ShiftHistory` table acts as the central cord of the ribbon. All other related data—notes, incident reports, attendance details, photos—are "pinned" to it. In technical terms, these other tables hold a foreign key (`shift\_history\_id`) that links back to the central ribbon. This allows for an infinitely extensible and queryable history.



\## The System as a Proactive Quality Agent



RABS is designed to be more than a passive record-keeper; it's an active participant in ensuring quality.



\*   \*\*The Analysis Engine:\*\* By propagating descriptive tags from the Rule Tables down to the History Ribbon, the system becomes a powerful data lake. It can be queried to identify trends, compare outcomes, and generate strategic reports (e.g., "Compare incident rates in community-based vs. centre-based programs").



\*   \*\*The "Spot Audit" Workflow:\*\* The Projector process will randomly apply an `'spot\_audit\_pending'` tag to a small percentage of generated shifts. When a tagged shift is completed, a background "Audit Conductor" triggers a quality assurance workflow: verifying data, checking compliance, and automatically sending satisfaction surveys to participants and staff. This turns the system from a simple memory into a self-testing nervous system.

