import { Router } from "express";
import { db } from "@workspace/db";
import {
  annualPmPlanRowsTable,
  annualPmPlansTable,
  departmentsTable,
  machinesTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  pmInspectionsTable,
  formHeadersTable,
  auditLogsTable,
  signatureFieldPermissionsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { requireAnyPermission, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(value: string | string[] | undefined) {
  return Number.parseInt(firstParam(value) ?? "", 10);
}

function parseMonth(value: string | string[] | undefined) {
  return Number.parseInt(firstParam(value) ?? "", 10);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function scheduledMonths(startDate: string | null, frequency: number | null, year = new Date().getFullYear()) {
  if (!startDate || !frequency || frequency < 1) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return [];
  const months: number[] = [];
  const cursor = new Date(start);
  while (cursor.getUTCFullYear() < year) cursor.setUTCMonth(cursor.getUTCMonth() + frequency);
  while (cursor.getUTCFullYear() === year) {
    months.push(cursor.getUTCMonth() + 1);
    cursor.setUTCMonth(cursor.getUTCMonth() + frequency);
  }
  return months;
}

function parseMonths(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((month): month is number => typeof month === "number")
      : [];
  } catch {
    return [];
  }
}

// When a scheduled activity is postponed (or brought forward), every
// following occurrence must move by the same amount. This keeps the PM
// frequency intact instead of merely adding a one-off row to another month.
function shiftScheduledMonths(
  months: number[],
  sourceMonth: number,
  targetMonth: number,
) {
  const shift = targetMonth - sourceMonth;
  return [...new Set(months.map((scheduledMonth) =>
    scheduledMonth < sourceMonth ? scheduledMonth : scheduledMonth + shift,
  ))]
    .filter((scheduledMonth) => scheduledMonth >= 1 && scheduledMonth <= 12)
    .sort((left, right) => left - right);
}

async function getMachineWithDept(machineId: number) {
  const [machine] = await db
    .select({
      id: machinesTable.id,
      machineName: machinesTable.machineName,
      machineNumber: machinesTable.machineNumber,
      deletedAt: machinesTable.deletedAt,
      departmentName: departmentsTable.name,
    })
    .from(machinesTable)
    .leftJoin(
      departmentsTable,
      eq(machinesTable.departmentId, departmentsTable.id),
    )
    .where(eq(machinesTable.id, machineId));

  return machine ?? null;
}

const MONTHLY_PLAN_HEADER_ID = 0;
const ANNUAL_PLAN_HEADER_ID = 0;

async function getMonthlyPlanHeader() {
  const [existing] = await db
    .select()
    .from(formHeadersTable)
    .where(
      and(
        eq(formHeadersTable.documentType, "MONTHLY_PM_PLAN"),
        eq(formHeadersTable.documentId, MONTHLY_PLAN_HEADER_ID),
      ),
    );
  if (existing) return existing;
  const [created] = await db
    .insert(formHeadersTable)
    .values({
      documentType: "MONTHLY_PM_PLAN",
      documentId: MONTHLY_PLAN_HEADER_ID,
      companyName: "Beit Jala Pharmaceutical Co.",
      documentName: "Monthly Preventive Maintenance Program",
      documentNumber: "FORM-10-0117-3",
      effectiveOrExecutionDate: "18/3/2023",
      pageNumber: 1,
      totalPages: 1,
    })
    .returning();
  return created!;
}

// FORM-10-1025-0 has one controlled header shared by every annual plan year.
// Keeping it separate from the plan rows lets authorised users update the
// document details once without changing any historical plan data.
async function getAnnualPlanHeader() {
  const [existing] = await db
    .select()
    .from(formHeadersTable)
    .where(
      and(
        eq(formHeadersTable.documentType, "ANNUAL_PM_PLAN"),
        eq(formHeadersTable.documentId, ANNUAL_PLAN_HEADER_ID),
      ),
    );
  if (existing) return existing;

  const [created] = await db
    .insert(formHeadersTable)
    .values({
      documentType: "ANNUAL_PM_PLAN",
      documentId: ANNUAL_PLAN_HEADER_ID,
      companyName: "Beit Jala Pharmaceutical Co.",
      documentName: "Preventive Maintenance Plan",
      documentNumber: "FORM-10-1025-0",
      effectiveOrExecutionDate: "18/3/2023",
      pageNumber: 1,
      totalPages: 1,
    })
    .returning();
  return created!;
}

function formatAnnualRow(row: typeof annualPmPlanRowsTable.$inferSelect) {
  return {
    ...row,
    scheduledMonths: parseMonths(row.scheduledMonths),
  };
}

function formatAnnual(
  plan: typeof annualPmPlansTable.$inferSelect,
  rows: Array<typeof annualPmPlanRowsTable.$inferSelect>,
) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    rows: rows.map(formatAnnualRow),
  };
}

