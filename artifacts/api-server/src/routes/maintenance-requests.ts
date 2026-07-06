import { Router, type NextFunction, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceRecordsTable,
  departmentsTable,
  machinesTable,
  maintenanceRequestsTable,
  maintenanceRequestStatusHistoryTable,
  rolesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { parseIdParam, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

const STATUS = {
  SUBMITTED: "Submitted",
  PENDING_QA: "Pending QA Approval",
  QA_APPROVED: "QA Approved",
  QA_REJECTED: "QA Rejected",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CLOSED: "Closed",
} as const;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function parseStaff(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRequestSummary(row: typeof maintenanceRequestsTable.$inferSelect) {
  return {
    id: row.id,
    requestReportNumber: row.requestReportNumber,
    machineId: row.machineId,
    machineName: row.machineName,
    machineNumber: row.machineNumber,
    departmentSection: row.departmentSection,
    priority: row.priority,
    requestDate: row.requestDate,
    failureDescription: row.failureDescription,
    status: row.status,
    assignedTechnicianUserId: row.assignedTechnicianUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatEvent(event: typeof correctiveMaintenanceEventsTable.$inferSelect | null | undefined) {
  if (!event) return null;
  return {
    ...event,
    performingStaff: parseStaff(event.performingStaff),
    completedAt: event.completedAt ? event.completedAt.toISOString() : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

async function addStatusHistory(requestId: number, fromStatus: string | null, toStatus: string, userId: number | undefined, notes?: string) {
  await db.insert(maintenanceRequestStatusHistoryTable).values({
    requestId,
    fromStatus,
    toStatus,
    changedByUserId: userId ?? null,
    notes: notes ?? null,
  });
  await db.insert(auditLogsTable).values({
    userId: userId ?? null,
    action: "maintenance_request_status_change",
    entityType: "maintenance_request",
    entityId: requestId,
    details: { fromStatus, toStatus, notes: notes ?? null },
  });
}

async function getRequest(id: number) {
  const [request] = await db.select().from(maintenanceRequestsTable).where(eq(maintenanceRequestsTable.id, id));
  return request ?? null;
}

async function getRequestDetail(request: typeof maintenanceRequestsTable.$inferSelect) {
  const [event] = await db
    .select()
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
  const history = await db
    .select()
    .from(maintenanceRequestStatusHistoryTable)
    .where(eq(maintenanceRequestStatusHistoryTable.requestId, request.id))
    .orderBy(asc(maintenanceRequestStatusHistoryTable.createdAt), asc(maintenanceRequestStatusHistoryTable.id));

  return {
    request: formatRequestSummary(request),
    requestedByUserId: request.requestedByUserId,
    departmentId: request.departmentId,
    reportingPersonName: request.reportingPersonName,
    reportingPersonSignature: request.reportingPersonSignature,
    departmentSupervisorName: request.departmentSupervisorName,
    departmentSupervisorSignature: request.departmentSupervisorSignature,
    qaDecision: request.qaDecision,
    qaSupervisorSignature: request.qaSupervisorSignature,
    qaReviewDate: request.qaReviewDate,
    qaReviewNotes: request.qaReviewNotes,
    engineeringDecision: request.engineeringDecision,
    assignedTechnicianUserId: request.assignedTechnicianUserId,
    engineeringSupervisorSignature: request.engineeringSupervisorSignature,
    engineeringReviewNotes: request.engineeringReviewNotes,
    expectedWorkTimeFrom: request.expectedWorkTimeFrom,
    expectedWorkTimeTo: request.expectedWorkTimeTo,
    correctiveEvent: formatEvent(event),
    statusHistory: history.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function hasPermission(req: Request, permission: string) {
  return (req.session.permissions ?? []).includes(permission);
}

function ensureCanView(req: Request, request: typeof maintenanceRequestsTable.$inferSelect) {
  if (hasPermission(req, "manage_maintenance_requests") || hasPermission(req, "review_qa_requests") || hasPermission(req, "review_engineering_requests")) return true;
  if (
    hasPermission(req, "fill_corrective_maintenance") &&
    (request.status === STATUS.ACCEPTED || request.status === STATUS.IN_PROGRESS || request.status === STATUS.COMPLETED || request.status === STATUS.CLOSED) &&
    request.assignedTechnicianUserId === req.session.userId
  ) return true;
  if (hasPermission(req, "view_own_requests") && req.session.userId === request.requestedByUserId) return true;
  return false;
}

function isAssignedTechnician(req: Request, request: typeof maintenanceRequestsTable.$inferSelect) {
  return !!request.assignedTechnicianUserId && request.assignedTechnicianUserId === req.session.userId;
}

async function nextRequestNumber() {
  const year = new Date().getFullYear();
  const [stats] = await db.select({ total: count() }).from(maintenanceRequestsTable);
  const next = Number(stats?.total ?? 0) + 1;
  return `MR-${year}-${String(next).padStart(4, "0")}`;
}

async function getMachine(machineId: number) {
  const [machine] = await db
    .select({
      id: machinesTable.id,
      machineName: machinesTable.machineName,
      machineNumber: machinesTable.machineNumber,
      location: machinesTable.location,
      pmStartDate: machinesTable.pmStartDate,
      departmentId: machinesTable.departmentId,
      departmentName: departmentsTable.name,
    })
    .from(machinesTable)
    .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
    .where(eq(machinesTable.id, machineId));
  return machine ?? null;
}

async function getOrCreateCmRecord(machineId: number) {
  const [active] = await db
    .select()
    .from(correctiveMaintenanceRecordsTable)
    .where(and(eq(correctiveMaintenanceRecordsTable.machineId, machineId), eq(correctiveMaintenanceRecordsTable.status, "active")))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);

  if (active) {
    const [eventStats] = await db
      .select({ total: count() })
      .from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, active.id));
    if (Number(eventStats?.total ?? 0) < active.maxRows) return active;
    await db
      .update(correctiveMaintenanceRecordsTable)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(correctiveMaintenanceRecordsTable.id, active.id));
  }

  const machine = await getMachine(machineId);
  if (!machine) throw new Error("Machine not found");

  const [latest] = await db
    .select()
    .from(correctiveMaintenanceRecordsTable)
    .where(eq(correctiveMaintenanceRecordsTable.machineId, machineId))
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);

  const [created] = await db
    .insert(correctiveMaintenanceRecordsTable)
    .values({
      machineId,
      sequenceNumber: latest ? latest.sequenceNumber + 1 : 1,
      previousRecordId: latest?.id ?? null,
      executionDate: todayString(),
      machineName: machine.machineName,
      machineNumber: machine.machineNumber,
      machineLocation: machine.location ?? null,
      startupDate: machine.pmStartDate ?? null,
    })
    .returning();
  return created!;
}

async function ensureEventForRequest(request: typeof maintenanceRequestsTable.$inferSelect) {
  const [existing] = await db
    .select()
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
  if (existing) return existing;

  const record = await getOrCreateCmRecord(request.machineId);
  const [eventStats] = await db
    .select({ total: count() })
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.recordId, record.id));

  const [created] = await db
    .insert(correctiveMaintenanceEventsTable)
    .values({
      recordId: record.id,
      requestId: request.id,
      machineId: request.machineId,
      requestReportNumber: request.requestReportNumber,
      rowNumber: Number(eventStats?.total ?? 0) + 1,
    })
    .returning();
  return created!;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const scope = String(req.query.scope ?? "all");
    const permissions = req.session.permissions ?? [];
    let allowedStatuses: string[] | null = null;
    let ownOnly = false;

    if (scope === "own" || (!permissions.includes("manage_maintenance_requests") && permissions.includes("view_own_requests"))) {
      ownOnly = true;
    } else if (scope === "qa") {
      allowedStatuses = [STATUS.PENDING_QA];
    } else if (scope === "engineering") {
      allowedStatuses = [STATUS.QA_APPROVED];
    } else if (scope === "technician") {
      allowedStatuses = [STATUS.ACCEPTED, STATUS.IN_PROGRESS, STATUS.COMPLETED];
    }

    let rows = await db.select().from(maintenanceRequestsTable).orderBy(desc(maintenanceRequestsTable.createdAt));
    if (ownOnly) rows = rows.filter((row) => row.requestedByUserId === req.session.userId);
    if (allowedStatuses) rows = rows.filter((row) => allowedStatuses.includes(row.status));
    if (scope === "technician") rows = rows.filter((row) => row.assignedTechnicianUserId === req.session.userId);
    rows = rows.filter((row) => ensureCanView(req, row));
    res.json(rows.map(formatRequestSummary));
  } catch (err) {
    next(err);
  }
});

