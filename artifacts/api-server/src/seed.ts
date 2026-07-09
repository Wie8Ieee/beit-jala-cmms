import { db, pool } from "@workspace/db";
import {
  annualPmPlanRowsTable,
  annualPmPlansTable,
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceHandoverTable,
  correctiveMaintenanceRecordsTable,
  correctiveMaintenanceStaffTable,
  departmentsTable,
  eligibleSignerAssignmentsTable,
  equipmentInformationTable,
  formHeadersTable,
  maintenanceRequestsTable,
  maintenanceRequestStatusHistoryTable,
  machinesTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  notificationsTable,
  permissionsTable,
  pmChecklistPointsTable,
  rolesTable,
  signaturesTable,
  sparePartMovementsTable,
  sparePartsTable,
  userPermissionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcrypt";

const today = new Date().toISOString().slice(0, 10);

async function upsertRole(name: string, description: string) {
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.name, name));
  if (existing) return existing;
  const [created] = await db.insert(rolesTable).values({ name, description }).returning();
  return created!;
}

async function upsertPermission(name: string, description: string) {
  const [existing] = await db.select().from(permissionsTable).where(eq(permissionsTable.name, name));
  if (existing) return existing;
  const [created] = await db.insert(permissionsTable).values({ name, description }).returning();
  return created!;
}

async function upsertDepartment(name: string) {
  const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.name, name));
  if (existing) return existing;
  const [created] = await db.insert(departmentsTable).values({ name }).returning();
  return created!;
}

