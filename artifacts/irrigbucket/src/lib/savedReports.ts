import {
  SystemParams, Plan, SectionDefinition, PivotSection, OperationData,
} from './calculations';
import { db, savedReportToSyncReport } from './syncDb';
import { syncEngine } from './syncEngine';

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
 * All non-deleted saved reports, newest-first. Reads straight from the durable
 * Dexie store (the local-first source of truth behind the SyncEngine).
 */
export async function getSavedReports(): Promise<SavedReport[]> {
  const stored = await db.reports.filter((r) => r.deletedAt === null).toArray();
  // Newest-first by client modification time (ISO strings sort chronologically).
  stored.sort((a, b) => b.clientUpdatedAt.localeCompare(a.clientUpdatedAt));
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
  await syncEngine.enqueueUpsert(savedReportToSyncReport(report));
  return report;
}

export async function getReportById(id: string): Promise<SavedReport | null> {
  const stored = await db.reports.get(id);
  if (!stored || stored.deletedAt !== null) return null;
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
