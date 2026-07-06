import { Router } from "express";
import { db } from "@workspace/db";
import {
  machinesTable,
  usersTable,
  departmentsTable,
} from "@workspace/db";
import { eq, isNull, count, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (_req, res) => {
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
  });
});

export default router;
