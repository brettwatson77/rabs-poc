# CONTRIBUTING.md — RABS 3.5

## Guiding Principles

This project follows the principles and workflow defined in [`docs/00_RABS_3.5_MASTER_PLAN.md`](docs/00_RABS_3.5_MASTER_PLAN.md), which serves as the central guide for all development activities. Please review this document before contributing.

## Code Contribution & Porting Rules

### Strategic Porting
- Code from `_archive/RABS-POC3` may be ported into the RABS 3.5 codebase. However, any ported code **must first be audited and refactored** to align with the architecture and API definitions in `MASTER_SPEC.md`.
- Commits containing ported code should be explicitly marked (e.g., `feat: Port participantService from POC3`).
- `RABS-POC2` remains a conceptual and UI/UX reference only; its code should not be ported directly.

---

## Project Layout
```
/backend          # 3.5 API server
/frontend         # 3.5 Vite React app
/database         # DB dump + migrations/seed scripts
/docs             # specs, guides, architecture
/_archive         # reference material (POC2/POC3)
```

---

## Environment & Ports

**Backend:**
```
PORT=3009
PGHOST=localhost
PGPORT=5432
PGDATABASE=rabspocdb
PGUSER=postgres
PGPASSWORD=<secret>
```

**Frontend:**
```
VITE_PORT=3008
VITE_API_TARGET=http://localhost:3009
```

- Root `.env` contains shared values; frontend variables start with `VITE_`.
- Default DB has **pgvector** installed and ready.

---

## Git Rules
- Commit directly to `main`.
- Keep commits small and testable.
- Include in commit message: what route, schema, or UI element you implemented + which spec section it addresses.
- Use conventional-commit style: `<type>: <feature> – <slice>` (e.g., `feat: participants – backend API`).

---

## Database Rules
- **Never** hand-edit tables — use migrations for schema changes.
- Match **column names** to DB schema (snake_case in DB, camelCase in API responses).
- SQL stays in **service/data** layer — controllers are thin.

---

## API Rules

**API stubs** = set up **real routes** now that return placeholder data, so frontend can integrate before backend logic is done.  
Example:
```js
app.get('/api/participants', (req, res) => {
  res.json([]);
});
```

Stub first:
- `GET /api/health` → `{ ok: true }`
- `GET /api/participants` → `[]`
- `GET /api/staff` → `[]`
- `GET /api/vehicles` → `[]`
- `GET /api/venues` → `[]`

---

## Frontend Rules
- Vite + React in `/frontend`.
- Use API proxy in `vite.config.js` for `/api` → backend port.
- First pages to scaffold:
  - Dashboard (ping `/api/health`)
  - Master Schedule (UI shell)
  - Roster (UI shell)
  - Finance (UI shell)
- All network calls go through a small `apiClient` helper, not scattered `fetch` calls.

---

## Deployment Rules
- Public: `rabspoc.codexdiz.com`
  - `/` → frontend build (`dist`)
  - `/api` → backend API
- No WebSocket/SSE headers unless backend supports them.