function formatMonthly(
  plan: typeof monthlyPmPlansTable.$inferSelect,
  rows: Array<typeof monthlyPmPlanRowsTable.$inferSelect>,
) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    rows: rows.filter((row) => !row.isManuallyRemoved),
  };
}

async function getOrCreateAnnualPlan(year: number) {
  const [existing] = await db
    .select()
    .from(annualPmPlansTable)
    .where(eq(annualPmPlansTable.year, year));
  const plan = existing ?? (await db.insert(annualPmPlansTable).values({ year }).returning())[0]!;
  const machines = await db
    .select({
      id: machinesTable.id,
      machineName: machinesTable.machineName,
      machineNumber: machinesTable.machineNumber,
      location: machinesTable.location,
      pmFrequencyMonths: machinesTable.pmFrequencyMonths,
      pmStartDate: machinesTable.pmStartDate,
      departmentName: departmentsTable.name,
    })
    .from(machinesTable)
    .leftJoin(
      departmentsTable,
      eq(machinesTable.departmentId, departmentsTable.id),
    )
    .where(isNull(machinesTable.deletedAt))
    .orderBy(asc(machinesTable.machineName));

  const existingRows = await db.select().from(annualPmPlanRowsTable).where(eq(annualPmPlanRowsTable.planId, plan.id));
  const existingByMachine = new Map(existingRows.map((row) => [row.machineId, row]));
  for (const machine of machines.filter((item) => item.pmFrequencyMonths && item.pmStartDate)) {
    const values = {
      planId: plan.id,
      machineId: machine.id,
      department: machine.departmentName ?? null,
      machineName: machine.machineName,
      machineLocation: machine.location ?? null,
      machineCode: machine.machineNumber,
      frequencyMonths: machine.pmFrequencyMonths,
      duration: "",
      startDate: machine.pmStartDate,
      finishDate: machine.pmStartDate,
      scheduledMonths: JSON.stringify(
        scheduledMonths(machine.pmStartDate, machine.pmFrequencyMonths, year),
      ),
    };
    const current = existingByMachine.get(machine.id);
    if (!current) await db.insert(annualPmPlanRowsTable).values(values);
    else if (!current.isOverride) await db.update(annualPmPlanRowsTable).set(values).where(eq(annualPmPlanRowsTable.id, current.id));
  }
  return plan;
}

async function getAnnualRows(planId: number) {
  return db
    .select()
    .from(annualPmPlanRowsTable)
    .where(eq(annualPmPlanRowsTable.planId, planId))
    .orderBy(
      asc(annualPmPlanRowsTable.department),
      asc(annualPmPlanRowsTable.machineName),
    );
}

