# Frontend Enhancement Ideas  
_A living backlog captured during page-by-page UI review_

> This document grows as we inspect each page of the RABS-POC frontend.  
> When a new idea surfaces, append it under the relevant page section with priority and status.

---

## 1. Master Schedule Page

| Idea | Priority | Status / Notes |
|------|----------|----------------|
| **Shift-Type Tabs** – toggle visibility of cards by shift category: **CB**, **Social**, **Night Social**, **1:1**, **STA**, **SIL**, **ALL** | High | Newly logged. Requires adding `shift_type` attribute to card payload & frontend filter logic. |
| **Leave View** – extra tab *Leave* that swaps cards for a simple row list of staff on leave (name + leave type + dates) | Medium | Depends on leave data source & `/api/v1/staff/leave` endpoint. |

---

## 2. Dashboard Page

*(add ideas here during review)*

---

## 3. Participant Planner Page

*(add ideas here during review)*

---

## 4. Staff Page

*(add ideas here during review)*

---

## 5. Vehicles Page

*(add ideas here during review)*

---

## 6. Venues Page

*(add ideas here during review)*

---

### How to Use This File
1. During each page review, log every enhancement idea here.  
2. Set **Priority** (High / Medium / Nice-to-have).  
3. Update **Status** as: `Proposed` → `In Progress` → `Done`.  
4. Keep commit messages descriptive (`docs: add idea – dashboard KPI drill-down`).  

Let’s keep the revolution organised! 🌶️
