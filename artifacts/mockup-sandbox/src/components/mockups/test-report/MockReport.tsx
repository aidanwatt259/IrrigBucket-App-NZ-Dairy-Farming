import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOCK = {
  farmName: "Waitoa Dairy Ltd",
  irrigatorName: "Pivot #2 – North Block",
  assessorName: "james.herrick@spectrumgroup.co.nz",
  testDate: "2026-03-15",
  irrigatorType: "Centre Pivot",
  pivotLength: 420,
  bucketDiameter: 150,
  targetDepth: 25,
  inletPressure: 245,
  wettedWidth: 840,
  percentTimer: 62,
  speedMPerMin: 1.42,
  speedTestDistance: 5,
  speedTestTime: "3m 31s",
  withEndGun: true,

  overallDu: 0.843,
  overallDepth: 24.4,

  sections: [
    { name: "Pivot", buckets: 24, du: 0.843, duStatus: "good" as const, avgDepth: 24.4, intensity: 1.87 },
    { name: "Pivot – Mid Spans", buckets: 10, du: 0.871, duStatus: "good" as const, avgDepth: 23.8, intensity: null },
    { name: "Pivot – Outer Spans", buckets: 10, du: 0.812, duStatus: "good" as const, avgDepth: 25.1, intensity: 2.01 },
    { name: "End Gun", buckets: 4, du: 0.756, duStatus: "fair" as const, avgDepth: 22.6, intensity: null },
  ],

  sectionVolumes: {
    "Mid Spans": [430, 445, 452, 438, 441, 450, 435, 448, 442, 446],
    "Outer Spans": [460, 455, 462, 458, 440, 465, 459, 461, 453, 457],
    "End Gun": [390, 405, 412, 395],
  },
};

const SECTION_COLORS: Record<string, string> = {
  "Mid Spans": "#3b82f6",
  "Outer Spans": "#0d9488",
  "End Gun": "#f97316",
};

const bucketArea = Math.PI * Math.pow(MOCK.bucketDiameter / 2, 2);
const allVolumes = [
  ...MOCK.sectionVolumes["Mid Spans"],
  ...MOCK.sectionVolumes["Outer Spans"],
  ...MOCK.sectionVolumes["End Gun"],
];
const avgVolume = allVolumes.reduce((a, b) => a + b, 0) / allVolumes.length;
const stdDev = Math.sqrt(allVolumes.reduce((s, v) => s + Math.pow(v - avgVolume, 2), 0) / allVolumes.length);

const chartData = allVolumes.map((vol, i) => {
  const depth = Number(((1000 * vol) / bucketArea).toFixed(1));
  const isOutlier = Math.abs(vol - avgVolume) > stdDev;
  const sectionName = i < 10 ? "Mid Spans" : i < 20 ? "Outer Spans" : "End Gun";
  return { name: `${i + 1}`, depth, isOutlier, color: SECTION_COLORS[sectionName] };
});

const avgDepth = Number(((1000 * avgVolume) / bucketArea).toFixed(1));

type DuStatus = "good" | "fair" | "poor";

function StatusBadge({ status, labels }: { status: DuStatus; labels?: { good: string; fair: string; poor: string } }) {
  const text = labels ? labels[status] : status === "good" ? "Pass" : status === "fair" ? "Attention" : "Fail";
  const cls = {
    good: "bg-green-100 text-green-800 border-green-200",
    fair: "bg-amber-100 text-amber-800 border-amber-200",
    poor: "bg-red-100 text-red-800 border-red-200",
  }[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {text}
    </span>
  );
}

function SectionTag({ name }: { name: string }) {
  const color = SECTION_COLORS[name];
  if (!color) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: color }} />
    </span>
  );
}

