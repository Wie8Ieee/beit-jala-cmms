import { Router } from "express";
import { db } from "@workspace/db";
import { departmentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/departments
router.get("/", requireAuth, async (_req, res) => {
  const departments = await db
    .select({ id: departmentsTable.id, name: departmentsTable.name })
    .from(departmentsTable)
    .orderBy(departmentsTable.name);
  res.json(departments);
});

export default router;
