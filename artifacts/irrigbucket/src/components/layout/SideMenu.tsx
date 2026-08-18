import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { FileText, Trash2, ChevronRight, ClipboardList, LogIn, LogOut, User, Cloud, HelpCircle, Send, X, ShieldCheck, CreditCard } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  getSavedReports, deleteReport, getReportLabel, getReportSubLabel, SavedReport,
  saveReport as saveLocalReport,
} from '@/lib/savedReports';
import { useAuth } from '@workspace/replit-auth-web';
import { useBilling } from '@/hooks/use-billing';

interface ServerReport {
  id: string;
  farmName: string | null;
  assessorName: string | null;
  testDate: string | null;
  duPercent: string | null;
  duStatus: string | null;
  createdAt: string;
  reportData: { id?: string; irrigatorType?: string | null; [key: string]: unknown } | null;
}

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

export function SideMenu({ open, onClose }: SideMenuProps) {
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [serverReports, setServerReports] = useState<ServerReport[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [helpText, setHelpText] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [helpSubmitting, setHelpSubmitting] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const { hasAccess, isLoading: billingLoading } = useBilling();

  useEffect(() => {
    if (open) {
      setReports(getSavedReports());
      setShowHelp(false);
      setHelpSent(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && isAuthenticated) {
      fetch('/api/reports', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => { setServerReports(data.reports ?? []); })
        .catch(() => {});
    } else {
      setServerReports([]);
    }
  }, [open, isAuthenticated]);

  const localIds = new Set(reports.map((r) => r.id));
  const cloudOnlyReports = serverReports.filter(
    (sr) => !sr.reportData?.id || !localIds.has(sr.reportData.id as string),
  );

  function handleOpen(id: string) {
    onClose();
    setLocation(`/reports/${id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  function handleOpenCloud(sr: ServerReport) {
    const rd = sr.reportData as any;
    if (!rd) return;
    const localId = rd.id as string | undefined;
    if (localId && localIds.has(localId)) {
      handleOpen(localId);
      return;
    }
    const saved = saveLocalReport({
      irrigatorType: rd.irrigatorType ?? null,
      systemParams: rd.systemParams,
      plan: rd.plan,
      volumes: rd.volumes ?? [],
      windSpeed: rd.windSpeed ?? 0,
      testDate: rd.testDate ?? '',
      sections: rd.sections ?? [],
      operationData: rd.operationData ?? {},
    });
    setReports(getSavedReports());
    onClose();
    setLocation(`/reports/${saved.id}`);
  }

  async function handleHelpSubmit() {
    if (!helpText.trim()) return;
    setHelpSubmitting(true);
    try {
      await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: helpText.trim(),
          contactInfo: contactInfo.trim() || null,
        }),
      });
      setHelpSent(true);
      setHelpText('');
      setContactInfo('');
    } catch {
    } finally {
      setHelpSubmitting(false);
    }
  }

  function getCloudLabel(sr: ServerReport): string {
    const year = sr.testDate
      ? new Date(sr.testDate).getFullYear()
      : new Date(sr.createdAt).getFullYear();
    const assessor = sr.assessorName?.trim() || 'Unknown Assessor';
    return `${year} — ${assessor}`;
  }

  function getCloudSubLabel(sr: ServerReport): string {
    const parts: string[] = [];
    if (sr.farmName) parts.push(sr.farmName);
    if (sr.reportData?.irrigatorType) parts.push(sr.reportData.irrigatorType as string);
    return parts.join(' · ');
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border/50">
          <SheetTitle className="text-lg font-display font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Previous Reports
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {reports.length === 0 && cloudOnlyReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No saved reports yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Complete a test to save your first report.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left group"
                    onClick={() => handleOpen(report.id)}
                  >
                    <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {getReportLabel(report)}
                      </p>
                      {getReportSubLabel(report) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getReportSubLabel(report)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, report.id)}
                        aria-label="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  </button>
                </li>
              ))}
              {cloudOnlyReports.map((sr) => (
                <li key={sr.id}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => handleOpenCloud(sr)}
                  >
                    <div className="bg-sky-100 p-2 rounded-lg text-sky-600 shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {getCloudLabel(sr)}
                      </p>
                      {getCloudSubLabel(sr) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getCloudSubLabel(sr)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Can't find report */}
          <div className="px-5 pt-4 pb-2">
            {!showHelp && !helpSent && (
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-2 rounded-lg hover:bg-muted/50 px-2"
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                Can't find your report?
              </button>
            )}
            {helpSent && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Send className="w-3.5 h-3.5 shrink-0" />
                Request sent — we'll get back to you.
              </div>
            )}
            {showHelp && !helpSent && (
              <div className="bg-muted/50 rounded-xl p-3 space-y-2 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">Can't find your report?</span>
                  <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  className="w-full text-xs bg-white border border-border rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                  rows={3}
                  placeholder="Describe the report — e.g. farm name, test date, irrigator type…"
                  value={helpText}
                  onChange={(e) => setHelpText(e.target.value)}
                />
                <input
                  className="w-full text-xs bg-white border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                  placeholder="Your email or phone (optional)"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full text-xs h-8"
                  disabled={!helpText.trim() || helpSubmitting}
                  onClick={handleHelpSubmit}
                >
                  <Send className="w-3 h-3 mr-1.5" />
                  {helpSubmitting ? 'Sending…' : 'Send Request'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/50 px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="h-9 bg-muted animate-pulse rounded-md" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {user?.firstName ?? user?.email ?? 'Account'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Log out
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={login}>
              <LogIn className="w-4 h-4 mr-2" />
              Log in
            </Button>
          )}
          {isAuthenticated && !billingLoading && (
            <button
              onClick={() => { onClose(); setLocation(hasAccess ? '/subscribe' : '/subscribe?start=1'); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {hasAccess ? 'Manage subscription' : 'Subscribe'}
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={() => { onClose(); setLocation('/admin'); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin panel
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
