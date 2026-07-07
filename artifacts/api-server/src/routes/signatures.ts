import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  eligibleSignerAssignmentsTable,
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
    eligibleSignerAssignmentId: row.eligibleSignerAssignmentId,
    signedAt: row.signedAt.toISOString(),
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
      const eligibleUserId = Number(req.body.eligibleUserId);
      if (!documentType || Number.isNaN(documentId) || !fieldName || Number.isNaN(eligibleUserId)) {
        res.status(400).json({ error: "documentType, documentId, fieldName, and eligibleUserId are required" });
        return;
      }

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

router.post("/sign", requireAuth, requirePermission("sign_assigned_fields"), async (req, res, next) => {
  try {
    const documentType = normalizeDocumentType(req.body.documentType);
    const documentId = Number(req.body.documentId);
    const fieldName = normalizeFieldName(req.body.fieldName);
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
          eq(eligibleSignerAssignmentsTable.fieldName, fieldName),
          eq(eligibleSignerAssignmentsTable.eligibleUserId, req.session.userId!),
          isNull(eligibleSignerAssignmentsTable.revokedAt),
        ),
      );
    if (!assignment) {
      res.status(403).json({ error: "You are not an eligible signer for this field" });
      return;
    }

    const [user] = await db
      .select({ username: usersTable.username, fullName: usersTable.fullName })
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
        eligibleSignerAssignmentId: assignment.id,
      })
      .returning();

    await audit(req, "document_signed", created!.id, {
      documentType,
      documentId,
      fieldName,
      signatureType,
    });
    res.status(201).json(formatSignature(created!));
  } catch (err) {
    next(err);
  }
});

export default router;
