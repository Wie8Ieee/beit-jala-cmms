import { defineConfig } from "drizzle-kit";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/audit.ts",
    "./src/schema/corrective-maintenance.ts",
    "./src/schema/equipment.ts",
    "./src/schema/form-headers.ts",
    "./src/schema/machines.ts",
    "./src/schema/notifications.ts",
    "./src/schema/preventive-maintenance.ts",
    "./src/schema/signatures.ts",
    "./src/schema/sessions.ts",
    "./src/schema/spare-parts.ts",
    "./src/schema/users.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