async function getOrCreateMonthlyPlan(year: number, month: number) {
  const [existing] = await db
    .select()
    .from(monthlyPmPlansTable)
    .where(
      and(
        eq(monthlyPmPlansTable.year, year),
        eq(monthlyPmPlansTable.month, month),
      ),
    );
  const annual = await getOrCreateAnnualPlan(year);
  const annualRows = await getAnnualRows(annual.id);
  const plan = existing ?? (await db.insert(monthlyPmPlansTable).values({ year, month }).returning())[0]!;
  const currentRows = await db.select().from(monthlyPmPlanRowsTable).where(eq(monthlyPmPlanRowsTable.planId, plan.id));
  const currentByAnnualRow = new Map(currentRows.filter((row) => row.annualPlanRowId !== null).map((row) => [row.annualPlanRowId!, row]));
  const scheduledRows = annualRows.filter((row) => parseMonths(row.scheduledMonths).includes(month));
  for (const [index, row] of scheduledRows.entries()) {
      const plannedDate =
        row.startDate && new Date(row.startDate).getMonth() + 1 === month
          ? row.startDate
          : toIsoDate(new Date(Date.UTC(year, month - 1, 1)));
      const values = {
        planId: plan.id,
        annualPlanRowId: row.id,
        machineId: row.machineId,
        rowNumber: index + 1,
        departmentName: row.department,
        sectionName: row.department,
        machineName: row.machineName,
        identificationNumber: row.machineCode,
        plannedDateFrom: plannedDate,
        plannedDateTo: plannedDate,
        status: "due",
      };
      const current = currentByAnnualRow.get(row.id);
      if (!current) await db.insert(monthlyPmPlanRowsTable).values(values);
      else await db.update(monthlyPmPlanRowsTable).set({
        departmentName: values.departmentName,
        sectionName: values.sectionName,
        machineName: values.machineName,
        identificationNumber: values.identificationNumber,
        ...(!current.actualDate && !current.plannedDateIsOverride
          ? { plannedDateFrom: plannedDate, plannedDateTo: plannedDate }
          : {}),
      }).where(eq(monthlyPmPlanRowsTable.id, current.id));
  }
  const scheduledIds = new Set(scheduledRows.map((row) => row.id));
  for (const row of currentRows) {
    if (row.annualPlanRowId !== null && !scheduledIds.has(row.annualPlanRowId) && !row.actualDate) {
      await db.delete(monthlyPmPlanRowsTable).where(eq(monthlyPmPlanRowsTable.id, row.id));
    }
  }
  const reordered = await db.select({ id: monthlyPmPlanRowsTable.id }).from(monthlyPmPlanRowsTable)
    .where(eq(monthlyPmPlanRowsTable.planId, plan.id)).orderBy(asc(monthlyPmPlanRowsTable.rowNumber));
  for (const [index, row] of reordered.entries()) await db.update(monthlyPmPlanRowsTable).set({ rowNumber: index + 1 }).where(eq(monthlyPmPlanRowsTable.id, row.id));
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
  const rowsToReconcile = await db.select().from(monthlyPmPlanRowsTable)
    .where(and(
      eq(monthlyPmPlanRowsTable.planId, plan.id),
      eq(monthlyPmPlanRowsTable.actualDateIsOverride, false),
      eq(monthlyPmPlanRowsTable.isManuallyRemoved, false),
    ));
  for (const row of rowsToReconcile) {
    const [savedInspection] = await db.select({ inspectionDate: pmInspectionsTable.inspectionDate })
      .from(pmInspectionsTable)
      .where(and(
        eq(pmInspectionsTable.machineId, row.machineId),
        gte(pmInspectionsTable.inspectionDate, monthStart),
        lte(pmInspectionsTable.inspectionDate, monthEnd),
      ))
      .orderBy(desc(pmInspectionsTable.inspectionDate), desc(pmInspectionsTable.id))
      .limit(1);
    await db.update(monthlyPmPlanRowsTable).set(savedInspection ? {
      actualDate: savedInspection.inspectionDate,
      actualDateIsOverride: false,
      status: "completed",
      updatedAt: new Date(),
    } : {
      actualDate: null,
      actualDateIsOverride: false,
      status: "due",
      updatedAt: new Date(),
    }).where(eq(monthlyPmPlanRowsTable.id, row.id));
  }
  return plan;
}

async function syncMonthlyPlansFromAnnual(year: number) {
  for (let month = 1; month <= 12; month += 1) await getOrCreateMonthlyPlan(year, month);
}

export async function syncAutomaticMaintenancePlans(year = new Date().getFullYear()) {
  await getOrCreateAnnualPlan(year);
  await syncMonthlyPlansFromAnnual(year);
}

