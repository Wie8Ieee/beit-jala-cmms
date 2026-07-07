import { Router } from "express";
import { db } from "@workspace/db";
import {
  annualPmPlanRowsTable,
  annualPmPlansTable,
  departmentsTable,
  machinesTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
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
    return Array.isArray(parsed) ? parsed.filter((month): month is number => typeof month === "number") : [];
  } catch {
    return [];
  }
}

function formatAnnualRow(row: typeof annualPmPlanRowsTable.$inferSelect) {
  return {
    ...row,
    scheduledMonths: parseMonths(row.scheduledMonths),
  };
}

function formatAnnual(plan: typeof annualPmPlansTable.$inferSelect, rows: Array<typeof annualPmPlanRowsTable.$inferSelect>) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    rows: rows.map(formatAnnualRow),
  };
}

function formatMonthly(plan: typeof monthlyPmPlansTable.$inferSelect, rows: Array<typeof monthlyPmPlanRowsTable.$inferSelect>) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    rows,
  };
}

async function getOrCreateAnnualPlan(year: number) {
  const [existing] = await db.select().from(annualPmPlansTable).where(eq(annualPmPlansTable.year, year));
  if (existing) return existing;

  const [plan] = await db.insert(annualPmPlansTable).values({ year }).returning();
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
    .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
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
      scheduledMonths: JSON.stringify(scheduledMonths(machine.pmStartDate, machine.pmFrequencyMonths)),
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
    .orderBy(asc(annualPmPlanRowsTable.department), asc(annualPmPlanRowsTable.machineName));
}

async function getOrCreateMonthlyPlan(year: number, month: number) {
  const [existing] = await db
    .select()
    .from(monthlyPmPlansTable)
    .where(and(eq(monthlyPmPlansTable.year, year), eq(monthlyPmPlansTable.month, month)));
  if (existing) return existing;

  const annual = await getOrCreateAnnualPlan(year);
  const annualRows = await getAnnualRows(annual.id);
  const [plan] = await db.insert(monthlyPmPlansTable).values({ year, month }).returning();
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

router.get("/annual/:year", requireAuth, requirePermission("view_maintenance_plans"), async (req, res, next) => {
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
});

router.put("/annual/:year", requireAuth, requirePermission("edit_maintenance_plans"), async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    const plan = await getOrCreateAnnualPlan(year);
    const body = req.body as Record<string, unknown> & {
      rows?: Array<{ id: number; duration?: string; startDate?: string; finishDate?: string; scheduledMonths?: number[] }>;
    };
    const [updated] = await db
      .update(annualPmPlansTable)
      .set({
        preparedByName: (body.preparedByName as string | undefined) ?? null,
        preparedByDate: (body.preparedByDate as string | undefined) ?? null,
        approvedEngineeringName: (body.approvedEngineeringName as string | undefined) ?? null,
        approvedEngineeringDate: (body.approvedEngineeringDate as string | undefined) ?? null,
        approvedProductionName: (body.approvedProductionName as string | undefined) ?? null,
        approvedProductionDate: (body.approvedProductionDate as string | undefined) ?? null,
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
        .where(and(eq(annualPmPlanRowsTable.id, row.id), eq(annualPmPlanRowsTable.planId, plan.id)));
    }

    res.json(formatAnnual(updated!, await getAnnualRows(plan.id)));
  } catch (err) {
    next(err);
  }
});

router.get("/monthly/:year/:month", requireAuth, requirePermission("view_maintenance_plans"), async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    const month = parseMonth(req.params.month);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
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
});

router.put("/monthly/:year/:month", requireAuth, requirePermission("edit_maintenance_plans"), async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    const month = parseMonth(req.params.month);
    const plan = await getOrCreateMonthlyPlan(year, month);
    const body = req.body as Record<string, unknown> & {
      rows?: Array<{ id: number; plannedDateFrom?: string; plannedDateTo?: string; actualDate?: string; amendments?: string; status?: string }>;
    };
    const [updated] = await db
      .update(monthlyPmPlansTable)
      .set({
        preparedByName: (body.preparedByName as string | undefined) ?? null,
        preparedByDate: (body.preparedByDate as string | undefined) ?? null,
        maintenanceSupervisorName: (body.maintenanceSupervisorName as string | undefined) ?? null,
        maintenanceSupervisorDate: (body.maintenanceSupervisorDate as string | undefined) ?? null,
        departmentManagerName: (body.departmentManagerName as string | undefined) ?? null,
        departmentManagerDate: (body.departmentManagerDate as string | undefined) ?? null,
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
          status: row.actualDate ? "completed" : row.status ?? "due",
          updatedAt: new Date(),
        })
        .where(and(eq(monthlyPmPlanRowsTable.id, row.id), eq(monthlyPmPlanRowsTable.planId, plan.id)));
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
});

export default router;
