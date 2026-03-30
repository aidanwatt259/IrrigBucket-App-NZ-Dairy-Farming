import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { SectionDefinition } from '@/lib/calculations';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DataEntry() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType, volumes, setVolume, testDate, windSpeed, setTestConditions, sections, setSections } = useAppStore();

  const [localSections, setLocalSections] = useState<SectionDefinition[]>(
    sections.length > 0 ? sections : [
      { name: 'Inner Span', fromBucket: 1, toBucket: Math.floor((plan?.bucketCount || 12) / 2) },
      { name: 'Outer Span', fromBucket: Math.floor((plan?.bucketCount || 12) / 2) + 1, toBucket: plan?.bucketCount || 12 },
    ]
  );

  useEffect(() => {
    if (!plan) {
      setLocation('/setup');
    }
  }, [plan, setLocation]);

  const handleCalculate = () => {
    if (irrigatorType === 'pivot') {
      setSections(localSections.filter(s => s.name.trim() !== ''));
    }
    setLocation('/results');
  };

  const updateSection = (index: number, field: keyof SectionDefinition, value: string | number) => {
    setLocalSections(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addSection = () => {
    setLocalSections(prev => [...prev, { name: '', fromBucket: 1, toBucket: plan?.bucketCount || 12 }]);
  };

  const removeSection = (index: number) => {
    setLocalSections(prev => prev.filter((_, i) => i !== index));
  };

  if (!plan) return null;

  const isPivot = irrigatorType === 'pivot';

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

        {/* Section Breakdown — Centre Pivot only */}
        {isPivot && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold font-display">
                  Define Pivot Sections{' '}
                  <span className="text-sm font-normal text-muted-foreground">(optional)</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Break your pivot into sections (e.g. Inner Span, Outer Span, End Gun) to see per-section DU and depth results.
                </p>
              </div>

              <div className="space-y-3">
                {localSections.map((sec, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-end">
                    <div className="space-y-1.5">
                      {i === 0 && <Label className="text-xs text-muted-foreground">Section Name</Label>}
                      <Input
                        value={sec.name}
                        onChange={(e) => updateSection(i, 'name', e.target.value)}
                        placeholder="e.g. Inner Span"
                      />
                    </div>
                    <div className="space-y-1.5">
                      {i === 0 && <Label className="text-xs text-muted-foreground">From #</Label>}
                      <Input
                        type="number"
                        min={1}
                        max={plan.bucketCount}
                        value={sec.fromBucket || ''}
                        onChange={(e) => updateSection(i, 'fromBucket', Number(e.target.value))}
                        placeholder="1"
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      {i === 0 && <Label className="text-xs text-muted-foreground">To #</Label>}
                      <Input
                        type="number"
                        min={1}
                        max={plan.bucketCount}
                        value={sec.toBucket || ''}
                        onChange={(e) => updateSection(i, 'toBucket', Number(e.target.value))}
                        placeholder={String(plan.bucketCount)}
                        className="text-center"
                      />
                    </div>
                    <div className={i === 0 ? 'pt-6' : ''}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(i)}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addSection}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </Button>
            </CardContent>
          </Card>
        )}

        <Button 
          size="lg" 
          className="w-full" 
          onClick={handleCalculate}
          disabled={volumes.filter(v => v > 0).length < 4}
        >
          Calculate Results
        </Button>
        {volumes.filter(v => v > 0).length < 4 && (
          <p className="text-sm text-center text-muted-foreground -mt-3">
            Enter at least 4 bucket measurements to continue
          </p>
        )}
      </motion.div>
    </AppLayout>
  );
}
