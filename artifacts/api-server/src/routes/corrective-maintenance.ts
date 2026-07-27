import { Router } from "express";
import { db } from "@workspace/db";
import {
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceRecordsTable,
  maintenanceRequestsTable,
  machinesTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { parseIdParam, requireAnyPermission, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router({ mergeParams: true });

function parseStaff(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRepairTimeSlots(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{ date?: string; from?: string; to?: string }>;
    return Array.isArray(parsed) ? parsed.slice(0, 5).map((slot) => ({ date: slot.date ?? "", from: slot.from ?? "", to: slot.to ?? "" })) : [];
  } catch {
    return [];
  }
}

function formatEvent(event: typeof correctiveMaintenanceEventsTable.$inferSelect) {
  return {
    ...event,
    performingStaff: parseStaff(event.performingStaff),
    repairTimeSlots: parseRepairTimeSlots(event.repairTimeSlots),
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
  const requestIds = events.map((event) => event.requestId).filter((requestId): requestId is number => requestId !== null);
  const requests = requestIds.length
    ? await db
        .select({
          id: maintenanceRequestsTable.id,
          requestDate: maintenanceRequestsTable.requestDate,
          priority: maintenanceRequestsTable.priority,
          expectedWorkTimeFrom: maintenanceRequestsTable.expectedWorkTimeFrom,
          expectedWorkTimeTo: maintenanceRequestsTable.expectedWorkTimeTo,
        })
        .from(maintenanceRequestsTable)
        .where(inArray(maintenanceRequestsTable.id, requestIds))
    : [];
  const requestById = new Map(requests.map((request) => [request.id, request]));

  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    events: events.map((event) => {
      const request = event.requestId ? requestById.get(event.requestId) : undefined;
      return {
        ...formatEvent(event),
        requestDate: event.requestDate ?? request?.requestDate ?? null,
        priority: event.maintenanceType ?? request?.priority ?? null,
        expectedWorkTimeFrom: event.expectedWorkTimeFrom ?? request?.expectedWorkTimeFrom ?? null,
        expectedWorkTimeTo: event.expectedWorkTimeTo ?? request?.expectedWorkTimeTo ?? null,
      };
    }),
  };
}

async function getRecordForNewEvent(machineId: number) {
  const [active] = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber)).limit(1);
  if (!active) return null;
  const [countResult] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.recordId, active.id));
  if (Number(countResult?.total ?? 0) < active.maxRows) return active;
  await db.update(correctiveMaintenanceRecordsTable).set({ status: "archived", updatedAt: new Date() }).where(eq(correctiveMaintenanceRecordsTable.id, active.id));
  const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
  if (!machine) return null;
  const [next] = await db.insert(correctiveMaintenanceRecordsTable).values({
    machineId,
    sequenceNumber: active.sequenceNumber + 1,
    previousRecordId: active.id,
    executionDate: new Date().toISOString().slice(0, 10),
    machineName: machine.machineName,
    machineNumber: machine.machineNumber,
    machineLocation: machine.location,
    startupDate: machine.pmStartDate,
  }).returning();
  return next!;
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

router.put("/header", requireAuth, requirePermission("edit_header"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const [record] = await db
      .select()
      .from(correctiveMaintenanceRecordsTable)
      .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
      .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "No active corrective maintenance record found for this machine" });
      return;
    }

    const body = req.body as {
      documentNumber?: string;
      executionDate?: string | null;
      pageCount?: string;
    };
    const [updated] = await db
      .update(correctiveMaintenanceRecordsTable)
      .set({
        documentNumber: body.documentNumber?.trim() || record.documentNumber,
        executionDate: body.executionDate?.trim() || null,
        pageCount: body.pageCount?.trim() || record.pageCount,
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceRecordsTable.id, record.id))
      .returning();

    res.json(await recordDetail(updated!));
  } catch (err) {
    next(err);
  }
});

