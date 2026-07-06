import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import rolesRouter from "./roles.js";
import permissionsRouter from "./permissions.js";
import departmentsRouter from "./departments.js";
import machinesRouter from "./machines.js";
import preventiveMaintenanceRouter from "./preventive-maintenance.js";
import maintenancePlansRouter from "./maintenance-plans.js";
import maintenanceRequestsRouter from "./maintenance-requests.js";
import correctiveMaintenanceRouter from "./corrective-maintenance.js";
import dashboardRouter from "./dashboard.js";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/roles", rolesRouter);
router.use("/permissions", permissionsRouter);
router.use("/departments", departmentsRouter);
router.use("/machines/:id/pm", preventiveMaintenanceRouter);
router.use("/machines/:id/corrective-maintenance", correctiveMaintenanceRouter);
router.use("/machines", machinesRouter);
router.use("/maintenance-plans", maintenancePlansRouter);
router.use("/maintenance-requests", maintenanceRequestsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