async function upsertUser(input: {
  username: string;
  password: string;
  fullName: string;
  roleId: number;
  departmentId: number | null;
}) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, input.username));
  if (existing) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const [updated] = await db
      .update(usersTable)
      .set({
        passwordHash,
        fullName: input.fullName,
        roleId: input.roleId,
        departmentId: input.departmentId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return updated!;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [created] = await db
    .insert(usersTable)
    .values({
      username: input.username,
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      departmentId: input.departmentId,
      isActive: true,
    })
    .returning();
  return created!;
}

async function setUserPermissions(userId: number, permissionIds: number[]) {
  await db.delete(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
  if (permissionIds.length) {
    await db.insert(userPermissionsTable).values(permissionIds.map((permissionId) => ({ userId, permissionId })));
  }
}

async function upsertMachine(input: {
  machineNumber: string;
  machineName: string;
  departmentId: number;
  location: string;
  pmFrequencyMonths: number;
  pmStartDate: string;
}) {
  const [existing] = await db.select().from(machinesTable).where(eq(machinesTable.machineNumber, input.machineNumber));
  if (existing) {
    const [updated] = await db
      .update(machinesTable)
      .set({
        machineName: input.machineName,
        departmentId: input.departmentId,
        location: input.location,
        status: "active",
        pmFrequencyMonths: input.pmFrequencyMonths,
        pmStartDate: input.pmStartDate,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(machinesTable.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db.insert(machinesTable).values({ ...input, status: "active" }).returning();
  return created!;
}

async function upsertEquipmentInfo(machineId: number, values: typeof equipmentInformationTable.$inferInsert) {
  const [existing] = await db.select().from(equipmentInformationTable).where(eq(equipmentInformationTable.machineId, machineId));
  if (existing) {
    await db.update(equipmentInformationTable).set({ ...values, updatedAt: new Date() }).where(eq(equipmentInformationTable.id, existing.id));
    return;
  }
  await db.insert(equipmentInformationTable).values(values);
}

async function upsertChecklistPoint(machineId: number, pointText: string, resultType: string, sortOrder: number) {
  const [existing] = await db
    .select()
    .from(pmChecklistPointsTable)
    .where(and(eq(pmChecklistPointsTable.machineId, machineId), eq(pmChecklistPointsTable.pointText, pointText)));
  if (existing) {
    await db
      .update(pmChecklistPointsTable)
      .set({ resultType, sortOrder, isActive: true, updatedAt: new Date() })
      .where(eq(pmChecklistPointsTable.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(pmChecklistPointsTable).values({ machineId, pointText, resultType, sortOrder }).returning();
  return created!;
}

async function upsertSparePart(input: typeof sparePartsTable.$inferInsert) {
  const [existing] = await db.select().from(sparePartsTable).where(eq(sparePartsTable.partCode, input.partCode));
  if (existing) {
    const [updated] = await db
      .update(sparePartsTable)
      .set({ ...input, deletedAt: null, updatedAt: new Date() })
      .where(eq(sparePartsTable.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db.insert(sparePartsTable).values(input).returning();
  return created!;
}

async function ensureInitialMovement(sparePartId: number, quantity: number, userId: number) {
  const [existing] = await db.select().from(sparePartMovementsTable).where(eq(sparePartMovementsTable.sparePartId, sparePartId));
  if (existing) return;
  await db.insert(sparePartMovementsTable).values({
    sparePartId,
    movementType: "IN",
    quantity,
    quantityBefore: 0,
    quantityAfter: quantity,
    movementDate: "2026-01-01",
    reason: "Initial demo stock",
    referenceType: "MANUAL",
    recordedByUserId: userId,
    notes: "Seeded initial stock movement",
  });
}

async function ensureFormHeader(input: typeof formHeadersTable.$inferInsert) {
  const [existing] = await db
    .select()
    .from(formHeadersTable)
    .where(and(eq(formHeadersTable.documentType, input.documentType), eq(formHeadersTable.documentId, input.documentId)));
  if (existing) {
    await db.update(formHeadersTable).set({ ...input, updatedAt: new Date() }).where(eq(formHeadersTable.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(formHeadersTable).values(input).returning();
  return created!;
}

async function ensureEligibleSigner(input: typeof eligibleSignerAssignmentsTable.$inferInsert) {
  const [existing] = await db
    .select()
    .from(eligibleSignerAssignmentsTable)
    .where(
      and(
        eq(eligibleSignerAssignmentsTable.documentType, input.documentType),
        eq(eligibleSignerAssignmentsTable.documentId, input.documentId),
        eq(eligibleSignerAssignmentsTable.fieldName, input.fieldName),
        eq(eligibleSignerAssignmentsTable.eligibleUserId, input.eligibleUserId),
      ),
    );
  if (existing) return existing;
  const [created] = await db.insert(eligibleSignerAssignmentsTable).values(input).returning();
  return created!;
}

async function seed() {
  console.log("Seeding CMMS database...");

  const roleData = [
    ["Admin", "Full system access"],
    ["Maintenance Supervisor", "Manages PM, CM, plans, and spare parts"],
    ["Maintenance Technician", "Executes and records maintenance work"],
    ["Department Employee", "Submits maintenance requests"],
    ["QA Supervisor", "Reviews submitted maintenance requests"],
    ["Engineering Manager", "Engineering management approval"],
    ["Production Manager", "Production management approval"],
    ["QC Manager", "QC management approval"],
    ["R&D Manager", "R&D management approval"],
    ["QA Manager", "QA management approval"],
  ] as const;
  const roles: Record<string, number> = {};
  for (const [name, description] of roleData) roles[name] = (await upsertRole(name, description)).id;

  const permissionData = [
    "view_dashboard",
    "manage_users",
    "view_machines",
    "create_machine",
    "edit_machine",
    "soft_delete_machine",
    "view_equipment_information",
    "edit_equipment_information",
    "manage_pm_checklist",
    "fill_pm_record",
    "view_pm_records",
    "view_maintenance_plans",
    "edit_maintenance_plans",
    "submit_maintenance_request",
    "view_own_requests",
    "qa_review_requests",
    "engineering_review_requests",
    "assign_technician",
    "fill_corrective_maintenance",
    "view_corrective_maintenance",
    "manage_maintenance_requests",
    "view_spare_parts",
    "manage_spare_parts",
    "record_spare_part_usage",
    "adjust_spare_parts",
    "edit_header",
    "print_forms",
    "manage_signatures",
    "sign_assigned_fields",
    "view_audit_logs",
    "review_qa_requests",
    "review_engineering_requests",
  ];
  const permissions: Record<string, number> = {};
  for (const name of permissionData) permissions[name] = (await upsertPermission(name, name.replaceAll("_", " "))).id;

  const departmentNames = ["Engineering & Maintenance", "Production", "QA", "QC", "R&D", "Warehouse"];
  const departments: Record<string, number> = {};
  for (const name of departmentNames) departments[name] = (await upsertDepartment(name)).id;

  const users = {
    admin: await upsertUser({ username: "admin", password: "admin123", fullName: "System Administrator", roleId: roles.Admin!, departmentId: departments["Engineering & Maintenance"]! }),
    supervisor: await upsertUser({ username: "supervisor", password: "supervisor123", fullName: "Maintenance Supervisor", roleId: roles["Maintenance Supervisor"]!, departmentId: departments["Engineering & Maintenance"]! }),
    technician: await upsertUser({ username: "technician", password: "technician123", fullName: "Maintenance Technician", roleId: roles["Maintenance Technician"]!, departmentId: departments["Engineering & Maintenance"]! }),
    employee: await upsertUser({ username: "employee", password: "employee123", fullName: "Department Employee", roleId: roles["Department Employee"]!, departmentId: departments.Production! }),
    qa: await upsertUser({ username: "qa", password: "qa123", fullName: "QA Supervisor", roleId: roles["QA Supervisor"]!, departmentId: departments.QA! }),
    engineeringManager: await upsertUser({ username: "engineering_manager", password: "manager123", fullName: "Engineering Manager", roleId: roles["Engineering Manager"]!, departmentId: departments["Engineering & Maintenance"]! }),
    productionManager: await upsertUser({ username: "production_manager", password: "manager123", fullName: "Production Manager", roleId: roles["Production Manager"]!, departmentId: departments.Production! }),
    qcManager: await upsertUser({ username: "qc_manager", password: "manager123", fullName: "QC Manager", roleId: roles["QC Manager"]!, departmentId: departments.QC! }),
    rdManager: await upsertUser({ username: "rd_manager", password: "manager123", fullName: "R&D Manager", roleId: roles["R&D Manager"]!, departmentId: departments["R&D"]! }),
    qaManager: await upsertUser({ username: "qa_manager", password: "manager123", fullName: "QA Manager", roleId: roles["QA Manager"]!, departmentId: departments.QA! }),
  };

  const ids = (names: string[]) => names.map((name) => permissions[name]).filter((id): id is number => id !== undefined);
  await setUserPermissions(users.admin.id, ids(permissionData));
  await setUserPermissions(users.supervisor.id, ids([
    "view_dashboard", "view_machines", "create_machine", "edit_machine", "view_equipment_information",
    "edit_equipment_information", "manage_pm_checklist", "fill_pm_record", "view_pm_records",
    "view_maintenance_plans", "edit_maintenance_plans", "engineering_review_requests",
    "review_engineering_requests", "assign_technician", "view_corrective_maintenance",
    "manage_maintenance_requests", "manage_spare_parts", "view_spare_parts", "record_spare_part_usage",
    "adjust_spare_parts", "print_forms", "sign_assigned_fields", "edit_header",
  ]));
  await setUserPermissions(users.technician.id, ids([
    "view_dashboard", "view_machines", "view_equipment_information", "fill_pm_record", "view_pm_records",
    "fill_corrective_maintenance", "view_corrective_maintenance", "sign_assigned_fields",
  ]));
  await setUserPermissions(users.employee.id, ids(["view_dashboard", "submit_maintenance_request", "view_own_requests", "sign_assigned_fields"]));
  await setUserPermissions(users.qa.id, ids(["view_dashboard", "qa_review_requests", "review_qa_requests", "sign_assigned_fields"]));
  for (const manager of [users.engineeringManager, users.productionManager, users.qcManager, users.rdManager, users.qaManager]) {
    await setUserPermissions(manager.id, ids(["view_dashboard", "view_maintenance_plans", "sign_assigned_fields"]));
  }

  const machineInputs = [
    ["MCH-001", "Tablet Compression Machine", "Production", "Production Hall A", 3, "2026-01-01"],
    ["MCH-002", "Coating Machine", "Production", "Production Hall B", 3, "2026-02-01"],
    ["MCH-003", "Water Purification Unit", "Engineering & Maintenance", "Utilities Room", 1, "2026-01-15"],
    ["MCH-004", "Packaging Line", "Production", "Packaging Area", 6, "2026-03-01"],
    ["MCH-005", "HVAC Unit", "Engineering & Maintenance", "Roof Area", 1, "2026-01-10"],
  ] as const;
  const machines: Record<string, typeof machinesTable.$inferSelect> = {};
  for (const [machineNumber, machineName, dept, location, pmFrequencyMonths, pmStartDate] of machineInputs) {
    machines[machineNumber] = await upsertMachine({ machineNumber, machineName, departmentId: departments[dept]!, location, pmFrequencyMonths, pmStartDate });
    await upsertEquipmentInfo(machines[machineNumber]!.id, {
      machineId: machines[machineNumber]!.id,
      nameOfEquipment: machineName,
      modelNumber: `MDL-${machineNumber.slice(-3)}`,
      serialNumber: `SN-${machineNumber.slice(-3)}-2026`,
      identificationNumber: machineNumber,
      datePurchased: "2024-06-01",
      purchasedFromName: "Demo Industrial Supplier",
      purchasedFromAddress: "Bethlehem Industrial Zone",
      manufacturingCompanyName: "Demo Pharma Equipment Co.",
      manufacturingCompanyAddress: "EU Manufacturing Site",
      dimensionWidthCm: "120",
      dimensionHeightCm: "180",
      dimensionDepthCm: "100",
      weightKg: "450",
      utilitiesPowerSupply: "220V / 380V",
      utilitiesAir: "Compressed air",
      utilitiesWater: machineName.includes("Water") ? "Purified water loop" : "N/A",
      utilitiesOther: "N/A",
      others: "Demo equipment information record",
      safetyIssues: "Follow lockout/tagout before maintenance",
      preparedByName: "Maintenance Supervisor",
      preparedByDate: "2026-01-01",
      approvedByName: "System Administrator",
      approvedByDate: "2026-01-02",
    });
  }

  const checklist: Record<string, Array<[string, string]>> = {
    "MCH-001": [
      ["Check main motor condition", "YES_NO"], ["Check compression force reading", "NUMERIC"],
      ["Inspect punches and dies", "YES_NO"], ["Check lubrication level", "YES_NO"],
      ["Record operating temperature", "NUMERIC"], ["Notes on abnormal noise", "TEXT"],
    ],
    "MCH-002": [
      ["Check spray nozzles", "YES_NO"], ["Record inlet air temperature", "NUMERIC"],
      ["Record exhaust air temperature", "NUMERIC"], ["Check drum rotation", "YES_NO"],
      ["Inspect filters", "YES_NO"], ["Cleaning notes", "TEXT"],
    ],
    "MCH-003": [
      ["Check pressure gauge", "NUMERIC"], ["Check conductivity reading", "NUMERIC"],
      ["Check filters condition", "YES_NO"], ["Check pump noise", "YES_NO"],
      ["Record maintenance notes", "TEXT"],
    ],
  };
  for (const [machineNumber, points] of Object.entries(checklist)) {
    for (const [index, [text, type]] of points.entries()) {
      await upsertChecklistPoint(machines[machineNumber]!.id, text, type, index + 1);
    }
  }

  const sparePartInputs = [
    ["SP-001", "Motor Bearing", "pcs", 5, 20, "Maintenance Store"],
    ["SP-002", "Filter Cartridge", "pcs", 10, 40, "Warehouse"],
    ["SP-003", "Spray Nozzle", "pcs", 6, 15, "Production Store"],
    ["SP-004", "Lubrication Oil", "liter", 20, 60, "Maintenance Store"],
    ["SP-005", "Belt Set", "set", 3, 8, "Warehouse"],
  ] as const;
  for (const [partCode, partName, unit, minimumQuantity, currentQuantity, location] of sparePartInputs) {
    const part = await upsertSparePart({
      partCode,
      partName,
      unit,
      minimumQuantity,
      currentQuantity,
      location,
      category: "Maintenance",
      description: `${partName} demo spare part`,
      status: "active",
    });
    await ensureInitialMovement(part.id, currentQuantity, users.supervisor.id);
  }
  const [bearing] = await db.select().from(sparePartsTable).where(eq(sparePartsTable.partCode, "SP-001"));
  if (bearing) {
    const [existingOut] = await db
      .select()
      .from(sparePartMovementsTable)
      .where(and(eq(sparePartMovementsTable.sparePartId, bearing.id), eq(sparePartMovementsTable.movementType, "OUT")));
    if (!existingOut) {
      await db.insert(sparePartMovementsTable).values({
        sparePartId: bearing.id,
        movementType: "OUT",
        quantity: 1,
        quantityBefore: bearing.currentQuantity,
        quantityAfter: bearing.currentQuantity - 1,
        movementDate: today,
        reason: "Manual maintenance demo usage",
        referenceType: "MANUAL",
        recordedByUserId: users.supervisor.id,
        notes: "Seeded stock-out demo",
      });
      await db.update(sparePartsTable).set({ currentQuantity: bearing.currentQuantity - 1, updatedAt: new Date() }).where(eq(sparePartsTable.id, bearing.id));
    }
  }

  const [annualPlan] = await db
    .insert(annualPmPlansTable)
    .values({ year: 2026, preparedByName: "Maintenance Supervisor", preparedByDate: "2026-01-01" })
    .onConflictDoUpdate({ target: annualPmPlansTable.year, set: { preparedByName: "Maintenance Supervisor", updatedAt: new Date() } })
    .returning();
  for (const machine of Object.values(machines)) {
    const [existing] = await db
      .select()
      .from(annualPmPlanRowsTable)
      .where(and(eq(annualPmPlanRowsTable.planId, annualPlan!.id), eq(annualPmPlanRowsTable.machineId, machine.id)));
    const row = {
      planId: annualPlan!.id,
      machineId: machine.id,
      department: Object.keys(departments).find((name) => departments[name] === machine.departmentId),
      machineName: machine.machineName,
      machineLocation: machine.location,
      machineCode: machine.machineNumber,
      frequencyMonths: machine.pmFrequencyMonths,
      duration: "2",
      startDate: machine.pmStartDate,
      finishDate: machine.pmStartDate,
      scheduledMonths: JSON.stringify([1, 4, 7, 10]),
      isOverride: false,
    };
    if (existing) await db.update(annualPmPlanRowsTable).set({ ...row, updatedAt: new Date() }).where(eq(annualPmPlanRowsTable.id, existing.id));
    else await db.insert(annualPmPlanRowsTable).values(row);
  }

  const currentMonth = new Date().getMonth() + 1;
  const [monthlyPlan] = await db
    .insert(monthlyPmPlansTable)
    .values({ year: 2026, month: currentMonth, preparedByName: "Maintenance Supervisor", preparedByDate: today })
    .onConflictDoUpdate({ target: [monthlyPmPlansTable.year, monthlyPmPlansTable.month], set: { preparedByName: "Maintenance Supervisor", updatedAt: new Date() } })
    .returning();
  const annualRows = await db.select().from(annualPmPlanRowsTable).where(eq(annualPmPlanRowsTable.planId, annualPlan!.id));
  for (const [index, row] of annualRows.slice(0, 3).entries()) {
    const [existing] = await db
      .select()
      .from(monthlyPmPlanRowsTable)
      .where(and(eq(monthlyPmPlanRowsTable.planId, monthlyPlan!.id), eq(monthlyPmPlanRowsTable.machineId, row.machineId)));
    const item = {
      planId: monthlyPlan!.id,
      annualPlanRowId: row.id,
      machineId: row.machineId,
      rowNumber: index + 1,
      departmentName: row.department,
      sectionName: row.department,
      machineName: row.machineName,
      identificationNumber: row.machineCode,
      plannedDateFrom: `2026-${String(currentMonth).padStart(2, "0")}-01`,
      plannedDateTo: `2026-${String(currentMonth).padStart(2, "0")}-07`,
      actualDate: index === 0 ? today : null,
      amendments: index === 0 ? "Completed during seed demo" : null,
      status: index === 0 ? "completed" : index === 1 ? "overdue" : "due",
    };
    if (existing) await db.update(monthlyPmPlanRowsTable).set({ ...item, updatedAt: new Date() }).where(eq(monthlyPmPlanRowsTable.id, existing.id));
    else await db.insert(monthlyPmPlanRowsTable).values(item);
  }

  const requestInputs = [
    ["MR-2026-001", "Pending QA Approval", machines["MCH-001"]!, users.employee.id, null],
    ["MR-2026-002", "Accepted", machines["MCH-002"]!, users.employee.id, users.technician.id],
    ["MR-2026-003", "Completed", machines["MCH-003"]!, users.employee.id, users.technician.id],
  ] as const;
  for (const [number, status, machine, requestedByUserId, technicianId] of requestInputs) {
    const [existing] = await db.select().from(maintenanceRequestsTable).where(eq(maintenanceRequestsTable.requestReportNumber, number));
    const payload = {
      requestReportNumber: number,
      machineId: machine.id,
      requestedByUserId,
      departmentId: departments.Production,
      departmentSection: "Production",
      priority: number === "MR-2026-001" ? "normal" : "urgent",
      machineName: machine.machineName,
      machineNumber: machine.machineNumber,
      requestDate: today,
      failureDescription: `Demo failure report for ${machine.machineName}`,
      departmentSupervisorName: "Production Manager",
      status,
      qaDecision: status === "Pending QA Approval" ? null : "approved",
      qaReviewedByUserId: status === "Pending QA Approval" ? null : users.qa.id,
      qaReviewedAt: status === "Pending QA Approval" ? null : new Date(),
      engineeringDecision: status === "Pending QA Approval" ? null : "accepted",
      engineeringReviewedByUserId: status === "Pending QA Approval" ? null : users.supervisor.id,
      engineeringReviewedAt: status === "Pending QA Approval" ? null : new Date(),
      assignedTechnicianUserId: technicianId,
      closedAt: status === "Completed" ? new Date() : null,
    };
    const request = existing
      ? (await db.update(maintenanceRequestsTable).set({ ...payload, updatedAt: new Date() }).where(eq(maintenanceRequestsTable.id, existing.id)).returning())[0]!
      : (await db.insert(maintenanceRequestsTable).values(payload).returning())[0]!;
    const [history] = await db.select().from(maintenanceRequestStatusHistoryTable).where(eq(maintenanceRequestStatusHistoryTable.requestId, request.id));
    if (!history) {
      await db.insert(maintenanceRequestStatusHistoryTable).values({ requestId: request.id, fromStatus: null, toStatus: status, changedByUserId: requestedByUserId, notes: "Seeded demo status" });
    }
    if (status === "Completed") {
      const [record] = await db.select().from(correctiveMaintenanceRecordsTable).where(eq(correctiveMaintenanceRecordsTable.machineId, machine.id));
      const cmRecord = record ?? (await db.insert(correctiveMaintenanceRecordsTable).values({
        machineId: machine.id,
        sequenceNumber: 1,
        executionDate: today,
        machineName: machine.machineName,
        machineNumber: machine.machineNumber,
        machineLocation: machine.location,
        startupDate: machine.pmStartDate,
        status: "closed",
      }).returning())[0]!;
      const [event] = await db.select().from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
      if (!event) {
        const createdEvent = (await db.insert(correctiveMaintenanceEventsTable).values({
          recordId: cmRecord.id,
          requestId: request.id,
          machineId: machine.id,
          requestReportNumber: request.requestReportNumber,
          rowNumber: 1,
          preliminaryCheckResults: "Demo preliminary inspection completed",
          expectedWorkTimeFrom: "09:00",
          expectedWorkTimeTo: "11:00",
          technicianName: "Maintenance Technician",
          actionsTaken: "Replaced worn filter and verified operation",
          remarksRecommendations: "Monitor next PM cycle",
          performingStaff: JSON.stringify([{ no: "1", name: "Maintenance Technician", signature: "placeholder" }]),
          receiverName: "Production Manager",
          handoverDate: today,
          completedByUserId: users.technician.id,
          completedAt: new Date(),
        }).returning())[0]!;
        await db.insert(correctiveMaintenanceStaffTable).values({ eventId: createdEvent.id, staffOrder: 1, staffName: "Maintenance Technician" });
        await db.insert(correctiveMaintenanceHandoverTable).values({ eventId: createdEvent.id, receiverName: "Production Manager", handoverDate: today, engineeringFinalConfirmation: "Seeded handover confirmation" });
      }
    }
  }

  await ensureFormHeader({ documentType: "EQUIPMENT_INFORMATION", documentId: machines["MCH-001"]!.id, documentName: "Equipment Information Record", documentNumber: "FORM-10-0118", effectiveOrExecutionDate: "2026-01-01", pageNumber: 1, totalPages: 1 });
  await ensureFormHeader({ documentType: "PM_RECORD", documentId: machines["MCH-001"]!.id, documentName: "Preventive Maintenance Record", documentNumber: "LOG-00-0102", effectiveOrExecutionDate: "2026-01-01", pageNumber: 1, totalPages: 1 });
  await ensureFormHeader({ documentType: "CM_RECORD", documentId: machines["MCH-001"]!.id, documentName: "Corrective Maintenance Record", documentNumber: "LOG-00-0102-3", effectiveOrExecutionDate: today, pageNumber: 1, totalPages: 1, machineName: machines["MCH-001"]!.machineName, machineNumber: machines["MCH-001"]!.machineNumber, machineLocation: machines["MCH-001"]!.location, startupDate: machines["MCH-001"]!.pmStartDate });

  await ensureEligibleSigner({ documentType: "EQUIPMENT_INFORMATION", documentId: machines["MCH-001"]!.id, fieldName: "approved_by", eligibleUserId: users.admin.id, grantedBy: users.admin.id });
  await ensureEligibleSigner({ documentType: "PM_RECORD", documentId: machines["MCH-001"]!.id, fieldName: "examiner", eligibleUserId: users.supervisor.id, grantedBy: users.admin.id });
  await ensureEligibleSigner({ documentType: "MAINTENANCE_REQUEST", documentId: 1, fieldName: "qa_supervisor_approval", eligibleUserId: users.qa.id, grantedBy: users.admin.id });
  for (const manager of [users.engineeringManager, users.productionManager, users.qcManager, users.rdManager, users.qaManager]) {
    await ensureEligibleSigner({ documentType: "ANNUAL_PLAN", documentId: annualPlan!.id, fieldName: `${manager.username}_approval`, eligibleUserId: manager.id, grantedBy: users.admin.id });
  }

  const [existingSignature] = await db.select().from(signaturesTable).where(and(eq(signaturesTable.documentType, "EQUIPMENT_INFORMATION"), eq(signaturesTable.documentId, machines["MCH-001"]!.id), eq(signaturesTable.fieldName, "approved_by")));
  if (!existingSignature) {
    const [assignment] = await db.select().from(eligibleSignerAssignmentsTable).where(and(eq(eligibleSignerAssignmentsTable.documentType, "EQUIPMENT_INFORMATION"), eq(eligibleSignerAssignmentsTable.documentId, machines["MCH-001"]!.id), eq(eligibleSignerAssignmentsTable.fieldName, "approved_by")));
    await db.insert(signaturesTable).values({ documentType: "EQUIPMENT_INFORMATION", documentId: machines["MCH-001"]!.id, fieldName: "approved_by", signatureType: "demo", userId: users.admin.id, userName: users.admin.fullName ?? users.admin.username, eligibleSignerAssignmentId: assignment?.id });
  }

  const [notification] = await db.select().from(notificationsTable).where(and(eq(notificationsTable.type, "MAINTENANCE_REQUEST"), eq(notificationsTable.relatedType, "maintenance_request"), eq(notificationsTable.relatedId, 1)));
  if (!notification) {
    await db.insert(notificationsTable).values({ roleId: roles["QA Supervisor"], type: "MAINTENANCE_REQUEST", title: "Pending QA Approval", message: "A seeded maintenance request is pending QA review.", relatedType: "maintenance_request", relatedId: 1 });
  }

  console.log("Seed complete.");
  console.log("Demo users: admin/admin123, supervisor/supervisor123, technician/technician123, employee/employee123, qa/qa123");
  await pool.end();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await pool.end();
  process.exit(1);
});
