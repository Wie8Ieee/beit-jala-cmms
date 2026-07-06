---
name: CMMS Phase 1 Architecture
description: Key patterns and decisions for the Beit Jala Pharmaceutical CMMS monorepo.
---

# CMMS Phase 1 Architecture

## Stack
- Frontend: React 19 + Vite (artifacts/cmms, preview path `/`)
- Backend: Express 5 (artifacts/api-server, port from $PORT env)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Auth: express-session + bcrypt + connect-pg-simple
- Codegen: Orval from lib/api-spec/openapi.yaml → lib/api-client-react + lib/api-zod

## Critical patterns

### 1. API hooks always need `credentials: 'include'`
The custom-fetch.ts in lib/api-client-react/src/ must include `credentials: "include"` as the default in the fetch() call so session cookies are sent. Without this, all auth calls return 401.

**Why:** Session cookies are httpOnly; the browser only sends them if credentials mode is 'include'.

**How to apply:** Already done. If regenerating or replacing custom-fetch.ts, always ensure this.

### 2. OpenAPI-first workflow
1. Edit lib/api-spec/openapi.yaml
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Never edit lib/api-client-react/src/generated/ or lib/api-zod/src/generated/ by hand

### 3. Auth middleware in lib/auth.ts
- `requireAuth` — checks session only (fast)
- `requirePermission(perm)` — checks session permissions (fast, use for most routes)
- `requireActiveAuth` — hits DB to verify user is still active (use for sensitive operations)
- `parseIdParam(val)` — safely parse route :id param (handles string | string[])

## Phase 1 complete features
- Roles: Admin, Maintenance Supervisor, Maintenance Technician, Department Employee, QA Supervisor
- 18 permissions (8 active in Phase 1, 10 placeholder for future phases)
- Sessions stored in PostgreSQL `sessions` table (must be created manually)
- All machines support soft-delete (deletedAt column)
- Equipment Information Record is 1:1 per machine (upsert endpoint)
- Audit logs table exists but is not wired to routes yet (Phase 2+)
