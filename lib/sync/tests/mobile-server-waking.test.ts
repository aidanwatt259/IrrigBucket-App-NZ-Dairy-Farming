import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../api-client-react/src/custom-fetch.ts";
import { clientHarness } from "./client-harness.ts";

function wakingError() {
  return new ApiError(new Response(null, { status: 503 }), { code: "DB_NOT_READY" }, {
    method: "GET", url: "/api/reports",
  });
}

test("mobile: clean prior status publishes waking hint through retries and clears on pull recovery", async () => {
  const client = await clientHarness("mobile");
  const hints: (boolean | undefined)[] = [];
  client.subscribeStatus((status) => hints.push(status.serverWaking));
  assert.equal(client.status.lastError, null);
  client.respond(async () => { if (client.calls <= 2) throw wakingError(); });
  await client.start();
  assert.equal(client.status.pending, 0);
  assert.equal(client.status.serverWaking, true);
  assert.equal(hints.at(-1), true);

  // Empty drains and connectivity/status notifications are not recovery.
  for (const state of ["idle", "syncing", "offline"] as const) {
    client.emitStatus({ state, pending: 0, lastError: null });
    assert.equal(client.status.serverWaking, true);
  }
  await client.advance(2000);
  assert.equal(client.calls, 2);
  assert.equal(client.status.serverWaking, true);
  await client.advance(3999);
  assert.equal(client.status.serverWaking, true);
  assert.ok(hints.every((hint) => hint === true));
  await client.advance(1);
  assert.equal(client.calls, 3);
  assert.equal(client.status.serverWaking, false);
  assert.equal(hints.at(-1), false);
  assert.equal(client.pendingTimers, 0);
});

test("mobile: exhausted startup retries retain hint until reconnect recovery", async () => {
  const client = await clientHarness("mobile");
  client.respond(async () => { throw wakingError(); });
  await client.start();
  for (const delay of [2000, 4000, 8000, 16000, 30000]) {
    await client.advance(delay);
    assert.equal(client.status.serverWaking, true);
  }
  assert.equal(client.calls, 6);
  assert.equal(client.pendingTimers, 0);
  client.respond(async () => {});
  await client.connect(false);
  await client.connect(true);
  assert.equal(client.calls, 7);
  assert.equal(client.status.serverWaking, false);
});

for (const op of ["pushReport", "deleteReport"] as const) {
  test(`mobile: only successful ${op} clears startup hint`, async () => {
    const client = await clientHarness("mobile");
    client.respond(async () => { throw wakingError(); });
    await client.start();
    client.respondToWrite(async () => { throw wakingError(); });
    await assert.rejects(client.write(op));
    assert.equal(client.status.serverWaking, true);
    client.respondToWrite(async () => {});
    await client.write(op);
    assert.equal(client.status.serverWaking, false);
    // A later failed pull can set it again.
    await client.advance(2000);
    assert.equal(client.status.serverWaking, true);
  });
}
