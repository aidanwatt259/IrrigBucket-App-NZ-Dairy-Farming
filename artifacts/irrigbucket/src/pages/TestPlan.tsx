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

// Colour scheme for the pivot sections
const SECTION_COLORS = {
  A: { fill: '#e2e8f0', text: '#94a3b8', label: 'No testing zone' },
  B: { fill: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', dot: '#3b82f6' },
  C: { fill: '#ccfbf1', border: '#0d9488', text: '#0f766e', dot: '#0d9488' },
  gun: { fill: '#ffedd5', border: '#f97316', text: '#c2410c', dot: '#f97316' },
};

function PivotDiagram({ pivotSections, armLength }: { pivotSections: PivotSection[]; armLength: number }) {
  const W = 400; const H = 100;
  const ML = 20; const MR = 20;
  const armW = W - ML - MR;
  const hasGun = pivotSections.some(s => s.isGun);

  const getX = (m: number) => ML + (m / (hasGun ? (armLength + 25) : armLength)) * armW;

  const sectionA = pivotSections.find(s => s.isExcluded);
  const sectionB = pivotSections.find(s => !s.isExcluded && !s.isGun && pivotSections.filter(x => !x.isExcluded && !x.isGun).indexOf(s) === 0);
  const sectionC = pivotSections.find(s => !s.isExcluded && !s.isGun && pivotSections.filter(x => !x.isExcluded && !x.isGun).indexOf(s) === 1);
  const sectionGun = pivotSections.find(s => s.isGun);

  const renderDots = (sec: PivotSection, color: string) => {
    const dots: React.ReactNode[] = [];
    const maxDots = Math.min(sec.buckets, 15);
    for (let i = 0; i < maxDots; i++) {
      const pos = sec.from + (sec.buckets === 1 ? 0 : i * (sec.sectionLength / (sec.buckets - 1)));
      dots.push(
        <circle key={i} cx={getX(pos)} cy={55} r={3.5} fill={color} />
      );
    }
    return dots;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Pivot section diagram">
      {/* Ground line */}
      <line x1={ML} y1={60} x2={W - MR} y2={60} stroke="#94a3b8" strokeWidth={3} />

      {/* Section A — grey */}
      {sectionA && (
        <rect x={getX(sectionA.from)} y={45} width={getX(sectionA.to) - getX(sectionA.from)} height={15}
          fill={SECTION_COLORS.A.fill} rx={2} />
      )}
      {/* Section B — blue */}
      {sectionB && (
        <rect x={getX(sectionB.from)} y={45} width={getX(sectionB.to) - getX(sectionB.from)} height={15}
          fill={SECTION_COLORS.B.fill} stroke={SECTION_COLORS.B.border} strokeWidth={1} rx={2} />
      )}
      {/* Section C — teal */}
      {sectionC && (
        <rect x={getX(sectionC.from)} y={45} width={getX(sectionC.to) - getX(sectionC.from)} height={15}
          fill={SECTION_COLORS.C.fill} stroke={SECTION_COLORS.C.border} strokeWidth={1} rx={2} />
      )}
      {/* End Gun — orange */}
      {sectionGun && (
        <rect x={getX(sectionGun.from)} y={45} width={getX(sectionGun.to) - getX(sectionGun.from)} height={15}
          fill={SECTION_COLORS.gun.fill} stroke={SECTION_COLORS.gun.border} strokeWidth={1} rx={2} />
      )}

      {/* Bucket dots */}
      {sectionB && renderDots(sectionB, SECTION_COLORS.B.dot!)}
      {sectionC && renderDots(sectionC, SECTION_COLORS.C.dot!)}
      {sectionGun && renderDots(sectionGun, SECTION_COLORS.gun.dot!)}

      {/* Pivot centre mark */}
      <circle cx={ML} cy={60} r={5} fill="#1e293b" />
      <text x={ML} y={80} textAnchor="middle" fill="#64748b" fontSize={9}>Centre</text>

      {/* End tower mark */}
      <line x1={getX(armLength)} y1={40} x2={getX(armLength)} y2={70} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3,2" />
      <text x={getX(armLength)} y={82} textAnchor="middle" fill="#64748b" fontSize={9}>Tip</text>

      {/* Section labels */}
      {sectionA && (
        <text x={(getX(sectionA.from) + getX(sectionA.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.A.text} fontSize={8} fontWeight="bold">A</text>
      )}
      {sectionB && (
        <text x={(getX(sectionB.from) + getX(sectionB.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.B.text} fontSize={8} fontWeight="bold">B</text>
      )}
      {sectionC && (
        <text x={(getX(sectionC.from) + getX(sectionC.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.C.text} fontSize={8} fontWeight="bold">C</text>
      )}
      {sectionGun && (
        <text x={(getX(sectionGun.from) + getX(sectionGun.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.gun.text} fontSize={8} fontWeight="bold">Gun</text>
      )}
    </svg>
  );
}

export default function TestPlan() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType, pivotSections, commitPivotSetup } = useAppStore();
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
                <PivotDiagram pivotSections={editableSections} armLength={plan.armLength ?? 400} />
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
            <Card>
              <CardContent className="pt-8">
                <h3 className="text-xl font-bold font-display mb-4">Placement Pattern</h3>
                <p className="text-lg text-muted-foreground">{plan.pattern}</p>
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
