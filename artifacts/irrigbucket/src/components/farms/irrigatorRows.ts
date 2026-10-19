import { useEffect, useMemo, useState } from 'react';
import type { IrrigatorStatus, LocalFarm, LocalIrrigator, TestSummary } from '@workspace/sync';
import { irrigatorStatus, todayString } from '@workspace/sync';
import { useFarmDirectory } from '@/lib/farmDirectory';
import { getSavedReports, type SavedReport } from '@/lib/savedReports';
import { summarizeReports } from '@/lib/irrigatorStatus';

export interface IrrigatorRow {
  farm: LocalFarm;
  irrigator: LocalIrrigator;
  status: IrrigatorStatus;
}

export const TYPE_NAMES: Record<string, string> = {
  pivot: 'Centre Pivot',
  lateral: 'Lateral Move',
  kline: 'K-Line / Pods',
  gun: 'Travelling Gun',
  solid: 'Solid Set',
  boom: 'Roto Rainer',
};

/** This account's saved reports, loaded once per mount. */
export function useSavedReports(): SavedReport[] {
  const [reports, setReports] = useState<SavedReport[]>([]);
  useEffect(() => {
    let cancelled = false;
    getSavedReports()
      .then((list) => {
        if (!cancelled) setReports(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return reports;
}

export function useTestSummaries(reports: SavedReport[]): TestSummary[] {
  return useMemo(() => summarizeReports(reports), [reports]);
}

/** Sort: overdue first, then due soon, never tested, then by due date. */
export function rowOrder(a: IrrigatorRow, b: IrrigatorRow): number {
  const rank = { overdue: 0, 'due-soon': 1, never: 2, ok: 3 } as const;
  const diff = rank[a.status.state] - rank[b.status.state];
  if (diff !== 0) return diff;
  if (a.status.nextDue && b.status.nextDue && a.status.nextDue !== b.status.nextDue) {
    return a.status.nextDue < b.status.nextDue ? -1 : 1;
  }
  return a.farm.name.localeCompare(b.farm.name) || a.irrigator.name.localeCompare(b.irrigator.name);
}

/** Every live irrigator (optionally at one farm) with its status, most urgent first. */
export function useIrrigatorRows(tests: TestSummary[], farmId?: string): IrrigatorRow[] {
  const snapshot = useFarmDirectory();
  return useMemo(() => {
    const today = todayString();
    const farms = new Map(snapshot.farms.filter((f) => f.deletedAt === null).map((f) => [f.id, f]));
    const rows: IrrigatorRow[] = [];
    for (const irrigator of snapshot.irrigators) {
      if (irrigator.deletedAt !== null || (farmId && irrigator.farmId !== farmId)) continue;
      const farm = farms.get(irrigator.farmId);
      if (!farm) continue;
      rows.push({ farm, irrigator, status: irrigatorStatus(irrigator, tests, today) });
    }
    return rows.sort(rowOrder);
  }, [snapshot, tests, farmId]);
}

export function countNeedingTest(rows: IrrigatorRow[]): number {
  return rows.filter((r) => r.status.state === 'overdue' || r.status.state === 'due-soon').length;
}
