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

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export default function SystemSetup() {
  const [, setLocation] = useLocation();
  const { irrigatorType, systemParams, setSystemParams, generatePlan } = useAppStore();

  useEffect(() => {
    if (!irrigatorType) {
      setLocation('/');
    }
  }, [irrigatorType, setLocation]);

  const baseSchema = z.object({
    diameter: z.coerce.number().min(50).max(1000),
    targetDepth: z.coerce.number().min(1).max(100),
  });

  let schema = baseSchema as z.ZodTypeAny;

  if (irrigatorType === 'pivot') {
    schema = baseSchema.extend({
      armLength: z.coerce.number().min(10).max(5000),
      startOffset: z.coerce.number().min(0).max(2000).optional().default(0),
      numBuckets: z.coerce.number().min(4).max(200),
      bucketSpacing: z.coerce.number().min(1).max(500),
    });
  } else if (irrigatorType === 'lateral') {
    schema = baseSchema.extend({
      machineWidth: z.coerce.number().min(10).max(1000),
    });
  } else if (irrigatorType === 'kline') {
    schema = baseSchema.extend({
      podSpacing: z.coerce.number().min(5).max(50),
      podsPerLateral: z.coerce.number().min(2).max(30),
    });
  } else if (irrigatorType === 'gun') {
    schema = baseSchema.extend({
      gunRadius: z.coerce.number().min(10).max(200),
      laneSpacing: z.coerce.number().min(10).max(200),
      gunNumBuckets: z.coerce.number().min(4).max(100).optional(),
    });
  } else if (irrigatorType === 'solid') {
    schema = baseSchema.extend({
      sprinklerSpacing: z.coerce.number().min(5).max(50),
    });
  } else if (irrigatorType === 'boom') {
    schema = baseSchema.extend({
      boomWidth: z.coerce.number().min(5).max(100),
      nozzleSpacing: z.coerce.number().min(0.5).max(10),
    });
  }

  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...systemParams,
      armLength: systemParams.armLength || 400,
      startOffset: systemParams.startOffset ?? 0,
      numBuckets: systemParams.numBuckets || undefined,
      bucketSpacing: systemParams.bucketSpacing || undefined,
      machineWidth: systemParams.machineWidth || 100,
      podSpacing: systemParams.podSpacing || 15,
      podsPerLateral: systemParams.podsPerLateral || 8,
      gunRadius: systemParams.gunRadius || 40,
      laneSpacing: systemParams.laneSpacing || 60,
      gunNumBuckets: systemParams.gunNumBuckets || undefined,
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

  const typeLabel: Record<string, string> = {
    pivot: 'Centre Pivot',
    lateral: 'Lateral Move',
    kline: 'K-Line / Pods',
    gun: 'Travelling Gun',
    solid: 'Solid Set / Fixed',
    boom: 'Boom Spray',
  };

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
                <h3 className="text-xl font-bold font-display border-b pb-2">Bucket Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="diameter">Bucket Top Diameter (mm)</Label>
                    <Input id="diameter" type="number" step="1" {...register('diameter')} />
                    {errors.diameter && <p className="text-destructive text-sm">{String(errors.diameter.message)}</p>}
                    <FieldHint>Standard 9L bucket is ~250mm</FieldHint>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="targetDepth">Target Application Depth (mm)</Label>
                    <Input id="targetDepth" type="number" step="0.1" {...register('targetDepth')} />
                    {errors.targetDepth && <p className="text-destructive text-sm">{String(errors.targetDepth.message)}</p>}
                    <FieldHint>How much water should be applied per pass</FieldHint>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-bold font-display border-b pb-2">
                  {typeLabel[irrigatorType] || irrigatorType} Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {irrigatorType === 'pivot' && (
                    <>
                      <div className="space-y-3 md:col-span-2">
                        <Label htmlFor="armLength">Pivot Arm Length (m)</Label>
                        <Input id="armLength" type="number" {...register('armLength')} />
                        {errors.armLength && <p className="text-destructive text-sm">{String((errors.armLength as { message?: string }).message)}</p>}
                        <FieldHint>Total length from centre pivot to the end tower</FieldHint>
                      </div>

                      <div className="space-y-3 md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">⚠️</span>
                          <div>
                            <p className="font-semibold text-amber-900 mb-1">Start Offset — Skip the inner spans</p>
                            <p className="text-sm text-amber-800">Inner spans near the pivot centre rotate very slowly, making bucket tests unreliable in that zone. Set a start offset to begin measuring further out.</p>
                          </div>
                        </div>
                        <div className="space-y-3 mt-3">
                          <Label htmlFor="startOffset">Start Offset — Skip Inner Area (m)</Label>
                          <Input id="startOffset" type="number" placeholder="e.g. 185" min={0} max={2000} {...register('startOffset')} />
                          {errors.startOffset && <p className="text-destructive text-sm">{String((errors.startOffset as { message?: string }).message)}</p>}
                          <FieldHint>Distance from pivot centre where you'll start placing your first bucket. Leave 0 to start from the centre.</FieldHint>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="numBuckets">Number of Buckets</Label>
                        <Input id="numBuckets" type="number" placeholder="e.g. 46" min={4} max={200} {...register('numBuckets')} />
                        {errors.numBuckets && <p className="text-destructive text-sm">{String((errors.numBuckets as { message?: string }).message)}</p>}
                        <FieldHint>More buckets = more precise results. Professionals typically use 40–50+ buckets.</FieldHint>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="bucketSpacing">Bucket Spacing (m)</Label>
                        <Input id="bucketSpacing" type="number" placeholder="e.g. 11" min={1} max={500} {...register('bucketSpacing')} />
                        {errors.bucketSpacing && <p className="text-destructive text-sm">{String((errors.bucketSpacing as { message?: string }).message)}</p>}
                        <FieldHint>Outer spans typically use tighter spacing (e.g. 11m) than inner spans (e.g. 21m) for better resolution.</FieldHint>
                      </div>
                    </>
                  )}

                  {irrigatorType === 'lateral' && (
                    <div className="space-y-3">
                      <Label htmlFor="machineWidth">Machine Width (m)</Label>
                      <Input id="machineWidth" type="number" {...register('machineWidth')} />
                      {errors.machineWidth && <p className="text-destructive text-sm">{String((errors.machineWidth as { message?: string }).message)}</p>}
                    </div>
                  )}

                  {irrigatorType === 'kline' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="podSpacing">Pod Spacing (m)</Label>
                        <Input id="podSpacing" type="number" {...register('podSpacing')} />
                        {errors.podSpacing && <p className="text-destructive text-sm">{String((errors.podSpacing as { message?: string }).message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="podsPerLateral">Pods Per Lateral</Label>
                        <Input id="podsPerLateral" type="number" {...register('podsPerLateral')} />
                        {errors.podsPerLateral && <p className="text-destructive text-sm">{String((errors.podsPerLateral as { message?: string }).message)}</p>}
                      </div>
                    </>
                  )}

                  {irrigatorType === 'gun' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="gunRadius">Gun Wetted Radius (m)</Label>
                        <Input id="gunRadius" type="number" {...register('gunRadius')} />
                        {errors.gunRadius && <p className="text-destructive text-sm">{String((errors.gunRadius as { message?: string }).message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="laneSpacing">Lane Spacing (m)</Label>
                        <Input id="laneSpacing" type="number" {...register('laneSpacing')} />
                        {errors.laneSpacing && <p className="text-destructive text-sm">{String((errors.laneSpacing as { message?: string }).message)}</p>}
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <Label htmlFor="gunNumBuckets">Number of Buckets <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input id="gunNumBuckets" type="number" placeholder="e.g. 8" min={4} max={100} {...register('gunNumBuckets')} />
                        {errors.gunNumBuckets && <p className="text-destructive text-sm">{String((errors.gunNumBuckets as { message?: string }).message)}</p>}
                        <FieldHint>Leave blank to auto-calculate. Professionals often use 8 buckets split across both sides of the gun's path.</FieldHint>
                      </div>
                    </>
                  )}

                  {irrigatorType === 'solid' && (
                    <div className="space-y-3">
                      <Label htmlFor="sprinklerSpacing">Sprinkler Spacing (m)</Label>
                      <Input id="sprinklerSpacing" type="number" {...register('sprinklerSpacing')} />
                      {errors.sprinklerSpacing && <p className="text-destructive text-sm">{String((errors.sprinklerSpacing as { message?: string }).message)}</p>}
                    </div>
                  )}

                  {irrigatorType === 'boom' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="boomWidth">Boom Width (m)</Label>
                        <Input id="boomWidth" type="number" {...register('boomWidth')} />
                        {errors.boomWidth && <p className="text-destructive text-sm">{String((errors.boomWidth as { message?: string }).message)}</p>}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="nozzleSpacing">Nozzle Spacing (m)</Label>
                        <Input id="nozzleSpacing" type="number" step="0.1" {...register('nozzleSpacing')} />
                        {errors.nozzleSpacing && <p className="text-destructive text-sm">{String((errors.nozzleSpacing as { message?: string }).message)}</p>}
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
