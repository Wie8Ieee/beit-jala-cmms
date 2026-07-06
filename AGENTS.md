# AGENTS.md — Instructions for AI Coding Agents (Codex / Claude / GPT)

This is a CMMS (Computerized Maintenance Management System) graduation project for **Beit Jala Pharmaceutical Co.**, Engineering & Maintenance Department.

---

## Critical Rules

1. **Always follow the SRS requirements.** The SRS (Software Requirements Specification) is the authoritative source of truth. Do not invent workflows or modify the maintenance process described in it.

2. **Do not rebuild the project.** The Phase 1 foundation is complete. Build on top of it, not from scratch.

3. **Do not change the existing architecture** unless absolutely necessary and clearly justified. This is a pnpm monorepo with OpenAPI-first codegen — follow the same pattern.

4. **Do not remove official form fields.** The SRS references company forms (FORM-10-0118, FORM-10-0975, FORM-10-1025, FORM-10-0117). Every field on these forms must be preserved in the database and UI.

5. **Never overwrite or delete historical records.** PM records must chain (oldest to newest). CM records are permanent. Use soft-delete, not hard-delete.

6. **Work in phases.** Complete one phase before starting the next. Do not mix Phase 2 and Phase 3 work.

7. **Prefer small, focused changes.** One feature at a time. Test before moving on.

8. **Keep role-based permissions enforced** in both backend (middleware) and frontend (conditional rendering).

9. **Keep database migrations backwards-compatible** where possible. Use Drizzle schema push (`pnpm --filter @workspace/db run push`) for development.

10. **Update README.md** when adding a new module or phase.

---

## Architecture Overview

```
lib/api-spec/openapi.yaml          ← Single source of truth for API contracts
lib/api-client-react/src/generated/ ← Auto-generated React Query hooks (DO NOT EDIT)
lib/api-zod/src/generated/         ← Auto-generated Zod schemas (DO NOT EDIT)
lib/db/src/schema/                  ← Drizzle ORM table definitions
artifacts/api-server/src/routes/    ← Express route handlers
artifacts/cmms/src/                 ← React frontend
```

### OpenAPI-first workflow
1. Add endpoints to `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement backend routes in `artifacts/api-server/src/routes/`
4. Use generated hooks in the frontend from `@workspace/api-client-react`

### Adding a new module
1. Define DB schema in `lib/db/src/schema/`
2. Export from `lib/db/src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push`
4. Add endpoints to `lib/api-spec/openapi.yaml`
5. Run codegen
6. Implement routes
7. Build frontend pages using generated hooks

---

## Current Phase Status

### Phase 1 — COMPLETE
- Auth + sessions
- Roles + permissions
- User management
- Machines module
- Equipment Information Record (FORM-10-0118)

### Phase 2 — NOT STARTED
- Preventive Maintenance records and checklists
- Annual and Monthly Maintenance Plans

### Phase 3 — NOT STARTED
- Corrective Maintenance request workflow (FORM-10-0975)

### Phase 4 — NOT STARTED
- Spare Parts module

### Phase 5 — NOT STARTED
- Electronic signatures and printing

---

## Database Tables (Phase 1)

- `roles` — system roles (Admin, Maintenance Supervisor, etc.)
- `permissions` — individual permission records
- `departments` — company departments
- `users` — user accounts with role assignment
- `user_permissions` — many-to-many user ↔ permission assignments
- `machines` — equipment inventory with soft-delete
- `equipment_information_records` — FORM-10-0118 per machine (1:1)
- `audit_logs` — action tracking (ready for future use)
- `sessions` — express-session persistence

---

## Test Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| supervisor | supervisor123 | Maintenance Supervisor |
| technician | technician123 | Maintenance Technician |
| employee | employee123 | Department Employee |
| qa | qa123 | QA Supervisor |

---

## Permissions Reference

Core permissions (Phase 1):
- `view_dashboard`, `manage_users`
- `view_machines`, `create_machine`, `edit_machine`, `soft_delete_machine`
- `view_equipment_information`, `edit_equipment_information`

Placeholder permissions (Phase 2+):
- `submit_maintenance_request_placeholder`, `view_own_requests_placeholder`
- `manage_pm_checklist_placeholder`, `fill_pm_record_placeholder`
- `approve_qa_request_placeholder`
- `manage_spare_parts_placeholder`, `view_maintenance_plans_placeholder`
- `edit_header_placeholder`, `print_forms_placeholder`, `manage_signatures_placeholder`

---

## Do Not Commit

- `.env` files
- `node_modules/`
- `dist/` or `build/` directories
- Any real passwords (only demo seed credentials)
- Database dumps with real data
- API keys or credentials

---

## Code Style

- TypeScript everywhere (strict mode)
- Use `req.log` for logging in route handlers (never `console.log`)
- Use Drizzle ORM for all database operations (no raw SQL except migrations)
- Use Zod schemas from `@workspace/api-zod` for request validation
- Format with Prettier before committing
