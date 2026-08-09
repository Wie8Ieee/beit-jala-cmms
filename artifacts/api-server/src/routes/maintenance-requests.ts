import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { randomUUID } from "node:crypto";
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
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  pmInspectionsTable,
  rolesTable,
  signatureFieldPermissionsTable,
  signaturesTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, isNull, like } from "drizzle-orm";
import { parseIdParam, requireAnyPermission, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

const STATUS = {
  SUBMITTED: "Submitted",
  PENDING_SUPERVISOR: "Pending Department Supervisor Approval",
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
const MAINTENANCE_REQUEST_NUMBERING_HEADER_ID = 0;

async function getMaintenanceRequestNumberingStart() {
  const [setting] = await db
    .select({ documentNumber: formHeadersTable.documentNumber })
    .from(formHeadersTable)
    .where(
      and(
        eq(formHeadersTable.documentType, "MAINTENANCE_REQUEST_NUMBERING"),
        eq(formHeadersTable.documentId, MAINTENANCE_REQUEST_NUMBERING_HEADER_ID),
      ),
    );
  const value = setting?.documentNumber.trim() ?? "";
  return /^\d+$/.test(value) ? Number(value) : null;
}

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

type CorrectiveRepairTimeSlot = {
  date?: unknown;
  from?: unknown;
  to?: unknown;
  repairDate?: unknown;
  repairTimeFrom?: unknown;
  repairTimeTo?: unknown;
};

function parseCorrectiveRepairTimeSlots(value: unknown): CorrectiveRepairTimeSlot[] {
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter(
          (slot): slot is CorrectiveRepairTimeSlot =>
            Boolean(slot) && typeof slot === "object",
        )
      : [];
  } catch {
    return [];
  }
}

function repairSlotText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type ParsedRepairDate = {
  year: number;
  month: number;
  iso: string;
};

function validRepairDate(year: number, month: number, day: number): ParsedRepairDate | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

// Repair dates can originate from native date inputs (YYYY-MM-DD) or older
// records written in the printed DD/MM/YYYY format. Normalize both before
// grouping the report by month.
function parseRepairDate(value: unknown): ParsedRepairDate | null {
  const text = repairSlotText(value);
  const isoMatch = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(text);
  if (isoMatch) {
    return validRepairDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const localizedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(text);
  if (!localizedMatch) return null;

  // The CMMS print forms use DD/MM/YYYY. Fall back to MM/DD/YYYY only when
  // the first interpretation is not a valid calendar date.
  return (
    validRepairDate(Number(localizedMatch[3]), Number(localizedMatch[2]), Number(localizedMatch[1])) ??
    validRepairDate(Number(localizedMatch[3]), Number(localizedMatch[1]), Number(localizedMatch[2]))
  );
}

function repairTimeToMinutes(value: unknown): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(repairSlotText(value));
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "PM" ? 12 : 0);
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
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
    // A temporary internal key keeps unapproved requests distinct without
    // exposing an official maintenance-request number before Engineering
    // accepts the request.
    requestReportNumber: isPendingRequestNumber(row.requestReportNumber)
      ? ""
      : row.requestReportNumber,
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
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
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
  const reviewerIds = [request.qaReviewedByUserId, request.engineeringReviewedByUserId].filter((id): id is number => id !== null);
  const reviewers = reviewerIds.length
    ? await db.select({ id: usersTable.id, fullName: usersTable.fullName, username: usersTable.username }).from(usersTable)
    : [];
  const reviewerName = (id: number | null) => {
    const reviewer = reviewers.find((item) => item.id === id);
    return reviewer ? (reviewer.fullName || reviewer.username) : null;
  };

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
    qaReviewerName: reviewerName(request.qaReviewedByUserId),
    engineeringDecision: request.engineeringDecision,
    assignedTechnicianUserId: request.assignedTechnicianUserId,
    engineeringSupervisorSignature: request.engineeringSupervisorSignature,
    engineeringReviewNotes: request.engineeringReviewNotes,
    engineeringReviewerName: reviewerName(request.engineeringReviewedByUserId),
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
    request.status === STATUS.EXTERNAL_MAINTENANCE &&
    hasPermission(req, "view_external_maintenance")
  )
    return true;
  if (
    hasPermission(req, "manage_maintenance_requests") ||
    hasPermission(req, "review_department_requests") ||
    hasPermission(req, "review_qa_requests") ||
    hasPermission(req, "review_engineering_requests")
  )
    return true;
  if (
    canFillPreliminaryFindings(req) &&
    (request.status === STATUS.ACCEPTED ||
      request.status === STATUS.IN_PROGRESS ||
      request.status === STATUS.COMPLETED ||
      request.status === STATUS.CLOSED)
  )
    return true;
  if (
    canWorkOnCorrectiveMaintenance(req) &&
    (request.status === STATUS.ACCEPTED ||
      request.status === STATUS.IN_PROGRESS ||
      request.status === STATUS.COMPLETED ||
      request.status === STATUS.CLOSED)
  )
    return true;
  if (
    hasPermission(req, "view_own_requests") &&
    req.session.userId === request.requestedByUserId
  )
    return true;
  return false;
}

