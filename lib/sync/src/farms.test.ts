import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FarmDirectory,
  isDirty,
  mergeRemote,
  type FarmDirectorySnapshot,
  type FarmIdRemap,
  type FarmDirectoryStore,
  type FarmDirectoryTransport,
  type LocalFarm,
  type LocalIrrigator,
  type RemoteFarm,
  type RemoteIrrigator,
} from "./farms.js";

class MemoryStore implements FarmDirectoryStore {
  readonly data = new Map<string, FarmDirectorySnapshot>();
  async load(scope: string) {
    return this.data.get(scope) ?? null;
  }
  async save(scope: string, snapshot: FarmDirectorySnapshot) {
    this.data.set(scope, structuredClone(snapshot));
  }
}

/** A fake server holding live and tombstoned rows, with injectable failures. */
class FakeServer implements FarmDirectoryTransport {
  farms = new Map<string, RemoteFarm>();
  irrigators = new Map<string, RemoteIrrigator>();
  failNext: unknown = null;
  pushes: string[] = [];

  private takeFailure() {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
  }

  async pushFarm(farm: LocalFarm): Promise<RemoteFarm> {
    this.takeFailure();
    this.pushes.push(`farm:${farm.id}`);
    const stored = this.farms.get(farm.id);
    if (stored && stored.clientUpdatedAt >= farm.clientUpdatedAt) return stored;
    const { syncedAt: _s, ...rest } = farm;
    const remote: RemoteFarm = { ...rest, role: stored?.role ?? "owner" };
    this.farms.set(farm.id, remote);
    return remote;
  }

  async pushIrrigator(irrigator: LocalIrrigator): Promise<RemoteIrrigator> {
    this.takeFailure();
    this.pushes.push(`irrigator:${irrigator.id}`);
    if (!this.farms.has(irrigator.farmId)) throw new Error("409 farm not saved");
    const stored = this.irrigators.get(irrigator.id);
    if (stored && stored.clientUpdatedAt >= irrigator.clientUpdatedAt) return stored;
    const { syncedAt: _s, ...remote } = irrigator;
    this.irrigators.set(irrigator.id, remote);
    return remote;
  }

  async pull() {
    this.takeFailure();
    const farms = [...this.farms.values()].filter((f) => f.deletedAt === null);
    const live = new Set(farms.map((f) => f.id));
    return {
      farms,
      irrigators: [...this.irrigators.values()].filter(
        (i) => i.deletedAt === null && live.has(i.farmId),
      ),
    };
  }
}

function setup(clockStart = Date.parse("2026-10-01T00:00:00.000Z")) {
  let clock = clockStart;
  let ids = 0;
  const store = new MemoryStore();
  const server = new FakeServer();
  const dir = new FarmDirectory({
    store,
    transport: server,
    genId: () => `id-${++ids}`,
    now: () => clock,
    isPermanentError: (err) => err instanceof Error && err.message.startsWith("403"),
  });
  return {
    dir,
    store,
    server,
    tick: (ms = 1000) => {
      clock += ms;
    },
  };
}

test("creating a farm and irrigator is local-first and dirty until synced", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "  Riverdale  " });
  const pivot = await dir.createIrrigator({ farmId: farm.id, name: "Pivot 1", type: "pivot" });

  assert.equal(farm.name, "Riverdale");
  assert.equal(pivot.testIntervalMonths, 12);
  assert.ok(isDirty(farm) && isDirty(pivot));
  assert.equal(server.farms.size, 0);

  await dir.sync();

  assert.deepEqual(server.pushes, [`farm:${farm.id}`, `irrigator:${pivot.id}`]);
  assert.equal(dir.getFarm(farm.id)?.role, "owner");
  assert.ok(!isDirty(dir.getFarm(farm.id)!));
  assert.ok(!isDirty(dir.getIrrigator(pivot.id)!));
  assert.equal(dir.getLastError(), null);
});

test("the snapshot persists per scope and reloads on open", async () => {
  const { dir, store } = setup();
  await dir.open("user-1");
  await dir.createFarm({ name: "Riverdale" });
  await dir.open("user-2");
  assert.equal(dir.listFarms().length, 0);
  await dir.open("user-1");
  assert.deepEqual(
    dir.listFarms().map((f) => f.name),
    ["Riverdale"],
  );
  assert.equal(store.data.get("user-1")?.farms.length, 1);
});

test("clear wipes the open scope's farms and saved snapshot", async () => {
  const { dir, store } = setup();
  await dir.open("device");
  await dir.createFarm({ name: "Riverdale" });
  await dir.clear();
  assert.equal(dir.listFarms().length, 0);
  assert.equal(store.data.get("device")?.farms.length, 0);
  await dir.open("device");
  assert.equal(dir.listFarms().length, 0);
});

