import { Router } from "express";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  eligibleSignerAssignmentsTable,
  signatureFieldPermissionsTable,
  signaturesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDocumentId(value: unknown) {
  const first = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(typeof first === "string" ? first : "", 10);
}

function normalizeDocumentType(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeFieldName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatAssignment(row: typeof eligibleSignerAssignmentsTable.$inferSelect & {
  eligibleUserName?: string | null;
}) {
  return {
    id: row.id,
    documentType: row.documentType,
    documentId: row.documentId,
    fieldName: row.fieldName,
    eligibleUserId: row.eligibleUserId,
    eligibleUserName: row.eligibleUserName ?? null,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

function formatSignature(row: typeof signaturesTable.$inferSelect) {
  return {
    id: row.id,
    documentType: row.documentType,
    documentId: row.documentId,
    fieldName: row.fieldName,
    signatureType: row.signatureType,
    userId: row.userId,
    userName: row.userName,
    signatureData: row.signatureData,
    eligibleSignerAssignmentId: row.eligibleSignerAssignmentId,
    signedAt: row.signedAt.toISOString(),
  };
}

function formatFieldPermission(row: typeof signatureFieldPermissionsTable.$inferSelect & { eligibleUserName?: string | null }) {
  return {
    id: row.id,
    documentType: row.documentType,
    fieldName: row.fieldName,
    eligibleUserId: row.eligibleUserId,
    eligibleUserName: row.eligibleUserName ?? null,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

async function audit(req: Parameters<Parameters<typeof router.post>[1]>[0], action: string, entityId: number, details: Record<string, unknown>) {
  await db.insert(auditLogsTable).values({
    userId: req.session.userId ?? null,
    action,
    entityType: "signature",
    entityId,
    details,
  });
}

// A saved signature is the user's current official signature. When it is
// replaced, update its copies in existing forms as well as electronic-signature
// records, so every place signed by that user renders the same signature.
async function replaceUserSignature(userId: number, signatureData: string) {
  const [user] = await db
    .select({ id: usersTable.id, signatureData: usersTable.signatureData })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) return null;

  const previousSignature = user.signatureData;
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ signatureData, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    await tx.update(signaturesTable).set({ signatureData }).where(eq(signaturesTable.userId, userId));
    if (!previousSignature?.startsWith("data:image/") || previousSignature === signatureData) return;

    await Promise.all([
      tx.execute(sql`UPDATE maintenance_requests SET
        reporting_person_signature = CASE WHEN reporting_person_signature = ${previousSignature} THEN ${signatureData} ELSE reporting_person_signature END,
        department_supervisor_signature = CASE WHEN department_supervisor_signature = ${previousSignature} THEN ${signatureData} ELSE department_supervisor_signature END,
        qa_supervisor_signature = CASE WHEN qa_supervisor_signature = ${previousSignature} THEN ${signatureData} ELSE qa_supervisor_signature END,
        engineering_supervisor_signature = CASE WHEN engineering_supervisor_signature = ${previousSignature} THEN ${signatureData} ELSE engineering_supervisor_signature END,
        updated_at = NOW()
        WHERE reporting_person_signature = ${previousSignature} OR department_supervisor_signature = ${previousSignature} OR qa_supervisor_signature = ${previousSignature} OR engineering_supervisor_signature = ${previousSignature}`),
      tx.execute(sql`UPDATE corrective_maintenance_events SET
        maintenance_technician_signature = CASE WHEN maintenance_technician_signature = ${previousSignature} THEN ${signatureData} ELSE maintenance_technician_signature END,
        concerned_section_supervisor_signature = CASE WHEN concerned_section_supervisor_signature = ${previousSignature} THEN ${signatureData} ELSE concerned_section_supervisor_signature END,
        receiver_signature = CASE WHEN receiver_signature = ${previousSignature} THEN ${signatureData} ELSE receiver_signature END,
        engineering_signature = CASE WHEN engineering_signature = ${previousSignature} THEN ${signatureData} ELSE engineering_signature END,
        updated_at = NOW()
        WHERE maintenance_technician_signature = ${previousSignature} OR concerned_section_supervisor_signature = ${previousSignature} OR receiver_signature = ${previousSignature} OR engineering_signature = ${previousSignature}`),
      tx.execute(sql`UPDATE external_maintenance_requests SET
        maintenance_technician_signature = CASE WHEN maintenance_technician_signature = ${previousSignature} THEN ${signatureData} ELSE maintenance_technician_signature END,
        department_manager_signature = CASE WHEN department_manager_signature = ${previousSignature} THEN ${signatureData} ELSE department_manager_signature END,
        general_manager_signature = CASE WHEN general_manager_signature = ${previousSignature} THEN ${signatureData} ELSE general_manager_signature END,
        updated_at = NOW()
        WHERE maintenance_technician_signature = ${previousSignature} OR department_manager_signature = ${previousSignature} OR general_manager_signature = ${previousSignature}`),
      tx.execute(sql`UPDATE external_maintenance_receipts SET
        examiner_signature = CASE WHEN examiner_signature = ${previousSignature} THEN ${signatureData} ELSE examiner_signature END,
        updated_at = NOW()
        WHERE examiner_signature = ${previousSignature}`),
      tx.execute(sql`UPDATE monthly_maintenance_evaluation_reports SET
        engineering_manager_signature = CASE WHEN engineering_manager_signature = ${previousSignature} THEN ${signatureData} ELSE engineering_manager_signature END,
        updated_at = NOW()
        WHERE engineering_manager_signature = ${previousSignature}`),
      tx.execute(sql`UPDATE pm_inspections SET
        examiner_signature = CASE WHEN examiner_signature = ${previousSignature} THEN ${signatureData} ELSE examiner_signature END,
        machine_receiver_signature = CASE WHEN machine_receiver_signature = ${previousSignature} THEN ${signatureData} ELSE machine_receiver_signature END
        WHERE examiner_signature = ${previousSignature} OR machine_receiver_signature = ${previousSignature}`),
    ]);
  });
  return { id: user.id, signatureData };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.query.documentType);
    const documentId = parseDocumentId(req.query.documentId);
    if (!documentType || Number.isNaN(documentId)) {
      res.status(400).json({ error: "documentType and documentId are required" });
      return;
    }

    const rows = await db
      .select()
      .from(signaturesTable)
      .where(and(eq(signaturesTable.documentType, documentType), eq(signaturesTable.documentId, documentId)));

    res.json(rows.map(formatSignature));
  } catch (err) {
    next(err);
  }
});

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const [user] = await db.select({ signatureData: usersTable.signatureData }).from(usersTable).where(eq(usersTable.id, req.session.userId!));
    res.json({ signatureData: user?.signatureData ?? null });
  } catch (err) { next(err); }
});

