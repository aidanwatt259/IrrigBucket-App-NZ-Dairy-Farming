import {
  SystemParams, Plan, SectionDefinition, PivotSection, OperationData,
} from './calculations';

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

const STORAGE_KEY = 'irrigbucket_saved_reports';

export function getSavedReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveReport(
  data: Omit<SavedReport, 'id' | 'savedAt'>,
): SavedReport {
  const reports = getSavedReports();
  const report: SavedReport = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  // Avoid exact duplicates saved within the same session (same volumes array)
  const isDuplicate = reports.some(
    (r) => JSON.stringify(r.volumes) === JSON.stringify(data.volumes) &&
            r.testDate === data.testDate,
  );
  if (isDuplicate) return reports[0];
  reports.unshift(report);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  return report;
}

export function getReportById(id: string): SavedReport | null {
  return getSavedReports().find((r) => r.id === id) ?? null;
}

export function deleteReport(id: string): void {
  const reports = getSavedReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
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
