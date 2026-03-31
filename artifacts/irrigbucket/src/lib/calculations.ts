export interface SystemParams {
  diameter: number;
  targetDepth: number;

  // Pivot
  armLength?: number;
  spans?: number;
  cornerArmLength?: number;
  hasEndGun?: string;      // 'Yes' | 'No'
  gunWettedWidth?: number;

  // Travelling Gun
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

export interface PivotSection {
  name: string;
  from: number;         // m from pivot centre (0 for gun)
  to: number;           // m from pivot centre (gunWettedWidth for gun)
  buckets: number;
  spacing: number;
  sectionLength: number;
  isGun?: boolean;
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
    const numSpans = params.spans || 8;
    const hasGun = params.hasEndGun === 'Yes';
    const gunWettedWidth = params.gunWettedWidth || 0;

    const spanLength = arm / numSpans;
    const skipSpans = 2;
    const startOffset = Math.round(skipSpans * spanLength);

    const testablePivotLength = arm - startOffset;
    const innerLength = Math.round(testablePivotLength / 2);
    const outerLength = testablePivotLength - innerLength;

    const innerSpacing = Math.max(3, Math.round(innerLength / 22));
    const outerSpacing = Math.max(5, Math.round(outerLength / 22));

    const innerBuckets = Math.floor(innerLength / innerSpacing) + 1;
    const outerBuckets = Math.floor(outerLength / outerSpacing) + 1;

    let gunBuckets = 0;
    let gunSpacing = 0;
    if (hasGun && gunWettedWidth > 0) {
      gunBuckets = 8;
      gunSpacing = Math.round(gunWettedWidth / (gunBuckets - 1));
    }

    const totalBuckets = innerBuckets + outerBuckets + gunBuckets;

    const pivotSections: PivotSection[] = [
      {
        name: 'Inner Spans',
        from: startOffset,
        to: startOffset + innerLength,
        buckets: innerBuckets,
        spacing: innerSpacing,
        sectionLength: innerLength,
      },
      {
        name: 'Outer Spans',
        from: startOffset + innerLength,
        to: arm,
        buckets: outerBuckets,
        spacing: outerSpacing,
        sectionLength: outerLength,
      },
      ...(hasGun && gunWettedWidth > 0
        ? [{
            name: 'End Gun',
            from: 0,
            to: gunWettedWidth,
            buckets: gunBuckets,
            spacing: gunSpacing,
            sectionLength: gunWettedWidth,
            isGun: true,
          }]
        : []),
    ];

    const pattern =
      `Place buckets in a straight radial line starting ${startOffset}m from the pivot centre. ` +
      `The first ${innerBuckets} buckets (Inner Spans) are spaced ${innerSpacing}m apart. ` +
      `The next ${outerBuckets} buckets (Outer Spans) are spaced ${outerSpacing}m apart. ` +
      (hasGun && gunWettedWidth > 0
        ? `Place an additional ${gunBuckets} buckets perpendicular to the pivot arm at the gun position, spaced ${gunSpacing}m apart across the ${gunWettedWidth}m throw width. `
        : '') +
      `Position all radial buckets at least 15m from any wheel tracks.`;

    return {
      bucketCount: totalBuckets,
      spacing: outerSpacing,
      pattern,
      startOffset,
      armLength: arm,
      numSpans,
      pivotSections,
    };
  }

  // ---- Non-pivot types ----
  let count = 0;
  let spacing = 0;
  let pattern = "";

  switch (type) {
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

export function sectionsFromPivot(pivotSections: PivotSection[]): SectionDefinition[] {
  let bucketIndex = 1;
  return pivotSections.map(sec => {
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
