import { Router } from "express";
import { db } from "@workspace/db";
import {
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceHandoverTable,
  correctiveMaintenanceRecordsTable,
  correctiveMaintenanceStaffTable,
  maintenanceRequestsTable,
  machinesTable,
  auditLogsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
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

const CORRECTIVE_RECORD_CAPACITY = 3;

function parseRepairTimeSlots(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{ date?: string; from?: string; to?: string }>;
    return Array.isArray(parsed) ? parsed.slice(0, 5).map((slot) => ({ date: slot.date ?? "", from: slot.from ?? "", to: slot.to ?? "" })) : [];
  } catch {
    return [];
  }
}

function repairMonth(value: string) {
  const dates = parseRepairTimeSlots(value)
    .map((slot) => slot.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return dates[0]?.slice(0, 7) ?? null;
}

async function createRecordForMonth(
  machineId: number,
  previous: typeof correctiveMaintenanceRecordsTable.$inferSelect,
  month: string,
  status: string = "active",
) {
  const [latest] = await db.select({ sequenceNumber: correctiveMaintenanceRecordsTable.sequenceNumber })
    .from(correctiveMaintenanceRecordsTable)
    .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);
  const [created] = await db.insert(correctiveMaintenanceRecordsTable).values({
    machineId,
    sequenceNumber: (latest?.sequenceNumber ?? 0) + 1,
    previousRecordId: previous.id,
    documentNumber: previous.documentNumber,
    executionDate: `${month}-01`,
    pageCount: previous.pageCount,
    machineName: previous.machineName,
    machineNumber: previous.machineNumber,
    machineLocation: previous.machineLocation,
    startupDate: previous.startupDate,
    maxRows: CORRECTIVE_RECORD_CAPACITY,
    status,
  }).returning();
  return created!;
}

/**
 * Older manual entries were archived only when a printed page reached three
 * rows. Split any such mixed pages before returning history, so a printed
 * record never contains repair dates from two calendar months.
 */
async function separateMixedMonthRecords(machineId: number) {
  const records = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
    .orderBy(asc(correctiveMaintenanceRecordsTable.sequenceNumber));

  for (const record of records) {
    const events = await db.select().from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, record.id))
      .orderBy(asc(correctiveMaintenanceEventsTable.rowNumber));
    const months = [...new Set(events.map((event) => repairMonth(event.repairTimeSlots)).filter((month): month is string => month !== null))];
    if (months.length < 2) continue;

    const retainedMonth = months[0]!;
    for (const month of months.slice(1)) {
      const movingEvents = events.filter((event) => repairMonth(event.repairTimeSlots) === month);
      if (!movingEvents.length) continue;
      let target: typeof correctiveMaintenanceRecordsTable.$inferSelect | undefined = (await db.select().from(correctiveMaintenanceRecordsTable)
        .where(and(
          eq(correctiveMaintenanceRecordsTable.machineId, machineId),
          eq(correctiveMaintenanceRecordsTable.executionDate, `${month}-01`),
          ne(correctiveMaintenanceRecordsTable.id, record.id),
        ))
        .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
        .limit(1))[0];
      if (target) {
        const [targetCount] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable)
          .where(eq(correctiveMaintenanceEventsTable.recordId, target.id));
        if (Number(targetCount?.total ?? 0) + movingEvents.length > CORRECTIVE_RECORD_CAPACITY) target = undefined;
      }
      const destination = target ?? await createRecordForMonth(
        machineId,
        record,
        month,
        record.status === "active" && month === months[months.length - 1] ? "active" : "archived",
      );
      const [destinationCount] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable)
        .where(eq(correctiveMaintenanceEventsTable.recordId, destination.id));
      for (const [index, event] of movingEvents.entries()) {
        await db.update(correctiveMaintenanceEventsTable)
          .set({ recordId: destination.id, rowNumber: Number(destinationCount?.total ?? 0) + index + 1, updatedAt: new Date() })
          .where(eq(correctiveMaintenanceEventsTable.id, event.id));
      }
      if (record.status === "active" && month === months[months.length - 1]) {
        await db.update(correctiveMaintenanceRecordsTable)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(correctiveMaintenanceRecordsTable.id, destination.id));
      }
    }
    await db.update(correctiveMaintenanceRecordsTable)
      .set({ executionDate: `${retainedMonth}-01`, status: record.status === "active" ? "archived" : record.status, updatedAt: new Date() })
      .where(eq(correctiveMaintenanceRecordsTable.id, record.id));
  }
}

