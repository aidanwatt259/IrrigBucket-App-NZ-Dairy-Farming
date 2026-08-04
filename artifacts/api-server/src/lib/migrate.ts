import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

let dbReady = false;

/** True once the database has been confirmed reachable. */
export function isDbReady(): boolean {
  return dbReady;
}

const ATTEMPT_TIMEOUT_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Probes database connectivity in the background with retries so a paused /
 * slow-to-wake database can never block the server from opening its port
 * (which would fail a publish). Retries forever with capped exponential
 * backoff; each attempt has a hard timeout so a hung connection cannot wedge
 * the loop.
 *
 * Schema is managed outside the application: drizzle-kit push applies the
 * schema to the development database, and Replit's Publish flow diffs and
 * applies it to production. No DDL runs at boot.
 */
export function startDbReadinessCheckInBackground(): void {
  void (async () => {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        await Promise.race([
          checkDbConnectivity(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Database readiness check timed out after ${ATTEMPT_TIMEOUT_MS}ms`,
                  ),
                ),
              ATTEMPT_TIMEOUT_MS,
            ),
          ),
        ]);
        dbReady = true;
        logger.info({ attempt }, "Database ready");
        return;
      } catch (err) {
        const backoffMs = Math.min(
          1000 * 2 ** Math.min(attempt - 1, 10),
          MAX_BACKOFF_MS,
        );
        logger.warn(
          { err, attempt, backoffMs },
          "Database readiness check failed (database may be waking up); retrying",
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  })();
}

async function checkDbConnectivity(): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
