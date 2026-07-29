import { Router } from "express";
import { db } from "@workspace/db";
import {
  annualPmPlanRowsTable,
  annualPmPlansTable,
  departmentsTable,
  machinesTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  formHeadersTable,
} from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireAuth, requirePermission } from "../lib/auth.js";

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

function scheduledMonths(startDate: string | null, frequency: number | null) {
  if (!startDate || !frequency || frequency < 1) return [];
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return [];
  const months: number[] = [];
  for (let month = start.getMonth() + 1; month <= 12; month += frequency) {
    months.push(month);
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
    rows,
  };
}

async function getOrCreateAnnualPlan(year: number) {
  const [existing] = await db
    .select()
    .from(annualPmPlansTable)
    .where(eq(annualPmPlansTable.year, year));
  if (existing) return existing;

  const [plan] = await db
    .insert(annualPmPlansTable)
    .values({ year })
    .returning();
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

  const rows = machines
    .filter((machine) => machine.pmFrequencyMonths && machine.pmStartDate)
    .map((machine) => ({
      planId: plan!.id,
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
        scheduledMonths(machine.pmStartDate, machine.pmFrequencyMonths),
      ),
    }));
  if (rows.length) {
    await db.insert(annualPmPlanRowsTable).values(rows);
  }
  return plan!;
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
  if (existing) return existing;

  const annual = await getOrCreateAnnualPlan(year);
  const annualRows = await getAnnualRows(annual.id);
  const [plan] = await db
    .insert(monthlyPmPlansTable)
    .values({ year, month })
    .returning();
  const rows = annualRows
    .filter((row) => parseMonths(row.scheduledMonths).includes(month))
    .map((row, index) => {
      const plannedDate =
        row.startDate && new Date(row.startDate).getMonth() + 1 === month
          ? row.startDate
          : toIsoDate(new Date(Date.UTC(year, month - 1, 1)));
      return {
        planId: plan!.id,
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
    });
  if (rows.length) {
    await db.insert(monthlyPmPlanRowsTable).values(rows);
  }
  return plan!;
}

router.get(
  "/monthly/header",
  requireAuth,
  requirePermission("view_maintenance_plans"),
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
  requirePermission("edit_header"),
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
  requirePermission("view_maintenance_plans"),
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
  requirePermission("edit_header"),
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
  requirePermission("view_maintenance_plans"),
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
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const plan = await getOrCreateAnnualPlan(year);
      const body = req.body as Record<string, unknown> & {
        rows?: Array<{
          id: number;
          duration?: string;
          startDate?: string;
          finishDate?: string;
          scheduledMonths?: number[];
        }>;
      };
      const [updated] = await db
        .update(annualPmPlansTable)
        .set({
          preparedByName: (body.preparedByName as string | undefined) ?? null,
          preparedByDate: (body.preparedByDate as string | undefined) ?? null,
          approvedEngineeringName:
            (body.approvedEngineeringName as string | undefined) ?? null,
          approvedEngineeringDate:
            (body.approvedEngineeringDate as string | undefined) ?? null,
          approvedProductionName:
            (body.approvedProductionName as string | undefined) ?? null,
          approvedProductionDate:
            (body.approvedProductionDate as string | undefined) ?? null,
          approvedQcName: (body.approvedQcName as string | undefined) ?? null,
          approvedQcDate: (body.approvedQcDate as string | undefined) ?? null,
          approvedRdName: (body.approvedRdName as string | undefined) ?? null,
          approvedRdDate: (body.approvedRdDate as string | undefined) ?? null,
          approvedQaName: (body.approvedQaName as string | undefined) ?? null,
          approvedQaDate: (body.approvedQaDate as string | undefined) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(annualPmPlansTable.id, plan.id))
        .returning();

      for (const row of body.rows ?? []) {
        await db
          .update(annualPmPlanRowsTable)
          .set({
            duration: row.duration ?? null,
            startDate: row.startDate ?? null,
            finishDate: row.finishDate ?? null,
            scheduledMonths: JSON.stringify(row.scheduledMonths ?? []),
            isOverride: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(annualPmPlanRowsTable.id, row.id),
              eq(annualPmPlanRowsTable.planId, plan.id),
            ),
          );
      }

      res.json(formatAnnual(updated!, await getAnnualRows(plan.id)));
    } catch (err) {
      next(err);
    }
  },
);

// Adds a machine to one monthly plan only. This is used for a PM activity
// carried over from another month and intentionally does not alter the annual
// plan or the source month.
router.post(
  "/monthly/:year/:month/rows",
  requireAuth,
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      const machineId = Number((req.body as { machineId?: unknown }).machineId);
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

      const plan = await getOrCreateMonthlyPlan(year, month);
      const existingRows = await db
        .select({ rowNumber: monthlyPmPlanRowsTable.rowNumber })
        .from(monthlyPmPlanRowsTable)
        .where(eq(monthlyPmPlanRowsTable.planId, plan.id));
      const nextRowNumber =
        Math.max(0, ...existingRows.map((row) => row.rowNumber)) + 1;
      const body = req.body as {
        plannedDateFrom?: string;
        plannedDateTo?: string;
      };
      const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`;
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
  requirePermission("view_maintenance_plans"),
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
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const year = parseYear(req.params.year);
      const month = parseMonth(req.params.month);
      const plan = await getOrCreateMonthlyPlan(year, month);
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

      for (const row of body.rows ?? []) {
        await db
          .update(monthlyPmPlanRowsTable)
          .set({
            plannedDateFrom: row.plannedDateFrom ?? null,
            plannedDateTo: row.plannedDateTo ?? null,
            actualDate: row.actualDate ?? null,
            amendments: row.amendments ?? null,
            status: row.actualDate ? "completed" : (row.status ?? "due"),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(monthlyPmPlanRowsTable.id, row.id),
              eq(monthlyPmPlanRowsTable.planId, plan.id),
            ),
          );
      }

      const rows = await db
        .select()
        .from(monthlyPmPlanRowsTable)
        .where(eq(monthlyPmPlanRowsTable.planId, plan.id))
        .orderBy(asc(monthlyPmPlanRowsTable.rowNumber));
      res.json(formatMonthly(updated!, rows));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
