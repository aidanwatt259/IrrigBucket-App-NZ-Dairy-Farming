import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideReportUpsert,
  type ExistingReportMeta,
} from "./reportUpsert.js";

const OLD = "2026-01-01T00:00:00.000Z";
const NEW = "2026-06-01T00:00:00.000Z";

function existing(over: Partial<ExistingReportMeta> = {}): ExistingReportMeta {
  return {
    user_id: "user-1",
    client_updated_at: OLD,
    updated_at: OLD,
    created_at: OLD,
    ...over,
  };
}

test("no existing row → insert", () => {
  const d = decideReportUpsert({
    existing: null,
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.deepEqual(d, { kind: "insert" });
});

test("newer client write overwrites the stored copy → accept", () => {
  const d = decideReportUpsert({
    existing: existing({ client_updated_at: OLD }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(d.kind, "accept");
});

test("older client write loses to the stored copy → server_wins", () => {
  const d = decideReportUpsert({
    existing: existing({ client_updated_at: NEW }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: OLD,
  });
  assert.equal(d.kind, "server_wins");
});

test("equal timestamps keep the server copy (idempotent re-send) → server_wins", () => {
  const d = decideReportUpsert({
    existing: existing({ client_updated_at: NEW }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(d.kind, "server_wins");
});

test("cannot overwrite another user's report → forbidden", () => {
  const d = decideReportUpsert({
    existing: existing({ user_id: "user-2", client_updated_at: OLD }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.deepEqual(d, { kind: "forbidden" });
});

test("admin may overwrite another user's report → accept", () => {
  const d = decideReportUpsert({
    existing: existing({ user_id: "user-2", client_updated_at: OLD }),
    callerId: "admin",
    isAdmin: true,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(d.kind, "accept");
});

test("anonymous existing row is unowned and may be written → accept", () => {
  const d = decideReportUpsert({
    existing: existing({ user_id: null, client_updated_at: OLD }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(d.kind, "accept");
});

test("anonymous caller cannot overwrite an owned report → forbidden", () => {
  const d = decideReportUpsert({
    existing: existing({ user_id: "user-1", client_updated_at: OLD }),
    callerId: null,
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.deepEqual(d, { kind: "forbidden" });
});

test("falls back to updated_at when client_updated_at is null", () => {
  const accept = decideReportUpsert({
    existing: existing({ client_updated_at: null, updated_at: OLD }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(accept.kind, "accept");

  const wins = decideReportUpsert({
    existing: existing({ client_updated_at: null, updated_at: NEW }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: OLD,
  });
  assert.equal(wins.kind, "server_wins");
});

test("unparseable stored timestamp falls back to accepting the write", () => {
  const d = decideReportUpsert({
    existing: existing({
      client_updated_at: "not-a-date",
      updated_at: "also-bad",
      created_at: "nope",
    }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: NEW,
  });
  assert.equal(d.kind, "accept");
});

test("unparseable incoming timestamp keeps the server copy", () => {
  const d = decideReportUpsert({
    existing: existing({ client_updated_at: OLD }),
    callerId: "user-1",
    isAdmin: false,
    incomingClientUpdatedAt: "not-a-date",
  });
  assert.equal(d.kind, "server_wins");
});
