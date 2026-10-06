import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../../api-client-react/src/custom-fetch.ts";
import { clientHarness } from "./client-harness.ts";

function error(status: number) {
  return new ApiError(new Response(null, { status }), { code: "DB_NOT_READY" }, {
    method: "GET", url: "/api/reports",
  });
}

for (const platform of ["web", "mobile"] as const) {
  test(`${platform}: transient 503 backs off, recovers without an online edge, then releases guard`, async () => {
    const client = await clientHarness(platform);
    client.respond(async () => { if (client.calls <= 2) throw error(503); });
    await client.start();
    assert.equal(client.calls, 1);
    await client.advance(1999);
    assert.equal(client.calls, 1);
    await client.advance(1);
    assert.equal(client.calls, 2);
    await client.advance(3999);
    assert.equal(client.calls, 2);
    await client.advance(1);
    assert.equal(client.calls, 3);
    assert.equal(client.pendingTimers, 0);
    if (platform === "web") assert.ok(client.drains > 0);
    await client.connect(false);
    await client.connect(true);
    assert.equal(client.calls, 4);
  });

  test(`${platform}: retries stop after six attempts with capped exponential backoff`, async () => {
    const client = await clientHarness(platform);
    client.respond(async () => { throw error(503); });
    await client.start();
    let expectedCalls = 1;
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await client.advance(delay - 1);
      assert.equal(client.calls, expectedCalls);
      await client.advance(1);
      assert.equal(client.calls, ++expectedCalls);
    }
    assert.equal(client.pendingTimers, 0);
    await client.advance(120000);
    assert.equal(client.calls, 6);
    client.respond(async () => {});
    await client.connect(false);
    await client.connect(true);
    assert.equal(client.calls, 7);
  });

  for (const status of [400, 401, 403, 404, 422]) {
    test(`${platform}: HTTP ${status} is not retried and releases guard`, async () => {
      const client = await clientHarness(platform);
      client.respond(async () => { throw error(status); });
      await client.start();
      assert.equal(client.calls, 1);
      assert.equal(client.pendingTimers, 0);
      await client.advance(120000);
      assert.equal(client.calls, 1);
      client.respond(async () => {});
      await client.connect(false);
      await client.connect(true);
      assert.equal(client.calls, 2);
    });
  }

  test(`${platform}: concurrent triggers coalesce during request and backoff`, async () => {
    const client = await clientHarness(platform);
    let reject!: (reason: unknown) => void;
    client.respond(() => new Promise<void>((_, no) => { reject = no; }));
    await client.start();
    for (let i = 0; i < 3; i++) {
      await client.connect(false);
      await client.connect(true);
    }
    assert.equal(client.calls, 1);
    reject(error(503));
    await client.settle();
    assert.equal(client.pendingTimers, 1);
    await client.connect(false);
    await client.connect(true);
    assert.equal(client.calls, 1);
    assert.equal(client.pendingTimers, 1);
    client.respond(async () => {});
    await client.advance(2000);
    assert.equal(client.calls, 2);
    assert.equal(client.pendingTimers, 0);
    await client.connect(false);
    await client.connect(true);
    assert.equal(client.calls, 3);
  });

  test(`${platform}: going offline during backoff stops retries; reconnect starts a new pull`, async () => {
    const client = await clientHarness(platform);
    client.respond(async () => { throw error(503); });
    await client.start();
    await client.connect(false);
    await client.advance(2000);
    assert.equal(client.calls, 1);
    assert.equal(client.pendingTimers, 0);
    client.respond(async () => {});
    await client.connect(true);
    assert.equal(client.calls, 2);
  });
}

test("mobile: signing out during backoff stops retries", async () => {
  const client = await clientHarness("mobile");
  client.respond(async () => { throw error(503); });
  await client.start();
  await client.signOut();
  await client.advance(2000);
  assert.equal(client.calls, 1);
  assert.equal(client.pendingTimers, 0);
  await client.connect(false);
  await client.connect(true);
  assert.equal(client.calls, 1);
});
