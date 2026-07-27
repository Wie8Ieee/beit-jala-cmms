import { Router } from "express";
import { db } from "@workspace/db";
import {
  departmentsTable,
  machinesTable,
  pmChecklistPointsTable,
  pmHeadersTable,
  pmInspectionResultsTable,
  pmInspectionsTable,
  pmRecordChecklistPointsTable,
  pmRecordsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { parseIdParam, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router({ mergeParams: true });

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function formatHeader(header: typeof pmHeadersTable.$inferSelect) {
  return {
    ...header,
    createdAt: header.createdAt.toISOString(),
    updatedAt: header.updatedAt.toISOString(),
  };
}

function formatPoint(point: typeof pmChecklistPointsTable.$inferSelect) {
  return {
    ...point,
    deactivatedAt: iso(point.deactivatedAt),
    createdAt: point.createdAt.toISOString(),
    updatedAt: point.updatedAt.toISOString(),
  };
}

async function normalizeChecklistOrder(machineId: number) {
  const points = await db
    .select({ id: pmChecklistPointsTable.id })
    .from(pmChecklistPointsTable)
    .where(and(eq(pmChecklistPointsTable.machineId, machineId), eq(pmChecklistPointsTable.isActive, true)))
    .orderBy(asc(pmChecklistPointsTable.sortOrder), asc(pmChecklistPointsTable.createdAt), asc(pmChecklistPointsTable.id));

  await Promise.all(
    points.map((point, index) =>
      db
        .update(pmChecklistPointsTable)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(pmChecklistPointsTable.id, point.id)),
    ),
  );

  return points.length + 1;
}

async function machineExists(machineId: number) {
  const [machine] = await db
    .select({
      id: machinesTable.id,
      machineName: machinesTable.machineName,
      machineNumber: machinesTable.machineNumber,
      departmentName: departmentsTable.name,
    })
    .from(machinesTable)
    .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
    .where(eq(machinesTable.id, machineId));
  return machine ?? null;
}

async function getOrCreateHeader(machineId: number) {
  const [existing] = await db
    .select()
    .from(pmHeadersTable)
    .where(eq(pmHeadersTable.machineId, machineId));
  if (existing) return existing;

  const machine = await machineExists(machineId);
  const [created] = await db
    .insert(pmHeadersTable)
    .values({
      machineId,
      department: machine?.departmentName ?? null,
      columnsPerRecord: 5,
      inspectionColumnsPerPrintPage: 2,
    })
    .returning();
  return created!;
}

async function getActiveRecord(machineId: number) {
  const [record] = await db
    .select()
    .from(pmRecordsTable)
    .where(and(eq(pmRecordsTable.machineId, machineId), eq(pmRecordsTable.status, "active")))
    .orderBy(desc(pmRecordsTable.sequenceNumber))
    .limit(1);
  if (record) return record;

  const [latest] = await db
    .select()
    .from(pmRecordsTable)
    .where(eq(pmRecordsTable.machineId, machineId))
    .orderBy(desc(pmRecordsTable.sequenceNumber))
    .limit(1);

  const [created] = await db
    .insert(pmRecordsTable)
    .values({
      machineId,
      sequenceNumber: latest ? latest.sequenceNumber + 1 : 1,
      previousRecordId: latest?.id ?? null,
      status: "active",
    })
    .returning();
  return created!;
}

async function getActiveChecklist(machineId: number) {
  return db
    .select()
    .from(pmChecklistPointsTable)
    .where(and(eq(pmChecklistPointsTable.machineId, machineId), eq(pmChecklistPointsTable.isActive, true)))
    .orderBy(asc(pmChecklistPointsTable.sortOrder), asc(pmChecklistPointsTable.id));
}

async function snapshotChecklist(record: typeof pmRecordsTable.$inferSelect) {
  const existing = await db
    .select({ id: pmRecordChecklistPointsTable.id })
    .from(pmRecordChecklistPointsTable)
    .where(eq(pmRecordChecklistPointsTable.recordId, record.id));
  if (existing.length) return;

  const checklist = await getActiveChecklist(record.machineId);
  if (!checklist.length) return;
  await db.insert(pmRecordChecklistPointsTable).values(
    checklist.map((point) => ({
      recordId: record.id,
      sourceChecklistPointId: point.id,
      pointText: point.pointText,
      resultType: point.resultType,
      sortOrder: point.sortOrder,
    })),
  );
}

async function getChecklistForRecord(machineId: number, record: typeof pmRecordsTable.$inferSelect) {
  const snapshots = await db
    .select()
    .from(pmRecordChecklistPointsTable)
    .where(eq(pmRecordChecklistPointsTable.recordId, record.id))
    .orderBy(asc(pmRecordChecklistPointsTable.sortOrder), asc(pmRecordChecklistPointsTable.id));

  // A checklist is captured as soon as the record reaches its final
  // inspection.  Read that capture even while the record is waiting to be
  // rolled over, so later checklist changes cannot alter its official print.
  if (!snapshots.length) return getActiveChecklist(machineId);
  return snapshots.map((point) => ({
    id: point.sourceChecklistPointId,
    machineId,
    pointText: point.pointText,
    resultType: point.resultType,
    sortOrder: point.sortOrder,
    isActive: true,
    deactivatedAt: null,
    createdAt: point.createdAt,
    updatedAt: point.createdAt,
  }));
}

async function summarizeRecord(record: typeof pmRecordsTable.$inferSelect) {
  const [inspectionStats] = await db
    .select({ total: count() })
    .from(pmInspectionsTable)
    .where(eq(pmInspectionsTable.recordId, record.id));

  return {
    id: record.id,
    machineId: record.machineId,
    sequenceNumber: record.sequenceNumber,
    previousRecordId: record.previousRecordId,
    status: record.status,
    inspectionCount: Number(inspectionStats?.total ?? 0),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// A PM record remains active until its configured inspection capacity is full.
// The completed record is then archived and a new one is chained after it.
async function rolloverCompletedRecord(machineId: number) {
  const header = await getOrCreateHeader(machineId);
  const record = await getActiveRecord(machineId);
  const summary = await summarizeRecord(record);
  if (summary.inspectionCount < header.inspectionColumnsPerPrintPage) return record;

  await snapshotChecklist(record);
  await db
    .update(pmRecordsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(pmRecordsTable.id, record.id));
  const [nextRecord] = await db
    .insert(pmRecordsTable)
    .values({
      machineId,
      sequenceNumber: record.sequenceNumber + 1,
      previousRecordId: record.id,
      status: "active",
    })
    .returning();
  return nextRecord!;
}

async function recordDetail(machineId: number, record = undefined as typeof pmRecordsTable.$inferSelect | undefined) {
  const machine = await machineExists(machineId);
  const header = await getOrCreateHeader(machineId);
  const activeRecord = record ?? (await getActiveRecord(machineId));
  const checklist = await getChecklistForRecord(machineId, activeRecord);

  const inspections = await db
    .select()
    .from(pmInspectionsTable)
    .where(eq(pmInspectionsTable.recordId, activeRecord.id))
    .orderBy(asc(pmInspectionsTable.columnNumber), asc(pmInspectionsTable.id));

  const inspectionIds = inspections.map((inspection) => inspection.id);
  const allResults = inspectionIds.length
    ? await db
        .select()
        .from(pmInspectionResultsTable)
        .where(inArray(pmInspectionResultsTable.inspectionId, inspectionIds))
    : [];

  const inspectionPayload = inspections.map((inspection) => ({
    ...inspection,
    completedAt: inspection.completedAt.toISOString(),
    results: allResults.filter((result) => result.inspectionId === inspection.id),
  }));

  const pageCount = Math.max(
    1,
    Math.ceil(checklist.length / 10) * Math.max(1, Math.ceil(inspections.length / header.inspectionColumnsPerPrintPage)),
  );

  return {
    record: await summarizeRecord(activeRecord),
    machine: {
      name: machine?.machineName ?? "",
      number: machine?.machineNumber ?? "",
    },
    header: formatHeader(header),
    checklistPoints: checklist.map(formatPoint),
    inspections: inspectionPayload,
    pageCount,
  };
}

router.get("/header", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    if (Number.isNaN(machineId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    res.json(formatHeader(await getOrCreateHeader(machineId)));
  } catch (err) {
    next(err);
  }
});

router.put("/header", requireAuth, requirePermission("edit_header"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    if (Number.isNaN(machineId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    const body = req.body as {
      procedureFormNumber?: string;
      effectiveDate?: string | null;
      department?: string | null;
      columnsPerRecord?: number;
      inspectionColumnsPerPrintPage?: number;
    };
    const columnsPerRecord = Math.min(10, Math.max(1, Number(body.columnsPerRecord ?? 5)));
    const inspectionColumnsPerPrintPage = Math.min(10, Math.max(1, Number(body.inspectionColumnsPerPrintPage ?? 2)));
    await getOrCreateHeader(machineId);
    const [updated] = await db
      .update(pmHeadersTable)
      .set({
        procedureFormNumber: body.procedureFormNumber || "LOG-00-0102",
        effectiveDate: body.effectiveDate ?? null,
        department: body.department ?? null,
        columnsPerRecord,
        inspectionColumnsPerPrintPage,
        updatedAt: new Date(),
      })
      .where(eq(pmHeadersTable.machineId, machineId))
      .returning();
    res.json(formatHeader(updated!));
  } catch (err) {
    next(err);
  }
});

router.get("/checklist", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const points = await db
      .select()
      .from(pmChecklistPointsTable)
      .where(eq(pmChecklistPointsTable.machineId, machineId))
      .orderBy(asc(pmChecklistPointsTable.sortOrder), asc(pmChecklistPointsTable.id));
    res.json(points.map(formatPoint));
  } catch (err) {
    next(err);
  }
});

router.post("/checklist", requireAuth, requirePermission("manage_pm_checklist"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    if (Number.isNaN(machineId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    const body = req.body as { pointText?: string; resultType?: string };
    if (!body.pointText) {
      res.status(400).json({ error: "pointText is required" });
      return;
    }
    await rolloverCompletedRecord(machineId);
    const sortOrder = await normalizeChecklistOrder(machineId);
    const [created] = await db
      .insert(pmChecklistPointsTable)
      .values({
        machineId,
        pointText: body.pointText,
        resultType: body.resultType ?? "yes_no",
        sortOrder,
      })
      .returning();
    res.status(201).json(formatPoint(created!));
  } catch (err) {
    next(err);
  }
});

router.put("/checklist/:pointId", requireAuth, requirePermission("manage_pm_checklist"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const pointId = parseIdParam(req.params.pointId);
    const body = req.body as { pointText?: string; resultType?: string; sortOrder?: number };
    await rolloverCompletedRecord(machineId);
    const [updated] = await db
      .update(pmChecklistPointsTable)
      .set({
        pointText: body.pointText ?? "",
        resultType: body.resultType ?? "yes_no",
        sortOrder: body.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(and(eq(pmChecklistPointsTable.id, pointId), eq(pmChecklistPointsTable.machineId, machineId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Checklist point not found" });
      return;
    }
    await normalizeChecklistOrder(machineId);
    res.json(formatPoint(updated));
  } catch (err) {
    next(err);
  }
});

router.patch("/checklist/:pointId", requireAuth, requirePermission("manage_pm_checklist"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const pointId = parseIdParam(req.params.pointId);
    await rolloverCompletedRecord(machineId);
    const [updated] = await db
      .update(pmChecklistPointsTable)
      .set({ isActive: false, deactivatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pmChecklistPointsTable.id, pointId), eq(pmChecklistPointsTable.machineId, machineId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Checklist point not found" });
      return;
    }
    await normalizeChecklistOrder(machineId);
    res.json(formatPoint(updated));
  } catch (err) {
    next(err);
  }
});

router.get("/current", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    if (Number.isNaN(machineId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    res.json(await recordDetail(machineId));
  } catch (err) {
    next(err);
  }
});

// Historical PM records are immutable, but remain available for viewing.
router.get("/history/:recordId", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const recordId = parseIdParam(req.params.recordId);
    if (Number.isNaN(machineId) || Number.isNaN(recordId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "PM record not found" });
      return;
    }

    const [record] = await db
      .select()
      .from(pmRecordsTable)
      .where(and(eq(pmRecordsTable.id, recordId), eq(pmRecordsTable.machineId, machineId)));
    if (!record) {
      res.status(404).json({ error: "PM record not found" });
      return;
    }

    res.json(await recordDetail(machineId, record));
  } catch (err) {
    next(err);
  }
});

router.post("/inspections", requireAuth, requirePermission("fill_pm_record"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    if (Number.isNaN(machineId) || !(await machineExists(machineId))) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    const header = await getOrCreateHeader(machineId);
    const record = await rolloverCompletedRecord(machineId);

    const body = req.body as {
      executionMonthYear?: string;
      inspectionDate?: string;
      inspectionTime?: string;
      actionTaken?: string;
      examinerName?: string;
      examinerSignature?: string;
      machineReceiverName?: string;
      machineReceiverSignature?: string;
      results?: Array<{ checklistPointId: number; value: string | null }>;
    };
    if (!body.inspectionDate || !body.inspectionTime) {
      res.status(400).json({ error: "inspectionDate and inspectionTime are required" });
      return;
    }
    const recordSummary = await summarizeRecord(record);
    const [inspection] = await db
      .insert(pmInspectionsTable)
      .values({
        recordId: record.id,
        machineId,
        columnNumber: recordSummary.inspectionCount + 1,
        executionMonthYear: body.executionMonthYear ?? null,
        inspectionDate: body.inspectionDate,
        inspectionTime: body.inspectionTime,
        actionTaken: body.actionTaken ?? null,
        examinerName: body.examinerName ?? null,
        examinerSignature: body.examinerSignature ?? null,
        machineReceiverName: body.machineReceiverName ?? null,
        machineReceiverSignature: body.machineReceiverSignature ?? null,
        completedByUserId: req.session.userId,
      })
      .returning();

    const resultRows = (body.results ?? []).map((result) => ({
      inspectionId: inspection!.id,
      checklistPointId: result.checklistPointId,
      value: result.value ?? null,
    }));
    if (resultRows.length) {
      await db.insert(pmInspectionResultsTable).values(resultRows);
    }
    // Preserve the exact set and order of checklist points for a completed
    // record.  New points can then be added freely for the next record.
    if (recordSummary.inspectionCount + 1 >= header.inspectionColumnsPerPrintPage) {
      await snapshotChecklist(record);
    }
    await db.update(pmRecordsTable).set({ updatedAt: new Date() }).where(eq(pmRecordsTable.id, record.id));
    res.status(201).json(await recordDetail(machineId, record));
  } catch (err) {
    next(err);
  }
});

router.get("/history", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const records = await db
      .select()
      .from(pmRecordsTable)
      .where(eq(pmRecordsTable.machineId, machineId))
      .orderBy(asc(pmRecordsTable.sequenceNumber));
    res.json(await Promise.all(records.map(summarizeRecord)));
  } catch (err) {
    next(err);
  }
});

export default router;
