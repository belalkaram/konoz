import { Router, type IRouter } from "express";
import healthRouter from "./health";
import offersRouter from "./offers";
import ordersRouter from "./orders";
import statsRouter from "./stats";
import airportsRouter from "./airports";
import customersRouter from "./customers";
import notesRouter from "./notes";
import ticketsRouter from "./tickets";
import remindersRouter from "./reminders";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import employeesRouter from "./employees";
import adminSessionsRouter from "./admin-sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(adminSessionsRouter);
router.use(offersRouter);
router.use(ordersRouter);
router.use(statsRouter);
router.use(airportsRouter);
router.use(customersRouter);
router.use(notesRouter);
router.use(ticketsRouter);
router.use(remindersRouter);
router.use(dashboardRouter);

export default router;
