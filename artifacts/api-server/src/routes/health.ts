import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Deep health check: pings Supabase so monitoring can detect a paused /
// unreachable project before users hit sync failures. Returns 200 when the
// database answers, 503 with details when it does not.
router.get("/health", async (_req, res) => {
  const startedAt = Date.now();
  try {
    const ping = supabase
      .from("reports")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase ping timed out")), 5000),
    );
    const { error } = await Promise.race([ping, timeout]);
    if (error) throw new Error(error.message);

    res.json({
      status: "ok",
      database: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("Health check: Supabase unreachable:", err);
    res.status(503).json({
      status: "degraded",
      database: "unreachable",
      code: "SYNC_UNAVAILABLE",
      error:
        "Cloud database is unreachable (it may be paused). Sync is unavailable until it resumes.",
    });
  }
});

export default router;
