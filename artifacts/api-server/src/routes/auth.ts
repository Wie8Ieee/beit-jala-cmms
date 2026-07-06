import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  permissionsTable,
  userPermissionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { comparePassword } from "../lib/auth.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      email: usersTable.email,
      passwordHash: usersTable.passwordHash,
      roleId: usersTable.roleId,
      roleName: rolesTable.name,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is deactivated" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Load permissions
  const perms = await db
    .select({ name: permissionsTable.name })
    .from(userPermissionsTable)
    .innerJoin(
      permissionsTable,
      eq(userPermissionsTable.permissionId, permissionsTable.id),
    )
    .where(eq(userPermissionsTable.userId, user.id));

  const permissionNames = perms.map((p) => p.name);

  req.session.userId = user.id;
  req.session.roleId = user.roleId;
  req.session.roleName = user.roleName;
  req.session.permissions = permissionNames;

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: permissionNames,
    isActive: user.isActive,
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session");
    }
    res.json({ message: "Logged out successfully" });
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      email: usersTable.email,
      roleId: usersTable.roleId,
      roleName: rolesTable.name,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(userPermissionsTable)
    .innerJoin(
      permissionsTable,
      eq(userPermissionsTable.permissionId, permissionsTable.id),
    )
    .where(eq(userPermissionsTable.userId, user.id));

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: perms.map((p) => p.name),
    isActive: user.isActive,
  });
});

export default router;
