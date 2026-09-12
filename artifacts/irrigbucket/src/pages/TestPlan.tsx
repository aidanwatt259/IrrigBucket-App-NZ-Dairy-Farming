import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Printer, ArrowRight, Info } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { PivotSection } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LayoutDiagram } from '@/components/irrigation/LayoutDiagram';

const NON_PIVOT_DIAGRAM_HINT: Record<string, string> = {
  lateral: 'Lay one line of buckets across the machine width, perpendicular to the direction of travel. The machine passes over the line once.',
  kline: 'Place one bucket beside each pod in a representative set, plus one just beyond each end of the line.',
  gun: 'Lay a line of buckets across the full wetted width, perpendicular to the gun run. Start the first bucket half a spacing in from the edge; overlap into the next lane if the lane is narrower than the wetted width.',
  solid: 'Set a grid of buckets inside one cell bounded by four adjacent sprinkler heads.',
  boom: 'Lay one line of buckets across the boom width, directly under the boom path and perpendicular to travel.',
};

export default function TestPlan() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType, systemParams, pivotSections, commitPivotSetup } = useAppStore();
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [editableSections, setEditableSections] = useState<PivotSection[]>([]);

  useEffect(() => {
    if (!plan) setLocation('/setup');
  }, [plan, setLocation]);

  useEffect(() => {
    if (pivotSections.length > 0) {
      setEditableSections(JSON.parse(JSON.stringify(pivotSections)));
    }
  }, [pivotSections]);

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;

  const toggleCheck = (i: number) => setChecks(prev => { const c = [...prev]; c[i] = !c[i]; return c; });
  const allChecked = checks.every(Boolean);

  const updateBuckets = (index: number, newBuckets: number) => {
    if (newBuckets < 2) return;
    setEditableSections(prev => prev.map((s, i) => {
      if (i !== index) return s;
      const sec = { ...s, buckets: newBuckets };
      if (sec.sectionLength > 0 && newBuckets > 1) {
        sec.spacing = Math.max(1, Math.round((sec.sectionLength / (newBuckets - 1)) * 10) / 10);
      }
      return sec;
    }));
  };

  const updateSpacing = (index: number, newSpacing: number) => {
    if (newSpacing < 1) return;
    setEditableSections(prev => prev.map((s, i) => {
      if (i !== index) return s;
      const sec = { ...s, spacing: newSpacing };
      if (sec.sectionLength > 0) {
        sec.buckets = Math.max(2, Math.floor(sec.sectionLength / newSpacing) + 1);
      }
      return sec;
    }));
  };

  const handleProceed = () => {
    if (isPivot && editableSections.length > 0) {
      commitPivotSetup(editableSections);
      setLocation('/operation');
    } else {
      setLocation('/data');
    }
  };

  if (!plan) return null;

  const activeSections = editableSections.filter(s => !s.isExcluded);
  const totalBuckets = activeSections.reduce((sum, s) => sum + s.buckets, 0);
  const hasGun = editableSections.some(s => s.isGun);
  const gunSection = editableSections.find(s => s.isGun);
  const sectionAEnd = editableSections.find(s => s.isExcluded)?.to ?? 0;

  const pivotChecklist = [
    "Wind speed is below 15 km/h",
    "System is running at normal operating pressure",
    "Buckets are identical and level",
    `Place all ${totalBuckets} buckets in a straight RADIAL line from the ${sectionAEnd}m mark to the pivot tip`,
    "Keep all buckets at least 15m from any wheel tracks",
  ];

  const standardChecklist = [
    "Wind speed is below 15 km/h",
    "System is running at normal operating pressure",
    "Buckets are identical and level",
    "Ready to start timer when water hits first bucket",
    "Buckets are evenly spaced as shown above",
  ];

  const checklist = isPivot ? pivotChecklist : standardChecklist;

  return (
    <AppLayout step={3} totalSteps={totalSteps} title="Bucket Test Plan">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {isPivot && editableSections.length > 0 ? (
          <>
            {/* Section A exclusion info box */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-bold mb-1">Why the inner section is excluded (Section A, 0–{sectionAEnd}m)</p>
                    <p>Near the pivot point, ground speed approaches zero — causing extremely high application depths that would distort the DU calculation. Industry practice is to begin testing from the ¼-point outward.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pivot Diagram */}
            <Card>
              <CardContent className="pt-5 pb-3">
                <h3 className="text-base font-bold font-display mb-3">Pivot Layout Diagram</h3>
                <LayoutDiagram type="pivot" params={systemParams} plan={plan} pivotSections={editableSections} />
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" /> Section A — no testing</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400 inline-block" /> Section B — mid spans</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-500 inline-block" /> Section C — outer spans</span>
                  {hasGun && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-400 inline-block" /> End Gun</span>}
                </div>
              </CardContent>
            </Card>

            {/* Editable Section Table */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold font-display mb-2">Section Breakdown</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Based on your {plan.armLength}m pivot. Adjust bucket counts if needed — spacing recalculates automatically.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Section</th>
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Range</th>
                        <th className="text-center py-2 pr-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Buckets</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Spacing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableSections.map((sec, i) => (
                        <tr key={i} className={`border-b border-border/50 last:border-0 ${sec.isExcluded ? 'opacity-50' : ''}`}>
                          <td className="py-3 pr-3 font-medium text-sm">{sec.name}</td>
                          <td className="py-3 pr-3 text-muted-foreground text-xs">
                            {sec.isGun ? `Beyond ${plan.armLength}m` : `${sec.from}–${sec.to}m`}
                          </td>
                          {sec.isExcluded ? (
                            <>
                              <td className="py-3 pr-3 text-center text-muted-foreground italic text-sm" colSpan={2}>No testing — inner zone excluded</td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 pr-3">
                                <Input type="number" min={2} max={100} className="w-20 text-center mx-auto h-9"
                                  value={sec.buckets}
                                  onChange={(e) => updateBuckets(i, Number(e.target.value))} />
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1 justify-center">
                                  <Input type="number" min={1} className="w-20 text-center h-9"
                                    value={sec.spacing}
                                    onChange={(e) => updateSpacing(i, Number(e.target.value))} />
                                  <span className="text-muted-foreground text-xs">m</span>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr className="font-bold bg-muted/20">
                        <td className="pt-3 pb-2 pr-3 text-sm">Total</td>
                        <td className="pt-3 pb-2 pr-3 text-muted-foreground text-xs">{editableSections.find(s => !s.isExcluded)?.from}m → tip</td>
                        <td className="pt-3 pb-2 text-center text-primary text-xl font-extrabold font-display">{totalBuckets}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
                  Tip: 40–50 total buckets is the professional standard for nozzle-level accuracy. More buckets = more precision; fewer = quicker test.
                </p>
              </CardContent>
            </Card>

            {/* Gun guidance */}
            {hasGun && gunSection && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-5 pb-4">
                  <p className="font-bold text-orange-900 mb-2">End Gun Test</p>
                  <p className="text-sm text-orange-800">
                    Your end gun will be tested with <strong>{gunSection.buckets} buckets</strong> placed beyond the pivot tip,
                    spaced <strong>{gunSection.spacing}m apart</strong>. Place these in a radial line extending beyond the end tower.
                    The first gun bucket starts just beyond {plan.armLength}m.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Non-pivot layout */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-8 text-center">
                  <div className="text-6xl font-display font-extrabold text-primary mb-2">{plan.bucketCount}</div>
                  <p className="text-lg font-semibold">Total Buckets Required</p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/5 border-secondary/20">
                <CardContent className="pt-8 text-center">
                  <div className="text-6xl font-display font-extrabold text-secondary mb-2">
                    {plan.spacing}<span className="text-3xl ml-1">m</span>
                  </div>
                  <p className="text-lg font-semibold">Spacing Between Buckets</p>
                </CardContent>
              </Card>
            </div>
            {/* Bucket layout diagram */}
            <Card>
              <CardContent className="pt-5 pb-3">
                <h3 className="text-base font-bold font-display mb-3">Bucket Layout Diagram</h3>
                <LayoutDiagram type={irrigatorType ?? ''} params={systemParams} plan={plan} />
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Bucket position</span>
                  {(irrigatorType === 'kline' || irrigatorType === 'solid') && (
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-teal-600 inline-block" /> {irrigatorType === 'kline' ? 'Pod' : 'Sprinkler head'}</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-8">
                <h3 className="text-xl font-bold font-display mb-4">Placement Pattern</h3>
                <p className="text-lg text-muted-foreground">{plan.pattern}</p>
                {irrigatorType && NON_PIVOT_DIAGRAM_HINT[irrigatorType] && (
                  <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/50">{NON_PIVOT_DIAGRAM_HINT[irrigatorType]}</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Pre-Test Checklist */}
        <Card className="border-warning/50">
          <CardContent className="pt-8">
            <h3 className="text-xl font-bold font-display mb-6">Pre-Test Checklist</h3>
            <div className="space-y-4">
              {checklist.map((text, i) => (
                <div key={i} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox id={`check-${i}`} checked={checks[i]} onCheckedChange={() => toggleCheck(i)} className="mt-0.5" />
                  <Label htmlFor={`check-${i}`} className="text-base font-medium cursor-pointer flex-1 leading-snug">{text}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => window.print()}>
            <Printer className="w-5 h-5 mr-2" />
            Print Plan
          </Button>
          <Button size="lg" className="flex-1" disabled={!allChecked} onClick={handleProceed}>
            {isPivot ? 'Record Machine Operation' : "I've Completed the Test"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
