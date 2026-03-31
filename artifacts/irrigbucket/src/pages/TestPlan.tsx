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

export default function TestPlan() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType, pivotSections, commitPivotSetup, systemParams } = useAppStore();
  const [checks, setChecks] = useState([false, false, false, false]);
  const [editableSections, setEditableSections] = useState<PivotSection[]>([]);

  useEffect(() => {
    if (!plan) {
      setLocation('/setup');
    }
  }, [plan, setLocation]);

  useEffect(() => {
    if (pivotSections.length > 0) {
      setEditableSections(JSON.parse(JSON.stringify(pivotSections)));
    }
  }, [pivotSections]);

  const allChecked = checks.every(Boolean);
  const toggleCheck = (i: number) => setChecks(prev => { const c = [...prev]; c[i] = !c[i]; return c; });

  const updateBuckets = (index: number, newBuckets: number) => {
    if (newBuckets < 2) return;
    setEditableSections(prev => {
      const updated = [...prev];
      const sec = { ...updated[index] };
      sec.buckets = newBuckets;
      sec.spacing = Math.max(1, Math.round((sec.sectionLength / (newBuckets - 1)) * 10) / 10);
      updated[index] = sec;
      return updated;
    });
  };

  const updateSpacing = (index: number, newSpacing: number) => {
    if (newSpacing < 1) return;
    setEditableSections(prev => {
      const updated = [...prev];
      const sec = { ...updated[index] };
      sec.spacing = newSpacing;
      sec.buckets = Math.max(2, Math.floor(sec.sectionLength / newSpacing) + 1);
      updated[index] = sec;
      return updated;
    });
  };

  const handleProceed = () => {
    if (irrigatorType === 'pivot' && editableSections.length > 0) {
      commitPivotSetup(editableSections);
    }
    setLocation('/data');
  };

  if (!plan) return null;

  const isPivot = irrigatorType === 'pivot';
  const startOffset = plan.startOffset ?? 0;
  const totalBuckets = isPivot && editableSections.length > 0
    ? editableSections.reduce((sum, s) => sum + s.buckets, 0)
    : plan.bucketCount;
  const hasGun = editableSections.some(s => s.isGun);
  const gunSection = editableSections.find(s => s.isGun);

  return (
    <AppLayout step={3} title="Bucket Test Plan">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >

        {/* ---- PIVOT: Editable Setup Table ---- */}
        {isPivot && editableSections.length > 0 ? (
          <>
            <Card className="border-primary/20 bg-primary/3">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold font-display mb-2">Your Recommended Test Setup</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Based on your pivot ({plan.armLength}m, {plan.numSpans} spans), the first 2 spans
                  ({startOffset}m) are skipped — that area rotates too slowly for reliable measurements.
                  Buckets are placed from {startOffset}m out to the tip. You can adjust bucket counts
                  and spacings below.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Section</th>
                        <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">From</th>
                        <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">To</th>
                        <th className="text-center py-2 pr-4 font-semibold text-muted-foreground">Buckets</th>
                        <th className="text-center py-2 font-semibold text-muted-foreground">Spacing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableSections.map((sec, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-3 pr-4 font-medium">{sec.name}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {sec.isGun ? 'perpendicular' : `${sec.from}m`}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {sec.isGun ? `${sec.to}m wide` : `${sec.to}m`}
                          </td>
                          <td className="py-3 pr-4">
                            <Input
                              type="number"
                              min={2}
                              max={100}
                              className="w-20 text-center mx-auto"
                              value={sec.buckets}
                              onChange={(e) => updateBuckets(i, Number(e.target.value))}
                            />
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                type="number"
                                min={1}
                                className="w-20 text-center"
                                value={sec.spacing}
                                onChange={(e) => updateSpacing(i, Number(e.target.value))}
                              />
                              <span className="text-muted-foreground text-xs">m</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="pt-3 pr-4">Total</td>
                        <td colSpan={2} />
                        <td className="pt-3 pr-4 text-center text-primary text-lg">{totalBuckets}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                  Tip: More buckets = more precise results. Fewer buckets = quicker test. 40–50 total is the professional standard for nozzle-level accuracy.
                </p>
              </CardContent>
            </Card>

            {/* Gun guidance card */}
            {hasGun && gunSection && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-5">
                  <p className="font-bold text-blue-900 mb-2">End Gun Test</p>
                  <p className="text-sm text-blue-800">
                    Your pivot's end gun will be tested with <strong>{gunSection.buckets} buckets</strong> placed
                    across its <strong>{gunSection.to}m</strong> throw width. Place these buckets in a line{' '}
                    <strong>perpendicular to the pivot arm</strong> at the gun's position, spanning from
                    outside (away from pivot) to inside (toward pivot). Label the outside buckets as "Left"
                    and inside buckets as "Right" for the section analysis.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Placement guidance */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-primary shrink-0" />
                  <h3 className="text-lg font-bold font-display">Placement Instructions</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {plan.pattern}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          /* ---- NON-PIVOT: Original layout ---- */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-8 text-center">
                  <div className="text-6xl font-display font-extrabold text-primary mb-2">
                    {plan.bucketCount}
                  </div>
                  <p className="text-lg font-semibold text-foreground">Total Buckets Required</p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/5 border-secondary/20">
                <CardContent className="pt-8 text-center">
                  <div className="text-6xl font-display font-extrabold text-secondary mb-2">
                    {plan.spacing}<span className="text-3xl ml-1">m</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">Spacing Between Buckets</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-8">
                <h3 className="text-xl font-bold font-display mb-4">Placement Pattern</h3>
                <p className="text-lg text-muted-foreground mb-8">{plan.pattern}</p>
                <div className="bg-muted/30 rounded-xl p-8 flex justify-center items-center overflow-hidden border border-border/50">
                  <svg width="100%" height="120" viewBox="0 0 400 120" className="max-w-full">
                    <line x1="0" y1="100" x2="400" y2="100" stroke="#cbd5e1" strokeWidth="4" />
                    {Array.from({ length: Math.min(plan.bucketCount, 12) }).map((_, i, arr) => {
                      const x = 40 + (i * (320 / (arr.length - 1 || 1)));
                      return (
                        <g key={i} transform={`translate(${x}, 85)`}>
                          <path d="M-10,0 L10,0 L7,15 L-7,15 Z" fill="#0ea5e9" opacity="0.8" />
                          <circle cx="0" cy="-20" r="4" fill="#15803d" opacity={i % 2 === 0 ? 0 : 0.4} />
                          <circle cx="-5" cy="-10" r="3" fill="#15803d" opacity={i % 3 === 0 ? 0 : 0.3} />
                          <circle cx="5" cy="-30" r="5" fill="#15803d" opacity={i % 2 !== 0 ? 0 : 0.5} />
                        </g>
                      );
                    })}
                    {plan.bucketCount > 12 && (
                      <text x="200" y="60" textAnchor="middle" fill="#64748b" fontSize="14" fontWeight="bold">
                        ... + {plan.bucketCount - 12} more buckets
                      </text>
                    )}
                    <line x1="40" y1="115" x2={40 + (320 / (Math.min(plan.bucketCount, 12) - 1 || 1))} y2="115" stroke="#64748b" strokeWidth="2" />
                    <text x={40 + (160 / (Math.min(plan.bucketCount, 12) - 1 || 1))} y="135" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">
                      {plan.spacing}m
                    </text>
                  </svg>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-warning/50">
          <CardContent className="pt-8">
            <h3 className="text-xl font-bold font-display mb-6">Pre-Test Checklist</h3>
            <div className="space-y-4">
              {[
                "Wind speed is below 15 km/h",
                "System is running at normal operating pressure",
                "Buckets are identical and level",
                "Ready to start timer when water hits first bucket"
              ].map((text, i) => (
                <div key={i} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox id={`check-${i}`} checked={checks[i]} onCheckedChange={() => toggleCheck(i)} />
                  <Label htmlFor={`check-${i}`} className="text-base font-medium cursor-pointer flex-1">
                    {text}
                  </Label>
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
          <Button
            size="lg"
            className="flex-1"
            disabled={!allChecked}
            onClick={handleProceed}
          >
            I've Completed the Test
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