export function MockReport() {
  const formattedDate = new Date(MOCK.testDate).toLocaleDateString("en-NZ", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans text-sm">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">RESULTS</h1>
            <p className="text-xs text-slate-500 mt-0.5">IrrigBucket Irrigation Performance Report</p>
          </div>
          <div className="flex items-start gap-6">
            <table className="text-xs text-right leading-relaxed">
              <tbody>
                <tr><td className="text-slate-500 pr-3">Date</td><td className="font-semibold">{formattedDate}</td></tr>
                <tr><td className="text-slate-500 pr-3">Assessor</td><td className="font-semibold">{MOCK.assessorName}</td></tr>
                <tr><td className="text-slate-500 pr-3">Farm</td><td className="font-semibold">{MOCK.farmName}</td></tr>
                <tr><td className="text-slate-500 pr-3">Irrigator</td><td className="font-semibold">{MOCK.irrigatorName}</td></tr>
                <tr><td className="text-slate-500 pr-3">Type</td><td className="font-semibold">{MOCK.irrigatorType}</td></tr>
              </tbody>
            </table>
            <Button variant="outline" size="sm" className="shrink-0 mt-0.5">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {/* ── Results Table ─────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Results</h2>
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Section</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">No. Buckets</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">DU</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">DU Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Avg Depth (mm)</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Depth Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Intensity (mm/hr)</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.sections.map((sec, i) => {
                  const depthStatus: DuStatus = Math.abs(sec.avgDepth - MOCK.targetDepth) / MOCK.targetDepth <= 0.1
                    ? "good" : Math.abs(sec.avgDepth - MOCK.targetDepth) / MOCK.targetDepth <= 0.2 ? "fair" : "poor";
                  return (
                    <tr key={i} className={`border-b border-slate-100 last:border-0 ${i === 0 ? "bg-slate-50/50 font-semibold" : ""}`}>
                      <td className="px-4 py-2.5 text-slate-800">{sec.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{sec.buckets}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">{sec.du.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center"><StatusBadge status={sec.duStatus} /></td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-800">{sec.avgDepth.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge status={depthStatus} labels={{ good: "On Target", fair: "Close", poor: "Off Target" }} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">
                        {sec.intensity != null ? sec.intensity.toFixed(2) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Pass ≥ 80% DU | Attention 65–79% | Fail &lt; 65%</p>
        </section>

        {/* ── Logged Data ───────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Logged Data</h2>
          <div className="border border-slate-200 rounded-md p-4">
            <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
              {[
                ["Pivot Length (m)", MOCK.pivotLength],
                ["Inlet Pressure (kPa)", MOCK.inletPressure],
                ["Speed (m/min)", MOCK.speedMPerMin],
                ["Wetted Width (m)", MOCK.wettedWidth],
                ["Speed Test Time", MOCK.speedTestTime],
                ["Speed Test Distance (m)", MOCK.speedTestDistance],
                ["With End Gun", MOCK.withEndGun ? "Yes" : "No"],
                ["Bucket Diameter (mm)", MOCK.bucketDiameter],
                ["Target Depth (mm)", MOCK.targetDepth],
                ["Percent Timer (%)", MOCK.percentTimer],
                ["Bucket Open Area (m²)", ((bucketArea) / 1e6).toFixed(5)],
                ["Irrigation Type", MOCK.irrigatorType],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-slate-500 shrink-0">{label}</span>
                  <span className="border-b border-dotted border-slate-300 flex-1 min-w-2" />
                  <span className="font-semibold text-slate-800 shrink-0">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Application Depth Profile Chart ───────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Application Depth Profile</h2>
          <div className="border border-slate-200 rounded-md p-4">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)" }}
                    formatter={(v) => [`${v} mm`, "Depth"]}
                    labelFormatter={(l) => `Bucket ${l}`}
                  />
                  <ReferenceLine y={MOCK.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={1.5}
                    label={{ position: "top", value: "Target", fill: "#15803d", fontSize: 10, fontWeight: "bold" }} />
                  <ReferenceLine y={avgDepth} stroke="#0ea5e9" strokeWidth={1.5}
                    label={{ position: "bottom", value: "Avg", fill: "#0ea5e9", fontSize: 10, fontWeight: "bold" }} />
                  <Bar dataKey="depth" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isOutlier ? "#dc2626" : entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-slate-500">
              {Object.entries(SECTION_COLORS).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  {name}
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-600" />
                Outlier (&gt;1 StdDev)
              </div>
            </div>
          </div>
        </section>

        {/* ── Recorded Bucket Volumes ───────────────────────── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Recorded Bucket Volumes</h2>
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-slate-200">
              {Object.entries(MOCK.sectionVolumes).map(([section, vols]) => (
                <div key={section}>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
                    <SectionTag name={section} />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{section}</span>
                  </div>
                  <div className="px-4 py-3 space-y-0.5">
                    {vols.map((v, i) => {
                      const startIdx = section === "Mid Spans" ? 0 : section === "Outer Spans" ? 10 : 20;
                      return (
                        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-slate-50 last:border-0">
                          <span className="text-slate-400">{startIdx + i + 1}</span>
                          <span className="font-mono font-semibold text-slate-700">{v} mL</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="pb-2" />
      </div>
    </div>
  );
}
