# RABS-POC: Business Rules Engine



This document details the specific, hardcoded business logic that drives the RABS-POC.



## 1. Staffing Rules



\## 1. Staffing Rules

* **Staffing Ratio:** 1 staff member is required for every 4 participants.  
* **Calculation:** `staffNeeded = ceil(participantCount / 4)`  
* **Implementation:** This calculation is triggered whenever an enrollment changes (add, confirm, cancel). The `dynamicResourceService.js` is responsible for this logic.  
* **Assignment Priority:** When assigning staff, the system prioritizes staff members with the most remaining contracted hours to ensure equitable work distribution.


\*   \*\*Staffing Ratio:\*\* 1 staff member is required for every 4 participants.

## 2. Vehicle Allocation Rules

\*   \*\*Implementation:\*\* This calculation is triggered whenever an enrollment changes (add, confirm, cancel). The `dynamicResourceService.js` is responsible for this logic.

\*   \*\*Assignment Priority:\*\* When assigning staff, the system prioritizes staff members with the most remaining contracted hours to ensure equitable work distribution.

* **Vehicle Capacity:** All vehicles are 10-seater buses (1 driver + 9 passengers).  
* **Preferred Load:** For efficiency, the system prefers a load of **5 participants** per vehicle. If a run has 8 participants, it will try to use two smaller, faster runs of 4 participants each rather than one large, slow run, provided the staffing ratio is still met.  
* **Hard Cap:** A single bus will never be allocated more than 9 participants.  
* **Driver Assignment:** The driver is chosen from the already-assigned staff members, prioritizing non-lead staff where possible.


\## 2. Vehicle Allocation Rules

## 3. Cancellation & Billing Rules

Vehicle allocation aims for both capacity satisfaction and time efficiency.



* **Notice Period:** A cancellation is considered **“short notice”** if it occurs **less than 7 days** before the scheduled program instance.  
* **Normal Cancellation (≥ 7 days notice):**  
  * The participant’s `attendance` record is deleted.  
  * Any associated un-billed items are voided.  
  * The participant is billed **0 %**.  
* **Short-Notice Cancellation (< 7 days notice):**  
  * The participant’s `attendance` record status is set to `'cancelled'`.  
  * The billing records are **retained**; the participant is billed as if they attended.  
  * Earlier docs suggested a 90 % rule, but the implemented logic bills the session **in full**.  
* **Audit Trail:** All cancellations are logged in the `activity_log` table for auditing purposes.
---



## 4. Routing Logic


* **Primary Engine:** Google Maps Directions & Distance Matrix APIs are used if a valid API key is provided in the `.env` file. The optimizer determines the most efficient waypoint order (`waypoints=optimize:true`).  
* **Fallback Engine:** If Google Maps keys are absent, the system falls back to a simpler calculation using a nearest-neighbour algorithm and Haversine distance to order the stops.  
* **Max Ride Time:** The system is intended to respect a 60-minute maximum ride time from the last pickup to the venue, which influences the decision to use multiple smaller buses.


\*   \*\*Notice Period:\*\* A cancellation is considered \*\*"short notice"\*\* if it occurs \*\*less than 7 days\*\* before the scheduled program instance.

\*   \*\*Normal Cancellation (≥ 7 days notice):\*\*

&nbsp;   \*   The participant's `attendance` record is deleted.

&nbsp;   \*   Any associated un-billed items are voided.

&nbsp;   \*   The participant is billed \*\*0%\*\*.

\*   \*\*Short-Notice Cancellation (< 7 days notice):\*\*

&nbsp;   \*   The participant's `attendance` record status is set to `'cancelled'`.

&nbsp;   \*   The billing records are \*\*retained\*\*. The participant is billed as if they attended.

&nbsp;   \*   The `POC\_NEXT\_STEPS.md` document mentions a potential 90% billing rule, but the implemented logic in `REFINEMENTS\_COMPLETED.md` clarifies that the session is still billed fully.

\*   \*\*Audit Trail:\*\* All cancellations are logged in the `activity\_log` table for auditing purposes.



---



\## 4. Routing Logic



\*   \*\*Primary Engine:\*\* Google Maps Directions \& Distance Matrix APIs are used if a valid API key is provided in the `.env` file. The optimizer is used to determine the most efficient waypoint order (`waypoints=optimize:true`).

\*   \*\*Fallback Engine:\*\* If Google Maps keys are absent, the system falls back to a simpler calculation using a nearest-neighbor algorithm and Haversine distance to order the stops.

\*   \*\*Max Ride Time:\*\* The system is intended to respect a 60-minute maximum ride time from the last pickup to the venue, which influences the decision to use multiple smaller buses.

