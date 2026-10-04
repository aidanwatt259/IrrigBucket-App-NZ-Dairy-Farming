import {
  saveReport as apiSaveReport,
  getMyReports,
  customFetch,
  type ReportRecord,
  type SaveReportRequest,
  type SaveReportRequestReportData,
} from '@workspace/api-client-react';
import type { PullOptions, SyncReport, Transport } from '@workspace/sync';
import type { SavedReport } from './savedReports';
import { getCurrentAccount } from './account';
import { getReportOwnerId } from './syncDb';

/**
 * The server files a new report under whoever is signed in, so a report must
 * only be sent while its own account is active. The failed attempt stays queued
 * and is retried once that account signs back in.
 */
async function assertOwnedByCurrentAccount(reportId: string): Promise<void> {
  const [owner, current] = await Promise.all([
    getReportOwnerId(reportId),
    getCurrentAccount(),
  ]);
  if (owner !== current) {
    throw new Error('Waiting for the account that saved this report to sign in');
  }
}

/**
 * Map a server {@link ReportRecord} into the engine's {@link SyncReport}. The
 * server's `clientUpdatedAt` may be null for legacy rows, so fall back to
 * `updatedAt`/`createdAt` to keep the LWW timestamp non-null.
 */
function recordToSyncReport(record: ReportRecord): SyncReport<SavedReport> {
  return {
    id: record.id,
    clientUpdatedAt: record.clientUpdatedAt ?? record.updatedAt ?? record.createdAt,
    deletedAt: record.deletedAt ?? null,
    irrigatorType: record.irrigatorType ?? null,
    farmName: record.farmName ?? null,
    assessorName: record.assessorName ?? null,
    testDate: record.testDate ?? null,
    duPercent: record.duPercent ?? null,
    duStatus: record.duStatus ?? null,
    reportData: record.reportData as unknown as SavedReport,
    userId: record.userId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
    syncedAt: record.clientUpdatedAt ?? null,
  };
}

/**
 * Web {@link Transport} over the api-server REST API. ALL server I/O goes
 * through the OpenAPI-generated client (`@workspace/api-client-react`); the
 * cookie session is carried with `credentials: 'include'`.
 */
export const transport: Transport<SavedReport> = {
  async pushReport(report) {
    await assertOwnedByCurrentAccount(report.id);
    const body: SaveReportRequest = {
      id: report.id,
      clientUpdatedAt: report.clientUpdatedAt,
      irrigatorType: report.irrigatorType,
      farmName: report.farmName,
      assessorName: report.assessorName,
      testDate: report.testDate,
      duPercent: report.duPercent,
      duStatus: report.duStatus,
      reportData: report.reportData as unknown as SaveReportRequestReportData,
    };
    const envelope = await apiSaveReport(body, { credentials: 'include' });
    return recordToSyncReport(envelope.report);
  },

  async deleteReport(report) {
    await assertOwnedByCurrentAccount(report.id);
    await customFetch(`/api/reports/${encodeURIComponent(report.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    // The current endpoint returns `{ success: true }` (no authoritative
    // tombstone), so signal local-delete-sync only.
    return null;
  },

  async pullReports(_options?: PullOptions) {
    const envelope = await getMyReports({ credentials: 'include' });
    return envelope.reports.map(recordToSyncReport);
  },
};
