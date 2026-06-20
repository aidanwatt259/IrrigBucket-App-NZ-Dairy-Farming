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

import type { SavedReport } from '@/context/WizardContext';

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
 * from `EXPO_PUBLIC_DOMAIN` and a bearer-token getter. In Phase 4 the getter
 * always yields `null` (anonymous); Phase 5 replaces it with a real token
 * source. No `credentials: "include"` is used — React Native has no cookie jar,
 * auth is bearer-only.
 */
export function createTransport(): Transport<SavedReport> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    setBaseUrl(`https://${domain}`);
  }
  setAuthTokenGetter(async () => null);

  return {
    async pushReport(report) {
      const envelope = await apiSaveReport(syncToRequest(report));
      return recordToSync(envelope.report);
    },

    async deleteReport(report) {
      await customFetch(`/api/reports/${encodeURIComponent(report.id)}`, {
        method: 'DELETE',
      });
      return null;
    },

    async pullReports() {
      const envelope = await getMyReports();
      return envelope.reports.map(recordToSync);
    },
  };
}
