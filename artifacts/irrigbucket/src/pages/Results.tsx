import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Printer, RotateCcw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useAppStore } from '@/lib/store';
import { calculateResults } from '@/lib/calculations';
import { formatNumber } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Results() {
  const [, setLocation] = useLocation();
  const { volumes, systemParams, plan, windSpeed, testDate, reset } = useAppStore();

  useEffect(() => {
    if (!plan || volumes.length === 0) {
      setLocation('/');
    }
  }, [plan, volumes, setLocation]);

  const results = useMemo(() => {
    return calculateResults(volumes, systemParams.diameter);
  }, [volumes, systemParams.diameter]);

  const handleNewTest = () => {
    reset();
    setLocation('/');
  };

  if (!plan) return null;

  // DU Rating Logic
  let duRating = { text: "Poor", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", icon: AlertTriangle };
  if (results.du >= 80) duRating = { text: "Excellent", color: "text-success", bg: "bg-success/10", border: "border-success/20", icon: CheckCircle };
  else if (results.du >= 70) duRating = { text: "Good", color: "text-secondary", bg: "bg-secondary/10", border: "border-secondary/20", icon: CheckCircle };
  else if (results.du >= 60) duRating = { text: "Fair", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", icon: Info };

  // Chart Data preparation
  const chartData = results.allDepths.map((depth, i) => {
    // Find if this is in the lowest 25% for highlighting
    const sorted = [...results.allDepths].sort((a,b) => a-b);
    const threshold = sorted[Math.max(0, Math.floor(sorted.length * 0.25) - 1)];
    
    return {
      name: `${i + 1}`,
      depth: Number(depth.toFixed(1)),
      isLow: depth <= threshold
    };
  });

  return (
    <AppLayout step={5} title="Test Results" showBack={false}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Rating Banner */}
        <Card className={`${duRating.bg} ${duRating.border}`}>
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full bg-white shadow-sm ${duRating.color}`}>
                <duRating.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Distribution Uniformity Rating</p>
                <h2 className={`text-3xl font-display font-bold ${duRating.color}`}>
                  {duRating.text}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold font-display text-foreground">
                {formatNumber(results.du, 0)}<span className="text-2xl text-muted-foreground ml-1">%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Target Depth</p>
              <p className="text-2xl font-bold font-display">{systemParams.targetDepth} <span className="text-sm">mm</span></p>
            </CardContent>
          </Card>
          <Card className={results.avgDepth < systemParams.targetDepth * 0.8 ? "border-warning" : ""}>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Applied Avg</p>
              <p className="text-2xl font-bold font-display">{formatNumber(results.avgDepth)} <span className="text-sm">mm</span></p>
            </CardContent>
          </Card>
          <Card className={results.cv > 25 ? "border-destructive" : ""}>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Variation (CV)</p>
              <p className="text-2xl font-bold font-display">{formatNumber(results.cv)} <span className="text-sm">%</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold mb-1">Buckets</p>
              <p className="text-2xl font-bold font-display">{results.allDepths.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardContent className="pt-8 pb-4 px-2 sm:px-6">
            <h3 className="text-xl font-bold font-display mb-6 px-4">Application Depth Profile</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(value) => [`${value} mm`, 'Depth']}
                    labelFormatter={(label) => `Bucket ${label}`}
                  />
                  <ReferenceLine y={systemParams.targetDepth} stroke="#15803d" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: 'Target', fill: '#15803d', fontSize: 12, fontWeight: 'bold' }} />
                  <ReferenceLine y={results.avgDepth} stroke="#0ea5e9" strokeWidth={2} label={{ position: 'bottom', value: 'Average', fill: '#0ea5e9', fontSize: 12, fontWeight: 'bold' }} />
                  <Bar dataKey="depth" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isLow ? '#ea580c' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-slate-400"></div> Normal</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-600"></div> Lowest 25%</div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-8">
            <h3 className="text-xl font-bold font-display mb-4">Recommendations</h3>
            <ul className="space-y-4">
              {results.du < 70 && (
                <li className="flex items-start gap-3 text-destructive font-medium">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  Have your system serviced — significant distribution issues detected. This is costing you water and pasture growth.
                </li>
              )}
              {results.cv > 25 && (
                <li className="flex items-start gap-3 text-warning-foreground font-medium">
                  <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning" />
                  High variation between buckets. Check for blocked nozzles, pressure regulator issues, or incorrect nozzle sizing.
                </li>
              )}
              {windSpeed > 15 && (
                <li className="flex items-start gap-3 text-muted-foreground font-medium">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  Wind was {windSpeed} km/h. Wind above 15 km/h affects distribution. Consider retesting in calmer conditions for accurate baseline.
                </li>
              )}
              <li className="flex items-start gap-3 text-foreground font-medium">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                Test recorded on {new Date(testDate).toLocaleDateString()}. Keep this record. DairyNZ recommends testing every 12 months.
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
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
