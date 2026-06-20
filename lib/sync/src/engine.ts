/**
 * {@link SyncEngine} — the platform-agnostic orchestrator.
 *
 * Responsibilities:
 *  - enqueue local upserts/deletes atomically into the outbox (coalesced per
 *    report);
 *  - drain the outbox to the {@link Transport} with a single in-flight pass,
 *    FIFO ordering, exponential backoff, and version-guarded completion so an
 *    edit made mid-flight is never lost;
 *  - reconcile a server pull without clobbering locally-queued newer changes;
 *  - surface a coarse {@link SyncStatus} for the UI.
 *
 * The engine does NOT detect connectivity. Platforms call {@link setOnline}
 * (web: `navigator.onLine` + events; mobile: NetInfo).
 */

import { computeBackoff, DEFAULT_BACKOFF, reconcileRemote } from "./reconcile.js";
import type {
  BackoffOptions,
  RemoteAdoption,
  StorageAdapter,
  SyncEngineOptions,
  SyncQueueItem,
  SyncReport,
  SyncStatus,
  Transport,
} from "./types.js";

export class SyncEngine<TData = Record<string, unknown>> {
  private readonly storage: StorageAdapter<TData>;
  private readonly transport: Transport<TData>;
  private readonly now: () => number;
  private readonly rand: () => number;
  private readonly genId: () => string;
  private readonly backoff: BackoffOptions;
  private readonly onStatus?: (status: SyncStatus) => void;
  private readonly autoSync: boolean;

  private online = true;
  private draining = false;
  /** Set when an enqueue/online arrives mid-drain, so the loop runs once more. */
  private drainRequested = false;
  private lastError: string | null = null;
  /** Monotonic in-session sequence; combined with entropy for unique ids. */
  private seq = 0;
  /** Reports whose op is currently being transmitted (guards the purge shortcut). */
  private readonly inFlight = new Set<string>();

  constructor(options: SyncEngineOptions<TData>) {
    this.storage = options.storage;
    this.transport = options.transport;
    this.now = options.now ?? (() => Date.now());
    this.rand = options.rand ?? Math.random;
    // Default enqueueId: clock + per-engine sequence + random entropy. The
    // sequence guarantees uniqueness within a session; the random suffix guards
    // against cross-restart/clock-reset collisions (enqueueId is persisted).
    this.genId =
      options.genId ??
      (() => `${this.nowIso()}#${++this.seq}#${Math.random().toString(36).slice(2, 10)}`);
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
    this.onStatus = options.onStatus;
    this.autoSync = options.autoSync ?? true;
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  private makeQueueItem(
    reportId: string,
    op: SyncQueueItem["op"],
    opClientUpdatedAt: string,
  ): SyncQueueItem {
    const ts = this.nowIso();
    return {
      reportId,
      enqueueId: this.genId(),
      op,
      opClientUpdatedAt,
      attempts: 0,
      nextAttemptAt: ts,
      enqueuedAt: ts,
      lastError: null,
    };
  }

  /** Queue a create/update. Forces the record live (clears any tombstone). */
  async enqueueUpsert(report: SyncReport<TData>): Promise<SyncReport<TData>> {
    const record: SyncReport<TData> = { ...report, deletedAt: null };
    const item = this.makeQueueItem(record.id, "upsert", record.clientUpdatedAt);
    await this.storage.saveAndEnqueue(record, item);
    this.requestDrain();
    return record;
  }

  /**
   * Queue a delete. Tombstones the record locally and stamps a fresh
   * `clientUpdatedAt`/`deletedAt` so the delete wins LWW over older edits.
   * No-op if the report does not exist locally.
   */
  async enqueueDelete(id: string): Promise<void> {
    const existing = await this.storage.getReport(id);
    if (!existing) return;
    if (existing.syncedAt === null && !this.inFlight.has(id)) {
      // The server never received this report AND no create is mid-flight, so we
      // can drop it (and any pending upsert) locally with no round-trip. This is
      // the common offline create-then-delete. If a create were in-flight we must
      // fall through to tombstone+enqueue so the server copy is deleted afterward.
      await this.storage.purgeReport(id);
      await this.emitStatus();
      return;
    }
    const ts = this.nowIso();
    const tombstoned: SyncReport<TData> = {
      ...existing,
      deletedAt: ts,
      clientUpdatedAt: ts,
    };
    const item = this.makeQueueItem(id, "delete", ts);
    await this.storage.saveAndEnqueue(tombstoned, item);
    this.requestDrain();
  }

  /** Inform the engine of connectivity. Going online triggers a drain. */
  setOnline(online: boolean): void {
    this.online = online;
    if (online) {
      this.requestDrain();
    } else {
      void this.emitStatus("offline");
    }
  }

  /** Fire-and-forget drain trigger (respects `autoSync`). */
  private requestDrain(): void {
    if (!this.autoSync) return;
    void this.drain();
  }

  /**
   * Process every due outbox item once, then repeat while new work arrived
   * mid-pass. A single drain runs at a time; concurrent calls coalesce.
   */
  async drain(): Promise<void> {
    if (!this.online) {
      // No point hitting the network while offline; resume on setOnline(true).
      await this.emitStatus("offline");
      return;
    }
    if (this.draining) {
      this.drainRequested = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.drainRequested = false;
        const processedAny = await this.drainOnce();
        if (!processedAny) break;
      } while (this.drainRequested);
    } finally {
      this.draining = false;
      await this.emitStatus();
    }
  }

