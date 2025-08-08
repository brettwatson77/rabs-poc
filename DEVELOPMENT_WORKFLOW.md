# Development Workflow and Environment Guide

## 1&nbsp;&nbsp;Overview
• Source files live on your **macOS** machine and are *symlinked* into the Linux host (`bdos`).  
• **All services** (PostgreSQL, backend, frontend) **run on Linux**. Never start them on macOS.  
• Operate exclusively via SSH:  
```bash
ssh bdos                     # alias → brettwatson@192.168.77.8
# or
ssh brettwatson@192.168.77.8
```  
• Production build: **https://rabspoc.codexdiz.com**

---

## 2&nbsp;&nbsp;Addresses & Ports (Linux)
| Service   | URL                                 |
|-----------|-------------------------------------|
| Backend   | http://192.168.77.8:3009            |
| Frontend  | http://192.168.77.8:3008            |

Avoid `http://localhost:3008/3009` on macOS unless you create SSH port-forwards (see § 6).

---

## 3&nbsp;&nbsp;Running Commands (Linux only)
```bash
# connect
ssh bdos

# project root
cd ~/dev/rabs-poc

# backend
cd backend && node server.js

# frontend
cd frontend && npm ci && npm run dev

# install/build
npm/yarn/PNPM commands **must** be executed over SSH to ensure Linux-native dependencies.
```

---

## 4&nbsp;&nbsp;Environment Variables
`.env` (repo root, *read by backend*) — typical Linux values:
```
PORT=3009
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=rabspocdb
GOOGLE_MAPS_API_KEY=
GOOGLE_GEMINI_KEY=
OPENAI_API_KEY=
```
• Do **not** start the backend on macOS.  
• If you truly need psql or scripts on macOS, set `DB_HOST=192.168.77.8` **or** use port-forwarding.

---

## 5&nbsp;&nbsp;Optional SSH Helpers (automation)
These live in `.env` for tooling; they do **not** affect the backend’s DB connection.
```
REMOTE_WORKDIR=~/dev/rabs-poc
SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=yes"
SSH_RUN=ssh $SSH_OPTS bdos "cd $REMOTE_WORKDIR &&"
SSH_SHELL=ssh $SSH_OPTS bdos "cd $REMOTE_WORKDIR && exec bash -l"
```

---

## 6&nbsp;&nbsp;Port Forwarding (optional)
Access Linux services via `localhost` on macOS:
```bash
# backend
ssh -N -L 3009:localhost:3009 bdos

# frontend
ssh -N -L 3008:localhost:3008 bdos
```
Then open `http://localhost:3008` or `http://localhost:3009` in a browser.  
Otherwise use `http://192.168.77.8:3008/3009` directly.

---

## 7&nbsp;&nbsp;Common Pitfalls & Signals
| Symptom                                          | Likely Cause / Fix                                      |
|--------------------------------------------------|---------------------------------------------------------|
| `ECONNREFUSED ::1:5432` on macOS                 | Backend attempted local PG. SSH in or set `DB_HOST=192.168.77.8`. |
| Health check fails at `localhost:3009` on macOS  | Service actually lives on 192.168.77.8. Use correct URL or forward ports. |
| Server logs DB host as `localhost` but fails     | You started backend on macOS by mistake. Stop it; SSH to Linux. |

*Server now logs `[DB] target host=...` at startup so you immediately know where it’s pointing.*

---

## 8&nbsp;&nbsp;Production
Production site: **https://rabspoc.codexdiz.com**  
Secrets **never** committed.  Set real keys via the server’s environment.

---

### Keep this document authoritative
• When updating `.env.*` templates, reflect changes here.  
• Refer any new developer (or AI assistant) to this guide first.  
• If in doubt, **SSH to Linux** — nothing runs locally on macOS.
