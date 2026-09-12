/**
 * In-memory test doubles for the sync core. Intentionally NOT exported from the
 * package barrel — tests import them directly. Because JS is single-threaded and
 * these store synchronously, the "atomic" adapter methods are trivially atomic.
 */

import { compareTimestamps } from "./reconcile.js";
import type {
  PullOptions,
  RemoteAdoption,
  StorageAdapter,
  SyncQueueItem,
  SyncReport,
  SyncTarget,
  Transport,
} from "./types.js";

/** A bare {@link SyncReport} with sensible nulls; override fields as needed. */
export function makeReport(
  overrides: Partial<SyncReport> & Pick<SyncReport, "id" | "clientUpdatedAt">,
): SyncReport {
  return {
    deletedAt: null,
    irrigatorType: null,
    farmName: null,
    assessorName: null,
    testDate: null,
    duPercent: null,
    duStatus: null,
    reportData: {},
    userId: null,
    createdAt: null,
    updatedAt: null,
    syncedAt: null,
    ...overrides,
  };
}

let queueSeq = 0;

/** A {@link SyncQueueItem} with a unique `enqueueId`; override fields as needed. */
export function makeQueueItem(
  reportId: string,
  op: SyncQueueItem["op"],
  opClientUpdatedAt: string,
  overrides?: Partial<SyncQueueItem>,
): SyncQueueItem {
  return {
    reportId,
    enqueueId: `${opClientUpdatedAt}#${++queueSeq}`,
    op,
    opClientUpdatedAt,
    attempts: 0,
    enqueuedAt: opClientUpdatedAt,
    nextAttemptAt: opClientUpdatedAt,
    lastError: null,
    ...overrides,
  };
}

/** In-memory {@link StorageAdapter}. */
export class InMemoryStorageAdapter implements StorageAdapter {
  readonly reports = new Map<string, SyncReport>();
  readonly queue = new Map<string, SyncQueueItem>();
  /**
   * Optional hook fired AFTER {@link getSyncTarget} captures its snapshot but
   * before it returns, used by tests to simulate a concurrent mutation (e.g. a
   * delete) committing right after the engine reads the outbox item.
   */
  onGetSyncTarget?: (reportId: string) => void | Promise<void>;

  async getReport(id: string): Promise<SyncReport | null> {
    return this.reports.get(id) ?? null;
  }

  async listReports(): Promise<SyncReport[]> {
    return [...this.reports.values()].filter((r) => !r.deletedAt);
  }

  async saveAndEnqueue(report: SyncReport, item: SyncQueueItem): Promise<void> {
    this.reports.set(report.id, report);
    this.queue.set(item.reportId, item);
  }

  async listQueue(): Promise<SyncQueueItem[]> {
    return [...this.queue.values()].sort(
      (a, b) => Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt),
    );
  }

  async getSyncTarget(reportId: string): Promise<SyncTarget | null> {
    const item = this.queue.get(reportId);
    const snapshot: SyncTarget | null = item
      ? { item, report: this.reports.get(reportId) ?? null }
      : null;
    if (this.onGetSyncTarget) await this.onGetSyncTarget(reportId);
    return snapshot;
  }

  async completeSync(report: SyncReport, enqueueId: string): Promise<boolean> {
    const item = this.queue.get(report.id);
    if (!item || item.enqueueId !== enqueueId) return false;
    this.reports.set(report.id, report);
    this.queue.delete(report.id);
    return true;
  }

  async failQueueItem(item: SyncQueueItem): Promise<boolean> {
    const current = this.queue.get(item.reportId);
    if (!current || current.enqueueId !== item.enqueueId) {
      return false;
    }
    this.queue.set(item.reportId, item);
    return true;
  }

  async removeQueueItem(reportId: string): Promise<void> {
    this.queue.delete(reportId);
  }

  async purgeReport(reportId: string): Promise<void> {
    this.reports.delete(reportId);
    this.queue.delete(reportId);
  }

  async applyRemoteBatch(adoptions: RemoteAdoption[]): Promise<void> {
    for (const { record, expectedLocalClientUpdatedAt } of adoptions) {
      // Skip if a local edit has appeared (pending outbox item) or the local
      // record changed since reconcile decided to adopt — compare-and-swap.
      if (this.queue.has(record.id)) continue;
      const current = this.reports.get(record.id)?.clientUpdatedAt ?? null;
      if (current !== expectedLocalClientUpdatedAt) continue;
      this.reports.set(record.id, record);
    }
  }
}

/**
 * In-memory {@link Transport} simulating the server's LWW store.
 *
 * - `failuresRemaining` makes the next N push/delete calls throw, to exercise
 *   retry/backoff.
 * - `seedServer` pre-loads an authoritative record to exercise server-wins.
 */
export class FakeTransport implements Transport {
  readonly server = new Map<string, SyncReport>();
  readonly pushes: SyncReport[] = [];
  readonly deletes: SyncReport[] = [];
  failuresRemaining = 0;
  failError: Error = new Error("network unavailable");
  /**
   * Optional hook fired at the START of a push (before it resolves), used by
   * tests to simulate a concurrent local mutation landing while the create is
   * in-flight on the wire.
   */
  onPush?: (report: SyncReport) => void | Promise<void>;

  seedServer(report: SyncReport): void {
    this.server.set(report.id, report);
  }

  async pushReport(report: SyncReport): Promise<SyncReport> {
    this.pushes.push(report);
    if (this.onPush) await this.onPush(report);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw this.failError;
    }
    const existing = this.server.get(report.id);
    // Server LWW: keep the existing record unless the incoming is strictly newer.
    if (existing && compareTimestamps(existing.clientUpdatedAt, report.clientUpdatedAt) >= 0) {
      return existing;
    }
    const winner: SyncReport = {
      ...report,
      userId: report.userId ?? "server-user",
      createdAt: existing?.createdAt ?? report.createdAt ?? report.clientUpdatedAt,
      updatedAt: report.clientUpdatedAt,
    };
    this.server.set(report.id, winner);
    return winner;
  }

  async deleteReport(report: SyncReport): Promise<SyncReport | null> {
    this.deletes.push(report);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw this.failError;
    }
    this.server.delete(report.id);
    return null; // mirrors the current void-returning endpoint
  }

  async pullReports(_options?: PullOptions): Promise<SyncReport[]> {
    return [...this.server.values()].filter((r) => !r.deletedAt);
  }
}
