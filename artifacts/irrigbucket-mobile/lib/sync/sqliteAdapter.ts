import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  RemoteAdoption,
  StorageAdapter,
  SyncOp,
  SyncQueueItem,
  SyncReport,
  SyncTarget,
} from '@workspace/sync';

import { getDb } from './sqliteDb';

interface ReportRow {
  id: string;
  client_updated_at: string;
  deleted_at: string | null;
  irrigator_type: string | null;
  farm_name: string | null;
  assessor_name: string | null;
  test_date: string | null;
  du_percent: string | null;
  du_status: string | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  synced_at: string | null;
  report_data: string;
}

interface QueueRow {
  enqueue_id: string;
  report_id: string;
  op: string;
  op_client_updated_at: string;
  attempts: number;
  next_attempt_at: string;
  enqueued_at: string;
  last_error: string | null;
}

function rowToReport<TData>(row: ReportRow): SyncReport<TData> {
  return {
    id: row.id,
    clientUpdatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    irrigatorType: row.irrigator_type,
    farmName: row.farm_name,
    assessorName: row.assessor_name,
    testDate: row.test_date,
    duPercent: row.du_percent,
    duStatus: row.du_status,
    reportData: JSON.parse(row.report_data) as TData,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

function rowToQueueItem(row: QueueRow): SyncQueueItem {
  return {
    reportId: row.report_id,
    enqueueId: row.enqueue_id,
    op: row.op as SyncOp,
    opClientUpdatedAt: row.op_client_updated_at,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    enqueuedAt: row.enqueued_at,
    lastError: row.last_error,
  };
}

async function upsertReport<TData>(
  db: SQLiteDatabase,
  report: SyncReport<TData>,
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO reports
       (id, client_updated_at, deleted_at, irrigator_type, farm_name, assessor_name,
        test_date, du_percent, du_status, user_id, created_at, updated_at, synced_at, report_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    report.id,
    report.clientUpdatedAt,
    report.deletedAt,
    report.irrigatorType,
    report.farmName,
    report.assessorName,
    report.testDate,
    report.duPercent,
    report.duStatus,
    report.userId,
    report.createdAt,
    report.updatedAt,
    report.syncedAt,
    JSON.stringify(report.reportData),
  );
}

async function insertQueueItem(db: SQLiteDatabase, item: SyncQueueItem): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue
       (enqueue_id, report_id, op, op_client_updated_at, attempts, next_attempt_at, enqueued_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    item.enqueueId,
    item.reportId,
    item.op,
    item.opClientUpdatedAt,
    item.attempts,
    item.nextAttemptAt,
    item.enqueuedAt,
    item.lastError,
  );
}

/**
 * Build the expo-sqlite-backed {@link StorageAdapter}.
 *
 * Atomicity & CAS contract: every method that must commit multiple writes
 * together is wrapped in `withTransactionAsync`, and ALL methods are funnelled
 * through a JS-level serial mutex (`serial`). Because expo-sqlite's
 * `withTransactionAsync` is non-exclusive (and `withExclusiveTransactionAsync`
 * is unsupported on web), the mutex is what guarantees a read-modify-write
 * (e.g. the enqueueId-guarded `completeSync`/`failQueueItem`, the
 * `getSyncTarget` snapshot, and the `applyRemoteBatch` compare-and-swap) runs
 * with no other adapter operation interleaving — making the transactions behave
 * as if exclusive across both platforms.
 */
export async function createSqliteAdapter<TData = Record<string, unknown>>(): Promise<
  StorageAdapter<TData>
> {
  const db = await getDb();

  // Serial mutex: chain every operation so at most one runs at a time.
  let chain: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    getReport(id) {
      return serial(async () => {
        const row = await db.getFirstAsync<ReportRow>(
          'SELECT * FROM reports WHERE id = ?',
          id,
        );
        return row ? rowToReport<TData>(row) : null;
      });
    },

    listReports() {
      return serial(async () => {
        const rows = await db.getAllAsync<ReportRow>(
          'SELECT * FROM reports WHERE deleted_at IS NULL ORDER BY client_updated_at DESC',
        );
        return rows.map((r) => rowToReport<TData>(r));
      });
    },

    saveAndEnqueue(report, item) {
      return serial(async () => {
        await db.withTransactionAsync(async () => {
          await upsertReport(db, report);
          await db.runAsync('DELETE FROM sync_queue WHERE report_id = ?', item.reportId);
          await insertQueueItem(db, item);
        });
      });
    },

    listQueue() {
      return serial(async () => {
        const rows = await db.getAllAsync<QueueRow>(
          'SELECT * FROM sync_queue ORDER BY enqueued_at ASC',
        );
        return rows.map(rowToQueueItem);
      });
    },

    getSyncTarget(reportId) {
      return serial(async () => {
        let result: SyncTarget<TData> | null = null;
        await db.withTransactionAsync(async () => {
          const itemRow = await db.getFirstAsync<QueueRow>(
            'SELECT * FROM sync_queue WHERE report_id = ?',
            reportId,
          );
          if (!itemRow) {
            result = null;
            return;
          }
          const reportRow = await db.getFirstAsync<ReportRow>(
            'SELECT * FROM reports WHERE id = ?',
            reportId,
          );
          result = {
            item: rowToQueueItem(itemRow),
            report: reportRow ? rowToReport<TData>(reportRow) : null,
          };
        });
        return result;
      });
    },

    completeSync(report, enqueueId) {
      return serial(async () => {
        let committed = false;
        await db.withTransactionAsync(async () => {
          const itemRow = await db.getFirstAsync<{ enqueue_id: string }>(
            'SELECT enqueue_id FROM sync_queue WHERE report_id = ?',
            report.id,
          );
          if (!itemRow || itemRow.enqueue_id !== enqueueId) return;
          await upsertReport(db, report);
          await db.runAsync('DELETE FROM sync_queue WHERE report_id = ?', report.id);
          committed = true;
        });
        return committed;
      });
    },

    failQueueItem(item) {
      return serial(async () => {
        let updated = false;
        await db.withTransactionAsync(async () => {
          const itemRow = await db.getFirstAsync<{ enqueue_id: string }>(
            'SELECT enqueue_id FROM sync_queue WHERE report_id = ?',
            item.reportId,
          );
          if (!itemRow || itemRow.enqueue_id !== item.enqueueId) return;
          await db.runAsync(
            'UPDATE sync_queue SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE report_id = ?',
            item.attempts,
            item.nextAttemptAt,
            item.lastError,
            item.reportId,
          );
          updated = true;
        });
        return updated;
      });
    },

    removeQueueItem(reportId) {
      return serial(async () => {
        await db.runAsync('DELETE FROM sync_queue WHERE report_id = ?', reportId);
      });
    },

    purgeReport(reportId) {
      return serial(async () => {
        await db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM reports WHERE id = ?', reportId);
          await db.runAsync('DELETE FROM sync_queue WHERE report_id = ?', reportId);
        });
      });
    },

    applyRemoteBatch(adoptions: RemoteAdoption<TData>[]) {
      return serial(async () => {
        await db.withTransactionAsync(async () => {
          for (const { record, expectedLocalClientUpdatedAt } of adoptions) {
            const pending = await db.getFirstAsync<{ c: number }>(
              'SELECT COUNT(*) AS c FROM sync_queue WHERE report_id = ?',
              record.id,
            );
            if (pending && pending.c > 0) continue;
            const local = await db.getFirstAsync<{ client_updated_at: string }>(
              'SELECT client_updated_at FROM reports WHERE id = ?',
              record.id,
            );
            const localCU = local?.client_updated_at ?? null;
            if (localCU !== expectedLocalClientUpdatedAt) continue;
            await upsertReport(db, record);
          }
        });
      });
    },
  };
}
