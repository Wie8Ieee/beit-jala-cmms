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

### Phase 2 — COMPLETE
- Preventive Maintenance records and checklists
- Annual and Monthly Maintenance Plans

### Phase 3 — COMPLETE
- Corrective Maintenance request workflow (FORM-10-0975)

### Phase 4 — COMPLETE
- Spare Parts module

### Phase 5 — COMPLETE
- Electronic signatures and printing

---

## Database Tables

- `roles` — system roles (Admin, Maintenance Supervisor, etc.)
- `permissions` — individual permission records
- `departments` — company departments
- `users` — user accounts with role assignment
- `user_permissions` — many-to-many user ↔ permission assignments
- `machines` — equipment inventory with soft-delete
- `equipment_information_records` — FORM-10-0118 per machine (1:1)
- `audit_logs` — action tracking (ready for future use)
- `sessions` — express-session persistence
- `pm_headers`, `pm_checklist_points`, `pm_records`, `pm_inspections`, `pm_inspection_results` — Preventive Maintenance records
- `annual_pm_plans`, `annual_pm_plan_rows`, `monthly_pm_plans`, `monthly_pm_plan_rows` — maintenance plans
- `maintenance_requests`, `maintenance_request_status_history`, `corrective_maintenance_records`, `corrective_maintenance_events` — Corrective Maintenance workflow
- `spare_parts`, `spare_part_movements` — Spare Parts stock management
- `eligible_signer_assignments`, `signatures`, `form_headers`, `notifications` — Phase 5 signatures, official headers, and support tables

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

Phase 2-5 permissions:
- `manage_pm_checklist`, `fill_pm_record`, `view_maintenance_plans`, `edit_maintenance_plans`, `edit_header`
- `submit_maintenance_request`, `view_own_requests`, `review_qa_requests`, `review_engineering_requests`, `fill_corrective_maintenance`, `manage_maintenance_requests`
- `view_spare_parts`, `manage_spare_parts`, `record_spare_part_usage`, `adjust_spare_parts`
- `print_forms`, `manage_signatures`, `sign_assigned_fields`

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
