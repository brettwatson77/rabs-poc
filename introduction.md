# Hey New (or Future) RABS Hacker 👋

Welcome to **RABS-POC v3 – “The Re-Rebuild”**.  
Grab a ☕, take a breath, and let’s get you up to speed **fast**.

---

## What RABS Actually Is 🧩

RABS (Roster & Billing System) is **an end-to-end disability-support scheduling platform for Australian NDIS providers**.  
It is *not* a generic calendar—every feature bends around NDIS rules and real-world service delivery demands.

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
3. **v2.5 (ITTBNF)** – we archived the entire v2 codebase into the _**ITTBNF**_ folder (“**In The Toilet But Not Flushed**”).  
   *   We didn’t want to lose history, but we **refuse** to keep coding on that mess.  
   *   Think of ITTBNF as the museum of “don’t do this again”.

Now we’re on **v3 (RP2 Rebuild)** – a clean, spec-driven rewrite that keeps working data but scraps the zombie code.

---

## 2. What Was Working (Retrieve from Toilet)

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
/
├─ backend/          ← clean slate (mostly empty)
├─ frontend/         ← clean slate (mostly empty)
├─ database/         ← migrations for v3
├─ ITTBNF/           ← the entire v2 monster – look, don’t touch
├─ scripts/
│   ├─ goonmakethatdbpretty.sh   ← DB snapshotter
│   └─ getreport-fixed.js        ← compliance checker
├─ reportcards/      ← timestamped compliance reports
└─ MASTER_SPEC.md    ← the law of the land
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
   node scripts/getreport.js
   ```  
   – First file gives you the DB shape.  
   – Second file tells you what’s missing.

2. **Read MASTER_SPEC.md** start-to-finish – that’s the contract.

3. **Ignore ITTBNF unless you need reference code** – never copy-paste back.

4. **Add new stuff inside `/backend`, `/frontend`, `/database/migrations`** only.

5. **Keep naming & casing rules** (snake_case in DB, camelCase in JS, etc.).

6. **Commit early, commit often** – we’re in rebuild mode, small PRs.

---

## 6. Glossary of Inside Jokes

• **ITTBNF** – In The Toilet But Not Flushed (archive).  
• **RP2** – “Rip-and-Replace Plan 2” (v3 rebuild).  
• **Work-Shed** – mental model (Wall, Calendar, Filing Cabinet).  
• **Toilet Folder** – safe place for crap code, not a trash can.  
• **o3 pro** – running joke about over-clever AI suggestions.

---

## 7. Quick Links

* **MASTER_SPEC.md** – constitution & API contract.  
* **CURRENT_DATABASE.md** – latest DB snapshot (run generator first).  
* **CURRENT_API.md** – generated list of backend routes.  
* **reportcards/** – compliance report history.

---

### That’s It 💪

Fire up your editor and keep pushing the rebuild forward.  
If anything explodes, drop new stuff into the toilet folder, write a migration, and document it in the spec – future-you will thank you.

Happy hacking! 🚀

A quick word from the creator!
This is how I put it when describing the operational layer, but it may not make sendse unless you dig for documents that describe the unwoven future, the great loom of the present, and the payment python that when all debts are setlled drops the shroud and reveals the truth, the python was the braided ribbon of history spat out of the loom for as long as tinme remembers, or somwehere in between the late 80's and 2007 when it really kicked off... any way this is how i described the operation layer, hope it makes sense! "in one of those little portable work sheds that gets craned onto a job-site for the engineers in business suits and little business hard-hats to work out of. On the wall we have giant sheets of paper or a fancy electronic whiteboard.. and on these surfaces is the output from our create program master or master card. we detail the program the time slot segments and who is coming to the program and how often it repeats etc in our little work-shed is a filing cabinet and there's a draw marked participants staff vehicles and venues in those draws we have a file for each, they contain lots of important details like addresses of participants the capacity of a venue, how many people fit into the DSW005 Hiace? it's in the vehicle file! but there's another drawer in our cabinet! called finance inside a sheet of paper that has all the ndis codes we use plus the rate we charge and even some codes have a breakdown of a single codes 1:1 rate split amongst participants at a 4:1 3:1 and 2:1 ratio.. so if we go back to our program on the wall we see its center based monday cool we know segment one starts with pickups at 8:30am and it lists who's coming to the program cool ill grab their address from the file and check bus capacity hmm well need 3 vehicles no worries, oh and let me see yup theres 13 participants coming so there's at least three staff were good to go here is the fastest pickup routes. it says here i need to bill three codes for these participants per hour.. let me check the wall yup that's confirmed i've put this into the billing database so when a bulk upload csv or invoices csv are generated they should be present. i've checked the staff files too and i know their base rate and the schads rules so i can work out a staff cost too. that's great very helpful.. how many times do i have to generate these runs and finances? oh well the sign on the door said current loom window 8 weeks so we should at least do that.. but back on the wall insidethere is a pin up calendar from k-pop group txt some months a group shop sometimes its soobins time to shine, but this calendar just like our workshed is guarded by heavily armed security guards.. why? well its an important calendar it says things like on august 5th craig isn't coming to center based and it said on september 15th he's leaving the monday group for good. oh but he is joining the tuesday group the next day.. well that's good to know. but well why not just write those on the wall? You silly engineeer, to put it on the wall means every time we or the next shift re-generate this event like when the loom window changes or a new monday or tuesday just rolls along then how would we know if Craig was cancelling that day, forever or cancelled a long time ago? the calendar tells us what temporary changes and what permanent changes happen on any give day. so if i'm generating a new monday centre based for the loom lords, all i got to do is start at the wall, then check todays date on the calendar. Apply any temporary changes to the loom window and im good to go? yup but don't forget if the calendar tells you a change is permanent you better update the wall too! if you do all that you can sit down, have a coffee and wait for the phone to ring.. but if that spinning red light flashes up there in the corner.. put the coffee and hunker down, it's all hand on deck because someones probably called in sick, a vehicle might be out for maintenance, or they're mucking around with the loom window again! which probably means we need to look for replacement staff or vehicle generate a couple of weeks of new loom entries but either way i suspect its going to be a substantial amount of bur run map requests! but don't panic if we have our programs on the wall our secure calendar for upcoming, recent and current temporary + permanent changes, our draws with the files to pull pay rates codes and prices and addresses we can always build exactly what we need. and don't forget to be polite and pay the google maps api.. he's a temperamental bastard!" - The creator 
