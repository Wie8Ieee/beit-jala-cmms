import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  closedCorrectiveMaintenanceLogExclusionsTable,
  closedCorrectiveMaintenanceManualEntriesTable,
  correctiveMaintenanceEventsTable,
  correctiveMaintenanceRecordsTable,
  departmentsTable,
  eligibleSignerAssignmentsTable,
  externalMaintenanceRequestsTable,
  externalMaintenanceReceiptsTable,
  formHeadersTable,
  machinesTable,
  maintenanceRequestsTable,
  maintenanceRequestStatusHistoryTable,
  monthlyMaintenanceEvaluationReportsTable,
  rolesTable,
  signatureFieldPermissionsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
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
  EXTERNAL_MAINTENANCE: "External Maintenance",
} as const;

const CLOSED_CM_LOG_HEADER_ID = 0;

async function getClosedCorrectiveMaintenanceLogHeader() {
  const [existing] = await db
    .select()
    .from(formHeadersTable)
    .where(
      and(
        eq(formHeadersTable.documentType, "CLOSED_CORRECTIVE_MAINTENANCE_LOG"),
        eq(formHeadersTable.documentId, CLOSED_CM_LOG_HEADER_ID),
      ),
    );
  if (existing) return existing;
  const [created] = await db
    .insert(formHeadersTable)
    .values({
      documentType: "CLOSED_CORRECTIVE_MAINTENANCE_LOG",
      documentId: CLOSED_CM_LOG_HEADER_ID,
      companyName: "Beit Jala Pharmaceutical Co.",
      documentName: "سجل طلبات الصيانة العلاجية للأجهزة / الماكينات",
      documentNumber: "LOG-10-0659-0",
      effectiveOrExecutionDate: "18/03/2023",
      pageNumber: 1,
      totalPages: 1,
    })
    .returning();
  return created!;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date: string | null | undefined) {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null;
}

function firstParam(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0] as unknown;
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

