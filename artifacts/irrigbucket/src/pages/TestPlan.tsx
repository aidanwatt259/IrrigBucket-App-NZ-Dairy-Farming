import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Printer, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function TestPlan() {
  const [, setLocation] = useLocation();
  const { plan, irrigatorType } = useAppStore();
  const [checks, setChecks] = useState([false, false, false, false]);

  useEffect(() => {
    if (!plan) {
      setLocation('/setup');
    }
  }, [plan, setLocation]);

  const allChecked = checks.every(Boolean);

  const toggleCheck = (index: number) => {
    const newChecks = [...checks];
    newChecks[index] = !newChecks[index];
    setChecks(newChecks);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!plan) return null;

  return (
    <AppLayout step={3} title="Bucket Test Plan">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-8 text-center">
              <div className="text-6xl font-display font-extrabold text-primary mb-2">
                {plan.bucketCount}
              </div>
              <p className="text-lg font-semibold text-foreground">Total Buckets Required</p>
            </CardContent>
          </Card>
          
          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="pt-8 text-center">
              <div className="text-6xl font-display font-extrabold text-secondary mb-2">
                {plan.spacing}<span className="text-3xl ml-1">m</span>
              </div>
              <p className="text-lg font-semibold text-foreground">Spacing Between Buckets</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-8">
            <h3 className="text-xl font-bold font-display mb-4">Placement Pattern</h3>
            <p className="text-lg text-muted-foreground mb-8">{plan.pattern}</p>
            
            {/* Visual Diagram Placeholder - simplified SVG */}
            <div className="bg-muted/30 rounded-xl p-8 flex justify-center items-center overflow-hidden border border-border/50">
              <svg width="100%" height="120" viewBox="0 0 400 120" className="max-w-full">
                {/* Ground line */}
                <line x1="0" y1="100" x2="400" y2="100" stroke="#cbd5e1" strokeWidth="4" />
                
                {/* Dynamically draw buckets based on count up to a visual max of 12 */}
                {Array.from({ length: Math.min(plan.bucketCount, 12) }).map((_, i, arr) => {
                  const x = 40 + (i * (320 / (arr.length - 1 || 1)));
                  return (
                    <g key={i} transform={`translate(${x}, 85)`}>
                      <path d="M-10,0 L10,0 L7,15 L-7,15 Z" fill="#0ea5e9" opacity="0.8" />
                      <circle cx="0" cy="-20" r="4" fill="#15803d" opacity={i % 2 === 0 ? 0 : 0.4} />
                      <circle cx="-5" cy="-10" r="3" fill="#15803d" opacity={i % 3 === 0 ? 0 : 0.3} />
                      <circle cx="5" cy="-30" r="5" fill="#15803d" opacity={i % 2 !== 0 ? 0 : 0.5} />
                    </g>
                  );
                })}
                
                {plan.bucketCount > 12 && (
                  <text x="200" y="60" textAnchor="middle" fill="#64748b" className="text-sm font-semibold">
                    ... + {plan.bucketCount - 12} more buckets
                  </text>
                )}
                
                {/* Dimension arrow */}
                <line x1="40" y1="115" x2={40 + (320 / (Math.min(plan.bucketCount, 12) - 1 || 1))} y2="115" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={40 + (160 / (Math.min(plan.bucketCount, 12) - 1 || 1))} y="135" textAnchor="middle" fill="#64748b" className="text-xs font-bold">
                  {plan.spacing}m
                </text>

                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                  </marker>
                </defs>
              </svg>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/50 shadow-md">
          <CardContent className="pt-8">
            <h3 className="text-xl font-bold font-display mb-6">Pre-Test Checklist</h3>
            <div className="space-y-4">
              {[
                "Wind speed is below 15 km/h",
                "System is running at normal operating pressure",
                "Buckets are identical and level",
                "Ready to start timer when water hits first bucket"
              ].map((text, i) => (
                <div key={i} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox 
                    id={`check-${i}`} 
                    checked={checks[i]} 
                    onCheckedChange={() => toggleCheck(i)} 
                  />
                  <Label htmlFor={`check-${i}`} className="text-base font-medium cursor-pointer flex-1">
                    {text}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button variant="outline" size="lg" className="flex-1" onClick={handlePrint}>
            <Printer className="w-5 h-5 mr-2" />
            Print Plan
          </Button>
          <Button 
            size="lg" 
            className="flex-1" 
            disabled={!allChecked}
            onClick={() => setLocation('/data')}
          >
            I've Completed the Test
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
}
