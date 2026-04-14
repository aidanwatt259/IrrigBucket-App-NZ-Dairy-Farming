import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export default function Operation() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType, operationData, setOperationData, testDate, windSpeed, setTestConditions } = useAppStore();

  useEffect(() => {
    if (!plan || irrigatorType !== 'pivot') {
      setLocation('/plan');
    }
  }, [plan, irrigatorType, setLocation]);

  if (!plan || irrigatorType !== 'pivot') return null;

  const update = (field: string, value: string) => setOperationData({ [field]: value });

  return (
    <AppLayout step={4} totalSteps={6} title="Machine Operation">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <p className="text-muted-foreground">
          Record the operating conditions during the test. This data is captured for your report but does not affect DU calculations.
        </p>

        {/* Speed & Pressure */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-bold text-lg font-display">Speed & Pressure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Actual Speed (m/min)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 1.15" value={operationData.actualSpeed ?? ''} onChange={e => update('actualSpeed', e.target.value)} />
                <FieldHint>Speed measured at the outer tower</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Inlet Pressure (kPa)</Label>
                <Input type="number" placeholder="e.g. 399" value={operationData.inletPressure ?? ''} onChange={e => update('inletPressure', e.target.value)} />
                <FieldHint>Pressure measured at the pivot point</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Speed Test Time</Label>
                <Input placeholder="e.g. 4m 22s" value={operationData.speedTestTime ?? ''} onChange={e => update('speedTestTime', e.target.value)} />
                <FieldHint>Time to travel the reference distance</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Speed Test Distance (m)</Label>
                <Input type="number" placeholder="e.g. 5" value={operationData.speedTestDistance ?? ''} onChange={e => update('speedTestDistance', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Percent Timer Setting (%)</Label>
                <Input type="number" placeholder="e.g. 80" min={0} max={100} value={operationData.percentTimer ?? ''} onChange={e => update('percentTimer', e.target.value)} />
                <FieldHint>Speed dial setting on the pivot controller</FieldHint>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spray Pattern */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-bold text-lg font-display">Spray Pattern</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Wetted Width (m)</Label>
                <Input type="number" placeholder="e.g. 14" value={operationData.wettedWidth ?? ''} onChange={e => update('wettedWidth', e.target.value)} />
                <FieldHint>How wide the spray pattern is</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Corner Arm Length (m) <span className="text-muted-foreground font-normal text-xs">optional</span></Label>
                <Input type="number" placeholder="e.g. 85" value={operationData.cornerArm ?? ''} onChange={e => update('cornerArm', e.target.value)} />
                <FieldHint>Length of corner arm if fitted. Leave blank if none.</FieldHint>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-bold text-lg font-display">Test Conditions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Weather Conditions</Label>
                <Input placeholder="e.g. Calm, 12°C, overcast" value={operationData.weatherConditions ?? ''} onChange={e => update('weatherConditions', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Wind Speed (km/h)</Label>
                <Input type="number" placeholder="e.g. 5" value={windSpeed || ''} onChange={e => setTestConditions(testDate, Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Wind Direction</Label>
                <Input placeholder="e.g. NW" value={operationData.windDirection ?? ''} onChange={e => update('windDirection', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Test Start Time</Label>
                <Input type="time" value={operationData.testStartTime ?? ''} onChange={e => update('testStartTime', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Test End Time</Label>
                <Input type="time" value={operationData.testEndTime ?? ''} onChange={e => update('testEndTime', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={() => setLocation('/data')}>
          Continue to Data Entry
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>
    </AppLayout>
  );
}
