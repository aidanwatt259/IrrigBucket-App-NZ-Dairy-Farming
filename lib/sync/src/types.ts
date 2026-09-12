/**
 * Core models and platform-injected interfaces for the offline-first sync core.
 *
 * This package contains NO platform code: no Dexie, no expo-sqlite, no fetch.
 * Web and mobile provide a {@link StorageAdapter} (local persistence) and a
 * {@link Transport} (the api-server REST client); the {@link SyncEngine} drives
 * them. The engine understands only the sync-relevant fields of a record; the
 * domain payload lives in the opaque, generic `reportData`.
 */

/**
 * A locally-stored report record.
 *
 * `TData` is the domain payload shape (the full local SavedReport contents).
 * The sync core never inspects it; web/mobile parameterize it with their own
 * type so the engine stays decoupled from IrrigBucket domain models.
 */
export interface SyncReport<TData = Record<string, unknown>> {
  /** Client-generated UUID. Stable for the record's whole life; the upsert key. */
  id: string;
  /** ISO-8601 time of the last LOCAL modification. Drives Last-Write-Wins. */
  clientUpdatedAt: string;
  /** ISO-8601 tombstone marker; `null` while the record is live. */
  deletedAt: string | null;

  /** Denormalized metadata mirrored to the API's top-level columns. */
  irrigatorType: string | null;
  farmName: string | null;
  assessorName: string | null;
  testDate: string | null;
  duPercent: string | null;
  duStatus: string | null;

  /** Opaque domain payload (the full local report contents). */
  reportData: TData;

  /** Server-assigned owner; `null` while the record is anonymous/unsynced. */
  userId: string | null;
  /** Server timestamps; `null` until the record has been synced at least once. */
  createdAt: string | null;
  updatedAt: string | null;

  /**
   * The `clientUpdatedAt` value the server has confirmed for this record, or
   * `null` if it has never been pushed. Lets the UI distinguish a dirty record
   * (local edits not yet confirmed) from a clean one.
   */
  syncedAt: string | null;
}

/** The kind of pending operation an outbox item represents. */
export type SyncOp = "upsert" | "delete";

/**
 * A pending sync operation (outbox item).
 *
 * The outbox is keyed by `reportId`: at most ONE item exists per report, so a
 * newer enqueue overwrites the previous pending op (coalescing redundant saves
 * and superseding an upsert with a later delete). Each enqueue stamps a fresh
 * unique `enqueueId`; a drain completes/fails an item only if the CURRENT item
 * still carries the same `enqueueId`, so an in-flight round-trip never completes
 * or clobbers a newer op that replaced it mid-flight — even when two ops share
 * the same millisecond timestamp.
 */
export interface SyncQueueItem {
  /** The report this op applies to; the outbox's primary key. */
  reportId: string;
  /**
   * Unique identity of THIS enqueue, regenerated on every (re)enqueue. The
   * drain's completion/failure guards match on it, making them immune to
   * same-millisecond timestamp collisions between superseding ops.
   */
  enqueueId: string;
  op: SyncOp;
  /** The report's `clientUpdatedAt` at enqueue time (informational invariant). */
  opClientUpdatedAt: string;
  /** Number of failed delivery attempts so far. */
  attempts: number;
  /** ISO-8601 earliest time this item may be retried (backoff schedule). */
  nextAttemptAt: string;
  /** ISO-8601 time of the latest enqueue, used for FIFO ordering. */
  enqueuedAt: string;
  /** Last delivery error message, for diagnostics; `null` if never failed. */
  lastError: string | null;
}

/**
 * A consistent snapshot of an outbox item and the report it targets, read in a
 * single transaction by {@link StorageAdapter.getSyncTarget}. `report` may be
 * `null` if the row was deleted out from under the item (an orphan to drop).
 */
export interface SyncTarget<TData = Record<string, unknown>> {
  item: SyncQueueItem;
  report: SyncReport<TData> | null;
}

/**
 * Local persistence, implemented per platform (Dexie on web, expo-sqlite on
 * mobile, in-memory in tests). Methods whose names imply atomicity MUST commit
 * all their writes in a single transaction.
 */
export interface StorageAdapter<TData = Record<string, unknown>> {
  /** Read a single report by id, or `null` if absent. */
  getReport(id: string): Promise<SyncReport<TData> | null>;

  /** All non-deleted reports, for display in the UI. */
  listReports(): Promise<SyncReport<TData>[]>;

  /**
   * ATOMIC: persist `report` AND upsert its outbox `item` (keyed by reportId).
   * Both writes commit together or not at all.
   */
  saveAndEnqueue(report: SyncReport<TData>, item: SyncQueueItem): Promise<void>;

  /** All pending outbox items, ordered by `enqueuedAt` ascending (FIFO). */
  listQueue(): Promise<SyncQueueItem[]>;

  /**
   * ATOMIC: read a report's current outbox item AND the report itself as ONE
   * consistent snapshot (both from the same transaction), or `null` if no outbox
   * item is pending. The engine sends based on this snapshot with no intervening
   * awaits, so a concurrent local mutation cannot make it transmit a stale op.
   */
  getSyncTarget(reportId: string): Promise<SyncTarget<TData> | null>;