router.get("/technicians", requireAuth, requirePermission("review_engineering_requests"), async (_req, res, next) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(and(eq(usersTable.isActive, true), eq(rolesTable.name, "Maintenance Technician")));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get("/machines", requireAuth, requirePermission("submit_maintenance_request"), async (_req, res, next) => {
  try {
    const machines = await db
      .select({
        id: machinesTable.id,
        machineName: machinesTable.machineName,
        machineNumber: machinesTable.machineNumber,
        location: machinesTable.location,
        departmentName: departmentsTable.name,
      })
      .from(machinesTable)
      .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
      .orderBy(asc(machinesTable.machineName));
    res.json(machines);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requirePermission("submit_maintenance_request"), async (req, res, next) => {
  try {
    const body = req.body as {
      machineId?: number;
      departmentSection?: string;
      priority?: string;
      requestDate?: string;
      failureDescription?: string;
      reportingPersonSignature?: string;
      reportingPersonName?: string;
      departmentSupervisorSignature?: string;
      departmentSupervisorName?: string;
    };
    if (!body.machineId || !body.failureDescription || !body.requestDate) {
      res.status(400).json({ error: "machineId, requestDate, and failureDescription are required" });
      return;
    }

    const machine = await getMachine(body.machineId);
    if (!machine) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }
    const [user] = await db
      .select({ departmentId: usersTable.departmentId })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));
    const [created] = await db
      .insert(maintenanceRequestsTable)
      .values({
        requestReportNumber: await nextRequestNumber(),
        machineId: machine.id,
        requestedByUserId: req.session.userId!,
        departmentId: user?.departmentId ?? machine.departmentId ?? null,
        departmentSection: body.departmentSection ?? machine.departmentName ?? null,
        priority: body.priority === "urgent" ? "urgent" : "normal",
        machineName: machine.machineName,
        machineNumber: machine.machineNumber,
        requestDate: body.requestDate,
        failureDescription: body.failureDescription,
        reportingPersonName: body.reportingPersonName ?? null,
        reportingPersonSignature: body.reportingPersonSignature ?? null,
        departmentSupervisorName: body.departmentSupervisorName ?? null,
        departmentSupervisorSignature: body.departmentSupervisorSignature ?? null,
        status: STATUS.PENDING_QA,
      })
      .returning();
    await addStatusHistory(created!.id, null, STATUS.SUBMITTED, req.session.userId, "Request submitted");
    await addStatusHistory(created!.id, STATUS.SUBMITTED, STATUS.PENDING_QA, req.session.userId, "Routed to QA Supervisor");
    res.status(201).json(await getRequestDetail(created!));
  } catch (err) {
    next(err);
  }
});

