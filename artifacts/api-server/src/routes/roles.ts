import { Router } from "express";
import { db } from "@workspace/db";
import { rolesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/roles
router.get("/", requireAuth, async (_req, res) => {
  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name, description: rolesTable.description })
    .from(rolesTable)
    .orderBy(rolesTable.name);
  res.json(roles);
});

export default router;
