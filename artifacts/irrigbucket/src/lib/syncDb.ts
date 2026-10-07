import Dexie, { type Table } from 'dexie';
import type { FarmDirectorySnapshot, SyncQueueItem, SyncReport } from '@workspace/sync';
import { calculateTestResults } from './calculations';
import { GUEST_ACCOUNT } from './account';
import type { SavedReport } from './savedReports';

/**
 * The locally-stored report record shape used by the Dexie StorageAdapter.
 * `reportData` carries the full domain SavedReport; the surrounding fields are
 * the sync-relevant columns mirrored to the API (see `@workspace/sync`).
 */
export type StoredReport = SyncReport<SavedReport>;

/**
 * Which account a local report belongs to: a user id, or `GUEST_ACCOUNT` for
 * reports created while logged out. Kept outside `reports` because the sync
 * engine replaces report rows wholesale with server records.
 */
export interface ReportOwner {
  reportId: string;
  ownerId: string;
}

/** One account's farms and irrigators (see `FarmDirectory`), keyed by account. */
export interface StoredFarmDirectory {
  scope: string;
  snapshot: FarmDirectorySnapshot;
}

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
 *  - `report_owners` PK `reportId`; index on `ownerId`. See {@link ReportOwner}.
 *  - `farm_directory` PK `scope` (account). See {@link StoredFarmDirectory}.
 */
export class IrrigBucketSyncDb extends Dexie {
  reports!: Table<StoredReport, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  report_owners!: Table<ReportOwner, string>;
  farm_directory!: Table<StoredFarmDirectory, string>;

  constructor() {
    super('irrigbucket_sync');
    this.version(1).stores({
      reports: 'id, deletedAt, clientUpdatedAt',
      sync_queue: 'enqueueId, &reportId, nextAttemptAt',
    });
    // Reports saved before ownership existed: synced ones belong to their
    // server owner; unsynced ones become guest reports, which the next account
    // to sign in adopts.
    this.version(2)
      .stores({ report_owners: 'reportId, ownerId' })
      .upgrade(async (tx) => {
        const reports = await tx.table<StoredReport, string>('reports').toArray();
        await tx.table<ReportOwner, string>('report_owners').bulkPut(
          reports.map((r) => ({ reportId: r.id, ownerId: r.userId ?? GUEST_ACCOUNT })),
        );
      });
    this.version(3).stores({ farm_directory: 'scope' });
  }
}

export const db = new IrrigBucketSyncDb();

export async function getReportOwnerId(reportId: string): Promise<string> {
  const row = await db.report_owners.get(reportId);
  if (row) return row.ownerId;
  const report = await db.reports.get(reportId);
  return report?.userId ?? GUEST_ACCOUNT;
}

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
