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

// Section colour palette for the bar chart
const SECTION_BAR_COLORS: Record<string, string> = {
  'Section B (Mid spans)': '#3b82f6',
  'Section C (Outer spans)': '#0d9488',
  'End Gun': '#f97316',
};

function getSectionColor(bucketIdx: number, sections: Array<{ fromBucket: number; toBucket: number; name: string }>): string {
  for (const s of sections) {
    if (bucketIdx >= s.fromBucket - 1 && bucketIdx < s.toBucket) {
      return SECTION_BAR_COLORS[s.name] ?? '#94a3b8';
    }
  }
  return '#94a3b8';
}

function StatusBadge({ status, labels }: { status: 'good' | 'fair' | 'poor'; labels?: { good: string; fair: string; poor: string } }) {
  const text = labels ? labels[status] : status === 'good' ? 'Pass' : status === 'fair' ? 'Attention' : 'Fail';
  const cls = { good: 'bg-green-100 text-green-800 border-green-200', fair: 'bg-amber-100 text-amber-800 border-amber-200', poor: 'bg-red-100 text-red-800 border-red-200' }[status];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{text}</span>;
}

function DataRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-4 text-muted-foreground text-sm font-medium">{label}</td>
      <td className="py-2 text-sm font-semibold">{value}</td>
    </tr>
  );
}

