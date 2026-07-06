import { Router } from "express";
import { db } from "@workspace/db";
import {
  machinesTable,
  departmentsTable,
  equipmentInformationTable,
} from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, requirePermission, parseIdParam } from "../lib/auth.js";

const router = Router();

function formatMachine(m: {
  id: number;
  machineNumber: string;
  machineName: string;
  departmentId: number | null;
  departmentName: string | null;
  location: string | null;
  status: string;
  pmFrequencyMonths: number | null;
  pmStartDate: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...m,
    departmentName: m.departmentName ?? null,
    departmentId: m.departmentId ?? null,
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

async function getMachineWithDept(id: number) {
  const [machine] = await db
    .select({
      id: machinesTable.id,
      machineNumber: machinesTable.machineNumber,
      machineName: machinesTable.machineName,
      departmentId: machinesTable.departmentId,
      departmentName: departmentsTable.name,
      location: machinesTable.location,
      status: machinesTable.status,
      pmFrequencyMonths: machinesTable.pmFrequencyMonths,
      pmStartDate: machinesTable.pmStartDate,
      deletedAt: machinesTable.deletedAt,
      createdAt: machinesTable.createdAt,
      updatedAt: machinesTable.updatedAt,
    })
    .from(machinesTable)
    .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
    .where(eq(machinesTable.id, id));
  return machine ?? null;
}

// GET /api/machines
router.get("/", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;

    const results = await db
      .select({
        id: machinesTable.id,
        machineNumber: machinesTable.machineNumber,
        machineName: machinesTable.machineName,
        departmentId: machinesTable.departmentId,
        departmentName: departmentsTable.name,
        location: machinesTable.location,
        status: machinesTable.status,
        pmFrequencyMonths: machinesTable.pmFrequencyMonths,
        pmStartDate: machinesTable.pmStartDate,
        deletedAt: machinesTable.deletedAt,
        createdAt: machinesTable.createdAt,
        updatedAt: machinesTable.updatedAt,
      })
      .from(machinesTable)
      .leftJoin(departmentsTable, eq(machinesTable.departmentId, departmentsTable.id))
      .where(isNull(machinesTable.deletedAt))
      .orderBy(machinesTable.machineName);

    if (search) {
      const s = search.toLowerCase();
      const filtered = results.filter(
        (m) =>
          m.machineName.toLowerCase().includes(s) ||
          m.machineNumber.toLowerCase().includes(s),
      );
      res.json(filtered.map(formatMachine));
      return;
    }

    res.json(results.map(formatMachine));
  } catch (err) { next(err); }
});

