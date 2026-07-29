import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable, usersTable } from "./users";
import { machinesTable } from "./machines";

export const maintenanceRequestsTable = pgTable("maintenance_requests", {
  id: serial("id").primaryKey(),
  requestReportNumber: text("request_report_number").notNull().unique(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  requestedByUserId: integer("requested_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  departmentSection: text("department_section"),
  priority: text("priority").notNull().default("normal"),
  machineName: text("machine_name").notNull(),
  machineNumber: text("machine_number").notNull(),
  requestDate: text("request_date").notNull(),
  failureDescription: text("failure_description").notNull(),
  reportingPersonName: text("reporting_person_name"),
  reportingPersonSignature: text("reporting_person_signature"),
  departmentSupervisorName: text("department_supervisor_name"),
  departmentSupervisorSignature: text("department_supervisor_signature"),
  qaDecision: text("qa_decision"),
  qaSupervisorSignature: text("qa_supervisor_signature"),
  qaReviewDate: text("qa_review_date"),
  status: text("status").notNull().default("Pending QA Approval"),
  qaReviewedByUserId: integer("qa_reviewed_by_user_id").references(() => usersTable.id),
  qaReviewedAt: timestamp("qa_reviewed_at"),
  qaReviewNotes: text("qa_review_notes"),
  engineeringDecision: text("engineering_decision"),
  assignedTechnicianUserId: integer("assigned_technician_user_id").references(() => usersTable.id),
  engineeringSupervisorSignature: text("engineering_supervisor_signature"),
  engineeringReviewedByUserId: integer("engineering_reviewed_by_user_id").references(() => usersTable.id),
  engineeringReviewedAt: timestamp("engineering_reviewed_at"),
  engineeringReviewNotes: text("engineering_review_notes"),
  expectedWorkTimeFrom: text("expected_work_time_from"),
  expectedWorkTimeTo: text("expected_work_time_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const correctiveMaintenanceRecordsTable = pgTable("corrective_maintenance_records", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  sequenceNumber: integer("sequence_number").notNull(),
  documentNumber: text("document_number").notNull().default("LOG-00-0102-3"),
  executionDate: text("execution_date"),
  pageCount: text("page_count").notNull().default("Page 1 of 1"),
  machineName: text("machine_name").notNull(),
  machineNumber: text("machine_number").notNull(),
  machineLocation: text("machine_location"),
  startupDate: text("startup_date"),
  maxRows: integer("max_rows").notNull().default(3),
  status: text("status").notNull().default("active"),
  previousRecordId: integer("previous_record_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const correctiveMaintenanceEventsTable = pgTable(
  "corrective_maintenance_events",
  {
    id: serial("id").primaryKey(),
    recordId: integer("record_id")
      .notNull()
      .references(() => correctiveMaintenanceRecordsTable.id),
    requestId: integer("request_id")
      .unique()
      .references(() => maintenanceRequestsTable.id),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machinesTable.id),
    requestReportNumber: text("request_report_number"),
    requestDate: text("request_date"),
    maintenanceType: text("maintenance_type"),
    rowNumber: integer("row_number").notNull(),
    preliminaryCheckResults: text("preliminary_check_results"),
    expectedWorkTimeFrom: text("expected_work_time_from"),
    expectedWorkTimeTo: text("expected_work_time_to"),
    repairTimeSlots: text("repair_time_slots").notNull().default("[]"),
    technicianName: text("technician_name"),
    sparePartsUsed: text("spare_parts_used"),
    maintenanceTechnicianSignature: text("maintenance_technician_signature"),
    concernedSectionSupervisorSignature: text("concerned_section_supervisor_signature"),
    actionsTaken: text("actions_taken"),
    remarksRecommendations: text("remarks_recommendations"),
    performingStaff: text("performing_staff").notNull().default("[]"),
    receiverName: text("receiver_name"),
    receiverSignature: text("receiver_signature"),
    handoverDate: text("handover_date"),
    engineeringSignature: text("engineering_signature"),
    completedByUserId: integer("completed_by_user_id").references(() => usersTable.id),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cm_events_record_row_idx").on(table.recordId, table.rowNumber),
    uniqueIndex("cm_events_request_number_idx").on(table.requestReportNumber),
  ],
);

export const maintenanceRequestStatusHistoryTable = pgTable("maintenance_request_status_history", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => maintenanceRequestsTable.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedByUserId: integer("changed_by_user_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Supplemental rows for LOG-10-0659-0. Closed maintenance requests continue
 * to populate the register automatically; this table is only for exceptional
 * entries that need to be recorded manually. Entries are soft-deleted so the
 * controlled log remains auditable.
 */
export const closedCorrectiveMaintenanceManualEntriesTable = pgTable("closed_corrective_maintenance_manual_entries", {
  id: serial("id").primaryKey(),
  machineName: text("machine_name").notNull(),
  machineNumber: text("machine_number").notNull(),
  requestDate: text("request_date").notNull(),
  requestReportNumber: text("request_report_number").notNull(),
  priority: text("priority").notNull().default("normal"),
  closedDate: text("closed_date").notNull(),
  remarks: text("remarks"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Keeps a controlled, auditable exclusion list for automatically generated
 * LOG-10-0659-0 rows. The underlying maintenance request is never deleted.
 */
export const closedCorrectiveMaintenanceLogExclusionsTable = pgTable("closed_corrective_maintenance_log_exclusions", {
  id: serial("id").primaryKey(),
  maintenanceRequestId: integer("maintenance_request_id")
    .notNull()
    .unique()
    .references(() => maintenanceRequestsTable.id),
  excludedAt: timestamp("excluded_at").defaultNow().notNull(),
  excludedByUserId: integer("excluded_by_user_id").references(() => usersTable.id),
});

/** FORM-00-0077-1. One external-maintenance conversion may exist per original request. */
export const externalMaintenanceRequestsTable = pgTable("external_maintenance_requests", {
  id: serial("id").primaryKey(),
  maintenanceRequestId: integer("maintenance_request_id")
    .notNull()
    .unique()
    .references(() => maintenanceRequestsTable.id),
  externalRequestNumber: text("external_request_number").notNull().unique(),
  requestDate: text("request_date").notNull(),
  departmentSection: text("department_section"),
  requiredMaintenance: text("required_maintenance"),
  preliminaryFindings: text("preliminary_findings"),
  technicianSuggestions: text("technician_suggestions"),
  maintenanceTechnicianSignature: text("maintenance_technician_signature"),
  maintenanceTechnicianDate: text("maintenance_technician_date"),
  departmentManagerSignature: text("department_manager_signature"),
  departmentManagerDate: text("department_manager_date"),
  generalManagerSignature: text("general_manager_signature"),
  generalManagerDate: text("general_manager_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** FORM-10-0240-1 — receipt of completed external maintenance work. */
export const externalMaintenanceReceiptsTable = pgTable("external_maintenance_receipts", {
  id: serial("id").primaryKey(),
  externalMaintenanceRequestId: integer("external_maintenance_request_id")
    .notNull()
    .unique()
    .references(() => externalMaintenanceRequestsTable.id),
  maintenanceType: text("maintenance_type").notNull().default("صيانة خارجية"),
  requestingDepartment: text("requesting_department"),
  receiptDate: text("receipt_date"),
  performingEntity: text("performing_entity"),
  workAcceptanceReport: text("work_acceptance_report"),
  workFailureCause: text("work_failure_cause"),
  examinerName: text("examiner_name"),
  examinerSignature: text("examiner_signature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** FORM-10-0944-0 — monthly maintenance work evaluation report. */
export const monthlyMaintenanceEvaluationReportsTable = pgTable("monthly_maintenance_evaluation_reports", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  delayedActivities: text("delayed_activities"),
  delayReason: text("delay_reason"),
  followUpIncluded: text("follow_up_included"),
  totalPmActivities: integer("total_pm_activities").notNull().default(0),
  completedPmOnTime: integer("completed_pm_on_time").notNull().default(0),
  productionImpact: text("production_impact"),
  sparePartShortage: text("spare_part_shortage"),
  correctiveMaintenanceDetails: text("corrective_maintenance_details"),
  totalCorrectiveRequests: integer("total_corrective_requests").notNull().default(0),
  unclosedCorrectiveRequests: integer("unclosed_corrective_requests").notNull().default(0),
  completedCorrectiveRequests: integer("completed_corrective_requests").notNull().default(0),
  externalMaintenanceDetails: text("external_maintenance_details"),
  totalExternalActivities: integer("total_external_activities").notNull().default(0),
  completedExternalActivities: integer("completed_external_activities").notNull().default(0),
  employeeDelayImpact: text("employee_delay_impact"),
  workingDays: integer("working_days").notNull().default(0),
  lostWorkDays: integer("lost_work_days").notNull().default(0),
  preparedBy: text("prepared_by"),
  preparedDate: text("prepared_date"),
  engineeringManagerSignature: text("engineering_manager_signature"),
  engineeringManagerDate: text("engineering_manager_date"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("monthly_maintenance_evaluation_year_month_idx").on(table.year, table.month)]);

export const correctiveMaintenanceStaffTable = pgTable("corrective_maintenance_staff", {
  id: serial("id").primaryKey(),
  eventId: integer("cm_event_id")
    .notNull()
    .references(() => correctiveMaintenanceEventsTable.id),
  staffOrder: integer("staff_order").notNull(),
  staffName: text("staff_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const correctiveMaintenanceHandoverTable = pgTable("corrective_maintenance_handover", {
  id: serial("id").primaryKey(),
  eventId: integer("cm_event_id")
    .notNull()
    .references(() => correctiveMaintenanceEventsTable.id),
  receiverName: text("receiver_name"),
  handoverDate: text("handover_date"),
  engineeringFinalConfirmation: text("engineering_final_confirmation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
});

export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
export type MaintenanceRequest = typeof maintenanceRequestsTable.$inferSelect;
export type CorrectiveMaintenanceRecord = typeof correctiveMaintenanceRecordsTable.$inferSelect;
export type CorrectiveMaintenanceEvent = typeof correctiveMaintenanceEventsTable.$inferSelect;
export type MaintenanceRequestStatusHistory = typeof maintenanceRequestStatusHistoryTable.$inferSelect;
export type ExternalMaintenanceRequest = typeof externalMaintenanceRequestsTable.$inferSelect;
export type ExternalMaintenanceReceipt = typeof externalMaintenanceReceiptsTable.$inferSelect;
export type CorrectiveMaintenanceStaff = typeof correctiveMaintenanceStaffTable.$inferSelect;
export type CorrectiveMaintenanceHandover = typeof correctiveMaintenanceHandoverTable.$inferSelect;
