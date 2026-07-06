import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  auditLogsTable,
  sparePartMovementsTable,
  sparePartsTable,
} from "@workspace/db";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { parseIdParam, requireAuth, requirePermission } from "../lib/auth.js";

const router = Router();

const MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;
const REFERENCE_TYPES = ["PM_RECORD", "CM_REQUEST", "MANUAL", "OTHER"] as const;

function hasPermission(req: Request, permission: string) {
  return (req.session.permissions ?? []).includes(permission);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatPart(part: typeof sparePartsTable.$inferSelect) {
  return {
    ...part,
    isLowStock: part.currentQuantity <= part.minimumQuantity,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
    deletedAt: part.deletedAt ? part.deletedAt.toISOString() : null,
  };
}

function formatMovement(movement: typeof sparePartMovementsTable.$inferSelect) {
  return {
    ...movement,
    createdAt: movement.createdAt.toISOString(),
  };
}

async function getPart(id: number) {
  const [part] = await db.select().from(sparePartsTable).where(eq(sparePartsTable.id, id));
  return part ?? null;
}

function normalizeMovementType(value: unknown) {
  const type = String(value ?? "").toUpperCase();
  return MOVEMENT_TYPES.includes(type as (typeof MOVEMENT_TYPES)[number]) ? type : null;
}

function normalizeReferenceType(value: unknown) {
  const type = String(value ?? "MANUAL").toUpperCase();
  return REFERENCE_TYPES.includes(type as (typeof REFERENCE_TYPES)[number]) ? type : "MANUAL";
}

function canRecordMovement(req: Request, movementType: string) {
  if (hasPermission(req, "manage_spare_parts")) return true;
  return movementType === "OUT" && hasPermission(req, "record_spare_part_usage");
}

router.get("/", requireAuth, requirePermission("view_spare_parts"), async (req, res, next) => {
  try {
    const includeDeleted = String(req.query.includeDeleted ?? "false") === "true" && hasPermission(req, "manage_spare_parts");
    const category = String(req.query.category ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const q = String(req.query.q ?? "").trim();

    const filters: SQL[] = [];
    if (!includeDeleted) filters.push(isNull(sparePartsTable.deletedAt));
    if (category) filters.push(eq(sparePartsTable.category, category));
    if (status) filters.push(eq(sparePartsTable.status, status));
    if (q) {
      const search = or(ilike(sparePartsTable.partName, `%${q}%`), ilike(sparePartsTable.partCode, `%${q}%`));
      if (search) filters.push(search);
    }

    const rows = await db
      .select()
      .from(sparePartsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(sparePartsTable.partName));
    res.json(rows.map(formatPart));
  } catch (err) {
    next(err);
  }
});

router.get("/search", requireAuth, requirePermission("view_spare_parts"), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const rows = await db
      .select()
      .from(sparePartsTable)
      .where(
        and(
          isNull(sparePartsTable.deletedAt),
          q ? or(ilike(sparePartsTable.partName, `%${q}%`), ilike(sparePartsTable.partCode, `%${q}%`)) : sql`true`,
        ),
      )
      .orderBy(asc(sparePartsTable.partName));
    res.json(rows.map(formatPart));
  } catch (err) {
    next(err);
  }
});

