import assert from "node:assert/strict";
import { test } from "node:test";

import { SyncEngine } from "./engine.js";
import type { SyncStatus } from "./types.js";
import {
  FakeTransport,
  InMemoryStorageAdapter,
  makeQueueItem,
  makeReport,
} from "./testHelpers.js";

/** A clock the test advances explicitly. */
function fixedClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

function setup(opts?: { autoSync?: boolean; clockStart?: number }) {
  const storage = new InMemoryStorageAdapter();
  const transport = new FakeTransport();
  const clock = fixedClock(opts?.clockStart ?? Date.parse("2026-06-20T00:00:00.000Z"));
  const statuses: SyncStatus[] = [];
  const engine = new SyncEngine({
    storage,
    transport,
    now: clock.now,
    rand: () => 0, // deterministic backoff (no jitter)
    autoSync: opts?.autoSync ?? false,
    onStatus: (s) => statuses.push(s),
  });
  return { storage, transport, clock, statuses, engine };
}

test("enqueueUpsert atomically stores report + one outbox item", async () => {
  const { storage, engine } = setup();
  await engine.enqueueUpsert(
    makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }),
  );

  const reports = await storage.listReports();
  const queue = await storage.listQueue();
  assert.equal(reports.length, 1);
  assert.equal(queue.length, 1);
  assert.deepEqual(
    { reportId: queue[0].reportId, op: queue[0].op, attempts: queue[0].attempts },
    { reportId: "r1", op: "upsert", attempts: 0 },
  );
});

test("drain pushes once, clears the queue, and stamps syncedAt", async () => {
  const { storage, transport, engine } = setup();
  const cua = "2026-06-20T00:00:00.000Z";
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: cua }));

  await engine.drain();

  assert.equal(transport.pushes.length, 1);
  assert.equal((await storage.listQueue()).length, 0);
  const stored = await storage.getReport("r1");
  assert.equal(stored?.syncedAt, cua);
  assert.equal(stored?.userId, "server-user"); // adopted from authoritative record
});

test("repeated upserts before drain coalesce to one push of the latest", async () => {
  const { storage, transport, engine } = setup();
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:01:00.000Z" }));

  assert.equal((await storage.listQueue()).length, 1, "one pending item per report");

  await engine.drain();

  assert.equal(transport.pushes.length, 1);
  assert.equal(transport.pushes[0].clientUpdatedAt, "2026-06-20T00:01:00.000Z");
});

test("transient failures retry with exponential backoff, then succeed", async () => {
  const { storage, transport, clock, engine } = setup();
  transport.failuresRemaining = 2;
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));

  // Attempt 1 fails -> backoff 1000ms.
  await engine.drain();
  let item = (await storage.listQueue())[0];
  assert.equal(item.attempts, 1);
  assert.equal(Date.parse(item.nextAttemptAt) - clock.now(), 1000);
  assert.ok(item.lastError);

  // Not yet due -> nothing happens.
  await engine.drain();
  assert.equal((await storage.listQueue())[0].attempts, 1);

  // Advance past backoff: attempt 2 fails -> backoff 2000ms.
  clock.advance(1000);
  await engine.drain();
  item = (await storage.listQueue())[0];
  assert.equal(item.attempts, 2);
  assert.equal(Date.parse(item.nextAttemptAt) - clock.now(), 2000);

  // Advance again: attempt 3 succeeds.
  clock.advance(2000);
  await engine.drain();
  assert.equal((await storage.listQueue()).length, 0);
  assert.equal(transport.pushes.length, 3);
});

test("server-wins: a newer server record is adopted locally", async () => {
  const { storage, transport, engine } = setup();
  // Server already has a newer version than the local edit.
  transport.seedServer(
    makeReport({
      id: "r1",
      clientUpdatedAt: "2026-06-20T12:00:00.000Z",
      farmName: "Server Farm",
      userId: "server-user",
    }),
  );
  await engine.enqueueUpsert(
    makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z", farmName: "Local Farm" }),
  );

  await engine.drain();

  const stored = await storage.getReport("r1");
  assert.equal(stored?.clientUpdatedAt, "2026-06-20T12:00:00.000Z");
  assert.equal(stored?.farmName, "Server Farm");
  assert.equal((await storage.listQueue()).length, 0);
});

test("an edit enqueued mid-flight is not clobbered by the in-flight completion", async () => {
  const { storage, transport, engine } = setup();
  const oldVersion = "2026-06-20T00:00:00.000Z";
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: oldVersion }));
  const oldEnqueueId = (await storage.listQueue())[0].enqueueId;

  // Simulate the network round-trip resolving for the OLD version while a newer
  // edit has already replaced the outbox item.
  const newVersion = "2026-06-20T00:05:00.000Z";
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: newVersion }));

  const adoptedOld = await storage.completeSync(
    makeReport({ id: "r1", clientUpdatedAt: oldVersion, syncedAt: oldVersion }),
    oldEnqueueId,
  );
  assert.equal(adoptedOld, false, "stale completion is rejected");

  const queue = await storage.listQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].opClientUpdatedAt, newVersion, "newer edit still queued");

  await engine.drain();
  assert.equal(transport.pushes.at(-1)?.clientUpdatedAt, newVersion);
});

