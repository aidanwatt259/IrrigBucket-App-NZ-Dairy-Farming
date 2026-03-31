export interface SystemParams {
  diameter: number; // mm
  targetDepth: number; // mm

  // Pivot
  armLength?: number;
  spans?: number;
  startOffset?: number;
  numBuckets?: number;
  bucketSpacing?: number;

  // Lateral / Gun
  machineWidth?: number;
  laneSpacing?: number;
  gunRadius?: number;
  gunNumBuckets?: number;

  // K-Line
  podSpacing?: number;
  podsPerLateral?: number;

  // Solid Set / Boom
  sprinklerSpacing?: number;
  rowSpacing?: number;
  nozzleSpacing?: number;
  boomWidth?: number;
}

export interface Plan {
  bucketCount: number;
  spacing: number;
  pattern: string;
  startOffset?: number;
  armLength?: number;
}

export interface SectionDefinition {
  name: string;
  fromBucket: number; // 1-indexed inclusive
  toBucket: number;   // 1-indexed inclusive
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
  let count = 0;
  let spacing = 0;
  let pattern = "";
  let startOffset: number | undefined;
  let armLength: number | undefined;

  switch (type) {
    case 'pivot': {
      const arm = params.armLength || 400;
      const offset = params.startOffset || 0;
      const testableLength = arm - offset;
      armLength = arm;
      startOffset = offset;

      if (params.numBuckets) {
        count = params.numBuckets;
        spacing = params.bucketSpacing || Number((testableLength / (count - 1)).toFixed(1));
      } else {
        spacing = params.bucketSpacing || Number((arm / ((params.spans || 8) * 4)).toFixed(1));
        count = Math.max(8, Math.min(24, Math.ceil(testableLength / spacing) + 1));
      }

      const startDesc = offset > 0 ? `${offset}m from the pivot centre` : 'near the pivot centre';
      pattern = `Place ${count} buckets in a straight radial line starting ${startDesc} out to the end tower. Space them ${Number(spacing.toFixed(1))}m apart. Position the line at least 15m from any wheel tracks.`;
      break;
    }
    case 'lateral':
      spacing = (params.machineWidth || 100) / 12;
      count = Math.max(6, 12);
      pattern = "Line perpendicular to the direction of travel";
      break;
    case 'kline':
      spacing = params.podSpacing || 15;
      count = (params.podsPerLateral || 8) + 2;
      pattern = "One bucket near each pod, plus one at each end of the line";
      break;
    case 'gun': {
      spacing = (params.gunRadius || 40) / 4;
      if (params.gunNumBuckets) {
        count = params.gunNumBuckets;
      } else {
        count = Math.max(8, Math.ceil((params.laneSpacing || 60) / spacing));
      }
      pattern = "Grid transect across the lane spacing";
      break;
    }
    case 'solid':
      spacing = (params.sprinklerSpacing || 18) / 4;
      count = 12;
      pattern = "Even grid between 4 adjacent sprinklers";
      break;
    case 'boom':
      spacing = params.nozzleSpacing || 2;
      count = Math.ceil((params.boomWidth || 30) / spacing);
      pattern = "Straight line directly under the boom path";
      break;
    default:
      count = 10;
      spacing = 5;
      pattern = "Even spacing across wetted area";
  }

  if (count < 4) count = 4;
  if (count > 200) count = 200;
  if (spacing <= 0 || !isFinite(spacing)) spacing = 5;

  return {
    bucketCount: count,
    spacing: Number(spacing.toFixed(1)),
    pattern,
    startOffset,
    armLength,
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

export function calculateTestResults(
  volumes: number[],
  diameter: number,
  targetDepth: number,
  sectionDefs: SectionDefinition[]
): TestResults | null {
  const validVolumes = volumes.filter(v => v > 0);
  if (validVolumes.length < 4) return null;

  const radius = diameter / 2;
  const bucketArea = Math.PI * radius * radius; // mm²

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
      const secDU = calcDU(sectionVolumes);
      const secDepthDiff = Math.abs(secDepth - targetDepth) / targetDepth * 100;

      return {
        name: sec.name,
        du: secDU,
        duStatus: duStatusRating(secDU),
        avgDepth: secDepth,
        depthDiff: secDepthDiff,
        depthStatus: depthStatusRating(secDepthDiff),
        bucketCount: sectionVolumes.length,
      };
    })
    .filter((s): s is SectionResult => s !== null);

  return {
    du,
    avgDepth,
    stdDev,
    avgVolume,
    bucketArea,
    allVolumes: volumes,
    validVolumes,
    sections,
    targetDepth,
    depthDiff,
    duStatus: duStatusRating(du),
    depthStatus: depthStatusRating(depthDiff),
  };
}
