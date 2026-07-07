# SRS Traceability Matrix

Date: 2026-07-07

This matrix compares the implemented repository against the CMMS SRS feature groups and the phased project scope.

| SRS Area | Requirement Summary | Implementation Status | Evidence / Notes |
| --- | --- | --- | --- |
| Authentication and sessions | Users log in with role-based access. | Implemented | Session-based auth, demo users, protected routes, backend auth middleware. |
| Roles and permissions | Admin, Maintenance Supervisor, Maintenance Technician, Department Employee, QA Supervisor with scoped permissions. | Implemented | Roles, permissions, user-permission assignment, backend middleware, frontend conditional navigation/actions. |
| User management | Admin manages users and permissions. | Implemented | Admin user list/form and user permissions update flow. |
| Machines / equipment inventory | Create, view, edit, and soft-delete machines. | Implemented | Machines DB/API/UI with soft delete. |
| Equipment Information Record | FORM-10-0118 fields preserved and editable by authorized users. | Implemented | Equipment information DB/API/UI. |
| Preventive Maintenance checklist | Per-machine PM checklist points, configurable result type, inactive/soft removal. | Implemented | PM checklist DB/API/UI; inactive points preserve history. |
| Preventive Maintenance records | PM inspections are append-only; completed entries are not overwritten; records chain when column limit is reached. | Implemented | PM records, inspections, results, current/history screens. |
| PM header fields | Restricted header edit action, no CM-only machine-identifying fields in PM header. | Implemented | PM header route/page guarded by `edit_header`. |
| Annual Maintenance Plan | Annual plan generated from machine PM start date/frequency with editable schedule rows. | Implemented | Annual plan DB/API/UI, generated schedule rows and overrides. |
| Monthly Maintenance Plan | Monthly plan generated from annual plan rows with planned/actual/amendment/sign-off fields. | Implemented | Monthly plan DB/API/UI. Signature fields are placeholders only. |
| PM dashboard widgets | This week's PM, monthly completion, overdue PM, low-stock card where applicable. | Implemented | Dashboard route and UI widgets. |
| Maintenance Request workflow | Department Employee submits request for a machine; QA review before Engineering/Maintenance decision. | Implemented | Maintenance request DB/API/UI and status transitions. |
| Corrective Maintenance Report | Request and CM record are separate but linked by request/report number. | Implemented | CM record/event tables and machine CM history/detail links. |
| Corrective Maintenance status history | Status changes are recorded/audited. | Implemented | Request status history and audit logs for workflow changes. |
| CM fixed log rows | CM events append to fixed row slots; new records are created when full. | Implemented | CM event/record logic preserves old records. |
| CM hand-over fields | Technician/receiver/engineering hand-over fields preserved. | Implemented | CM detail form and DB fields. Signature values are placeholders only. |
| Spare Parts list and record | List all active parts; open record with part name, part code, quantity, movement history. | Implemented | Spare Parts DB/API/UI. |
| Spare Parts movements | Stock-in, stock-out, adjustment, append-only movement history, automatic current quantity. | Implemented | Movement transaction updates current quantity and records before/after values. |
| Spare Parts maintenance links | Stock-out can optionally reference PM record or CM request/record. | Implemented | Movement `referenceType` and `referenceId` fields. |
| Spare Parts permissions | Admin/Supervisor manage; Technician only if explicitly granted; Department Employee and QA excluded by default. | Implemented | `view_spare_parts`, `manage_spare_parts`, `record_spare_part_usage` permissions. |
| Electronic signatures | Real e-signatures, eligible signers, immutable signature records. | Not implemented | Phase 5 remaining. Current fields are plain placeholder text fields. |
| Printing / PDF | Real print views, print-ready official forms, PDF generation. | Not implemented | Phase 5 remaining. No validated official print/PDF workflow. |
| Official form headers polish | Final official headers for all forms. | Partially implemented | Some form numbers/headers exist; final Phase 5 official print/header work remains. |
| Historical data preservation | No hard deletion or overwriting of PM, CM, and spare part movement history. | Implemented | Soft delete/inactive patterns and append-only records. |
| Database deployment verification | Schema push against Replit PostgreSQL. | Blocked | `DATABASE_URL` is missing in the current shell. |
| Browser demo-user testing | Verify permissions and persistence through the UI. | Blocked | Requires working database and seeded demo users. |
