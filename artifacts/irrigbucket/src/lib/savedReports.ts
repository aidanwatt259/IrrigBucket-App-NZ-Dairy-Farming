import {
  SystemParams, Plan, SectionDefinition, PivotSection, OperationData,
} from './calculations';
import { db, getReportOwnerId, savedReportToSyncReport } from './syncDb';
import { requestFarmSync, syncEngine } from './syncEngine';
import { farmDirectory } from './farmDirectory';
import { GUEST_ACCOUNT, getCurrentAccount } from './account';

export interface SavedReport {
  id: string;
  savedAt: string;
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan;
  volumes: number[];
  windSpeed: number;
  testDate: string;
  sections: SectionDefinition[];
  operationData: OperationData;
}

/**
 * The current account's non-deleted saved reports, newest-first. Reads straight
 * from the durable Dexie store (the local-first source of truth behind the
 * SyncEngine).
 */
export async function getSavedReports(): Promise<SavedReport[]> {
  const account = await getCurrentAccount();
  const owners = new Map(
    (await db.report_owners.toArray()).map((o) => [o.reportId, o.ownerId]),
  );
  const stored = await db.reports
    .filter(
      (r) =>
        r.deletedAt === null &&
        (owners.get(r.id) ?? r.userId ?? GUEST_ACCOUNT) === account,
    )
    .toArray();
  // Newest-first by save time (ISO strings sort chronologically).
  stored.sort((a, b) => b.reportData.savedAt.localeCompare(a.reportData.savedAt));
  return stored.map((r) => r.reportData);
}

/**
 * Persist a new report locally AND enqueue an upsert with the SyncEngine, which
 * drains it to the server when online. Returns the saved report immediately so
 * the UI stays responsive offline.
 */
export async function saveReport(
  data: Omit<SavedReport, 'id' | 'savedAt'>,
): Promise<SavedReport> {
  // Avoid exact duplicates saved within the same session (same volumes + date).
  const existing = await getSavedReports();
  const duplicate = existing.find(
    (r) => JSON.stringify(r.volumes) === JSON.stringify(data.volumes) &&
            r.testDate === data.testDate,
  );
  if (duplicate) return duplicate;

  const report: SavedReport = {
    ...data,
    // The server's `reports.id` is a UUID column, so the client id (which is
    // now used directly as the upsert key) must be a valid UUID.
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  // Owner first: the enqueue below can start a push immediately.
  await db.report_owners.put({ reportId: report.id, ownerId: await getCurrentAccount() });
  await syncEngine.enqueueUpsert(savedReportToSyncReport(report));

  // Remember the settings this irrigator was tested with, to prefill a re-test.
  const irrigatorId = report.operationData?.irrigatorId;
  if (irrigatorId && farmDirectory.getIrrigator(irrigatorId)) {
    await farmDirectory.updateIrrigator(irrigatorId, { details: { ...report.systemParams } });
    void requestFarmSync();
  }
  return report;
}

export async function getReportById(id: string): Promise<SavedReport | null> {
  const stored = await db.reports.get(id);
  if (!stored || stored.deletedAt !== null) return null;
  if ((await getReportOwnerId(id)) !== (await getCurrentAccount())) return null;
  return stored.reportData;
}

/** Tombstone a report locally and enqueue the delete for the server. */
export async function deleteReport(id: string): Promise<void> {
  await syncEngine.enqueueDelete(id);
}

export function getReportLabel(report: SavedReport): string {
  const year = report.testDate
    ? new Date(report.testDate).getFullYear()
    : new Date(report.savedAt).getFullYear();
  const assessor = report.operationData?.assessorName?.trim() || 'Unknown Assessor';
  return `${year} — ${assessor}`;
}

export function getReportSubLabel(report: SavedReport): string {
  const parts: string[] = [];
  if (report.operationData?.farmName) parts.push(report.operationData.farmName);
  if (report.irrigatorType) parts.push(report.irrigatorType);
  return parts.join(' · ');
}
