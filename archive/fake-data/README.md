# Archived Fake Data Directory

## ⚠️ Legacy Test & Seed Files

This folder contains **legacy scripts and data sets** that were used in the very early proof-of-concept phase of the RABS project.  
They include hard-coded participants (`"John Smith"`, `"Sarah Johnson"`, etc.), sample programs, and obsolete SQLite databases.

### Why are they here?
1. **Historical reference** – to document the project’s evolution and early experimentation.  
2. **Audit trail** – in case we ever need to verify or reproduce past PoC behaviour.

### Important Restrictions
* **Do _not_ run or import any file in this directory in any environment beyond personal experimentation.**  
* These scripts **will corrupt or replace** real data if executed against production or staging databases.  
* The live system now connects exclusively to **PostgreSQL** via the unified migration set (see `/database/migrations/**`). No SQLite artefacts remain.

### Related Cleanup Ticket
For full details of the removal process see **Ticket #RABS-234 – “Fake Data Cleanup & Decommission”** and the root-level document `docs/FAKE_DATA_CLEANUP_SUMMARY.md`.

---

**In short: keep for reference, never for production.**
