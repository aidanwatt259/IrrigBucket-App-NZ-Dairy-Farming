import { AlertTriangle, CalendarClock, CheckCircle2, Info } from 'lucide-react';
import type { DuStatus } from '@workspace/sync';
import { addMonths, formatDate, retestIntervalMonths } from '@workspace/sync';
import { nextSteps } from '@/lib/irrigatorStatus';

const STYLES = {
  good: { box: 'bg-green-50 border-green-200', icon: 'text-green-600', Icon: CheckCircle2 },
  fair: { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', Icon: Info },
  poor: { box: 'bg-red-50 border-red-200', icon: 'text-red-600', Icon: AlertTriangle },
} as const;

/** What a DU result means for the farm, in plain words, and when to test again. */
export function NextStepsCard({
  duStatus,
  du,
  testDate,
  intervalMonths,
}: {
  duStatus: DuStatus;
  du: number;
  testDate: string;
  intervalMonths: number;
}) {
  const { title, body } = nextSteps(duStatus);
  const { box, icon, Icon } = STYLES[duStatus];
  const months = retestIntervalMonths(intervalMonths, duStatus);
  const due = testDate ? addMonths(testDate, months) : null;

  return (
    <div className={`mx-6 mt-6 rounded-2xl border p-5 no-print ${box}`} data-testid="next-steps">
      <div className="flex items-start gap-3">
        <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${icon}`} />
        <div className="space-y-2 min-w-0">
          <h2 className="font-display font-bold text-lg leading-tight">{title}</h2>
          <p className="text-sm text-foreground/80">
            Distribution uniformity was <strong>{Math.round(du * 100)}%</strong>. {body}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className="w-4 h-4 shrink-0" />
            {duStatus === 'poor'
              ? `Re-test after repairs${due ? `, and by ${formatDate(due)} at the latest` : ''}.`
              : `Next bucket test: ${due ? `by ${formatDate(due)}` : `in ${months} months`}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
