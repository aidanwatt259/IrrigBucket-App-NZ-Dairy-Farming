import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DataEntry() {
  const [, setLocation] = useLocation();
  const { plan, volumes, setVolume, testDate, windSpeed, setTestConditions } = useAppStore();

  useEffect(() => {
    if (!plan) {
      setLocation('/setup');
    }
  }, [plan, setLocation]);

  const handleCalculate = () => {
    setLocation('/results');
  };

  if (!plan) return null;

  return (
    <AppLayout step={4} title="Enter Bucket Volumes">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card>
          <CardContent className="pt-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border/50">
              <div className="space-y-3">
                <Label htmlFor="testDate">Test Date</Label>
                <Input 
                  id="testDate" 
                  type="date" 
                  value={testDate}
                  onChange={(e) => setTestConditions(e.target.value, windSpeed)}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="windSpeed">Wind Speed (km/h)</Label>
                <Input 
                  id="windSpeed" 
                  type="number" 
                  min="0"
                  value={windSpeed || ''}
                  onChange={(e) => setTestConditions(testDate, Number(e.target.value))}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-6">
                <h3 className="text-xl font-bold font-display">Bucket Volumes (mL)</h3>
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {volumes.filter(v => v > 0).length} of {plan.bucketCount} entered
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: plan.bucketCount }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Label htmlFor={`bucket-${i}`} className="text-xs text-muted-foreground">
                      Bucket {i + 1}
                    </Label>
                    <Input 
                      id={`bucket-${i}`}
                      type="number" 
                      min="0"
                      className="text-lg font-semibold text-center"
                      value={volumes[i] || ''}
                      onChange={(e) => setVolume(i, Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          size="lg" 
          className="w-full" 
          onClick={handleCalculate}
          disabled={volumes.filter(v => v > 0).length === 0}
        >
          Calculate Results
        </Button>
      </motion.div>
    </AppLayout>
  );
}
