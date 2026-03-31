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
    plan,
    irrigatorType,
    volumes,
    setVolume,
    testDate,
    windSpeed,
    setTestConditions,
    sections,
    setSections,
    pivotSections,
  } = useAppStore();

  useEffect(() => {
    if (!plan) {
      setLocation('/setup');
    }
  }, [plan, setLocation]);

  // For pivot, sections are auto-set by commitPivotSetup. For other types, allow manual editing via store.
  // This component reads sections from the store; pivot sections are pre-populated.

  const handleBucketKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-bucket-input]');
      const next = inputs[index + 1];
      if (next) {
        next.focus();
        next.select();
      } else {
        (e.currentTarget as HTMLInputElement).blur();
      }
    }
  }, []);

  const handleCalculate = () => {
    setLocation('/results');
  };

  if (!plan) return null;

  const isPivot = irrigatorType === 'pivot';
  const filledCount = volumes.filter(v => v > 0).length;

  // Build a map of bucket index (0-based) → section name for pivot headers
  const sectionBoundaries: Array<{ bucketIndex: number; label: string }> = [];
  if (isPivot && sections.length > 0) {
    sections.forEach(sec => {
      sectionBoundaries.push({ bucketIndex: sec.fromBucket - 1, label: `${sec.name} (buckets ${sec.fromBucket}–${sec.toBucket})` });
    });
  }

  return (
    <AppLayout step={4} title="Enter Bucket Volumes">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card>
          <CardContent className="pt-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border/50">
              <div className="space-y-3">
                <Label htmlFor="testDate">Test Date</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestConditions(e.target.value, windSpeed)}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="windSpeed">Wind Speed (km/h)</Label>
                <Input
                  id="windSpeed"
                  type="number"
                  min="0"
                  value={windSpeed || ''}
                  onChange={(e) => setTestConditions(testDate, Number(e.target.value))}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-xl font-bold font-display">Bucket Volumes (mL)</h3>
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {filledCount} of {plan.bucketCount} entered
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Press{' '}
                <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded font-mono">Enter</kbd>
                {' '}to move to the next bucket quickly.
              </p>

              <div className="space-y-6">
                {Array.from({ length: plan.bucketCount }).map((_, i) => {
                  const isLast = i === plan.bucketCount - 1;
                  const sectionHeader = sectionBoundaries.find(b => b.bucketIndex === i);

                  // Group into grid rows; we'll use a wrapper per section
                  if (sectionHeader) {
                    return null; // handled below
                  }
                  return null;
                })}

                {(() => {
                  const elements: React.ReactNode[] = [];
                  let i = 0;

                  while (i < plan.bucketCount) {
                    // Check if this bucket starts a new section
                    const header = sectionBoundaries.find(b => b.bucketIndex === i);

                    // Find end of this section (next boundary or end)
                    const nextBoundaryIdx = sectionBoundaries.find(b => b.bucketIndex > i)?.bucketIndex ?? plan.bucketCount;
                    const sectionEnd = header ? nextBoundaryIdx : (sectionBoundaries.find(b => b.bucketIndex > 0)?.bucketIndex ?? plan.bucketCount);

                    if (header) {
                      // Render section header + all buckets until next boundary
                      const sectionBuckets: React.ReactNode[] = [];
                      const startI = i;
                      for (let j = i; j < nextBoundaryIdx; j++) {
                        const isLast = j === plan.bucketCount - 1;
                        sectionBuckets.push(
                          <div key={j} className="space-y-2">
                            <Label htmlFor={`bucket-${j}`} className="text-xs text-muted-foreground">
                              #{j + 1}
                            </Label>
                            <Input
                              id={`bucket-${j}`}
                              type="number"
                              inputMode="decimal"
                              enterKeyHint={isLast ? 'done' : 'next'}
                              data-bucket-input
                              min="0"
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
                        <div key={`section-${startI}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-px flex-1 bg-primary/20" />
                            <span className="text-xs font-bold text-primary uppercase tracking-wide">{header.label}</span>
                            <div className="h-px flex-1 bg-primary/20" />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {sectionBuckets}
                          </div>
                        </div>
                      );
                      i = nextBoundaryIdx;
                    } else {
                      // No section headers — render all buckets in one flat grid
                      const allBuckets: React.ReactNode[] = [];
                      for (let j = 0; j < plan.bucketCount; j++) {
                        const isLast = j === plan.bucketCount - 1;
                        allBuckets.push(
                          <div key={j} className="space-y-2">
                            <Label htmlFor={`bucket-${j}`} className="text-xs text-muted-foreground">
                              Bucket {j + 1}
                            </Label>
                            <Input
                              id={`bucket-${j}`}
                              type="number"
                              inputMode="decimal"
                              enterKeyHint={isLast ? 'done' : 'next'}
                              data-bucket-input
                              min="0"
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
                        <div key="all-buckets" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {allBuckets}
                        </div>
                      );
                      i = plan.bucketCount; // done
                    }
                  }
                  return elements;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual section editor — non-pivot types only */}
        {!isPivot && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold font-display">
                  Define Sections{' '}
                  <span className="text-sm font-normal text-muted-foreground">(optional)</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Optionally break your test into named sections to see per-section results.
                </p>
              </div>
              <ManualSectionEditor
                bucketCount={plan.bucketCount}
                sections={sections}
                setSections={setSections}
              />
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleCalculate}
          disabled={filledCount < 4}
        >
          Calculate Results
        </Button>
        {filledCount < 4 && (
          <p className="text-sm text-center text-muted-foreground -mt-3">
            Enter at least 4 bucket measurements to continue
          </p>
        )}
      </motion.div>
    </AppLayout>
  );
}

function ManualSectionEditor({
  bucketCount,
  sections,
  setSections,
}: {
  bucketCount: number;
  sections: SectionDefinition[];
  setSections: (s: SectionDefinition[]) => void;
}) {
  const updateSection = (index: number, field: keyof SectionDefinition, value: string | number) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const addSection = () => {
    setSections([...sections, { name: '', fromBucket: 1, toBucket: bucketCount }]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {sections.map((sec, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-end">
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">Section Name</Label>}
            <Input value={sec.name} onChange={(e) => updateSection(i, 'name', e.target.value)} placeholder="e.g. Left Side" />
          </div>
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">From #</Label>}
            <Input type="number" min={1} max={bucketCount} value={sec.fromBucket || ''} onChange={(e) => updateSection(i, 'fromBucket', Number(e.target.value))} className="text-center" />
          </div>
          <div className="space-y-1.5">
            {i === 0 && <Label className="text-xs text-muted-foreground">To #</Label>}
            <Input type="number" min={1} max={bucketCount} value={sec.toBucket || ''} onChange={(e) => updateSection(i, 'toBucket', Number(e.target.value))} className="text-center" />
          </div>
          <div className={i === 0 ? 'pt-6' : ''}>
            <button onClick={() => removeSection(i)} className="w-9 h-10 text-muted-foreground hover:text-destructive flex items-center justify-center text-lg">×</button>
          </div>
        </div>
      ))}
      <button onClick={addSection} className="text-sm text-primary hover:underline font-medium">+ Add Section</button>
    </div>
  );
}
