import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle, Info, Wind, Droplet, Menu, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { calculateTestResults, populationStdDev } from '@/lib/calculations';
import { getReportById, deleteReport, getReportLabel, SavedReport as SavedReportType } from '@/lib/savedReports';
import { SideMenu } from '@/components/layout/SideMenu';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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

export default function SavedReport() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [report, setReport] = useState<SavedReportType | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const r = getReportById(params.id);
    setReport(r);
  }, [params.id]);

  const results = useMemo(() => {
    if (!report) return null;
    return calculateTestResults(
      report.volumes,
      report.systemParams.diameter,
      report.systemParams.targetDepth,
      report.sections,
    );
  }, [report]);

  function handleDelete() {
    if (!report) return;
    deleteReport(report.id);
    setLocation('/');
  }

  if (report === undefined) return null;

  if (!report || !results) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Report not found.</p>
        <Button variant="outline" onClick={() => setLocation('/')}>Go Home</Button>
      </div>
    );
  }

  const isPivot = report.irrigatorType === 'pivot';
  const duPct = results.du * 100;
  const mean = results.avgVolume;
  const stdDev = populationStdDev(results.validVolumes);

  const duConfig = {
    good: { text: 'Pass', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
    fair: { text: 'Attention Required', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Info },
    poor: { text: 'Fail — Action Needed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
  }[results.duStatus];

  const chartData = results.allVolumes
    .map((vol, i) => {
      if (vol <= 0) return null;
      const depth = (1000 * vol) / results.bucketArea;
      const isOutlier = Math.abs(vol - mean) > stdDev;
      const sectionColor = getSectionColor(i, report.sections);
      return { name: `${i + 1}`, depth: Number(depth.toFixed(1)), isOutlier, sectionColor };
    })
    .filter(Boolean) as { name: string; depth: number; isOutlier: boolean; sectionColor: string }[];

  const lowBuckets = results.allVolumes
    .map((v, i) => ({ v, i: i + 1 }))
    .filter(({ v }) => v > 0 && v < mean - stdDev)
    .map(({ i }) => i);

  const revolutionTime = report.systemParams.revolutionTime;
  const intensity = (revolutionTime && results.avgDepth > 0)
    ? (results.avgDepth / revolutionTime).toFixed(2)
    : null;

  const label = getReportLabel(report);

  return (
    <div className="min-h-screen flex flex-col bg-background/90 backdrop-blur-sm">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuOpen(true)}
                className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setLocation('/')}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 cursor-pointer ml-1" onClick={() => setLocation('/')}>
                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                  <Droplet className="w-5 h-5 fill-primary" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-foreground hidden sm:block">
                  Irrig<span className="text-primary">Bucket</span>
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
          <div className="pb-4">
            <Progress value={100} className="h-2" />
          </div>
        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pt-6 sm:pt-10 pb-20">
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Saved Report</p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">{label}</h1>
          </div>
        </div>

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

          {/* Summary */}
          <p className="text-sm text-muted-foreground text-center">
            {isPivot ? 'Centre Pivot' : report.irrigatorType === 'boom' ? 'Roto Rainer' : 'Irrigator'} •{' '}
            {report.testDate ? new Date(report.testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown date'}
            {report.windSpeed ? ` • Wind: ${report.windSpeed} km/h` : ''}
            {report.operationData.farmName ? ` • ${report.operationData.farmName}` : ''}
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
                <p className="text-xs text-muted-foreground mt-1">of {report.plan?.bucketCount ?? results.allVolumes.length} placed</p>
                {intensity && <p className="text-xs text-muted-foreground mt-1">Intensity: {intensity} mm/hr</p>}
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
                    <ReferenceLine y={report.systemParams.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={2}
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
                {isPivot && report.sections.length > 0 ? (
                  <>
                    {report.sections.map((s, i) => (
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

          {/* Test Parameters */}
          {isPivot && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold font-display mb-4">Test Parameters</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody>
                      <DataRow label="Pivot Length" value={report.plan?.armLength ? `${report.plan.armLength} m` : null} />
                      <DataRow label="Bucket Diameter" value={`${report.systemParams.diameter} mm`} />
                      <DataRow label="Target Depth" value={`${report.systemParams.targetDepth} mm`} />
                      {report.systemParams.operatingPressure && <DataRow label="Operating Pressure" value={`${report.systemParams.operatingPressure} bar`} />}
                      {report.systemParams.flowRate && <DataRow label="Flow Rate" value={`${report.systemParams.flowRate} L/s`} />}
                      {report.systemParams.numSprinklers && <DataRow label="Total Sprinklers" value={report.systemParams.numSprinklers} />}
                      <DataRow label="Farm" value={report.operationData.farmName} />
                      <DataRow label="Irrigator" value={report.operationData.irrigatorName} />
                      <DataRow label="Assessor" value={report.operationData.assessorName} />
                      <DataRow label="Test Date" value={report.testDate ? new Date(report.testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
                      <DataRow label="Start Time" value={report.operationData.testStartTime} />
                      <DataRow label="End Time" value={report.operationData.testEndTime} />
                      <DataRow label="Inlet Pressure" value={report.operationData.inletPressure ? `${report.operationData.inletPressure} kPa` : null} />
                      <DataRow label="Actual Speed" value={report.operationData.actualSpeed ? `${report.operationData.actualSpeed} m/min` : null} />
                      <DataRow label="Percent Timer" value={report.operationData.percentTimer ? `${report.operationData.percentTimer}%` : null} />
                      <DataRow label="Wetted Width" value={report.operationData.wettedWidth ? `${report.operationData.wettedWidth} m` : null} />
                      <DataRow label="Wind Speed" value={report.windSpeed ? `${report.windSpeed} km/h` : null} />
                      <DataRow label="Wind Direction" value={report.operationData.windDirection} />
                      <DataRow label="Weather" value={report.operationData.weatherConditions} />
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
                    <span className="font-medium">Uniformity needs attention (DU {duPct.toFixed(1)}%). Check for worn or partially blocked nozzles.</span>
                  </li>
                )}
                {results.duStatus === 'poor' && (
                  <li className="flex items-start gap-3 text-red-700">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="font-medium">Uniformity test failed (DU {duPct.toFixed(1)}%). Inspect all nozzles, check operating pressure, and look for leaks or blockages.</span>
                  </li>
                )}
                {results.depthStatus !== 'good' && (
                  <li className={`flex items-start gap-3 ${results.depthStatus === 'fair' ? 'text-amber-700' : 'text-red-700'}`}>
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="font-medium">Application depth ({results.avgDepth.toFixed(1)} mm) is {results.depthDiff.toFixed(0)}% off your target ({results.targetDepth} mm).</span>
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
                    <span className="font-medium">Buckets {lowBuckets.join(', ')} collected significantly less water. Inspect the nozzle(s) at those positions.</span>
                  </li>
                )}
                {report.windSpeed > 15 && (
                  <li className="flex items-start gap-3 text-amber-700">
                    <Wind className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="font-medium">Wind was {report.windSpeed} km/h — above the 15 km/h limit. Results may be less reliable.</span>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-4 pt-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setLocation('/')}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
