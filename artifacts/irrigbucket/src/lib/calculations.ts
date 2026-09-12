export type PressureUnit = 'kPa' | 'psi';

export interface SystemParams {
  diameter: number;
  targetDepth: number;

  // Common to every irrigator type
  testRunMinutes?: number;          // how long the timed bucket test ran (minutes)
  operatingPressure?: number;       // water input / operating pressure (value)
  pressureUnit?: PressureUnit;      // unit the pressure was entered in

  // Pivot
  armLength?: number;
  spans?: number;
  hasEndGun?: string;       // 'Yes' | 'No'
  revolutionTime?: number;  // hours
  numSprinklers?: number;
  flowRate?: number;

  // Travelling Gun
  machineWidth?: number;
  laneSpacing?: number;
  gunRadius?: number;
  gunNumBuckets?: number;

  // K-Line
  podSpacing?: number;
  podsPerLateral?: number;
  klineTestMinutes?: number;  // how long the buckets collected during the timed test
  klineSetHours?: number;     // how long the K-Line runs in one position per set/shift

  // Solid Set / Boom
  sprinklerSpacing?: number;
  rowSpacing?: number;
  nozzleSpacing?: number;
  boomWidth?: number;
}

export interface OperationData {
  assessorName?: string;
  farmName?: string;
  irrigatorName?: string;
  actualSpeed?: string;
  inletPressure?: string;
  speedTestTime?: string;
  speedTestDistance?: string;
  percentTimer?: string;
  wettedWidth?: string;
  cornerArm?: string;
  weatherConditions?: string;
  windDirection?: string;
  testStartTime?: string;
  testEndTime?: string;
}

export interface PivotSection {
  name: string;
  from: number;
  to: number;
  buckets: number;
  spacing: number;
  sectionLength: number;
  isGun?: boolean;
  isExcluded?: boolean;  // Section A — no buckets, display only
}

export interface Plan {
  bucketCount: number;
  spacing: number;
  pattern: string;
  startOffset?: number;
  armLength?: number;
  numSpans?: number;
  pivotSections?: PivotSection[];
}

export interface SectionDefinition {
  name: string;
  fromBucket: number;
  toBucket: number;
}

export interface SectionResult {
  name: string;
  du: number;
  duStatus: 'good' | 'fair' | 'poor';
  avgDepth: number;
  depthDiff: number;
  depthStatus: 'good' | 'fair' | 'poor';
  bucketCount: number;
}

export interface TestResults {
  du: number;
  avgDepth: number;
  stdDev: number;
  avgVolume: number;
  bucketArea: number;
  allVolumes: number[];
  validVolumes: number[];
  sections: SectionResult[];
  targetDepth: number;
  depthDiff: number;
  duStatus: 'good' | 'fair' | 'poor';
  depthStatus: 'good' | 'fair' | 'poor';
}