export default function Results() {
  const [, setLocation] = useLocation();
  const {
    volumes, systemParams, plan, windSpeed, testDate,
    sections, irrigatorType, operationData, reset,
  } = useAppStore();

  useEffect(() => {
    if (!plan || volumes.length === 0) setLocation('/');
  }, [plan, volumes, setLocation]);

  const results = useMemo(() =>
    calculateTestResults(volumes, systemParams.diameter, systemParams.targetDepth, sections),
    [volumes, systemParams.diameter, systemParams.targetDepth, sections]
  );

  if (!plan || !results) return null;

  const isPivot = irrigatorType === 'pivot';
  const totalSteps = isPivot ? 6 : 5;
  const duPct = results.du * 100;
  const mean = results.avgVolume;
  const stdDev = populationStdDev(results.validVolumes);

  const duConfig = {
    good: { text: 'Pass', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
    fair: { text: 'Attention Required', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Info },
    poor: { text: 'Fail — Action Needed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  }[results.duStatus];

  // Chart data with section colour coding
  const chartData = results.allVolumes
    .map((vol, i) => {
      if (vol <= 0) return null;
      const depth = (1000 * vol) / results.bucketArea;
      const isOutlier = Math.abs(vol - mean) > stdDev;
      const sectionColor = getSectionColor(i, sections);
      return { name: `${i + 1}`, depth: Number(depth.toFixed(1)), isOutlier, sectionColor };
    })
    .filter(Boolean) as { name: string; depth: number; isOutlier: boolean; sectionColor: string }[];

  const lowBuckets = results.allVolumes
    .map((v, i) => ({ v, i: i + 1 }))
    .filter(({ v }) => v > 0 && v < mean - stdDev)
    .map(({ i }) => i);

  // Application intensity (mm/hr) from revolution time if available
  const revolutionTime = systemParams.revolutionTime;
  const intensity = (revolutionTime && results.avgDepth > 0)
    ? (results.avgDepth / revolutionTime).toFixed(2)
    : null;

  return (
    <AppLayout step={totalSteps} totalSteps={totalSteps} title="Test Results" showBack={false}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* DU Banner */}
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
          {isPivot ? 'Centre Pivot' : 'Irrigator'} •{' '}
          {testDate ? new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'}
          {windSpeed ? ` • Wind: ${windSpeed} km/h` : ''}
          {operationData.farmName ? ` • ${operationData.farmName}` : ''}
        </p>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Applied Depth (avg)</p>
              <p className="text-2xl font-bold font-display">{results.avgDepth.toFixed(1)} <span className="text-sm font-normal">mm</span></p>
              <p className="text-xs text-muted-foreground mt-1">Target: {results.targetDepth} mm</p>
              <div className="mt-2"><StatusBadge status={results.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Buckets Tested</p>
              <p className="text-2xl font-bold font-display">{results.validVolumes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">of {plan.bucketCount} placed</p>
              {intensity && (
                <p className="text-xs text-muted-foreground mt-1">Intensity: {intensity} mm/hr</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section Breakdown */}
        {results.sections.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold font-display mb-4">Section Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Section</th>
                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Buckets</th>
                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">DU</th>
                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Avg Depth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.sections.map((sec, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-2 font-semibold text-sm">{sec.name}</td>
                        <td className="py-3 px-2 text-center text-muted-foreground">{sec.bucketCount}</td>
                        <td className={`py-3 px-2 text-center font-bold ${isNaN(sec.du) ? 'text-muted-foreground' : sec.duStatus === 'good' ? 'text-green-700' : sec.duStatus === 'fair' ? 'text-amber-700' : 'text-red-700'}`}>
                          {isNaN(sec.du) ? '—' : `${(sec.du * 100).toFixed(1)}%`}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {isNaN(sec.du) ? <span className="text-muted-foreground text-xs">n/a</span> : <StatusBadge status={sec.duStatus} />}
                        </td>
                        <td className="py-3 px-2 text-center">{sec.avgDepth.toFixed(1)} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Pass ≥ 80% | Attention 65–79% | Fail &lt; 65%</p>
            </CardContent>
          </Card>
        )}

        {/* Bar Chart */}
        <Card>
          <CardContent className="pt-6 pb-4 px-2 sm:px-6">
            <h3 className="text-lg font-bold font-display mb-2 px-4">Application Depth Profile</h3>
            <p className="text-xs text-muted-foreground px-4 mb-4">
              {isPivot ? 'Bars are colour-coded by section. ' : ''}
              Orange/red bars are outliers — more than 1 standard deviation from the average.
            </p>
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
                    label={{ position: 'top', value: 'Target', fill: '#15803d', fontSize: 11, fontWeight: 'bold' }} />
                  <ReferenceLine y={results.avgDepth} stroke="#0ea5e9" strokeWidth={2}
                    label={{ position: 'bottom', value: 'Average', fill: '#0ea5e9', fontSize: 11, fontWeight: 'bold' }} />
                  <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isOutlier ? '#dc2626' : entry.sectionColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs text-muted-foreground font-medium">
              {isPivot && sections.length > 0 ? (
                <>
                  {sections.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: SECTION_BAR_COLORS[s.name] ?? '#94a3b8' }} />
                      {s.name}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600" /> Outlier (&gt;1 StdDev)</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-400" /> Normal</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600" /> Outlier (&gt;1 StdDev)</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recorded Bucket Volumes (by section for pivot) */}
        {isPivot && sections.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold font-display mb-4">Recorded Bucket Volumes</h3>
              <div className="space-y-5">
                {sections.map((sec) => {
                  const secVolumes = volumes.slice(sec.fromBucket - 1, sec.toBucket);
                  return (
                    <div key={sec.name}>
                      <p className="text-sm font-bold text-muted-foreground mb-2">{sec.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {secVolumes.map((v, j) => (
                          <span key={j} className={`text-xs px-2 py-1 rounded font-mono ${v <= 0 ? 'bg-muted text-muted-foreground' : 'bg-slate-100 text-slate-700'}`}>
                            #{sec.fromBucket + j}: {v > 0 ? `${v}mL` : '—'}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logged Operational Data — pivot only */}
        {isPivot && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold font-display mb-4">Test Parameters</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody>
                    <DataRow label="Pivot Length" value={plan.armLength ? `${plan.armLength} m` : null} />
                    <DataRow label="Bucket Diameter" value={`${systemParams.diameter} mm`} />
                    <DataRow label="Target Depth" value={`${systemParams.targetDepth} mm`} />
                    {systemParams.operatingPressure && <DataRow label="Operating Pressure" value={`${systemParams.operatingPressure} bar`} />}
                    {systemParams.flowRate && <DataRow label="Flow Rate" value={`${systemParams.flowRate} L/s`} />}
                    {systemParams.numSprinklers && <DataRow label="Total Sprinklers" value={systemParams.numSprinklers} />}
                    <DataRow label="Farm" value={operationData.farmName} />
                    <DataRow label="Irrigator" value={operationData.irrigatorName} />
                    <DataRow label="Assessor" value={operationData.assessorName} />
                    <DataRow label="Test Date" value={testDate ? new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
                    <DataRow label="Start Time" value={operationData.testStartTime} />
                    <DataRow label="End Time" value={operationData.testEndTime} />
                    <DataRow label="Inlet Pressure" value={operationData.inletPressure ? `${operationData.inletPressure} kPa` : null} />
                    <DataRow label="Actual Speed" value={operationData.actualSpeed ? `${operationData.actualSpeed} m/min` : null} />
                    <DataRow label="Percent Timer" value={operationData.percentTimer ? `${operationData.percentTimer}%` : null} />
                    <DataRow label="Speed Test" value={operationData.speedTestDistance && operationData.speedTestTime ? `${operationData.speedTestDistance}m in ${operationData.speedTestTime}` : null} />
                    <DataRow label="Wetted Width" value={operationData.wettedWidth ? `${operationData.wettedWidth} m` : null} />
                    <DataRow label="Corner Arm" value={operationData.cornerArm ? `${operationData.cornerArm} m` : null} />
                    <DataRow label="Wind Speed" value={windSpeed ? `${windSpeed} km/h` : null} />
                    <DataRow label="Wind Direction" value={operationData.windDirection} />
                    <DataRow label="Weather" value={operationData.weatherConditions} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold font-display mb-4">Recommendations</h3>
            <ul className="space-y-4">
              {results.duStatus === 'good' && (
                <li className="flex items-start gap-3 text-green-700">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Great uniformity (DU {duPct.toFixed(1)}%). Your system is distributing water evenly.</span>
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
              {results.sections.filter(s => !isNaN(s.du) && s.duStatus !== 'good').map((sec, i) => (
                <li key={i} className={`flex items-start gap-3 ${sec.duStatus === 'fair' ? 'text-amber-700' : 'text-red-700'}`}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {sec.name} {sec.duStatus === 'fair' ? 'needs attention' : 'failed'} (DU {(sec.du * 100).toFixed(1)}%). Inspect nozzles in this section specifically.
                    {sec.name.includes('End Gun') ? ' Check end gun nozzle and pressure.' : ''}
                  </span>
                </li>
              ))}
              {results.depthStatus !== 'good' && (
                <li className={`flex items-start gap-3 ${results.depthStatus === 'fair' ? 'text-amber-700' : 'text-red-700'}`}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is {results.depthDiff.toFixed(0)}% off your target ({results.targetDepth} mm). Consider adjusting travel speed or pressure.</span>
                </li>
              )}
              {results.depthStatus === 'good' && (
                <li className="flex items-start gap-3 text-green-700">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is within range of your target ({results.targetDepth} mm).</span>
                </li>
              )}
              {lowBuckets.length > 0 && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Buckets {lowBuckets.join(', ')} collected significantly less water. Inspect the nozzle(s) at those positions for blockages or wear.</span>
                </li>
              )}
              {windSpeed > 15 && (
                <li className="flex items-start gap-3 text-amber-700">
                  <Wind className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="font-medium">Wind was {windSpeed} km/h — above the 15 km/h limit. Results may be less reliable. Consider re-testing on a calmer day.</span>
                </li>
              )}
              <li className="flex items-start gap-3 text-foreground">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                <span className="font-medium">
                  Test recorded {testDate ? `on ${new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'today'}. DairyNZ recommends testing every 12 months.
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
          <Button size="lg" className="flex-1" onClick={() => { reset(); setLocation('/'); }}>
            <RotateCcw className="w-5 h-5 mr-2" />
            Start New Test
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
