import Dexie, { type Table } from 'dexie';
import type { SyncQueueItem, SyncReport } from '@workspace/sync';
import { calculateTestResults } from './calculations';
import type { SavedReport } from './savedReports';

/**
 * The locally-stored report record shape used by the Dexie StorageAdapter.
 * `reportData` carries the full domain SavedReport; the surrounding fields are
 * the sync-relevant columns mirrored to the API (see `@workspace/sync`).
 */
export type StoredReport = SyncReport<SavedReport>;

/**
 * Dexie database backing the offline-first SyncEngine for the web app.
 *
 *  - `reports`     PK `id` (client-generated UUID); indexes on `deletedAt`,
 *                  `clientUpdatedAt`. The durable StorageAdapter persistence.
 *  - `sync_queue`  PK `enqueueId`; `reportId` is a UNIQUE index so at most ONE
 *                  pending outbox item exists per report (the contract's
 *                  "outbox keyed by reportId"); `nextAttemptAt` index for the
 *                  retry schedule. (SyncQueueItem has no `status`/`in_flight`
 *                  field — `inFlight` is tracked in-memory by the engine — so
 *                  those are intentionally not persisted/indexed.)
 */
export class IrrigBucketSyncDb extends Dexie {
  reports!: Table<StoredReport, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor() {
    super('irrigbucket_sync');
    this.version(1).stores({
      reports: 'id, deletedAt, clientUpdatedAt',
      sync_queue: 'enqueueId, &reportId, nextAttemptAt',
    });
  }
}

export const db = new IrrigBucketSyncDb();

/**
 * Map a domain SavedReport into a SyncReport<SavedReport> for local storage and
 * sync. The denormalized columns mirror exactly what the POST /reports body
 * sent today: DU is computed with `calculateTestResults` using the report's
 * stored inputs, identical to `Results.tsx`.
 */
export function savedReportToSyncReport(saved: SavedReport): StoredReport {
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
