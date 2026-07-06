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
import { usersTable } from "./users";

export const sparePartsTable = pgTable(
  "spare_parts",
  {
    id: serial("id").primaryKey(),
    partName: text("part_name").notNull(),
    partCode: text("part_code").notNull(),
    description: text("description"),
    category: text("category"),
    unit: text("unit").notNull().default("piece"),
    minimumQuantity: integer("minimum_quantity").notNull().default(0),
    currentQuantity: integer("current_quantity").notNull().default(0),
    location: text("location"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [uniqueIndex("spare_parts_part_code_idx").on(table.partCode)],
);

export const sparePartMovementsTable = pgTable("spare_part_movements", {
  id: serial("id").primaryKey(),
  sparePartId: integer("spare_part_id")
    .notNull()
    .references(() => sparePartsTable.id),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  quantityBefore: integer("quantity_before").notNull(),
  quantityAfter: integer("quantity_after").notNull(),
  movementDate: text("movement_date").notNull(),
  reason: text("reason"),
  referenceType: text("reference_type").notNull().default("MANUAL"),
  referenceId: integer("reference_id"),
  recordedByUserId: integer("recorded_by_user_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSparePartSchema = createInsertSchema(sparePartsTable).omit({
  id: true,
  currentQuantity: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type InsertSparePart = z.infer<typeof insertSparePartSchema>;
export type SparePart = typeof sparePartsTable.$inferSelect;
export type SparePartMovement = typeof sparePartMovementsTable.$inferSelect;
