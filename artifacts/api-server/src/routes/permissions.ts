import { Router } from "express";
import { db } from "@workspace/db";
import { permissionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/permissions
router.get("/", requireAuth, async (_req, res) => {
  const permissions = await db
    .select({ id: permissionsTable.id, name: permissionsTable.name, description: permissionsTable.description })
    .from(permissionsTable)
    .orderBy(permissionsTable.name);
  res.json(permissions);
});

export default router;
