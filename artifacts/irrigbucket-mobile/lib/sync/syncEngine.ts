import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';

import { SyncEngine } from '@workspace/sync';
import type { SyncReport, SyncStatus } from '@workspace/sync';

import { calculateTestResults } from '@/lib/calculations';
import type { SavedReport } from '@/context/WizardContext';

import { createSqliteAdapter } from './sqliteAdapter';
import type { SqliteAdapter } from './sqliteAdapter';
import { createTransport } from './transport';

const LEGACY_WIZARD_KEY = 'irrigbucket_wizard_state';
const MIGRATED_FLAG = 'irrigbucket_sqlite_migrated';

let engine: SyncEngine<SavedReport> | null = null;
let adapter: SqliteAdapter<SavedReport> | null = null;
let initPromise: Promise<void> | null = null;

let currentStatus: SyncStatus = { state: 'offline', pending: 0, lastError: null };
const statusListeners = new Set<(status: SyncStatus) => void>();
const reportsChangedListeners = new Set<() => void>();

/**
 * Whether an authenticated session is active. While false the engine is held
 * offline regardless of connectivity, so the outbox accumulates locally.
 */
let authed = false;
/** Latest known connectivity, so an auth change can re-derive the online state. */
let lastConnected = false;

/** Whether an authenticated session is currently active. */
export function isAuthed(): boolean {
  return authed;
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
  // A status change frequently coincides with the local report set changing
  // (a push completed, a pull adopted rows); nudge subscribers to re-read.
  notifyReportsChanged();
}

function notifyReportsChanged(): void {
  reportsChangedListeners.forEach((listener) => listener());
}

/**
 * Subscribe to "the local report set may have changed" notifications (emitted
 * after syncs, pulls, and rekeys). Returns an unsubscribe function.
 */
export function subscribeReportsChanged(listener: () => void): () => void {
  reportsChangedListeners.add(listener);
  return () => {
    reportsChangedListeners.delete(listener);
  };
}

/** Push the derived online state (connectivity AND auth) into the engine. */
function applyOnline(): void {
  if (!engine) return;
  engine.setOnline(lastConnected && authed);
}

/** Pull authoritative server state when both connected and authed. */
async function pullIfPossible(): Promise<void> {
  if (!engine || !authed || !lastConnected) return;
  try {
    await engine.reconcilePull();
    notifyReportsChanged();
  } catch {
    // Pull failures surface via status events; the next online edge retries.
  }
}

/** React to a connectivity change, pulling on a fresh offline→online edge. */
function handleConnectivity(connected: boolean): void {
  const wasConnected = lastConnected;
  lastConnected = connected;
  applyOnline();
  if (connected && !wasConnected && authed) {
    void pullIfPossible();
  }
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

      // Connectivity is tracked always; it only drives draining once authed.
      NetInfo.addEventListener((state) => {
        handleConnectivity(state.isConnected ?? false);
      });
      const initial = await NetInfo.fetch();
      handleConnectivity(initial.isConnected ?? false);
    })();
  }
  return initPromise;
}

async function ensureReady(): Promise<void> {
  await initSync();
}

/**
 * Promote the engine to an authenticated, syncing state. Rekeys any anonymous
 * local reports to server-valid UUIDs FIRST (while still gated offline), then
 * applies connectivity to drain the outbox and pulls the account's
 * authoritative reports. Safe to call repeatedly.
 */
export async function enableSync(): Promise<void> {
  await ensureReady();
  // Rekey FIRST, while still gated offline (authed=false), so a rekey failure
  // can't leave the engine half-enabled and draining non-UUID ids. Only flip
  // authed once anonymous ids are server-valid UUIDs.
  await adapter!.rekeyAnonymousIds(() => Crypto.randomUUID());
  authed = true;
  notifyReportsChanged();
  applyOnline();
  await pullIfPossible();
}

/**
 * Drop back to local-only: stop draining and pulling but KEEP all local data
 * and the outbox intact. Used on sign-out.
 */
export async function disableSync(): Promise<void> {
  await ensureReady();
  authed = false;
  applyOnline();
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
