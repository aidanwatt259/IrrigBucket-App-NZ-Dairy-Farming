import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// Route modules import @workspace/db and the Supabase client at module load,
// which throw when their env vars are absent. Provide inert fallbacks so this
// test can exercise the readiness gate without a live database (nothing here
// opens a connection).
process.env.DATABASE_URL ??=
  "postgres://test:test@localhost:5432/readiness-gate-test";
process.env.SUPABASE_URL ??= "https://readiness-gate-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "readiness-gate-test-key";

const { default: express } = await import("express");
const { default: router } = await import("./index");
const { __setDbReadyForTests, isDbReady } = await import("../lib/migrate");

let server: Server;
let baseUrl: string;

before(async () => {
  const app = express();
  app.use(express.json());
  // Minimal stand-in for the real auth middleware: unauthenticated session.
  app.use((req, _res, next) => {
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => false;
    next();
  });
  app.use("/api", router);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("Expected the test server to bind a TCP port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  __setDbReadyForTests(false);
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

test("readiness gate: /healthz stays 200 while the database is not ready", async () => {
  __setDbReadyForTests(false);
  assert.equal(isDbReady(), false);

  const res = await fetch(`${baseUrl}/api/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("readiness gate: DB-backed routes return 503 DB_NOT_READY pre-ready", async () => {
  __setDbReadyForTests(false);

  for (const [method, path] of [
    ["GET", "/api/auth/user"],
    ["GET", "/api/reports"],
    ["POST", "/api/reports"],
    ["DELETE", "/api/reports/some-id"],
  ] as const) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(res.status, 503, `${method} ${path} should be gated`);
    const body = (await res.json()) as { code?: string; status?: string };
    assert.equal(body.code, "DB_NOT_READY", `${method} ${path} body code`);
    assert.equal(body.status, "degraded", `${method} ${path} body status`);
  }
});

test("readiness gate: routes pass through once the database is ready", async () => {
  __setDbReadyForTests(true);

  // /auth/user answers from the session alone (no DB round-trip when
  // unauthenticated), so it proves the gate passes requests through.
  const res = await fetch(`${baseUrl}/api/auth/user`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { user: null });
});
