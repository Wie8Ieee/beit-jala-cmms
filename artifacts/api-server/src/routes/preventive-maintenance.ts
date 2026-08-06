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
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  signatureFieldPermissionsTable,
  usersTable,
  auditLogsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { parseIdParam, requireAnyPermission, requireAuth, requirePermission } from "../lib/auth.js";

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

// A saved PM inspection is the source of truth for completing a scheduled
// monthly activity. Membership in the machine's monthly plan is sufficient:
// Planned From/To are planning guidance and must not block actual completion.
async function completeScheduledMonthlyPm(machineId: number, inspectionDate: string) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(inspectionDate);
  if (!match) return;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const scheduledRows = await db.select({ id: monthlyPmPlanRowsTable.id })
    .from(monthlyPmPlanRowsTable)
    .innerJoin(monthlyPmPlansTable, eq(monthlyPmPlanRowsTable.planId, monthlyPmPlansTable.id))
    .where(and(
      eq(monthlyPmPlanRowsTable.machineId, machineId),
      eq(monthlyPmPlansTable.year, year),
      eq(monthlyPmPlansTable.month, month),
      eq(monthlyPmPlanRowsTable.actualDateIsOverride, false),
      eq(monthlyPmPlanRowsTable.isManuallyRemoved, false),
    ));
  if (!scheduledRows.length) return;
  await db
    .update(monthlyPmPlanRowsTable)
    .set({
      actualDate: inspectionDate,
      actualDateIsOverride: false,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(monthlyPmPlanRowsTable.id, scheduledRows.map((row) => row.id)),
      ),
    );
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

  // Older PM inspections stored the examiner's name as the signature.  When
  // the examiner later has a drawn profile signature, use it for display and
  // printing without changing the historical inspection data.
  const examinerIds = [...new Set(inspections.flatMap((inspection) => inspection.completedByUserId ? [inspection.completedByUserId] : []))];
  const examiners = examinerIds.length
    ? await db.select({ id: usersTable.id, fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
      .from(usersTable).where(inArray(usersTable.id, examinerIds))
    : [];
  const examinerById = new Map(examiners.map((examiner) => [examiner.id, examiner]));

  const inspectionPayload = inspections.map((inspection) => {
    const examiner = inspection.completedByUserId ? examinerById.get(inspection.completedByUserId) : undefined;
    const storedSignature = inspection.examinerSignature ?? "";
    const hasDrawnSignature = storedSignature.startsWith("data:image/");
    return {
      ...inspection,
      examinerName: inspection.examinerName || examiner?.fullName || examiner?.username || null,
      examinerSignature: hasDrawnSignature ? inspection.examinerSignature : (examiner?.signatureData || inspection.examinerSignature),
      completedAt: inspection.completedAt.toISOString(),
      results: allResults.filter((result) => result.inspectionId === inspection.id),
    };
  });

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

// A production employee may need to open a PM record only to acknowledge that
// they received the machine.  Signing permission is therefore enough to view
// the record, without granting permission to edit its maintenance details.
router.get("/current", requireAuth, requireAnyPermission(["view_pm_records", "fill_pm_record", "sign_assigned_fields"]), async (req, res, next) => {
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
router.get("/history/:recordId", requireAuth, requireAnyPermission(["view_pm_records", "fill_pm_record", "sign_assigned_fields"]), async (req, res, next) => {
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
    const [examiner] = await db.select({ fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    if (!examiner) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const examinerName = body.examinerName?.trim() || examiner.fullName || examiner.username;
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
        examinerName,
        // Use the technician's saved drawn signature. If they have not drawn
        // one yet, the authenticated name is retained as the audit signature.
        examinerSignature: examiner.signatureData || examinerName,
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
    await db.insert(auditLogsTable).values({
      userId: req.session.userId ?? null,
      action: "preventive_maintenance_record_filled",
      entityType: "machine",
      entityId: machineId,
      details: { inspectionId: inspection!.id, inspectionDate: body.inspectionDate, inspectionTime: body.inspectionTime, recordId: record.id },
    });
    await completeScheduledMonthlyPm(machineId, body.inspectionDate);
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

// Inspections in the active record can be corrected. Archived records remain
// immutable because they are the signed historical copy of the form.
router.put("/inspections/:inspectionId", requireAuth, requirePermission("edit_pm_inspection"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const inspectionId = parseIdParam(req.params.inspectionId);
    const body = req.body as {
      executionMonthYear?: string;
      inspectionDate?: string;
      inspectionTime?: string;
      actionTaken?: string;
      examinerName?: string;
      results?: Array<{ checklistPointId: number; value: string | null }>;
    };
    if (!body.inspectionDate || !body.inspectionTime) {
      res.status(400).json({ error: "inspectionDate and inspectionTime are required" });
      return;
    }
    const [inspection] = await db.select().from(pmInspectionsTable)
      .innerJoin(pmRecordsTable, eq(pmInspectionsTable.recordId, pmRecordsTable.id))
      .where(and(eq(pmInspectionsTable.id, inspectionId), eq(pmInspectionsTable.machineId, machineId)));
    if (!inspection || inspection.pm_records.status !== "active") {
      res.status(409).json({ error: "Only inspections in the active record can be edited" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(pmInspectionsTable).set({
        executionMonthYear: body.executionMonthYear ?? null,
        inspectionDate: body.inspectionDate,
        inspectionTime: body.inspectionTime,
        actionTaken: body.actionTaken ?? null,
        examinerName: body.examinerName ?? null,
      }).where(eq(pmInspectionsTable.id, inspectionId));
      await tx.delete(pmInspectionResultsTable).where(eq(pmInspectionResultsTable.inspectionId, inspectionId));
      const results = (body.results ?? []).map((result) => ({
        inspectionId,
        checklistPointId: result.checklistPointId,
        value: result.value ?? null,
      }));
      if (results.length) await tx.insert(pmInspectionResultsTable).values(results);
      await tx.update(pmRecordsTable).set({ updatedAt: new Date() }).where(eq(pmRecordsTable.id, inspection.pm_inspections.recordId));
    });
    await db.insert(auditLogsTable).values({
      userId: req.session.userId ?? null,
      action: "preventive_maintenance_record_updated",
      entityType: "machine",
      entityId: machineId,
      details: { inspectionId, inspectionDate: body.inspectionDate, inspectionTime: body.inspectionTime, recordId: inspection.pm_inspections.recordId },
    });
    res.json(await recordDetail(machineId));
  } catch (err) {
    next(err);
  }
});

router.delete("/inspections/:inspectionId", requireAuth, requirePermission("delete_pm_inspection"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const inspectionId = parseIdParam(req.params.inspectionId);
    const [inspection] = await db.select().from(pmInspectionsTable)
      .innerJoin(pmRecordsTable, eq(pmInspectionsTable.recordId, pmRecordsTable.id))
      .where(and(eq(pmInspectionsTable.id, inspectionId), eq(pmInspectionsTable.machineId, machineId)));
    if (!inspection) {
      res.status(404).json({ error: "Inspection not found" });
      return;
    }
    if (inspection.pm_records.status !== "active") {
      res.status(409).json({ error: "Only inspections in the active record can be deleted" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(pmInspectionResultsTable).where(eq(pmInspectionResultsTable.inspectionId, inspectionId));
      await tx.delete(pmInspectionsTable).where(eq(pmInspectionsTable.id, inspectionId));
      const remaining = await tx.select({ id: pmInspectionsTable.id }).from(pmInspectionsTable)
        .where(eq(pmInspectionsTable.recordId, inspection.pm_inspections.recordId))
        .orderBy(asc(pmInspectionsTable.columnNumber));
      for (const [index, row] of remaining.entries()) {
        await tx.update(pmInspectionsTable).set({ columnNumber: index + 1 }).where(eq(pmInspectionsTable.id, row.id));
      }
      await tx.update(pmRecordsTable).set({ updatedAt: new Date() }).where(eq(pmRecordsTable.id, inspection.pm_inspections.recordId));
    });
    res.json(await recordDetail(machineId));
  } catch (err) {
    next(err);
  }
});

// The machine receiver is a separate user from the maintenance technician.
// Their acceptance is captured after the technician has saved the inspection.
router.post("/inspections/:inspectionId/accept", requireAuth, requirePermission("sign_assigned_fields"), async (req, res, next) => {
  try {
    const machineId = parseIdParam(req.params.id);
    const inspectionId = parseIdParam(req.params.inspectionId);
    const [inspection] = await db.select().from(pmInspectionsTable)
      .where(and(eq(pmInspectionsTable.id, inspectionId), eq(pmInspectionsTable.machineId, machineId)));
    if (!inspection) {
      res.status(404).json({ error: "Inspection not found" });
      return;
    }
    if (inspection.completedByUserId === req.session.userId) {
      res.status(400).json({ error: "The maintenance technician cannot accept their own inspection" });
      return;
    }
    if (inspection.machineReceiverSignature) {
      res.status(409).json({ error: "This inspection has already been accepted" });
      return;
    }
    // Acceptance is intentionally not granted by the generic signing
    // permission alone. An administrator must explicitly allow the user to
    // sign PM_RECORD / machine_receiver in Signature Permissions.
    const [signerPermission] = await db.select({ id: signatureFieldPermissionsTable.id })
      .from(signatureFieldPermissionsTable)
      .where(and(
        eq(signatureFieldPermissionsTable.documentType, "PM_RECORD"),
        eq(signatureFieldPermissionsTable.fieldName, "machine_receiver"),
        eq(signatureFieldPermissionsTable.eligibleUserId, req.session.userId!),
        isNull(signatureFieldPermissionsTable.revokedAt),
      ));
    if (!signerPermission) {
      res.status(403).json({ error: "You are not authorized to accept and sign machine receipts" });
      return;
    }
    const [receiver] = await db.select({ fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    if (!receiver) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const receiverName = receiver.fullName || receiver.username;
    await db.update(pmInspectionsTable).set({
      machineReceiverName: receiverName,
      // A saved drawn signature is used when available; the authenticated
      // receiver name still provides an auditable electronic acceptance.
      machineReceiverSignature: receiver.signatureData || receiverName,
    }).where(eq(pmInspectionsTable.id, inspectionId));
    res.json(await recordDetail(machineId));
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