function canWorkOnCorrectiveMaintenance(req: Request) {
  // The permission, rather than a display name for the role, controls access.
  // This keeps the form usable when role names are localized or customized.
  return hasPermission(req, "fill_corrective_maintenance") ||
    hasPermission(req, "manage_maintenance_requests");
}

function canFillPreliminaryFindings(req: Request) {
  return canWorkOnCorrectiveMaintenance(req) ||
    hasPermission(req, "fill_preliminary_findings");
}

async function currentUserSignature(userId: number | undefined, fallback: string) {
  if (!userId) return fallback;
  const [user] = await db
    .select({ fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.signatureData || user?.fullName || user?.username || fallback;
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

function isPendingRequestNumber(value: string) {
  return value.startsWith("PENDING-");
}

function pendingRequestNumber() {
  return `PENDING-${randomUUID()}`;
}

function requestNumberDate(value: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

async function nextApprovedRequestNumber(requestDate: string) {
  const date = requestNumberDate(requestDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const rows = await db
    .select({ requestReportNumber: maintenanceRequestsTable.requestReportNumber })
    .from(maintenanceRequestsTable)
    .where(like(maintenanceRequestsTable.requestReportNumber, `%/${year}`));
  const lastSequence = rows.reduce((highest, row) => {
    const match = /^(\d+)\/\d{1,2}\/\d{4}$/.exec(row.requestReportNumber);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  // For a newly deployed system, use the last paper number entered by the
  // maintenance supervisor. Once an app number exists, that number drives
  // the sequence for the rest of the year.
  const configuredStart = await getMaintenanceRequestNumberingStart();
  const baseSequence = Math.max(lastSequence, configuredStart ?? 0);
  if (baseSequence === 0 && configuredStart === null) return null;
  return `${baseSequence + 1}/${String(month).padStart(2, "0")}/${year}`;
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

    // Read every corrective record, including archived Record History entries.
    // Machine details are stored on the record itself so an archived/deleted machine
    // does not make its historical repair time disappear from the report.
router.get("/reports/corrective-maintenance-time", requireAuth, requirePermission("view_reports"), async (req, res, next) => {
  try {
    const today = new Date();
    const requestedYear = Number(firstParam(req.query.year));
    const requestedMonth = Number(firstParam(req.query.month));
    const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : today.getFullYear();
    const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : today.getMonth() + 1;
    const eventRows = await db
      .select({
        machineId: correctiveMaintenanceRecordsTable.machineId,
        machineName: correctiveMaintenanceRecordsTable.machineName,
        machineNumber: correctiveMaintenanceRecordsTable.machineNumber,
        repairTimeSlots: correctiveMaintenanceEventsTable.repairTimeSlots,
      })
      .from(correctiveMaintenanceEventsTable)
      .innerJoin(correctiveMaintenanceRecordsTable, eq(correctiveMaintenanceEventsTable.recordId, correctiveMaintenanceRecordsTable.id));

    const byMachine = new Map<number, { machineId: number; machineName: string; machineNumber: string; totalMinutes: number; intervals: Array<{ date: string; from: string; to: string; minutes: number }> }>();
    for (const row of eventRows) {
      const summary = byMachine.get(row.machineId) ?? { machineId: row.machineId, machineName: row.machineName, machineNumber: row.machineNumber, totalMinutes: 0, intervals: [] };
      for (const slot of parseCorrectiveRepairTimeSlots(row.repairTimeSlots ?? "[]")) {
        const repairDate = parseRepairDate(slot.date ?? slot.repairDate);
        const from = repairSlotText(slot.from ?? slot.repairTimeFrom);
        const to = repairSlotText(slot.to ?? slot.repairTimeTo);
        if (!repairDate || repairDate.year !== year || repairDate.month !== month) continue;
        const fromMinutes = repairTimeToMinutes(from);
        const toMinutes = repairTimeToMinutes(to);
        if (fromMinutes === null || toMinutes === null) continue;
        const minutes = (toMinutes - fromMinutes + 24 * 60) % (24 * 60);
        if (minutes <= 0) continue;
        summary.totalMinutes += minutes;
        summary.intervals.push({ date: repairDate.iso, from, to, minutes });
      }
      if (summary.intervals.length > 0) byMachine.set(row.machineId, summary);
    }

    const machines = [...byMachine.values()]
      .map((machine) => ({ ...machine, intervals: machine.intervals.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from)) }))
      .sort((a, b) => a.machineName.localeCompare(b.machineName));
    const totalMinutes = machines.reduce((sum, machine) => sum + machine.totalMinutes, 0);
    const totalIntervals = machines.reduce((sum, machine) => sum + machine.intervals.length, 0);
    res.json({ year, month, machines, totalMinutes, totalIntervals });
  } catch (error) {
    next(error);
  }
});

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

type ManualSummaryAdjustment = {
  id: string;
  total: number;
  achieved: number;
  description?: string;
  createdAt: string;
};

function parseManualSummaryAdjustments(value: string | null | undefined): ManualSummaryAdjustment[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const total = Number(candidate.total);
      const achieved = Number(candidate.achieved);
      if (typeof candidate.id !== "string" || !Number.isFinite(total) || !Number.isFinite(achieved)) return [];
      return [{
        id: candidate.id,
        total,
        achieved,
        description: typeof candidate.description === "string" ? candidate.description : undefined,
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
      }];
    });
  } catch {
    return [];
  }
}

function adjustedSummary(autoTotal: number, autoAchieved: number, adjustments: ManualSummaryAdjustment[]) {
  const total = Math.max(0, autoTotal + adjustments.reduce((sum, item) => sum + item.total, 0));
  const achieved = Math.max(0, Math.min(total, autoAchieved + adjustments.reduce((sum, item) => sum + item.achieved, 0)));
  return { total, achieved };
}

// Annual abstract matching the company's Excel "Abstract of monthly Evaluation
// reports".  PM values come from the approved monthly evaluation records and
// corrective values come directly from the preserved maintenance requests.
router.get(
  "/reports/annual-maintenance-summary",
  requireAuth,
  requirePermission("view_reports"),
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

      const months = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
        const month = index + 1;
        const evaluation = evaluationByMonth.get(month);
        const correctiveRows = requests.filter((request) =>
          request.requestDate?.startsWith(
            `${year}-${String(month).padStart(2, "0")}`,
          ),
        );
        const correctiveAdjustments = parseManualSummaryAdjustments(evaluation?.manualCorrectiveAdjustments);
        const preventiveAdjustments = parseManualSummaryAdjustments(evaluation?.manualPreventiveAdjustments);
        const automaticPreventive = await preventiveEvaluationMetrics(year, month);
        const automaticCorrectiveTotal = correctiveRows.length;
        const automaticCorrectiveAchieved = correctiveRows.filter((request) =>
          completedStatuses.has(request.status as typeof STATUS.COMPLETED | typeof STATUS.CLOSED),
        ).length;
        const preventive = adjustedSummary(
          automaticPreventive.totalPmActivities,
          automaticPreventive.completedPmOnTime,
          preventiveAdjustments,
        );
        const corrective = adjustedSummary(
          automaticCorrectiveTotal,
          automaticCorrectiveAchieved,
          correctiveAdjustments,
        );
        return {
          month,
          preventive: automaticPreventive.totalPmActivities || preventiveAdjustments.length ? { planned: preventive.total, achieved: preventive.achieved } : null,
          corrective: automaticCorrectiveTotal || correctiveAdjustments.length ? { total: corrective.total, achieved: corrective.achieved } : null,
          manualAdjustments: { corrective: correctiveAdjustments, preventive: preventiveAdjustments },
        };
      }));

      res.json({ year, months });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/reports/annual-maintenance-summary/adjustments",
  requireAuth,
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const year = Number(body.year);
      const month = Number(body.month);
      const type = body.type === "preventive" ? "preventive" : body.type === "corrective" ? "corrective" : null;
      const total = Number(body.total);
      const achieved = Number(body.achieved);
      if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12 || !type || !Number.isInteger(total) || !Number.isInteger(achieved)) {
        res.status(400).json({ error: "Invalid annual summary adjustment." });
        return;
      }
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
      const [existing] = await db.select().from(monthlyMaintenanceEvaluationReportsTable).where(and(eq(monthlyMaintenanceEvaluationReportsTable.year, year), eq(monthlyMaintenanceEvaluationReportsTable.month, month)));
      const entry: ManualSummaryAdjustment = { id: randomUUID(), total, achieved, description: description || undefined, createdAt: new Date().toISOString() };
      if (existing) {
        if (type === "corrective") {
          const adjustments = [...parseManualSummaryAdjustments(existing.manualCorrectiveAdjustments), entry];
          await db.update(monthlyMaintenanceEvaluationReportsTable).set({ manualCorrectiveAdjustments: JSON.stringify(adjustments), updatedAt: new Date() }).where(eq(monthlyMaintenanceEvaluationReportsTable.id, existing.id));
        } else {
          const adjustments = [...parseManualSummaryAdjustments(existing.manualPreventiveAdjustments), entry];
          await db.update(monthlyMaintenanceEvaluationReportsTable).set({ manualPreventiveAdjustments: JSON.stringify(adjustments), updatedAt: new Date() }).where(eq(monthlyMaintenanceEvaluationReportsTable.id, existing.id));
        }
      } else {
        await db.insert(monthlyMaintenanceEvaluationReportsTable).values({
          year, month,
          manualCorrectiveAdjustments: type === "corrective" ? JSON.stringify([entry]) : "[]",
          manualPreventiveAdjustments: type === "preventive" ? JSON.stringify([entry]) : "[]",
        });
      }
      res.status(201).json({ adjustment: entry });
    } catch (error) { next(error); }
  },
);

