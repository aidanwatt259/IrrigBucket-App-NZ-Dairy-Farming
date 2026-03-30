import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Printer, RotateCcw, AlertTriangle, CheckCircle, Info, Wind } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useAppStore } from '@/lib/store';
import { calculateTestResults, populationStdDev } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function StatusBadge({ status, labels }: { status: 'good' | 'fair' | 'poor'; labels?: { good: string; fair: string; poor: string } }) {
  const text = labels
    ? labels[status]
    : status === 'good' ? 'Pass' : status === 'fair' ? 'Attention' : 'Fail';

  const classes = {
    good: 'bg-green-100 text-green-800 border-green-200',
    fair: 'bg-amber-100 text-amber-800 border-amber-200',
    poor: 'bg-red-100 text-red-800 border-red-200',
  }[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${classes}`}>
      {text}
    </span>
  );
}

export default function Results() {
  const [, setLocation] = useLocation();
  const { volumes, systemParams, plan, windSpeed, testDate, sections, irrigatorType, reset } = useAppStore();

  useEffect(() => {
    if (!plan || volumes.length === 0) {
      setLocation('/');
    }
  }, [plan, volumes, setLocation]);

  const results = useMemo(() => {
    return calculateTestResults(volumes, systemParams.diameter, systemParams.targetDepth, sections);
  }, [volumes, systemParams.diameter, systemParams.targetDepth, sections]);

  const handleNewTest = () => {
    reset();
    setLocation('/');
  };

  if (!plan || !results) return null;

  const duPct = results.du * 100;
  const stdDev = populationStdDev(results.validVolumes);
  const mean = results.avgVolume;

  // DU Banner config
  const duConfig = {
    good: { text: 'Pass', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
    fair: { text: 'Attention Required', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Info },
    poor: { text: 'Fail — Action Needed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  }[results.duStatus];

  // Chart data — highlight outliers (>1 StdDev from mean)
  const chartData = results.allVolumes
    .map((vol, i) => {
      if (vol <= 0) return null;
      const depth = (1000 * vol) / results.bucketArea;
      const isOutlier = Math.abs(vol - mean) > stdDev;
      return { name: `${i + 1}`, depth: Number(depth.toFixed(1)), isOutlier };
    })
    .filter(Boolean) as { name: string; depth: number; isOutlier: boolean }[];

  // Outlier bucket numbers (below mean by >1 StdDev)
  const lowBuckets = results.allVolumes
    .map((v, i) => ({ v, i: i + 1 }))
    .filter(({ v }) => v > 0 && v < mean - stdDev)
    .map(({ i }) => i);

  return (
    <AppLayout step={5} title="Test Results" showBack={false}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* DU Rating Banner */}
        <Card className={`${duConfig.bg} ${duConfig.border} border-2`}>
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full bg-white shadow-sm ${duConfig.color}`}>
                <duConfig.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Distribution Uniformity</p>
                <h2 className={`text-2xl font-display font-bold ${duConfig.color}`}>{duConfig.text}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">DU = 1 − CV (NZ industry standard)</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-5xl font-bold font-display ${duConfig.color}`}>
                {duPct.toFixed(1)}<span className="text-2xl ml-0.5">%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {results.duStatus === 'good' ? '≥ 80% Pass' : results.duStatus === 'fair' ? '65–79% Attention' : '< 65% Fail'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary line */}
        <p className="text-sm text-muted-foreground text-center">
          {irrigatorType === 'pivot' ? 'Centre Pivot' : plan.pattern.split(' ')[0]} •{' '}
          Tested {testDate ? new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'}
          {windSpeed ? ` • Wind: ${windSpeed} km/h` : ''}
        </p>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Applied Depth (avg)</p>
              <p className="text-2xl font-bold font-display">{results.avgDepth.toFixed(1)} <span className="text-sm font-normal">mm</span></p>
              <p className="text-xs text-muted-foreground mt-1">Target: {results.targetDepth} mm</p>
              <div className="mt-2">
                <StatusBadge status={results.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Buckets Tested</p>
              <p className="text-2xl font-bold font-display">{results.validVolumes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">of {plan.bucketCount} placed</p>
            </CardContent>
          </Card>
        </div>

        {/* Section Breakdown — Centre Pivot only */}
        {results.sections.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold font-display mb-4">Section Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Section</th>
                      <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Buckets</th>
                      <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">DU</th>
                      <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Depth</th>
                      <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.sections.map((sec, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-3 font-semibold">{sec.name}</td>
                        <td className="py-3 px-3 text-center text-muted-foreground">{sec.bucketCount}</td>
                        <td className={`py-3 px-3 text-center font-bold ${
                          sec.duStatus === 'good' ? 'text-green-700' : sec.duStatus === 'fair' ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {(sec.du * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge status={sec.duStatus} />
                        </td>
                        <td className="py-3 px-3 text-center">{sec.avgDepth.toFixed(1)} mm</td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge status={sec.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Pass ≥ 80% &nbsp;|&nbsp; Attention 65–79% &nbsp;|&nbsp; Fail &lt; 65%
              </p>
            </CardContent>
          </Card>
        )}

        {/* Bar Chart */}
        <Card>
          <CardContent className="pt-6 pb-4 px-2 sm:px-6">
            <h3 className="text-lg font-bold font-display mb-2 px-4">Application Depth Profile</h3>
            <p className="text-xs text-muted-foreground px-4 mb-4">Orange bars are outliers — more than 1 standard deviation from the average.</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${value} mm`, 'Depth']}
                    labelFormatter={(label) => `Bucket ${label}`}
                  />
                  <ReferenceLine y={results.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={2}
                    label={{ position: 'top', value: 'Target', fill: '#15803d', fontSize: 11, fontWeight: 'bold' }}
                  />
                  <ReferenceLine y={results.avgDepth} stroke="#0ea5e9" strokeWidth={2}
                    label={{ position: 'bottom', value: 'Average', fill: '#0ea5e9', fontSize: 11, fontWeight: 'bold' }}
                  />
                  <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isOutlier ? '#ea580c' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-400"></div> Normal</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-600"></div> Outlier (&gt;1 StdDev)</div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold font-display mb-4">Recommendations</h3>
            <ul className="space-y-4">

              {/* DU outcome */}
              {results.duStatus === 'good' && (
                <li className="flex items-start gap-3 text-green-700">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Great uniformity (DU {duPct.toFixed(1)}%). Your system is distributing water evenly across the tested area.</span>
                </li>
              )}
              {results.duStatus === 'fair' && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Uniformity needs attention (DU {duPct.toFixed(1)}%). Some areas are receiving noticeably less water. Check for worn or partially blocked nozzles.</span>
                </li>
              )}
              {results.duStatus === 'poor' && (
                <li className="flex items-start gap-3 text-red-700">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Uniformity test failed (DU {duPct.toFixed(1)}%). Water application is very uneven. Inspect all nozzles, check operating pressure, and look for leaks or blockages.</span>
                </li>
              )}

              {/* Section-specific issues */}
              {results.sections.filter(s => s.duStatus !== 'good').map((sec, i) => (
                <li key={i} className={`flex items-start gap-3 ${sec.duStatus === 'fair' ? 'text-amber-700' : 'text-red-700'}`}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {sec.name} section {sec.duStatus === 'fair' ? 'needs attention' : 'failed'} (DU {(sec.du * 100).toFixed(1)}%). Inspect nozzles in this section specifically.
                  </span>
                </li>
              ))}

              {/* Depth outcome */}
              {results.depthStatus === 'good' && (
                <li className="flex items-start gap-3 text-green-700">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is within 10% of your target ({results.targetDepth} mm). Well calibrated.</span>
                </li>
              )}
              {results.depthStatus === 'fair' && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is {results.depthDiff.toFixed(0)}% off your target. Consider adjusting travel speed or pressure.</span>
                </li>
              )}
              {results.depthStatus === 'poor' && (
                <li className="flex items-start gap-3 text-red-700">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is {results.depthDiff.toFixed(0)}% off your target. System needs recalibration — check flow rate, travel speed, and nozzle sizing.</span>
                </li>
              )}

              {/* Outlier buckets */}
              {lowBuckets.length > 0 && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Buckets {lowBuckets.join(', ')} collected significantly less water (more than 1 standard deviation below average). Inspect the nozzle(s) nearest these positions for blockages or wear.</span>
                </li>
              )}

              {/* Wind warning */}
              {windSpeed > 15 && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Wind className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Wind was {windSpeed} km/h — above the recommended 15 km/h limit. Results may be less reliable. Consider re-testing on a calmer day.</span>
                </li>
              )}

              {/* Always show */}
              <li className="flex items-start gap-3 text-foreground">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                <span className="font-medium">
                  Test recorded {testDate ? `on ${new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'today'}. Keep this record — DairyNZ recommends testing every 12 months.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => window.print()}>
            <Printer className="w-5 h-5 mr-2" />
            Export Report
          </Button>
          <Button size="lg" className="flex-1" onClick={handleNewTest}>
            <RotateCcw className="w-5 h-5 mr-2" />
            Start New Test
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