export function calculatePlan(type: string, params: SystemParams): Plan {
  if (type === 'pivot') {
    const arm = params.armLength || 400;
    const hasGun = params.hasEndGun === 'Yes';

    // Industry-standard section split: A=inner ¼, B=middle ½, C=outer ¼
    const quarterLen = Math.round(arm / 4);

    const sectionAEnd = quarterLen;                     // 0 → ¼
    const sectionBStart = quarterLen;
    const sectionBEnd = Math.round(arm * 0.75);        // ¼ → ¾
    const sectionBLen = sectionBEnd - sectionBStart;
    const sectionCStart = sectionBEnd;
    const sectionCLen = arm - sectionCStart;             // ¾ → end

    // ~21m target spacing for B, ~11m for C
    const bBuckets = Math.max(2, Math.ceil(sectionBLen / 21));
    const bSpacing = Number((sectionBLen / (bBuckets - 1)).toFixed(1));

    const cBuckets = Math.max(2, Math.ceil(sectionCLen / 11));
    const cSpacing = Number((sectionCLen / (cBuckets - 1)).toFixed(1));

    const gunBuckets = hasGun ? 3 : 0;
    const gunSpacing = 5;
    const gunEnd = arm + (gunBuckets - 1) * gunSpacing;

    const totalBuckets = bBuckets + cBuckets + gunBuckets;

    const pivotSections: PivotSection[] = [
      {
        name: 'Section A (Inner)',
        from: 0,
        to: sectionAEnd,
        buckets: 0,
        spacing: 0,
        sectionLength: sectionAEnd,
        isExcluded: true,
      },
      {
        name: 'Section B (Mid spans)',
        from: sectionBStart,
        to: sectionBEnd,
        buckets: bBuckets,
        spacing: bSpacing,
        sectionLength: sectionBLen,
      },
      {
        name: 'Section C (Outer spans)',
        from: sectionCStart,
        to: arm,
        buckets: cBuckets,
        spacing: cSpacing,
        sectionLength: sectionCLen,
      },
      ...(hasGun ? [{
        name: 'End Gun',
        from: arm,
        to: gunEnd,
        buckets: gunBuckets,
        spacing: gunSpacing,
        sectionLength: (gunBuckets - 1) * gunSpacing,
        isGun: true,
      }] : []),
    ];

    const pattern =
      `Place ${totalBuckets} buckets in a straight radial line. ` +
      `Start at ${sectionBStart}m from the pivot centre (skip the inner ${sectionAEnd}m). ` +
      `Section B (${sectionBStart}–${sectionBEnd}m): ${bBuckets} buckets at ${bSpacing}m spacing. ` +
      `Section C (${sectionCStart}–${arm}m): ${cBuckets} buckets at ${cSpacing}m spacing. ` +
      (hasGun ? `End Gun: ${gunBuckets} buckets at ${gunSpacing}m spacing beyond ${arm}m. ` : '') +
      `Keep all buckets at least 15m from wheel tracks.`;

    return {
      bucketCount: totalBuckets,
      spacing: bSpacing,
      pattern,
      startOffset: sectionBStart,
      armLength: arm,
      numSpans: params.spans,
      pivotSections,
    };
  }

  // ---- Non-pivot types ----
  let count = 0;
  let spacing = 0;
  let pattern = '';

  switch (type) {
    case 'lateral':
      spacing = (params.machineWidth || 100) / 12;
      count = 12;
      pattern = 'Line perpendicular to the direction of travel';
      break;
    case 'kline':
      spacing = params.podSpacing || 15;
      count = (params.podsPerLateral || 8) + 2;
      pattern = 'One bucket near each pod, plus one at each end of the line';
      break;
    case 'gun': {
      spacing = (params.gunRadius || 40) / 4;
      count = params.gunNumBuckets || Math.max(8, Math.ceil((params.laneSpacing || 60) / spacing));
      pattern = 'Grid transect across the lane spacing';
      break;
    }
    case 'solid':
      spacing = (params.sprinklerSpacing || 18) / 4;
      count = 12;
      pattern = 'Even grid between 4 adjacent sprinklers';
      break;
    case 'boom':
      spacing = params.nozzleSpacing || 2;
      count = Math.ceil((params.boomWidth || 30) / spacing);
      pattern = 'Straight line directly under the boom path';
      break;
    default:
      count = 10;
      spacing = 5;
      pattern = 'Even spacing across wetted area';
  }

  if (count < 4) count = 4;
  if (count > 200) count = 200;
  if (spacing <= 0 || !isFinite(spacing)) spacing = 5;

  return {
    bucketCount: count,
    spacing: Number(spacing.toFixed(1)),
    pattern,
  };
}

