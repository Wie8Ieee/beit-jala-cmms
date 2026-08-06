import { Router } from "express";
import { db } from "@workspace/db";
import { rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

// GET /api/roles
router.get("/", requireAuth, async (_req, res) => {
  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name, description: rolesTable.description })
    .from(rolesTable)
    .orderBy(rolesTable.name);
  res.json(roles);
});

// Roles are job titles (for example, Production Engineer). Department access
// is selected separately on the user, so the same role can be used per site.
router.post("/", requireAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const name = String((req.body as { name?: unknown }).name ?? "").trim();
    const description = String((req.body as { description?: unknown }).description ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Role name is required" });
      return;
    }
    const [role] = await db.insert(rolesTable).values({ name, description: description || null })
      .returning({ id: rolesTable.id, name: rolesTable.name, description: rolesTable.description });
    res.status(201).json(role!);
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "23505" || databaseError.cause?.code === "23505") {
      res.status(409).json({ error: "A role with this name already exists" });
      return;
    }
    next(error);
  }
});

router.delete("/:id", requireAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = Number.parseInt(Array.isArray(req.params.id) ? req.params.id[0] ?? "" : req.params.id, 10);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const deleted = await db.delete(rolesTable).where(eq(rolesTable.id, id)).returning({ id: rolesTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    res.json({ id });
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "23503" || databaseError.cause?.code === "23503") {
      res.status(409).json({ error: "This role is assigned to a user and cannot be deleted" });
      return;
    }
    next(error);
  }
});

export default router;
