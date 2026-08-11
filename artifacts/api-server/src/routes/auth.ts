import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  permissionsTable,
  userPermissionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { comparePassword, requireActiveAuth } from "../lib/auth.js";

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
      employeeNumber: usersTable.employeeNumber,
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
    res.status(401).json({ error: "Invalid username" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is deactivated" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid password" });
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

  const permissionNames = user.roleName === "Admin"
    ? (await db.select({ name: permissionsTable.name }).from(permissionsTable)).map((permission) => permission.name)
    : perms.map((p) => p.name);

  // Always issue a fresh session ID after authentication. This prevents an
  // outstanding /me request for an expired session from destroying the newly
  // authenticated session in a different browser request.
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => err ? reject(err) : resolve());
  });
  req.session.userId = user.id;
  req.session.roleId = user.roleId;
  req.session.roleName = user.roleName;
  req.session.permissions = permissionNames;

  const responseUser = {
    id: user.id,
    username: user.username,
    employeeNumber: user.employeeNumber ?? null,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: permissionNames,
    isActive: user.isActive,
  };

  // Persist the PostgreSQL-backed session before the client follows the login
  // response with authenticated requests.
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve());
  });
  res.json(responseUser);
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
router.get("/me", requireActiveAuth, async (req, res) => {
  const userId = req.session.userId!;

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      employeeNumber: usersTable.employeeNumber,
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

  const permissionNames = user.roleName === "Admin"
    ? (await db.select({ name: permissionsTable.name }).from(permissionsTable)).map((permission) => permission.name)
    : perms.map((p) => p.name);

  // Keep the server-side authorization snapshot in sync when an administrator
  // changes this account's role or permissions. A page refresh is sufficient;
  // users no longer need to log out and back in for new permissions to work.
  req.session.roleId = user.roleId;
  req.session.roleName = user.roleName;
  req.session.permissions = permissionNames;

  res.json({
    id: user.id,
    username: user.username,
    employeeNumber: user.employeeNumber ?? null,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: permissionNames,
    isActive: user.isActive,
  });
});

export default router;