router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const signatureData = typeof req.body.signatureData === "string" ? req.body.signatureData : "";
    if (!signatureData.startsWith("data:image/")) { res.status(400).json({ error: "A drawn signature image is required" }); return; }
    if (signatureData.length > 300_000) { res.status(400).json({ error: "Signature image is too large" }); return; }
    const updated = await replaceUserSignature(req.session.userId!, signatureData);
    res.json({ signatureData: updated!.signatureData });
  } catch (err) { next(err); }
});

router.put("/users/:id/profile", requireAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const signatureData = typeof req.body.signatureData === "string" ? req.body.signatureData : "";
    if (!Number.isInteger(userId) || !signatureData.startsWith("data:image/")) { res.status(400).json({ error: "A drawn signature image is required" }); return; }
    const updated = await replaceUserSignature(userId, signatureData);
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

// Permanent configuration: administrators assign users once per form field.
// The assignment then applies automatically to every document of that form.
router.get("/field-permissions", requireAuth, async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.query.documentType);
    const fieldName = normalizeFieldName(req.query.fieldName);
    const conditions = [isNull(signatureFieldPermissionsTable.revokedAt)];
    if (documentType) conditions.push(eq(signatureFieldPermissionsTable.documentType, documentType));
    if (fieldName) conditions.push(eq(signatureFieldPermissionsTable.fieldName, fieldName));
    const rows = await db.select({
      id: signatureFieldPermissionsTable.id,
      documentType: signatureFieldPermissionsTable.documentType,
      fieldName: signatureFieldPermissionsTable.fieldName,
      eligibleUserId: signatureFieldPermissionsTable.eligibleUserId,
      eligibleUserName: usersTable.fullName,
      grantedBy: signatureFieldPermissionsTable.grantedBy,
      grantedAt: signatureFieldPermissionsTable.grantedAt,
      revokedAt: signatureFieldPermissionsTable.revokedAt,
    }).from(signatureFieldPermissionsTable)
      .leftJoin(usersTable, eq(usersTable.id, signatureFieldPermissionsTable.eligibleUserId))
      .where(and(...conditions));
    res.json(rows.map(formatFieldPermission));
  } catch (err) { next(err); }
});