function parseStaff(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRequestSummary(
  row: typeof maintenanceRequestsTable.$inferSelect,
) {
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

function formatEvent(
  event:
    | typeof correctiveMaintenanceEventsTable.$inferSelect
    | null
    | undefined,
) {
  if (!event) return null;
  return {
    ...event,
    performingStaff: parseStaff(event.performingStaff),
    completedAt: event.completedAt ? event.completedAt.toISOString() : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

async function addStatusHistory(
  requestId: number,
  fromStatus: string | null,
  toStatus: string,
  userId: number | undefined,
  notes?: string,
) {
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
  const [request] = await db
    .select()
    .from(maintenanceRequestsTable)
    .where(eq(maintenanceRequestsTable.id, id));
  return request ?? null;
}

async function getRequestDetail(
  request: typeof maintenanceRequestsTable.$inferSelect,
) {
  const [event] = await db
    .select()
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
  const history = await db
    .select()
    .from(maintenanceRequestStatusHistoryTable)
    .where(eq(maintenanceRequestStatusHistoryTable.requestId, request.id))
    .orderBy(
      asc(maintenanceRequestStatusHistoryTable.createdAt),
      asc(maintenanceRequestStatusHistoryTable.id),
    );

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

function ensureCanView(
  req: Request,
  request: typeof maintenanceRequestsTable.$inferSelect,
) {
  if (req.session.roleName === "Admin") return true;
  if (
    hasPermission(req, "manage_maintenance_requests") ||
    hasPermission(req, "review_qa_requests") ||
    hasPermission(req, "review_engineering_requests")
  )
    return true;
  if (
    hasPermission(req, "fill_corrective_maintenance") &&
    (request.status === STATUS.ACCEPTED ||
      request.status === STATUS.IN_PROGRESS ||
      request.status === STATUS.COMPLETED ||
      request.status === STATUS.CLOSED) &&
    request.assignedTechnicianUserId === req.session.userId
  )
    return true;
  if (
    hasPermission(req, "view_own_requests") &&
    req.session.userId === request.requestedByUserId
  )
    return true;
  return false;
}

function isAssignedTechnician(
  req: Request,
  request: typeof maintenanceRequestsTable.$inferSelect,
) {
  // Administrators can complete or close a corrective request when needed,
  // while all other users remain limited to their assigned request.
  return (
    req.session.roleName === "Admin" ||
    (!!request.assignedTechnicianUserId &&
      request.assignedTechnicianUserId === req.session.userId)
  );
}

async function hasAssignedSignatureAccess(
  userId: number | undefined,
  requestId: number,
) {
  if (!userId) return false;
  const [assignment] = await db
    .select({ id: eligibleSignerAssignmentsTable.id })
    .from(eligibleSignerAssignmentsTable)
    .where(
      and(
        eq(eligibleSignerAssignmentsTable.documentType, "MAINTENANCE_REQUEST"),
        eq(eligibleSignerAssignmentsTable.documentId, requestId),
        eq(eligibleSignerAssignmentsTable.eligibleUserId, userId),
        isNull(eligibleSignerAssignmentsTable.revokedAt),
      ),
    )
    .limit(1);
  if (assignment) return true;
  const [permanentPermission] = await db
    .select({ id: signatureFieldPermissionsTable.id })
    .from(signatureFieldPermissionsTable)
    .where(
      and(
        eq(signatureFieldPermissionsTable.eligibleUserId, userId),
        isNull(signatureFieldPermissionsTable.revokedAt),
      ),
    )
    .limit(1);
  return !!permanentPermission;
}

function formatExternalMaintenanceRequest(
  row: typeof externalMaintenanceRequestsTable.$inferSelect,
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatExternalMaintenanceReceipt(
  row: typeof externalMaintenanceReceiptsTable.$inferSelect,
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function nextRequestNumber() {
  const year = new Date().getFullYear();
  const [stats] = await db
    .select({ total: count() })
    .from(maintenanceRequestsTable);
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
    .leftJoin(
      departmentsTable,
      eq(machinesTable.departmentId, departmentsTable.id),
    )
    .where(eq(machinesTable.id, machineId));
  return machine ?? null;
}

async function getOrCreateCmRecord(
  machineId: number,
  executionDate = todayString(),
) {
  const [active] = await db
    .select()
    .from(correctiveMaintenanceRecordsTable)
    .where(
      and(
        eq(correctiveMaintenanceRecordsTable.machineId, machineId),
        eq(correctiveMaintenanceRecordsTable.status, "active"),
      ),
    )
    .orderBy(desc(correctiveMaintenanceRecordsTable.sequenceNumber))
    .limit(1);

  if (active) {
    const [eventStats] = await db
      .select({ total: count() })
      .from(correctiveMaintenanceEventsTable)
      .where(eq(correctiveMaintenanceEventsTable.recordId, active.id));
    // A record belongs to one calendar month. A request dated in a new month
    // therefore starts a new chained record, even when the prior page still
    // has unused lines.
    if (
      Number(eventStats?.total ?? 0) < active.maxRows &&
      monthKey(active.executionDate) === monthKey(executionDate)
    )
      return active;
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
      executionDate,
      machineName: machine.machineName,
      machineNumber: machine.machineNumber,
      machineLocation: machine.location ?? null,
      startupDate: machine.pmStartDate ?? null,
    })
    .returning();
  return created!;
}

// Summary used by the Reports screen.  Request data is intentionally read from
// the immutable maintenance-request rows, so historical reports remain stable.
router.get(
  "/reports/corrective-maintenance",
  requireAuth,
  async (req, res, next) => {
    try {
      const requestedYear = Number(firstParam(req.query.year));
      const year =
        Number.isInteger(requestedYear) &&
        requestedYear >= 2000 &&
        requestedYear <= 2100
          ? requestedYear
          : new Date().getFullYear();
      const requests = (await db.select().from(maintenanceRequestsTable))
        .filter((item) => item.requestDate?.startsWith(`${year}-`))
        .sort((a, b) =>
          (a.requestDate ?? "").localeCompare(b.requestDate ?? ""),
        );
      const completedStatuses = new Set([STATUS.COMPLETED, STATUS.CLOSED]);
      const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const rows = requests.filter(
          (item) => Number(item.requestDate?.slice(5, 7)) === month,
        );
        return {
          month,
          total: rows.length,
          completed: rows.filter((item) =>
            completedStatuses.has(
              item.status as typeof STATUS.COMPLETED | typeof STATUS.CLOSED,
            ),
          ).length,
          requests: rows.map((item) => ({
            id: item.id,
            requestReportNumber: item.requestReportNumber,
            machineName: item.machineName,
            machineNumber: item.machineNumber,
            requestDate: item.requestDate,
            status: item.status,
          })),
        };
      });
      res.json({
        year,
        annualTotal: requests.length,
        completedAnnualTotal: months.reduce(
          (total, month) => total + month.completed,
          0,
        ),
        months,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Annual abstract matching the company's Excel "Abstract of monthly Evaluation
// reports".  PM values come from the approved monthly evaluation records and
// corrective values come directly from the preserved maintenance requests.
router.get(
  "/reports/annual-maintenance-summary",
  requireAuth,
  async (req, res, next) => {
    try {
      const requestedYear = Number(firstParam(req.query.year));
      const year =
        Number.isInteger(requestedYear) &&
        requestedYear >= 2000 &&
        requestedYear <= 2100
          ? requestedYear
          : new Date().getFullYear();

      const [evaluations, requests] = await Promise.all([
        db
          .select()
          .from(monthlyMaintenanceEvaluationReportsTable)
          .where(eq(monthlyMaintenanceEvaluationReportsTable.year, year)),
        db.select().from(maintenanceRequestsTable),
      ]);
      const evaluationByMonth = new Map(
        evaluations.map((evaluation) => [evaluation.month, evaluation]),
      );
      const completedStatuses = new Set([STATUS.COMPLETED, STATUS.CLOSED]);

      const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const evaluation = evaluationByMonth.get(month);
        const correctiveRows = requests.filter((request) =>
          request.requestDate?.startsWith(
            `${year}-${String(month).padStart(2, "0")}`,
          ),
        );
        return {
          month,
          preventive: evaluation
            ? {
                planned: evaluation.totalPmActivities,
                achieved: evaluation.completedPmOnTime,
              }
            : null,
          corrective: correctiveRows.length
            ? {
                total: correctiveRows.length,
                achieved: correctiveRows.filter((request) =>
                  completedStatuses.has(
                    request.status as
                      | typeof STATUS.COMPLETED
                      | typeof STATUS.CLOSED,
                  ),
                ).length,
              }
            : null,
        };
      });

      res.json({ year, months });
    } catch (error) {
      next(error);
    }
  },
);

// FORM-10-0944-0.  The report is deliberately stored per calendar month so a
// completed evaluation remains available as part of the controlled record.
router.get(
  "/reports/monthly-maintenance-evaluation",
  requireAuth,
  async (req, res, next) => {
    try {
      const year =
        Number(firstParam(req.query.year)) || new Date().getFullYear();
      const month =
        Number(firstParam(req.query.month)) || new Date().getMonth() + 1;
      const [report] = await db
        .select()
        .from(monthlyMaintenanceEvaluationReportsTable)
        .where(
          and(
            eq(monthlyMaintenanceEvaluationReportsTable.year, year),
            eq(monthlyMaintenanceEvaluationReportsTable.month, month),
          ),
        );
      res.json(
        report ?? {
          year,
          month,
          delayedActivities: "",
          delayReason: "",
          followUpIncluded: "",
          totalPmActivities: 0,
          completedPmOnTime: 0,
          productionImpact: "",
          sparePartShortage: "",
          correctiveMaintenanceDetails: "",
          totalCorrectiveRequests: 0,
          unclosedCorrectiveRequests: 0,
          completedCorrectiveRequests: 0,
          externalMaintenanceDetails: "",
          totalExternalActivities: 0,
          completedExternalActivities: 0,
          employeeDelayImpact: "",
          workingDays: 0,
          lostWorkDays: 0,
          preparedBy: "",
          preparedDate: "",
          engineeringManagerSignature: "",
          engineeringManagerDate: "",
        },
      );
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/reports/monthly-maintenance-evaluation",
  requireAuth,
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const year = Number(body.year);
      const month = Number(body.month);
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        res.status(400).json({ error: "A valid month and year are required" });
        return;
      }
      const values = {
        delayedActivities: String(body.delayedActivities ?? ""),
        delayReason: String(body.delayReason ?? ""),
        followUpIncluded: String(body.followUpIncluded ?? ""),
        totalPmActivities: Math.max(0, Number(body.totalPmActivities) || 0),
        completedPmOnTime: Math.max(0, Number(body.completedPmOnTime) || 0),
        productionImpact: String(body.productionImpact ?? ""),
        sparePartShortage: String(body.sparePartShortage ?? ""),
        correctiveMaintenanceDetails: String(
          body.correctiveMaintenanceDetails ?? "",
        ),
        totalCorrectiveRequests: Math.max(
          0,
          Number(body.totalCorrectiveRequests) || 0,
        ),
        unclosedCorrectiveRequests: Math.max(
          0,
          Number(body.unclosedCorrectiveRequests) || 0,
        ),
        completedCorrectiveRequests: Math.max(
          0,
          Number(body.completedCorrectiveRequests) || 0,
        ),
        externalMaintenanceDetails: String(
          body.externalMaintenanceDetails ?? "",
        ),
        totalExternalActivities: Math.max(
          0,
          Number(body.totalExternalActivities) || 0,
        ),
        completedExternalActivities: Math.max(
          0,
          Number(body.completedExternalActivities) || 0,
        ),
        employeeDelayImpact: String(body.employeeDelayImpact ?? ""),
        workingDays: Math.max(0, Number(body.workingDays) || 0),
        lostWorkDays: Math.max(0, Number(body.lostWorkDays) || 0),
        preparedBy: String(body.preparedBy ?? ""),
        preparedDate: String(body.preparedDate ?? ""),
        engineeringManagerSignature: String(
          body.engineeringManagerSignature ?? "",
        ),
        engineeringManagerDate: String(body.engineeringManagerDate ?? ""),
        updatedAt: new Date(),
      };
      const [existing] = await db
        .select({ id: monthlyMaintenanceEvaluationReportsTable.id })
        .from(monthlyMaintenanceEvaluationReportsTable)
        .where(
          and(
            eq(monthlyMaintenanceEvaluationReportsTable.year, year),
            eq(monthlyMaintenanceEvaluationReportsTable.month, month),
          ),
        );
      const [saved] = existing
        ? await db
            .update(monthlyMaintenanceEvaluationReportsTable)
            .set(values)
            .where(eq(monthlyMaintenanceEvaluationReportsTable.id, existing.id))
            .returning()
        : await db
            .insert(monthlyMaintenanceEvaluationReportsTable)
            .values({
              ...values,
              year,
              month,
              createdByUserId: req.session.userId ?? null,
            })
            .returning();
      res.json(saved);
    } catch (err) {
      next(err);
    }
  },
);

async function ensureEventForRequest(
  request: typeof maintenanceRequestsTable.$inferSelect,
) {
  const [existing] = await db
    .select()
    .from(correctiveMaintenanceEventsTable)
    .where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
  if (existing) return existing;

  const record = await getOrCreateCmRecord(
    request.machineId,
    request.requestDate,
  );
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

    if (
      scope === "own" ||
      (!permissions.includes("manage_maintenance_requests") &&
        permissions.includes("view_own_requests"))
    ) {
      ownOnly = true;
    } else if (scope === "qa") {
      allowedStatuses = [STATUS.PENDING_QA];
    } else if (scope === "engineering") {
      allowedStatuses = [STATUS.QA_APPROVED];
    } else if (scope === "technician") {
      allowedStatuses = [STATUS.ACCEPTED, STATUS.IN_PROGRESS, STATUS.COMPLETED];
    }

    let rows = await db
      .select()
      .from(maintenanceRequestsTable)
      .orderBy(desc(maintenanceRequestsTable.createdAt));
    const signatureAssignments = req.session.userId
      ? await db
          .select({ documentId: eligibleSignerAssignmentsTable.documentId })
          .from(eligibleSignerAssignmentsTable)
          .where(
            and(
              eq(
                eligibleSignerAssignmentsTable.documentType,
                "MAINTENANCE_REQUEST",
              ),
              eq(
                eligibleSignerAssignmentsTable.eligibleUserId,
                req.session.userId,
              ),
              isNull(eligibleSignerAssignmentsTable.revokedAt),
            ),
          )
      : [];
    const signatureRequestIds = new Set(
      signatureAssignments.map((assignment) => assignment.documentId),
    );
    const permanentSignaturePermissions = req.session.userId
      ? await db
          .select({ id: signatureFieldPermissionsTable.id })
          .from(signatureFieldPermissionsTable)
          .where(
            and(
              eq(
                signatureFieldPermissionsTable.eligibleUserId,
                req.session.userId,
              ),
              isNull(signatureFieldPermissionsTable.revokedAt),
            ),
          )
          .limit(1)
      : [];
    const hasPermanentSignatureAccess =
      permanentSignaturePermissions.length > 0;
    if (ownOnly)
      rows = rows.filter(
        (row) =>
          row.requestedByUserId === req.session.userId ||
          signatureRequestIds.has(row.id) ||
          hasPermanentSignatureAccess,
      );
    if (allowedStatuses)
      rows = rows.filter((row) => allowedStatuses.includes(row.status));
    if (scope === "technician")
      rows = rows.filter(
        (row) => row.assignedTechnicianUserId === req.session.userId,
      );
    rows = rows.filter(
      (row) =>
        ensureCanView(req, row) ||
        signatureRequestIds.has(row.id) ||
        hasPermanentSignatureAccess,
    );
    res.json(rows.map(formatRequestSummary));
  } catch (err) {
    next(err);
  }
});

router.get(
  "/technicians",
  requireAuth,
  requirePermission("review_engineering_requests"),
  async (_req, res, next) => {
    try {
      const users = await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          fullName: usersTable.fullName,
        })
        .from(usersTable)
        .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
        .where(
          and(
            eq(usersTable.isActive, true),
            eq(rolesTable.name, "Maintenance Technician"),
          ),
        );
      res.json(users);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/machines",
  requireAuth,
  requirePermission("submit_maintenance_request"),
  async (_req, res, next) => {
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
        .leftJoin(
          departmentsTable,
          eq(machinesTable.departmentId, departmentsTable.id),
        )
        .orderBy(asc(machinesTable.machineName));
      res.json(machines);
    } catch (err) {
      next(err);
    }
  },
);

// LOG-10-0659-0: closed requests populate the register automatically. Manual
// entries are restricted supplemental records for exceptional cases only.
router.get(
  "/closed-log/header",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (_req, res, next) => {
    try {
      res.json(await getClosedCorrectiveMaintenanceLogHeader());
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/closed-log/header",
  requireAuth,
  requirePermission("edit_header"),
  async (req, res, next) => {
    try {
      const current = await getClosedCorrectiveMaintenanceLogHeader();
      const body = req.body as {
        documentNumber?: string;
        effectiveOrExecutionDate?: string | null;
      };
      const [saved] = await db
        .update(formHeadersTable)
        .set({
          documentNumber: body.documentNumber?.trim() || current.documentNumber,
          effectiveOrExecutionDate:
            body.effectiveOrExecutionDate?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(formHeadersTable.id, current.id))
        .returning();
      res.json(saved);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/closed-log",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (_req, res, next) => {
    try {
      const [rows, exclusions] = await Promise.all([
        db
          .select({
            id: maintenanceRequestsTable.id,
            machineName: maintenanceRequestsTable.machineName,
            machineNumber: maintenanceRequestsTable.machineNumber,
            requestDate: maintenanceRequestsTable.requestDate,
            requestReportNumber: maintenanceRequestsTable.requestReportNumber,
            priority: maintenanceRequestsTable.priority,
            closedAt: maintenanceRequestsTable.closedAt,
            remarks: correctiveMaintenanceEventsTable.remarksRecommendations,
          })
          .from(maintenanceRequestsTable)
          .leftJoin(
            correctiveMaintenanceEventsTable,
            eq(
              correctiveMaintenanceEventsTable.requestId,
              maintenanceRequestsTable.id,
            ),
          )
          .where(eq(maintenanceRequestsTable.status, STATUS.CLOSED))
          .orderBy(
            desc(maintenanceRequestsTable.closedAt),
            desc(maintenanceRequestsTable.id),
          ),
        db
          .select({
            maintenanceRequestId:
              closedCorrectiveMaintenanceLogExclusionsTable.maintenanceRequestId,
          })
          .from(closedCorrectiveMaintenanceLogExclusionsTable),
      ]);
      const excludedRequestIds = new Set(
        exclusions.map((row) => row.maintenanceRequestId),
      );

      const manualRows = await db
        .select()
        .from(closedCorrectiveMaintenanceManualEntriesTable)
        .where(isNull(closedCorrectiveMaintenanceManualEntriesTable.deletedAt))
        .orderBy(
          desc(closedCorrectiveMaintenanceManualEntriesTable.closedDate),
          desc(closedCorrectiveMaintenanceManualEntriesTable.id),
        );

      const automaticRows = rows
        .filter((row) => !excludedRequestIds.has(row.id))
        .map((row) => ({
          id: `automatic-${row.id}`,
          source: "automatic" as const,
          closedDate: row.closedAt
            ? row.closedAt.toISOString().slice(0, 10)
            : "",
          remarks: row.remarks ?? "",
          machineName: row.machineName,
          machineNumber: row.machineNumber,
          requestDate: row.requestDate,
          requestReportNumber: row.requestReportNumber,
          priority: row.priority,
        }));
      const manualLogRows = manualRows.map((row) => ({
        id: `manual-${row.id}`,
        source: "manual" as const,
        machineName: row.machineName,
        machineNumber: row.machineNumber,
        requestDate: row.requestDate,
        requestReportNumber: row.requestReportNumber,
        priority: row.priority,
        closedDate: row.closedDate,
        remarks: row.remarks ?? "",
      }));

      res.json(
        [...automaticRows, ...manualLogRows].sort(
          (a, b) =>
            b.closedDate.localeCompare(a.closedDate) ||
            b.id.localeCompare(a.id),
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/closed-log/manual",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const body = req.body as {
        machineName?: string;
        machineNumber?: string;
        requestDate?: string;
        requestReportNumber?: string;
        priority?: string;
        closedDate?: string;
        remarks?: string;
      };
      const required = [
        body.machineName,
        body.machineNumber,
        body.requestDate,
        body.requestReportNumber,
        body.closedDate,
      ];
      if (required.some((value) => !value?.trim())) {
        res
          .status(400)
          .json({
            error:
              "machineName, machineNumber, requestDate, requestReportNumber, and closedDate are required",
          });
        return;
      }
      const [created] = await db
        .insert(closedCorrectiveMaintenanceManualEntriesTable)
        .values({
          machineName: body.machineName!.trim(),
          machineNumber: body.machineNumber!.trim(),
          requestDate: body.requestDate!.trim(),
          requestReportNumber: body.requestReportNumber!.trim(),
          priority: body.priority === "urgent" ? "urgent" : "normal",
          closedDate: body.closedDate!.trim(),
          remarks: body.remarks?.trim() || null,
          createdByUserId: req.session.userId!,
        })
        .returning();
      res.status(201).json({
        id: `manual-${created.id}`,
        source: "manual",
        machineName: created.machineName,
        machineNumber: created.machineNumber,
        requestDate: created.requestDate,
        requestReportNumber: created.requestReportNumber,
        priority: created.priority,
        closedDate: created.closedDate,
        remarks: created.remarks ?? "",
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/closed-log/manual/:id",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id);
      if (!id) {
        res.status(400).json({ error: "Invalid manual log entry id" });
        return;
      }
      const [deleted] = await db
        .update(closedCorrectiveMaintenanceManualEntriesTable)
        .set({
          deletedAt: new Date(),
          deletedByUserId: req.session.userId!,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(closedCorrectiveMaintenanceManualEntriesTable.id, id),
            isNull(closedCorrectiveMaintenanceManualEntriesTable.deletedAt),
          ),
        )
        .returning({ id: closedCorrectiveMaintenanceManualEntriesTable.id });
      if (!deleted) {
        res.status(404).json({ error: "Manual log entry not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/closed-log/automatic/:id",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const requestId = parseIdParam(req.params.id);
      if (!requestId) {
        res.status(400).json({ error: "Invalid maintenance request id" });
        return;
      }
      const [request] = await db
        .select({ id: maintenanceRequestsTable.id })
        .from(maintenanceRequestsTable)
        .where(
          and(
            eq(maintenanceRequestsTable.id, requestId),
            eq(maintenanceRequestsTable.status, STATUS.CLOSED),
          ),
        );
      if (!request) {
        res.status(404).json({ error: "Closed maintenance request not found" });
        return;
      }
      await db
        .insert(closedCorrectiveMaintenanceLogExclusionsTable)
        .values({
          maintenanceRequestId: requestId,
          excludedByUserId: req.session.userId!,
        })
        .onConflictDoNothing();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  requireAuth,
  requirePermission("submit_maintenance_request"),
  async (req, res, next) => {
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
        res
          .status(400)
          .json({
            error:
              "machineId, requestDate, and failureDescription are required",
          });
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
          departmentSection:
            body.departmentSection ?? machine.departmentName ?? null,
          priority: body.priority === "urgent" ? "urgent" : "normal",
          machineName: machine.machineName,
          machineNumber: machine.machineNumber,
          requestDate: body.requestDate,
          failureDescription: body.failureDescription,
          reportingPersonName: body.reportingPersonName ?? null,
          reportingPersonSignature: body.reportingPersonSignature ?? null,
          departmentSupervisorName: body.departmentSupervisorName ?? null,
          departmentSupervisorSignature:
            body.departmentSupervisorSignature ?? null,
          status: STATUS.PENDING_QA,
        })
        .returning();
      await addStatusHistory(
        created!.id,
        null,
        STATUS.SUBMITTED,
        req.session.userId,
        "Request submitted",
      );
      await addStatusHistory(
        created!.id,
        STATUS.SUBMITTED,
        STATUS.PENDING_QA,
        req.session.userId,
        "Routed to QA Supervisor",
      );
      res.status(201).json(await getRequestDetail(created!));
    } catch (err) {
      next(err);
    }
  },
);

router.get("/by-number/:requestNumber", requireAuth, async (req, res, next) => {
  try {
    const requestNumber = firstParam(req.params.requestNumber) ?? "";
    const [request] = await db
      .select()
      .from(maintenanceRequestsTable)
      .where(eq(maintenanceRequestsTable.requestReportNumber, requestNumber));
    if (!request || !ensureCanView(req, request)) {
      res.status(404).json({ error: "Maintenance request not found" });
      return;
    }
    res.json(await getRequestDetail(request));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/external-maintenance", requireAuth, async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (
      !request ||
      (!ensureCanView(req, request) &&
        !(await hasAssignedSignatureAccess(req.session.userId, request.id)))
    ) {
      res.status(404).json({ error: "Maintenance request not found" });
      return;
    }
    const [externalRequest] = await db
      .select()
      .from(externalMaintenanceRequestsTable)
      .where(
        eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
      );
    if (!externalRequest) {
      res
        .status(404)
        .json({ error: "External maintenance request has not been created" });
      return;
    }
    res.json({
      request: formatRequestSummary(request),
      externalRequest: formatExternalMaintenanceRequest(externalRequest),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/external-maintenance",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        request.status === STATUS.CLOSED ||
        request.status === STATUS.REJECTED ||
        request.status === STATUS.QA_REJECTED
      ) {
        res
          .status(400)
          .json({
            error:
              "This maintenance request cannot be converted to external maintenance",
          });
        return;
      }

      const [existing] = await db
        .select()
        .from(externalMaintenanceRequestsTable)
        .where(
          eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
        );
      if (existing) {
        res.json({
          request: formatRequestSummary(request),
          externalRequest: formatExternalMaintenanceRequest(existing),
        });
        return;
      }

      const [event] = await db
        .select()
        .from(correctiveMaintenanceEventsTable)
        .where(eq(correctiveMaintenanceEventsTable.requestId, request.id));
      const [created] = await db
        .insert(externalMaintenanceRequestsTable)
        .values({
          maintenanceRequestId: request.id,
          // FORM-00-0077-1 uses the original maintenance request number; it does
          // not create a second, unrelated request number.
          externalRequestNumber: request.requestReportNumber,
          requestDate: request.requestDate,
          departmentSection: request.departmentSection,
          requiredMaintenance: request.failureDescription,
          preliminaryFindings: event?.preliminaryCheckResults ?? null,
        })
        .returning();
      const [updatedRequest] = await db
        .update(maintenanceRequestsTable)
        .set({ status: STATUS.EXTERNAL_MAINTENANCE, updatedAt: new Date() })
        .where(eq(maintenanceRequestsTable.id, request.id))
        .returning();
      await addStatusHistory(
        request.id,
        request.status,
        STATUS.EXTERNAL_MAINTENANCE,
        req.session.userId,
        `Converted to external maintenance: ${created!.externalRequestNumber}`,
      );
      res
        .status(201)
        .json({
          request: formatRequestSummary(updatedRequest!),
          externalRequest: formatExternalMaintenanceRequest(created!),
        });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/external-maintenance",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (!request) {
        res.status(404).json({ error: "Maintenance request not found" });
        return;
      }
      const body = req.body as Partial<{
        technicianSuggestions: string;
        maintenanceTechnicianSignature: string;
        maintenanceTechnicianDate: string;
        departmentManagerSignature: string;
        departmentManagerDate: string;
        generalManagerSignature: string;
        generalManagerDate: string;
      }>;
      const [updated] = await db
        .update(externalMaintenanceRequestsTable)
        .set({
          technicianSuggestions: body.technicianSuggestions ?? null,
          maintenanceTechnicianSignature:
            body.maintenanceTechnicianSignature ?? null,
          maintenanceTechnicianDate: body.maintenanceTechnicianDate ?? null,
          departmentManagerSignature: body.departmentManagerSignature ?? null,
          departmentManagerDate: body.departmentManagerDate ?? null,
          generalManagerSignature: body.generalManagerSignature ?? null,
          generalManagerDate: body.generalManagerDate ?? null,
          updatedAt: new Date(),
        })
        .where(
          eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
        )
        .returning();
      if (!updated) {
        res
          .status(404)
          .json({ error: "External maintenance request has not been created" });
        return;
      }
      res.json({
        request: formatRequestSummary(request),
        externalRequest: formatExternalMaintenanceRequest(updated),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id/external-maintenance-receipt",
  requireAuth,
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        (!ensureCanView(req, request) &&
          !(await hasAssignedSignatureAccess(req.session.userId, request.id)))
      ) {
        res.status(404).json({ error: "Maintenance request not found" });
        return;
      }
      const [externalRequest] = await db
        .select()
        .from(externalMaintenanceRequestsTable)
        .where(
          eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
        );
      if (!externalRequest) {
        res
          .status(404)
          .json({ error: "External maintenance request has not been created" });
        return;
      }
      const [receipt] = await db
        .select()
        .from(externalMaintenanceReceiptsTable)
        .where(
          eq(
            externalMaintenanceReceiptsTable.externalMaintenanceRequestId,
            externalRequest.id,
          ),
        );
      if (!receipt) {
        res
          .status(404)
          .json({ error: "External maintenance receipt has not been created" });
        return;
      }
      res.json({
        request: formatRequestSummary(request),
        externalRequest: formatExternalMaintenanceRequest(externalRequest),
        receipt: formatExternalMaintenanceReceipt(receipt),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/external-maintenance-receipt",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (!request || request.status !== STATUS.EXTERNAL_MAINTENANCE) {
        res
          .status(400)
          .json({ error: "Request is not in external maintenance" });
        return;
      }
      const [externalRequest] = await db
        .select()
        .from(externalMaintenanceRequestsTable)
        .where(
          eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
        );
      if (!externalRequest) {
        res
          .status(404)
          .json({ error: "External maintenance request has not been created" });
        return;
      }
      const [existing] = await db
        .select()
        .from(externalMaintenanceReceiptsTable)
        .where(
          eq(
            externalMaintenanceReceiptsTable.externalMaintenanceRequestId,
            externalRequest.id,
          ),
        );
      if (existing) {
        res.json({
          request: formatRequestSummary(request),
          externalRequest: formatExternalMaintenanceRequest(externalRequest),
          receipt: formatExternalMaintenanceReceipt(existing),
        });
        return;
      }
      const [created] = await db
        .insert(externalMaintenanceReceiptsTable)
        .values({
          externalMaintenanceRequestId: externalRequest.id,
          maintenanceType: "صيانة خارجية",
          requestingDepartment: externalRequest.departmentSection,
          receiptDate: todayString(),
        })
        .returning();
      res
        .status(201)
        .json({
          request: formatRequestSummary(request),
          externalRequest: formatExternalMaintenanceRequest(externalRequest),
          receipt: formatExternalMaintenanceReceipt(created!),
        });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/external-maintenance-receipt",
  requireAuth,
  requirePermission("manage_maintenance_requests"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (!request) {
        res.status(404).json({ error: "Maintenance request not found" });
        return;
      }
      const [externalRequest] = await db
        .select()
        .from(externalMaintenanceRequestsTable)
        .where(
          eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id),
        );
      if (!externalRequest) {
        res
          .status(404)
          .json({ error: "External maintenance request has not been created" });
        return;
      }
      const body = req.body as Partial<{
        maintenanceType: string;
        receiptDate: string;
        performingEntity: string;
        workAcceptanceReport: string;
        workFailureCause: string;
        examinerName: string;
        examinerSignature: string;
      }>;
      const [updated] = await db
        .update(externalMaintenanceReceiptsTable)
        .set({
          maintenanceType: body.maintenanceType ?? "صيانة خارجية",
          receiptDate: body.receiptDate ?? null,
          performingEntity: body.performingEntity ?? null,
          workAcceptanceReport: body.workAcceptanceReport ?? null,
          workFailureCause: body.workFailureCause ?? null,
          examinerName: body.examinerName ?? null,
          examinerSignature: body.examinerSignature ?? null,
          updatedAt: new Date(),
        })
        .where(
          eq(
            externalMaintenanceReceiptsTable.externalMaintenanceRequestId,
            externalRequest.id,
          ),
        )
        .returning();
      if (!updated) {
        res
          .status(404)
          .json({ error: "External maintenance receipt has not been created" });
        return;
      }
      res.json({
        request: formatRequestSummary(request),
        externalRequest: formatExternalMaintenanceRequest(externalRequest),
        receipt: formatExternalMaintenanceReceipt(updated),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const request = await getRequest(id);
    if (
      !request ||
      (!ensureCanView(req, request) &&
        !(await hasAssignedSignatureAccess(req.session.userId, request.id)))
    ) {
      res.status(404).json({ error: "Maintenance request not found" });
      return;
    }
    res.json(await getRequestDetail(request));
  } catch (err) {
    next(err);
  }
});

async function qaReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.PENDING_QA) {
      res.status(400).json({ error: "Request is not pending QA approval" });
      return;
    }
    const body = req.body as {
      decision?: string;
      notes?: string;
      signature?: string;
    };
    const toStatus =
      body.decision === "reject" ? STATUS.QA_REJECTED : STATUS.QA_APPROVED;
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
    await addStatusHistory(
      request.id,
      request.status,
      toStatus,
      req.session.userId,
      body.notes,
    );
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
}

router.post(
  "/:id/qa-review",
  requireAuth,
  requirePermission("review_qa_requests"),
  qaReviewHandler,
);
router.patch(
  "/:id/qa-review",
  requireAuth,
  requirePermission("review_qa_requests"),
  qaReviewHandler,
);

async function engineeringReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.QA_APPROVED) {
      res.status(400).json({ error: "Request is not QA approved" });
      return;
    }
    const body = req.body as {
      decision?: string;
      notes?: string;
      assignedTechnicianUserId?: number | null;
      expectedWorkTimeFrom?: string;
      expectedWorkTimeTo?: string;
      signature?: string;
    };
    const toStatus =
      body.decision === "reject" ? STATUS.REJECTED : STATUS.ACCEPTED;
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({
        status: toStatus,
        engineeringDecision:
          toStatus === STATUS.REJECTED ? "Rejected" : "Accepted",
        assignedTechnicianUserId:
          toStatus === STATUS.ACCEPTED
            ? (body.assignedTechnicianUserId ?? null)
            : null,
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
    await addStatusHistory(
      request.id,
      request.status,
      toStatus,
      req.session.userId,
      body.notes,
    );
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
}

router.post(
  "/:id/engineering-review",
  requireAuth,
  requirePermission("review_engineering_requests"),
  engineeringReviewHandler,
);
router.patch(
  "/:id/engineering-review",
  requireAuth,
  requirePermission("review_engineering_requests"),
  engineeringReviewHandler,
);

router.patch(
  "/:id/assign-technician",
  requireAuth,
  requirePermission("review_engineering_requests"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (!request || request.status !== STATUS.ACCEPTED) {
        res.status(400).json({ error: "Request is not accepted" });
        return;
      }
      const body = req.body as { assignedTechnicianUserId?: number | null };
      const [updated] = await db
        .update(maintenanceRequestsTable)
        .set({
          assignedTechnicianUserId: body.assignedTechnicianUserId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceRequestsTable.id, request.id))
        .returning();
      await addStatusHistory(
        request.id,
        request.status,
        request.status,
        req.session.userId,
        "Technician assignment updated",
      );
      res.json(await getRequestDetail(updated!));
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/start-work",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        request.status !== STATUS.ACCEPTED ||
        !isAssignedTechnician(req, request)
      ) {
        res
          .status(400)
          .json({
            error: "Request is not assigned and accepted for this technician",
          });
        return;
      }
      await ensureEventForRequest(request);
      const [updated] = await db
        .update(maintenanceRequestsTable)
        .set({ status: STATUS.IN_PROGRESS, updatedAt: new Date() })
        .where(eq(maintenanceRequestsTable.id, request.id))
        .returning();
      await addStatusHistory(
        request.id,
        request.status,
        STATUS.IN_PROGRESS,
        req.session.userId,
        "Corrective maintenance work started",
      );
      res.json(await getRequestDetail(updated!));
    } catch (err) {
      next(err);
    }
  },
);

async function preliminaryFindingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (
      !request ||
      (request.status !== STATUS.ACCEPTED &&
        request.status !== STATUS.IN_PROGRESS) ||
      !isAssignedTechnician(req, request)
    ) {
      res
        .status(400)
        .json({ error: "Request is not accepted for corrective maintenance" });
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
        maintenanceTechnicianSignature:
          body.maintenanceTechnicianSignature ?? null,
        concernedSectionSupervisorSignature:
          body.concernedSectionSupervisorSignature ?? null,
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
      await addStatusHistory(
        request.id,
        request.status,
        STATUS.IN_PROGRESS,
        req.session.userId,
        "Preliminary findings started",
      );
    }
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.put(
  "/:id/preliminary-findings",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  preliminaryFindingsHandler,
);
router.patch(
  "/:id/preliminary-findings",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  preliminaryFindingsHandler,
);

async function actionsTakenHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (
      !request ||
      (request.status !== STATUS.ACCEPTED &&
        request.status !== STATUS.IN_PROGRESS) ||
      !isAssignedTechnician(req, request)
    ) {
      res.status(400).json({ error: "Request is not ready for completion" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as {
      actionsTaken?: string;
      remarksRecommendations?: string;
      performingStaff?: Array<{
        no?: string;
        name?: string;
        signature?: string;
      }>;
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
    await addStatusHistory(
      request.id,
      request.status,
      STATUS.COMPLETED,
      req.session.userId,
      "Corrective maintenance actions recorded",
    );
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.patch(
  "/:id/actions-taken",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  actionsTakenHandler,
);

async function handoverHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (
      !request ||
      (request.status !== STATUS.COMPLETED &&
        request.status !== STATUS.IN_PROGRESS) ||
      !isAssignedTechnician(req, request)
    ) {
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
      .set({
        status: STATUS.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    await addStatusHistory(
      request.id,
      request.status,
      STATUS.CLOSED,
      req.session.userId,
      "Corrective maintenance handed over and closed",
    );
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.patch(
  "/:id/handover",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  handoverHandler,
);
router.put(
  "/:id/actions-handover",
  requireAuth,
  requirePermission("fill_corrective_maintenance"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        (request.status !== STATUS.ACCEPTED &&
          request.status !== STATUS.IN_PROGRESS &&
          request.status !== STATUS.COMPLETED) ||
        !isAssignedTechnician(req, request)
      ) {
        res.status(400).json({ error: "Request is not ready for completion" });
        return;
      }
      const event = await ensureEventForRequest(request);
      const body = req.body as {
        actionsTaken?: string;
        remarksRecommendations?: string;
        performingStaff?: Array<{
          no?: string;
          name?: string;
          signature?: string;
        }>;
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
        .set({
          status: STATUS.CLOSED,
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(maintenanceRequestsTable.id, request.id))
        .returning();
      await addStatusHistory(
        request.id,
        request.status,
        STATUS.CLOSED,
        req.session.userId,
        "Corrective maintenance completed and handed over",
      );
      res.json(await getRequestDetail(updatedRequest!));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
