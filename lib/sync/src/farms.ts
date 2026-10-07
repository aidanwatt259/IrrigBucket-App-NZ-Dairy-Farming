/**
 * {@link FarmDirectory} — the offline-first store for a user's farms and saved
 * irrigators, shared by web and mobile.
 *
 * Farms and irrigators are small, rarely-edited records, so instead of a
 * per-record outbox the whole directory is kept as one snapshot per scope
 * (account). A record is "dirty" while its `syncedAt` differs from its
 * `clientUpdatedAt`; {@link FarmDirectory.sync} pushes dirty records (farms
 * before their irrigators), then pulls and merges the server copy without
 * overwriting local edits that have not been pushed yet.
 *
 * Like the report engine, this module has no platform code: storage and the
 * network are injected.
 */

export type FarmRole = "owner" | "consultant" | "farmer";

export interface LocalFarm {
  /** Client-generated UUID; the upsert key. */
  id: string;
  name: string;
  region: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  /** The signed-in user's role on the farm; `null` until the server confirms it. */
  role: FarmRole | null;
  /** ISO time of the last local edit. Drives Last-Write-Wins. */
  clientUpdatedAt: string;
  deletedAt: string | null;
  /** The `clientUpdatedAt` the server has confirmed, or `null` if never pushed. */
  syncedAt: string | null;
}

export interface LocalIrrigator {
  id: string;
  farmId: string;
  name: string;
  /** Irrigator type id: pivot, lateral, kline, gun, solid, boom. */
  type: string;
  /** Last-used system settings, used to prefill a re-test. */
  details: Record<string, unknown>;
  testIntervalMonths: number;
  clientUpdatedAt: string;
  deletedAt: string | null;
  syncedAt: string | null;
}

export type RemoteFarm = Omit<LocalFarm, "syncedAt" | "role"> & { role: FarmRole };
export type RemoteIrrigator = Omit<LocalIrrigator, "syncedAt">;

export interface FarmDirectorySnapshot {
  farms: LocalFarm[];
  irrigators: LocalIrrigator[];
  /** ISO time of the last successful pull, or `null` if never pulled. */
  pulledAt: string | null;
  /** Whether farms have been created from this scope's pre-existing reports. */
  backfilled: boolean;
}

/** Durable persistence for one snapshot per scope (e.g. per account). */
export interface FarmDirectoryStore {
  load(scope: string): Promise<FarmDirectorySnapshot | null>;
  save(scope: string, snapshot: FarmDirectorySnapshot): Promise<void>;
}

/** The api-server boundary (`GET /farms`, `POST /farms`, `POST /irrigators`). */
export interface FarmDirectoryTransport {
  pushFarm(farm: LocalFarm): Promise<RemoteFarm>;
  pushIrrigator(irrigator: LocalIrrigator): Promise<RemoteIrrigator>;
  pull(): Promise<{ farms: RemoteFarm[]; irrigators: RemoteIrrigator[] }>;
}

export interface FarmDirectoryOptions {
  store: FarmDirectoryStore;
  transport: FarmDirectoryTransport;
  genId: () => string;
  now?: () => number;
  /**
   * Whether a push error will never succeed on retry (e.g. HTTP 400/403). The
   * rejected local change is then abandoned so the next pull restores the
   * server copy, instead of being re-sent forever.
   */
  isPermanentError?: (err: unknown) => boolean;
  /**
   * Called after local records were merged into same-named server records on
   * a scope's first pull, so callers can re-point reports at the server ids.
   */
  onRemap?: (remap: FarmIdRemap) => Promise<void> | void;
}

