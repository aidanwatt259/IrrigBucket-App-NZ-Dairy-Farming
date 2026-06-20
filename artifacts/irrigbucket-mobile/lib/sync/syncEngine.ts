import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { SyncEngine } from '@workspace/sync';
import type { StorageAdapter, SyncReport, SyncStatus } from '@workspace/sync';

import { calculateTestResults } from '@/lib/calculations';
import type { SavedReport } from '@/context/WizardContext';

import { createSqliteAdapter } from './sqliteAdapter';
import { createTransport } from './transport';

const LEGACY_WIZARD_KEY = 'irrigbucket_wizard_state';
const MIGRATED_FLAG = 'irrigbucket_sqlite_migrated';

let engine: SyncEngine<SavedReport> | null = null;
let adapter: StorageAdapter<SavedReport> | null = null;
let initPromise: Promise<void> | null = null;

let currentStatus: SyncStatus = { state: 'offline', pending: 0, lastError: null };
const statusListeners = new Set<(status: SyncStatus) => void>();

/**
 * Whether the app has an authenticated session that may sync to the server.
 *
 * Phase 4 is intentionally ANONYMOUS: this stub always returns `false`, so the
 * engine is held permanently offline and the outbox accumulates locally without
 * ever hitting the network. Phase 5 replaces this with a real secure-store
 * token check and lets connectivity drive draining.
 */
export function isAuthed(): boolean {
  return false;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Translate a domain {@link SavedReport} into the engine's {@link SyncReport}. */
function mapSavedToSync(saved: SavedReport): SyncReport<SavedReport> {
  const results = calculateTestResults(
    saved.volumes,
    saved.systemParams.diameter,
    saved.systemParams.targetDepth,
    saved.sections,
  );
  return {
    id: saved.id,
    clientUpdatedAt: saved.savedAt,
    deletedAt: null,
    irrigatorType: saved.irrigatorType ?? null,
    farmName: saved.operationData?.farmName ?? null,
    assessorName: saved.operationData?.assessorName ?? null,
    testDate: saved.testDate || null,
    duPercent: results ? (results.du * 100).toFixed(1) : null,
    duStatus: results ? results.duStatus : null,
    reportData: saved,
    userId: null,
    createdAt: null,
    updatedAt: null,
    syncedAt: null,
  };
}

function emit(status: SyncStatus): void {
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

/** Apply connectivity to the engine, gated by {@link isAuthed}. */
function applyOnline(connected: boolean): void {
  if (!engine) return;
  engine.setOnline(connected && isAuthed());
}

/**
 * One-time migration of the legacy AsyncStorage JSON blob into the durable
 * store. Each saved report is enqueued as an upsert (it stays queued because
 * sync is gated off). The old blob is intentionally left in place as a backup;
 * a flag prevents re-running the migration.
 */
async function runMigration(): Promise<void> {
  if (!engine || !adapter) return;
  const done = await AsyncStorage.getItem(MIGRATED_FLAG);
  if (done === '1') return;

  const raw = await AsyncStorage.getItem(LEGACY_WIZARD_KEY);
  if (raw) {
    let reports: SavedReport[] = [];
    try {
      const parsed = JSON.parse(raw) as { savedReports?: SavedReport[] };
      reports = parsed.savedReports ?? [];
    } catch {
      // Corrupt legacy blob: nothing to import (it is kept as a backup anyway).
      reports = [];
    }
    for (const saved of reports) {
      if (!saved || !saved.id) continue;
      try {
        const existing = await adapter.getReport(saved.id);
        if (existing) continue;
        await engine.enqueueUpsert(mapSavedToSync(saved));
      } catch {
        // Skip a single failed/malformed report; import the remaining ones.
      }
    }
  }
  // Mark migrated only after a full pass completes; a throw before this point
  // (e.g. AsyncStorage failure) leaves the flag unset so it retries next launch.
  await AsyncStorage.setItem(MIGRATED_FLAG, '1');
}

/**
 * Initialize the local store, sync engine, and connectivity wiring exactly
 * once. Safe to call repeatedly (subsequent calls await the same promise).
 */
export function initSync(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      adapter = await createSqliteAdapter<SavedReport>();
      const transport = createTransport();
      engine = new SyncEngine<SavedReport>({
        storage: adapter,
        transport,
        genId,
        onStatus: emit,
      });
      // The engine defaults to online; force it offline BEFORE migration so the
      // migration's enqueues never trigger a network drain in this anonymous
      // phase.
      engine.setOnline(false);

      await runMigration();

      // Connectivity drives draining only when authed (never in Phase 4).
      NetInfo.addEventListener((state) => {
        applyOnline(state.isConnected ?? false);
      });
      const initial = await NetInfo.fetch();
      applyOnline(initial.isConnected ?? false);
    })();
  }
  return initPromise;
}

async function ensureReady(): Promise<void> {
  await initSync();
}

/** Persist + enqueue a saved report through the engine. */
export async function saveReport(saved: SavedReport): Promise<void> {
  await ensureReady();
  await engine!.enqueueUpsert(mapSavedToSync(saved));
}

/** Tombstone + enqueue a delete (or purge if never synced) through the engine. */
export async function deleteReport(id: string): Promise<void> {
  await ensureReady();
  await engine!.enqueueDelete(id);
}

/** List the locally-stored reports, newest first, as domain SavedReports. */
export async function listSavedReports(): Promise<SavedReport[]> {
  await ensureReady();
  const reports = await adapter!.listReports();
  return reports
    .map((r) => r.reportData)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

/** Subscribe to sync status changes; returns an unsubscribe function. */
export function subscribeStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** The latest known sync status. */
export function getStatus(): SyncStatus {
  return currentStatus;
}