router.get("/by-number/:requestNumber", requireAuth, async (req, res, next) => {
  try {
    const [request] = await db
      .select()
      .from(maintenanceRequestsTable)
      .where(eq(maintenanceRequestsTable.requestReportNumber, req.params.requestNumber ?? ""));
    if (!request || !ensureCanView(req, request)) {
      res.status(404).json({ error: "Maintenance request not found" });
      return;
    }
    res.json(await getRequestDetail(request));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const request = await getRequest(id);
    if (!request || !ensureCanView(req, request)) {
      res.status(404).json({ error: "Maintenance request not found" });
      return;
    }
    res.json(await getRequestDetail(request));
  } catch (err) {
    next(err);
  }
});

async function qaReviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.PENDING_QA) {
      res.status(400).json({ error: "Request is not pending QA approval" });
      return;
    }
    const body = req.body as { decision?: string; notes?: string; signature?: string };
    const toStatus = body.decision === "reject" ? STATUS.QA_REJECTED : STATUS.QA_APPROVED;
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({
        status: toStatus,
        qaDecision: toStatus === STATUS.QA_REJECTED ? "Rejected" : "Approved",
        qaSupervisorSignature: body.signature ?? null,
        qaReviewDate: todayString(),
        qaReviewNotes: body.notes ?? null,
        qaReviewedByUserId: req.session.userId,
        qaReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, toStatus, req.session.userId, body.notes);
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
}

