import { Router } from "express";
import { db } from "@workspace/db";
import {
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceRecordsTable,
  machinesTable,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { parseIdParam, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router({ mergeParams: true });

function parseStaff(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatEvent(event: typeof correctiveMaintenanceEventsTable.$inferSelect) {
  return {
    ...event,
    performingStaff: parseStaff(event.performingStaff),
    completedAt: event.completedAt ? event.completedAt.toISOString() : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

async function recordDetail(record: typeof correctiveMaintenanceRecordsTable.$inferSelect) {
  const events = await db
    .select()
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.recordId, record.id))
    .orderBy(asc(correctiveMaintenanceEventsTable.rowNumber));

  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    events: events.map(formatEvent),
  };
}

router.get("/", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const [machine] = await db.select({ id: machinesTable.id }).from(machinesTable).where(eq(machinesTable.id, machineId));
    if (!machine) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const [record] = await db
      .select()
      .from(correctiveMaintenanceRecordsTable)
      .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
      .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
      .limit(1);

    if (!record) {
      res.json(null);
      return;
    }

    res.json(await recordDetail(record));
  } catch (err) {
    next(err);
  }
});

router.get("/history", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const records = await db
      .select()
      .from(correctiveMaintenanceRecordsTable)
      .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
      .orderBy(asc(correctiveMaintenanceRecordsTable.sequenceNumber));
    res.json(await Promise.all(records.map(recordDetail)));
  } catch (err) {
    next(err);
  }
});

export default router;
