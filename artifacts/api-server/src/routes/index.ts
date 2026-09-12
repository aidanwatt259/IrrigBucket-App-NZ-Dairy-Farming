import { Router, type IRouter } from "express";
import { isDbReady } from "../lib/migrate";
import healthRouter from "./health";
import authRouter from "./auth";
import reportsRouter from "./reports";
import helpRequestsRouter from "./helpRequests";
import feedbackRouter from "./feedback";
import adminRouter from "./admin";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);

// Until background table setup finishes (e.g. the database is still waking
// up), fail DB-backed requests fast with a clear 503 instead of hanging.
router.use((_req, res, next) => {
  if (!isDbReady()) {
    res.status(503).json({
      status: "degraded",
      code: "DB_NOT_READY",
      error:
        "The database is still starting up. Please retry in a few seconds.",
    });
    return;
  }
  next();
});

router.use(authRouter);
router.use(reportsRouter);
router.use(helpRequestsRouter);
router.use(feedbackRouter);
router.use(adminRouter);
router.use(billingRouter);

export default router;
