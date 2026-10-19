import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Play } from 'lucide-react';
import type { LocalFarm, LocalIrrigator, IrrigatorStatus } from '@workspace/sync';
import { describeDue, formatDate, irrigatorStatus, todayString } from '@workspace/sync';
import { useFarmDirectory } from '@/lib/farmDirectory';
import { getSavedReports } from '@/lib/savedReports';
import { summarizeReports } from '@/lib/irrigatorStatus';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TYPE_NAMES: Record<string, string> = {
  pivot: 'Centre Pivot',
  lateral: 'Lateral Move',
  kline: 'K-Line / Pods',
  gun: 'Travelling Gun',
  solid: 'Solid Set',
  boom: 'Roto Rainer',
};

const DU_CLASSES = {
  good: 'bg-green-100 text-green-800 border-green-200',
  fair: 'bg-amber-100 text-amber-800 border-amber-200',
  poor: 'bg-red-100 text-red-800 border-red-200',
} as const;

const DUE_CLASSES = {
  never: 'text-muted-foreground',
  ok: 'text-muted-foreground',
  'due-soon': 'text-amber-700',
  overdue: 'text-red-700',
} as const;

interface Row {
  farm: LocalFarm;
  irrigator: LocalIrrigator;
  status: IrrigatorStatus;
}

/** Sort: overdue first, then due soon, never tested, then by due date. */
function rowOrder(a: Row, b: Row): number {
  const rank = { overdue: 0, 'due-soon': 1, never: 2, ok: 3 } as const;
  const diff = rank[a.status.state] - rank[b.status.state];
  if (diff !== 0) return diff;
  if (a.status.nextDue && b.status.nextDue && a.status.nextDue !== b.status.nextDue) {
    return a.status.nextDue < b.status.nextDue ? -1 : 1;
  }
  return a.farm.name.localeCompare(b.farm.name) || a.irrigator.name.localeCompare(b.irrigator.name);
}

/** The farmer's home dashboard: every saved irrigator, its last result and next test. */
export function MyIrrigators() {
  const [, setLocation] = useLocation();
  const startRetest = useAppStore((state) => state.startRetest);
  const snapshot = useFarmDirectory();
  const [tests, setTests] = useState<ReturnType<typeof summarizeReports>>([]);

  useEffect(() => {
    let cancelled = false;
    getSavedReports()
      .then((reports) => {
        if (!cancelled) setTests(summarizeReports(reports));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const today = todayString();
    const farms = new Map(snapshot.farms.filter((f) => f.deletedAt === null).map((f) => [f.id, f]));
    const list: Row[] = [];
    for (const irrigator of snapshot.irrigators) {
      const farm = farms.get(irrigator.farmId);
      if (!farm || irrigator.deletedAt !== null) continue;
      list.push({ farm, irrigator, status: irrigatorStatus(irrigator, tests, today) });
    }
    return list.sort(rowOrder);
  }, [snapshot, tests]);

  if (rows.length === 0) return null;

  const needingTest = rows.filter((r) => r.status.state === 'overdue' || r.status.state === 'due-soon').length;
  const showFarmNames = new Set(rows.map((r) => r.farm.id)).size > 1;

  const handleTest = ({ farm, irrigator }: Row) => {
    startRetest({
      irrigatorType: irrigator.type,
      details: irrigator.details,
      farmId: farm.id,
      farmName: farm.name,
      irrigatorId: irrigator.id,
      irrigatorName: irrigator.name,
    });
    setLocation('/setup');
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16" aria-labelledby="my-irrigators">
      <h2 id="my-irrigators" className="text-2xl font-display font-bold text-center mb-2">
        My irrigators
      </h2>
      <p className="text-muted-foreground text-center mb-8">
        {needingTest === 0
          ? 'All up to date. Tap one to run its next test.'
          : needingTest === 1
            ? '1 irrigator is due for a bucket test.'
            : `${needingTest} irrigators are due for a bucket test.`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((row) => {
          const { irrigator, farm, status } = row;
          const last = status.lastTest;
          const DueIcon = status.state === 'overdue' ? AlertTriangle : status.state === 'ok' ? CheckCircle2 : CalendarClock;
          return (
            <Card key={irrigator.id} className="p-5 flex flex-col gap-4 text-left" data-testid={`irrigator-${irrigator.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold font-display truncate">{irrigator.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {showFarmNames ? `${farm.name} · ` : ''}
                    {TYPE_NAMES[irrigator.type] ?? irrigator.type}
                  </p>
                </div>
                {last?.du != null && last.duStatus ? (
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DU_CLASSES[last.duStatus]}`}
                    title="Distribution uniformity from the last test"
                  >
                    DU {Math.round(last.du * 100)}%
                  </span>
                ) : null}
              </div>

              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  {last ? `Last tested ${formatDate(last.testDate)}` : 'No test recorded yet'}
                </p>
                <p className={`flex items-center gap-1.5 font-medium ${DUE_CLASSES[status.state]}`}>
                  <DueIcon className="w-4 h-4 shrink-0" />
                  {status.state === 'never' ? 'Run its first test' : describeDue(status)}
                </p>
              </div>

              <div className="flex gap-2 mt-auto">
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => handleTest(row)}
                  aria-label={`Test ${irrigator.name} now`}
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Test now
                </Button>
                {last && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/reports/${last.reportId}`)}
                    aria-label={`Open the last report for ${irrigator.name}`}
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Last report
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