router.get(
  "/monthly/header",
  requireAuth,
  requirePermission("view_monthly_maintenance_plan"),
  async (_req, res, next) => {
    try {
      res.json(await getMonthlyPlanHeader());
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/monthly/header",
  requireAuth,
  requirePermission("edit_monthly_maintenance_plan"),
  async (req, res, next) => {
    try {
      const current = await getMonthlyPlanHeader();
      const body = req.body as Partial<typeof formHeadersTable.$inferInsert>;
      const [saved] = await db
        .update(formHeadersTable)
        .set({
          companyName: body.companyName?.trim() || current.companyName,
          documentName: body.documentName?.trim() || current.documentName,
          documentNumber: body.documentNumber?.trim() || current.documentNumber,
          effectiveOrExecutionDate:
            body.effectiveOrExecutionDate?.trim() || null,
          pageNumber: Math.max(
            1,
            Number(body.pageNumber ?? current.pageNumber),
          ),
          totalPages: Math.max(
            1,
            Number(body.totalPages ?? current.totalPages),
          ),
          updatedAt: new Date(),
        })
        .where(eq(formHeadersTable.id, current.id))
        .returning();
      res.json(saved!);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/annual/header",
  requireAuth,
  requirePermission("view_annual_maintenance_plan"),
  async (_req, res, next) => {
    try {
      res.json(await getAnnualPlanHeader());
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/annual/header",
  requireAuth,
  requirePermission("edit_annual_maintenance_plan"),
  async (req, res, next) => {
    try {
      const current = await getAnnualPlanHeader();
      const body = req.body as Partial<typeof formHeadersTable.$inferInsert>;
      const [saved] = await db
        .update(formHeadersTable)
        .set({
          documentNumber: body.documentNumber?.trim() || current.documentNumber,
          effectiveOrExecutionDate:
            body.effectiveOrExecutionDate?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(formHeadersTable.id, current.id))
        .returning();
      res.json(saved!);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/annual/:year",
  requireAuth,
  requirePermission("view_annual_maintenance_plan"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      if (Number.isNaN(year)) {
        res.status(400).json({ error: "Invalid year" });
        return;
      }
      const plan = await getOrCreateAnnualPlan(year);
      res.json(formatAnnual(plan, await getAnnualRows(plan.id)));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/annual/:year",
  requireAuth,
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const plan = await getOrCreateAnnualPlan(year);
      const isAdmin = req.session.roleName === "Admin";
      const canEditSchedule = isAdmin || (req.session.permissions ?? []).includes("edit_annual_maintenance_plan");
      const signerPermissions = isAdmin ? [] : await db
        .select({ fieldName: signatureFieldPermissionsTable.fieldName })
        .from(signatureFieldPermissionsTable)
        .where(and(
          eq(signatureFieldPermissionsTable.documentType, "ANNUAL_PLAN"),
          eq(signatureFieldPermissionsTable.eligibleUserId, req.session.userId!),
          isNull(signatureFieldPermissionsTable.revokedAt),
        ));
      const allowedApprovalFields = new Set(signerPermissions.map((permission) => permission.fieldName));
      if (!isAdmin && !canEditSchedule && allowedApprovalFields.size === 0) {
        res.status(403).json({ error: "You are not allowed to edit this annual plan" });
        return;
      }
      const body = req.body as Record<string, unknown> & {
        rows?: Array<{
          id: number;
          startDate?: string;
          frequencyMonths?: number | null;
        }>;
      };
      const approvalFieldMap = {
        prepared_by: ["preparedByName", "preparedByDate"],
        engineering_manager: ["approvedEngineeringName", "approvedEngineeringDate"],
        production_manager: ["approvedProductionName", "approvedProductionDate"],
        qc_manager: ["approvedQcName", "approvedQcDate"],
        rd_manager: ["approvedRdName", "approvedRdDate"],
        qa_manager: ["approvedQaName", "approvedQaDate"],
      } as const;
      const approvalUpdates: Record<string, string | null | Date> = { updatedAt: new Date() };
      for (const [signatureField, planFields] of Object.entries(approvalFieldMap)) {
        if (!isAdmin && !allowedApprovalFields.has(signatureField)) continue;
        for (const planField of planFields) {
          approvalUpdates[planField] = (body[planField] as string | undefined) ?? null;
        }
      }
      const [updated] = await db
        .update(annualPmPlansTable)
        .set(approvalUpdates)
        .where(eq(annualPmPlansTable.id, plan.id))
        .returning();

      for (const row of body.rows ?? []) {
        if (!canEditSchedule) break;
        const frequencyMonths = Number(row.frequencyMonths);
        const validFrequency = Number.isInteger(frequencyMonths) && frequencyMonths > 0
          ? frequencyMonths
          : null;
        const startDate = row.startDate ?? null;
        const [currentRow] = await db
          .select()
          .from(annualPmPlanRowsTable)
          .where(and(eq(annualPmPlanRowsTable.id, row.id), eq(annualPmPlanRowsTable.planId, plan.id)));
        await db
          .update(annualPmPlanRowsTable)
          .set({
            // The plan only needs its start date and maintenance frequency.
            // Derive the scheduled months here so the stored plan cannot get
            // out of sync with the values shown in the annual form.
            duration: null,
            startDate,
            frequencyMonths: validFrequency,
            scheduledMonths: JSON.stringify(scheduledMonths(startDate, validFrequency, year)),
            isOverride: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(annualPmPlanRowsTable.id, row.id),
              eq(annualPmPlanRowsTable.planId, plan.id),
            ),
          );
        if (currentRow) {
          await db.insert(auditLogsTable).values({
            userId: req.session.userId ?? null,
            action: "annual_pm_schedule_updated",
            entityType: "machine",
            entityId: currentRow.machineId,
            oldValue: { frequencyMonths: currentRow.frequencyMonths, startDate: currentRow.startDate, scheduledMonths: parseMonths(currentRow.scheduledMonths) },
            newValue: { frequencyMonths: validFrequency, startDate, scheduledMonths: scheduledMonths(startDate, validFrequency, year) },
          });
        }
      }

      await syncMonthlyPlansFromAnnual(year);
      res.json(formatAnnual(updated!, await getAnnualRows(plan.id)));
    } catch (err) {
      next(err);
    }
  },
);

// Reschedules a machine from one monthly plan to another. When the source is
// part of the annual schedule, all following occurrences move by the same
// number of months so the PM frequency remains unchanged.
router.get(
  "/monthly/:year/:month/machine-options",
  requireAuth,
  requirePermission("edit_monthly_maintenance_plan"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ error: "Invalid year or month" });
        return;
      }
      const plan = await getOrCreateMonthlyPlan(year, month);
      const existingRows = await db
        .select({ machineId: monthlyPmPlanRowsTable.machineId })
        .from(monthlyPmPlanRowsTable)
        .where(and(eq(monthlyPmPlanRowsTable.planId, plan.id), eq(monthlyPmPlanRowsTable.isManuallyRemoved, false)));
      const existingIds = new Set(existingRows.map((row) => row.machineId));
      const machines = await db
        .select({
          id: machinesTable.id,
          machineName: machinesTable.machineName,
          machineNumber: machinesTable.machineNumber,
          departmentName: departmentsTable.name,
        })
        .from(machinesTable)
        .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
        .where(isNull(machinesTable.deletedAt))
        .orderBy(asc(machinesTable.machineName));
      res.json(machines.filter((machine) => !existingIds.has(machine.id)));
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/monthly/:year/:month/rows",
  requireAuth,
  requirePermission("edit_monthly_maintenance_plan"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      const body = req.body as {
        machineId?: unknown;
        plannedDateFrom?: string;
        plannedDateTo?: string;
        sourceYear?: number;
        sourceMonth?: number;
      };
      const machineId = Number(body.machineId);
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(machineId)
      ) {
        res.status(400).json({ error: "Invalid monthly plan row" });
        return;
      }

      const machine = await getMachineWithDept(machineId);
      if (!machine || machine.deletedAt) {
        res.status(404).json({ error: "Machine not found" });
        return;
      }

      const sourceYear = Number(body.sourceYear);
      const sourceMonth = Number(body.sourceMonth);
      const isReschedulingWithinYear =
        Number.isInteger(sourceYear) &&
        Number.isInteger(sourceMonth) &&
        sourceYear === year &&
        sourceMonth >= 1 &&
        sourceMonth <= 12 &&
        sourceMonth !== month;

      if (isReschedulingWithinYear) {
        const annual = await getOrCreateAnnualPlan(year);
        const [annualRow] = await db
          .select()
          .from(annualPmPlanRowsTable)
          .where(and(
            eq(annualPmPlanRowsTable.planId, annual.id),
            eq(annualPmPlanRowsTable.machineId, machine.id),
          ));

        if (annualRow) {
          const scheduled = parseMonths(annualRow.scheduledMonths);
          if (scheduled.includes(sourceMonth)) {
            await db
              .update(annualPmPlanRowsTable)
              .set({
                scheduledMonths: JSON.stringify(
                  shiftScheduledMonths(scheduled, sourceMonth, month),
                ),
                isOverride: true,
                updatedAt: new Date(),
              })
              .where(eq(annualPmPlanRowsTable.id, annualRow.id));
            await db.insert(auditLogsTable).values({
              userId: req.session.userId ?? null,
              action: "monthly_pm_schedule_rescheduled",
              entityType: "machine",
              entityId: machine.id,
              oldValue: { scheduledMonths: scheduled },
              newValue: { scheduledMonths: shiftScheduledMonths(scheduled, sourceMonth, month) },
            });
            await syncMonthlyPlansFromAnnual(year);
          }
        }
      }

      const plan = await getOrCreateMonthlyPlan(year, month);
      const [existingMachineRow] = await db
        .select()
        .from(monthlyPmPlanRowsTable)
        .where(
          and(
            eq(monthlyPmPlanRowsTable.planId, plan.id),
            eq(monthlyPmPlanRowsTable.machineId, machine.id),
          ),
        )
        .limit(1);
      const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`;
      if (existingMachineRow) {
        const [updatedRow] = await db
          .update(monthlyPmPlanRowsTable)
          .set({
            plannedDateFrom: body.plannedDateFrom || defaultDate,
            plannedDateTo:
              body.plannedDateTo || body.plannedDateFrom || defaultDate,
            isManuallyRemoved: false,
            updatedAt: new Date(),
          })
          .where(eq(monthlyPmPlanRowsTable.id, existingMachineRow.id))
          .returning();
        res.json(updatedRow!);
        return;
      }
      const existingRows = await db
        .select({ rowNumber: monthlyPmPlanRowsTable.rowNumber })
        .from(monthlyPmPlanRowsTable)
        .where(eq(monthlyPmPlanRowsTable.planId, plan.id));
      const nextRowNumber =
        Math.max(0, ...existingRows.map((row) => row.rowNumber)) + 1;
      const [created] = await db
        .insert(monthlyPmPlanRowsTable)
        .values({
          planId: plan.id,
          machineId: machine.id,
          rowNumber: nextRowNumber,
          departmentName: machine.departmentName,
          sectionName: machine.departmentName,
          machineName: machine.machineName,
          identificationNumber: machine.machineNumber,
          plannedDateFrom: body.plannedDateFrom || defaultDate,
          plannedDateTo:
            body.plannedDateTo || body.plannedDateFrom || defaultDate,
          status: "due",
        })
        .returning();
      res.status(201).json(created!);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/monthly/:year/:month",
  requireAuth,
  requirePermission("view_monthly_maintenance_plan"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        month < 1 ||
        month > 12
      ) {
        res.status(400).json({ error: "Invalid year or month" });
        return;
      }
      const plan = await getOrCreateMonthlyPlan(year, month);
      const rows = await db
        .select()
        .from(monthlyPmPlanRowsTable)
        .where(eq(monthlyPmPlanRowsTable.planId, plan.id))
        .orderBy(asc(monthlyPmPlanRowsTable.rowNumber));
      res.json(formatMonthly(plan, rows));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/monthly/:year/:month",
  requireAuth,
  requirePermission("edit_monthly_maintenance_plan"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      const plan = await getOrCreateMonthlyPlan(year, month);
      const permissions = req.session.permissions ?? [];
      const isAdmin = req.session.roleName === "Admin";
      const canEditHeader = isAdmin || permissions.includes("edit_monthly_maintenance_plan");
      const canEditRows = isAdmin || permissions.includes("edit_monthly_maintenance_plan");
      const body = req.body as Record<string, unknown> & {
        rows?: Array<{
          id: number;
          plannedDateFrom?: string;
          plannedDateTo?: string;
          actualDate?: string;
          amendments?: string;
          status?: string;
        }>;
      };
      let updatedPlan = plan;
      if (canEditHeader) {
        const [updated] = await db
        .update(monthlyPmPlansTable)
        .set({
          preparedByName: (body.preparedByName as string | undefined) ?? null,
          preparedByDate: (body.preparedByDate as string | undefined) ?? null,
          maintenanceSupervisorName:
            (body.maintenanceSupervisorName as string | undefined) ?? null,
          maintenanceSupervisorDate:
            (body.maintenanceSupervisorDate as string | undefined) ?? null,
          departmentManagerName:
            (body.departmentManagerName as string | undefined) ?? null,
          departmentManagerDate:
            (body.departmentManagerDate as string | undefined) ?? null,
          approvedByName: (body.approvedByName as string | undefined) ?? null,
          approvedByDate: (body.approvedByDate as string | undefined) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(monthlyPmPlansTable.id, plan.id))
        .returning();
        updatedPlan = updated!;
      }

      for (const row of canEditRows ? (body.rows ?? []) : []) {
        const [currentRow] = await db.select({
          machineId: monthlyPmPlanRowsTable.machineId,
          plannedDateFrom: monthlyPmPlanRowsTable.plannedDateFrom,
          plannedDateTo: monthlyPmPlanRowsTable.plannedDateTo,
          plannedDateIsOverride: monthlyPmPlanRowsTable.plannedDateIsOverride,
          actualDate: monthlyPmPlanRowsTable.actualDate,
          actualDateIsOverride: monthlyPmPlanRowsTable.actualDateIsOverride,
        }).from(monthlyPmPlanRowsTable).where(and(
          eq(monthlyPmPlanRowsTable.id, row.id),
          eq(monthlyPmPlanRowsTable.planId, plan.id),
        ));
        await db
          .update(monthlyPmPlanRowsTable)
          .set({
            plannedDateFrom: row.plannedDateFrom ?? null,
            plannedDateTo: row.plannedDateTo ?? null,
            plannedDateIsOverride: currentRow
              ? (row.plannedDateFrom ?? null) !== currentRow.plannedDateFrom
                || (row.plannedDateTo ?? null) !== currentRow.plannedDateTo
                || currentRow.plannedDateIsOverride
              : false,
            actualDate: row.actualDate ?? null,
            actualDateIsOverride: currentRow && (row.actualDate ?? null) !== currentRow.actualDate
              ? true
              : (currentRow?.actualDateIsOverride ?? false),
            amendments: row.amendments ?? null,
            status: row.actualDate ? "completed" : "due",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(monthlyPmPlanRowsTable.id, row.id),
              eq(monthlyPmPlanRowsTable.planId, plan.id),
            ),
          );
        if (currentRow) {
          await db.insert(auditLogsTable).values({
            userId: req.session.userId ?? null,
            action: "monthly_pm_plan_updated",
            entityType: "machine",
            entityId: currentRow.machineId,
            oldValue: { plannedDateFrom: currentRow.plannedDateFrom, plannedDateTo: currentRow.plannedDateTo, actualDate: currentRow.actualDate },
            newValue: { plannedDateFrom: row.plannedDateFrom ?? null, plannedDateTo: row.plannedDateTo ?? null, actualDate: row.actualDate ?? null },
          });
        }
      }

      const rows = await db
        .select()
        .from(monthlyPmPlanRowsTable)
        .where(eq(monthlyPmPlanRowsTable.planId, plan.id))
        .orderBy(asc(monthlyPmPlanRowsTable.rowNumber));
      res.json(formatMonthly(updatedPlan, rows));
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/monthly/:year/:month/rows/:rowId",
  requireAuth,
  requirePermission("delete_monthly_pm_plan_rows"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      const rowId = Number(firstParam(req.params.rowId));
      const plan = await getOrCreateMonthlyPlan(year, month);
      const [removed] = await db
        .update(monthlyPmPlanRowsTable)
        .set({ isManuallyRemoved: true, updatedAt: new Date() })
        .where(and(
          eq(monthlyPmPlanRowsTable.id, rowId),
          eq(monthlyPmPlanRowsTable.planId, plan.id),
        ))
        .returning({ id: monthlyPmPlanRowsTable.id });
      if (!removed) {
        res.status(404).json({ error: "Monthly plan row not found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
