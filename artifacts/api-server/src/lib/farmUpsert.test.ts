import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canEditFarm,
  decideFarmWrite,
  incomingIsNewer,
  mayLinkReportToFarm,
} from "./farmUpsert.js";

const OLD = "2026-01-01T00:00:00.000Z";
const NEW = "2026-06-01T00:00:00.000Z";

test("owners and consultants can edit a farm; farmers and non-members cannot", () => {
  assert.equal(canEditFarm("owner"), true);
  assert.equal(canEditFarm("consultant"), true);
  assert.equal(canEditFarm("farmer"), false);
  assert.equal(canEditFarm(null), false);
});

test("incomingIsNewer requires a strictly newer timestamp", () => {
  assert.equal(incomingIsNewer(OLD, NEW), true);
  assert.equal(incomingIsNewer(NEW, OLD), false);
  assert.equal(incomingIsNewer(NEW, NEW), false);
  assert.equal(incomingIsNewer(null, NEW), true);
  assert.equal(incomingIsNewer("garbage", NEW), true);
  assert.equal(incomingIsNewer(OLD, "garbage"), false);
});

test("a new id is always an insert", () => {
  assert.deepEqual(
    decideFarmWrite({ existing: null, role: null, isAdmin: false, incomingClientUpdatedAt: NEW }),
    { kind: "insert" },
  );
});

test("an existing farm cannot be written by a non-member or a farmer", () => {
  for (const role of [null, "farmer"] as const) {
    assert.deepEqual(
      decideFarmWrite({
        existing: { client_updated_at: OLD },
        role,
        isAdmin: false,
        incomingClientUpdatedAt: NEW,
      }),
      { kind: "forbidden" },
    );
  }
});

test("an editor's newer write is accepted and an older one loses", () => {
  assert.deepEqual(
    decideFarmWrite({
      existing: { client_updated_at: OLD },
      role: "owner",
      isAdmin: false,
      incomingClientUpdatedAt: NEW,
    }),
    { kind: "accept" },
  );
  assert.deepEqual(
    decideFarmWrite({
      existing: { client_updated_at: NEW },
      role: "consultant",
      isAdmin: false,
      incomingClientUpdatedAt: OLD,
    }),
    { kind: "server_wins" },
  );
});

test("admins may write any farm", () => {
  assert.deepEqual(
    decideFarmWrite({
      existing: { client_updated_at: OLD },
      role: null,
      isAdmin: true,
      incomingClientUpdatedAt: NEW,
    }),
    { kind: "accept" },
  );
});

test("report farm links need an account, and membership once the farm exists", () => {
  assert.equal(
    mayLinkReportToFarm({ callerId: null, farmExists: false, role: null, isAdmin: false }),
    false,
  );
  assert.equal(
    mayLinkReportToFarm({ callerId: "u1", farmExists: false, role: null, isAdmin: false }),
    true,
  );
  assert.equal(
    mayLinkReportToFarm({ callerId: "u1", farmExists: true, role: null, isAdmin: false }),
    false,
  );
  assert.equal(
    mayLinkReportToFarm({ callerId: "u1", farmExists: true, role: "farmer", isAdmin: false }),
    true,
  );
  assert.equal(
    mayLinkReportToFarm({ callerId: "u1", farmExists: true, role: null, isAdmin: true }),
    true,
  );
});
