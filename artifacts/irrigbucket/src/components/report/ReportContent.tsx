import { Printer, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  SystemParams, OperationData, Plan, SectionDefinition, TestResults,
} from '@/lib/calculations';
import { populationStdDev, calcKlineApplication } from '@/lib/calculations';

type DuStatus = 'good' | 'fair' | 'poor';

const SECTION_BAR_COLORS: Record<string, string> = {
  'Section B (Mid spans)': '#3b82f6',
  'Section C (Outer spans)': '#0d9488',
  'End Gun': '#f97316',
};

const SECTION_DISPLAY_COLORS: Record<string, string> = {
  'Mid Spans': '#3b82f6',
  'Outer Spans': '#0d9488',
  'End Gun': '#f97316',
};

function getDisplayName(secName: string): string {
  if (secName.includes('Mid')) return 'Mid Spans';
  if (secName.includes('Outer')) return 'Outer Spans';
  if (secName === 'End Gun') return 'End Gun';
  return secName;
}

function irrigatorLabel(type: string | null): string {
  switch (type) {
    case 'pivot': return 'Centre Pivot';
    case 'lateral': return 'Lateral Move';
    case 'kline': return 'K-Line / Pods';
    case 'gun': return 'Travelling Gun';
    case 'solid': return 'Solid Set';
    case 'boom': return 'Roto Rainer';
    default: return 'Irrigator';
  }
}

function StatusBadge({ status, labels }: { status: DuStatus; labels?: { good: string; fair: string; poor: string } }) {
  const text = labels ? labels[status] : status === 'good' ? 'Pass' : status === 'fair' ? 'Attention' : 'Fail';
  const cls = {
    good: 'bg-green-100 text-green-800 border-green-200',
    fair: 'bg-amber-100 text-amber-800 border-amber-200',
    poor: 'bg-red-100 text-red-800 border-red-200',
  }[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {text}
    </span>
  );
}

interface ReportContentProps {
  irrigatorType: string | null;
  systemParams: SystemParams;
  plan: Plan | null;
  volumes: number[];
  windSpeed: number;
  testDate: string;
  sections: SectionDefinition[];
  operationData: OperationData;
  results: TestResults;
  onPrint?: () => void;
}

