import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Droplet, ShieldCheck, FileText, HelpCircle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@workspace/replit-auth-web';

interface AdminReport {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  irrigatorType: string | null;
  farmName: string | null;
  assessorName: string | null;
  testDate: string | null;
  duPercent: string | null;
  duStatus: string | null;
  createdAt: string;
}

interface HelpRequest {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  description: string;
  contactInfo: string | null;
  resolved: boolean;
  createdAt: string;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingHelp, setLoadingHelp] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [tab, setTab] = useState<'reports' | 'help'>('reports');

  useEffect(() => {
    if (!isAuthenticated && !isLoading) return;
    if (isLoading) return;

    fetch('/api/admin/reports', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403) throw new Error('admin');
        if (r.status === 401) throw new Error('auth');
        return r.json();
      })
      .then((data) => { setReports(data.reports ?? []); setLoadingReports(false); })
      .catch((err) => {
        setLoadingReports(false);
        if (err.message === 'admin') setAccessError('You do not have admin access to this page.');
        else if (err.message === 'auth') setAccessError('Please log in to access this page.');
      });

    fetch('/api/admin/help-requests', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { setHelpRequests(data.helpRequests ?? []); setLoadingHelp(false); })
      .catch(() => setLoadingHelp(false));
  }, [isAuthenticated, isLoading]);

  function resolveHelpRequest(id: string) {
    fetch(`/api/admin/help-requests/${id}/resolve`, {
      method: 'PATCH',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then(() => {
        setHelpRequests((prev) =>
          prev.map((h) => (h.id === id ? { ...h, resolved: true } : h)),
        );
      })
      .catch(() => {});
  }

  function duStatusColor(status: string | null) {
    if (status === 'good') return 'text-green-700 bg-green-50';
    if (status === 'fair') return 'text-amber-700 bg-amber-50';
    if (status === 'poor') return 'text-red-700 bg-red-50';
    return 'text-muted-foreground bg-muted';
  }

  function duStatusLabel(status: string | null) {
    if (status === 'good') return 'Pass';
    if (status === 'fair') return 'Attention';
    if (status === 'poor') return 'Fail';
    return '—';
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground text-center">Please log in to access the admin panel.</p>
        <Button onClick={() => setLocation('/')}>Go Home</Button>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground text-center">{accessError}</p>
        <p className="text-xs text-muted-foreground/60 text-center max-w-sm">
          Your user ID is: <code className="font-mono bg-muted px-1 rounded">{user?.id}</code>
          <br />Set <code className="font-mono bg-muted px-1 rounded">ADMIN_USER_ID</code> to this value in your environment variables to gain admin access.
        </p>
        <Button variant="outline" onClick={() => setLocation('/')}>Go Home</Button>
      </div>
    );
  }

  const openHelp = helpRequests.filter((h) => !h.resolved);
  const resolvedHelp = helpRequests.filter((h) => h.resolved);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => setLocation('/')}
              className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Droplet className="w-5 h-5 fill-primary" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">
                Irrig<span className="text-primary">Bucket</span>
                <span className="ml-2 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Admin</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 pt-6 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">All user reports and support requests</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <FileText className="w-4 h-4" />
            Reports
            <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{reports.length}</span>
          </button>
          <button
            onClick={() => setTab('help')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === 'help' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <HelpCircle className="w-4 h-4" />
            Help Requests
            {openHelp.length > 0 && (
              <span className="ml-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">{openHelp.length}</span>
            )}
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {tab === 'reports' && (
            <div>
              {loadingReports ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-6 w-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
              ) : reports.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No reports saved yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Farm</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assessor</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
                        <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">DU</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Saved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {reports.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {r.testDate ? new Date(r.testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.farmName || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.assessorName || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{r.irrigatorType || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {r.duPercent ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${duStatusColor(r.duStatus)}`}>
                                {r.duPercent}% · {duStatusLabel(r.duStatus)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {r.userName || r.userEmail || <span className="italic">Anonymous</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(r.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'help' && (
            <div className="space-y-4">
              {loadingHelp ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-6 w-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
              ) : helpRequests.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                    <CheckCircle className="w-8 h-8 text-green-500/60" />
                    <p className="text-sm text-muted-foreground">No help requests yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {openHelp.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Open ({openHelp.length})</h2>
                      <div className="space-y-3">
                        {openHelp.map((h) => (
                          <Card key={h.id} className="border-amber-200">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(h.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {h.userName && <span className="text-xs font-semibold text-foreground">· {h.userName}</span>}
                                  </div>
                                  <p className="text-sm text-foreground">{h.description}</p>
                                  {h.contactInfo && (
                                    <p className="text-xs text-muted-foreground mt-1">Contact: {h.contactInfo}</p>
                                  )}
                                  {h.userEmail && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Email: {h.userEmail}</p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 text-green-700 border-green-300 hover:bg-green-50"
                                  onClick={() => resolveHelpRequest(h.id)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                  Resolve
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {resolvedHelp.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 mt-6">Resolved ({resolvedHelp.length})</h2>
                      <div className="space-y-2">
                        {resolvedHelp.map((h) => (
                          <Card key={h.id} className="opacity-60">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(h.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                {h.userName && <span className="text-xs font-semibold">· {h.userName}</span>}
                              </div>
                              <p className="text-sm text-muted-foreground">{h.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
