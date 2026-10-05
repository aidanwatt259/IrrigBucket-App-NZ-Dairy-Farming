import { SyncEngine, type SyncStatus } from '@workspace/sync';
import {
  isTransientApiError,
  isServerWakingError,
} from '@workspace/api-client-react';
import { db, savedReportToSyncReport } from './syncDb';
import { dexieAdapter } from './dexieAdapter';
import { transport } from './transport';
import type { SavedReport } from './savedReports';

/**
 * The singleton {@link SyncEngine} wiring the Dexie {@link dexieAdapter} to the
 * REST {@link transport}. This is the durable, local-first store behind the
 * web app's saved reports.
 */
export const syncEngine = new SyncEngine<SavedReport>({
  storage: dexieAdapter,
  transport,
  genId: () => crypto.randomUUID(),
  onStatus: (status) => {
    // A successful round-trip (clean status with no error) means the server is
    // awake again; clear the "starting up" hint automatically.
    if (status.lastError === null && status.state !== 'error') {
      serverWaking = false;
    }
    publishStatus(status);
  },
});

// ---------------------------------------------------------------------------
// Status fan-out — lets React components subscribe to coarse sync status.
// ---------------------------------------------------------------------------

type StatusListener = (status: SyncStatus) => void;

const listeners = new Set<StatusListener>();
let lastStatus: SyncStatus = { state: 'idle', pending: 0, lastError: null };

/**
 * True while the server keeps answering "still starting up" (503 DB_NOT_READY)
 * and we are quietly retrying. Stamped onto every status fanned out so the UI
 * can show a friendly hint instead of a generic error; cleared once a pull or
 * push succeeds.
 */
let serverWaking = false;

function publishStatus(status: SyncStatus): void {
  lastStatus = { ...status, serverWaking };
  for (const listener of listeners) listener(lastStatus);
}

function setServerWaking(waking: boolean): void {
  if (serverWaking === waking) return;
  serverWaking = waking;
  publishStatus(lastStatus);
}

export function getSyncStatus(): SyncStatus {
  return lastStatus;
}

/** Subscribe to sync status changes; immediately fires with the latest value. */
export function subscribeSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(lastStatus);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// One-time localStorage → Dexie migration.
// ---------------------------------------------------------------------------

const MIGRATION_FLAG = 'irrigbucket_dexie_migrated';
const LEGACY_STORAGE_KEY = 'irrigbucket_saved_reports';

async function runMigration(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    const existingCount = await db.reports.count();
    if (raw && existingCount === 0) {
      const legacy = JSON.parse(raw) as SavedReport[];
      if (Array.isArray(legacy)) {
        for (const saved of legacy) {
          if (!saved || typeof saved.id !== 'string') continue;
          // Import into Dexie AND enqueue an upsert so it syncs when online.
          await syncEngine.enqueueUpsert(savedReportToSyncReport(saved));
        }
      }
    }
    // Mark migrated even when there was nothing to import; keep the old key as
    // a backup (we never delete it).
    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // Best-effort: never block startup on a migration failure.
  }
}

// ---------------------------------------------------------------------------
// Connectivity wiring + startup.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pull retry — a 503 (e.g. DB_NOT_READY while the server's database is still
// waking up) is transient, so retry the pull with capped backoff instead of
// silently giving up until the next online edge.
// ---------------------------------------------------------------------------

const PULL_MAX_ATTEMPTS = 6;
const PULL_BASE_BACKOFF_MS = 2000;
const PULL_MAX_BACKOFF_MS = 30_000;

let pullInFlight = false;

async function pullWithRetry(): Promise<void> {
  if (pullInFlight) return;
  pullInFlight = true;
  try {
    for (let attempt = 1; attempt <= PULL_MAX_ATTEMPTS; attempt++) {
      try {
        await syncEngine.reconcilePull();
        setServerWaking(false);
        // A successful pull may unblock queued pushes too.
        void syncEngine.drain().catch(() => {});
        return;
      } catch (err) {
        if (isServerWakingError(err)) {
          // The server said "still starting up" — surface a friendly hint
          // while we keep retrying in the background.
          setServerWaking(true);
        }
        const retryable =
          isTransientApiError(err) && attempt < PULL_MAX_ATTEMPTS;
        if (!retryable) return; // Non-transient or exhausted: next online edge retries.
        const backoffMs = Math.min(
          PULL_BASE_BACKOFF_MS * 2 ** (attempt - 1),
          PULL_MAX_BACKOFF_MS,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      }
    }
  } finally {
    pullInFlight = false;
  }
}

function handleOnline(): void {
  syncEngine.setOnline(true);
  void pullWithRetry();
}

function handleOffline(): void {
  syncEngine.setOnline(false);
}

let initialized = false;

/**
 * Initialise the engine once: wire `navigator.onLine` connectivity, run the
 * one-time migration, then drain the outbox and reconcile a pull. Idempotent.
 */
export function initSyncEngine(): void {
  if (initialized) return;
  initialized = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  void (async () => {
    syncEngine.setOnline(
      typeof navigator !== 'undefined' ? navigator.onLine : true,
    );
    await runMigration();
    if (typeof navigator === 'undefined' || navigator.onLine) {
      await pullWithRetry();
    }
    await syncEngine.drain().catch(() => {});
  })();
}