test("a transient push failure keeps changes queued for the next sync", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });
  server.failNext = new Error("503 unavailable");

  await dir.sync();
  assert.match(dir.getLastError() ?? "", /503/);
  assert.ok(isDirty(dir.getFarm(farm.id)!));

  await dir.sync();
  assert.equal(dir.getLastError(), null);
  assert.ok(!isDirty(dir.getFarm(farm.id)!));
});

test("irrigators wait for their farm to reach the server", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });
  await dir.createIrrigator({ farmId: farm.id, name: "Pivot 1", type: "pivot" });
  server.failNext = new Error("503 unavailable");

  await dir.sync();
  assert.deepEqual(server.pushes, []);
});

test("an edit made while a push is in flight is not marked synced", async () => {
  const { dir, server, tick } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });

  const originalPush = server.pushFarm.bind(server);
  server.pushFarm = async (f) => {
    tick();
    await dir.updateFarm(farm.id, { name: "Riverdale North" });
    return originalPush(f);
  };
  await dir.sync();
  server.pushFarm = originalPush;

  const local = dir.getFarm(farm.id)!;
  assert.equal(local.name, "Riverdale North");
  assert.ok(isDirty(local), "the newer edit must still be pending");

  await dir.sync();
  assert.equal(server.farms.get(farm.id)?.name, "Riverdale North");
});

test("mergeRemote adopts server copies of clean records and keeps dirty local edits", () => {
  const T1 = "2026-10-01T00:00:00.000Z";
  const T2 = "2026-10-02T00:00:00.000Z";
  const farm = (id: string, name: string, clientUpdatedAt: string, syncedAt: string | null): LocalFarm => ({
    id,
    name,
    region: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    notes: null,
    role: "owner",
    clientUpdatedAt,
    deletedAt: null,
    syncedAt,
  });
  const toRemote = ({ syncedAt: _s, ...f }: LocalFarm): RemoteFarm => ({ ...f, role: "owner" });
  const local: FarmDirectorySnapshot = {
    farms: [farm("a", "Alpha", T1, T1), farm("b", "Bravo (local)", T2, T1)],
    irrigators: [],
    pulledAt: null,
    backfilled: false,
  };
  const merged = mergeRemote(
    local,
    {
      farms: [toRemote(farm("a", "Alpha (server)", T2, null)), toRemote(farm("b", "Bravo (server)", T1, null))],
      irrigators: [],
    },
    T2,
  );

  assert.equal(merged.farms.find((f) => f.id === "a")?.name, "Alpha (server)");
  assert.equal(merged.farms.find((f) => f.id === "a")?.syncedAt, T2);
  assert.equal(merged.farms.find((f) => f.id === "b")?.name, "Bravo (local)");
  assert.equal(merged.pulledAt, T2);
});

test("pull adds farms shared from elsewhere and drops ones removed on the server", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const mine = await dir.createFarm({ name: "Mine" });
  await dir.sync();

  server.farms.set("shared", {
    id: "shared",
    name: "Shared Farm",
    region: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    notes: null,
    role: "farmer",
    clientUpdatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
  });
  server.farms.delete(mine.id);
  await dir.sync();

  assert.deepEqual(
    dir.listFarms().map((f) => [f.name, f.role]),
    [["Shared Farm", "farmer"]],
  );
});

test("deleting a synced farm tombstones it and its irrigators, then removes them", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });
  const pivot = await dir.createIrrigator({ farmId: farm.id, name: "Pivot 1", type: "pivot" });
  await dir.sync();

  await dir.deleteFarm(farm.id);
  assert.equal(dir.listFarms().length, 0);
  assert.equal(dir.listIrrigators().length, 0);

  await dir.sync();
  assert.ok(server.farms.get(farm.id)?.deletedAt);
  assert.equal(dir.getSnapshot().farms.length, 0);
  assert.equal(dir.getSnapshot().irrigators.length, 0);
  assert.ok(server.irrigators.has(pivot.id));
});

test("deleting a never-synced farm just removes it locally", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Typo Farm" });
  await dir.deleteFarm(farm.id);
  assert.equal(dir.getSnapshot().farms.length, 0);
  await dir.sync();
  assert.deepEqual(server.pushes, []);
});

test("a permanently rejected change is abandoned and the server copy restored", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });
  await dir.sync();

  await dir.updateFarm(farm.id, { name: "Hijacked" });
  server.failNext = new Error("403 not authorised");
  await dir.sync();

  assert.equal(dir.getFarm(farm.id)?.name, "Riverdale");
  assert.ok(!isDirty(dir.getFarm(farm.id)!));
});

test("ensureFarm and ensureIrrigator match names ignoring case and spacing", async () => {
  const { dir } = setup();
  await dir.open("user-1");
  const [a, b] = await Promise.all([dir.ensureFarm("Riverdale"), dir.ensureFarm(" riverdale ")]);
  assert.equal(a.id, b.id);
  const p1 = await dir.ensureIrrigator({ farmId: a.id, name: "Pivot  1", type: "pivot" });
  const p2 = await dir.ensureIrrigator({ farmId: a.id, name: "pivot 1", type: "pivot" });
  const gun = await dir.ensureIrrigator({ farmId: a.id, name: "pivot 1", type: "gun" });
  assert.equal(p1.id, p2.id);
  assert.notEqual(p1.id, gun.id);
});

