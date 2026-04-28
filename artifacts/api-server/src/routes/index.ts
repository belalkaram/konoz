import { Router, type IRouter } from "express";
import healthRouter from "./health";
import offersRouter from "./offers";
import ordersRouter from "./orders";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(offersRouter);
router.use(ordersRouter);
router.use(statsRouter);

export default router;
