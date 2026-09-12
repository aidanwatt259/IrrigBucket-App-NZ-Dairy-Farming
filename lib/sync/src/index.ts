/**
 * `@workspace/sync` — platform-agnostic offline-first sync core.
 *
 * Public surface: the data models and injected interfaces, the pure
 * reconciliation helpers, and the {@link SyncEngine} orchestrator. Test doubles
 * live in `./testHelpers` and are intentionally NOT re-exported here.
 */

export type {
  BackoffOptions,
  PullOptions,
  RemoteAdoption,
  StorageAdapter,
  SyncEngineOptions,
  SyncOp,
  SyncQueueItem,
  SyncReport,
  SyncState,
  SyncStatus,
  SyncTarget,
  Transport,
} from "./types.js";

export {
  compareTimestamps,
  computeBackoff,
  DEFAULT_BACKOFF,
  reconcileRemote,
} from "./reconcile.js";

export { SyncEngine } from "./engine.js";
