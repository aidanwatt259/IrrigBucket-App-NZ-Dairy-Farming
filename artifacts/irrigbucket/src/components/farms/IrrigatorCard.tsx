import { useLocation } from 'wouter';
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Play } from 'lucide-react';
import { describeDue, formatDate } from '@workspace/sync';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPE_NAMES, type IrrigatorRow } from './irrigatorRows';

export const DU_CLASSES = {
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

/** Start a new test for a saved irrigator, with its farm and last settings filled in. */
export function useStartIrrigatorTest() {
  const [, setLocation] = useLocation();
  const startRetest = useAppStore((state) => state.startRetest);
  return ({ farm, irrigator }: IrrigatorRow) => {
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
}

export function IrrigatorCard({ row, showFarmName }: { row: IrrigatorRow; showFarmName: boolean }) {
  const [, setLocation] = useLocation();
  const startTest = useStartIrrigatorTest();
  const { irrigator, farm, status } = row;
  const last = status.lastTest;
  const DueIcon = status.state === 'overdue' ? AlertTriangle : status.state === 'ok' ? CheckCircle2 : CalendarClock;

  return (
    <Card className="p-5 flex flex-col gap-4 text-left" data-testid={`irrigator-${irrigator.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold font-display truncate">{irrigator.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {showFarmName ? `${farm.name} · ` : ''}
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
        <Button className="flex-1" size="sm" onClick={() => startTest(row)} aria-label={`Test ${irrigator.name} now`}>
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
}
