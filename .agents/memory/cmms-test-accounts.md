---
name: CMMS test accounts
description: Seed credentials and permission assignments for Phase 1 demo users.
---

# CMMS Phase 1 Test Accounts

| Username | Password | Role | Key permissions |
|----------|----------|------|-----------------|
| admin | admin123 | Admin | all 18 permissions |
| supervisor | supervisor123 | Maintenance Supervisor | view/create/edit/delete machines, EIR edit, PM placeholders |
| technician | technician123 | Maintenance Technician | view machines, EIR view, PM fill placeholder |
| employee | employee123 | Department Employee | submit/view requests placeholders only |
| qa | qa123 | QA Supervisor | view_dashboard, approve_qa_request_placeholder |

## Seed script location
`artifacts/api-server/src/seed.ts`

Run with:
```bash
pnpm dlx tsx artifacts/api-server/src/seed.ts
```

The seed is idempotent — safe to re-run; existing records are updated, not duplicated.

## Sample machines seeded
- MCH-001: Tablet Compression Machine (Production)
- MCH-002: Coating Machine (Production)
- MCH-003: Water Purification Unit (Engineering & Maintenance)
- MCH-004: Packaging Line (Production)
