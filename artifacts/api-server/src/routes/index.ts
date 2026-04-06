import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reportsRouter from "./reports";
import helpRequestsRouter from "./helpRequests";
import feedbackRouter from "./feedback";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(reportsRouter);
router.use(helpRequestsRouter);
router.use(feedbackRouter);
router.use(adminRouter);

export default router;
