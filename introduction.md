# Hey New (or Future) RABS Hacker 👋

Welcome to **RABS-POC v3.5 – “The Re-Re-Rebuild”**.  
Grab a ☕, take a breath, and let’s get you up to speed **fast**.

---

## What RABS Actually Is 🧩

RABS (Roster\Schedule & Billing System) is **an end-to-end disability-support scheduling platform for Australian NDIS providers**.  
It is *not* a generic calendar but a dynamic system and operational foundation adhering to NDIS rules and real-world service delivery demands.

the two metaphors Loom & Work-shed & why we have them,
There are two working metaphors to help guide the functional understanding of a complicated system. The first one is better at explaining the elements and their interaction and the other is better for explaining the ongoing daily operation of the system. ie; one is better for explaining how to build the system and the other is better describing how it should run when it's built.



1. **Programs & Loom Window** –  
   • A *program* is a recurring activity template (e.g. “Monday Centre-Based”).  
   • The **loom** engine looks *X* weeks ahead (configurable) and generates concrete *instances* inside that “loom window”.  
   • When the window extends, the loom re-spins new instances; when data changes it re-threads affected days only.  
2. **Participants, Staff, Vehicles, Venues** –  
   • Each instance must honour participant care-plans, staff ratios (default **1 : 4 supervision**), vehicle capacities and venue limits.  
3. **NDIS Billing** –  
   • Every participant carries billing codes that may split by ratio (4 : 1, 3 : 1, 2 : 1, 1 : 1).  
   • Supervision multipliers, public-holiday loadings, and travel rules are baked into finance tables.  
4. **Key User Journey** –  
   **Master Schedule → Dashboard → Roster → Finance**  
   • Schedulers create/adjust programs in Master Schedule.  
   • Dashboard shows upcoming runs & alerts.  
   • Roster allocates staff/vehicles, tracks unavailability.  
   • Finance exports bulk-upload CSVs for PRODA/Plan-Managers.  
5. **Why It’s Different** –  
   • Must stay **NDIS compliant** (ratio splits, SCHADS award pay, kilometre caps).  
   • Needs rock-solid audit trail for participant attendance & cancellation reasons.  
   • Generic SaaS calendars can’t handle loom-based regeneration or billing code gymnastics.  

---

## 1. Where We’ve Come From

1. **v1 (The Prototype)** – messy SQLite, hard-coded data, single bucket of spaghetti.  
2. **v2 (The Patch-Fest)** – migrated to Postgres, bolted on features, imported *real* CSV data, fixed ~a million bugs, and ended up with a Franken-stack.  
3. **v2.5 we archived the entire v2 code and is now just v2.  
   *   We didn’t want to lose history, but we **refuse** to keep coding on that mess.  
4. **v3** got really close in front end design but we had to pivot away from dev on a VM Linux machine.

Now we’re on **v3.5 (RP2+3 Rebuild)** – a clean, spec-driven rewrite that keeps working data but scraps the zombie code.

---

## 2. What Was Working

• **Database** – Postgres is live with **119 participants**, **58 staff**, **16 vehicles**, venues, billing codes, etc.  
• **Imports** – “smart” CSV/AI importer nailed ~97 % accuracy (postcode cache, address parser).  
• **Vehicle cards** – fancy warning-tape banners, IDs in footers.  
• **Program creation** – new API accepts title/venue/time slots; creates loom instances.  
• **Compliance tooling** –  
  – `goonmakethatdbpretty.sh` → generates a gorgeous `CURRENT_DATABASE.md`.  
  – `scripts/getreport-fixed.js` → snapshot DB + scan backend + write Markdown report.  
• **MASTER_SPEC.md** – our “constitution” (workshed model, API-IS-KING, naming rules, min tables).  

Everything else is either archived in ITTBNF or waiting to be rebuilt cleanly.

---

## 3. Directory Cheat-Sheet

```
.
├── _archive
│   ├── docs_archive
│   ├── docs_other
│   ├── RABS-POC2
│   │   ├── backend
│   │   │   ├── controllers
│   │   │   ├── middleware
│   │   │   ├── routes
│   │   │   │   └── api
│   │   │   ├── services
│   │   │   └── utils
│   │   └── frontend
│   │       ├── dist
│   │       │   └── assets
│   │       ├── public
│   │       └── src
│   │           ├── api
│   │           ├── assets
│   │           ├── components
│   │           ├── context
│   │           ├── mocks
│   │           ├── pages
│   │           ├── styles
│   │           └── utils
│   ├── RABS-POC3
│   │   ├── backend
│   │   │   └── routes
│   │   └── frontend
│   │       ├── public
│   │       └── src
│   │           ├── api
│   │           ├── pages
│   │           └── styles
│   └── scripts_other
├── backend
├── data_sources
├── database
│   └── migrations
├── docs
│   ├── 01_Project_Vision_&_Architecture
│   ├── 02_Proof_of_Concept_Journey
│   ├── 03_Development_&_Operations
│   ├── 04_Future_Vision
│   └── 05_Ras_Docs_Not_RabsPoc
│       ├── 01_Project_Overview_&_Governance
│       ├── 02_Brainframe_Cognitive_Architechture
│       │   ├── 01_Core_Concepts
│       │   ├── 02_Reasoning_&_Memory
│       │   └── 03_LLM_&_Prompts
│       ├── 03_System_Implementation
│       │   ├── 01_Core_Modules
│       │   └── 02_Interface_&_Integrations
│       └── 04_Development_&_Deployment
├── frontend
│   └── scr
│       └── pages
│           ├── chat
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── cms
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── dashboard
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── finance
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── home
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── participants
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── roster
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── schedule
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── settings
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── shift
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── sil
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── staff
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           ├── vehicle
│           │   ├── components
│           │   ├── intelligence
│           │   ├── modals
│           │   └── tabs
│           └── venues
│               ├── components
│               ├── intelligence
│               ├── modals
│               └── tabs
├── reportcards
└── scripts
```