router.patch("/:id/request-details", requireAuth, async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    const editableStatuses: string[] = [
      STATUS.SUBMITTED,
      STATUS.PENDING_SUPERVISOR,
      STATUS.PENDING_QA,
      STATUS.QA_REJECTED,
    ];
    if (!request || request.requestedByUserId !== req.session.userId || !editableStatuses.includes(request.status)) {
      res.status(403).json({ error: "Request details can only be changed by the reporter before QA acceptance" });
      return;
    }
    const body = req.body as {
      departmentSection?: string;
      priority?: string;
      requestDate?: string;
      failureDescription?: string;
      reportingPersonName?: string;
      departmentSupervisorName?: string;
    };
    const failureDescription = body.failureDescription?.trim();
    if (!failureDescription) {
      res.status(400).json({ error: "Failure description is required" });
      return;
    }
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({
        departmentSection: body.departmentSection?.trim() || null,
        priority: body.priority === "urgent" ? "urgent" : "normal",
        requestDate: body.requestDate?.trim() || request.requestDate,
        failureDescription,
        reportingPersonName: body.reportingPersonName?.trim() || null,
        departmentSupervisorName: body.departmentSupervisorName?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(maintenanceRequestsTable.id, request.id))
      .returning();
    res.json(await getRequestDetail(updated!));
  } catch (err) {
    next(err);
  }
});

