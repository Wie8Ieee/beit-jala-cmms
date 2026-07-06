import { Router } from "express";
import { db } from "@workspace/db";
import {
  machinesTable,
  usersTable,
  departmentsTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  maintenanceRequestsTable,
} from "@workspace/db";
import { and, eq, isNull, count, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pmStatus(actualDate: string | null, plannedDateTo: string | null) {
  if (actualDate) return "Completed";
  if (plannedDateTo && plannedDateTo < isoDate(new Date())) return "Overdue";
  return "Due";
}

function currentWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - ((day + 1) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req, res) => {
  const [machineStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${machinesTable.deletedAt} is null and ${machinesTable.status} = 'active')`,
    })
    .from(machinesTable);

  const [userStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${usersTable.isActive} = true)`,
    })
    .from(usersTable);

  const [deptStats] = await db
    .select({ total: count() })
    .from(departmentsTable);

  // Machines by department
  const byDept = await db
    .select({
      label: departmentsTable.name,
      count: count(),
    })
    .from(machinesTable)
    .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
    .where(isNull(machinesTable.deletedAt))
    .groupBy(departmentsTable.name);

  // Machines by status
  const byStatus = await db
    .select({
      label: machinesTable.status,
      count: count(),
    })
    .from(machinesTable)
    .where(isNull(machinesTable.deletedAt))
    .groupBy(machinesTable.status);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const { start: weekStart, end: weekEnd } = currentWeekRange();
  const monthlyPmRows = await db
    .select({
      id: monthlyPmPlanRowsTable.id,
      machineId: monthlyPmPlanRowsTable.machineId,
      machineName: monthlyPmPlanRowsTable.machineName,
      machineNumber: monthlyPmPlanRowsTable.identificationNumber,
      plannedDateFrom: monthlyPmPlanRowsTable.plannedDateFrom,
      plannedDateTo: monthlyPmPlanRowsTable.plannedDateTo,
      actualDate: monthlyPmPlanRowsTable.actualDate,
    })
    .from(monthlyPmPlanRowsTable)
    .innerJoin(monthlyPmPlansTable, eq(monthlyPmPlanRowsTable.planId, monthlyPmPlansTable.id))
    .where(and(eq(monthlyPmPlansTable.year, currentYear), eq(monthlyPmPlansTable.month, currentMonth)));

  const thisWeekPm = monthlyPmRows
    .filter((row) => {
      const from = row.plannedDateFrom ?? "";
      const to = row.plannedDateTo ?? row.plannedDateFrom ?? "";
      return from <= weekEnd && to >= weekStart;
    })
    .map((row) => ({
      id: row.id,
      machineId: row.machineId,
      machineName: row.machineName,
      machineNumber: row.machineNumber ?? "",
      plannedDateFrom: row.plannedDateFrom,
      plannedDateTo: row.plannedDateTo,
      status: pmStatus(row.actualDate, row.plannedDateTo),
    }));

  const completedCount = monthlyPmRows.filter((row) => !!row.actualDate).length;
  const notCompletedCount = Math.max(0, monthlyPmRows.length - completedCount);

  const requestRows = await db.select().from(maintenanceRequestsTable);
  const currentUserId = req.session.userId;
  const requestSummary = {
    total: requestRows.length,
    completed: requestRows.filter((row) => row.status === "Completed" || row.status === "Closed").length,
    pendingQa: requestRows.filter((row) => row.status === "Pending QA Approval").length,
    pendingEngineering: requestRows.filter((row) => row.status === "QA Approved").length,
    acceptedOrInProgress: requestRows.filter((row) => row.status === "Accepted" || row.status === "In Progress").length,
    own: requestRows.filter((row) => row.requestedByUserId === currentUserId).length,
  };
  const requestNotifications = [
    ...(requestSummary.pendingQa
      ? [{ type: "qa", message: `${requestSummary.pendingQa} maintenance request(s) pending QA approval`, href: "/maintenance-requests/qa" }]
      : []),
    ...(requestSummary.pendingEngineering
      ? [{ type: "engineering", message: `${requestSummary.pendingEngineering} QA-approved request(s) pending engineering review`, href: "/maintenance-requests/engineering" }]
      : []),
  ];
  const recentRequests = requestRows
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      requestReportNumber: row.requestReportNumber,
      machineName: row.machineName,
      machineNumber: row.machineNumber,
      status: row.status,
      requestDate: row.requestDate,
    }));

  res.json({
    totalMachines: Number(machineStats?.total ?? 0),
    activeMachines: Number(machineStats?.active ?? 0),
    totalUsers: Number(userStats?.total ?? 0),
    activeUsers: Number(userStats?.active ?? 0),
    totalDepartments: Number(deptStats?.total ?? 0),
    machinesByDepartment: byDept.map((d) => ({
      label: d.label ?? "Unassigned",
      count: Number(d.count),
    })),
    machinesByStatus: byStatus.map((s) => ({
      label: s.label ?? "unknown",
      count: Number(s.count),
    })),
    thisWeekPm,
    monthlyPmCompletion: [
      { label: "Completed", count: completedCount },
      { label: "Overdue / Not Completed", count: notCompletedCount },
    ],
    maintenanceRequests: requestSummary,
    maintenanceRequestNotifications: requestNotifications,
    recentMaintenanceRequests: recentRequests,
  });
});

export default router;
