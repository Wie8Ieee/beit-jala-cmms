import { Router } from "express";
import { db } from "@workspace/db";
import { departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

// GET /api/departments
router.get("/", requireAuth, async (_req, res) => {
  const departments = await db
    .select({ id: departmentsTable.id, name: departmentsTable.name })
    .from(departmentsTable)
    .orderBy(departmentsTable.name);
  res.json(departments);
});

// Departments are managed by administrators and are then available when
// creating users and machines.
router.post("/", requireAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const name = String((req.body as { name?: unknown }).name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Department name is required" });
      return;
    }

    const [department] = await db
      .insert(departmentsTable)
      .values({ name })
      .returning({ id: departmentsTable.id, name: departmentsTable.name });
    res.status(201).json(department!);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(400).json({ error: "A department with this name already exists" });
      return;
    }
    next(error);
  }
});

router.delete("/:id", requireAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] ?? "" : req.params.id, 10);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid department" });
      return;
    }
    const deleted = await db.delete(departmentsTable).where(eq(departmentsTable.id, id)).returning({ id: departmentsTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    res.json({ id });
  } catch (error) {
    if ((error as { code?: string }).code === "23503") {
      res.status(409).json({ error: "This department is assigned to a user or machine and cannot be deleted" });
      return;
    }
    next(error);
  }
});

export default router;