// POST /api/machines
router.post("/", requireAuth, requirePermission("create_machine"), async (req, res, next) => {
  try {
    const {
      machineNumber, machineName, departmentId, location,
      status, pmFrequencyMonths, pmStartDate,
    } = req.body as {
      machineNumber?: string;
      machineName?: string;
      departmentId?: number | null;
      location?: string;
      status?: string;
      pmFrequencyMonths?: number | null;
      pmStartDate?: string | null;
    };

    if (!machineNumber || !machineName) {
      res.status(400).json({ error: "machineNumber and machineName are required" });
      return;
    }

    try {
      const [newMachine] = await db
        .insert(machinesTable)
        .values({
          machineNumber,
          machineName,
          departmentId: departmentId ?? null,
          location: location ?? null,
          status: status ?? "active",
          pmFrequencyMonths: pmFrequencyMonths ?? null,
          pmStartDate: pmStartDate ?? null,
        })
        .returning({ id: machinesTable.id });

      const machine = await getMachineWithDept(newMachine!.id);
      res.status(201).json(formatMachine(machine!));
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "23505") {
        res.status(400).json({ error: "Machine number already exists" });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// GET /api/machines/:id
router.get("/:id", requireAuth, requirePermission("view_machines"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const machine = await getMachineWithDept(id);
    if (!machine) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    res.json(formatMachine(machine));
  } catch (err) { next(err); }
});

// PUT /api/machines/:id
router.put("/:id", requireAuth, requirePermission("edit_machine"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const {
      machineNumber, machineName, departmentId, location,
      status, pmFrequencyMonths, pmStartDate,
    } = req.body as {
      machineNumber?: string;
      machineName?: string;
      departmentId?: number | null;
      location?: string;
      status?: string;
      pmFrequencyMonths?: number | null;
      pmStartDate?: string | null;
    };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (machineNumber !== undefined) updateData.machineNumber = machineNumber;
    if (machineName !== undefined) updateData.machineName = machineName;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (location !== undefined) updateData.location = location;
    if (status !== undefined) updateData.status = status;
    if (pmFrequencyMonths !== undefined) updateData.pmFrequencyMonths = pmFrequencyMonths;
    if (pmStartDate !== undefined) updateData.pmStartDate = pmStartDate;

    const [updated] = await db
      .update(machinesTable)
      .set(updateData)
      .where(eq(machinesTable.id, id))
      .returning({ id: machinesTable.id });

    if (!updated) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const machine = await getMachineWithDept(id);
    res.json(formatMachine(machine!));
  } catch (err) { next(err); }
});

// PATCH /api/machines/:id/soft-delete
router.patch("/:id/soft-delete", requireAuth, requirePermission("soft_delete_machine"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [updated] = await db
      .update(machinesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(machinesTable.id, id))
      .returning({ id: machinesTable.id });

    if (!updated) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const machine = await getMachineWithDept(id);
    res.json(formatMachine(machine!));
  } catch (err) { next(err); }
});

// GET /api/machines/:id/equipment-information
router.get("/:id/equipment-information", requireAuth, requirePermission("view_equipment_information"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [record] = await db
      .select()
      .from(equipmentInformationTable)
      .where(eq(equipmentInformationTable.machineId, id));

    if (!record) {
      res.status(404).json({ error: "Equipment information not found" });
      return;
    }

    res.json({
      ...record,
      dimensionWidthCm: record.dimensionWidthCm ? parseFloat(record.dimensionWidthCm) : null,
      dimensionHeightCm: record.dimensionHeightCm ? parseFloat(record.dimensionHeightCm) : null,
      dimensionDepthCm: record.dimensionDepthCm ? parseFloat(record.dimensionDepthCm) : null,
      weightKg: record.weightKg ? parseFloat(record.weightKg) : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  } catch (err) { next(err); }
});

// PUT /api/machines/:id/equipment-information
router.put("/:id/equipment-information", requireAuth, requirePermission("edit_equipment_information"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const body = req.body as Record<string, unknown>;

    const [machine] = await db
      .select({ id: machinesTable.id })
      .from(machinesTable)
      .where(eq(machinesTable.id, id));

    if (!machine) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const existing = await db
      .select({ id: equipmentInformationTable.id })
      .from(equipmentInformationTable)
      .where(eq(equipmentInformationTable.machineId, id));

    let record;
    if (existing.length > 0) {
      [record] = await db
        .update(equipmentInformationTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(equipmentInformationTable.machineId, id))
        .returning();
    } else {
      [record] = await db
        .insert(equipmentInformationTable)
        .values({ machineId: id, ...body })
        .returning();
    }

    res.json({
      ...record,
      dimensionWidthCm: record!.dimensionWidthCm ? parseFloat(record!.dimensionWidthCm) : null,
      dimensionHeightCm: record!.dimensionHeightCm ? parseFloat(record!.dimensionHeightCm) : null,
      dimensionDepthCm: record!.dimensionDepthCm ? parseFloat(record!.dimensionDepthCm) : null,
      weightKg: record!.weightKg ? parseFloat(record!.weightKg) : null,
      createdAt: record!.createdAt.toISOString(),
      updatedAt: record!.updatedAt.toISOString(),
    });
  } catch (err) { next(err); }
});

export default router;
