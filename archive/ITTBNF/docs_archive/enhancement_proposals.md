# RABS-POC Enhancement Proposals

## Introduction

This document outlines a vision for the RABS-POC, showcasing how its foundational elements can be extended to create a comprehensive, intelligent, and user-friendly SaaS application. The following proposals are designed from the perspective of an administrative team member, focusing on features that would automate manual tasks, eliminate guesswork, and provide powerful insights to streamline daily operations.

### --[BRETTNOTES]
Normal software logic alone is powerful, dynamic response to triggers that can facilitate a wide scope of corresponding actions. Now we can combine triggers with natural language processing backed by large context world knowledge and organisational knowledge LLM's and scope of dynamic responses is potentially incalculable. Now add a truly self reflective natural language reasoning engine that can interpret data check on system and iterate on improvements and you get Reggie!.

---

### --[BRETTNOTES]
Before I add to the following sections and we can iterate on the POC functionality, I want to quickly clear up the time slider! The time slider was not change scroll through the data or go wards and backwards to look at next week or last week etc. That functionality should exist in its on way, like you have for the next week button for the schedule etc that should exist as it is or a calendar etc, and each data set that rolls on over time will need a way to page forward and back. the time slide was a feature of the POC test itself and it simulated today date! So any oart of the system that needs to know todays date or time would get it from the slider not the host system. This will allow us to make changes to a participants schedule and then jump 3 weeks into the future to see the result of that and how it affects billing etc. So normal functions should have their normal UI for viewing or moving forwards or backwards etc. the time slider is a way for us to simulate any date and have rabs-poc behave as if that date is truth. that was the concept anyway.

## 1. The Admin Command Centre: Your Central Hub

The goal is to move away from spreadsheets and disconnected data sources to a single, unified dashboard that provides at-a-glance visibility and control over the entire operation.

*   **Central Dashboard**: A homepage for admins that displays real-time, critical information:
    *   **Today's Snapshot**: Key metrics like total participants expected, staff on duty, and vehicles in use.
    *   **Alerts & Notifications**: Critical warnings that require immediate attention, such as understaffed programs, vehicle capacity issues, or unassigned drivers.
    *   **Quick Actions**: Buttons for the most common tasks, like generating a daily roster or viewing the finance page.

*   **Easy Data Management (CRUD Interfaces)**: Simple, intuitive forms for managing all core data without needing to touch the database directly.
    *   **Participants**: A searchable list of all participants. Admins can click to view, edit details (e.g., correct a name, update an NDIS number, change an address), and see their current program enrolments.
    *   **Staff**: Manage staff profiles, contact information, and their weekly availability grid through a simple point-and-click interface.
    *   **Vehicles & Venues**: Add or update details for vehicles and program venues.

*   **Dedicated Billing Rate Management**: A secure `/admin/rates` page where an authorized user can:
    *   View all NDIS line items currently in the system.
    *   Associate specific line items (e.g., base rate, centre capital cost, NF2F) with each program.
    *   Update the prices for these line items to reflect the latest NDIS price guide, ensuring all future billing is automatically calculated with the correct rates.

### --[BRETTNOTES] Yes to all of this a useful dashboard and while I think it should contain 