/** Pack partially filled pages from the same repair month into one record. */
async function mergeSameMonthRecords(machineId: number) {
  const records = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
    .orderBy(asc(correctiveMaintenanceRecordsTable.sequenceNumber));
  const groups = new Map<string, Array<{ record: typeof correctiveMaintenanceRecordsTable.$inferSelect; events: Array<typeof correctiveMaintenanceEventsTable.$inferSelect> }>>();

  for (const record of records) {
    const events = await db.select().from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, record.id))
      .orderBy(asc(correctiveMaintenanceEventsTable.rowNumber));
    const months = [...new Set(events.map((event) => repairMonth(event.repairTimeSlots)).filter((month): month is string => month !== null))];
    if (months.length !== 1) continue;
    groups.set(months[0]!, [...(groups.get(months[0]!) ?? []), { record, events }]);
  }

  for (const [month, pages] of groups) {
    const destination = pages[0];
    if (!destination) continue;
    const mergedEvents = [...destination.events];
    let hasActivePage = destination.record.status === "active";
    for (const page of pages.slice(1)) {
      // A printed form has three rows. Keep a second page only when this
      // month's combined entries genuinely cannot fit on the first one.
      if (mergedEvents.length + page.events.length > CORRECTIVE_RECORD_CAPACITY) continue;
      hasActivePage ||= page.record.status === "active";
      for (const event of page.events) {
        await db.update(correctiveMaintenanceEventsTable)
          .set({ recordId: destination.record.id, rowNumber: mergedEvents.length + 1, updatedAt: new Date() })
          .where(eq(correctiveMaintenanceEventsTable.id, event.id));
        mergedEvents.push(event);
      }
      await db.delete(correctiveMaintenanceRecordsTable)
        .where(eq(correctiveMaintenanceRecordsTable.id, page.record.id));
    }
    await db.update(correctiveMaintenanceRecordsTable)
      .set({ executionDate: `${month}-01`, status: hasActivePage ? "active" : "archived", updatedAt: new Date() })
      .where(eq(correctiveMaintenanceRecordsTable.id, destination.record.id));
  }
}

/**
 * Keep the archive in the same shape as the printed form: one repair month
 * per record and no more than three maintenance rows on a page.  This also
 * repairs pages that were created before month-based grouping was added.
 */
async function normalizeMonthlyRecordPages(machineId: number) {
  await separateMixedMonthRecords(machineId);
  await mergeSameMonthRecords(machineId);
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
          archivedAt: maintenanceRequestsTable.archivedAt,
        })
        .from(maintenanceRequestsTable)
        .where(inArray(maintenanceRequestsTable.id, requestIds))
    : [];
  const requestById = new Map(requests.map((request) => [request.id, request]));

  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    events: events.filter((event) => {
      const request = event.requestId ? requestById.get(event.requestId) : undefined;
      return !request?.archivedAt;
    }).map((event) => {
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

async function ensureActiveRecord(machineId: number) {
  const [active] = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);
  if (active) return active;

  const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
  if (!machine) return null;
  const [latest] = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);
  const [created] = await db.insert(correctiveMaintenanceRecordsTable).values({
    machineId,
    sequenceNumber: (latest?.sequenceNumber ?? 0) + 1,
    previousRecordId: latest?.id ?? null,
    executionDate: new Date().toISOString().slice(0, 10),
    machineName: machine.machineName,
    machineNumber: machine.machineNumber,
    machineLocation: machine.location,
    startupDate: machine.pmStartDate,
    maxRows: CORRECTIVE_RECORD_CAPACITY,
    status: "active",
  }).returning();
  return created!;
}

