import { Router } from "express";
import { auditLogsTable, db, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireActiveAuth, requirePermission } from "../lib/auth.js";

const router = Router();

router.get("/", requireActiveAuth, requirePermission("view_audit_logs"), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: auditLogsTable.id,
        userId: auditLogsTable.userId,
        userName: usersTable.fullName,
        username: usersTable.username,
        action: auditLogsTable.action,
        entityType: auditLogsTable.entityType,
        entityId: auditLogsTable.entityId,
        details: auditLogsTable.details,
        oldValue: auditLogsTable.oldValue,
        newValue: auditLogsTable.newValue,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .orderBy(desc(auditLogsTable.createdAt), desc(auditLogsTable.id))
      .limit(500);

    res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
  } catch (error) {
    next(error);
  }
});

export default router;