router.get("/low-stock", requireAuth, requirePermission("view_spare_parts"), async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(sparePartsTable)
      .where(and(isNull(sparePartsTable.deletedAt), sql`${sparePartsTable.currentQuantity} <= ${sparePartsTable.minimumQuantity}`))
      .orderBy(asc(sparePartsTable.currentQuantity), asc(sparePartsTable.partName));
    res.json(rows.map(formatPart));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requirePermission("manage_spare_parts"), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const partName = String(body.partName ?? "").trim();
    const partCode = String(body.partCode ?? "").trim();
    if (!partName || !partCode) {
      res.status(400).json({ error: "partName and partCode are required" });
      return;
    }

    const [created] = await db
      .insert(sparePartsTable)
      .values({
        partName,
        partCode,
        description: body.description ? String(body.description) : null,
        category: body.category ? String(body.category) : null,
        unit: body.unit ? String(body.unit) : "piece",
        minimumQuantity: Number(body.minimumQuantity ?? 0),
        location: body.location ? String(body.location) : null,
        status: body.status ? String(body.status) : "active",
      })
      .returning();

    await db.insert(auditLogsTable).values({
      userId: req.session.userId ?? null,
      action: "spare_part_created",
      entityType: "spare_part",
      entityId: created!.id,
      details: { partCode },
    });
    res.status(201).json(formatPart(created!));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requirePermission("view_spare_parts"), async (req, res, next) => {
  try {
    const part = await getPart(parseIdParam(req.params.id));
    if (!part) {
      res.status(404).json({ error: "Spare part not found" });
      return;
    }
    res.json(formatPart(part));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requirePermission("manage_spare_parts"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const part = await getPart(id);
    if (!part) {
      res.status(404).json({ error: "Spare part not found" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const [updated] = await db
      .update(sparePartsTable)
      .set({
        partName: body.partName ? String(body.partName) : part.partName,
        partCode: body.partCode ? String(body.partCode) : part.partCode,
        description: body.description === undefined ? part.description : String(body.description ?? ""),
        category: body.category === undefined ? part.category : String(body.category ?? ""),
        unit: body.unit ? String(body.unit) : part.unit,
        minimumQuantity: body.minimumQuantity === undefined ? part.minimumQuantity : Number(body.minimumQuantity),
        location: body.location === undefined ? part.location : String(body.location ?? ""),
        status: body.status ? String(body.status) : part.status,
        updatedAt: new Date(),
      })
      .where(eq(sparePartsTable.id, id))
      .returning();
    res.json(formatPart(updated!));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/soft-delete", requireAuth, requirePermission("manage_spare_parts"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const [updated] = await db
      .update(sparePartsTable)
      .set({ status: "inactive", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sparePartsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Spare part not found" });
      return;
    }
    await db.insert(auditLogsTable).values({
      userId: req.session.userId ?? null,
      action: "spare_part_soft_deleted",
      entityType: "spare_part",
      entityId: id,
      details: { partCode: updated.partCode },
    });
    res.json(formatPart(updated));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/movements", requireAuth, requirePermission("view_spare_parts"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const part = await getPart(id);
    if (!part) {
      res.status(404).json({ error: "Spare part not found" });
      return;
    }
    const rows = await db
      .select()
      .from(sparePartMovementsTable)
      .where(eq(sparePartMovementsTable.sparePartId, id))
      .orderBy(desc(sparePartMovementsTable.createdAt), desc(sparePartMovementsTable.id));
    res.json(rows.map(formatMovement));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/movements", requireAuth, async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    const part = await getPart(id);
    if (!part || part.deletedAt) {
      res.status(404).json({ error: "Active spare part not found" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const movementType = normalizeMovementType(body.movementType);
    if (!movementType || !canRecordMovement(req, movementType)) {
      res.status(403).json({ error: "Not allowed to record this movement" });
      return;
    }

    const quantity = Number(body.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 0 || (movementType !== "ADJUSTMENT" && quantity <= 0)) {
      res.status(400).json({ error: "quantity must be a valid non-negative integer; IN and OUT require a positive quantity" });
      return;
    }

    const quantityBefore = part.currentQuantity;
    let quantityAfter = quantityBefore;
    if (movementType === "IN") quantityAfter += quantity;
    if (movementType === "OUT") quantityAfter -= quantity;
    if (movementType === "ADJUSTMENT") quantityAfter = quantity;

    if (movementType === "OUT" && quantityAfter < 0) {
      res.status(400).json({ error: "Stock-out cannot make current quantity negative" });
      return;
    }
    if (movementType === "ADJUSTMENT" && !hasPermission(req, "manage_spare_parts")) {
      res.status(403).json({ error: "Only Admin or Maintenance Supervisor can record adjustments" });
      return;
    }

    const [movement] = await db.transaction(async (tx) => {
      const [createdMovement] = await tx
        .insert(sparePartMovementsTable)
        .values({
          sparePartId: id,
          movementType,
          quantity,
          quantityBefore,
          quantityAfter,
          movementDate: body.movementDate ? String(body.movementDate) : todayString(),
          reason: body.reason ? String(body.reason) : null,
          referenceType: normalizeReferenceType(body.referenceType),
          referenceId: body.referenceId ? Number(body.referenceId) : null,
          recordedByUserId: req.session.userId ?? null,
          notes: body.notes ? String(body.notes) : null,
        })
        .returning();
      await tx
        .update(sparePartsTable)
        .set({ currentQuantity: quantityAfter, updatedAt: new Date() })
        .where(eq(sparePartsTable.id, id));
      await tx.insert(auditLogsTable).values({
        userId: req.session.userId ?? null,
        action: movementType === "ADJUSTMENT" ? "spare_part_adjusted" : "spare_part_movement_recorded",
        entityType: "spare_part",
        entityId: id,
        details: { movementType, quantity, quantityBefore, quantityAfter },
      });
      return [createdMovement!];
    });

    res.status(201).json(formatMovement(movement));
  } catch (err) {
    next(err);
  }
});

export default router;