  /**
   * ATOMIC, enqueueId-guarded success path: if the outbox item for `report.id`
   * still has `enqueueId === enqueueId`, store `report` (the authoritative
   * record) and remove the outbox item, returning `true`. If the item was
   * superseded by a newer enqueue (different `enqueueId`), do nothing and
   * return `false`.
   */
  completeSync(report: SyncReport<TData>, enqueueId: string): Promise<boolean>;

  /**
   * ATOMIC, enqueueId-guarded failure path: if the outbox item for
   * `item.reportId` still has the same `enqueueId`, overwrite its retry
   * bookkeeping (`attempts`, `nextAttemptAt`, `lastError`) and return `true`.
   * If superseded, do nothing and return `false`.
   */
  failQueueItem(item: SyncQueueItem): Promise<boolean>;

  /** Unconditionally remove an outbox item. Used to drop orphaned items. */
  removeQueueItem(reportId: string): Promise<void>;

  /**
   * ATOMIC: delete a report AND any pending outbox item for it. Used to discard
   * a never-synced report (the server never saw it) without a network round-trip.
   */
  purgeReport(reportId: string): Promise<void>;

  /**
   * ATOMIC, conditionally-applied pull adoption. For each adoption, store
   * `record` ONLY IF there is no pending outbox item for it AND the local
   * record's `clientUpdatedAt` still equals `expectedLocalClientUpdatedAt`
   * (`null` meaning "no local record existed"). This compare-and-swap closes the
   * window between {@link SyncEngine.reconcilePull}'s read and this write: a
   * local edit that lands in between is never clobbered.
   */
  applyRemoteBatch(adoptions: RemoteAdoption<TData>[]): Promise<void>;
}

/** A single conditional adoption produced by {@link SyncEngine.reconcilePull}. */
export interface RemoteAdoption<TData = Record<string, unknown>> {
  /** The authoritative record to store (already stamped with `syncedAt`). */
  record: SyncReport<TData>;
  /**
   * The local `clientUpdatedAt` observed at reconcile time, or `null` if no
   * local record existed. The adapter adopts only if this still matches.
   */
  expectedLocalClientUpdatedAt: string | null;
}

/** Options for an incremental pull. */
export interface PullOptions {
  /** Forward-compatible cursor; the current server ignores it. */
  since?: string;
}

/**
 * The network boundary, implemented per platform over the api-server REST API.
 * Implementations map between {@link SyncReport} and the OpenAPI-generated
 * request/response types, and attach auth.
 */
export interface Transport<TData = Record<string, unknown>> {
  /** `POST /reports` — returns the server's authoritative (LWW-winning) record. */
  pushReport(report: SyncReport<TData>): Promise<SyncReport<TData>>;

  /**
   * `DELETE /reports/:id` — soft-delete. Returns the authoritative tombstoned
   * record when the server supports tombstone LWW, or `null` for the current
   * void-returning endpoint. With a `null`-returning server this is
   * local-delete-sync only: a delete made on one device is NOT propagated to
   * other devices via pull (the server does not list tombstones yet).
   */
  deleteReport(report: SyncReport<TData>): Promise<SyncReport<TData> | null>;

  /** `GET /reports` — authoritative non-deleted records for the signed-in user. */
  pullReports(options?: PullOptions): Promise<SyncReport<TData>[]>;
}

/** Coarse lifecycle state surfaced to the UI. */
export type SyncState = "idle" | "syncing" | "offline" | "error";

/** A snapshot of sync status, emitted to {@link SyncEngineOptions.onStatus}. */
export interface SyncStatus {
  state: SyncState;
  /** Number of outbox items still pending (any retry state). */
  pending: number;
  /** Most recent delivery error message, or `null`. */
  lastError: string | null;
}

/** Exponential-backoff parameters for failed deliveries. */
export interface BackoffOptions {
  /** Delay for the first retry, in milliseconds. */
  baseMs: number;
  /** Multiplier applied per attempt. */
  factor: number;
  /** Maximum delay, in milliseconds (the cap). */
  maxMs: number;
  /** Fractional jitter (0–1) added on top of the computed delay. */
  jitter: number;
}

/** Construction options for {@link SyncEngine}. */
export interface SyncEngineOptions<TData = Record<string, unknown>> {
  storage: StorageAdapter<TData>;
  transport: Transport<TData>;
  /** Injectable clock (epoch ms). Defaults to `Date.now`. */
  now?: () => number;
  /** Injectable RNG in [0,1) for jitter. Defaults to `Math.random`. */
  rand?: () => number;
  /**
   * Injectable factory for an outbox item's unique `enqueueId`. The default
   * combines the clock, a per-engine sequence, and random entropy so ids stay
   * unique even across engine restarts / device clock changes (the durable
   * adapters persist `enqueueId`, so a cross-restart collision would let a stale
   * completion match the wrong item). Tests may inject a deterministic factory.
   */
  genId?: () => string;
  /** Backoff parameters; sensible defaults are applied when omitted. */
  backoff?: Partial<BackoffOptions>;
  /** Status change subscriber. */
  onStatus?: (status: SyncStatus) => void;
  /**
   * When `true` (default), enqueue/`setOnline(true)` trigger a background drain.
   * Tests set `false` to drive draining deterministically.
   */
  autoSync?: boolean;
}
