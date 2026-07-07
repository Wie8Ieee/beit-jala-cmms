import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, pool } from "./index";
import {
  annualPmPlansTable,
  maintenanceRequestsTable,
  machinesTable,
  monthlyPmPlansTable,
  permissionsTable,
  pmChecklistPointsTable,
  rolesTable,
  sparePartsTable,
  usersTable,
} from "./schema";

async function tableCount(table: PgTable) {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

async function verify() {
  const checks = [
    ["users", await tableCount(usersTable), 10],
    ["roles", await tableCount(rolesTable), 10],
    ["permissions", await tableCount(permissionsTable), 30],
    ["machines", await tableCount(machinesTable), 5],
    ["PM checklist points", await tableCount(pmChecklistPointsTable), 17],
    ["spare parts", await tableCount(sparePartsTable), 5],
    ["maintenance requests", await tableCount(maintenanceRequestsTable), 3],
  ] as const;

  const [annualPlan] = await db.select().from(annualPmPlansTable).where(eq(annualPmPlansTable.year, 2026));
  const now = new Date();
  const [monthlyPlan] = await db
    .select()
    .from(monthlyPmPlansTable)
    .where(eq(monthlyPmPlansTable.year, 2026));

  let failed = false;
  for (const [label, actual, expectedMin] of checks) {
    const ok = actual >= expectedMin;
    failed ||= !ok;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} (expected >= ${expectedMin})`);
  }

  const annualOk = Boolean(annualPlan);
  const monthlyOk = Boolean(monthlyPlan);
  failed ||= !annualOk || !monthlyOk;
  console.log(`${annualOk ? "PASS" : "FAIL"} annual plan 2026 exists`);
  console.log(`${monthlyOk ? "PASS" : "FAIL"} monthly plan exists for seeded data (current month ${now.getMonth() + 1})`);

  await pool.end();
  if (failed) process.exit(1);
}

verify().catch(async (err) => {
  console.error("Verification failed:", err);
  await pool.end();
  process.exit(1);
});