router.post("/field-permissions", requireAuth, requirePermission("manage_signatures"), async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.body.documentType);
    const fieldName = normalizeFieldName(req.body.fieldName);
    const employeeNumber = typeof req.body.employeeNumber === "string" ? req.body.employeeNumber.trim() : "";
    if (!documentType || !fieldName || !employeeNumber) { res.status(400).json({ error: "documentType, fieldName, and employeeNumber are required" }); return; }
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.employeeNumber, employeeNumber));
    if (!user) { res.status(404).json({ error: "No user was found with this employee number" }); return; }
    const [existing] = await db.select().from(signatureFieldPermissionsTable).where(and(
      eq(signatureFieldPermissionsTable.documentType, documentType), eq(signatureFieldPermissionsTable.fieldName, fieldName),
      eq(signatureFieldPermissionsTable.eligibleUserId, user.id), isNull(signatureFieldPermissionsTable.revokedAt),
    ));
    if (existing) { res.status(409).json({ error: "This user is already allowed to sign this form field" }); return; }
    const [created] = await db.insert(signatureFieldPermissionsTable).values({ documentType, fieldName, eligibleUserId: user.id, grantedBy: req.session.userId ?? null }).returning();
    await audit(req, "signature_field_permission_granted", created!.id, { documentType, fieldName, eligibleUserId: user.id });
    res.status(201).json(formatFieldPermission(created!));
  } catch (err) { next(err); }
});

