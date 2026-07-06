import { db, pool } from "@workspace/db";
import {
  rolesTable,
  permissionsTable,
  departmentsTable,
  usersTable,
  userPermissionsTable,
  machinesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleData = [
    { name: "Admin", description: "Full system access" },
    { name: "Maintenance Supervisor", description: "Manages PM plans and maintenance team" },
    { name: "Maintenance Technician", description: "Executes and records maintenance work" },
    { name: "Department Employee", description: "Submits maintenance requests" },
    { name: "QA Supervisor", description: "Approves maintenance requests" },
  ];

  const roles: Record<string, number> = {};
  for (const r of roleData) {
    const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.name, r.name));
    if (existing) {
      roles[existing.name] = existing.id;
    } else {
      const [inserted] = await db.insert(rolesTable).values(r).returning();
      roles[inserted!.name] = inserted!.id;
    }
  }
  console.log("✅ Roles seeded");

  // ── Permissions ────────────────────────────────────────────────────────────
  const permData = [
    { name: "view_dashboard", description: "View dashboard" },
    { name: "manage_users", description: "Create, edit, deactivate users" },
    { name: "view_machines", description: "View machines list and details" },
    { name: "create_machine", description: "Add new machines" },
    { name: "edit_machine", description: "Edit machine details" },
    { name: "soft_delete_machine", description: "Soft delete machines" },
    { name: "view_equipment_information", description: "View equipment information records" },
    { name: "edit_equipment_information", description: "Edit equipment information records" },
    { name: "submit_maintenance_request_placeholder", description: "[Phase 2] Submit maintenance request" },
    { name: "view_own_requests_placeholder", description: "[Phase 2] View own requests" },
    { name: "manage_pm_checklist_placeholder", description: "[Phase 2] Manage PM checklists" },
    { name: "fill_pm_record_placeholder", description: "[Phase 2] Fill PM records" },
    { name: "approve_qa_request_placeholder", description: "[Phase 2] QA approve requests" },
    { name: "manage_spare_parts_placeholder", description: "[Phase 2] Manage spare parts" },
    { name: "view_maintenance_plans_placeholder", description: "[Phase 2] View maintenance plans" },
    { name: "edit_header_placeholder", description: "[Phase 2] Edit form headers" },
    { name: "print_forms_placeholder", description: "[Phase 2] Print forms" },
    { name: "manage_signatures_placeholder", description: "[Phase 2] Manage electronic signatures" },
    { name: "manage_pm_checklist", description: "Manage PM checklist points" },
    { name: "fill_pm_record", description: "Fill preventive maintenance records" },
    { name: "view_maintenance_plans", description: "View annual and monthly maintenance plans" },
    { name: "edit_maintenance_plans", description: "Edit annual and monthly maintenance plans" },
    { name: "edit_header", description: "Edit official form headers" },
    { name: "submit_maintenance_request", description: "Submit corrective maintenance requests" },
    { name: "view_own_requests", description: "View own maintenance requests" },
    { name: "review_qa_requests", description: "QA review maintenance requests" },
    { name: "review_engineering_requests", description: "Engineering review QA-approved maintenance requests" },
    { name: "fill_corrective_maintenance", description: "Fill corrective maintenance preliminary findings and actions" },
    { name: "manage_maintenance_requests", description: "View and manage all maintenance requests" },
    { name: "view_spare_parts", description: "View spare parts catalogue and stock history" },
    { name: "manage_spare_parts", description: "Create, edit, adjust, and soft-delete spare parts" },
    { name: "record_spare_part_usage", description: "Record spare part stock-out usage during maintenance" },
  ];

  const permIds: Record<string, number> = {};
  for (const p of permData) {
    const [existing] = await db.select().from(permissionsTable).where(eq(permissionsTable.name, p.name));
    if (existing) {
      permIds[existing.name] = existing.id;
    } else {
      const [inserted] = await db.insert(permissionsTable).values(p).returning();
      permIds[inserted!.name] = inserted!.id;
    }
  }
  console.log("✅ Permissions seeded");

  // ── Departments ────────────────────────────────────────────────────────────
  const deptData = [
    "Engineering & Maintenance",
    "Production",
    "QA",
    "QC",
    "R&D",
  ];

  const deptIds: Record<string, number> = {};
  for (const name of deptData) {
    const [existing] = await db.select().from(departmentsTable).where(eq(departmentsTable.name, name));
    if (existing) {
      deptIds[existing.name] = existing.id;
    } else {
      const [inserted] = await db.insert(departmentsTable).values({ name }).returning();
      deptIds[inserted!.name] = inserted!.id;
    }
  }
  console.log("✅ Departments seeded");

  // ── Users ──────────────────────────────────────────────────────────────────
  const allPerms = Object.keys(permIds);
  const supervisorPerms = [
    "view_dashboard", "view_machines", "create_machine", "edit_machine", "soft_delete_machine",
    "view_equipment_information", "edit_equipment_information",
    "manage_pm_checklist_placeholder", "fill_pm_record_placeholder",
    "view_maintenance_plans_placeholder", "edit_header_placeholder", "print_forms_placeholder",
    "manage_pm_checklist", "fill_pm_record", "view_maintenance_plans", "edit_maintenance_plans", "edit_header",
    "submit_maintenance_request", "view_own_requests", "review_qa_requests", "review_engineering_requests",
    "fill_corrective_maintenance", "manage_maintenance_requests",
    "view_spare_parts", "manage_spare_parts", "record_spare_part_usage",
  ];
  const techPerms = [
    "view_dashboard", "view_machines", "view_equipment_information",
    "fill_pm_record_placeholder", "view_maintenance_plans_placeholder", "print_forms_placeholder",
    "fill_pm_record", "view_maintenance_plans", "fill_corrective_maintenance",
  ];
  const empPerms = [
    "submit_maintenance_request_placeholder", "view_own_requests_placeholder",
    "submit_maintenance_request", "view_own_requests",
  ];
  const qaPerms = [
    "view_dashboard", "approve_qa_request_placeholder",
    "review_qa_requests", "manage_maintenance_requests",
  ];

  const userData = [
    { username: "admin",      password: "admin123",      fullName: "System Administrator", roleKey: "Admin",                    deptKey: "Engineering & Maintenance", perms: allPerms },
    { username: "supervisor", password: "supervisor123", fullName: "Ahmed Hassan",          roleKey: "Maintenance Supervisor",   deptKey: "Engineering & Maintenance", perms: supervisorPerms },
    { username: "technician", password: "technician123", fullName: "Omar Khalil",           roleKey: "Maintenance Technician",   deptKey: "Engineering & Maintenance", perms: techPerms },
    { username: "employee",   password: "employee123",   fullName: "Sara Nasser",           roleKey: "Department Employee",      deptKey: "Production",                perms: empPerms },
    { username: "qa",         password: "qa123",         fullName: "Lina Barakat",          roleKey: "QA Supervisor",            deptKey: "QA",                        perms: qaPerms },
  ];

  for (const u of userData) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, u.username));
    let userId: number;
    if (existing) {
      userId = existing.id;
      console.log(`  → ${u.username} already exists, updating permissions`);
    } else {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const [inserted] = await db.insert(usersTable).values({
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        roleId: roles[u.roleKey]!,
        departmentId: deptIds[u.deptKey] ?? null,
        isActive: true,
      }).returning({ id: usersTable.id });
      userId = inserted!.id;
    }

    // Refresh permissions
    await db.delete(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
    const permEntries = u.perms
      .map((name) => permIds[name])
      .filter((id): id is number => id !== undefined)
      .map((permissionId) => ({ userId, permissionId }));
    if (permEntries.length > 0) {
      await db.insert(userPermissionsTable).values(permEntries);
    }
  }
  console.log("✅ Users seeded");

  // ── Machines ───────────────────────────────────────────────────────────────
  const machineData = [
    { machineNumber: "MCH-001", machineName: "Tablet Compression Machine", deptKey: "Production",                status: "active" },
    { machineNumber: "MCH-002", machineName: "Coating Machine",            deptKey: "Production",                status: "active" },
    { machineNumber: "MCH-003", machineName: "Water Purification Unit",    deptKey: "Engineering & Maintenance", status: "active" },
    { machineNumber: "MCH-004", machineName: "Packaging Line",             deptKey: "Production",                status: "active" },
  ];

  for (const m of machineData) {
    const [existing] = await db.select({ id: machinesTable.id }).from(machinesTable).where(eq(machinesTable.machineNumber, m.machineNumber));
    if (!existing) {
      await db.insert(machinesTable).values({
        machineNumber: m.machineNumber,
        machineName: m.machineName,
        departmentId: deptIds[m.deptKey] ?? null,
        status: m.status,
        pmFrequencyMonths: 6,
      });
    }
  }
  console.log("✅ Machines seeded");

  console.log("\n🎉 Seed complete!\n");
  console.log("Test accounts:");
  console.log("  admin       / admin123      — Admin");
  console.log("  supervisor  / supervisor123 — Maintenance Supervisor");
  console.log("  technician  / technician123 — Maintenance Technician");
  console.log("  employee    / employee123   — Department Employee");
  console.log("  qa          / qa123         — QA Supervisor");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
