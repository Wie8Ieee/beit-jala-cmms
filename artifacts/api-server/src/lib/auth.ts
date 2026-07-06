import bcrypt from "bcrypt";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

/**
 * Middleware that checks both session auth AND that the user account is still
 * active in the database. This prevents deactivated users from retaining
 * access via an existing session.
 */
export function requireActiveAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const userId = req.session.userId;
  db.select({ isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then(([user]) => {
      if (!user || !user.isActive) {
        req.session.destroy(() => {});
        res.status(401).json({ error: "Account is inactive" });
        return;
      }
      next();
    })
    .catch(next);
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const permissions: string[] = req.session.permissions ?? [];
    if (!permissions.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/** Safely parse a route param (may be string | string[] in some TS versions). */
export function parseIdParam(val: string | string[] | undefined): number {
  const str = Array.isArray(val) ? (val[0] ?? "") : (val ?? "");
  return parseInt(str, 10);
}
