# Demo Script

Use the demo accounts from `README.md` to walk through the implemented CMMS phases.

## 1. Admin

1. Log in as `admin` / `admin123`.
2. Open Dashboard and confirm Machines, PM, CM, and Spare Parts cards/widgets are visible.
3. Open Machines and verify machine profile access.
4. Open Spare Parts.
5. Add a spare part with part name, part code, unit, minimum quantity, location, and status.
6. Open the spare part record and record a stock-in movement.
7. Record a stock-out movement with reference type `MANUAL`, `PM_RECORD`, or `CM_REQUEST`.
8. Confirm current quantity and movement history update without deleting older movements.

## 2. Maintenance Supervisor

1. Log in as `supervisor` / `supervisor123`.
2. Confirm access to Machines, PM checklists/plans, Corrective Maintenance, and Spare Parts.
3. Open Spare Parts and confirm create/edit, stock-in, stock-out, adjustment, and soft-delete actions are available.
4. Confirm low-stock spare parts appear on the dashboard when current quantity is at or below minimum quantity.

## 3. Maintenance Technician

1. Log in as `technician` / `technician123`.
2. Confirm PM and CM work screens are available according to assigned permissions.
3. Confirm Spare Parts does not appear unless `view_spare_parts` / `record_spare_part_usage` is explicitly granted.
4. If granted, verify technician can record stock-out usage only, not create parts or adjust inventory.

## 4. Department Employee

1. Log in as `employee` / `employee123`.
2. Confirm the employee can access maintenance request submission and own requests.
3. Confirm Machines, PM records, Maintenance Plans, and Spare Parts are not accessible.

## 5. QA Supervisor

1. Log in as `qa` / `qa123`.
2. Confirm QA request review access.
3. Confirm Spare Parts is not visible unless explicitly granted.

## Expected Evidence

- Historical PM inspections, CM records, and spare part movements remain append-only.
- Soft-deleted machines/checklist points/spare parts are not hard-deleted.
- Signature and approval fields remain visible fields/placeholders unless Phase 5 is implemented.
- Printing actions remain placeholders unless Phase 5 is implemented.
