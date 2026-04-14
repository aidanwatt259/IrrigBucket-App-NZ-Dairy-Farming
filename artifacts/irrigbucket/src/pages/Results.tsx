import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { calculateTestResults } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { saveReport } from '@/lib/savedReports';
import { useAuth } from '@workspace/replit-auth-web';
import { ReportContent } from '@/components/report/ReportContent';

export default function Results() {
  const [, setLocation] = useLocation();
  const {
    volumes, systemParams, plan, windSpeed, testDate,
    sections, irrigatorType, operationData, reset,
  } = useAppStore();

  // Separate refs so a local save and an API save are tracked independently.
  // savedRef holds the result of saveReport() once it has been called.
  const savedRef = useRef<ReturnType<typeof saveReport> | null>(null);
  const apiSavedRef = useRef(false);

  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!plan || volumes.length === 0) setLocation('/');
  }, [plan, volumes, setLocation]);

  const results = useMemo(() =>
    calculateTestResults(volumes, systemParams.diameter, systemParams.targetDepth, sections),
    [volumes, systemParams.diameter, systemParams.targetDepth, sections]
  );

  useEffect(() => {
    if (!plan || !results || !volumes.some(v => v > 0)) return;

    // Save to localStorage once, immediately (does not depend on auth state).
    if (!savedRef.current) {
      savedRef.current = saveReport({ irrigatorType, systemParams, plan, volumes, windSpeed, testDate, sections, operationData });
    }

    // Wait until auth state is fully resolved before deciding whether to sync
    // to the server.  Without this guard the effect would fire while
    // isAuthenticated is still false (loading), mark apiSavedRef as done, and
    // then never retry once the real auth state arrives.
    if (isLoading || apiSavedRef.current || !savedRef.current) return;
    apiSavedRef.current = true;

    if (isAuthenticated) {
      const saved = savedRef.current;
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          irrigatorType: irrigatorType ?? null,
          farmName: operationData.farmName ?? null,
          assessorName: operationData.assessorName ?? null,
          testDate: testDate || null,
          duPercent: (results.du * 100).toFixed(1),
          duStatus: results.duStatus,
          reportData: {
            id: saved.id,
            savedAt: saved.savedAt,
            irrigatorType,
            systemParams,
            plan,
            volumes,
            windSpeed,
            testDate,
            sections,
            operationData,
          },
        }),
      }).catch(console.error);
    }
  }, [plan, results, isAuthenticated, isLoading]);

  if (!plan || !results) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  return (
    <AppLayout step={totalSteps} totalSteps={totalSteps} title="Test Results" showBack={false}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
      </motion.div>
    </AppLayout>
  );
}
