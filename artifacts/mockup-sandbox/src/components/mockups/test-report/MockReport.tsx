import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { CheckCircle, Info, AlertTriangle, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MOCK = {
  farmName: "Waitoa Dairy Ltd",
  irrigatorName: "Pivot #2 – North Block",
  assessorName: "James Herrick",
  testDate: "15 March 2026",
  startTime: "06:45",
  endTime: "09:20",
  irrigatorType: "Centre Pivot",
  pivotLength: 420,
  bucketDiameter: 150,
  targetDepth: 25,
  operatingPressure: 2.4,
  flowRate: 48.5,
  numSprinklers: 112,
  percentTimer: 62,
  windSpeed: 8,
  windDirection: "SW",
  weather: "Clear, light breeze",
  inletPressure: 245,
  wettedWidth: 840,

  du: 0.843,
  duStatus: "good" as const,
  avgDepth: 24.4,
  depthStatus: "good" as const,
  depthDiff: 2.4,
  stdDev: 1.9,
  validBuckets: 24,
  totalBuckets: 24,

  sections: [
    { name: "Section B (Mid spans)", buckets: 10, du: 0.871, duStatus: "good" as const, avgDepth: 23.8 },
    { name: "Section C (Outer spans)", buckets: 10, du: 0.812, duStatus: "good" as const, avgDepth: 25.1 },
    { name: "End Gun", buckets: 4, du: 0.756, duStatus: "fair" as const, avgDepth: 22.6 },
  ],

  volumes: [
    430, 445, 452, 438, 441, 450, 435, 448, 442, 446,
    460, 455, 462, 458, 440, 465, 459, 461, 453, 457,
    390, 405, 412, 395,
  ],
};

const SECTION_COLORS: Record<string, string> = {
  "Section B (Mid spans)": "#3b82f6",
  "Section C (Outer spans)": "#0d9488",
  "End Gun": "#f97316",
};

const SECTION_RANGES = [
  { name: "Section B (Mid spans)", from: 0, to: 10 },
  { name: "Section C (Outer spans)", from: 10, to: 20 },
  { name: "End Gun", from: 20, to: 24 },
];

function getSectionColor(idx: number): string {
  for (const s of SECTION_RANGES) {
    if (idx >= s.from && idx < s.to) return SECTION_COLORS[s.name] ?? "#94a3b8";
  }
  return "#94a3b8";
}

const bucketArea = Math.PI * Math.pow(MOCK.bucketDiameter / 2, 2);
const avgVolume = MOCK.volumes.reduce((a, b) => a + b, 0) / MOCK.volumes.length;

const chartData = MOCK.volumes.map((vol, i) => {
  const depth = (1000 * vol) / bucketArea;
  const isOutlier = Math.abs(vol - avgVolume) > MOCK.stdDev * (1000 * avgVolume / bucketArea) * 0.04;
  return { name: `${i + 1}`, depth: Number(depth.toFixed(1)), isOutlier, color: getSectionColor(i) };
});

function StatusBadge({ status, labels }: { status: "good" | "fair" | "poor"; labels?: { good: string; fair: string; poor: string } }) {
  const text = labels ? labels[status] : status === "good" ? "Pass" : status === "fair" ? "Attention" : "Fail";
  const cls = {
    good: "bg-green-100 text-green-800 border-green-200",
    fair: "bg-amber-100 text-amber-800 border-amber-200",
    poor: "bg-red-100 text-red-800 border-red-200",
  }[status];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{text}</span>;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pr-4 text-muted-foreground text-sm font-medium">{label}</td>
      <td className="py-2 text-sm font-semibold">{value}</td>
    </tr>
  );
}