export interface FarmInput {
  name: string;
  region?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export interface IrrigatorInput {
  farmId: string;
  name: string;
  type: string;
  details?: Record<string, unknown>;
  testIntervalMonths?: number;
}

/** Old ids → the ids they were merged into, from {@link FarmDirectory.adoptScope}. */
export interface FarmIdRemap {
  farms: Map<string, string>;
  irrigators: Map<string, string>;
}

/** What {@link FarmDirectory.backfill} needs to know about one existing report. */
export interface BackfillEntry {
  farmName?: string | null;
  irrigatorName?: string | null;
  irrigatorType?: string | null;
  details?: Record<string, unknown> | null;
}

export const DEFAULT_TEST_INTERVAL_MONTHS = 12;

const EMPTY: FarmDirectorySnapshot = Object.freeze({
  farms: [],
  irrigators: [],
  pulledAt: null,
  backfilled: false,
}) as FarmDirectorySnapshot;

/** Case- and whitespace-insensitive key for matching farm/irrigator names. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isDirty(record: { clientUpdatedAt: string; syncedAt: string | null }): boolean {
  return record.syncedAt !== record.clientUpdatedAt;
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export class FarmDirectory {
  private readonly store: FarmDirectoryStore;
  private readonly transport: FarmDirectoryTransport;
  private readonly genId: () => string;
  private readonly now: () => number;
  private readonly isPermanentError: (err: unknown) => boolean;
  private readonly onRemap?: (remap: FarmIdRemap) => Promise<void> | void;

  private scope: string | null = null;
  private snapshot: FarmDirectorySnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  /** Serializes every load/mutation so writes never interleave. */
  private queue: Promise<unknown> = Promise.resolve();
  private syncInFlight: Promise<void> | null = null;
  private syncAgain = false;
  private lastError: string | null = null;

