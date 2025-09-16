\# RABS-POC Enhancement Proposals



\## Introduction



This document outlines a vision for the RABS-POC, showcasing how its foundational elements can be extended to create a comprehensive, intelligent, and user-friendly SaaS application. The following proposals are designed from the perspective of an administrative team member, focusing on features that would automate manual tasks, eliminate guesswork, and provide powerful insights to streamline daily operations.



---

\### --\[BRETT'S NOTES]

\*The following notes from Brett provide crucial context on the philosophy behind these enhancements.\*



\*Normal software logic alone is powerful, dynamic response to triggers that can facilitate a wide scope of corresponding actions. Now we can combine triggers with natural language processing backed by large context world knowledge and organisational knowledge LLM's and scope of dynamic responses is potentially incalculable. Now add a truly self reflective natural language reasoning engine that can interpret data check on system and iterate on improvements and you get Reggie!.\*



\*Before I add to the following sections and we can iterate on the POC functionality, I want to quickly clear up the time slider! The time slider was not change scroll through the data or go wards and backwards to look at next week or last week etc. That functionality should exist in its on way, like you have for the next week button for the schedule etc that should exist as it is or a calendar etc, and each data set that rolls on over time will need a way to page forward and back. the time slide was a feature of the POC test itself and it simulated today date! So any part of the system that needs to know todays date or time would get it from the slider not the host system. This will allow us to make changes to a participants schedule and then jump 3 weeks into the future to see the result of that and how it affects billing etc. So normal functions should have their normal UI for viewing or moving forwards or backwards etc. the time slider is a way for us to simulate any date and have rabs-poc behave as if that date is truth. that was the concept anyway.\*

---



\## 1. The Admin Command Centre: Your Central Hub



The goal is to move away from spreadsheets and disconnected data sources to a single, unified dashboard that provides at-a-glance visibility and control over the entire operation.



\*   \*\*Central Dashboard\*\*: A homepage for admins that displays real-time, critical information:

&nbsp;   \*   \*\*Today's Snapshot\*\*: Key metrics like total participants expected, staff on duty, and vehicles in use.

&nbsp;   \*   \*\*Alerts \& Notifications\*\*: Critical warnings that require immediate attention, such as understaffed programs, vehicle capacity issues, or unassigned drivers.

&nbsp;   \*   \*\*Quick Actions\*\*: Buttons for the most common tasks, like generating a daily roster or viewing the finance page.



\*   \*\*Easy Data Management (CRUD Interfaces)\*\*: Simple, intuitive forms for managing all core data without needing to touch the database directly.

&nbsp;   \*   \*\*Participants\*\*: A searchable list of all participants. Admins can click to view, edit details (e.g., correct a name, update an NDIS number, change an address), and see their current program enrolments.

&nbsp;   \*   \*\*Staff\*\*: Manage staff profiles, contact information, and their weekly availability grid through a simple point-and-click interface.

&nbsp;   \*   \*\*Vehicles \& Venues\*\*: Add or update details for vehicles and program venues.



\*   \*\*Dedicated Billing Rate Management\*\*: A secure `/admin/rates` page where an authorized user can:

&nbsp;   \*   View all NDIS line items currently in the system.

&nbsp;   \*   Associate specific line items (e.g., base rate, centre capital cost, NF2F) with each program.

&nbsp;   \*   Update the prices for these line items to reflect the latest NDIS price guide, ensuring all future billing is automatically calculated with the correct rates.



---



\## 2. Interactive \& Dynamic Scheduling: See the Impact of Your Decisions Instantly



This section focuses on transforming the schedule from a static list into a dynamic, visual, and interactive planning tool.



\*   \*\*Visual Calendar View\*\*: A color-coded calendar (with Day and Week views) that displays all scheduled programs. This provides a much more intuitive understanding of the day's activities than a simple table.



\*   \*\*Drag-and-Drop Scheduling\*\*: A powerful feature where an admin could, for example, drag a participant from an "unassigned" list and drop them onto a program in the calendar.