export function ReportContent({
  irrigatorType, systemParams, plan, volumes, windSpeed,
  testDate, sections, operationData, results, onPrint,
}: ReportContentProps) {
  const isPivot = irrigatorType === 'pivot';
  const duPct = results.du * 100;
  const mean = results.avgVolume;
  const stdDev = populationStdDev(results.validVolumes);
  const revolutionTime = systemParams.revolutionTime;
  const isKline = irrigatorType === 'kline';
  const klineApp = isKline
    ? calcKlineApplication(results.avgDepth, systemParams.targetDepth, systemParams.klineTestMinutes, systemParams.klineSetHours)
    : null;

  const formattedDate = testDate
    ? new Date(testDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const duStatus: DuStatus = results.duStatus;
  const duCfg = {
    good: { label: 'Pass', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', Icon: CheckCircle, threshold: '≥ 80% Pass' },
    fair: { label: 'Attention Required', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', Icon: Info, threshold: '65–79% Attention' },
    poor: { label: 'Fail — Action Needed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', Icon: AlertTriangle, threshold: '< 65% Fail' },
  }[duStatus];

  const bucketAreaMm2 = Math.PI * Math.pow(systemParams.diameter / 2, 2);
  const bucketAreaM2 = bucketAreaMm2 / 1e6;

  const overallIntensity = klineApp
    ? Number(klineApp.applicationRate.toFixed(2))
    : (revolutionTime && results.avgDepth > 0)
      ? Number((results.avgDepth / revolutionTime).toFixed(2))
      : null;

  const chartData = results.allVolumes
    .map((vol, i) => {
      if (vol <= 0) return null;
      const depth = Number(((1000 * vol) / bucketAreaMm2).toFixed(1));
      const isOutlier = Math.abs(vol - mean) > stdDev;
      let color = '#94a3b8';
      for (const s of sections) {
        if (i >= s.fromBucket - 1 && i < s.toBucket) {
          color = SECTION_BAR_COLORS[s.name] ?? '#94a3b8';
          break;
        }
      }
      return { name: `${i + 1}`, depth, isOutlier, color };
    })
    .filter(Boolean) as { name: string; depth: number; isOutlier: boolean; color: string }[];

  type LogEntry = [string, string | number | undefined | null];

  const loggedDataPivot: LogEntry[] = [
    ['Pivot Length (m)', plan?.armLength],
    ['Inlet Pressure (kPa)', operationData.inletPressure],
    ['Speed (m/min)', operationData.actualSpeed],
    ['Wetted Width (m)', operationData.wettedWidth],
    ['Speed Test Time', operationData.speedTestTime],
    ['Speed Test Distance (m)', operationData.speedTestDistance],
    ['With End Gun', systemParams.hasEndGun ?? 'No'],
    ['Bucket Diameter (mm)', systemParams.diameter],
    ['Target Depth (mm)', systemParams.targetDepth],
    ['Percent Timer (%)', operationData.percentTimer],
    ['Bucket Open Area (m²)', bucketAreaM2.toFixed(5)],
    ['Irrigation Type', irrigatorLabel(irrigatorType)],
  ];

  const loggedDataGeneral: LogEntry[] = [
    ['Irrigation Type', irrigatorLabel(irrigatorType)],
    ['Bucket Diameter (mm)', systemParams.diameter],
    ['Target Depth (mm)', systemParams.targetDepth],
    ['Bucket Open Area (m²)', bucketAreaM2.toFixed(5)],
    ['Assessor', operationData.assessorName],
    ['Farm', operationData.farmName],
    ['Test Date', formattedDate],
    ['Wind Speed (km/h)', windSpeed || null],
    ['Wind Direction', operationData.windDirection],
    ['Weather', operationData.weatherConditions],
    ['Start Time', operationData.testStartTime],
    ['End Time', operationData.testEndTime],
  ];

  const loggedItems = (isPivot ? loggedDataPivot : loggedDataGeneral)
    .filter(([, v]) => v != null && v !== '' && v !== 0);

  const sectionLegend = [
    { status: 'good' as DuStatus, title: 'Pass', threshold: 'DU ≥ 80%', description: 'No further action required. System is distributing water evenly.' },
    { status: 'fair' as DuStatus, title: 'Attention', threshold: 'DU 65–79%', description: 'Some areas receiving less water — inspect nozzles and operating pressure.' },
    { status: 'poor' as DuStatus, title: 'Fail', threshold: 'DU < 65%', description: 'Distribution is very uneven. Re-test or seek professional assistance.' },
  ];

  const pivotSectionsWithVolumes = isPivot
    ? sections.map((s) => ({
        name: getDisplayName(s.name),
        originalName: s.name,
        vols: volumes.slice(s.fromBucket - 1, s.toBucket),
        startIdx: s.fromBucket,
      }))
    : [];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans text-sm">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

        {/* ── Document Header ───────────────────────────────── */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">RESULTS</h1>
            <p className="text-xs text-slate-500 mt-0.5">IrrigBucket Irrigation Performance Report</p>
          </div>
          <div className="flex items-start gap-6">
            <table className="text-xs text-right leading-relaxed">
              <tbody>
                <tr><td className="text-slate-500 pr-3">Date</td><td className="font-semibold">{formattedDate}</td></tr>
                {operationData.assessorName && (
                  <tr><td className="text-slate-500 pr-3">Assessor</td><td className="font-semibold">{operationData.assessorName}</td></tr>
                )}
                {operationData.farmName && (
                  <tr><td className="text-slate-500 pr-3">Farm</td><td className="font-semibold">{operationData.farmName}</td></tr>
                )}
                {operationData.irrigatorName && (
                  <tr><td className="text-slate-500 pr-3">Irrigator</td><td className="font-semibold">{operationData.irrigatorName}</td></tr>
                )}
                <tr><td className="text-slate-500 pr-3">Type</td><td className="font-semibold">{irrigatorLabel(irrigatorType)}</td></tr>
              </tbody>
            </table>
            <Button variant="outline" size="sm" className="shrink-0 mt-0.5 no-print" onClick={onPrint}>
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* ── DU Status Banner ──────────────────────────────── */}
        <div className={`flex items-center justify-between gap-4 rounded-xl border-2 ${duCfg.border} ${duCfg.bg} px-6 py-4`}>
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-full bg-white shadow-sm ${duCfg.color}`}>
              <duCfg.Icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Distribution Uniformity</p>
              <p className={`text-xl font-bold ${duCfg.color}`}>{duCfg.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">DU = 1 − CV (NZ industry standard)</p>
            </div>
          </div>
          <div className={`text-right shrink-0 ${duCfg.color}`}>
            <span className="text-5xl font-bold leading-none">{duPct.toFixed(1)}</span>
            <span className="text-2xl font-bold">%</span>
            <p className="text-xs text-slate-500 mt-1">{duCfg.threshold}</p>
          </div>
        </div>

        {/* ── K-Line Application Depth ──────────────────────── */}
        {klineApp && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">K-Line Application Depth</h2>
            <div className="border border-slate-200 rounded-md p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Caught in Test</p>
                  <p className="text-lg font-bold text-slate-800">{klineApp.caughtDepth.toFixed(2)} mm</p>
                  <p className="text-[11px] text-slate-400">over {klineApp.testMinutes} min</p>
                </div>
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Application Rate</p>
                  <p className="text-lg font-bold text-slate-800">{klineApp.applicationRate.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-400">mm/hr</p>
                </div>
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Set Run Time</p>
                  <p className="text-lg font-bold text-slate-800">{klineApp.setHours} hr</p>
                  <p className="text-[11px] text-slate-400">per position</p>
                </div>
                <div className="rounded-md bg-green-50 border border-green-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-green-700">Depth / Set</p>
                  <p className="text-lg font-bold text-green-800">{klineApp.perSetDepth.toFixed(1)} mm</p>
                  <div className="mt-1 flex justify-center">
                    <StatusBadge status={klineApp.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Application depth = rate × set run time. The buckets caught {klineApp.caughtDepth.toFixed(2)} mm in {klineApp.testMinutes} min
                ({klineApp.applicationRate.toFixed(2)} mm/hr); over a {klineApp.setHours}-hour set this applies <strong>{klineApp.perSetDepth.toFixed(1)} mm</strong> vs
                a target of {systemParams.targetDepth} mm.{' '}
                <span className="text-slate-400">Method: IrrigationNZ / DairyNZ bucket test.</span>
              </p>
            </div>
          </section>
        )}

        {/* ── Results Table ─────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Results</h2>
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Section</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Buckets</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">DU</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">DU Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">{klineApp ? 'Depth / Set (mm)' : 'Avg Depth (mm)'}</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Depth Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Intensity (mm/hr)</th>
                </tr>
              </thead>
              <tbody>
                {/* Overall row */}
                <tr className="border-b border-slate-100 bg-slate-50/50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-800">{irrigatorLabel(irrigatorType)}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{results.validVolumes.length}</td>
                  <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">{results.du.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center"><StatusBadge status={results.duStatus} /></td>
                  <td className="px-3 py-2.5 text-center font-mono text-slate-800">{(klineApp ? klineApp.perSetDepth : results.avgDepth).toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={klineApp ? klineApp.depthStatus : results.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} />
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {overallIntensity != null ? overallIntensity.toFixed(2) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>

                {/* Section rows */}
                {results.sections.map((sec, i) => {
                  const secIntensity = (revolutionTime && sec.avgDepth > 0)
                    ? Number((sec.avgDepth / revolutionTime).toFixed(2))
                    : null;
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700 pl-7">{getDisplayName(sec.name)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{sec.bucketCount}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                        {isNaN(sec.du) ? <span className="text-slate-300">—</span> : sec.du.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isNaN(sec.du)
                          ? <span className="text-xs text-slate-400">n/a</span>
                          : <StatusBadge status={sec.duStatus} />}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-800">{sec.avgDepth.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge status={sec.depthStatus} labels={{ good: 'On Target', fair: 'Close', poor: 'Off Target' }} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">
                        {secIntensity != null ? secIntensity.toFixed(2) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* DU Key */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {sectionLegend.map(({ status, threshold, description }) => (
              <div key={status} className={`rounded-md border p-3 text-xs ${{ good: 'bg-green-50 border-green-200', fair: 'bg-amber-50 border-amber-200', poor: 'bg-red-50 border-red-200' }[status]}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusBadge status={status} />
                  <span className={`font-semibold ${{ good: 'text-green-700', fair: 'text-amber-700', poor: 'text-red-700' }[status]}`}>{threshold}</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Logged Data ───────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Logged Data</h2>
          <div className="border border-slate-200 rounded-md p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm">
              {loggedItems.map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-slate-500 shrink-0 text-xs">{label}</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 min-w-1" />
                  <span className="font-semibold text-slate-800 shrink-0 text-xs">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Application Depth Profile ──────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Application Depth Profile</h2>
          <div className="border border-slate-200 rounded-md p-4">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)' }}
                    formatter={(v) => [`${v} mm`, 'Depth']}
                    labelFormatter={(l) => `Bucket ${l}`}
                  />
                  <ReferenceLine y={systemParams.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={1.5}
                    label={{ position: 'top', value: 'Target', fill: '#15803d', fontSize: 10, fontWeight: 'bold' }} />
                  <ReferenceLine y={results.avgDepth} stroke="#0ea5e9" strokeWidth={1.5}
                    label={{ position: 'bottom', value: 'Avg', fill: '#0ea5e9', fontSize: 10, fontWeight: 'bold' }} />
                  <Bar dataKey="depth" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isOutlier ? '#dc2626' : entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-slate-500">
              {isPivot && sections.length > 0 ? (
                <>
                  {sections.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ background: SECTION_BAR_COLORS[s.name] ?? '#94a3b8' }} />
                      {getDisplayName(s.name)}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-600" />
                    Outlier (&gt;1 StdDev)
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-400" /> Normal</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600" /> Outlier (&gt;1 StdDev)</div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Recorded Bucket Volumes (pivot) ───────────────── */}
        {isPivot && pivotSectionsWithVolumes.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Recorded Bucket Volumes</h2>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div
                className="divide-x divide-slate-200"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${pivotSectionsWithVolumes.length}, 1fr)` }}
              >
                {pivotSectionsWithVolumes.map(({ name, originalName, vols, startIdx }) => (
                  <div key={name}>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
                      {SECTION_DISPLAY_COLORS[name] && (
                        <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: SECTION_DISPLAY_COLORS[name] }} />
                      )}
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{name}</span>
                    </div>
                    <div className="px-4 py-3 space-y-0.5">
                      {vols.map((v, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-slate-50 last:border-0">
                          <span className="text-slate-400">{startIdx + i}</span>
                          <span className={`font-mono font-semibold ${v > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                            {v > 0 ? `${v} mL` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Non-pivot flat volume list ─────────────────────── */}
        {!isPivot && volumes.some(v => v > 0) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Recorded Bucket Volumes</h2>
            <div className="border border-slate-200 rounded-md p-4">
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {volumes.map((v, i) => (
                  <div key={i} className="flex flex-col items-center text-xs">
                    <span className="text-slate-400">{i + 1}</span>
                    <span className={`font-mono font-semibold ${v > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                      {v > 0 ? `${v}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-right">All values in mL</p>
            </div>
          </section>
        )}

        <div className="pb-2" />
      </div>
    </div>
  );
}
