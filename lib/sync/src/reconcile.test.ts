import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareTimestamps,
  computeBackoff,
  DEFAULT_BACKOFF,
  reconcileRemote,
} from "./reconcile.js";
import { makeReport } from "./testHelpers.js";

test("compareTimestamps orders by recency", () => {
  assert.ok(compareTimestamps("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z") > 0);
  assert.ok(compareTimestamps("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z") < 0);
  assert.equal(
    compareTimestamps("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
    0,
  );
});

test("compareTimestamps treats invalid timestamps as oldest", () => {
  assert.ok(compareTimestamps("2026-01-01T00:00:00.000Z", "not-a-date") > 0);
  assert.ok(compareTimestamps("not-a-date", "2026-01-01T00:00:00.000Z") < 0);
  assert.equal(compareTimestamps("nope", "also-nope"), 0);
});

test("reconcileRemote adopts remote when no local exists", () => {
  const remote = makeReport({ id: "a", clientUpdatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(reconcileRemote(null, remote), remote);
});

test("reconcileRemote keeps local on tie (no churn)", () => {
  const ts = "2026-01-01T00:00:00.000Z";
  const local = makeReport({ id: "a", clientUpdatedAt: ts });
  const remote = makeReport({ id: "a", clientUpdatedAt: ts });
  assert.equal(reconcileRemote(local, remote), local);
});

test("reconcileRemote adopts strictly-newer remote, keeps newer local", () => {
  const local = makeReport({ id: "a", clientUpdatedAt: "2026-01-01T00:00:00.000Z" });
  const newerRemote = makeReport({ id: "a", clientUpdatedAt: "2026-01-02T00:00:00.000Z" });
  assert.equal(reconcileRemote(local, newerRemote), newerRemote);

  const newerLocal = makeReport({ id: "a", clientUpdatedAt: "2026-01-03T00:00:00.000Z" });
  const olderRemote = makeReport({ id: "a", clientUpdatedAt: "2026-01-02T00:00:00.000Z" });
  assert.equal(reconcileRemote(newerLocal, olderRemote), newerLocal);
});

test("computeBackoff grows exponentially and caps, jitter off", () => {
  const noJitter = () => 0;
  assert.equal(computeBackoff(1, DEFAULT_BACKOFF, noJitter), 1000);
  assert.equal(computeBackoff(2, DEFAULT_BACKOFF, noJitter), 2000);
  assert.equal(computeBackoff(3, DEFAULT_BACKOFF, noJitter), 4000);
  // 1000 * 2^9 = 512000, capped at 60000
  assert.equal(computeBackoff(10, DEFAULT_BACKOFF, noJitter), 60000);
});

test("computeBackoff adds bounded jitter", () => {
  const fullJitter = () => 1;
  // attempt 1 raw = 1000, + 1000 * 0.25 * 1 = 1250
  assert.equal(computeBackoff(1, DEFAULT_BACKOFF, fullJitter), 1250);
});
