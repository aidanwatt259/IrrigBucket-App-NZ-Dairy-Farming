import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SystemSetup() {
  const [, setLocation] = useLocation();
  const { irrigatorType, systemParams, setSystemParams, generatePlan } = useAppStore();

  useEffect(() => {
    if (!irrigatorType) {
      setLocation('/');
    }
  }, [irrigatorType, setLocation]);

  // Dynamic schema based on type
  const baseSchema = z.object({
    diameter: z.coerce.number().min(50).max(1000),
    targetDepth: z.coerce.number().min(1).max(100),
  });

  let schema = baseSchema;
  
  if (irrigatorType === 'pivot') {
    schema = baseSchema.extend({
      armLength: z.coerce.number().min(10).max(2000).describe("Pivot arm length (m)"),
      spans: z.coerce.number().min(1).max(30).describe("Number of spans"),
    });
  } else if (irrigatorType === 'lateral') {
    schema = baseSchema.extend({
      machineWidth: z.coerce.number().min(10).max(1000).describe("Machine width (m)"),
    });
  } else if (irrigatorType === 'kline') {
    schema = baseSchema.extend({
      podSpacing: z.coerce.number().min(5).max(50).describe("Pod spacing (m)"),
      podsPerLateral: z.coerce.number().min(2).max(30).describe("Pods per lateral"),
    });
  } else if (irrigatorType === 'gun') {
    schema = baseSchema.extend({
      gunRadius: z.coerce.number().min(10).max(100).describe("Gun radius (m)"),
      laneSpacing: z.coerce.number().min(10).max(200).describe("Lane spacing (m)"),
    });
  } else if (irrigatorType === 'solid') {
    schema = baseSchema.extend({
      sprinklerSpacing: z.coerce.number().min(5).max(50).describe("Sprinkler spacing (m)"),
    });
  } else if (irrigatorType === 'boom') {
    schema = baseSchema.extend({
      boomWidth: z.coerce.number().min(5).max(100).describe("Boom width (m)"),
      nozzleSpacing: z.coerce.number().min(0.5).max(10).describe("Nozzle spacing (m)"),
    });
  }

  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...systemParams,
      // Provide defaults if empty
      armLength: systemParams.armLength || 400,
      spans: systemParams.spans || 8,
      machineWidth: systemParams.machineWidth || 100,
      podSpacing: systemParams.podSpacing || 15,
      podsPerLateral: systemParams.podsPerLateral || 8,
      gunRadius: systemParams.gunRadius || 40,
      laneSpacing: systemParams.laneSpacing || 60,
      sprinklerSpacing: systemParams.sprinklerSpacing || 18,
      boomWidth: systemParams.boomWidth || 30,
      nozzleSpacing: systemParams.nozzleSpacing || 2,
    }
  });

  const onSubmit = (data: FormData) => {
    setSystemParams(data);
    generatePlan();
    setLocation('/plan');
  };

  if (!irrigatorType) return null;

  return (
    <AppLayout step={2} title="System Details">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="mb-8">
            <CardContent className="pt-8 space-y-8">
              
              <div className="space-y-6">
                <h3 className="text-xl font-bold font-display border-b pb-2">Common Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="diameter">Bucket Top Diameter (mm)</Label>
                    <Input id="diameter" type="number" step="1" {...register('diameter')} />
                    {errors.diameter && <p className="text-destructive text-sm">{String(errors.diameter.message)}</p>}
                    <p className="text-sm text-muted-foreground">Standard 9L bucket is ~250mm</p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="targetDepth">Target Application Depth (mm)</Label>
                    <Input id="targetDepth" type="number" step="0.1" {...register('targetDepth')} />
                    {errors.targetDepth && <p className="text-destructive text-sm">{String(errors.targetDepth.message)}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-bold font-display border-b pb-2 capitalize">
                  {irrigatorType.replace('_', ' ')} Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {irrigatorType === 'pivot' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="armLength">Pivot Arm Length (m)</Label>
                        <Input id="armLength" type="number" {...register('armLength')} />
                        {errors.armLength && <p className="text-destructive text-sm">{String(errors.armLength.message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="spans">Number of Spans</Label>
                        <Input id="spans" type="number" {...register('spans')} />
                        {errors.spans && <p className="text-destructive text-sm">{String(errors.spans.message)}</p>}
                      </div>
                    </>
                  )}
                  {irrigatorType === 'lateral' && (
                    <div className="space-y-3">
                      <Label htmlFor="machineWidth">Machine Width (m)</Label>
                      <Input id="machineWidth" type="number" {...register('machineWidth')} />
                      {errors.machineWidth && <p className="text-destructive text-sm">{String(errors.machineWidth.message)}</p>}
                    </div>
                  )}
                  {irrigatorType === 'kline' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="podSpacing">Pod Spacing (m)</Label>
                        <Input id="podSpacing" type="number" {...register('podSpacing')} />
                        {errors.podSpacing && <p className="text-destructive text-sm">{String(errors.podSpacing.message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="podsPerLateral">Pods Per Lateral</Label>
                        <Input id="podsPerLateral" type="number" {...register('podsPerLateral')} />
                        {errors.podsPerLateral && <p className="text-destructive text-sm">{String(errors.podsPerLateral.message)}</p>}
                      </div>
                    </>
                  )}
                  {irrigatorType === 'gun' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="gunRadius">Gun Wetted Radius (m)</Label>
                        <Input id="gunRadius" type="number" {...register('gunRadius')} />
                        {errors.gunRadius && <p className="text-destructive text-sm">{String(errors.gunRadius.message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="laneSpacing">Lane Spacing (m)</Label>
                        <Input id="laneSpacing" type="number" {...register('laneSpacing')} />
                        {errors.laneSpacing && <p className="text-destructive text-sm">{String(errors.laneSpacing.message)}</p>}
                      </div>
                    </>
                  )}
                  {irrigatorType === 'solid' && (
                    <div className="space-y-3">
                      <Label htmlFor="sprinklerSpacing">Sprinkler Spacing (m)</Label>
                      <Input id="sprinklerSpacing" type="number" {...register('sprinklerSpacing')} />
                      {errors.sprinklerSpacing && <p className="text-destructive text-sm">{String(errors.sprinklerSpacing.message)}</p>}
                    </div>
                  )}
                  {irrigatorType === 'boom' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="boomWidth">Boom Width (m)</Label>
                        <Input id="boomWidth" type="number" {...register('boomWidth')} />
                        {errors.boomWidth && <p className="text-destructive text-sm">{String(errors.boomWidth.message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="nozzleSpacing">Nozzle Spacing (m)</Label>
                        <Input id="nozzleSpacing" type="number" step="0.1" {...register('nozzleSpacing')} />
                        {errors.nozzleSpacing && <p className="text-destructive text-sm">{String(errors.nozzleSpacing.message)}</p>}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full">
            Calculate Test Plan
          </Button>
        </form>
      </motion.div>
    </AppLayout>
  );
}