test("enqueueDelete tombstones locally and clears the queue after drain", async () => {
  const { storage, transport, engine } = setup();
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));
  await engine.drain();

  await engine.enqueueDelete("r1");
  // Hidden from the UI immediately.
  assert.equal((await storage.listReports()).length, 0);
  const tombstoned = await storage.getReport("r1");
  assert.ok(tombstoned?.deletedAt);

  await engine.drain();
  assert.equal(transport.deletes.length, 1);
  assert.equal((await storage.listQueue()).length, 0);
});

test("reconcilePull adopts new/newer remotes but skips locally-queued reports", async () => {
  const { storage, transport, engine } = setup();

  // r1: remote-only, should be adopted.
  transport.seedServer(
    makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T01:00:00.000Z", farmName: "Remote One" }),
  );
  // r2: locally queued with a newer edit; pull must NOT clobber it.
  transport.seedServer(
    makeReport({ id: "r2", clientUpdatedAt: "2026-06-20T00:00:00.000Z", farmName: "Stale Remote" }),
  );
  await engine.enqueueUpsert(
    makeReport({ id: "r2", clientUpdatedAt: "2026-06-20T02:00:00.000Z", farmName: "Fresh Local" }),
  );

  await engine.reconcilePull();

  assert.equal((await storage.getReport("r1"))?.farmName, "Remote One");
  assert.equal((await storage.getReport("r2"))?.farmName, "Fresh Local");
  assert.equal((await storage.getReport("r1"))?.syncedAt, "2026-06-20T01:00:00.000Z");
});

test("status transitions: syncing -> idle on success, error while pending fails", async () => {
  const { transport, statuses, engine } = setup();
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));

  await engine.drain();
  assert.equal(statuses.at(0)?.state, "syncing");
  assert.deepEqual(
    { state: statuses.at(-1)?.state, pending: statuses.at(-1)?.pending },
    { state: "idle", pending: 0 },
  );

  transport.failuresRemaining = 1;
  await engine.enqueueUpsert(makeReport({ id: "r2", clientUpdatedAt: "2026-06-20T00:10:00.000Z" }));
  await engine.drain();
  const last = statuses.at(-1);
  assert.equal(last?.state, "error");
  assert.equal(last?.pending, 1);
  assert.ok(last?.lastError);
});

test("applyRemoteBatch skips a record that changed locally since reconciliation (CAS)", async () => {
  const { storage } = setup();
  const expected = "2026-06-20T01:00:00.000Z";
  // Reconcile observed the local copy at T1 and decided to adopt the T2 remote.
  await storage.saveAndEnqueue(
    makeReport({ id: "r1", clientUpdatedAt: expected, farmName: "T1 Local" }),
    makeQueueItem("r1", "upsert", expected),
  );
  // A newer local edit lands AFTER reconcile's read but BEFORE applyRemoteBatch:
  // the report advances to T3 and its outbox item is replaced.
  await storage.saveAndEnqueue(
    makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T03:00:00.000Z", farmName: "T3 Local" }),
    makeQueueItem("r1", "upsert", "2026-06-20T03:00:00.000Z"),
  );

  await storage.applyRemoteBatch([
    {
      record: makeReport({
        id: "r1",
        clientUpdatedAt: "2026-06-20T02:00:00.000Z",
        farmName: "T2 Remote",
        syncedAt: "2026-06-20T02:00:00.000Z",
      }),
      expectedLocalClientUpdatedAt: expected,
    },
  ]);

  // The remote did NOT clobber the fresher local edit.
  const stored = await storage.getReport("r1");
  assert.equal(stored?.farmName, "T3 Local");
  assert.equal(stored?.clientUpdatedAt, "2026-06-20T03:00:00.000Z");
});

test("a delete superseded by a later upsert sends only the upsert", async () => {
  const { storage, transport, engine } = setup();
  // r1 has reached the server.
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));
  await engine.drain();

  // Delete, then re-create the same id before any drain: the outbox coalesces to
  // the latest op so the stale delete must never be sent.
  await engine.enqueueDelete("r1");
  await engine.enqueueUpsert(
    makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T02:00:00.000Z", farmName: "Reborn" }),
  );

  const queued = await storage.getSyncTarget("r1");
  assert.equal(queued?.item.op, "upsert");

  transport.deletes.length = 0;
  await engine.drain();

  assert.equal(transport.deletes.length, 0, "no stale delete sent");
  assert.equal(transport.pushes.at(-1)?.farmName, "Reborn");
  assert.equal((await storage.getReport("r1"))?.deletedAt, null);
  assert.equal((await storage.listQueue()).length, 0);
});

