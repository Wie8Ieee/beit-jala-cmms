import { Router } from "express";
import { db } from "@workspace/db";
import {
  machinesTable,
  usersTable,
  departmentsTable,
  monthlyPmPlanRowsTable,
  monthlyPmPlansTable,
  maintenanceRequestsTable,
  correctiveMaintenanceEventsTable,
  eligibleSignerAssignmentsTable,
  pmInspectionsTable,
  signatureFieldPermissionsTable,
  signaturesTable,
  sparePartsTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, count, sql } from "drizzle-orm";
import { requireActiveAuth, requirePermission } from "../lib/auth.js";

const router = Router();

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pmStatus(actualDate: string | null, plannedDateTo: string | null) {
  if (actualDate) return "Completed";
  if (plannedDateTo && plannedDateTo < isoDate(new Date())) return "Overdue";
  return "Due";
}

function currentWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - ((day + 1) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoDate(start), end: isoDate(end) };
}

// GET /api/dashboard/stats
router.get("/stats", requireActiveAuth, requirePermission("view_dashboard"), async (req, res) => {
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const { start: weekStart, end: weekEnd } = currentWeekRange();
  const monthlyPmRows = await db
    .select({
      id: monthlyPmPlanRowsTable.id,
      machineId: monthlyPmPlanRowsTable.machineId,
      machineName: monthlyPmPlanRowsTable.machineName,
      machineNumber: monthlyPmPlanRowsTable.identificationNumber,
      plannedDateFrom: monthlyPmPlanRowsTable.plannedDateFrom,
      plannedDateTo: monthlyPmPlanRowsTable.plannedDateTo,
      actualDate: monthlyPmPlanRowsTable.actualDate,
    })
    .from(monthlyPmPlanRowsTable)
    .innerJoin(monthlyPmPlansTable, eq(monthlyPmPlanRowsTable.planId, monthlyPmPlansTable.id))
    .where(and(
      eq(monthlyPmPlansTable.year, currentYear),
      eq(monthlyPmPlansTable.month, currentMonth),
      eq(monthlyPmPlanRowsTable.isManuallyRemoved, false),
    ));

  const thisWeekPm = monthlyPmRows
    .filter((row) => {
      const from = row.plannedDateFrom ?? "";
      const to = row.plannedDateTo ?? row.plannedDateFrom ?? "";
      return from <= weekEnd && to >= weekStart;
    })
    .map((row) => ({
      id: row.id,
      machineId: row.machineId,
      machineName: row.machineName,
      machineNumber: row.machineNumber ?? "",
      plannedDateFrom: row.plannedDateFrom,
      plannedDateTo: row.plannedDateTo,
      status: pmStatus(row.actualDate, row.plannedDateTo),
    }));

  const completedCount = monthlyPmRows.filter((row) => !!row.actualDate).length;
  const notCompletedCount = Math.max(0, monthlyPmRows.length - completedCount);

  // Archived requests are retained for audit/history, but are no longer part
  // of any operational dashboard count, queue, notification, or recent list.
  const requestRows = await db
    .select()
    .from(maintenanceRequestsTable)
    .where(isNull(maintenanceRequestsTable.archivedAt));
  const currentUserId = req.session.userId;
  const requestSummary = {
    total: requestRows.length,
    completed: requestRows.filter((row) => row.status === "Completed" || row.status === "Closed").length,
    pendingQa: requestRows.filter((row) => row.status === "Pending QA Approval").length,
    pendingEngineering: requestRows.filter((row) => row.status === "QA Approved").length,
    acceptedOrInProgress: requestRows.filter((row) => row.status === "Accepted" || row.status === "In Progress").length,
    own: requestRows.filter((row) => row.requestedByUserId === currentUserId).length,
  };
  const todayStr = isoDate(new Date());
  const overdueRows = monthlyPmRows.filter(
    (r) => !r.actualDate && r.plannedDateTo && r.plannedDateTo < todayStr
  );
  const overdueCount = overdueRows.length;

  // Dashboard notifications are actionable queues, so each item is shown only
  // to a user who can perform that action (plus the request owner for updates).
  const permissions = req.session.permissions ?? [];
  const isAdmin = req.session.roleName === "Admin";
  const requestNotifications: Array<{ type: string; message: string; href: string }> = [];

  if ((isAdmin || permissions.includes("review_qa_requests")) && requestSummary.pendingQa) {
    requestNotifications.push({
      type: "qa",
      message: `${requestSummary.pendingQa} طلب صيانة بانتظار موافقة QA`,
      href: "/maintenance-requests/qa",
    });
  }
  if ((isAdmin || permissions.includes("review_engineering_requests")) && requestSummary.pendingEngineering) {
    requestNotifications.push({
      type: "engineering",
      message: `${requestSummary.pendingEngineering} طلب معتمد من QA بانتظار موافقة الهندسة`,
      href: "/maintenance-requests/engineering",
    });
  }
  if ((isAdmin || ["Maintenance Supervisor", "Maintenance Technician"].includes(req.session.roleName ?? "")) && overdueCount > 0) {
    requestNotifications.push({
      type: "overdue_pm",
      message: `${overdueCount} نشاط صيانة وقائية متأخر هذا الشهر`,
      href: "/maintenance-plans",
    });
  }

  if (currentUserId) {
    // A document-specific eligible-signer assignment is an explicit request
    // for this user to sign. Surface every unsigned assignment regardless of
    // document type, and remove it as soon as it is signed or revoked.
    const signatureAssignments = await db
      .select({
        documentType: eligibleSignerAssignmentsTable.documentType,
        documentId: eligibleSignerAssignmentsTable.documentId,
        fieldName: eligibleSignerAssignmentsTable.fieldName,
      })
      .from(eligibleSignerAssignmentsTable)
      .where(and(
        eq(eligibleSignerAssignmentsTable.eligibleUserId, currentUserId),
        isNull(eligibleSignerAssignmentsTable.revokedAt),
      ));
    const assignedDocumentIds = [...new Set(signatureAssignments.map((assignment) => assignment.documentId))];
    const assignedSignatures = assignedDocumentIds.length
      ? await db.select({
          documentType: signaturesTable.documentType,
          documentId: signaturesTable.documentId,
          fieldName: signaturesTable.fieldName,
        }).from(signaturesTable).where(inArray(signaturesTable.documentId, assignedDocumentIds))
      : [];
    const signedAssignmentKeys = new Set(assignedSignatures.map((signature) => `${signature.documentType}:${signature.documentId}:${signature.fieldName}`));
    const signatureFieldLabels: Record<string, string> = {
      reporting_person: "مُبلّغ العطل",
      department_supervisor: "مشرف القسم",
      qa_supervisor_approval: "مسؤول الجودة",
      maintenance_technician: "فني الصيانة",
      concerned_section_supervisor: "مشرف القسم المعني",
      performing_staff: "القائم بالعمل",
      receiver: "مستلم الماكينة",
      engineering_final: "الهندسة",
      prepared_by: "المُعدّ",
      approved_by: "المعتمد",
      department_manager: "مدير الدائرة",
      engineering_manager: "مدير دائرة الهندسة",
      examiner: "الفاحص",
      machine_receiver: "مستلم الماكينة",
    };
    const signatureDocumentHref = (documentType: string, documentId: number) => {
      if (documentType === "MAINTENANCE_REQUEST") return `/maintenance-requests/${documentId}`;
      if (documentType === "EXTERNAL_MAINTENANCE_REQUEST") return `/maintenance-requests/${documentId}/external-maintenance`;
      if (documentType === "EXTERNAL_MAINTENANCE_RECEIPT") return `/maintenance-requests/${documentId}/external-maintenance/receipt`;
      if (documentType === "EQUIPMENT_INFORMATION") return `/machines/${documentId}/equipment-information`;
      if (documentType === "MONTHLY_PLAN") return "/maintenance-plans";
      if (documentType === "ANNUAL_PLAN") return "/maintenance-plans";
      if (documentType === "MONTHLY_MAINTENANCE_EVALUATION") return "/reports";
      return "/dashboard";
    };
    requestNotifications.push(...signatureAssignments
      .filter((assignment) => !signedAssignmentKeys.has(`${assignment.documentType}:${assignment.documentId}:${assignment.fieldName}`))
      .map((assignment) => ({
        type: "signature",
        message: `توقيع مطلوب منك: ${signatureFieldLabels[assignment.fieldName] ?? assignment.fieldName.replaceAll("_", " ")}`,
        href: signatureDocumentHref(assignment.documentType, assignment.documentId),
      })));

    const [receiverPermission] = await db.select({ id: signatureFieldPermissionsTable.id })
      .from(signatureFieldPermissionsTable)
      .where(and(eq(signatureFieldPermissionsTable.documentType, "PM_RECORD"), eq(signatureFieldPermissionsTable.fieldName, "machine_receiver"), eq(signatureFieldPermissionsTable.eligibleUserId, currentUserId), isNull(signatureFieldPermissionsTable.revokedAt)));
    if (receiverPermission) {
      const pendingReceipts = await db.select({ inspectionId: pmInspectionsTable.id, machineId: pmInspectionsTable.machineId, machineName: machinesTable.machineName, machineNumber: machinesTable.machineNumber, completedByUserId: pmInspectionsTable.completedByUserId })
        .from(pmInspectionsTable).innerJoin(machinesTable, eq(pmInspectionsTable.machineId, machinesTable.id))
        .where(isNull(pmInspectionsTable.machineReceiverSignature));
      requestNotifications.push(...pendingReceipts
        .filter((inspection) => inspection.completedByUserId !== currentUserId)
        .map((inspection) => ({ type: "signature", message: `صيانة وقائية بانتظار استلامك للماكينة: ${inspection.machineName} (${inspection.machineNumber})`, href: `/machines/${inspection.machineId}/pm` })));
    }

    const [permanentConcernedSupervisorPermission] = await db
      .select({ id: signatureFieldPermissionsTable.id })
      .from(signatureFieldPermissionsTable)
      .where(and(
        eq(signatureFieldPermissionsTable.documentType, "MAINTENANCE_REQUEST"),
        eq(signatureFieldPermissionsTable.fieldName, "concerned_section_supervisor"),
        eq(signatureFieldPermissionsTable.eligibleUserId, currentUserId),
        isNull(signatureFieldPermissionsTable.revokedAt),
      ))
      .limit(1);
    if (permanentConcernedSupervisorPermission) {
      const concernedSupervisorCandidates = await db
        .select({
          requestId: maintenanceRequestsTable.id,
          requestReportNumber: maintenanceRequestsTable.requestReportNumber,
          machineName: maintenanceRequestsTable.machineName,
          preliminaryCheckResults: correctiveMaintenanceEventsTable.preliminaryCheckResults,
        })
        .from(correctiveMaintenanceEventsTable)
        .innerJoin(maintenanceRequestsTable, eq(correctiveMaintenanceEventsTable.requestId, maintenanceRequestsTable.id))
        .where(isNull(maintenanceRequestsTable.archivedAt));
      const candidateIds = concernedSupervisorCandidates
        .filter((candidate) => candidate.preliminaryCheckResults)
        .map((candidate) => candidate.requestId);
      const signedRows = candidateIds.length
        ? await db.select({ documentId: signaturesTable.documentId }).from(signaturesTable).where(and(
            eq(signaturesTable.documentType, "MAINTENANCE_REQUEST"),
            eq(signaturesTable.fieldName, "concerned_section_supervisor"),
            inArray(signaturesTable.documentId, candidateIds),
          ))
        : [];
      const signedRequestIds = new Set(signedRows.map((signature) => signature.documentId));
      requestNotifications.push(...concernedSupervisorCandidates
        .filter((candidate) => candidate.preliminaryCheckResults && !signedRequestIds.has(candidate.requestId))
        .map((candidate) => ({
          type: "signature",
          message: `طلب صيانة بانتظار توقيعك كمشرف القسم المعني: ${candidate.requestReportNumber || candidate.machineName}`,
          href: `/maintenance-requests/${candidate.requestId}`,
        })));
    }

    const statusLabels: Record<string, string> = {
      "Pending Department Supervisor Approval": "بانتظار موافقة مشرف القسم",
      "Pending QA Approval": "بانتظار موافقة QA",
      "QA Approved": "تمت الموافقة عليه من QA",
      "QA Rejected": "تم رفضه من QA",
      "Accepted": "تمت الموافقة عليه من الهندسة",
      "Rejected": "تم رفضه من الهندسة",
      "In Progress": "قيد التنفيذ",
      "Completed": "مكتمل",
      "Closed": "مغلق",
    };
    requestNotifications.push(...requestRows
      .filter((row) => row.requestedByUserId === currentUserId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8)
      .map((row) => ({
        type: "request_status",
        message: `حالة طلبك ${row.requestReportNumber.startsWith("PENDING-") ? "قيد المراجعة" : row.requestReportNumber}: ${statusLabels[row.status] ?? row.status}`,
        href: `/maintenance-requests/${row.id}`,
      })));
  }

  const monthlyPmCompletionMachines = {
    completed: monthlyPmRows
      .filter((r) => !!r.actualDate)
      .map((r) => ({ id: r.id, machineId: r.machineId, machineName: r.machineName, machineNumber: r.machineNumber ?? "" })),
    overdue: overdueRows
      .map((r) => ({ id: r.id, machineId: r.machineId, machineName: r.machineName, machineNumber: r.machineNumber ?? "" })),
  };
  const recentRequests = requestRows
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      requestReportNumber: row.requestReportNumber,
      machineName: row.machineName,
      machineNumber: row.machineNumber,
      status: row.status,
      requestDate: row.requestDate,
    }));
  const currentMonthKey = isoDate(new Date()).slice(0, 7);
  const completedCorrectiveThisMonth = requestRows
    .filter((row) => (row.status === "Completed" || row.status === "Closed") && (row.closedAt ?? row.updatedAt).toISOString().slice(0, 7) === currentMonthKey)
    .sort((a, b) => (b.closedAt ?? b.updatedAt).getTime() - (a.closedAt ?? a.updatedAt).getTime())
    .map((row) => ({ id: row.id, requestReportNumber: row.requestReportNumber, machineId: row.machineId, machineName: row.machineName, machineNumber: row.machineNumber, completedDate: isoDate(row.closedAt ?? row.updatedAt) }));

  const lowStockParts = await db
    .select()
    .from(sparePartsTable)
    .where(and(isNull(sparePartsTable.deletedAt), sql`${sparePartsTable.currentQuantity} <= ${sparePartsTable.minimumQuantity}`))
    .orderBy(sparePartsTable.currentQuantity, sparePartsTable.partName)
    .limit(5);

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
    thisWeekPm,
    monthlyPmCompletion: [
      { label: "Completed", count: completedCount },
      { label: "Overdue / Not Completed", count: notCompletedCount },
    ],
    maintenanceRequests: requestSummary,
    maintenanceRequestNotifications: requestNotifications,
    recentMaintenanceRequests: recentRequests,
    completedCorrectiveThisMonth,
    monthlyPmCompletionMachines,
    lowStockSpareParts: lowStockParts.map((part) => ({
      id: part.id,
      partName: part.partName,
      partCode: part.partCode,
      currentQuantity: part.currentQuantity,
      minimumQuantity: part.minimumQuantity,
      unit: part.unit,
    })),
  });
});

export default router;
