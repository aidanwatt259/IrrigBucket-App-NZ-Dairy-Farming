import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, Droplets, MapPin, Plus, Tractor } from 'lucide-react';
import type { FarmInput, LocalFarm, FarmSummary } from '@workspace/sync';
import { describeFarm, formatDate, summarizeFarm, todayString } from '@workspace/sync';
import { farmDirectory, useFarmDirectory } from '@/lib/farmDirectory';
import { requestFarmSync } from '@/lib/syncEngine';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FarmForm } from './FarmForm';
import { useSavedReports, useTestSummaries } from './irrigatorRows';

interface FarmRow {
  farm: LocalFarm;
  summary: FarmSummary;
}

function farmOrder(a: FarmRow, b: FarmRow): number {
  const urgency = (s: FarmSummary) => (s.overdue ? 0 : s.dueSoon ? 1 : s.neverTested ? 2 : 3);
  return urgency(a.summary) - urgency(b.summary) || a.farm.name.localeCompare(b.farm.name);
}

/** Add a farm from anywhere; navigates to the new farm's page when done. */
export function AddFarmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();
  const handleAdd = async (input: FarmInput) => {
    const farm = await farmDirectory.createFarm(input);
    void requestFarmSync();
    onOpenChange(false);
    setLocation(`/farms/${farm.id}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a farm</DialogTitle>
          <DialogDescription>You can add contact details and irrigators on the farm's page.</DialogDescription>
        </DialogHeader>
        <FarmForm full={false} submitLabel="Add farm" onSubmit={handleAdd} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** The consultant's Home: every client farm and what needs testing. */
export function ConsultantDashboard() {
  const [, setLocation] = useLocation();
  const snapshot = useFarmDirectory();
  const tests = useTestSummaries(useSavedReports());
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const today = todayString();
    const live = snapshot.irrigators.filter((i) => i.deletedAt === null);
    return snapshot.farms
      .filter((f) => f.deletedAt === null)
      .map((farm) => ({
        farm,
        summary: summarizeFarm(live.filter((i) => i.farmId === farm.id), tests, today),
      }))
      .sort(farmOrder);
  }, [snapshot, tests]);

  const totals = rows.reduce(
    (acc, { summary }) => ({
      irrigators: acc.irrigators + summary.irrigatorCount,
      due: acc.due + summary.overdue + summary.dueSoon,
    }),
    { irrigators: 0, due: 0 },
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-[calc(6rem+var(--offline-banner-h,0px))] pb-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight">Your farms</h1>
            <p className="text-muted-foreground mt-1">Bucket testing across every client, in one place.</p>
          </div>
          <Button onClick={() => setAdding(true)} data-testid="add-farm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add farm
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Farms', value: rows.length, Icon: Tractor, tone: 'text-primary bg-primary/10' },
            { label: 'Irrigators', value: totals.irrigators, Icon: Droplets, tone: 'text-primary bg-primary/10' },
            {
              label: 'Due for testing',
              value: totals.due,
              Icon: AlertTriangle,
              tone: totals.due > 0 ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100',
            },
          ].map(({ label, value, Icon, tone }) => (
            <Card key={label} className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-display font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Tractor className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-display font-bold">No farms yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Add your first client farm. You'll then add its irrigators and start bucket tests from the farm's page.
            </p>
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add your first farm
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rows.map(({ farm, summary }) => {
              const attention = summary.overdue > 0 || summary.dueSoon > 0;
              return (
                <Card
                  key={farm.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`farm-${farm.id}`}
                  className="p-5 cursor-pointer transition-all hover-elevate hover:border-primary/50 flex items-center gap-4 text-left"
                  onClick={() => setLocation(`/farms/${farm.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLocation(`/farms/${farm.id}`);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-bold text-lg truncate">{farm.name}</h3>
                    {farm.region && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {farm.region}
                      </p>
                    )}
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">
                        {summary.irrigatorCount === 1 ? '1 irrigator' : `${summary.irrigatorCount} irrigators`}
                        {' · '}
                      </span>
                      <span className={attention ? 'text-red-700 font-medium' : 'text-muted-foreground'}>
                        {describeFarm(summary)}
                      </span>
                    </p>
                    {summary.lastTestDate && (
                      <p className="text-xs text-muted-foreground mt-1">Last visit {formatDate(summary.lastTestDate)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      <AddFarmDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