async function getRecordForNewEvent(machineId: number) {
  const active = await ensureActiveRecord(machineId);
  if (!active) return null;
  const [countResult] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.recordId, active.id));
  if (Number(countResult?.total ?? 0) < CORRECTIVE_RECORD_CAPACITY) return active;
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

async function moveEventToRepairMonth(
  record: typeof correctiveMaintenanceRecordsTable.$inferSelect,
  event: typeof correctiveMaintenanceEventsTable.$inferSelect,
  month: string,
) {
  if (record.executionDate?.slice(0, 7) === month) return;
  const sourceEvents = await db.select().from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.recordId, record.id))
    .orderBy(asc(correctiveMaintenanceEventsTable.rowNumber));

  // A newly created, otherwise empty page simply becomes that month's page.
  if (sourceEvents.length === 1) {
    await db.update(correctiveMaintenanceRecordsTable)
      .set({ executionDate: `${month}-01`, updatedAt: new Date() })
      .where(eq(correctiveMaintenanceRecordsTable.id, record.id));
    return;
  }

  const candidates = await db.select().from(correctiveMaintenanceRecordsTable)
    .where(and(
      eq(correctiveMaintenanceRecordsTable.machineId, record.machineId),
      eq(correctiveMaintenanceRecordsTable.executionDate, `${month}-01`),
    ))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber));
  let destination: typeof correctiveMaintenanceRecordsTable.$inferSelect | undefined = candidates[0];
  if (destination) {
    const [countResult] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, destination.id));
    if (Number(countResult?.total ?? 0) >= CORRECTIVE_RECORD_CAPACITY) destination = undefined;
  }
  destination ??= await createRecordForMonth(record.machineId, record, month);

  const [destinationCount] = await db.select({ total: count() }).from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.recordId, destination.id));
  await db.update(correctiveMaintenanceEventsTable)
    .set({ recordId: destination.id, rowNumber: Number(destinationCount?.total ?? 0) + 1, updatedAt: new Date() })
    .where(eq(correctiveMaintenanceEventsTable.id, event.id));

  const remaining = sourceEvents.filter((sourceEvent) => sourceEvent.id !== event.id);
  for (const [index, sourceEvent] of remaining.entries()) {
    await db.update(correctiveMaintenanceEventsTable)
      .set({ rowNumber: index + 1, updatedAt: new Date() })
      .where(eq(correctiveMaintenanceEventsTable.id, sourceEvent.id));
  }
  await db.update(correctiveMaintenanceRecordsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(correctiveMaintenanceRecordsTable.id, record.id));
  await db.update(correctiveMaintenanceRecordsTable)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(correctiveMaintenanceRecordsTable.id, destination.id));
}

