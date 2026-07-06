import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { machinesTable } from "./machines";

export const equipmentInformationTable = pgTable(
  "equipment_information_records",
  {
    id: serial("id").primaryKey(),
    machineId: integer("machine_id")
      .notNull()
      .unique()
      .references(() => machinesTable.id),
    nameOfEquipment: text("name_of_equipment"),
    modelNumber: text("model_number"),
    serialNumber: text("serial_number"),
    identificationNumber: text("identification_number"),
    datePurchased: text("date_purchased"),
    purchasedFromName: text("purchased_from_name"),
    purchasedFromAddress: text("purchased_from_address"),
    manufacturingCompanyName: text("manufacturing_company_name"),
    manufacturingCompanyAddress: text("manufacturing_company_address"),
    dimensionWidthCm: numeric("dimension_width_cm", {
      precision: 10,
      scale: 2,
    }),
    dimensionHeightCm: numeric("dimension_height_cm", {
      precision: 10,
      scale: 2,
    }),
    dimensionDepthCm: numeric("dimension_depth_cm", {
      precision: 10,
      scale: 2,
    }),
    weightKg: numeric("weight_kg", { precision: 10, scale: 2 }),
    utilitiesPowerSupply: text("utilities_power_supply"),
    utilitiesAir: text("utilities_air"),
    utilitiesWater: text("utilities_water"),
    utilitiesOther: text("utilities_other"),
    others: text("others"),
    safetyIssues: text("safety_issues"),
    preparedByName: text("prepared_by_name"),
    preparedByDate: text("prepared_by_date"),
    approvedByName: text("approved_by_name"),
    approvedByDate: text("approved_by_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export const insertEquipmentInformationSchema = createInsertSchema(
  equipmentInformationTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEquipmentInformation = z.infer<
  typeof insertEquipmentInformationSchema
>;
export type EquipmentInformation =
  typeof equipmentInformationTable.$inferSelect;
