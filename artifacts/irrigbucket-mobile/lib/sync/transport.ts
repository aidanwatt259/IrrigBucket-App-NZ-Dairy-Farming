import {
  customFetch,
  getMyReports,
  saveReport as apiSaveReport,
  setAuthTokenGetter,
  setBaseUrl,
} from '@workspace/api-client-react';
import type {
  ReportRecord,
  SaveReportRequest,
  SaveReportRequestReportData,
} from '@workspace/api-client-react';
import type { SyncReport, Transport } from '@workspace/sync';

import { getStoredToken, getTokenEpoch } from '@/lib/auth/token';
import type { SavedReport } from '@/context/WizardContext';

/** Thrown when the auth session changes while a request is in flight. */
class StaleSessionError extends Error {
  constructor() {
    super('Auth session changed during request; result discarded.');
    this.name = 'StaleSessionError';
  }
}

/**
 * Run a transport op behind a session fence: capture the token epoch before the
 * request and re-check it after. If a sign-out (or sign-in) bumped the epoch
 * while the request was in flight, discard the result so a stale completion
 * cannot mutate the outbox under a session the user has already left. The
 * engine treats the throw as a normal failure and re-queues; upserts are
 * idempotent on `id`, so a re-push next sign-in is safe.
 */
async function fenced<T>(op: () => Promise<T>): Promise<T> {
  const epoch = getTokenEpoch();
  const result = await op();
  if (getTokenEpoch() !== epoch) throw new StaleSessionError();
  return result;
}

/** Map an OpenAPI {@link ReportRecord} into the engine's {@link SyncReport}. */
function recordToSync(record: ReportRecord): SyncReport<SavedReport> {
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

/** Map a {@link SyncReport} into the OpenAPI save-report request body. */
function syncToRequest(report: SyncReport<SavedReport>): SaveReportRequest {
  return {
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
}

/**
 * Build the REST {@link Transport} over the api-server.
 *
 * Configures the shared api-client at construction: a remote base URL derived
 * from `EXPO_PUBLIC_DOMAIN` and a bearer-token getter that yields the persisted
 * server session id (sid), or `null` while signed out. No `credentials:
 * "include"` is used — React Native has no cookie jar, auth is bearer-only.
 */
export function createTransport(): Transport<SavedReport> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    setBaseUrl(`https://${domain}`);
  }
  setAuthTokenGetter(async () => getStoredToken());

  return {
    async pushReport(report) {
      return fenced(async () => {
        const envelope = await apiSaveReport(syncToRequest(report));
        return recordToSync(envelope.report);
      });
    },

    async deleteReport(report) {
      return fenced(async () => {
        await customFetch(`/api/reports/${encodeURIComponent(report.id)}`, {
          method: 'DELETE',
        });
        return null;
      });
    },

    async pullReports() {
      return fenced(async () => {
        const envelope = await getMyReports();
        return envelope.reports.map(recordToSync);
      });
    },
  };
}
