import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import rolesRouter from "./roles.js";
import permissionsRouter from "./permissions.js";
import departmentsRouter from "./departments.js";
import machinesRouter from "./machines.js";
import dashboardRouter from "./dashboard.js";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/roles", rolesRouter);
router.use("/permissions", permissionsRouter);
router.use("/departments", departmentsRouter);
router.use("/machines", machinesRouter);
router.use("/dashboard", dashboardRouter);

export default router;