```
Today's Snapshot**: Key metrics like total participants expected, staff on duty, and vehicles in use
````

We could also do it in a dynamic visual display where on the dashboard we have full width visual display separated into three horizontally stacked sections the end sections 1 and 3 can be smaller with section 2 in the middle taking up the most space. the sections from let to right would be before the middle section now and the third and other small section represents next. and based on the date and time of day changes to reflect who is where. now this would only represent DSW related assets and activities. so if someone is at home they do ot appear on the board. So at 9 am when I open the dash board in section 1 I expect to see any staff or participants that were on an overnight shift and in our care, what house or centre they were at etc. so the names of participants ta the Picton house would be there and the staff rostered there too. al participant names on the map should be blue and all staff red or some system to make it very clear who is who. when you click on those names perhaps it cold send them a text message with twilio (that would be for the production app not the POC). or perhaps clicking the name just shows the primary contact phone number of that person etc. so those overnight staff and participants that's where they were because section 1 represents before the middle one is now. well its 9 am I might expect to find some staff with or without participants at 1 of our group homes. but I should also see each bus that's out doing pickups with the staff name of the driver and the participants names assigned to that bus. perhaps clcking the bus using the map api shows their assigned route on a pop up modal map along with their current coordinates. so easy to see who is where and what bus they are assigned to etc like as command centre. and in the third section on the right a simple little map of where they are going and at 10:30 th third pane swicthes to the middle to represent now, the left pane dissapeares and ois replaced with the mornings bus runs and the 3rd pane on the right now shows the scheduled afternoon drop off bus runs. I mean we have all the data so why not, we have the schedule its live and reflects new additions and cancelaltins we have the roster and staff asigned. we will once we complete it have dynamic bus asssignemnts once we get to that scrip etc.. For to POC its has to be functional we can make it pretty for production RABS

---

## 2. Interactive & Dynamic Scheduling: See the Impact of Your Decisions Instantly

This section focuses on transforming the schedule from a static list into a dynamic, visual, and interactive planning tool.

*   **Visual Calendar View**: A color-coded calendar (with Day and Week views) that displays all scheduled programs. This provides a much more intuitive understanding of the day's activities than a simple table.

*   **Drag-and-Drop Scheduling**: A powerful feature where an admin could, for example, drag a participant from an "unassigned" list and drop them onto a program in the calendar.

*   **Live Recalculation**: This is the core of demonstrating the system's power. When a change is made on the schedule (like adding a participant via drag-and-drop), the UI should instantly update to reflect the consequences:
    *   The participant count for the program would increase.
    *   The **Staffing Ratio** indicator would turn red if more staff are now required.
    *   The **Vehicle Capacity** for the assigned bus would update, showing if it's nearing its limit.
    *   The projected billing for the day would recalculate in the background.

### --[BRETTNOTES] yes to this but we should prioritise the roll out, focusing on the live recalculation and working out calendar drag and drop next etc.. but this is all good and all relevant. for example currently when I go to a participants schedule I can use the check boxes to initiate a change the the schedule, but most changes to a schedule don't happen on the day so each checkbox should also have a date picker next to it so you can add something to the schedule and pick the date it becomes active. all schedule changes should go into a table with the date of change and at midnight or 00:01am on the date of change everything in the table that needs to change that day is triggered... so to make the current POC schedule dynamic we should have the program name be able to change colour... say a participant is currently attending centre based one Monday Tuesday and Wednesday every week... ring ring, (it's his mum) oh Yes funny you should say that, we were just talking about his schedule etc.. oh ok two weeks from now, ok ill put it in the system now. bye! that participant does not want to come on Wednesday anymore they want to come on Thursday because the like the smells of the Thursday cooking class. Right now with check boxes it just represents the status quo there's no future or retro management. but if pick the Wednesday two weeks from now with the date picker and then uncheck the Wednesday he currently attends.. the check box acts like a button it stays check but the program title next to it centre based goes red. and the date picker stay solid now unmodifiable. so I know in two weeks on Wednesday at 00:01 that check mark is going away because its red. I also know that, that week he will be joining Thursday centre based because the unchecked check mark is next to a green centre based. so at 00:01 the green goes back to normal font the check mark is magically ticked and the task was given to the system to assign him to a bud and start the route planning etc.


we should also immediately make CRUD available I the admin dashboard so we can add a staff or a participant etc..

---

## 3. Intelligent Automation & Optimization: Let the System Do the Heavy Lifting

This is where we implement the core logic that makes the system "smart" and saves the most time on manual, repetitive tasks.

*   **Transport Routing Engine**:
    *   **Google Maps Integration**: Use the Google Maps API to calculate and display the most efficient pickup and drop-off routes for each vehicle on a map.
    *   **Automated Route Optimization**: When a participant is added or cancels, the system automatically re-calculates the optimal route for their assigned vehicle.
    *   **Fallback Logic**: Implement the nearest-neighbor algorithm as a reliable backup to ensure routing functionality is always available, even without a Google Maps API key.

*   **Smart Staffing Suggestions**: If a program becomes understaffed due to a last-minute increase in participants, the system could proactively suggest available staff members who are qualified and not already assigned to another activity during that time.

*   **Automated Cancellation Handling**: When a participant cancels (e.g., via a button in a future parent portal or an admin action):
    *   The system automatically updates their attendance status.
    *   It flags their billing record according to the rules (e.g., billable if late cancellation).
    *   It removes them from the vehicle run and re-optimizes the route.
    *   It alerts the admin if the change in numbers affects the required staffing ratio.

### --[BRETTNOTES] yes for the POC it should demonstrate functionally the linkages of certain data and actions.. so yes all that looks good up there but let me explain how the POC intended to demonstrate this so we can refine it if we have to. Th plan was to have a staff table a participants table a schedule table,  facilities and vehicles and a billing system that ties in as well. add a person to a program, the system adds the to a bus run a centre, a staffs shift notes and bills them for each attendance. repeat and watch it change with other dynamic rules and analysis.. for example each program when 4 participants are in attendance if a 5th joins well now we need to add a staff member, we may add another vehicle two smaller runs might be more efficient and now we have an additional driver. oh no a different person on that program just  cancelled, 1 bus run again recalculate and send updated shift note and route to the staff member etc. the staff board may have an availability Column so dynamic rostering should decide who is where base on the number of contracted hours they need etc. oh that cancelled one it will take them out of the billing document too. and if the cancellation was due to illness, Reggie can call them every 48 hours to check in and offer assistance etc.

Participants - staff - roster - activities - centres - buses - bus-runs - shift notes - billing

its all linked and any change to any of it will affect all the other components in some way!

---


## 4. Advanced Reporting & Analytics: From Data to Insights

Go beyond simple CSV exports to provide tools that help in financial management and strategic planning.

*   **Financial Dashboard**: A visual dashboard with charts showing:
    *   Revenue trends over time (week-over-week, month-over-month).
    *   A breakdown of costs and revenue by program.
    *   A summary of billed vs. unbilled services.

*   **Predictive Insights**: Leverage the collected data to provide forward-looking analysis:
    *   **Resource Utilization**: Identify programs, vehicles, or staff members that are consistently under-utilized.
    *   **Demand Forecasting**: Analyse historical attendance to predict which programs may require more resources in the future.

 
### --[BRETTNOTES] yes yes yes to all this, however I think for POC we can flesh it it out with placeholder data in some instances as a lot of this will be built into the BRAINFRAME, there is a complex structure to how Reggie will function and I think instead of prototyping it here this level of innovation will be more practical when the production version of RABS is up and running with true vector database etc.


---

## 5. The Future - Conversational AI Control

This is the ultimate demonstration of an intelligent system. Instead of navigating menus, admins could interact with the system using natural language.

*   **Chat-Based Interface**: A chat window on the dashboard where an admin can type commands.
    *   "Show me the schedule for next Tuesday."
    *   "Add John Smith to the Bowling Night program starting next week."
    *   "What's the most efficient route for Vehicle 2's pickup run tomorrow?"
    *   "Generate the agency billing report for last month."

*   **Proactive AI Assistant**: The AI could also initiate conversations, providing helpful alerts and suggestions.
    *   *"Heads up: The 'Sat Adventure' program is almost full. Should I schedule an additional vehicle?"*
    *   *"John Smith has cancelled his session tomorrow. The bus route for Vehicle 1 has been updated."*
    *   *"You have 3 programs next week that are currently understaffed. Would you like me to show you available staff?"*

### --[BRETTNOTES] again this is spot on in terms of our plan but again this will be fore rabs, once POC confirms they dynamic linking of these "Participants - staff - roster - activities - centres - buses - bus-runs - shift notes - billing" are practicable.