router.post("/:id/qa-review", requireAuth, requirePermission("review_qa_requests"), qaReviewHandler);
router.patch("/:id/qa-review", requireAuth, requirePermission("review_qa_requests"), qaReviewHandler);

async function engineeringReviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.QA_APPROVED) {
      res.status(400).json({ error: "Request is not QA approved" });
      return;
    }
    const body = req.body as { decision?: string; notes?: string; assignedTechnicianUserId?: number | null; expectedWorkTimeFrom?: string; expectedWorkTimeTo?: string; signature?: string };
    const toStatus = body.decision === "reject" ? STATUS.REJECTED : STATUS.ACCEPTED;
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({
        status: toStatus,
        engineeringDecision: toStatus === STATUS.REJECTED ? "Rejected" : "Accepted",
        assignedTechnicianUserId: toStatus === STATUS.ACCEPTED ? body.assignedTechnicianUserId ?? null : null,
        expectedWorkTimeFrom: body.expectedWorkTimeFrom ?? null,
        expectedWorkTimeTo: body.expectedWorkTimeTo ?? null,
        engineeringSupervisorSignature: body.signature ?? null,
        engineeringReviewNotes: body.notes ?? null,
        engineeringReviewedByUserId: req.session.userId,
        engineeringReviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    if (toStatus === STATUS.ACCEPTED) await ensureEventForRequest(updated!);
    await addStatusHistory(request.id, request.status, toStatus, req.session.userId, body.notes);
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
}

router.post("/:id/engineering-review", requireAuth, requirePermission("review_engineering_requests"), engineeringReviewHandler);
router.patch("/:id/engineering-review", requireAuth, requirePermission("review_engineering_requests"), engineeringReviewHandler);

router.patch("/:id/assign-technician", requireAuth, requirePermission("review_engineering_requests"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.ACCEPTED) {
      res.status(400).json({ error: "Request is not accepted" });
      return;
    }
    const body = req.body as { assignedTechnicianUserId?: number | null };
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({ assignedTechnicianUserId: body.assignedTechnicianUserId ?? null, updatedAt: new Date() })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, request.status, req.session.userId, "Technician assignment updated");
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/start-work", requireAuth, requirePermission("fill_corrective_maintenance"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.ACCEPTED || !isAssignedTechnician(req, request)) {
      res.status(400).json({ error: "Request is not assigned and accepted for this technician" });
      return;
    }
    await ensureEventForRequest(request);
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({ status: STATUS.IN_PROGRESS, updatedAt: new Date() })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, STATUS.IN_PROGRESS, req.session.userId, "Corrective maintenance work started");
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
});