  constructor(options: FarmDirectoryOptions) {
    this.store = options.store;
    this.transport = options.transport;
    this.genId = options.genId;
    this.now = options.now ?? (() => Date.now());
    this.isPermanentError = options.isPermanentError ?? (() => false);
    this.onRemap = options.onRemap;
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /** The current immutable snapshot (a new object after every change). */
  getSnapshot(): FarmDirectorySnapshot {
    return this.snapshot;
  }

  /** Subscribe to snapshot changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The scope (account) currently open, or `null` before {@link open}. */
  getScope(): string | null {
    return this.scope;
  }

  /** Most recent sync error message, or `null` after a clean sync. */
  getLastError(): string | null {
    return this.lastError;
  }

  /** Live farms, sorted by name. */
  listFarms(): LocalFarm[] {
    return this.snapshot.farms.filter((f) => f.deletedAt === null).sort(byName);
  }

  /** Live irrigators (optionally for one farm), sorted by name. */
  listIrrigators(farmId?: string): LocalIrrigator[] {
    return this.snapshot.irrigators
      .filter((i) => i.deletedAt === null && (farmId === undefined || i.farmId === farmId))
      .sort(byName);
  }

  getFarm(id: string): LocalFarm | null {
    return this.snapshot.farms.find((f) => f.id === id && f.deletedAt === null) ?? null;
  }

  getIrrigator(id: string): LocalIrrigator | null {
    return this.snapshot.irrigators.find((i) => i.id === id && i.deletedAt === null) ?? null;
  }

  findFarmByName(name: string): LocalFarm | null {
    const key = normalizeName(name);
    if (!key) return null;
    return this.listFarms().find((f) => normalizeName(f.name) === key) ?? null;
  }

  findIrrigator(farmId: string, name: string, type: string): LocalIrrigator | null {
    const key = normalizeName(name);
    if (!key) return null;
    return (
      this.listIrrigators(farmId).find(
        (i) => i.type === type && normalizeName(i.name) === key,
      ) ?? null
    );
  }

  // -------------------------------------------------------------------------
  // Scope
  // -------------------------------------------------------------------------

  /** Load (or switch to) the snapshot for `scope`. */
  open(scope: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.scope === scope) return;
      const loaded = await this.store.load(scope);
      this.scope = scope;
      this.snapshot = loaded ? { ...EMPTY, ...loaded } : EMPTY;
      this.lastError = null;
      this.emit();
    });
  }

  /** Wipe the open scope's farms and irrigators locally (e.g. on account deletion). */
  clear(): Promise<void> {
    return this.enqueue(() => this.commit(EMPTY));
  }

  /**
   * Merge another scope's records into the open one (e.g. farms created while
   * logged out joining the account that signs in), then empty the other scope.
   * Records whose name matches an existing farm/irrigator are merged into it;
   * the returned remap lets callers re-point reports at the surviving ids.
   */
  adoptScope(fromScope: string): Promise<FarmIdRemap> {
    return this.enqueue(async () => {
      const remap: FarmIdRemap = { farms: new Map(), irrigators: new Map() };
      if (!this.scope || fromScope === this.scope) return remap;
      const other = await this.store.load(fromScope);
      if (!other || (other.farms.length === 0 && other.irrigators.length === 0)) return remap;

      const ts = this.nowIso();
      const farms = [...this.snapshot.farms];
      const irrigators = [...this.snapshot.irrigators];

      for (const farm of other.farms) {
        if (farm.deletedAt !== null) continue;
        const match = farms.find(
          (f) => f.deletedAt === null && normalizeName(f.name) === normalizeName(farm.name),
        );
        if (match) {
          remap.farms.set(farm.id, match.id);
        } else {
          farms.push({ ...farm, role: null, clientUpdatedAt: ts, syncedAt: null });
        }
      }
      for (const irrigator of other.irrigators) {
        if (irrigator.deletedAt !== null) continue;
        const farmId = remap.farms.get(irrigator.farmId) ?? irrigator.farmId;
        const match = irrigators.find(
          (i) =>
            i.deletedAt === null &&
            i.farmId === farmId &&
            i.type === irrigator.type &&
            normalizeName(i.name) === normalizeName(irrigator.name),
        );
        if (match) {
          remap.irrigators.set(irrigator.id, match.id);
        } else {
          irrigators.push({ ...irrigator, farmId, clientUpdatedAt: ts, syncedAt: null });
        }
      }

      await this.commit({ ...this.snapshot, farms, irrigators });
      await this.store.save(fromScope, EMPTY);
      return remap;
    });
  }

  // -------------------------------------------------------------------------
  // Editing (all local-first; call sync() to push)
  // -------------------------------------------------------------------------

  createFarm(input: FarmInput): Promise<LocalFarm> {
    return this.enqueue(() => this.addFarm(input));
  }

  updateFarm(id: string, patch: Partial<FarmInput>): Promise<LocalFarm | null> {
    return this.enqueue(async () => {
      const farm = this.snapshot.farms.find((f) => f.id === id && f.deletedAt === null);
      if (!farm) return null;
      const updated: LocalFarm = {
        ...farm,
        ...patch,
        name: (patch.name ?? farm.name).trim(),
        clientUpdatedAt: this.nextTs(farm.clientUpdatedAt),
      };
      await this.commit({
        ...this.snapshot,
        farms: this.snapshot.farms.map((f) => (f.id === id ? updated : f)),
      });
      return updated;
    });
  }

  /** Delete a farm and its irrigators (tombstoned until the server confirms). */
  deleteFarm(id: string): Promise<void> {
    return this.enqueue(async () => {
      const farm = this.snapshot.farms.find((f) => f.id === id && f.deletedAt === null);
      if (!farm) return;
      await this.commit({
        ...this.snapshot,
        farms: this.tombstone(this.snapshot.farms, (f) => f.id === id),
        irrigators: this.tombstone(this.snapshot.irrigators, (i) => i.farmId === id),
      });
    });
  }

  createIrrigator(input: IrrigatorInput): Promise<LocalIrrigator> {
    return this.enqueue(() => this.addIrrigator(input));
  }

  updateIrrigator(
    id: string,
    patch: Partial<Omit<IrrigatorInput, "farmId">>,
  ): Promise<LocalIrrigator | null> {
    return this.enqueue(async () => {
      const irrigator = this.snapshot.irrigators.find((i) => i.id === id && i.deletedAt === null);
      if (!irrigator) return null;
      const updated: LocalIrrigator = {
        ...irrigator,
        ...patch,
        name: (patch.name ?? irrigator.name).trim(),
        clientUpdatedAt: this.nextTs(irrigator.clientUpdatedAt),
      };
      await this.commit({
        ...this.snapshot,
        irrigators: this.snapshot.irrigators.map((i) => (i.id === id ? updated : i)),
      });
      return updated;
    });
  }

  deleteIrrigator(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.commit({
        ...this.snapshot,
        irrigators: this.tombstone(this.snapshot.irrigators, (i) => i.id === id),
      });
    });
  }

  /** The live farm with this name, creating it if there is none. */
  ensureFarm(name: string): Promise<LocalFarm> {
    return this.enqueue(async () => this.findFarmByName(name) ?? this.addFarm({ name }));
  }

  /** The live irrigator with this farm/name/type, creating it if there is none. */
  ensureIrrigator(input: IrrigatorInput): Promise<LocalIrrigator> {
    return this.enqueue(
      async () =>
        this.findIrrigator(input.farmId, input.name, input.type) ?? this.addIrrigator(input),
    );
  }

  /**
   * One-time: create farms and irrigators named on reports saved before farms
   * existed. Signed-in callers should wait for a successful pull first so names
   * already backfilled on the server are matched instead of duplicated.
   */
  backfill(entries: BackfillEntry[]): Promise<void> {
    return this.enqueue(async () => {
      if (!this.scope || this.snapshot.backfilled) return;
      for (const entry of entries) {
        const farmName = entry.farmName?.trim();
        if (!farmName) continue;
        const farm = this.findFarmByName(farmName) ?? (await this.addFarm({ name: farmName }));
        const irrigatorName = entry.irrigatorName?.trim();
        if (!irrigatorName || !entry.irrigatorType) continue;
        if (!this.findIrrigator(farm.id, irrigatorName, entry.irrigatorType)) {
          await this.addIrrigator({
            farmId: farm.id,
            name: irrigatorName,
            type: entry.irrigatorType,
            details: entry.details ?? {},
          });
        }
      }
      await this.commit({ ...this.snapshot, backfilled: true });
    });
  }

  /** Must run inside {@link enqueue}. */
  private async addFarm(input: FarmInput): Promise<LocalFarm> {
    this.assertOpen();
    const farm: LocalFarm = {
      id: this.genId(),
      name: input.name.trim(),
      region: input.region ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
      role: null,
      clientUpdatedAt: this.nowIso(),
      deletedAt: null,
      syncedAt: null,
    };
    await this.commit({ ...this.snapshot, farms: [...this.snapshot.farms, farm] });
    return farm;
  }

  /** Must run inside {@link enqueue}. */
  private async addIrrigator(input: IrrigatorInput): Promise<LocalIrrigator> {
    this.assertOpen();
    const irrigator: LocalIrrigator = {
      id: this.genId(),
      farmId: input.farmId,
      name: input.name.trim(),
      type: input.type,
      details: input.details ?? {},
      testIntervalMonths: input.testIntervalMonths ?? DEFAULT_TEST_INTERVAL_MONTHS,
      clientUpdatedAt: this.nowIso(),
      deletedAt: null,
      syncedAt: null,
    };
    await this.commit({ ...this.snapshot, irrigators: [...this.snapshot.irrigators, irrigator] });
    return irrigator;
  }

  /**
   * Tombstone the live records matching `pick`. Records the server has never
   * seen are simply removed — there is nothing to delete remotely.
   */
  private tombstone<T extends LocalFarm | LocalIrrigator>(list: T[], pick: (r: T) => boolean): T[] {
    const out: T[] = [];
    for (const r of list) {
      if (r.deletedAt !== null || !pick(r)) out.push(r);
      else if (r.syncedAt !== null) {
        const ts = this.nextTs(r.clientUpdatedAt);
        out.push({ ...r, deletedAt: ts, clientUpdatedAt: ts });
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /**
   * Push dirty farms, then dirty irrigators whose farm the server has, then
   * pull and merge. Single-flight: a call made mid-sync runs one more pass.
   * Never throws; the error is kept in {@link getLastError}.
   */
  sync(): Promise<void> {
    if (this.syncInFlight) {
      this.syncAgain = true;
      return this.syncInFlight;
    }
    this.syncInFlight = (async () => {
      try {
        do {
          this.syncAgain = false;
          await this.syncOnce();
        } while (this.syncAgain);
      } finally {
        this.syncInFlight = null;
      }
    })();
    return this.syncInFlight;
  }

  private async syncOnce(): Promise<void> {
    await this.queue.catch(() => {});
    const scope = this.scope;
    if (!scope) return;
    try {
      if (this.snapshot.pulledAt === null) await this.firstPull(scope);
      for (const farm of this.snapshot.farms.filter(isDirty)) {
        if (this.scope !== scope) return;
        await this.pushOne(scope, farm, "farm");
      }
      for (const irrigator of this.snapshot.irrigators.filter(isDirty)) {
        if (this.scope !== scope) return;
        const farm = this.snapshot.farms.find((f) => f.id === irrigator.farmId);
        // The server needs the farm first; a deleted farm hides its irrigators.
        if (!farm || farm.syncedAt === null || farm.deletedAt !== null) continue;
        await this.pushOne(scope, irrigator, "irrigator");
      }
      if (this.scope !== scope) return;
      const remote = await this.transport.pull();
      await this.enqueue(async () => {
        if (this.scope !== scope) return;
        await this.commit(mergeRemote(this.snapshot, remote, this.nowIso()));
      });
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  /**
   * Before a scope's first push, fold never-synced local farms/irrigators into
   * same-named ones the server already has (e.g. created on another device or
   * by the server-side backfill) instead of pushing duplicates.
   */
  private async firstPull(scope: string): Promise<void> {
    const remote = await this.transport.pull();
    let remap: FarmIdRemap | null = null;
    await this.enqueue(async () => {
      if (this.scope !== scope) return;
      const folded = foldIntoRemote(this.snapshot, remote);
      remap = folded.remap;
      await this.commit(mergeRemote(folded.snapshot, remote, this.nowIso()));
    });
    const found = remap as FarmIdRemap | null;
    if (found && (found.farms.size > 0 || found.irrigators.size > 0)) {
      await this.onRemap?.(found);
    }
  }

  /** Push one record. A transient failure throws, ending this sync pass. */
  private async pushOne(
    scope: string,
    record: LocalFarm | LocalIrrigator,
    kind: "farm" | "irrigator",
  ): Promise<void> {
    let remote: RemoteFarm | RemoteIrrigator | null = null;
    try {
      remote =
        kind === "farm"
          ? await this.transport.pushFarm(record as LocalFarm)
          : await this.transport.pushIrrigator(record as LocalIrrigator);
    } catch (err) {
      if (!this.isPermanentError(err)) throw err;
    }
    await this.enqueue(async () => {
      if (this.scope !== scope) return;
      const key = kind === "farm" ? "farms" : "irrigators";
      const list = this.snapshot[key] as Array<LocalFarm | LocalIrrigator>;
      const current = list.find((r) => r.id === record.id);
      // Edited again while in flight: keep the newer local copy for the next pass.
      if (!current || current.clientUpdatedAt !== record.clientUpdatedAt) return;
      let next: Array<LocalFarm | LocalIrrigator>;
      if (remote === null) {
        // Rejected for good: mark clean so the next pull restores the server copy.
        next = list.map((r) => (r.id === record.id ? { ...r, syncedAt: r.clientUpdatedAt } : r));
      } else if (remote.deletedAt !== null) {
        next = list.filter((r) => r.id !== record.id);
      } else {
        const adopted = { ...remote, syncedAt: remote.clientUpdatedAt };
        next = list.map((r) => (r.id === record.id ? adopted : r));
      }
      await this.commit({ ...this.snapshot, [key]: next });
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const run = this.queue.catch(() => {}).then(op);
    this.queue = run;
    return run;
  }

  private async commit(next: FarmDirectorySnapshot): Promise<void> {
    if (!this.scope) return;
    this.snapshot = next;
    await this.store.save(this.scope, next);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private assertOpen(): void {
    if (!this.scope) throw new Error("FarmDirectory is not open");
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  /** A timestamp strictly after `previous`, so every edit wins LWW over the last. */
  private nextTs(previous: string): string {
    const prevMs = Date.parse(previous);
    const nowMs = this.now();
    return new Date(Number.isNaN(prevMs) || nowMs > prevMs ? nowMs : prevMs + 1).toISOString();
  }
}

/**
 * Replace never-synced local farms/irrigators that share a name with a server
 * record (farm: same name; irrigator: same farm, type and name) by that server
 * record, re-pointing local irrigators of a folded farm. Returns the id remap.
 */
export function foldIntoRemote(
  local: FarmDirectorySnapshot,
  remote: { farms: RemoteFarm[]; irrigators: RemoteIrrigator[] },
): { snapshot: FarmDirectorySnapshot; remap: FarmIdRemap } {
  const remap: FarmIdRemap = { farms: new Map(), irrigators: new Map() };
  const localIds = new Set(local.farms.map((f) => f.id));
  const remoteFarmByName = new Map<string, RemoteFarm>();
  for (const f of remote.farms) {
    const key = normalizeName(f.name);
    if (!localIds.has(f.id) && !remoteFarmByName.has(key)) remoteFarmByName.set(key, f);
  }

  const farms = local.farms.filter((farm) => {
    if (farm.syncedAt !== null || farm.deletedAt !== null) return true;
    const match = remoteFarmByName.get(normalizeName(farm.name));
    if (!match) return true;
    remap.farms.set(farm.id, match.id);
    remoteFarmByName.delete(normalizeName(farm.name));
    return false;
  });

  const localIrrigatorIds = new Set(local.irrigators.map((i) => i.id));
  const irrigators: LocalIrrigator[] = [];
  for (const irrigator of local.irrigators) {
    const farmId = remap.farms.get(irrigator.farmId) ?? irrigator.farmId;
    if (irrigator.syncedAt === null && irrigator.deletedAt === null) {
      const match = remote.irrigators.find(
        (r) =>
          !localIrrigatorIds.has(r.id) &&
          r.farmId === farmId &&
          r.type === irrigator.type &&
          normalizeName(r.name) === normalizeName(irrigator.name),
      );
      if (match) {
        remap.irrigators.set(irrigator.id, match.id);
        localIrrigatorIds.add(match.id);
        continue;
      }
    }
    irrigators.push(farmId === irrigator.farmId ? irrigator : { ...irrigator, farmId });
  }

  return { snapshot: { ...local, farms, irrigators }, remap };
}

/**
 * Merge a server pull into a local snapshot. Dirty local records are kept (they
 * are pushed next); clean ones take the server copy, or are dropped when the
 * server no longer lists them (deleted elsewhere or access removed).
 */
export function mergeRemote(
  local: FarmDirectorySnapshot,
  remote: { farms: RemoteFarm[]; irrigators: RemoteIrrigator[] },
  pulledAt: string,
): FarmDirectorySnapshot {
  const remoteFarms = new Map(remote.farms.map((f) => [f.id, f]));
  const farms: LocalFarm[] = [];
  for (const farm of local.farms) {
    const server = remoteFarms.get(farm.id);
    remoteFarms.delete(farm.id);
    if (isDirty(farm)) farms.push(farm);
    else if (server) farms.push({ ...server, syncedAt: server.clientUpdatedAt });
  }
  for (const server of remoteFarms.values()) {
    farms.push({ ...server, syncedAt: server.clientUpdatedAt });
  }

  const farmIds = new Set(farms.map((f) => f.id));
  const remoteIrrigators = new Map(remote.irrigators.map((i) => [i.id, i]));
  const irrigators: LocalIrrigator[] = [];
  for (const irrigator of local.irrigators) {
    const server = remoteIrrigators.get(irrigator.id);
    remoteIrrigators.delete(irrigator.id);
    if (!farmIds.has(irrigator.farmId)) continue;
    if (isDirty(irrigator)) irrigators.push(irrigator);
    else if (server) irrigators.push({ ...server, syncedAt: server.clientUpdatedAt });
  }
  for (const server of remoteIrrigators.values()) {
    if (farmIds.has(server.farmId)) {
      irrigators.push({ ...server, syncedAt: server.clientUpdatedAt });
    }
  }

  return { ...local, farms, irrigators, pulledAt };
}