---

## 4. The Game Plan (RP2 Strategy)

1. **Spec First** – MASTER_SPEC.md + OpenAPI contract drive absolutely everything.  
2. **Workshed Metaphor**  
   * **Wall** – templates & blueprints (program templates, config).  
   * **Calendar** – day-to-day schedule (loom instances).  
   * **Filing Cabinet** – reference data (participants, staff, vehicles).  
     *All three layers are read-write.*  
     • **Wall:** edits change future instances only.  
     • **Calendar:** edits modify existing schedule (temporary or permanent).  
     • **Filing Cabinet:** edits update the source records directly and flow outward to any Wall/Calendar items that reference them.  
3. **API-IS-KING** – UI only talks to backend via versioned `/api/v1/**`.  
4. **Step-by-Step Build**  
   1. Finish OpenAPI spec (programs, participants, staff, vehicles).  
   2. Migrations to match spec.  
   3. Thin services/controllers that just echo spec.  
   4. React frontend pages powered by spec (glassmorphism “ark-mode”).  
   5. Hook up compliance checker in CI so deviations are flagged instantly.  
5. **Demo Must-Haves** (tomorrow!):  
   * Master Schedule listing programs for the next 2 weeks.  
   * Dashboard cards show up with correct dates.  
   * Roster page loads without white screens.  

---

## 5. What To Do If I Disappear 🚀

1. **Run the snapshot & report**  
   ```bash
   ./scripts/goonmakethatdbpretty.sh
   node scripts/getreport-simple.js
   ```  
   – First file gives you the DB shape.  
   – Second file tells you what’s missing.

2. **Read MASTER_SPEC.md** start-to-finish – that’s the contract.

5. **Keep naming & casing rules** (snake_case in DB, camelCase in JS, etc.).

6. **Commit to main only no branches ever

---

## 6. Quick Links

* **MASTER_SPEC.md** – constitution & API contract.  
* **reportcards/** – compliance report history.

---

### That’s It 💪

Happy hacking! 🚀

A quick word from the creator!

This is how I put it when describing the operational layer, but it may not make sense unless you dig for documents that describe the unwoven future, the great loom of the present, and the payment python that when all debts are settled drops the shroud and reveals the truth, the python was the braided ribbon of history spat out of the loom for as long as time remembers, or somewhere in between the late 80's and 2007 when it really kicked off... any way this is how i described the operation layer, hope it makes sense! "in one of those little portable work sheds that gets craned onto a job-site for the engineers in business suits and little business hard-hats to work out of. On the wall we have giant sheets of paper or a fancy electronic whiteboard.. and on these surfaces is the output from our create program master or master card. we detail the program the time slot segments and who is coming to the program and how often it repeats etc in our little work-shed is a filing cabinet and there's a draw marked participants staff vehicles and venues in those draws we have a file for each, they contain lots of important details like addresses of participants the capacity of a venue, how many people fit into the DSW005 Hiace? it's in the vehicle file! but there's another drawer in our cabinet! called finance inside a sheet of paper that has all the ndis codes we use plus the rate we charge and even some codes have a breakdown of a single codes 1:1 rate split amongst participants at a 4:1 3:1 and 2:1 ratio.. so if we go back to our program on the wall we see its center based monday cool we know segment one starts with pickups at 8:30am and it lists who's coming to the program cool ill grab their address from the file and check bus capacity hmm well need 3 vehicles no worries, oh and let me see yup there's 13 participants coming so there's at least three staff were good to go here is the fastest pickup routes. it says here i need to bill three codes for these participants per hour.. let me check the wall yup that's confirmed i've put this into the billing database so when a bulk upload csv or invoices csv are generated they should be present. i've checked the staff files too and i know their base rate and the SCHADS rules so i can work out a staff cost too. that's great very helpful.. how many times do i have to generate these runs and finances? oh well the sign on the door said current loom window 8 weeks so we should at least do that.. but back on the wall inside there is a calendar but this calendar just like our workshed is guarded by heavily armed security guards.. why? well its an important calendar it says things like on august 5th craig isn't coming to center based and it said on september 15th he's leaving the monday group for good. oh but he is joining the tuesday group the next day.. well that's good to know. but well why not just write those on the wall? You silly engineer, to put it on the wall means every time we or the next shift re-generate this event like when the loom window changes or a new monday or tuesday just rolls along then how would we know if Craig was cancelling that day, forever or cancelled a long time ago? the calendar tells us what temporary changes and what permanent changes happen on any give day. so if i'm generating a new monday centre based for the loom lords, all i got to do is start at the wall, then check todays date on the calendar. Apply any temporary changes to the loom window and im good to go? yup but don't forget if the calendar tells you a change is permanent you better update the wall too! if you do all that you can sit down, have a coffee and wait for the phone to ring.. but if that spinning red light flashes up there in the corner.. put the coffee and hunker down, it's all hand on deck because someone probably called in sick, a vehicle might be out for maintenance, or they're mucking around with the loom window again! which probably means we need to look for replacement staff or vehicle generate a couple of weeks of new loom entries but either way i suspect its going to be a substantial amount of bur run map requests! but don't panic if we have our programs on the wall our secure calendar for upcoming, recent and current temporary + permanent changes, our draws with the files to pull pay rates codes and prices and addresses we can always build exactly what we need. and don't forget to be polite and pay the google maps api.. he's a temperamental bastard!" 
