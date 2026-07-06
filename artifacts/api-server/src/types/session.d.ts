import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    roleId: number;
    roleName: string;
    permissions: string[];
  }
}