  /** One FIFO pass over the currently-due items. Returns whether any ran. */
  private async drainOnce(): Promise<boolean> {
    const now = this.now();
    const due = (await this.storage.listQueue())
      .filter((item) => Date.parse(item.nextAttemptAt) <= now)
      .sort((a, b) => Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt));

    if (due.length === 0) return false;

    await this.emitStatus("syncing");
    // Iterate by reportId only: each report is (re)read fresh in processReport so
    // an op that was superseded earlier in this same pass is never sent stale.
    for (const { reportId } of due) {
      await this.processReport(reportId);
    }
    return true;
  }

  private async processReport(reportId: string): Promise<void> {
    // Claim this report as in-flight BEFORE any await. enqueueDelete() takes its
    // never-synced purge shortcut only when the report is NOT in-flight; if we
    // set this after the (async) getSyncTarget read, a delete could land during
    // that read window, purge the report locally, and leave the create we then
    // send orphaned on the server. Claiming first forces such a delete down the
    // tombstone+enqueue path so the server copy is removed afterward.
    this.inFlight.add(reportId);
    try {
      // Read the CURRENT outbox item AND report as one atomic snapshot. If the op
      // was superseded (e.g. a delete replaced by a re-upsert) since the due-list
      // snapshot, we see the current op here — never the stale one. There are NO
      // awaits between this read resolving and the transport call below, so a
      // concurrent local mutation cannot interleave and make us send a stale op.
      const target = await this.storage.getSyncTarget(reportId);
      if (!target) return;
      const { item, report } = target;
      if (!report) {
        // Orphaned outbox item (report gone) — drop it.
        await this.storage.removeQueueItem(reportId);
        return;
      }
      if (Date.parse(item.nextAttemptAt) > this.now()) return;

      try {
        let authoritative: SyncReport<TData>;
        if (item.op === "delete") {
          const result = await this.transport.deleteReport(report);
          authoritative = result ?? { ...report, syncedAt: report.clientUpdatedAt };
        } else {
          const pushed = await this.transport.pushReport(report);
          authoritative = { ...pushed, syncedAt: pushed.clientUpdatedAt };
        }
        // enqueueId-guarded: if a newer op replaced this exact outbox item while
        // it was in flight, this no-ops and the newer item stays queued for the
        // next pass. Matching on the unique enqueueId (not the timestamp) is
        // immune to same-millisecond collisions between a delete and a re-upsert.
        await this.storage.completeSync(authoritative, item.enqueueId);
        this.online = true;
        this.lastError = null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = item.attempts + 1;
        const delayMs = computeBackoff(attempts, this.backoff, this.rand);
        await this.storage.failQueueItem({
          ...item,
          attempts,
          nextAttemptAt: new Date(this.now() + delayMs).toISOString(),
          lastError: message,
        });
        this.lastError = message;
      }
    } finally {
      this.inFlight.delete(reportId);
    }
  }

  /**
   * Pull authoritative records and adopt them, skipping any report with a
   * pending outbox item (its local edits are newer and must not be clobbered)
   * and any remote that is not strictly newer than the local copy.
   */
  async reconcilePull(): Promise<void> {
    const remote = await this.transport.pullReports();
    const pendingIds = new Set((await this.storage.listQueue()).map((q) => q.reportId));

    const adopt: RemoteAdoption<TData>[] = [];
    for (const record of remote) {
      if (pendingIds.has(record.id)) continue;
      const local = await this.storage.getReport(record.id);
      if (reconcileRemote(local, record) === record) {
        adopt.push({
          record: { ...record, syncedAt: record.clientUpdatedAt },
          expectedLocalClientUpdatedAt: local?.clientUpdatedAt ?? null,
        });
      }
    }
    if (adopt.length > 0) {
      // The adapter re-checks each record atomically (no pending queue item AND
      // local clientUpdatedAt unchanged) so an edit racing this pull is not lost.
      await this.storage.applyRemoteBatch(adopt);
    }
    await this.emitStatus();
  }

  /** Compute and emit the current status snapshot. */
  private async emitStatus(forced?: SyncStatus["state"]): Promise<void> {
    if (!this.onStatus) return;
    const pending = (await this.storage.listQueue()).length;
    let state: SyncStatus["state"];
    if (forced) {
      state = forced;
    } else if (!this.online) {
      state = "offline";
    } else if (pending > 0 && this.lastError) {
      state = "error";
    } else {
      state = "idle";
    }
    this.onStatus({ state, pending, lastError: this.lastError });
  }
}