export function MockReport() {
  const duPct = MOCK.du * 100;
  const avgDepth = (1000 * avgVolume) / bucketArea;

  return (
    <div className="min-h-screen bg-background p-4 space-y-5">

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">IrrigBucket Test Results</h1>
        <Button variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-1.5" />
          Export
        </Button>
      </div>

      {/* DU Banner — Pass */}
      <Card className="bg-green-50 border-green-200 border-2">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white shadow-sm text-green-700">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Distribution Uniformity</p>
              <h2 className="text-xl font-bold text-green-700">Pass</h2>
              <p className="text-xs text-muted-foreground mt-0.5">DU = 1 − CV (NZ industry standard)</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-bold text-green-700">
              {duPct.toFixed(1)}<span className="text-2xl ml-0.5">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">≥ 80% Pass</p>
          </div>
        </CardContent>
      </Card>

      {/* Summary line */}
      <p className="text-sm text-muted-foreground text-center">
        {MOCK.irrigatorType} • {MOCK.testDate} • Wind: {MOCK.windSpeed} km/h • {MOCK.farmName}
      </p>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground font-semibold mb-1">Applied Depth (avg)</p>
            <p className="text-2xl font-bold">{avgDepth.toFixed(1)} <span className="text-sm font-normal">mm</span></p>
            <p className="text-xs text-muted-foreground mt-1">Target: {MOCK.targetDepth} mm</p>
            <div className="mt-2">
              <StatusBadge status="good" labels={{ good: "On Target", fair: "Close", poor: "Off Target" }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground font-semibold mb-1">Buckets Tested</p>
            <p className="text-2xl font-bold">{MOCK.validBuckets}</p>
            <p className="text-xs text-muted-foreground mt-1">of {MOCK.totalBuckets} placed</p>
            <p className="text-xs text-muted-foreground mt-1">Intensity: 1.87 mm/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Breakdown */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <h3 className="text-base font-bold mb-3">Section Breakdown</h3>
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
                {MOCK.sections.map((sec, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-2 font-semibold text-sm">{sec.name}</td>
                    <td className="py-3 px-2 text-center text-muted-foreground">{sec.buckets}</td>
                    <td className={`py-3 px-2 text-center font-bold ${sec.duStatus === "good" ? "text-green-700" : sec.duStatus === "fair" ? "text-amber-700" : "text-red-700"}`}>
                      {(sec.du * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={sec.duStatus} /></td>
                    <td className="py-3 px-2 text-center">{sec.avgDepth.toFixed(1)} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Pass ≥ 80% | Attention 65–79% | Fail &lt; 65%</p>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardContent className="pt-5 pb-4 px-2 sm:px-5">
          <h3 className="text-base font-bold mb-1 px-3">Application Depth Profile</h3>
          <p className="text-xs text-muted-foreground px-3 mb-3">
            Bars are colour-coded by section. Red bars are outliers — more than 1 std dev from average.
          </p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  formatter={(value) => [`${value} mm`, "Depth"]}
                  labelFormatter={(label) => `Bucket ${label}`}
                />
                <ReferenceLine y={MOCK.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={2}
                  label={{ position: "top", value: "Target", fill: "#15803d", fontSize: 10, fontWeight: "bold" }} />
                <ReferenceLine y={avgDepth} stroke="#0ea5e9" strokeWidth={2}
                  label={{ position: "bottom", value: "Avg", fill: "#0ea5e9", fontSize: 10, fontWeight: "bold" }} />
                <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.isOutlier ? "#dc2626" : entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-muted-foreground font-medium">
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
        </CardContent>
      </Card>

      {/* Test Parameters */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-base font-bold mb-3">Test Parameters</h3>
          <table className="w-full">
            <tbody>
              <Row label="Farm" value={MOCK.farmName} />
              <Row label="Irrigator" value={MOCK.irrigatorName} />
              <Row label="Assessor" value={MOCK.assessorName} />
              <Row label="Test Date" value={MOCK.testDate} />
              <Row label="Start Time" value={MOCK.startTime} />
              <Row label="End Time" value={MOCK.endTime} />
              <Row label="Pivot Length" value={`${MOCK.pivotLength} m`} />
              <Row label="Bucket Diameter" value={`${MOCK.bucketDiameter} mm`} />
              <Row label="Target Depth" value={`${MOCK.targetDepth} mm`} />
              <Row label="Operating Pressure" value={`${MOCK.operatingPressure} bar`} />
              <Row label="Inlet Pressure" value={`${MOCK.inletPressure} kPa`} />
              <Row label="Flow Rate" value={`${MOCK.flowRate} L/s`} />
              <Row label="Total Sprinklers" value={MOCK.numSprinklers} />
              <Row label="Percent Timer" value={`${MOCK.percentTimer}%`} />
              <Row label="Wetted Width" value={`${MOCK.wettedWidth} m`} />
              <Row label="Wind Speed" value={`${MOCK.windSpeed} km/h`} />
              <Row label="Wind Direction" value={MOCK.windDirection} />
              <Row label="Weather" value={MOCK.weather} />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="pt-5">
          <h3 className="text-base font-bold mb-3">Recommendations</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-green-700">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-medium text-sm">Great uniformity (DU {duPct.toFixed(1)}%). Your system is distributing water evenly.</span>
            </li>
            <li className="flex items-start gap-3 text-amber-700">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-medium text-sm">End Gun needs attention (DU 75.6%). Inspect nozzles in this section specifically. Check end gun nozzle and pressure.</span>
            </li>
            <li className="flex items-start gap-3 text-green-700">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-medium text-sm">Application depth ({avgDepth.toFixed(1)} mm) is within range of your target ({MOCK.targetDepth} mm).</span>
            </li>
            <li className="flex items-start gap-3 text-foreground">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
              <span className="font-medium text-sm">Test recorded on {MOCK.testDate}. DairyNZ recommends testing every 12 months.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="pb-4" />
    </div>
  );
}
