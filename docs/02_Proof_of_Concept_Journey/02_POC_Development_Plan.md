\# RABS-POC Development Plan



This document outlines the prioritized features and tasks for the next phase of the RABS-POC development. It serves as our shared checklist to ensure we are aligned on the scope and can track our progress effectively.



---



\## Phase 1: Core Functionality \& Admin UI



This phase focuses on building the essential administrative interfaces and the core date simulation functionality, which are foundational for demonstrating the system's capabilities.



| Feature/Task | Description |

| :--- | :--- |

| \*\*CRUD Interfaces\*\* | Create simple, intuitive UI forms for managing core data. This will allow admins to easily add, view, and edit records without direct database access. This includes pages for \*\*Participants\*\*, \*\*Staff\*\* (including their availability), \*\*Vehicles\*\*, and \*\*Venues\*\*. |

| \*\*Billing Rate Management\*\* | Build the `/admin/rates` page. This interface will allow an authorized user to view all NDIS line items, associate them with specific programs, and update their prices to match the latest NDIS price guide. |

| \*\*Date Simulation Slider\*\* | Implement a global UI component (a slider or date picker) that sets a simulated "current date" for the entire application. All date-sensitive logic, such as schedule displays and billing calculations, will reference this simulated date instead of the system clock. |

| \*\*Future-Dated Enrollments\*\* | Enhance the Participant Planner UI. Next to each program checkbox, add a date picker. This will allow admins to schedule future enrollment changes (starts and stops). The UI will visually indicate pending changes (e.g., using color-coding) until the simulated date is reached. |



---



\## Phase 2: Dynamic Logic \& Automation



This phase implements the "smart" features of the application, showcasing the system's ability to automate complex tasks and respond to changes in real-time.



| Feature/Task | Description |

| :--- | :--- |

| \*\*Live Recalculation Engine\*\* | Implement the core backend logic that triggers a cascade of updates whenever a participant's attendance changes. This includes recalculating required staff based on the `ceil(participants/4)` rule and flagging programs that become understaffed or have vehicle capacity issues. |

| \*\*Transport Routing Engine (Fallback)\*\* | Build the default routing engine using a nearest-neighbor algorithm and Haversine distance calculation. This ensures the system can always generate functional pickup and drop-off routes, even without a Google Maps API key. |

| \*\*Transport Routing Engine (Google Maps)\*\* | Integrate the Google Maps Directions \& Distance Matrix API. When an API key is present, the system will use it to calculate and display optimized routes, providing more accurate travel times and distances. |

| \*\*Automated Cancellation Handling\*\* | Implement the backend logic to handle participant cancellations. This will involve updating the attendance status, flagging the billing record appropriately based on cancellation rules, and triggering the recalculation of vehicle routes and staffing needs. |



---



\## Phase 3: Dashboard \& Visualization



This phase focuses on creating the high-impact visual tools that will demonstrate the system's power and ease of use to the administrative team.



| Feature/Task | Description |

| :--- | :--- |

| \*\*Admin Command Center\*\* | Build the dynamic, three-pane dashboard. This will provide a real-time operational view, showing activities and resource locations for "Before," "Now," and "Next." It will include visual indicators for staff and participants, and clicking on a vehicle will display its current route on a map. |

| \*\*Interactive Calendar View\*\* | Create a visual, color-coded calendar view for the Master Schedule (with Day and Week views). This will provide a more intuitive way to understand the day's activities and will be the foundation for future drag-and-drop scheduling functionality. |



---



\## Phase 4: Finalization



This phase covers the final documentation and cleanup tasks to ensure the proof-of-concept is well-documented and ready for review.



| Feature/Task | Description |

| :--- | :--- |

| \*\*Combine READMEs\*\* | Merge the content from the existing READMEs into a single, comprehensive document. This new README will provide a complete overview of the project and clear instructions for setup, configuration, and operation. |

| \*\*Final Review \& Cleanup\*\* | Conduct a final pass through the entire codebase to clean up any unused files, refactor code for clarity, and ensure all features are working as expected according to this development plan. |```



I will proceed with the remaining files for the `Proof of Concept Journey` in the next response.