router.put("/events/:eventId", requireAuth, requireAnyPermission(["fill_corrective_maintenance", "manage_maintenance_requests"]), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const eventId = parseIdParam(req.params.eventId);
    const [record] = await db
      .select()
      .from(correctiveMaintenanceRecordsTable)
      .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
      .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
      .limit(1);
    if (!record) {
      res.status(404).json({ error: "No active corrective maintenance record found" });
      return;
    }
    const [event] = await db
      .select()
      .from(correctiveMaintenanceEventsTable)
      .where(and(eq(correctiveMaintenanceEventsTable.id, eventId), eq(correctiveMaintenanceEventsTable.recordId, record.id)));
    if (!event) {
      res.status(404).json({ error: "Corrective maintenance row not found" });
      return;
    }
    const body = req.body as {
      requestReportNumber?: string | null;
      requestDate?: string | null;
      maintenanceType?: string | null;
      preliminaryCheckResults?: string | null;
      expectedWorkTimeFrom?: string | null;
      expectedWorkTimeTo?: string | null;
      repairTimeSlots?: Array<{ date?: string; from?: string; to?: string }>;
      actionsTaken?: string | null;
      technicianName?: string | null;
      sparePartsUsed?: string | null;
      receiverName?: string | null;
      handoverDate?: string | null;
    };
    const [updated] = await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        requestReportNumber: event.requestId ? event.requestReportNumber : body.requestReportNumber?.trim() || null,
        requestDate: body.requestDate ?? event.requestDate,
        maintenanceType: body.maintenanceType ?? event.maintenanceType,
        preliminaryCheckResults: body.preliminaryCheckResults ?? event.preliminaryCheckResults,
        expectedWorkTimeFrom: body.expectedWorkTimeFrom ?? event.expectedWorkTimeFrom,
        expectedWorkTimeTo: body.expectedWorkTimeTo ?? event.expectedWorkTimeTo,
        repairTimeSlots: body.repairTimeSlots ? JSON.stringify(body.repairTimeSlots.slice(0, 5).map((slot) => ({ date: slot.date ?? "", from: slot.from ?? "", to: slot.to ?? "" }))) : event.repairTimeSlots,
        actionsTaken: body.actionsTaken ?? event.actionsTaken,
        technicianName: body.technicianName ?? event.technicianName,
        sparePartsUsed: body.sparePartsUsed ?? event.sparePartsUsed,
        receiverName: body.receiverName ?? event.receiverName,
        handoverDate: body.handoverDate ?? event.handoverDate,
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id))
      .returning();
    // The last (third) row must remain editable. Archive this page only after
    // the user saves that row, then create the next blank page for later use.
    const [eventCount] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.recordId, record.id));
    if (Number(eventCount?.total ?? 0) >= record.maxRows) {
      await getRecordForNewEvent(machineId);
    }
    res.json(formatEvent(updated!));
  } catch (err) {
    next(err);
  }
});

router.post("/events", requireAuth, requireAnyPermission(["fill_corrective_maintenance", "manage_maintenance_requests"]), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const record = await getRecordForNewEvent(machineId);
    if (!record) {
      res.status(404).json({ error: "No active corrective maintenance record found" });
      return;
    }
    const [lastEvent] = await db
      .select({ rowNumber: correctiveMaintenanceEventsTable.rowNumber })
      .from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, record.id))
      .orderBy(desc(correctiveMaintenanceEventsTable.rowNumber))
      .limit(1);
    const body = req.body as { requestReportNumber?: string; requestDate?: string; maintenanceType?: string; preliminaryCheckResults?: string; expectedWorkTimeFrom?: string; expectedWorkTimeTo?: string; actionsTaken?: string; technicianName?: string; sparePartsUsed?: string; receiverName?: string; handoverDate?: string };
    const [created] = await db
      .insert(correctiveMaintenanceEventsTable)
      .values({
        recordId: record.id,
        requestId: null,
        machineId,
        requestReportNumber: body.requestReportNumber?.trim() || null,
        requestDate: body.requestDate?.trim() || null,
        maintenanceType: body.maintenanceType?.trim() || null,
        rowNumber: (lastEvent?.rowNumber ?? 0) + 1,
        preliminaryCheckResults: body.preliminaryCheckResults ?? null,
        expectedWorkTimeFrom: body.expectedWorkTimeFrom ?? null,
        expectedWorkTimeTo: body.expectedWorkTimeTo ?? null,
        actionsTaken: body.actionsTaken ?? null,
        technicianName: body.technicianName?.trim() || null,
        sparePartsUsed: body.sparePartsUsed?.trim() || null,
        receiverName: body.receiverName ?? null,
        handoverDate: body.handoverDate ?? null,
      })
      .returning();
    res.status(201).json(formatEvent(created!));
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
