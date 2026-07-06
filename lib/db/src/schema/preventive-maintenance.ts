import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { machinesTable } from "./machines";
import { usersTable } from "./users";

export const pmHeadersTable = pgTable("pm_headers", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id")
    .notNull()
    .unique()
    .references(() => machinesTable.id),
  procedureFormNumber: text("procedure_form_number").notNull().default("LOG-00-0102"),
  effectiveDate: text("effective_date"),
  department: text("department"),
  columnsPerRecord: integer("columns_per_record").notNull().default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pmChecklistPointsTable = pgTable("pm_checklist_points", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  pointText: text("point_text").notNull(),
  resultType: text("result_type").notNull().default("yes_no"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pmRecordsTable = pgTable("pm_records", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  sequenceNumber: integer("sequence_number").notNull(),
  previousRecordId: integer("previous_record_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pmInspectionsTable = pgTable("pm_inspections", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id")
    .notNull()
    .references(() => pmRecordsTable.id),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  columnNumber: integer("column_number").notNull(),
  inspectionDate: text("inspection_date").notNull(),
  inspectionTime: text("inspection_time").notNull(),
  actionTaken: text("action_taken"),
  examinerName: text("examiner_name"),
  examinerSignature: text("examiner_signature"),
  machineReceiverName: text("machine_receiver_name"),
  machineReceiverSignature: text("machine_receiver_signature"),
  completedByUserId: integer("completed_by_user_id").references(() => usersTable.id),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const pmInspectionResultsTable = pgTable("pm_inspection_results", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id")
    .notNull()
    .references(() => pmInspectionsTable.id),
  checklistPointId: integer("checklist_point_id")
    .notNull()
    .references(() => pmChecklistPointsTable.id),
  value: text("value"),
});

export const annualPmPlansTable = pgTable("annual_pm_plans", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  preparedByName: text("prepared_by_name"),
  preparedByDate: text("prepared_by_date"),
  approvedEngineeringName: text("approved_engineering_name"),
  approvedEngineeringDate: text("approved_engineering_date"),
  approvedProductionName: text("approved_production_name"),
  approvedProductionDate: text("approved_production_date"),
  approvedQcName: text("approved_qc_name"),
  approvedQcDate: text("approved_qc_date"),
  approvedRdName: text("approved_rd_name"),
  approvedRdDate: text("approved_rd_date"),
  approvedQaName: text("approved_qa_name"),
  approvedQaDate: text("approved_qa_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const annualPmPlanRowsTable = pgTable("annual_pm_plan_rows", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => annualPmPlansTable.id),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  department: text("department"),
  machineName: text("machine_name").notNull(),
  machineLocation: text("machine_location"),
  machineCode: text("machine_code"),
  frequencyMonths: integer("frequency_months"),
  duration: text("duration"),
  startDate: text("start_date"),
  finishDate: text("finish_date"),
  scheduledMonths: text("scheduled_months").notNull().default("[]"),
  isOverride: boolean("is_override").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monthlyPmPlansTable = pgTable(
  "monthly_pm_plans",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    preparedByName: text("prepared_by_name"),
    preparedByDate: text("prepared_by_date"),
    maintenanceSupervisorName: text("maintenance_supervisor_name"),
    maintenanceSupervisorDate: text("maintenance_supervisor_date"),
    departmentManagerName: text("department_manager_name"),
    departmentManagerDate: text("department_manager_date"),
    approvedByName: text("approved_by_name"),
    approvedByDate: text("approved_by_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("monthly_pm_plans_year_month_idx").on(table.year, table.month)],
);

export const monthlyPmPlanRowsTable = pgTable("monthly_pm_plan_rows", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => monthlyPmPlansTable.id),
  annualPlanRowId: integer("annual_plan_row_id").references(() => annualPmPlanRowsTable.id),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machinesTable.id),
  rowNumber: integer("row_number").notNull(),
  departmentName: text("department_name"),
  sectionName: text("section_name"),
  machineName: text("machine_name").notNull(),
  identificationNumber: text("identification_number"),
  plannedDateFrom: text("planned_date_from"),
  plannedDateTo: text("planned_date_to"),
  actualDate: text("actual_date"),
  amendments: text("amendments"),
  status: text("status").notNull().default("due"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPmHeaderSchema = createInsertSchema(pmHeadersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPmChecklistPointSchema = createInsertSchema(pmChecklistPointsTable).omit({
  id: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPmHeader = z.infer<typeof insertPmHeaderSchema>;
export type PmHeader = typeof pmHeadersTable.$inferSelect;
export type InsertPmChecklistPoint = z.infer<typeof insertPmChecklistPointSchema>;
export type PmChecklistPoint = typeof pmChecklistPointsTable.$inferSelect;
export type PmRecord = typeof pmRecordsTable.$inferSelect;
export type PmInspection = typeof pmInspectionsTable.$inferSelect;
export type PmInspectionResult = typeof pmInspectionResultsTable.$inferSelect;
export type AnnualPmPlan = typeof annualPmPlansTable.$inferSelect;
export type AnnualPmPlanRow = typeof annualPmPlanRowsTable.$inferSelect;
export type MonthlyPmPlan = typeof monthlyPmPlansTable.$inferSelect;
export type MonthlyPmPlanRow = typeof monthlyPmPlanRowsTable.$inferSelect;
