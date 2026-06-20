import { SyncEngine, type SyncStatus } from '@workspace/sync';
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
    lastStatus = status;
    for (const listener of listeners) listener(status);
  },
});

// ---------------------------------------------------------------------------
// Status fan-out — lets React components subscribe to coarse sync status.
// ---------------------------------------------------------------------------

type StatusListener = (status: SyncStatus) => void;

const listeners = new Set<StatusListener>();
let lastStatus: SyncStatus = { state: 'idle', pending: 0, lastError: null };

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

function handleOnline(): void {
  syncEngine.setOnline(true);
  void syncEngine.reconcilePull().catch(() => {});
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
      await syncEngine.reconcilePull().catch(() => {});
    }
    await syncEngine.drain().catch(() => {});
  })();
}
