# CMMS — Beit Jala Pharmaceutical Co.

Computerized Maintenance Management System (CMMS) — Graduation Project for Beit Jala Pharmaceutical Co., Engineering & Maintenance Department.

The system digitizes machine maintenance records, checklists, requests, and plans currently maintained on paper, keeping the underlying maintenance workflow unchanged.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | Node.js 24 + Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Session-based (express-session + bcrypt) |
| API | REST + OpenAPI spec + Orval codegen |
| Runtime | pnpm workspaces monorepo |

---

## Installation

```bash
pnpm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing (min 32 chars) |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default: 3000) |

---

## Database Setup

The project uses Drizzle ORM with a pre-configured PostgreSQL database.

**Push schema to database:**
```bash
pnpm --filter @workspace/db run push
```

**Create the sessions table:**
```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);
```

---

## Seed Demo Data

```bash
# Using tsx (runs from source)
pnpm dlx tsx artifacts/api-server/src/seed.ts
```

This creates:
- 5 departments: Engineering & Maintenance, Production, QA, QC, R&D
- 5 user accounts (see below)
- 4 sample machines

---

## Running the Application

**Start the API server:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Start the frontend:**
```bash
pnpm --filter @workspace/cmms run dev
```

**Regenerate API hooks/schemas (after OpenAPI spec changes):**
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Test Login Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| supervisor | supervisor123 | Maintenance Supervisor |
| technician | technician123 | Maintenance Technician |
| employee | employee123 | Department Employee |
| qa | qa123 | QA Supervisor |

---

## Phase 1 — Completed Features

- [x] Project setup — pnpm monorepo, TypeScript, OpenAPI-first architecture
- [x] PostgreSQL database with Drizzle ORM
- [x] Session-based authentication (login, logout, protected routes)
- [x] 5 roles + 18 permissions foundation
- [x] Role-based access control (permissions individually assignable per user)
- [x] Admin user management (create, edit, deactivate, assign permissions)
- [x] ERP-style responsive layout (sidebar + top bar)
- [x] Role-based dashboard shell with stats and placeholders
- [x] Machines module (list, search, add, edit, soft-delete)
- [x] Machine profile page with tabbed sections
- [x] Equipment Information Record (FORM-10-0118) — view/edit/read-only
- [x] Demo seed data (5 users, 5 departments, 4 machines)
- [x] API routes for all Phase 1 operations
- [x] Audit logs table (ready for Phase 2)

---

<<<<<<< HEAD
## Phase 2 — Preventive Maintenance

- [x] Preventive Maintenance schema foundation
- [x] Per-machine PM header with restricted edit action
- [x] Per-machine flexible checklist points with soft removal
- [x] PM inspection entry columns with historical record chaining
- [x] PM record view/fill/history screens
- [x] Annual Preventive Maintenance Plan (FORM-10-1025)
- [x] Monthly Preventive Maintenance Program (FORM-10-0117)
- [x] Maintenance Plans navigation and permission gates
- [x] Dashboard PM widgets sourced from Monthly Plan data
- [x] Phase 2 permissions for PM checklists, PM record filling, plans, and header editing

Phase 2 intentionally did not include Corrective Maintenance, Spare Parts, real printing, or real electronic signatures. Signature fields are preserved as form fields/placeholders until Phase 5.

---

## Phase 3 — Corrective Maintenance / Maintenance Requests

- [x] Maintenance Request form workflow (FORM-10-0975 Section 1)
- [x] Department Employee request submission and own-request tracking
- [x] QA Supervisor approve/reject step
- [x] Engineering/Maintenance accept/reject step
- [x] Technician preliminary findings and corrective actions sections
- [x] Hand-over confirmation fields with signature placeholders
- [x] Separate linked Maintenance Request and Corrective Maintenance event entries
- [x] Shared Request / Report Number linking request and CM event
- [x] Corrective Maintenance Record log (LOG-00-0102-3) with fixed header and rows
- [x] CM log rollover to a new permanent record when the current log is full
- [x] Status history and audit logs for workflow transitions

Phase 3 intentionally does not include Spare Parts, real printing, or real electronic signatures.

---

## Next Phases Roadmap

### Phase 2 — Preventive Maintenance
- PM checklists per machine (configurable checklist points) — implemented
- PM record creation and filling — implemented
- Multi-column PM record layout with chained records — implemented
- Annual and Monthly Maintenance Plans — implemented

### Phase 3 — Corrective Maintenance
- Maintenance Request form (Department → QA → Engineering workflow) — implemented
- QA Supervisor approval with signature placeholder — implemented
- Corrective Maintenance Record (work performed, fixed log rows) — implemented
- Machine handover workflow — implemented
=======
## Next Phases Roadmap

### Phase 2 — Preventive Maintenance
- PM checklists per machine (configurable checklist points)
- PM record creation and filling
- Multi-column PM record layout with auto-pagination
- Annual and Monthly Maintenance Plans

### Phase 3 — Corrective Maintenance
- Maintenance Request form (Department → QA → Engineering workflow)
- QA Supervisor approval with signature
- Corrective Maintenance Record (work performed, parts used)
- Machine handover workflow
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939

### Phase 4 — Spare Parts Module
- Spare parts catalogue
- Stock in/out tracking per machine
- Low-stock alerts

### Phase 5 — Printing & Signatures
- Electronic signatures (Examiner + Machine Receiver)
- Print-ready PDF generation for all forms
- Signature eligibility (Admin-assigned per user)

---

## Repository Structure

```
artifacts/
  api-server/       — Express API server
  cmms/             — React frontend