export function populationStdDev(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

export function calcDU(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  return 1 - (populationStdDev(values) / mean);
}

export function duStatusRating(du: number): 'good' | 'fair' | 'poor' {
  return du >= 0.80 ? 'good' : du >= 0.65 ? 'fair' : 'poor';
}

export function depthStatusRating(depthDiff: number): 'good' | 'fair' | 'poor' {
  return depthDiff <= 10 ? 'good' : depthDiff <= 25 ? 'fair' : 'poor';
}

export interface KlineApplication {
  caughtDepth: number;       // mm collected in the buckets during the timed test
  testMinutes: number;       // duration of the timed test
  applicationRate: number;   // mm/hr — caught depth normalised to an hourly rate
  setHours: number;          // operational run time per set/shift used for the depth
  perSetDepth: number;       // mm applied over a full set (the accurate application depth)
  depthDiff: number;         // % difference of per-set depth vs target
  depthStatus: 'good' | 'fair' | 'poor';
}

// NZ bucket-test method for stationary K-Line/pod systems:
//   rate (mm/hr)        = caught depth (mm) / test run time (hr)
//   per-set depth (mm)  = rate (mm/hr) * set run time (hr)
// Sources: IrrigationNZ Bucket Test, DairyNZ irrigation bucket test, RX Plastics K-Line.
export function calcKlineApplication(
  caughtDepth: number,
  targetDepth: number,
  testMinutes?: number,
  setHours?: number,
): KlineApplication | null {
  if (!testMinutes || testMinutes <= 0 || caughtDepth <= 0) return null;
  const testHours = testMinutes / 60;
  const applicationRate = caughtDepth / testHours;
  const effectiveSetHours = setHours && setHours > 0 ? setHours : testHours;
  const perSetDepth = applicationRate * effectiveSetHours;
  const depthDiff = targetDepth > 0
    ? (Math.abs(perSetDepth - targetDepth) / targetDepth) * 100
    : 0;
  return {
    caughtDepth,
    testMinutes,
    applicationRate,
    setHours: effectiveSetHours,
    perSetDepth,
    depthDiff,
    depthStatus: depthStatusRating(depthDiff),
  };
}

// Application intensity (mm/hr) for any irrigator type:
//   rate = caught depth (mm) / run time (hr)
// This is the same normalisation calcKlineApplication uses, generalised so that
// every type (pivot, lateral, gun, solid, boom) can report an intensity once a
// timed test run has been recorded.
export function calcApplicationRate(avgDepthMm: number, testRunMinutes?: number): number | null {
  if (!testRunMinutes || testRunMinutes <= 0 || avgDepthMm <= 0) return null;
  return avgDepthMm / (testRunMinutes / 60);
}

// Resolve the effective timed-test run duration (minutes) for a type. K-Line
// stores its test duration in the more specific klineTestMinutes field, so fall
// back to it when the generic testRunMinutes has not been captured.
export function getEffectiveTestRunMinutes(type: string, params: SystemParams): number | undefined {
  if (params.testRunMinutes && params.testRunMinutes > 0) return params.testRunMinutes;
  if (type === 'kline' && params.klineTestMinutes && params.klineTestMinutes > 0) return params.klineTestMinutes;
  return undefined;
}

export const PSI_TO_KPA = 6.89476;

// Convert an entered pressure to kPa for range checks / comparisons.
export function pressureToKpa(value?: number, unit?: PressureUnit): number | null {
  if (value == null || !isFinite(value) || value <= 0) return null;
  return unit === 'psi' ? value * PSI_TO_KPA : value;
}

// Display the operating pressure exactly as the user entered it (value + unit).
export function formatPressure(params: SystemParams): string | null {
  const { operatingPressure, pressureUnit } = params;
  if (operatingPressure == null || !isFinite(operatingPressure) || operatingPressure <= 0) return null;
  return `${operatingPressure} ${pressureUnit ?? 'kPa'}`;
}

export function sectionsFromPivot(pivotSections: PivotSection[]): SectionDefinition[] {
  let bucketIndex = 1;
  return pivotSections
    .filter(sec => !sec.isExcluded && sec.buckets > 0)
    .map(sec => {
      const from = bucketIndex;
      const to = bucketIndex + sec.buckets - 1;
      bucketIndex = to + 1;
      return { name: sec.name, fromBucket: from, toBucket: to };
    });
}

export function calculateTestResults(
  volumes: number[],
  diameter: number,
  targetDepth: number,
  sectionDefs: SectionDefinition[]
): TestResults | null {
  const validVolumes = volumes.filter(v => v > 0);
  if (validVolumes.length < 4) return null;

  const radius = diameter / 2;
  const bucketArea = Math.PI * radius * radius;

  const avgVolume = validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length;
  const avgDepth = (1000 * avgVolume) / bucketArea;
  const stdDev = populationStdDev(validVolumes);
  const du = calcDU(validVolumes);
  const depthDiff = Math.abs(avgDepth - targetDepth) / targetDepth * 100;

  const sections: SectionResult[] = sectionDefs
    .map(sec => {
      const from = sec.fromBucket - 1;
      const to = sec.toBucket;
      const sectionVolumes = volumes.slice(from, to).filter(v => v > 0);
      if (sectionVolumes.length < 2) return null;

      const secAvgVol = sectionVolumes.reduce((a, b) => a + b, 0) / sectionVolumes.length;
      const secDepth = (1000 * secAvgVol) / bucketArea;
      const secDU = sectionVolumes.length >= 2 ? calcDU(sectionVolumes) : NaN;
      const secDepthDiff = Math.abs(secDepth - targetDepth) / targetDepth * 100;

      return {
        name: sec.name,
        du: secDU,
        duStatus: isNaN(secDU) ? 'fair' : duStatusRating(secDU),
        avgDepth: secDepth,
        depthDiff: secDepthDiff,
        depthStatus: depthStatusRating(secDepthDiff),
        bucketCount: sectionVolumes.length,
      } as SectionResult;
    })
    .filter((s): s is SectionResult => s !== null);

  return {
    du, avgDepth, stdDev, avgVolume, bucketArea,
    allVolumes: volumes, validVolumes, sections,
    targetDepth, depthDiff,
    duStatus: duStatusRating(du),
    depthStatus: depthStatusRating(depthDiff),
  };
}