router.delete(
  "/reports/annual-maintenance-summary/adjustments/:year/:month/:type/:adjustmentId",
  requireAuth,
  requirePermission("edit_maintenance_plans"),
  async (req, res, next) => {
    try {
      const year = Number(req.params.year);
      const month = Number(req.params.month);
      const type = req.params.type === "preventive" ? "preventive" : req.params.type === "corrective" ? "corrective" : null;
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !type) {
        res.status(400).json({ error: "Invalid annual summary adjustment." });
        return;
      }
      const [existing] = await db.select().from(monthlyMaintenanceEvaluationReportsTable).where(and(eq(monthlyMaintenanceEvaluationReportsTable.year, year), eq(monthlyMaintenanceEvaluationReportsTable.month, month)));
      if (!existing) {
        res.status(404).json({ error: "Adjustment not found." });
        return;
      }
      if (type === "corrective") {
        const adjustments = parseManualSummaryAdjustments(existing.manualCorrectiveAdjustments).filter((item) => item.id !== req.params.adjustmentId);
        await db.update(monthlyMaintenanceEvaluationReportsTable).set({ manualCorrectiveAdjustments: JSON.stringify(adjustments), updatedAt: new Date() }).where(eq(monthlyMaintenanceEvaluationReportsTable.id, existing.id));
      } else {
        const adjustments = parseManualSummaryAdjustments(existing.manualPreventiveAdjustments).filter((item) => item.id !== req.params.adjustmentId);
        await db.update(monthlyMaintenanceEvaluationReportsTable).set({ manualPreventiveAdjustments: JSON.stringify(adjustments), updatedAt: new Date() }).where(eq(monthlyMaintenanceEvaluationReportsTable.id, existing.id));
      }
      res.json({ success: true });
    } catch (error) { next(error); }
  },
);

