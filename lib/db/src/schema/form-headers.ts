import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const formHeadersTable = pgTable("form_headers", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull(),
  documentId: integer("document_id").notNull(),
  companyName: text("company_name").notNull().default("Beit Jala Pharmaceutical Co."),
  documentName: text("document_name").notNull(),
  documentNumber: text("document_number").notNull(),
  effectiveOrExecutionDate: text("effective_or_execution_date"),
  pageNumber: integer("page_number").notNull().default(1),
  totalPages: integer("total_pages").notNull().default(1),
  machineName: text("machine_name"),
  machineNumber: text("machine_number"),
  machineLocation: text("machine_location"),
  startupDate: text("startup_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FormHeader = typeof formHeadersTable.$inferSelect;