\*   \*\*Live Recalculation\*\*: This is the core of demonstrating the system's power. When a change is made on the schedule (like adding a participant via drag-and-drop), the UI should instantly update to reflect the consequences:

&nbsp;   \*   The participant count for the program would increase.

&nbsp;   \*   The \*\*Staffing Ratio\*\* indicator would turn red if more staff are now required.

&nbsp;   \*   The \*\*Vehicle Capacity\*\* for the assigned bus would update, showing if it's nearing its limit.

&nbsp;   \*   The projected billing for the day would recalculate in the background.



---



\## 3. Intelligent Automation \& Optimization: Let the System Do the Heavy Lifting



This is where we implement the core logic that makes the system "smart" and saves the most time on manual, repetitive tasks.



\*   \*\*Transport Routing Engine\*\*:

&nbsp;   \*   \*\*Google Maps Integration\*\*: Use the Google Maps API to calculate and display the most efficient pickup and drop-off routes for each vehicle on a map.

&nbsp;   \*   \*\*Automated Route Optimization\*\*: When a participant is added or cancels, the system automatically re-calculates the optimal route for their assigned vehicle.

&nbsp;   \*   \*\*Fallback Logic\*\*: Implement the nearest-neighbor algorithm as a reliable backup to ensure routing functionality is always available, even without a Google Maps API key.



\*   \*\*Smart Staffing Suggestions\*\*: If a program becomes understaffed due to a last-minute increase in participants, the system could proactively suggest available staff members who are qualified and not already assigned to another activity during that time.



\*   \*\*Automated Cancellation Handling\*\*: When a participant cancels (e.g., via a button in a future parent portal or an admin action):

&nbsp;   \*   The system automatically updates their attendance status.

&nbsp;   \*   It flags their billing record according to the rules (e.g., billable if late cancellation).

&nbsp;   \*   It removes them from the vehicle run and re-optimizes the route.

&nbsp;   \*   It alerts the admin if the change in numbers affects the required staffing ratio.



---



\## 4. Advanced Reporting \& Analytics: From Data to Insights



Go beyond simple CSV exports to provide tools that help in financial management and strategic planning.



\*   \*\*Financial Dashboard\*\*: A visual dashboard with charts showing:

&nbsp;   \*   Revenue trends over time (week-over-week, month-over-month).

&nbsp;   \*   A breakdown of costs and revenue by program.

&nbsp;   \*   A summary of billed vs. unbilled services.



\*   \*\*Predictive Insights\*\*: Leverage the collected data to provide forward-looking analysis:

&nbsp;   \*   \*\*Resource Utilization\*\*: Identify programs, vehicles, or staff members that are consistently under-utilized.

&nbsp;   \*   \*\*Demand Forecasting\*\*: Analyse historical attendance to predict which programs may require more resources in the future.



---



\## 5. The Future - Conversational AI Control



This is the ultimate demonstration of an intelligent system. Instead of navigating menus, admins could interact with the system using natural language.



\*   \*\*Chat-Based Interface\*\*: A chat window on the dashboard where an admin can type commands.

&nbsp;   \*   \*"Show me the schedule for next Tuesday."\*

&nbsp;   \*   \*"Add John Smith to the Bowling Night program starting next week."\*

&nbsp;   \*   \*"What's the most efficient route for Vehicle 2's pickup run tomorrow?"\*

&nbsp;   \*   \*"Generate the agency billing report for last month."\*



\*   \*\*Proactive AI Assistant\*\*: The AI could also initiate conversations, providing helpful alerts and suggestions.

&nbsp;   \*   \*"Heads up: The 'Sat Adventure' program is almost full. Should I schedule an additional vehicle?"\*

&nbsp;   \*   \*"John Smith has cancelled his session tomorrow. The bus route for Vehicle 1 has been updated."\*

&nbsp;   \*   \*"You have 3 programs next week that are currently understaffed. Would you like me to show you available staff?"\*