router.patch("/field-permissions/:id/revoke", requireAuth, requirePermission("manage_signatures"), async (req, res, next) => {
  try {
    const id = Number.parseInt(firstParam(req.params.id) ?? "", 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid permission ID" }); return; }
    const [updated] = await db.update(signatureFieldPermissionsTable).set({ revokedAt: new Date() }).where(eq(signatureFieldPermissionsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Signature permission not found" }); return; }
    await audit(req, "signature_field_permission_revoked", id, { documentType: updated.documentType, fieldName: updated.fieldName, eligibleUserId: updated.eligibleUserId });
    res.json(formatFieldPermission(updated));
  } catch (err) { next(err); }
});

router.get("/eligible", requireAuth, async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.query.documentType);
    const documentId = parseDocumentId(req.query.documentId);
    if (!documentType || Number.isNaN(documentId)) {
      res.status(400).json({ error: "documentType and documentId are required" });
      return;
    }

    const rows = await db
      .select({
        id: eligibleSignerAssignmentsTable.id,
        documentType: eligibleSignerAssignmentsTable.documentType,
        documentId: eligibleSignerAssignmentsTable.documentId,
        fieldName: eligibleSignerAssignmentsTable.fieldName,
        eligibleUserId: eligibleSignerAssignmentsTable.eligibleUserId,
        eligibleUserName: usersTable.fullName,
        grantedBy: eligibleSignerAssignmentsTable.grantedBy,
        grantedAt: eligibleSignerAssignmentsTable.grantedAt,
        revokedAt: eligibleSignerAssignmentsTable.revokedAt,
      })
      .from(eligibleSignerAssignmentsTable)
      .leftJoin(usersTable, eq(usersTable.id, eligibleSignerAssignmentsTable.eligibleUserId))
      .where(and(eq(eligibleSignerAssignmentsTable.documentType, documentType), eq(eligibleSignerAssignmentsTable.documentId, documentId)));

    res.json(rows.map(formatAssignment));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/eligible",
  requireAuth,
  requirePermission("manage_signatures"),
  async (req, res, next) => {
    try {
      const documentType = normalizeDocumentType(req.body.documentType);
      const documentId = Number(req.body.documentId);
      const fieldName = normalizeFieldName(req.body.fieldName);
      const employeeNumber = typeof req.body.employeeNumber === "string" ? req.body.employeeNumber.trim() : "";
      if (!documentType || Number.isNaN(documentId) || !fieldName || !employeeNumber) {
        res.status(400).json({ error: "documentType, documentId, fieldName, and employeeNumber are required" });
        return;
      }
      const [eligibleUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.employeeNumber, employeeNumber));
      if (!eligibleUser) { res.status(404).json({ error: "No user was found with this employee number" }); return; }
      const eligibleUserId = eligibleUser.id;

      const [existing] = await db
        .select()
        .from(eligibleSignerAssignmentsTable)
        .where(
          and(
            eq(eligibleSignerAssignmentsTable.documentType, documentType),
            eq(eligibleSignerAssignmentsTable.documentId, documentId),
            eq(eligibleSignerAssignmentsTable.fieldName, fieldName),
            eq(eligibleSignerAssignmentsTable.eligibleUserId, eligibleUserId),
            isNull(eligibleSignerAssignmentsTable.revokedAt),
          ),
        );
      if (existing) {
        res.status(409).json({ error: "Eligible signer is already active for this field" });
        return;
      }

      const [created] = await db
        .insert(eligibleSignerAssignmentsTable)
        .values({
          documentType,
          documentId,
          fieldName,
          eligibleUserId,
          grantedBy: req.session.userId ?? null,
        })
        .returning();

      await audit(req, "eligible_signer_granted", created!.id, {
        documentType,
        documentId,
        fieldName,
        eligibleUserId,
      });
      res.status(201).json(formatAssignment(created!));
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/eligible/:id/revoke",
  requireAuth,
  requirePermission("manage_signatures"),
  async (req, res, next) => {
    try {
      const id = Number.parseInt(firstParam(req.params.id) ?? "", 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "Invalid assignment ID" });
        return;
      }
      const [updated] = await db
        .update(eligibleSignerAssignmentsTable)
        .set({ revokedAt: new Date() })
        .where(eq(eligibleSignerAssignmentsTable.id, id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Eligible signer assignment not found" });
        return;
      }
      await audit(req, "eligible_signer_revoked", id, {
        documentType: updated.documentType,
        documentId: updated.documentId,
        fieldName: updated.fieldName,
        eligibleUserId: updated.eligibleUserId,
      });
      res.json(formatAssignment(updated));
    } catch (err) {
      next(err);
    }
  },
);

router.post("/sign", requireAuth, async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.body.documentType);
    const documentId = Number(req.body.documentId);
    const fieldName = normalizeFieldName(req.body.fieldName);
    const authorizationFieldName = normalizeFieldName(req.body.authorizationFieldName) || fieldName;
    const signatureType = normalizeFieldName(req.body.signatureType) || "electronic";
    if (!documentType || Number.isNaN(documentId) || !fieldName) {
      res.status(400).json({ error: "documentType, documentId, and fieldName are required" });
      return;
    }

    const [existingSignature] = await db
      .select()
      .from(signaturesTable)
      .where(
        and(
          eq(signaturesTable.documentType, documentType),
          eq(signaturesTable.documentId, documentId),
          eq(signaturesTable.fieldName, fieldName),
        ),
      );
    if (existingSignature) {
      res.status(409).json({ error: "This field has already been signed and cannot be changed" });
      return;
    }

    const [assignment] = await db
      .select()
      .from(eligibleSignerAssignmentsTable)
      .where(
        and(
          eq(eligibleSignerAssignmentsTable.documentType, documentType),
          eq(eligibleSignerAssignmentsTable.documentId, documentId),
          or(
            eq(eligibleSignerAssignmentsTable.fieldName, fieldName),
            eq(eligibleSignerAssignmentsTable.fieldName, authorizationFieldName),
          ),
          eq(eligibleSignerAssignmentsTable.eligibleUserId, req.session.userId!),
          isNull(eligibleSignerAssignmentsTable.revokedAt),
        ),
      );
    const [permanentPermission] = await db.select().from(signatureFieldPermissionsTable).where(and(
      eq(signatureFieldPermissionsTable.documentType, documentType),
      eq(signatureFieldPermissionsTable.fieldName, authorizationFieldName),
      eq(signatureFieldPermissionsTable.eligibleUserId, req.session.userId!),
      isNull(signatureFieldPermissionsTable.revokedAt),
    ));
    if (!assignment && !permanentPermission) {
      res.status(403).json({ error: "You are not an eligible signer for this field" });
      return;
    }

    const [user] = await db
      .select({ username: usersTable.username, fullName: usersTable.fullName, signatureData: usersTable.signatureData })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const [created] = await db
      .insert(signaturesTable)
      .values({
        documentType,
        documentId,
        fieldName,
        signatureType,
        userId: req.session.userId!,
        userName: user.fullName || user.username,
        signatureData: user.signatureData,
        eligibleSignerAssignmentId: assignment?.id ?? null,
      })
      .returning();

    await audit(req, "document_signed", created!.id, {
      documentType,
      documentId,
      fieldName,
      authorizationFieldName,
      signatureType,
    });
    res.status(201).json(formatSignature(created!));
  } catch (err) {
    next(err);
  }
});

export default router;