router.get("/", requireAuth, requirePermission("view_corrective_maintenance"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
    if (!machine) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const record = await ensureActiveRecord(machineId);
    res.json(await recordDetail(record!));
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

router.put("/events/:eventId", requireAuth, requirePermission("edit_corrective_maintenance"), async (req, res, next) => {
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
      repairTimeSlots?: Array<{ date?: string; from?: string; to?: string }>;
      actionsTaken?: string | null;
      technicianName?: string | null;
      sparePartsUsed?: string | null;
      receiverName?: string | null;
      handoverDate?: string | null;
    };
    const slots = body.repairTimeSlots?.slice(0, 5).map((slot) => ({ date: slot.date ?? "", from: slot.from ?? "", to: slot.to ?? "" }));
    const slotMonths = [...new Set((slots ?? parseRepairTimeSlots(event.repairTimeSlots)).map((slot) => slot.date.slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month)))];
    if (slotMonths.length > 1) {
      res.status(400).json({ error: "Repair dates in one record must belong to the same calendar month" });
      return;
    }
    const requestReportNumber = event.requestId
      ? event.requestReportNumber
      : body.requestReportNumber?.trim() || null;
    // The maintenance-request number is the permanent link between the CM
    // row and its request. It must remain unique across CM rows as well.
    if (requestReportNumber) {
      const [sameNumberEvent] = await db
        .select({ id: correctiveMaintenanceEventsTable.id })
        .from(correctiveMaintenanceEventsTable)
        .where(
          and(
            eq(correctiveMaintenanceEventsTable.requestReportNumber, requestReportNumber),
            ne(correctiveMaintenanceEventsTable.id, event.id),
          ),
        )
        .limit(1);
      if (sameNumberEvent) {
        res.status(409).json({
          error: "يوجد صف صيانة علاجية آخر يحمل رقم طلب الصيانة نفسه. أدخل رقم طلب غير مكرر.",
        });
        return;
      }
    }
    const [updated] = await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        requestReportNumber,
        requestDate: body.requestDate ?? event.requestDate,
        maintenanceType: body.maintenanceType ?? event.maintenanceType,
        preliminaryCheckResults: body.preliminaryCheckResults ?? event.preliminaryCheckResults,
        repairTimeSlots: slots ? JSON.stringify(slots) : event.repairTimeSlots,
        actionsTaken: body.actionsTaken ?? event.actionsTaken,
        technicianName: body.technicianName ?? event.technicianName,
        sparePartsUsed: body.sparePartsUsed ?? event.sparePartsUsed,
        receiverName: body.receiverName ?? event.receiverName,
        handoverDate: body.handoverDate ?? event.handoverDate,
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id))
      .returning();
    // Pages are filled by row capacity, not by repair month. A page is
    // archived only when its three rows are full, then the next added row
    // starts a new active page.
    await db.insert(auditLogsTable).values({
      userId: req.session.userId ?? null,
      action: "corrective_maintenance_record_updated",
      entityType: "machine",
      entityId: machineId,
      details: { eventId: updated!.id, recordId: record.id, requestReportNumber: updated!.requestReportNumber },
    });
    res.json(formatEvent(updated!));
  } catch (err) {
    next(err);
  }
});

router.delete("/events/:eventId", requireAuth, requirePermission("delete_corrective_maintenance"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const eventId = parseIdParam(req.params.eventId);
    const [event] = await db.select().from(correctiveMaintenanceEventsTable)
      .where(and(eq(correctiveMaintenanceEventsTable.id, eventId), eq(correctiveMaintenanceEventsTable.machineId, machineId)))
      .limit(1);
    if (!event) {
      res.status(404).json({ error: "Corrective maintenance row not found" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(correctiveMaintenanceHandoverTable).where(eq(correctiveMaintenanceHandoverTable.eventId, event.id));
      await tx.delete(correctiveMaintenanceStaffTable).where(eq(correctiveMaintenanceStaffTable.eventId, event.id));
      await tx.delete(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.id, event.id));
      const remaining = await tx.select({ id: correctiveMaintenanceEventsTable.id })
        .from(correctiveMaintenanceEventsTable)
        .where(eq(correctiveMaintenanceEventsTable.recordId, event.recordId))
        .orderBy(asc(correctiveMaintenanceEventsTable.rowNumber));
      for (const [index, row] of remaining.entries()) {
        await tx.update(correctiveMaintenanceEventsTable)
          .set({ rowNumber: index + 1, updatedAt: new Date() })
          .where(eq(correctiveMaintenanceEventsTable.id, row.id));
      }
      await tx.insert(auditLogsTable).values({
        userId: req.session.userId ?? null,
        action: "corrective_maintenance_record_deleted",
        entityType: "machine",
        entityId: machineId,
        details: { eventId: event.id, recordId: event.recordId, requestReportNumber: event.requestReportNumber },
      });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/history", requireAuth, requirePermission("view_corrective_maintenance"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const includeActive = req.query.includeActive === "true";
    const records = await db
      .select()
      .from(correctiveMaintenanceRecordsTable)
      .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
      .orderBy(asc(correctiveMaintenanceRecordsTable.sequenceNumber));
    const visibleRecords = includeActive
      ? records
      : records.filter((record) => record.status === "archived");
    res.json(await Promise.all(visibleRecords.map(recordDetail)));
  } catch (err) {
    next(err);
  }
});

export default router;
