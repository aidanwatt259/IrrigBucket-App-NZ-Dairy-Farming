import { useEffect, useState } from 'react';
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

const irrigatorNameLabel: Record<string, string> = {
  pivot: 'Pivot Name / ID',
  lateral: 'Machine Name / ID',
  kline: 'K-Line Name / ID',
  gun: 'Gun Name / ID',
  solid: 'System Name / ID',
  boom: 'Machine Name / ID',
};

export default function SystemSetup() {
  const [, setLocation] = useLocation();
  const {
    irrigatorType, systemParams, setSystemParams, generatePlan,
    operationData, setOperationData, testDate, windSpeed, setTestConditions,
  } = useAppStore();
  const [hasEndGun, setHasEndGun] = useState<string>(systemParams.hasEndGun ?? 'No');

  useEffect(() => {
    if (!irrigatorType) setLocation('/');
  }, [irrigatorType, setLocation]);

  const baseSchema = z.object({
    diameter: z.coerce.number().min(50).max(1000),
    targetDepth: z.coerce.number().min(1).max(100),
    farmName: z.string().optional(),
    irrigatorName: z.string().optional(),
    assessorName: z.string().optional(),
    testDate: z.string().optional(),
    // Common to every irrigator type
    operatingPressure: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().min(0).max(10000).optional(),
    ),
    pressureUnit: z.enum(['kPa', 'psi']).optional().default('kPa'),
    testRunMinutes: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().min(1).max(1440).optional(),
    ),
  });

  let schema = baseSchema as z.ZodTypeAny;

  if (irrigatorType === 'pivot') {
    schema = baseSchema.extend({
      armLength: z.coerce.number().min(10).max(5000),
      spans: z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        z.coerce.number().min(2).max(30).optional(),
      ),
      hasEndGun: z.string().optional().default('No'),
      revolutionTime: z.coerce.number().min(0).max(200).optional(),
      numSprinklers: z.coerce.number().min(0).max(10000).optional(),
      flowRate: z.coerce.number().min(0).max(10000).optional(),
    });
  } else if (irrigatorType === 'lateral') {
    schema = baseSchema.extend({ machineWidth: z.coerce.number().min(10).max(1000) });
  } else if (irrigatorType === 'kline') {
    schema = baseSchema.extend({
      podSpacing: z.coerce.number().min(5).max(50),
      podsPerLateral: z.coerce.number().min(2).max(30),
      klineTestMinutes: z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        z.coerce.number().min(1).max(1440).optional(),
      ),
      klineSetHours: z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        z.coerce.number().min(0.1).max(48).optional(),
      ),
    });
  } else if (irrigatorType === 'gun') {
    schema = baseSchema.extend({
      gunRadius: z.coerce.number().min(10).max(200),
      laneSpacing: z.coerce.number().min(10).max(200),
      gunNumBuckets: z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        z.coerce.number().min(4).max(100).optional(),
      ),
    });
  } else if (irrigatorType === 'solid') {
    schema = baseSchema.extend({ sprinklerSpacing: z.coerce.number().min(5).max(50) });
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
      farmName: operationData.farmName ?? '',
      irrigatorName: operationData.irrigatorName ?? '',
      assessorName: operationData.assessorName ?? '',
      testDate: testDate || new Date().toISOString().split('T')[0],
      operatingPressure: systemParams.operatingPressure || undefined,
      pressureUnit: systemParams.pressureUnit ?? 'kPa',
      testRunMinutes: systemParams.testRunMinutes || undefined,
      armLength: systemParams.armLength || 400,
      spans: systemParams.spans || 8,
      hasEndGun: systemParams.hasEndGun ?? 'No',
      machineWidth: systemParams.machineWidth || 100,
      podSpacing: systemParams.podSpacing || 15,
      podsPerLateral: systemParams.podsPerLateral || 8,
      klineTestMinutes: systemParams.klineTestMinutes || undefined,
      klineSetHours: systemParams.klineSetHours || 24,
      gunRadius: systemParams.gunRadius || 40,
      laneSpacing: systemParams.laneSpacing || 60,
      gunNumBuckets: systemParams.gunNumBuckets || undefined,
      sprinklerSpacing: systemParams.sprinklerSpacing || 18,
      boomWidth: systemParams.boomWidth || 30,
      nozzleSpacing: systemParams.nozzleSpacing || 2,
    }
  });

  const onSubmit = (data: FormData) => {
    const { farmName, irrigatorName, assessorName, testDate: td, ...techParams } = data as FormData & {
      farmName?: string; irrigatorName?: string; assessorName?: string; testDate?: string;
    };
    const merged = { ...techParams, hasEndGun } as Partial<typeof systemParams>;
    // K-Line records its test duration in klineTestMinutes — mirror it into the
    // generic testRunMinutes so intensity uses one consistent source everywhere.
    if (irrigatorType === 'kline' && merged.klineTestMinutes) {
      merged.testRunMinutes = merged.klineTestMinutes;
    }
    setSystemParams(merged);
    setOperationData({ farmName: farmName ?? '', irrigatorName: irrigatorName ?? '', assessorName: assessorName ?? '' });
    if (td) setTestConditions(td, windSpeed);
    generatePlan();
    setLocation('/plan');
  };

  if (!irrigatorType) return null;

  const isPivot = irrigatorType === 'pivot';
  const isMoving = ['pivot', 'lateral', 'gun', 'boom'].includes(irrigatorType);
  const typeLabel: Record<string, string> = {
    pivot: 'Centre Pivot', lateral: 'Lateral Move', kline: 'K-Line / Pods',
    gun: 'Travelling Gun', solid: 'Solid Set / Fixed', boom: 'Roto Rainer',
  };

  return (
    <AppLayout step={2} totalSteps={isPivot ? 6 : 5} title="System Details">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Test Information — all irrigator types */}
          <Card className="mb-6">
            <CardContent className="pt-8 space-y-6">
              <h3 className="text-xl font-bold font-display border-b pb-2">Test Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="farmName">Farm Name <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input id="farmName" placeholder="e.g. Wiper Farm Road" {...register('farmName')} />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="irrigatorName">
                    {irrigatorNameLabel[irrigatorType] ?? 'Irrigator Name / ID'}{' '}
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Input id="irrigatorName" placeholder="e.g. Pivot 2 North" {...register('irrigatorName')} />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="assessorName">Assessor Name <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input id="assessorName" placeholder="e.g. John Smith" {...register('assessorName')} />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="testDate">Test Date <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input id="testDate" type="date" {...register('testDate')} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardContent className="pt-8 space-y-8">

              <div className="space-y-6">
                <h3 className="text-xl font-bold font-display border-b pb-2">Bucket Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="diameter">Bucket Top Diameter (mm)</Label>
                    <Input id="diameter" type="number" step="1" {...register('diameter')} />
                    {errors.diameter && <p className="text-destructive text-sm">{String(errors.diameter.message)}</p>}
                    <FieldHint>Standard 9L bucket is ~250mm. Measure yours for accuracy.</FieldHint>
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

                {isPivot && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="armLength">Pivot Length / Radius (m) <span className="text-red-500">*</span></Label>
                        <Input id="armLength" type="number" {...register('armLength')} />
                        {errors.armLength && <p className="text-destructive text-sm">{String((errors.armLength as { message?: string }).message)}</p>}
                        <FieldHint>Distance from pivot centre to the end tower</FieldHint>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="spans">Number of Spans <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                        <Input id="spans" type="number" min={2} {...register('spans')} />
                        {errors.spans && <p className="text-destructive text-sm">{String((errors.spans as { message?: string }).message)}</p>}
                        <FieldHint>Count of spans from centre to end tower</FieldHint>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="hasEndGun">Has End Gun?</Label>
                      <select
                        id="hasEndGun"
                        value={hasEndGun}
                        onChange={(e) => setHasEndGun(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes — the pivot has a gun that throws beyond the end tower</option>
                      </select>
                      <FieldHint>If yes, 3 additional bucket positions will be added beyond the end tower.</FieldHint>
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-semibold text-base text-muted-foreground">Optional — for report detail</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="revolutionTime">Full Revolution Time (hours)</Label>
                          <Input id="revolutionTime" type="number" step="0.1" placeholder="e.g. 48" {...register('revolutionTime')} />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="numSprinklers">Total Number of Sprinklers</Label>
                          <Input id="numSprinklers" type="number" placeholder="e.g. 120" {...register('numSprinklers')} />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="flowRate">System Flow Rate (L/s)</Label>
                          <Input id="flowRate" type="number" step="0.1" placeholder="e.g. 42" {...register('flowRate')} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {irrigatorType === 'lateral' && (
                    <div className="space-y-3">
                      <Label htmlFor="machineWidth">Machine Width (m)</Label>
                      <Input id="machineWidth" type="number" {...register('machineWidth')} />
                    </div>
                  )}
                  {irrigatorType === 'kline' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="podSpacing">Pod Spacing (m)</Label>
                        <Input id="podSpacing" type="number" {...register('podSpacing')} />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="podsPerLateral">Pods Per Lateral</Label>
                        <Input id="podsPerLateral" type="number" {...register('podsPerLateral')} />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="klineTestMinutes">Test Run Time (minutes)</Label>
                        <Input id="klineTestMinutes" type="number" step="1" placeholder="e.g. 60" {...register('klineTestMinutes')} />
                        {errors.klineTestMinutes && <p className="text-destructive text-sm">{String((errors.klineTestMinutes as { message?: string }).message)}</p>}
                        <FieldHint>How long the pods ran while water collected in the buckets. Required to calculate application depth.</FieldHint>
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="klineSetHours">Set Run Time (hours)</Label>
                        <Input id="klineSetHours" type="number" step="0.5" placeholder="e.g. 24" {...register('klineSetHours')} />
                        {errors.klineSetHours && <p className="text-destructive text-sm">{String((errors.klineSetHours as { message?: string }).message)}</p>}
                        <FieldHint>How long the K-Line runs in one position per set. NZ K-Line is commonly 12–24 hrs.</FieldHint>
                      </div>
                    </>
                  )}
                  {irrigatorType === 'gun' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="gunRadius">Gun Wetted Radius (m)</Label>
                        <Input id="gunRadius" type="number" {...register('gunRadius')} />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="laneSpacing">Lane Spacing (m)</Label>
                        <Input id="laneSpacing" type="number" {...register('laneSpacing')} />
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <Label htmlFor="gunNumBuckets">Number of Buckets <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input id="gunNumBuckets" type="number" placeholder="e.g. 8" {...register('gunNumBuckets')} />
                        <FieldHint>Leave blank to auto-calculate. Professionals often use 8 buckets.</FieldHint>
                      </div>
                    </>
                  )}
                  {irrigatorType === 'solid' && (
                    <div className="space-y-3">
                      <Label htmlFor="sprinklerSpacing">Sprinkler Spacing (m)</Label>
                      <Input id="sprinklerSpacing" type="number" {...register('sprinklerSpacing')} />
                    </div>
                  )}
                  {irrigatorType === 'boom' && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="boomWidth">Boom Width (m)</Label>
                        <Input id="boomWidth" type="number" {...register('boomWidth')} />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="nozzleSpacing">Nozzle Spacing (m)</Label>
                        <Input id="nozzleSpacing" type="number" step="0.1" {...register('nozzleSpacing')} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Test Conditions — common to every irrigator type */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold font-display border-b pb-2">Test Conditions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="operatingPressure">Water Input Pressure</Label>
                    <div className="flex gap-2">
                      <Input id="operatingPressure" type="number" step="0.1" placeholder="e.g. 400" className="flex-1" {...register('operatingPressure')} />
                      <select
                        aria-label="Pressure unit"
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...register('pressureUnit')}
                      >
                        <option value="kPa">kPa</option>
                        <option value="psi">psi</option>
                      </select>
                    </div>
                    {errors.operatingPressure && <p className="text-destructive text-sm">{String((errors.operatingPressure as { message?: string }).message)}</p>}
                    <FieldHint>Water pressure measured at the irrigator. Enter in kPa or psi.</FieldHint>
                  </div>

                  {irrigatorType !== 'kline' && (
                    <div className="space-y-3">
                      <Label htmlFor="testRunMinutes">Test Run Time (minutes)</Label>
                      <Input id="testRunMinutes" type="number" step="1" placeholder="e.g. 60" {...register('testRunMinutes')} />
                      {errors.testRunMinutes && <p className="text-destructive text-sm">{String((errors.testRunMinutes as { message?: string }).message)}</p>}
                      <FieldHint>
                        {isMoving
                          ? 'How long one full pass over the bucket line took. Used to calculate application intensity (mm/hr).'
                          : 'How long the system ran while water collected in the buckets (min ~60 min). Used to calculate application intensity (mm/hr).'}
                      </FieldHint>
                    </div>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full">
            {isPivot ? 'Calculate Bucket Test Setup →' : 'Calculate Test Plan →'}
          </Button>
        </form>
      </motion.div>
    </AppLayout>
  );
}
