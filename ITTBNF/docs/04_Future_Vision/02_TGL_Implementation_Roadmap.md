# TGL Implementation Roadmap  
_Rewriting **rabs-poc** to realise the Rules → Loom → History Ribbon architecture_

> Goal: keep the proven **Dynamic Resource System** intact while rebuilding the remaining stack around the TGL model.  
> Horizon: 6 phases over ~9 months (POC timeline), each phase ends with a shippable milestone & POC-LOG entry.

---

## 📜 Phase 0 – Project Kick-off & Guardrails
| Objective | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| • Align team & AI agents on TGL vocabulary and objectives<br>• Freeze non-critical feature work | • This roadmap committed to repo<br>• `docs/02_Brainframe/...` updated with TGL glossary<br>• Branch strategy agreed (`tgl/*`) | • All new commits reference TGL tasks<br>• First POC-LOG entry for roadmap |

---

## 🏗️ Phase 1 – Data-Model Foundations (Rules & Loom)
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| n/a (new) | • `rules_programs` • `rules_staff_roster` • `rules_participant` • `loom_instances` | 1. Write migration `001_tgl_core.sql` (PostgreSQL)&nbsp;↴<br>2. Scaffold TypeORM models / Prisma<br>3. Add `LOOM_DURATION_WEEKS` config | • DB migrations run locally<br>• `/api/v1/loom?range=2w` returns **empty** window projected from empty rules |

---

## ⚙️ Phase 2 – The Projector Worker
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| n/a | • `projector.js` (cron / worker queue)<br>• Conflict-resolver util | 1. Implement algorithm: read rules → generate 6-week Loom<br>2. Idempotent re-runs (hash + overrides)<br>3. Add Jest integration tests | • Running worker populates `loom_instances` for seeded rules<br>• Re-run produces **no duplicates** |

---

## 🗂️ Phase 3 – Card Decomposition Layer
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| Dynamic Resource System tables & services | • `event_card_map` service<br>• `/cards` API<br>• Dashboard & Roster React hooks | 1. Write decomposition logic (1 event → bus cards + activity + roster shifts)<br>2. Migrate dashboard timeline to consume `/cards`<br>3. Unit-test mapping rules | • Dashboard shows 5 cards per bus-enabled event<br>• Roster shows 3 shift cards<br>• No UI regressions reported |

---

## 🚐 Phase 4 – Integrate Dynamic Resource System with Loom
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| **KEEP** `dynamicResourceService`, `routeOptimizationService` | • `loomInstanceId` FK added to `staff_assignments`, `vehicle_assignments`, `routes` | 1. Refactor services to accept Loom instance IDs<br>2. Trigger re-balance when Projector creates / updates instances<br>3. Re-run all logistics Cypress tests | • Auto-staffing works on Loom data<br>• `/dynamic-demo` unchanged for users – powered by new schema |

---

## 💰 Phase 5 – Payment Python & History Ribbon
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| Existing finance CSV logic | • `history_ribbon_shifts` & `diamond_payments` tables<br>• `payment_status_trigger`<br>• `pythonStream` websocket | 1. Move completed instances to History via nightly job<br>2. Emit diamonds with status Red → Yellow → Green<br>3. Add frontend river visual POC | • Diamonds visible; colour transitions reflect finance actions<br>• Old tables trimmed; audit logs immutably stored |

---

## 🔍 Phase 6 – Quality Agent & Spot-Audit Workflow
| Salvage | New Components | Tasks | Success Criteria |
|---------|----------------|-------|------------------|
| Projector infra | • `qualityAgent.js` worker<br>• `/audits` API | 1. Randomly tag 5 % Loom instances<br>2. When shift braided, trigger audit record<br>3. UI for humans to clear audits | • Audit backlog displays; clearing flows update History Ribbon vec-tags |

---

## 🚀 Roll-out & Hardening
1. Switch default branch to `main_tgl` after Phase 4 passes QA.  
2. Run parallel double-entry (old vs new) for one fortnight billing cycle.  
3. Decommission legacy tables after Payment Python validated.

---

## 🎯 Global Success Criteria
1. **Functional Parity** – Users can perform all current tasks via TGL stack.  
2. **Temporal Integrity** – Loom regenerates without data loss; overrides preserved.  
3. **Performance** – Projector completes 6-week window < 60 s with 10 k rules.  
4. **Data Provenance** – 100 % of mutable history moved to immutable ribbon with vec-tags.  
5. **Zero Downtime Migration** – Production swap achieved with < 10 min read-only window.  

---

### 📌 Next Step
Create engineering tickets for **Phase 1** migrations and schedule Loom/Projector spike this sprint.  
_Log each milestone in **POC-LOG.md** to keep the knowledge bridge alive._
