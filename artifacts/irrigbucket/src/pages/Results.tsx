import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { calculateTestResults } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { saveReport } from '@/lib/savedReports';
import { ReportContent } from '@/components/report/ReportContent';
import { BillingPaywall } from '@/components/billing/BillingPaywall';

export default function Results() {
  const [, setLocation] = useLocation();
  const {
    volumes, systemParams, plan, windSpeed, testDate,
    sections, irrigatorType, operationData, reset,
  } = useAppStore();

  // Guard so the report is persisted exactly once per mount. Saving writes to
  // the local-first Dexie store AND enqueues an upsert with the SyncEngine,
  // which drains to the server when online — no separate API call needed.
  const savedRef = useRef(false);

  useEffect(() => {
    if (!plan || volumes.length === 0) setLocation('/');
  }, [plan, volumes, setLocation]);

  const results = useMemo(() =>
    calculateTestResults(volumes, systemParams.diameter, systemParams.targetDepth, sections),
    [volumes, systemParams.diameter, systemParams.targetDepth, sections]
  );

  useEffect(() => {
    if (!plan || !results || !volumes.some(v => v > 0)) return;
    if (savedRef.current) return;
    savedRef.current = true;
    void saveReport({ irrigatorType, systemParams, plan, volumes, windSpeed, testDate, sections, operationData });
  }, [plan, results, volumes, irrigatorType, systemParams, windSpeed, testDate, sections, operationData]);

  if (!plan || !results) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  return (
    <AppLayout step={totalSteps} totalSteps={totalSteps} title="Test Results" showBack={false}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <BillingPaywall
          returnTo="/results"
          title="Unlock your results"
          description="Your bucket readings are saved on this device. Subscribe to see the full report, recommendations, and printable results."
        >
          <ReportContent
            irrigatorType={irrigatorType}
            systemParams={systemParams}
            plan={plan}
            volumes={volumes}
            windSpeed={windSpeed}
            testDate={testDate}
            sections={sections}
            operationData={operationData}
            results={results}
            onPrint={() => window.print()}
          />

          <div className="flex flex-col sm:flex-row gap-4 px-6 pb-8 no-print">
            <Button size="lg" className="flex-1" onClick={() => { reset(); setLocation('/'); }}>
              <RotateCcw className="w-5 h-5 mr-2" />
              Start New Test
            </Button>
          </div>
        </BillingPaywall>
      </motion.div>
    </AppLayout>
  );
}