async function preliminaryFindingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || (request.status !== STATUS.ACCEPTED && request.status !== STATUS.IN_PROGRESS) || !isAssignedTechnician(req, request)) {
      res.status(400).json({ error: "Request is not accepted for corrective maintenance" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as Record<string, string | undefined>;
    await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        preliminaryCheckResults: body.preliminaryCheckResults ?? null,
        expectedWorkTimeFrom: body.expectedWorkTimeFrom ?? null,
        expectedWorkTimeTo: body.expectedWorkTimeTo ?? null,
        technicianName: body.technicianName ?? null,
        maintenanceTechnicianSignature: body.maintenanceTechnicianSignature ?? null,
        concernedSectionSupervisorSignature: body.concernedSectionSupervisorSignature ?? null,
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id));
    let updatedRequest = request;
    if (request.status === STATUS.ACCEPTED) {
      [updatedRequest] = await db
        .update(maintenanceRequestsTable)
        .set({ status: STATUS.IN_PROGRESS, updatedAt: new Date() })
        .where(eq(maintenanceRequestsTable.id, request.id))
        .returning();
      await addStatusHistory(request.id, request.status, STATUS.IN_PROGRESS, req.session.userId, "Preliminary findings started");
    }
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.put("/:id/preliminary-findings", requireAuth, requirePermission("fill_corrective_maintenance"), preliminaryFindingsHandler);
router.patch("/:id/preliminary-findings", requireAuth, requirePermission("fill_corrective_maintenance"), preliminaryFindingsHandler);

async function actionsTakenHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || (request.status !== STATUS.ACCEPTED && request.status !== STATUS.IN_PROGRESS) || !isAssignedTechnician(req, request)) {
      res.status(400).json({ error: "Request is not ready for completion" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as {
      actionsTaken?: string;
      remarksRecommendations?: string;
      performingStaff?: Array<{ no?: string; name?: string; signature?: string }>;
    };
    await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        actionsTaken: body.actionsTaken ?? null,
        remarksRecommendations: body.remarksRecommendations ?? null,
        performingStaff: JSON.stringify(body.performingStaff ?? []),
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id));
    const [updatedRequest] = await db
      .update(maintenanceRequestsTable)
      .set({ status: STATUS.COMPLETED, updatedAt: new Date() })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, STATUS.COMPLETED, req.session.userId, "Corrective maintenance actions recorded");
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.patch("/:id/actions-taken", requireAuth, requirePermission("fill_corrective_maintenance"), actionsTakenHandler);

async function handoverHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || (request.status !== STATUS.COMPLETED && request.status !== STATUS.IN_PROGRESS) || !isAssignedTechnician(req, request)) {
      res.status(400).json({ error: "Request is not ready for handover" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as {
      receiverName?: string;
      receiverSignature?: string;
      handoverDate?: string;
      engineeringSignature?: string;
    };
    await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        receiverName: body.receiverName ?? null,
        receiverSignature: body.receiverSignature ?? null,
        handoverDate: body.handoverDate ?? null,
        engineeringSignature: body.engineeringSignature ?? null,
        completedByUserId: req.session.userId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id));
    const [updatedRequest] = await db
      .update(maintenanceRequestsTable)
      .set({ status: STATUS.CLOSED, closedAt: new Date(), updatedAt: new Date() })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, STATUS.CLOSED, req.session.userId, "Corrective maintenance handed over and closed");
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.patch("/:id/handover", requireAuth, requirePermission("fill_corrective_maintenance"), handoverHandler);
router.put("/:id/actions-handover", requireAuth, requirePermission("fill_corrective_maintenance"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || (request.status !== STATUS.ACCEPTED && request.status !== STATUS.IN_PROGRESS && request.status !== STATUS.COMPLETED) || !isAssignedTechnician(req, request)) {
      res.status(400).json({ error: "Request is not ready for completion" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as {
      actionsTaken?: string;
      remarksRecommendations?: string;
      performingStaff?: Array<{ no?: string; name?: string; signature?: string }>;
      receiverName?: string;
      receiverSignature?: string;
      handoverDate?: string;
      engineeringSignature?: string;
    };
    await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        actionsTaken: body.actionsTaken ?? null,
        remarksRecommendations: body.remarksRecommendations ?? null,
        performingStaff: JSON.stringify(body.performingStaff ?? []),
        receiverName: body.receiverName ?? null,
        receiverSignature: body.receiverSignature ?? null,
        handoverDate: body.handoverDate ?? null,
        engineeringSignature: body.engineeringSignature ?? null,
        completedByUserId: req.session.userId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, event.id));
    const [updatedRequest] = await db
      .update(maintenanceRequestsTable)
      .set({ status: STATUS.CLOSED, closedAt: new Date(), updatedAt: new Date() })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(request.id, request.status, STATUS.CLOSED, req.session.userId, "Corrective maintenance completed and handed over");
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
});

export default router;
