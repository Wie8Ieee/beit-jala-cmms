import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const eligibleSignerAssignmentsTable = pgTable("eligible_signer_assignments", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull(),
  documentId: integer("document_id").notNull(),
  fieldName: text("field_name").notNull(),
  eligibleUserId: integer("eligible_user_id")
    .notNull()
    .references(() => usersTable.id),
  grantedBy: integer("granted_by").references(() => usersTable.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const signaturesTable = pgTable("signatures", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull(),
  documentId: integer("document_id").notNull(),
  fieldName: text("field_name").notNull(),
  signatureType: text("signature_type").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  userName: text("user_name").notNull(),
  eligibleSignerAssignmentId: integer("eligible_signer_assignment_id").references(
    () => eligibleSignerAssignmentsTable.id,
  ),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
});

export type EligibleSignerAssignment =
  typeof eligibleSignerAssignmentsTable.$inferSelect;
export type Signature = typeof signaturesTable.$inferSelect;
