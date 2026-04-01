import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Droplet, Menu, Trash2 } from 'lucide-react';
import { calculateTestResults } from '@/lib/calculations';
import { getReportById, deleteReport, SavedReport as SavedReportType } from '@/lib/savedReports';
import { SideMenu } from '@/components/layout/SideMenu';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ReportContent } from '@/components/report/ReportContent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SavedReport() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [report, setReport] = useState<SavedReportType | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const r = getReportById(params.id);
    setReport(r);
  }, [params.id]);

  const results = useMemo(() => {
    if (!report) return null;
    return calculateTestResults(
      report.volumes,
      report.systemParams.diameter,
      report.systemParams.targetDepth,
      report.sections,
    );
  }, [report]);

  function handleDelete() {
    if (!report) return;
    deleteReport(report.id);
    setLocation('/');
  }

  if (report === undefined) return null;

  if (!report || !results) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Report not found.</p>
        <Button variant="outline" onClick={() => setLocation('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background/90 backdrop-blur-sm">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm no-print">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuOpen(true)}
                className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setLocation('/')}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 cursor-pointer ml-1" onClick={() => setLocation('/')}>
                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                  <Droplet className="w-5 h-5 fill-primary" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-foreground hidden sm:block">
                  Irrig<span className="text-primary">Bucket</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This report will be permanently removed from your account and cannot be recovered. Make sure you have downloaded a PDF copy if you need it for your records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Report</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirm Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="pb-4">
            <Progress value={100} className="h-2" />
          </div>
        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="flex-1">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <ReportContent
            irrigatorType={report.irrigatorType}
            systemParams={report.systemParams}
            plan={report.plan ?? null}
            volumes={report.volumes}
            windSpeed={report.windSpeed}
            testDate={report.testDate}
            sections={report.sections}
            operationData={report.operationData}
            results={results}
            onPrint={() => window.print()}
          />

          <div className="flex gap-4 px-6 pb-8 max-w-3xl mx-auto no-print">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setLocation('/')}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
