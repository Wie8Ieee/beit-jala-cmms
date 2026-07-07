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
9. Open an official form, assign an eligible signer by user ID where needed, sign an eligible field, and confirm the signature shows signer name, timestamp, and immutable status.
10. Use the Print button on an official form and confirm navigation/buttons are hidden in the browser print view.

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
- Electronic signatures are only available to eligible signers and cannot be edited after signing.
- Revoking eligibility does not remove old signatures.
- Browser print views show official headers, form fields, tables, and signatures.

## Phase 5 Demo

1. Log in as `admin`.
2. Open an official form such as `/machines/1/equipment-information`.
3. In an unsigned Electronic Signature field, assign an eligible user ID.
4. Log in as that eligible user and open the same form.
5. Click **Sign** and confirm the field becomes immutable with signer name and timestamp.
6. Log in as a non-eligible user and confirm the Sign action is not available.
7. Log in as a user with `print_forms`, click **Print**, and confirm the print view hides app navigation/actions and shows the official form header.
