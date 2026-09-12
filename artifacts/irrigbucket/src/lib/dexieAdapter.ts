import type {
  RemoteAdoption,
  StorageAdapter,
  SyncQueueItem,
  SyncReport,
  SyncTarget,
} from '@workspace/sync';
import { db } from './syncDb';
import type { SavedReport } from './savedReports';

/**
 * Dexie-backed {@link StorageAdapter} for the web app. Every method whose name
 * implies atomicity commits all its reads/writes inside a single Dexie `rw`
 * (or `r`) transaction, honouring the CAS / atomicity invariants documented in
 * `@workspace/sync`'s contract.
 */
export const dexieAdapter: StorageAdapter<SavedReport> = {
  async getReport(id) {
    return (await db.reports.get(id)) ?? null;
  },

  async listReports() {
    return db.reports.filter((r) => r.deletedAt === null).toArray();
  },

  async saveAndEnqueue(report, item) {
    await db.transaction('rw', db.reports, db.sync_queue, async () => {
      await db.reports.put(report);
      // The outbox is keyed by reportId (at most one item per report); remove any
      // prior pending op before adding the fresh enqueue (which has a new PK).
      await db.sync_queue.where('reportId').equals(item.reportId).delete();
      await db.sync_queue.put(item);
    });
  },

  async listQueue() {
    const items = await db.sync_queue.toArray();
    // FIFO: ascending by enqueuedAt (ISO-8601 sorts lexicographically == chrono).
    return items.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  },

  async getSyncTarget(reportId) {
    return db.transaction('r', db.reports, db.sync_queue, async () => {
      const item = await db.sync_queue.where('reportId').equals(reportId).first();
      if (!item) return null;
      const report = (await db.reports.get(reportId)) ?? null;
      const target: SyncTarget<SavedReport> = { item, report };
      return target;
    });
  },

  async completeSync(report, enqueueId) {
    return db.transaction('rw', db.reports, db.sync_queue, async () => {
      const current = await db.sync_queue.where('reportId').equals(report.id).first();
      if (!current || current.enqueueId !== enqueueId) return false;
      await db.reports.put(report);
      await db.sync_queue.delete(current.enqueueId);
      return true;
    });
  },

  async failQueueItem(item) {
    return db.transaction('rw', db.sync_queue, async () => {
      const current = await db.sync_queue.where('reportId').equals(item.reportId).first();
      if (!current || current.enqueueId !== item.enqueueId) return false;
      // Same enqueueId == same PK row: overwrite the retry bookkeeping in place.
      await db.sync_queue.put(item);
      return true;
    });
  },

  async removeQueueItem(reportId) {
    await db.sync_queue.where('reportId').equals(reportId).delete();
  },

  async purgeReport(reportId) {
    await db.transaction('rw', db.reports, db.sync_queue, async () => {
      await db.reports.delete(reportId);
      await db.sync_queue.where('reportId').equals(reportId).delete();
    });
  },

  async applyRemoteBatch(adoptions: RemoteAdoption<SavedReport>[]) {
    await db.transaction('rw', db.reports, db.sync_queue, async () => {
      for (const { record, expectedLocalClientUpdatedAt } of adoptions) {
        const pending = await db.sync_queue.where('reportId').equals(record.id).first();
        if (pending) continue;
        const local = await db.reports.get(record.id);
        const localClientUpdatedAt = local?.clientUpdatedAt ?? null;
        if (localClientUpdatedAt !== expectedLocalClientUpdatedAt) continue;
        await db.reports.put(record);
      }
    });
  },
};

export type { SyncQueueItem, SyncReport };
