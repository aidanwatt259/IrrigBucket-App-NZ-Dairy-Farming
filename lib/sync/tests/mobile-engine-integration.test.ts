import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../api-client-react/src/custom-fetch.ts";
import type { SyncStatus } from "../src/types.ts";
import { clientHarness } from "./client-harness.ts";

function wakingError() {
  return new ApiError(new Response(null, { status: 503 }), { code: "DB_NOT_READY" }, {
    method: "GET", url: "/api/reports",
  });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("mobile real engine: overlapping empty drains cannot clear a failed pull's waking hint", async () => {
  const client = await clientHarness("mobile", { integration: true });
  const statuses: SyncStatus[] = [];
  client.subscribeStatus((status) => statuses.push({ ...status }));
  const pull = deferred();
  client.respond(() => pull.promise);
  await client.start();
  assert.equal(client.calls, 1);
  assert.equal(client.status.state, "idle");
  assert.equal(client.status.serverWaking, false);

  // Start concurrent real drains while the request is outstanding, then reject
  // it before their async empty-queue reads finish.
  const drains = Promise.all([client.drain(), client.drain(), client.drain()]);
  pull.reject(wakingError());
  await drains;
  await client.settle();
  assert.equal(client.status.pending, 0);
  assert.equal(client.status.lastError, null);
  assert.equal(client.status.serverWaking, true);
  assert.equal(client.pendingTimers, 1);

  const failedAt = statuses.findIndex((status) => status.serverWaking);
  assert.ok(failedAt >= 0, "failed pull publishes a status without an outbox error");
  const beforeEmptyDrain = statuses.length;
  await Promise.all([client.drain(), client.drain()]);
  assert.ok(statuses.length > beforeEmptyDrain, "real empty drain emits status");
  assert.equal(client.status.state, "idle");
  assert.ok(statuses.slice(failedAt).every((status) => status.serverWaking));

  // A second failed pull and reconnect-triggered drains must preserve the hint
  // and the existing retry loop, not start a competing pull.
  client.respond(async () => { throw wakingError(); });
  await client.connect(false);
  await client.connect(true);
  assert.equal(client.calls, 1);
  assert.equal(client.pendingTimers, 1);
  await client.advance(2000);
  assert.equal(client.calls, 2);
  assert.ok(statuses.slice(failedAt).every((status) => status.serverWaking));

  client.respond(async () => {});
  const recoveryAt = statuses.length;
  await client.advance(4000);
  assert.equal(client.calls, 3);
  assert.equal(client.pendingTimers, 0);
  assert.deepEqual(statuses.slice(recoveryAt).map((s) => [s.state, s.pending, s.serverWaking]), [
    ["idle", 0, true], // engine emits before the wrapper observes pull success
    ["idle", 0, false],
  ]);
});

for (const op of ["upsert", "delete"] as const) {
  test(`mobile real engine: queued ${op} clears waking only on success during pull backoff`, async () => {
    const client = await clientHarness("mobile", { integration: true });
    const statuses: SyncStatus[] = [];
    client.subscribeStatus((status) => statuses.push({ ...status }));
    client.respond(async () => { throw wakingError(); });
    await client.start();
    const id = `integration-${op}`;
    if (op === "delete") {
      // A real successful create is required: never-synced deletes are purged
      // locally and would not exercise the production delete transport wrapper.
      await client.saveReport(id);
      assert.equal(client.storage.reports.get(id)?.syncedAt, new Date(0).toISOString());
      await client.advance(2000);
    }
    assert.equal(client.status.serverWaking, true);
    const pullCalls = client.calls;
    client.respondToWrite(async () => { throw wakingError(); });
    if (op === "upsert") await client.saveReport(id);
    else await client.deleteReport(id);
    assert.equal(client.status.state, "error");
    assert.equal(client.status.pending, 1);
    assert.equal(client.status.serverWaking, true);
    const queued = client.storage.queue.get(id)!;
    assert.equal(queued.op, op);
    assert.equal(queued.attempts, 1);
    assert.ok(queued.lastError);

    // Advance only the write backoff (1s); the pull retry is still sleeping.
    await client.advance(1000);
    const write = deferred();
    client.respondToWrite(() => write.promise);
    const retryAt = statuses.length;
    const drain = client.drain();
    await client.settle();
    assert.equal(client.status.state, "syncing");
    assert.equal(client.status.pending, 1);
    assert.equal(client.status.serverWaking, true);
    write.resolve();
    await drain;
    assert.equal(client.storage.queue.size, 0);
    assert.equal(client.calls, pullCalls);
    assert.equal(client.pendingTimers, 1);
    assert.equal(client.status.lastError, null);
    assert.deepEqual(statuses.slice(retryAt).map((s) => [s.state, s.pending, s.serverWaking]), [
      ["syncing", 1, true],
      ["syncing", 1, false], // successful transport clears hint before queue completion
      ["idle", 0, false],
    ]);
    const stored = client.storage.reports.get(id)!;
    assert.equal(stored.syncedAt, stored.clientUpdatedAt);
    assert.equal(Boolean(stored.deletedAt), op === "delete");
    assert.equal(client.server.server.has(id), op === "upsert");
    assert.equal(op === "upsert" ? client.server.pushes.length : client.server.deletes.length, 1);

    // The outstanding pull remains independent; a later failure sets the hint
    // again, and a genuine pull success clears it after the engine's idle event.
    await client.advance(op === "upsert" ? 1000 : 3000);
    assert.equal(client.calls, pullCalls + 1);
    assert.equal(client.status.serverWaking, true);
    client.respond(async () => {});
    await client.advance(op === "upsert" ? 4000 : 8000);
    assert.equal(client.status.serverWaking, false);
    assert.equal(client.pendingTimers, 0);
  });
}
