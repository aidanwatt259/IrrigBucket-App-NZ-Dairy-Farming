// Smoke test for the reports save/fetch API, with unconditional test-data
// cleanup on teardown (pass or fail).
//
// What it does:
//   1. Boots the API server on a private port (builds it first via pnpm).
//   2. Exercises POST /api/reports (insert, LWW server-wins, LWW accept)
//      and GET /api/reports/:id using rows tagged per the test-data
//      convention in replit.md ("E2E-" farm_name + reserved test user UUID).
//      Also exercises POST /api/feedback and POST /api/help-requests with
//      "[E2E]"-prefixed text so cleanup-test-data.mjs removes those rows too.
//   3. ALWAYS runs scripts/cleanup-test-data.mjs afterwards — even when a
//      check fails or the server never comes up — so no test rows linger.
//
// Usage: node scripts/smoke-test-reports.mjs
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server + cleanup).
// Exit code is non-zero if any check OR the cleanup fails.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3811; // private smoke-test port; not used by any workflow
const BASE = `http://127.0.0.1:${PORT}/api`;
const E2E_FARM_PREFIX = "E2E-"; // must match cleanup-test-data.mjs
const E2E_TEXT_PREFIX = "[E2E]"; // must match cleanup-test-data.mjs

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API server did not become healthy within ${timeoutMs}ms`);
}

async function postJson(pathname, body) {
  const r = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function postReport(body) {
  const r = await fetch(`${BASE}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function runChecks() {
  const id = randomUUID();
  const farmName = `${E2E_FARM_PREFIX}Smoke-${Date.now()}`;
  const t1 = new Date(Date.now() - 60_000).toISOString();
  const t2 = new Date().toISOString();

  console.log("Running reports API smoke checks…");

  // 1. Insert a tagged report.
  const ins = await postReport({
    id,
    clientUpdatedAt: t1,
    farmName,
    assessorName: "[E2E] smoke bot",
    irrigatorType: "pivot",
    reportData: { e2e: true, note: "[E2E] smoke test row" },
  });
  check("insert returns 201", ins.status === 201, `got ${ins.status}`);
  check(
    "insert echoes id + farm name",
    ins.json?.report?.id === id && ins.json?.report?.farmName === farmName,
  );

  // 2. LWW: replay an older save — server copy must win unchanged.
  const stale = await postReport({
    id,
    clientUpdatedAt: new Date(Date.parse(t1) - 60_000).toISOString(),
    farmName: `${E2E_FARM_PREFIX}Stale-should-not-appear`,
    reportData: { e2e: true },
  });
  check(
    "older save loses (server wins)",
    stale.status === 201 && stale.json?.report?.farmName === farmName,
    `got ${stale.status} / ${stale.json?.report?.farmName}`,
  );

  // 3. LWW: a newer save overwrites.
  const newerName = `${farmName}-v2`;
  const newer = await postReport({
    id,
    clientUpdatedAt: t2,
    farmName: newerName,
    reportData: { e2e: true, rev: 2 },
  });
  check(
    "newer save wins",
    newer.status === 201 && newer.json?.report?.farmName === newerName,
    `got ${newer.status} / ${newer.json?.report?.farmName}`,
  );

  // 4. Fetch by id returns the latest version.
  const get = await fetch(`${BASE}/reports/${id}`);
  const got = await get.json().catch(() => null);
  check(
    "GET /reports/:id returns latest",
    get.status === 200 && got?.report?.farmName === newerName,
    `got ${get.status}`,
  );

  // --- feedback endpoint --------------------------------------------------
  console.log("Running feedback API smoke checks…");

  // 5. Submit tagged feedback ([E2E] prefix matches cleanup convention).
  const fb = await postJson("/feedback", {
    message: `${E2E_TEXT_PREFIX} smoke test feedback ${Date.now()}`,
    contactInfo: `${E2E_TEXT_PREFIX} smoke@example.invalid`,
  });
  check("feedback insert returns 201", fb.status === 201, `got ${fb.status}`);
  check(
    "feedback returns id + createdAt",
    Boolean(fb.json?.feedback?.id && fb.json?.feedback?.createdAt),
  );

  // 6. Empty message is rejected.
  const fbBad = await postJson("/feedback", { message: "   " });
  check("feedback rejects empty message (400)", fbBad.status === 400, `got ${fbBad.status}`);

  // --- help-requests endpoint ----------------------------------------------
  console.log("Running help-requests API smoke checks…");

  // 7. Submit tagged help request.
  const hrDesc = `${E2E_TEXT_PREFIX} smoke test help request ${Date.now()}`;
  const hr = await postJson("/help-requests", {
    description: hrDesc,
    contactInfo: `${E2E_TEXT_PREFIX} smoke@example.invalid`,
  });
  check("help-request insert returns 201", hr.status === 201, `got ${hr.status}`);
  check(
    "help-request echoes description, unresolved",
    hr.json?.helpRequest?.description === hrDesc && hr.json?.helpRequest?.resolved === false,
  );

  // 8. Invalid body is rejected.
  const hrBad = await postJson("/help-requests", {});
  check("help-request rejects invalid body (400)", hrBad.status === 400, `got ${hrBad.status}`);
}

function runCleanup() {
  return new Promise((resolve) => {
    const p = spawn("node", ["scripts/cleanup-test-data.mjs"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    p.on("close", (code) => resolve(code ?? 1));
  });
}

// --- main -------------------------------------------------------------
let server = null;
let exitCode = 0;
try {
  console.log("Starting API server for smoke test…");
  // Note: the dev script forces NODE_ENV=development, so the server writes to
  // SUPABASE_URL — the same database cleanup-test-data.mjs deletes from. Keep
  // these aligned if this ever changes.
  server = spawn(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "dev"],
    {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "inherit", "inherit"],
      detached: true, // own process group so we can kill pnpm + node children
    },
  );
  await waitForServer();
  await runChecks();
  if (failures > 0) exitCode = 1;
} catch (err) {
  console.error(`Smoke test error: ${err.message}`);
  exitCode = 1;
} finally {
  if (server && server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  // Cleanup runs UNCONDITIONALLY — pass or fail — so tagged rows never linger.
  console.log("Tearing down: cleaning up tagged test data…");
  const cleanupCode = await runCleanup();
  if (cleanupCode !== 0) {
    console.error("Cleanup FAILED — tagged test rows may remain!");
    exitCode = 1;
  }
}
console.log(exitCode === 0 ? "Smoke test PASSED (data cleaned up)" : "Smoke test FAILED");
process.exit(exitCode);
