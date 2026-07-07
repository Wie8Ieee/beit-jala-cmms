import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  departmentsTable,
  permissionsTable,
  userPermissionsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { hashPassword, requireActiveAuth, requirePermission, parseIdParam } from "../lib/auth.js";

const router = Router();

async function getUserWithPermissions(userId: number) {
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      email: usersTable.email,
      roleId: usersTable.roleId,
      roleName: rolesTable.name,
      departmentId: usersTable.departmentId,
      departmentName: departmentsTable.name,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .leftJoin(
      departmentsTable,
      eq(usersTable.departmentId, departmentsTable.id),
    )
    .where(eq(usersTable.id, userId));

  if (!user) return null;

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(userPermissionsTable)
    .innerJoin(
      permissionsTable,
      eq(userPermissionsTable.permissionId, permissionsTable.id),
    )
    .where(eq(userPermissionsTable.userId, userId));

  return {
    ...user,
    departmentName: user.departmentName ?? null,
    departmentId: user.departmentId ?? null,
    permissions: perms.map((p) => p.name),
    createdAt: user.createdAt.toISOString(),
  };
}

// GET /api/users
router.get("/", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        email: usersTable.email,
        roleId: usersTable.roleId,
        roleName: rolesTable.name,
        departmentId: usersTable.departmentId,
        departmentName: departmentsTable.name,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .leftJoin(
        departmentsTable,
        eq(usersTable.departmentId, departmentsTable.id),
      )
      .orderBy(usersTable.username);

    const allPerms = await db
      .select({
        userId: userPermissionsTable.userId,
        name: permissionsTable.name,
      })
      .from(userPermissionsTable)
      .innerJoin(
        permissionsTable,
        eq(userPermissionsTable.permissionId, permissionsTable.id),
      );

    const permsByUser: Record<number, string[]> = {};
    for (const p of allPerms) {
      if (!permsByUser[p.userId]) permsByUser[p.userId] = [];
      permsByUser[p.userId].push(p.name);
    }

    res.json(
      users.map((u) => ({
        ...u,
        departmentName: u.departmentName ?? null,
        departmentId: u.departmentId ?? null,
        permissions: permsByUser[u.id] ?? [],
        createdAt: u.createdAt.toISOString(),
      })),
    );
  } catch (err) { next(err); }
});

// POST /api/users
router.post("/", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const { username, password, fullName, email, roleId, departmentId } =
      req.body as {
        username?: string;
        password?: string;
        fullName?: string;
        email?: string;
        roleId?: number;
        departmentId?: number | null;
      };

    if (!username || !password || !roleId) {
      res.status(400).json({ error: "username, password, and roleId are required" });
      return;
    }

    const passwordHash = await hashPassword(password);

    try {
      const [newUser] = await db
        .insert(usersTable)
        .values({
          username,
          passwordHash,
          fullName: fullName ?? null,
          email: email ?? null,
          roleId,
          departmentId: departmentId ?? null,
          isActive: true,
        })
        .returning({ id: usersTable.id });

      const user = await getUserWithPermissions(newUser!.id);
      res.status(201).json(user);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "23505") {
        res.status(400).json({ error: "Username already exists" });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get("/:id", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const user = await getUserWithPermissions(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) { next(err); }
});

// PUT /api/users/:id
router.put("/:id", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { fullName, email, roleId, departmentId, password } = req.body as {
      fullName?: string;
      email?: string;
      roleId?: number;
      departmentId?: number | null;
      password?: string;
    };

    const updateData: Partial<{
      fullName: string | null;
      email: string | null;
      roleId: number;
      departmentId: number | null;
      passwordHash: string;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (fullName !== undefined) updateData.fullName = fullName || null;
    if (email !== undefined) updateData.email = email || null;
    if (roleId !== undefined) updateData.roleId = roleId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (password) updateData.passwordHash = await hashPassword(password);

    const [updated] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = await getUserWithPermissions(id);
    res.json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/deactivate
router.patch("/:id/deactivate", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = await getUserWithPermissions(id);
    res.json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/reactivate
router.patch("/:id/reactivate", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = await getUserWithPermissions(id);
    res.json(user);
  } catch (err) { next(err); }
});

// PUT /api/users/:id/permissions
router.put("/:id/permissions", requireActiveAuth, requirePermission("manage_users"), async (req, res, next) => {
  try {
    const id = parseIdParam(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { permissionNames } = req.body as { permissionNames?: string[] };
    if (!Array.isArray(permissionNames)) {
      res.status(400).json({ error: "permissionNames must be an array" });
      return;
    }

    await db.delete(userPermissionsTable).where(eq(userPermissionsTable.userId, id));

    if (permissionNames.length > 0) {
      const perms = await db
        .select({ id: permissionsTable.id, name: permissionsTable.name })
        .from(permissionsTable)
        .where(inArray(permissionsTable.name, permissionNames));

      if (perms.length > 0) {
        await db.insert(userPermissionsTable).values(
          perms.map((p) => ({ userId: id, permissionId: p.id })),
        );
      }
    }

    const user = await getUserWithPermissions(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
