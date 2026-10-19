import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Droplet, FileText, Mail, MapPin, Menu, Pencil, Phone, Plus, Trash2, User } from 'lucide-react';
import type { FarmInput } from '@workspace/sync';
import { DEFAULT_TEST_INTERVAL_MONTHS, formatDate } from '@workspace/sync';
import { farmDirectory, useFarmDirectory } from '@/lib/farmDirectory';
import { requestFarmSync } from '@/lib/syncEngine';
import { useAppStore } from '@/lib/store';
import { calculateTestResults } from '@/lib/calculations';
import { SideMenu } from '@/components/layout/SideMenu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { FarmForm } from '@/components/farms/FarmForm';
import { DU_CLASSES, IrrigatorCard } from '@/components/farms/IrrigatorCard';
import { TYPE_NAMES, useIrrigatorRows, useSavedReports, useTestSummaries } from '@/components/farms/irrigatorRows';

const TYPE_ORDER = ['pivot', 'lateral', 'kline', 'gun', 'solid', 'boom'];
const selectClass =
  'w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function FarmDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingIrrigator, setAddingIrrigator] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('pivot');
  const [newInterval, setNewInterval] = useState(String(DEFAULT_TEST_INTERVAL_MONTHS));
  const [newTestType, setNewTestType] = useState<string | null>(null);
  const startFarmTest = useAppStore((state) => state.startFarmTest);

  useFarmDirectory();
  const farm = farmDirectory.getFarm(params.id);
  const reports = useSavedReports();
  const tests = useTestSummaries(reports);
  const rows = useIrrigatorRows(tests, params.id);

  const recentReports = useMemo(
    () =>
      reports
        .filter((r) => r.operationData?.farmId === params.id)
        .slice(0, 10)
        .map((r) => ({
          report: r,
          results: calculateTestResults(r.volumes, r.systemParams.diameter, r.systemParams.targetDepth, r.sections),
        })),
    [reports, params.id],
  );

  if (!farm) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center gap-4">
        <h1 className="text-2xl font-display font-bold">Farm not found</h1>
        <p className="text-muted-foreground">It may have been removed, or hasn't synced to this device yet.</p>
        <Button onClick={() => setLocation('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to your farms
        </Button>
      </div>
    );
  }

  const handleSaveFarm = async (input: FarmInput) => {
    await farmDirectory.updateFarm(farm.id, input);
    void requestFarmSync();
    setEditing(false);
  };

  const handleDeleteFarm = async () => {
    await farmDirectory.deleteFarm(farm.id);
    void requestFarmSync();
    setLocation('/');
  };

  const handleAddIrrigator = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const months = Number(newInterval);
    await farmDirectory.createIrrigator({
      farmId: farm.id,
      name,
      type: newType,
      testIntervalMonths: Number.isFinite(months) && months >= 1 ? Math.round(months) : DEFAULT_TEST_INTERVAL_MONTHS,
    });
    void requestFarmSync();
    setNewName('');
    setAddingIrrigator(false);
  };

  const handleStartTest = (irrigatorType: string) => {
    startFarmTest({ irrigatorType, farmId: farm.id, farmName: farm.name });
    setLocation('/setup');
  };

  const contact = [
    farm.contactName && { Icon: User, text: farm.contactName },
    farm.contactPhone && { Icon: Phone, text: farm.contactPhone, href: `tel:${farm.contactPhone}` },
    farm.contactEmail && { Icon: Mail, text: farm.contactEmail, href: `mailto:${farm.contactEmail}` },
  ].filter(Boolean) as { Icon: typeof User; text: string; href?: string }[];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-[var(--offline-banner-h,0px)] left-0 right-0 z-50 w-full bg-white border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/')} aria-label="Back to your farms">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Droplet className="w-5 h-5 fill-primary" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight hidden sm:inline">
                Irrig<span className="text-primary">Bucket</span>
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-[calc(5.5rem+var(--offline-banner-h,0px))] pb-16">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Farm header */}
          <Card className="p-6">
            {editing ? (
              <FarmForm initial={farm} submitLabel="Save changes" onSubmit={handleSaveFarm} onCancel={() => setEditing(false)} />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <h1 className="text-3xl font-display font-extrabold tracking-tight truncate">{farm.name}</h1>
                  {farm.region && (
                    <p className="text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {farm.region}
                    </p>
                  )}
                  {contact.length > 0 && (
                    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      {contact.map(({ Icon, text, href }) => (
                        <li key={text} className="flex items-center gap-1.5">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          {href ? <a href={href} className="hover:underline">{text}</a> : text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {farm.notes && <p className="text-sm text-muted-foreground whitespace-pre-line">{farm.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" aria-label="Delete farm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {farm.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The farm and its {rows.length === 1 ? 'irrigator' : `${rows.length} irrigators`} are removed from your
                          farms list. Saved reports are kept.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep farm</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDeleteFarm()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Remove farm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </Card>

          {/* Start a test */}
          <section className="space-y-3" aria-labelledby="start-test">
            <h2 id="start-test" className="text-xl font-display font-bold">Start a new test here</h2>
            <p className="text-sm text-muted-foreground">
              Pick an irrigator below to re-test it, or choose a type to test something new at {farm.name}.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {TYPE_ORDER.map((type) => (
                <Button
                  key={type}
                  variant={newTestType === type ? 'default' : 'outline'}
                  className="h-auto py-3 whitespace-normal"
                  onClick={() => {
                    setNewTestType(type);
                    handleStartTest(type);
                  }}
                  data-testid={`start-${type}`}
                >
                  {TYPE_NAMES[type]}
                </Button>
              ))}
            </div>
          </section>

          {/* Irrigators */}
          <section className="space-y-4" aria-labelledby="farm-irrigators">
            <div className="flex items-center justify-between gap-3">
              <h2 id="farm-irrigators" className="text-xl font-display font-bold">
                Irrigators{rows.length > 0 && <span className="text-muted-foreground font-normal text-base"> · {rows.length}</span>}
              </h2>
              {!addingIrrigator && (
                <Button variant="outline" size="sm" onClick={() => setAddingIrrigator(true)} data-testid="add-irrigator">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add irrigator
                </Button>
              )}
            </div>

            {addingIrrigator && (
              <Card className="p-5">
                <form onSubmit={handleAddIrrigator} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_8rem_auto] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="irrigator-name">Name / ID</Label>
                    <Input id="irrigator-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Pivot 2 North" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="irrigator-type">Type</Label>
                    <select id="irrigator-type" value={newType} onChange={(e) => setNewType(e.target.value)} className={selectClass}>
                      {TYPE_ORDER.map((type) => (
                        <option key={type} value={type}>{TYPE_NAMES[type]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="irrigator-interval">Test every (months)</Label>
                    <Input id="irrigator-interval" type="number" min={1} max={120} value={newInterval} onChange={(e) => setNewInterval(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddingIrrigator(false)}>Cancel</Button>
                    <Button type="submit" disabled={!newName.trim()}>Add</Button>
                  </div>
                </form>
              </Card>
            )}

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No irrigators saved for this farm yet. Add one above, or start a test and it will be saved automatically.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((row) => (
                  <IrrigatorCard key={row.irrigator.id} row={row} showFarmName={false} />
                ))}
              </div>
            )}
          </section>

          {/* Recent tests */}
          {recentReports.length > 0 && (
            <section className="space-y-4" aria-labelledby="farm-reports">
              <h2 id="farm-reports" className="text-xl font-display font-bold">Recent tests</h2>
              <Card className="divide-y divide-border/50">
                {recentReports.map(({ report, results }) => (
                  <button
                    key={report.id}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setLocation(`/reports/${report.id}`)}
                  >
                    <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {report.operationData?.irrigatorName || TYPE_NAMES[report.irrigatorType ?? ''] || 'Test'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(report.testDate || report.savedAt.slice(0, 10))}
                        {report.operationData?.assessorName ? ` · ${report.operationData.assessorName}` : ''}
                      </p>
                    </div>
                    {results && (
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DU_CLASSES[results.duStatus]}`}>
                        DU {Math.round(results.du * 100)}%
                      </span>
                    )}
                  </button>
                ))}
              </Card>
            </section>
          )}
        </motion.div>
      </main>
    </div>
  );
}