test("adoptScope merges guest farms into the account and reports id remaps", async () => {
  const { dir, store } = setup();
  await dir.open("guest");
  const guestRiverdale = await dir.createFarm({ name: "Riverdale" });
  const guestPivot = await dir.createIrrigator({
    farmId: guestRiverdale.id,
    name: "Pivot 1",
    type: "pivot",
  });
  const guestNew = await dir.createFarm({ name: "Hilltop" });

  await dir.open("user-1");
  const accountRiverdale = await dir.createFarm({ name: "riverdale" });
  const remap = await dir.adoptScope("guest");

  assert.equal(remap.farms.get(guestRiverdale.id), accountRiverdale.id);
  assert.equal(remap.farms.has(guestNew.id), false);
  assert.deepEqual(
    dir.listFarms().map((f) => f.name),
    ["Hilltop", "riverdale"],
  );
  assert.equal(dir.getIrrigator(guestPivot.id)?.farmId, accountRiverdale.id);
  assert.equal(store.data.get("guest")?.farms.length, 0);
});

test("backfill creates farms and irrigators from old reports exactly once", async () => {
  const { dir } = setup();
  await dir.open("user-1");
  const entries = [
    { farmName: "Riverdale", irrigatorName: "Pivot 1", irrigatorType: "pivot", details: { armLength: 400 } },
    { farmName: "riverdale ", irrigatorName: "pivot 1", irrigatorType: "pivot" },
    { farmName: "Riverdale", irrigatorName: "", irrigatorType: "gun" },
    { farmName: "", irrigatorName: "Orphan", irrigatorType: "pivot" },
  ];
  await dir.backfill(entries);
  await dir.backfill([{ farmName: "Second Run" }]);

  assert.deepEqual(
    dir.listFarms().map((f) => f.name),
    ["Riverdale"],
  );
  const irrigators = dir.listIrrigators();
  assert.equal(irrigators.length, 1);
  assert.deepEqual(irrigators[0].details, { armLength: 400 });
  assert.equal(dir.getSnapshot().backfilled, true);
});

test("the first sync folds new local farms into same-named server farms", async () => {
  const remaps: FarmIdRemap[] = [];
  const store = new MemoryStore();
  const server = new FakeServer();
  let ids = 0;
  const dir = new FarmDirectory({
    store,
    transport: server,
    genId: () => `local-${++ids}`,
    now: () => Date.parse("2026-10-01T00:00:00.000Z"),
    onRemap: (remap) => {
      remaps.push(remap);
    },
  });
  server.farms.set("srv-farm", {
    id: "srv-farm",
    name: "Riverdale",
    region: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    notes: null,
    role: "owner",
    clientUpdatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  });
  server.irrigators.set("srv-pivot", {
    id: "srv-pivot",
    farmId: "srv-farm",
    name: "Pivot 1",
    type: "pivot",
    details: {},
    testIntervalMonths: 12,
    clientUpdatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  });

  await dir.open("device");
  const localFarm = await dir.createFarm({ name: "riverdale" });
  const localPivot = await dir.createIrrigator({ farmId: localFarm.id, name: "PIVOT 1", type: "pivot" });
  const localGun = await dir.createIrrigator({ farmId: localFarm.id, name: "Gun", type: "gun" });
  await dir.sync();

  assert.deepEqual(server.pushes, [`irrigator:${localGun.id}`]);
  assert.deepEqual(
    dir.listFarms().map((f) => f.id),
    ["srv-farm"],
  );
  assert.deepEqual(
    dir.listIrrigators("srv-farm").map((i) => i.id).sort(),
    [localGun.id, "srv-pivot"].sort(),
  );
  assert.equal(remaps.length, 1);
  assert.equal(remaps[0].farms.get(localFarm.id), "srv-farm");
  assert.equal(remaps[0].irrigators.get(localPivot.id), "srv-pivot");

  // Later syncs push normally and do not fold again.
  await dir.createFarm({ name: "Riverdale" });
  await dir.sync();
  assert.equal(dir.listFarms().length, 2);
  assert.equal(remaps.length, 1);
});

test("results of a sync started under one scope are not applied to another", async () => {
  const { dir, server } = setup();
  await dir.open("user-1");
  const farm = await dir.createFarm({ name: "Riverdale" });

  const originalPull = server.pull.bind(server);
  server.pull = async () => {
    await dir.open("user-2");
    return originalPull();
  };
  await dir.sync();

  assert.equal(dir.getScope(), "user-2");
  assert.equal(dir.listFarms().length, 0);
  await dir.open("user-1");
  assert.ok(dir.getFarm(farm.id));
});
