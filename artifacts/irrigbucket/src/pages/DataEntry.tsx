import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { SectionDefinition } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DataEntry() {
  const [, setLocation] = useLocation();
  const {
    plan, irrigatorType, volumes, setVolume,
    testDate, windSpeed, setTestConditions,
    sections, setSections,
  } = useAppStore();

  useEffect(() => {
    if (!plan) setLocation('/setup');
  }, [plan, setLocation]);

  const handleBucketKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-bucket-input]');
      const next = inputs[index + 1];
      if (next) { next.focus(); next.select(); }
      else (e.currentTarget as HTMLInputElement).blur();
    }
  }, []);

  if (!plan) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;
  const currentStep = isPivot ? 5 : 4;
  const filledCount = volumes.filter(v => v > 0).length;

  // Build section boundary map from SectionDefinition[]
  const sectionBoundaries: Array<{ bucketIndex: number; label: string }> = sections.map(sec => ({
    bucketIndex: sec.fromBucket - 1,
    label: `${sec.name} (buckets ${sec.fromBucket}–${sec.toBucket})`,
  }));

  return (
    <AppLayout step={currentStep} totalSteps={totalSteps} title="Enter Bucket Volumes">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        <Card>
          <CardContent className="pt-8 space-y-6">
            {/* Conditions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border/50">
              {!isPivot && (
                <>
                  <div className="space-y-3">
                    <Label htmlFor="testDate">Test Date</Label>
                    <Input id="testDate" type="date" value={testDate} onChange={(e) => setTestConditions(e.target.value, windSpeed)} />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="windSpeed">Wind Speed (km/h)</Label>
                    <Input id="windSpeed" type="number" min="0" value={windSpeed || ''} onChange={(e) => setTestConditions(testDate, Number(e.target.value))} placeholder="e.g. 5" />
                  </div>
                </>
              )}
              {isPivot && (
                <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <strong>Number buckets 1 through {plan.bucketCount}</strong> in the field, starting from the innermost position and working outward.
                  Enter each volume here in the same order.
                </div>
              )}
            </div>

            {/* Volume Grid */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-xl font-bold font-display">Bucket Volumes (mL)</h3>
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {filledCount} / {plan.bucketCount} entered
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Press <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded font-mono">Enter</kbd> to jump to the next bucket.
              </p>

              <div className="space-y-6">
                {(() => {
                  const elements: React.ReactNode[] = [];
                  let i = 0;

                  while (i < plan.bucketCount) {
                    const header = sectionBoundaries.find(b => b.bucketIndex === i);
                    const nextBoundary = sectionBoundaries.find(b => b.bucketIndex > i)?.bucketIndex ?? plan.bucketCount;

                    if (header) {
                      const sectionBuckets: React.ReactNode[] = [];
                      for (let j = i; j < nextBoundary; j++) {
                        const isLast = j === plan.bucketCount - 1;
                        sectionBuckets.push(
                          <div key={j} className="space-y-1.5">
                            <Label htmlFor={`bucket-${j}`} className="text-xs text-muted-foreground">#{j + 1}</Label>
                            <Input
                              id={`bucket-${j}`} type="number" inputMode="decimal"
                              enterKeyHint={isLast ? 'done' : 'next'}
                              data-bucket-input min="0"
                              className="text-lg font-semibold text-center"
                              value={volumes[j] || ''}
                              onChange={(e) => setVolume(j, Number(e.target.value))}
                              onKeyDown={(e) => handleBucketKeyDown(e, j)}
                              placeholder="0"
                            />
                          </div>
                        );
                      }
                      elements.push(
                        <div key={`sec-${i}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-px flex-1 bg-primary/20" />
                            <span className="text-xs font-bold text-primary uppercase tracking-wide">{header.label}</span>
                            <div className="h-px flex-1 bg-primary/20" />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{sectionBuckets}</div>
                        </div>
                      );
                      i = nextBoundary;
                    } else {
                      // No sections — flat grid
                      const allBuckets: React.ReactNode[] = [];
                      for (let j = 0; j < plan.bucketCount; j++) {
                        const isLast = j === plan.bucketCount - 1;
                        allBuckets.push(
                          <div key={j} className="space-y-1.5">
                            <Label htmlFor={`bucket-${j}`} className="text-xs text-muted-foreground">Bucket {j + 1}</Label>
                            <Input
                              id={`bucket-${j}`} type="number" inputMode="decimal"
                              enterKeyHint={isLast ? 'done' : 'next'}
                              data-bucket-input min="0"
                              className="text-lg font-semibold text-center"
                              value={volumes[j] || ''}
                              onChange={(e) => setVolume(j, Number(e.target.value))}
                              onKeyDown={(e) => handleBucketKeyDown(e, j)}
                              placeholder="0"
                            />
                          </div>
                        );
                      }
                      elements.push(
                        <div key="flat" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{allBuckets}</div>
                      );
                      i = plan.bucketCount;
                    }
                  }
                  return elements;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual section editor — non-pivot only */}
        {!isPivot && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-bold font-display">
                Define Sections <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </h3>
              <p className="text-sm text-muted-foreground">Break your test into named sections to see per-section DU results.</p>
              <ManualSectionEditor bucketCount={plan.bucketCount} sections={sections} setSections={setSections} />
            </CardContent>
          </Card>
        )}

        <Button size="lg" className="w-full" onClick={() => setLocation('/results')} disabled={filledCount < 4}>
          Calculate Results
        </Button>
        {filledCount < 4 && (
          <p className="text-sm text-center text-muted-foreground -mt-3">Enter at least 4 measurements to continue</p>
        )}
      </motion.div>
    </AppLayout>
  );
}

function ManualSectionEditor({ bucketCount, sections, setSections }: {
  bucketCount: number;
  sections: SectionDefinition[];
  setSections: (s: SectionDefinition[]) => void;
}) {
  const update = (i: number, f: keyof SectionDefinition, v: string | number) => {
    const updated = [...sections];
    updated[i] = { ...updated[i], [f]: v };
    setSections(updated);
  };
  return (
    <div className="space-y-3">
      {sections.map((sec, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-end">
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">Name</Label>}
            <Input value={sec.name} onChange={e => update(i, 'name', e.target.value)} placeholder="e.g. Left Side" />
          </div>
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">From #</Label>}
            <Input type="number" min={1} max={bucketCount} value={sec.fromBucket || ''} onChange={e => update(i, 'fromBucket', Number(e.target.value))} className="text-center" />
          </div>
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">To #</Label>}
            <Input type="number" min={1} max={bucketCount} value={sec.toBucket || ''} onChange={e => update(i, 'toBucket', Number(e.target.value))} className="text-center" />
          </div>
          <div className={i === 0 ? 'pt-6' : ''}>
            <button onClick={() => setSections(sections.filter((_, idx) => idx !== i))} className="w-9 h-10 text-muted-foreground hover:text-destructive flex items-center justify-center text-lg">×</button>
          </div>
        </div>
      ))}
      <button onClick={() => setSections([...sections, { name: '', fromBucket: 1, toBucket: bucketCount }])} className="text-sm text-primary hover:underline font-medium">+ Add Section</button>
    </div>
  );
}
