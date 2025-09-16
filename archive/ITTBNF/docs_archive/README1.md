# R.A.B.S. POC – Real-time Adaptive Backend System (Codename: *Reggie*)

**R.A.B.S. (Real-time Adaptive Backend System)** is a next-generation scheduling and resource coordination platform for dynamic environments such as disability support, logistics, and workforce operations.

This repository, `rabs-poc`, is a **local-only sandbox** created to test feasibility and logic — not intended for production use. It focuses on proving that the system can:

✅ Add and remove clients from scheduled activities  
✅ Dynamically adjust staffing, billing, and vehicle assignments  
✅ Allow a voice agent to perform these tasks via API  

---

## 🛠 Tech Stack

- **Backend:** Node.js + Express  
- **Frontend:** React (Create React App)  
- **Database:** SQLite or PostgreSQL (swap-friendly for prototyping)  
- **Auth:** Hardcoded dev session (for simulating API use by agents)  
- **Agent Integration:** Optional API exposure for controlled voice testing  

---

## 🔍 Primary Goals

This proof-of-concept exists to confirm the core logic of the future R.A.B.S. system:

1. **Activity Attendance Logic**
   - Add/remove clients to/from activities
   - Track status changes (confirmed, cancelled, swapped)
   - Auto-update related staffing and vehicle allocations

2. **Staff & Vehicle Assignment**
   - Dynamically match available staff to activities
   - Optimize vehicle use based on capacity and location
   - Handle cancellation and rebooking logic cleanly

3. **Billing Simulation**
   - Auto-calculate estimated billing based on attendance
   - Simulate line items in the style of NDIS billing
   - Adjust totals dynamically with participant changes

4. **Natural Language API Control**
   - Test voice-agent instructions like:  
     _"Cancel tomorrow’s Fairfield shift for Karen and reassign her spot to John."_
   - Agent parses and triggers corresponding system actions via API

---

## 🧪 Mock Data

- 10 clients (fake participant profiles)
- 5 staff members
- 2 centers
- 4 vehicles
- Sample activity schedule with time slots and metadata
- Fake billing engine
- Fake HR logic for timesheet calculation

---

## 🚫 What This Is Not

- ❌ Not secure  
- ❌ Not online by default  
- ❌ Not production-ready  
- ❌ Not privacy-compliant  
- ❌ Not meant for real data or user interaction  

> ⚠️ Reminder: The **real R.A.B.S. system** will be built in a separate repository using production-grade architecture and security.

---

## 📂 Project Structure (Early Phase)

```
rabs-poc/
├── backend/
│   ├── routes/
│   ├── models/
│   ├── logic/
│   └── server.js
├── frontend/
│   ├── src/
│   └── public/
├── database/
│   ├── schema.sql
│   └── seed.js
├── scripts/
├── README.md
└── .env.example
```

---

## 🔐 Auth (Local-Only – Capability Testing)

This environment uses a **hardcoded dev session** to simulate user context. No tokens or login flows are required, since:

- The project runs locally with fake data
- The goal is logic testing, not access control
- You may optionally expose the backend to allow online voice agents to test API functions

Sample middleware:

```js
function devAuth(req, res, next) {
  req.user = { id: 1, name: 'Test Admin', role: 'admin' };
  next();
}
```

You can expand to JWT or OAuth later, but it’s not required in this repo.

---

## 🚀 Getting Started

```bash
git clone https://github.com/YOUR-USERNAME/rabs-poc.git
cd rabs-poc
npm install
```

Start backend and frontend:

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm start
```

Seed the database:

```bash
npm run seed
```

---

## 📡 Voice Agent Integration (Optional)

While this repo is not exposed online by default, you **may expose the backend to the internet** (e.g., using `ngrok`) for temporary API access during voice agent tests.

---

## 🧭 Roadmap (POC Scope Only)

- [ ] Build add/remove logic for clients in activities  
- [ ] Create dynamic resource allocation engine  
- [ ] Mock invoice generation from schedule changes  
- [ ] Enable basic voice-agent command simulation  
- [ ] Capture output from voice → intent → system task  

---

## 🤝 Feedback

This repo is exploratory — not for production or real-world deployment. Feedback on logic structures, voice-agent API control, and resource coordination flows is welcome.

---

## 🧠 Codename: *Reggie*

Because even a proof-of-concept deserves personality.