// FORM-10-0944-0.  The report is deliberately stored per calendar month so a
// completed evaluation remains available as part of the controlled record.
async function preventiveEvaluationMetrics(year: number, month: number) {
  const [plan] = await db.select().from(monthlyPmPlansTable).where(and(eq(monthlyPmPlansTable.year, year), eq(monthlyPmPlansTable.month, month))).limit(1);
  if (!plan) return { totalPmActivities: 0, completedPmOnTime: 0, delayedActivities: "[]" };
  const rows = await db.select().from(monthlyPmPlanRowsTable).where(and(
    eq(monthlyPmPlanRowsTable.planId, plan.id),
    eq(monthlyPmPlanRowsTable.isManuallyRemoved, false),
  )).orderBy(asc(monthlyPmPlanRowsTable.rowNumber));
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const inspections = await db.select({ machineId: pmInspectionsTable.machineId }).from(pmInspectionsTable).where(like(pmInspectionsTable.inspectionDate, `${monthKey}-%`));
  const completedMachineIds = new Set(inspections.map((inspection) => inspection.machineId));
  const delayedRows = rows.filter((row) => !completedMachineIds.has(row.machineId)).map((row) => ({
    activity: `${row.machineName}${row.identificationNumber ? ` (${row.identificationNumber})` : ""}`,
    reason: row.amendments ?? "",
  }));
  return {
    totalPmActivities: rows.length,
    completedPmOnTime: rows.filter((row) => completedMachineIds.has(row.machineId)).length,
    delayedActivities: JSON.stringify(delayedRows),
  };
}

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
      const preventiveMetrics = await preventiveEvaluationMetrics(year, month);
      res.json(
        report ? { ...report, ...preventiveMetrics } : {
          year,
          month,
          delayReason: "",
          followUpIncluded: "",
          ...preventiveMetrics,
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
        delayReason: String(body.delayReason ?? ""),
        followUpIncluded: String(body.followUpIncluded ?? ""),
        ...(await preventiveEvaluationMetrics(year, month)),
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
  if (existing) {
    // Keep the CM row aligned with the official maintenance-request number.
    // This also repairs any linked rows that predate the approval workflow.
    if (existing.requestReportNumber === request.requestReportNumber) return existing;
    const [updated] = await db
      .update(correctiveMaintenanceEventsTable)
      .set({
        requestReportNumber: request.requestReportNumber,
        updatedAt: new Date(),
      })
      .where(eq(correctiveMaintenanceEventsTable.id, existing.id))
      .returning();
    return updated!;
  }

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

router.get(
  "/numbering-start",
  requireAuth,
  requirePermission("set_maintenance_request_number_start"),
  async (_req, res, next) => {
    try {
      res.json({ lastSequence: await getMaintenanceRequestNumberingStart() });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/numbering-start",
  requireAuth,
  requirePermission("set_maintenance_request_number_start"),
  async (req, res, next) => {
    try {
      const value = String(req.body?.lastSequence ?? "").trim();
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        res.status(400).json({ error: "Enter a valid last maintenance-request sequence number" });
        return;
      }
      const [existing] = await db
        .select({ id: formHeadersTable.id })
        .from(formHeadersTable)
        .where(
          and(
            eq(formHeadersTable.documentType, "MAINTENANCE_REQUEST_NUMBERING"),
            eq(formHeadersTable.documentId, MAINTENANCE_REQUEST_NUMBERING_HEADER_ID),
          ),
        );
      if (existing) {
        await db
          .update(formHeadersTable)
          .set({ documentNumber: value, updatedAt: new Date() })
          .where(eq(formHeadersTable.id, existing.id));
      } else {
        await db.insert(formHeadersTable).values({
          documentType: "MAINTENANCE_REQUEST_NUMBERING",
          documentId: MAINTENANCE_REQUEST_NUMBERING_HEADER_ID,
          documentName: "Maintenance request numbering",
          documentNumber: value,
        });
      }
      res.json({ lastSequence: Number(value) });
    } catch (err) {
      next(err);
    }
  },
);

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
    } else if (scope === "archived") {
      if (!permissions.includes("archive_maintenance_requests")) {
        res.status(403).json({ error: "Archive permission is required" });
        return;
      }
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
    rows = rows.filter((row) => scope === "archived" ? Boolean(row.archivedAt) : !row.archivedAt);
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

router.patch("/:id/archive", requireAuth, requirePermission("archive_maintenance_requests"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const [updated] = await db.update(maintenanceRequestsTable).set({
      archivedAt: new Date(),
      archivedByUserId: req.session.userId ?? null,
      updatedAt: new Date(),
    }).where(eq(maintenanceRequestsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Maintenance request not found" }); return; }
    await db.insert(auditLogsTable).values({ userId: req.session.userId ?? null, action: "maintenance_request_archived", entityType: "maintenance_request", entityId: id });
    res.json(await getRequestDetail(updated));
  } catch (err) { next(err); }
});

router.patch("/:id/restore", requireAuth, requirePermission("archive_maintenance_requests"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const [updated] = await db.update(maintenanceRequestsTable).set({
      archivedAt: null,
      archivedByUserId: null,
      updatedAt: new Date(),
    }).where(eq(maintenanceRequestsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Maintenance request not found" }); return; }
    await db.insert(auditLogsTable).values({ userId: req.session.userId ?? null, action: "maintenance_request_restored", entityType: "maintenance_request", entityId: id });
    res.json(await getRequestDetail(updated));
  } catch (err) { next(err); }
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
            eventId: correctiveMaintenanceEventsTable.id,
            recordId: correctiveMaintenanceEventsTable.recordId,
            requestId: maintenanceRequestsTable.id,
            machineId: maintenanceRequestsTable.machineId,
            machineName: maintenanceRequestsTable.machineName,
            machineNumber: maintenanceRequestsTable.machineNumber,
            requestDate: maintenanceRequestsTable.requestDate,
            requestReportNumber: maintenanceRequestsTable.requestReportNumber,
            priority: maintenanceRequestsTable.priority,
            status: maintenanceRequestsTable.status,
            handoverDate: correctiveMaintenanceEventsTable.handoverDate,
            remarks: correctiveMaintenanceEventsTable.remarksRecommendations,
          })
          .from(maintenanceRequestsTable)
          .innerJoin(
            correctiveMaintenanceEventsTable,
            eq(
              correctiveMaintenanceEventsTable.requestId,
              maintenanceRequestsTable.id,
            ),
          )
          .orderBy(
            desc(maintenanceRequestsTable.updatedAt),
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

      const automaticRows = rows.flatMap((row) => {
        // This official log is driven by completed maintenance requests. A
        // corrective-maintenance record alone must never create a log row.
        if (
          (row.status !== STATUS.COMPLETED && row.status !== STATUS.CLOSED) ||
          !row.handoverDate ||
          excludedRequestIds.has(row.requestId)
        ) return [];
        return [{
          id: `automatic-${row.requestId}`,
          source: "automatic" as const,
          eventId: row.eventId,
          recordId: row.recordId,
          closedDate: row.handoverDate,
          handoverDate: row.handoverDate,
          remarks: row.remarks ?? "",
          machineName: row.machineName,
          machineNumber: row.machineNumber,
          requestDate: row.requestDate,
          requestReportNumber: row.requestReportNumber,
          priority: row.priority,
        }];
      });
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

// Controlled corrections for rows that originated from the corrective
// maintenance record. Access is intentionally separate from general request
// management so only explicitly authorized users can edit this log.
router.patch(
  "/closed-log/events/:eventId",
  requireAuth,
  requirePermission("edit_closed_corrective_maintenance_log"),
  async (req, res, next) => {
    try {
      const eventId = parseIdParam(req.params.eventId);
      const [event] = await db
        .select()
        .from(correctiveMaintenanceEventsTable)
        .where(eq(correctiveMaintenanceEventsTable.id, eventId));
      if (!event) {
        res.status(404).json({ error: "Corrective maintenance row not found" });
        return;
      }
      if (!event.requestId) {
        res.status(400).json({ error: "This log row is not linked to a maintenance request" });
        return;
      }
      const body = req.body as {
        requestDate?: string;
        maintenanceType?: string;
        handoverDate?: string;
        remarks?: string;
      };
      const maintenanceType = body.maintenanceType === "urgent" ? "urgent" : "normal";
      await db
        .update(maintenanceRequestsTable)
        .set({
          requestDate: body.requestDate?.trim() || undefined,
          priority: maintenanceType,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceRequestsTable.id, event.requestId));
      const [updated] = await db
        .update(correctiveMaintenanceEventsTable)
        .set({
          handoverDate: body.handoverDate?.trim() || null,
          remarksRecommendations: body.remarks?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(correctiveMaintenanceEventsTable.id, event.id))
        .returning();
      res.json(formatEvent(updated!));
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
        departmentId?: number;
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
      const selectedDepartmentId = Number(body.departmentId);
      const [selectedDepartment] = Number.isInteger(selectedDepartmentId) && selectedDepartmentId > 0
        ? await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, selectedDepartmentId))
        : [];
      if (!selectedDepartment) {
        res.status(400).json({ error: "Please select a department from the administrator-managed list" });
        return;
      }
      const [user] = await db
        .select({ departmentId: usersTable.departmentId, fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
        .from(usersTable)
        .where(eq(usersTable.id, req.session.userId!));
      const [created] = await db
        .insert(maintenanceRequestsTable)
        .values({
          requestReportNumber: pendingRequestNumber(),
          machineId: machine.id,
          requestedByUserId: req.session.userId!,
          // The request must use one of the controlled departments configured
          // by the administrator, rather than free-text entered by a user.
          departmentId: selectedDepartment.id,
          departmentSection: selectedDepartment.name,
          priority: body.priority === "urgent" ? "urgent" : "normal",
          machineName: machine.machineName,
          machineNumber: machine.machineNumber,
          requestDate: body.requestDate,
          failureDescription: body.failureDescription,
          reportingPersonName: body.reportingPersonName?.trim() || user?.fullName || user?.username || null,
          // Do not show a name as a signature. This remains empty until the
          // reporter signs the dedicated electronic-signature field.
          reportingPersonSignature: null,
          // Keep the supervisor named by the reporting department visible on
          // the request until that supervisor approves and signs it.
          departmentSupervisorName: body.departmentSupervisorName?.trim() || null,
          status: STATUS.SUBMITTED,
        })
        .returning();
      await addStatusHistory(
        created!.id,
        null,
        STATUS.SUBMITTED,
        req.session.userId,
        "Request submitted",
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

// The department supervisor is the mandatory gate between the reporter and
// QA.  A rejected request stays stopped at this stage.
router.patch("/:id/supervisor-review", requireAuth, requirePermission("review_department_requests"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.SUBMITTED) {
      res.status(400).json({ error: "Request is not awaiting department supervisor approval" });
      return;
    }
    const body = req.body as { decision?: string; notes?: string };
    const approved = body.decision !== "reject";
    const [supervisor] = await db.select({ fullName: usersTable.fullName, username: usersTable.username, signatureData: usersTable.signatureData })
      .from(usersTable).where(eq(usersTable.id, req.session.userId!));
    const supervisorName = supervisor?.fullName || supervisor?.username || "Department Supervisor";
    const toStatus = approved ? STATUS.PENDING_QA : STATUS.REJECTED;
    const [updated] = await db.update(maintenanceRequestsTable).set({
      status: toStatus,
      departmentSupervisorName: supervisorName,
      // Approval records the approver's saved electronic signature immediately.
      departmentSupervisorSignature: await currentUserSignature(req.session.userId, supervisorName),
      updatedAt: new Date(),
    }).where(eq(maintenanceRequestsTable.id, request.id)).returning();
    await addStatusHistory(request.id, request.status, toStatus, req.session.userId, body.notes ?? (approved ? "Approved by department supervisor; routed to QA" : "Rejected by department supervisor"));
    res.json(await getRequestDetail(updated!));
  } catch (err) { next(err); }
});

router.get("/:id/external-maintenance", requireAuth, requirePermission("view_external_maintenance"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (
      !request ||
      !ensureCanView(req, request)
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
  requirePermission("edit_external_maintenance"),
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
      if (isPendingRequestNumber(request.requestReportNumber)) {
        res.status(409).json({ error: "The maintenance request must be approved by Engineering before it can be converted to external maintenance" });
        return;
      }
      const [created] = await db
        .insert(externalMaintenanceRequestsTable)
        .values({
          maintenanceRequestId: request.id,
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
  requirePermission("edit_external_maintenance"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (!request) {
        res.status(404).json({ error: "Maintenance request not found" });
        return;
      }
      const body = req.body as Partial<{
        preliminaryFindings: string;
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
          preliminaryFindings: body.preliminaryFindings ?? null,
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

router.delete("/:id/external-maintenance", requireAuth, requirePermission("edit_external_maintenance"), async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || request.status !== STATUS.EXTERNAL_MAINTENANCE) { res.status(400).json({ error: "Request is not in external maintenance" }); return; }
    const [externalRequest] = await db.select().from(externalMaintenanceRequestsTable).where(eq(externalMaintenanceRequestsTable.maintenanceRequestId, request.id));
    if (!externalRequest) { res.status(404).json({ error: "External maintenance request not found" }); return; }
    const [receipt] = await db.select({ id: externalMaintenanceReceiptsTable.id }).from(externalMaintenanceReceiptsTable).where(eq(externalMaintenanceReceiptsTable.externalMaintenanceRequestId, externalRequest.id)).limit(1);
    const [externalSignature] = await db.select({ id: signaturesTable.id }).from(signaturesTable).where(and(eq(signaturesTable.documentType, "EXTERNAL_MAINTENANCE_REQUEST"), eq(signaturesTable.documentId, request.id))).limit(1);
    if (receipt || externalSignature) { res.status(409).json({ error: "External maintenance cannot be cancelled after receipt or signatures have started" }); return; }
    await db.delete(externalMaintenanceRequestsTable).where(eq(externalMaintenanceRequestsTable.id, externalRequest.id));
    const [event] = await db.select().from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.requestId, request.id)).limit(1);
    const restoredStatus = event ? STATUS.IN_PROGRESS : STATUS.ACCEPTED;
    const [updated] = await db.update(maintenanceRequestsTable).set({ status: restoredStatus, updatedAt: new Date() }).where(eq(maintenanceRequestsTable.id, request.id)).returning();
    await addStatusHistory(request.id, request.status, restoredStatus, req.session.userId, "Accidental external-maintenance conversion cancelled");
    res.json(await getRequestDetail(updated!));
  } catch (err) { next(err); }
});

router.get(
  "/:id/external-maintenance-receipt",
  requireAuth,
  requirePermission("view_external_maintenance"),
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        !ensureCanView(req, request)
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
  requirePermission("edit_external_maintenance"),
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
  requirePermission("edit_external_maintenance"),
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
        // QA acceptance is itself the approval signature; never rely on a
        // manually typed name when the account has a saved signature.
        qaSupervisorSignature: await currentUserSignature(req.session.userId, body.signature ?? "QA Supervisor"),
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
      requestReportNumber?: string;
    };
    const toStatus =
      body.decision === "reject" ? STATUS.REJECTED : STATUS.ACCEPTED;
    let approvedRequestNumber = request.requestReportNumber;
    if (toStatus === STATUS.ACCEPTED) {
      const manualNumber = body.requestReportNumber?.trim() ?? "";
      if (manualNumber) {
        if (!/^\d+\/\d{2}\/\d{4}$/.test(manualNumber)) {
          res.status(400).json({ error: "Maintenance request number must use the format 1/MM/YYYY" });
          return;
        }
        approvedRequestNumber = manualNumber;
      } else {
        const automaticNumber = await nextApprovedRequestNumber(request.requestDate);
        if (!automaticNumber) {
          res.status(400).json({ error: "Set the starting maintenance request number first, or enter this request number manually" });
          return;
        }
        approvedRequestNumber = automaticNumber;
      }
      const [duplicate] = await db
        .select({ id: maintenanceRequestsTable.id })
        .from(maintenanceRequestsTable)
        .where(eq(maintenanceRequestsTable.requestReportNumber, approvedRequestNumber));
      if (duplicate && duplicate.id !== request.id) {
        res.status(409).json({ error: "This maintenance request number is already in use" });
        return;
      }
    }
    const [updated] = await db
      .update(maintenanceRequestsTable)
      .set({
        status: toStatus,
        requestReportNumber:
          toStatus === STATUS.ACCEPTED
            ? approvedRequestNumber
            : request.requestReportNumber,
        engineeringDecision:
          toStatus === STATUS.REJECTED ? "Rejected" : "Accepted",
        assignedTechnicianUserId:
          toStatus === STATUS.ACCEPTED
            ? (body.assignedTechnicianUserId ?? null)
            : null,
        expectedWorkTimeFrom: body.expectedWorkTimeFrom ?? null,
        expectedWorkTimeTo: body.expectedWorkTimeTo ?? null,
        engineeringSupervisorSignature: await currentUserSignature(req.session.userId, body.signature ?? "Engineering Reviewer"),
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
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        request.status !== STATUS.ACCEPTED ||
        !canWorkOnCorrectiveMaintenance(req)
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
    const [existingEvent] = request
      ? await db
          .select()
          .from(correctiveMaintenanceEventsTable)
          .where(eq(correctiveMaintenanceEventsTable.requestId, request.id))
          .limit(1)
      : [];
    if (
      !request ||
      (request.engineeringDecision !== "Accepted" && !existingEvent) ||
      !canFillPreliminaryFindings(req)
    ) {
      res
        .status(400)
        .json({ error: "Request is not accepted for corrective maintenance" });
      return;
    }
    const event = existingEvent ?? (await ensureEventForRequest(request));
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
  preliminaryFindingsHandler,
);
router.patch(
  "/:id/preliminary-findings",
  requireAuth,
  preliminaryFindingsHandler,
);

async function actionsTakenHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    const [existingEvent] = request
      ? await db
          .select()
          .from(correctiveMaintenanceEventsTable)
          .where(eq(correctiveMaintenanceEventsTable.requestId, request.id))
          .limit(1)
      : [];
    if (
      !request ||
      (request.engineeringDecision !== "Accepted" && !existingEvent) ||
      !canWorkOnCorrectiveMaintenance(req)
    ) {
      res.status(400).json({ error: "Request is not ready for completion" });
      return;
    }
    const event = existingEvent ?? (await ensureEventForRequest(request));
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
        "Corrective maintenance actions recorded; awaiting handover",
      );
    }
    res.json(await getRequestDetail(updatedRequest!));
  } catch (err) {
    next(err);
  }
}

router.patch(
  "/:id/actions-taken",
  requireAuth,
  actionsTakenHandler,
);

async function hasSignedHandoverField(requestId: number, userId: number | undefined, fieldName: "receiver" | "engineering_final") {
  if (!userId) return false;
  const [signature] = await db
    .select({ id: signaturesTable.id })
    .from(signaturesTable)
    .where(and(
      eq(signaturesTable.documentType, "MAINTENANCE_REQUEST"),
      eq(signaturesTable.documentId, requestId),
      eq(signaturesTable.fieldName, fieldName),
      eq(signaturesTable.userId, userId),
    ))
    .limit(1);
  return Boolean(signature);
}

async function completeRequestWhenHandoverReady(request: typeof maintenanceRequestsTable.$inferSelect) {
  const [event] = await db.select().from(correctiveMaintenanceEventsTable).where(eq(correctiveMaintenanceEventsTable.requestId, request.id)).limit(1);
  if (!event?.handoverDate || !event.engineeringDate) return request;
  const signatures = await db.select({ fieldName: signaturesTable.fieldName }).from(signaturesTable).where(and(
    eq(signaturesTable.documentType, "MAINTENANCE_REQUEST"),
    eq(signaturesTable.documentId, request.id),
  ));
  const signedFields = new Set(signatures.map((item) => item.fieldName));
  if (!signedFields.has("receiver") || !signedFields.has("engineering_final") || request.status === STATUS.COMPLETED || request.status === STATUS.CLOSED) return request;
  const [updated] = await db.update(maintenanceRequestsTable).set({ status: STATUS.COMPLETED, updatedAt: new Date() }).where(eq(maintenanceRequestsTable.id, request.id)).returning();
  await addStatusHistory(request.id, request.status, STATUS.COMPLETED, undefined, "Receiver and engineering handover completed");
  return updated ?? request;
}

router.patch("/:id/receiver-handover", requireAuth, async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || !(await hasSignedHandoverField(request.id, req.session.userId, "receiver"))) {
      res.status(403).json({ error: "Only the signed machine receiver can save receiver details" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as { receiverName?: string; handoverDate?: string };
    await db.update(correctiveMaintenanceEventsTable).set({
      receiverName: body.receiverName?.trim() || null,
      handoverDate: body.handoverDate || null,
      updatedAt: new Date(),
    }).where(eq(correctiveMaintenanceEventsTable.id, event.id));
    res.json(await getRequestDetail(await completeRequestWhenHandoverReady(request)));
  } catch (err) { next(err); }
});

router.patch("/:id/engineering-handover", requireAuth, async (req, res, next) => {
  try {
    const request = await getRequest(parseIdParam(req.params.id));
    if (!request || !(await hasSignedHandoverField(request.id, req.session.userId, "engineering_final"))) {
      res.status(403).json({ error: "Only the signed engineering representative can save the engineering date" });
      return;
    }
    const event = await ensureEventForRequest(request);
    const body = req.body as { engineeringDate?: string };
    await db.update(correctiveMaintenanceEventsTable).set({
      engineeringDate: body.engineeringDate || null,
      updatedAt: new Date(),
    }).where(eq(correctiveMaintenanceEventsTable.id, event.id));
    res.json(await getRequestDetail(await completeRequestWhenHandoverReady(request)));
  } catch (err) { next(err); }
});

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
      !canWorkOnCorrectiveMaintenance(req)
    ) {
      res.status(400).json({ error: "Request is not ready for handover" });
      return;
    }
    const finalSignatures = await db
      .select({ fieldName: signaturesTable.fieldName })
      .from(signaturesTable)
      .where(
        and(
          eq(signaturesTable.documentType, "MAINTENANCE_REQUEST"),
          eq(signaturesTable.documentId, request.id),
        ),
      );
    const signedFields = new Set(finalSignatures.map((signature) => signature.fieldName));
    if (!signedFields.has("engineering_final") || !signedFields.has("receiver")) {
      res.status(400).json({ error: "Engineering and receiver electronic signatures are required before closing" });
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
  handoverHandler,
);
router.put(
  "/:id/actions-handover",
  requireAuth,
  async (req, res, next) => {
    try {
      const request = await getRequest(parseIdParam(req.params.id));
      if (
        !request ||
        (request.status !== STATUS.ACCEPTED &&
          request.status !== STATUS.IN_PROGRESS &&
          request.status !== STATUS.COMPLETED) ||
      !canWorkOnCorrectiveMaintenance(req)
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