test("deleting a never-synced report purges locally with no server round-trip", async () => {
  const { storage, transport, engine } = setup();
  // Created offline; never pushed (syncedAt stays null).
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));
  assert.equal((await storage.getReport("r1"))?.syncedAt, null);

  await engine.enqueueDelete("r1");

  // Report and its pending upsert are both gone; nothing left to sync.
  assert.equal(await storage.getReport("r1"), null);
  assert.equal((await storage.listQueue()).length, 0);

  await engine.drain();
  assert.equal(transport.pushes.length, 0);
  assert.equal(transport.deletes.length, 0);
});

test("offline pauses draining; going online drains the backlog", async () => {
  const { storage, transport, statuses, engine } = setup({ autoSync: false });

  engine.setOnline(false);
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));
  await engine.drain(); // no-op while offline; awaited emit makes status observable
  assert.equal(statuses.at(-1)?.state, "offline");
  assert.equal((await storage.listQueue()).length, 1);
  assert.equal(transport.pushes.length, 0);

  engine.setOnline(true);
  await engine.drain(); // online again → backlog flushes
  assert.equal((await storage.listQueue()).length, 0);
  assert.equal(transport.pushes.length, 1);
});

test("deleting a report whose create is in-flight removes it on the server (no resurrection)", async () => {
  const { storage, transport, clock, engine } = setup();

  // While the create push is on the wire, the user deletes the same report. The
  // delete must NOT purge locally (the create is in-flight) — it tombstones and
  // enqueues a server delete so the just-created row is removed, not resurrected.
  transport.onPush = async (r) => {
    if (r.id !== "r1") return;
    transport.onPush = undefined; // fire once
    clock.advance(1000); // tombstone is strictly newer than the create
    await engine.enqueueDelete("r1");
  };

  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));

  // Drain to completion the way autoSync would: the first pass sends the create
  // (the delete lands mid-flight and is queued); the second flushes that delete.
  for (let i = 0; i < 5 && (await storage.listQueue()).length > 0; i++) {
    await engine.drain();
  }

  // The create reached the server, then the delete removed it again.
  assert.equal(transport.deletes.length, 1, "delete propagated after the in-flight create");
  assert.equal((await transport.pullReports()).length, 0, "a pull would not resurrect it");
  assert.ok((await storage.getReport("r1"))?.deletedAt, "local copy is tombstoned");
  assert.equal((await storage.listQueue()).length, 0, "outbox fully drained");
});

test("a delete landing during the outbox read (pre-send) does not orphan the server row", async () => {
  const { storage, transport, clock, engine } = setup();

  // Model the real-adapter race: getSyncTarget has already snapshotted the
  // pending CREATE, and only THEN does the user's delete commit — i.e. BEFORE
  // the create is on the wire. Because the engine claims the report in-flight
  // before reading, enqueueDelete must NOT take the never-synced purge shortcut;
  // it tombstones and enqueues a server delete instead. (Without the pre-read
  // claim this purges locally and the create we then send is orphaned.)
  storage.onGetSyncTarget = async (id) => {
    if (id !== "r1") return;
    storage.onGetSyncTarget = undefined; // fire once
    clock.advance(1000);
    await engine.enqueueDelete("r1");
  };

  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: "2026-06-20T00:00:00.000Z" }));

  for (let i = 0; i < 5 && (await storage.listQueue()).length > 0; i++) {
    await engine.drain();
  }

  // The create may have been sent, but a delete always follows: the server ends
  // with no live row and nothing is resurrected on a subsequent pull.
  assert.equal((await transport.pullReports()).length, 0, "no orphaned server row");
  assert.ok((await storage.getReport("r1"))?.deletedAt, "local copy is tombstoned");
  assert.equal((await storage.listQueue()).length, 0, "outbox fully drained");
});

test("a stale completion is rejected by enqueueId even when timestamps collide", async () => {
  const { storage, engine } = setup();
  const ts = "2026-06-20T00:00:00.000Z";

  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: ts, farmName: "First" }));
  const first = (await storage.listQueue())[0];

  // A second edit at the SAME instant supersedes the first: identical
  // opClientUpdatedAt, but a distinct enqueueId.
  await engine.enqueueUpsert(makeReport({ id: "r1", clientUpdatedAt: ts, farmName: "Second" }));
  const second = (await storage.listQueue())[0];
  assert.equal(second.opClientUpdatedAt, first.opClientUpdatedAt, "timestamps collide");
  assert.notEqual(second.enqueueId, first.enqueueId, "but identities differ");

  // The first op's in-flight completion must NOT clear the second edit.
  const adopted = await storage.completeSync(
    makeReport({ id: "r1", clientUpdatedAt: ts, farmName: "First", syncedAt: ts }),
    first.enqueueId,
  );
  assert.equal(adopted, false, "stale completion rejected by enqueueId");
  assert.equal((await storage.getReport("r1"))?.farmName, "Second");
  assert.equal((await storage.listQueue()).length, 1, "newer edit still queued");
});
