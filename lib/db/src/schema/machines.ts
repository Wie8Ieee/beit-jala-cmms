import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./users";

export const machinesTable = pgTable("machines", {
  id: serial("id").primaryKey(),
  machineNumber: text("machine_number").notNull().unique(),
  machineName: text("machine_name").notNull(),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  location: text("location"),
  status: text("status").notNull().default("active"),
  pmFrequencyMonths: integer("pm_frequency_months"),
  pmStartDate: text("pm_start_date"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMachineSchema = createInsertSchema(machinesTable).omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machinesTable.$inferSelect;