lib/
  api-spec/         — OpenAPI spec (source of truth)
  api-client-react/ — Generated React Query hooks
  api-zod/          — Generated Zod validation schemas
  db/               — Drizzle ORM schema + database connection
scripts/            — Utility scripts
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET | /api/users | List users |
| POST | /api/users | Create user |
| PUT | /api/users/:id | Update user |
| PATCH | /api/users/:id/deactivate | Deactivate user |
| PUT | /api/users/:id/permissions | Set user permissions |
| GET | /api/roles | List roles |
| GET | /api/permissions | List permissions |
| GET | /api/departments | List departments |
| GET | /api/machines | List machines (+ search) |
| POST | /api/machines | Create machine |
| GET | /api/machines/:id | Get machine |
| PUT | /api/machines/:id | Update machine |
| PATCH | /api/machines/:id/soft-delete | Soft delete machine |
| GET | /api/machines/:id/equipment-information | Get EIR |
| PUT | /api/machines/:id/equipment-information | Save EIR |
<<<<<<< HEAD
| GET | /api/machines/:id/pm/header | Get PM header |
| PUT | /api/machines/:id/pm/header | Update PM header |
| GET | /api/machines/:id/pm/checklist | List PM checklist points |
| POST | /api/machines/:id/pm/checklist | Create PM checklist point |
| PUT | /api/machines/:id/pm/checklist/:pointId | Update PM checklist point |
| PATCH | /api/machines/:id/pm/checklist/:pointId | Soft-remove PM checklist point |
| GET | /api/machines/:id/pm/current | Get current PM record |
| POST | /api/machines/:id/pm/inspections | Add PM inspection |
| GET | /api/machines/:id/pm/history | List PM record history |
| GET | /api/maintenance-plans/annual/:year | Get/generate annual PM plan |
| PUT | /api/maintenance-plans/annual/:year | Update annual PM plan |
| GET | /api/maintenance-plans/monthly/:year/:month | Get/generate monthly PM plan |
| PUT | /api/maintenance-plans/monthly/:year/:month | Update monthly PM plan |
| GET | /api/maintenance-requests | List visible maintenance requests |
| POST | /api/maintenance-requests | Submit maintenance request |
| GET | /api/maintenance-requests/machines | Machine picker for request submission |
| GET | /api/maintenance-requests/technicians | Technician picker for engineering assignment |
| GET | /api/maintenance-requests/:id | Get maintenance request detail |
| GET | /api/maintenance-requests/by-number/:requestNumber | Open linked request by report number |
| PATCH | /api/maintenance-requests/:id/qa-review | QA approve/reject request |
| PATCH | /api/maintenance-requests/:id/engineering-review | Engineering accept/reject request |
| PATCH | /api/maintenance-requests/:id/assign-technician | Update assigned technician |
| PATCH | /api/maintenance-requests/:id/start-work | Start accepted corrective maintenance work |
| PATCH | /api/maintenance-requests/:id/preliminary-findings | Save preliminary findings |
| PATCH | /api/maintenance-requests/:id/actions-taken | Save corrective maintenance actions |
| PATCH | /api/maintenance-requests/:id/handover | Save hand-over confirmation and close request |
| GET | /api/machines/:id/corrective-maintenance | Get active CM log |
| GET | /api/machines/:id/corrective-maintenance/history | Get CM log history |
=======
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
| GET | /api/dashboard/stats | Dashboard statistics |
