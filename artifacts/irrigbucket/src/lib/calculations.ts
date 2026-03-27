export interface SystemParams {
  diameter: number; // mm
  targetDepth: number; // mm
  
  // Pivot
  armLength?: number;
  spans?: number;
  
  // Lateral / Gun
  machineWidth?: number;
  laneSpacing?: number;
  gunRadius?: number;
  
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
}

export function calculatePlan(type: string, params: SystemParams): Plan {
  let count = 0;
  let spacing = 0;
  let pattern = "";

  switch (type) {
    case 'pivot':
      spacing = (params.armLength || 400) / ((params.spans || 8) * 4);
      count = Math.max(8, Math.min(24, Math.ceil((params.armLength || 400) / spacing)));
      pattern = "Straight line from pivot center to end tower";
      break;
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
    case 'gun':
      spacing = (params.gunRadius || 40) / 4;
      count = Math.max(8, Math.ceil((params.laneSpacing || 60) / spacing));
      pattern = "Grid transect across the lane spacing";
      break;
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

  // Sanity checks
  if (count < 4) count = 4;
  if (count > 40) count = 40;
  if (spacing <= 0 || !isFinite(spacing)) spacing = 5;

  return {
    bucketCount: count,
    spacing: Number(spacing.toFixed(1)),
    pattern
  };
}

export function convertVolumeToDepth(volumeML: number, diameterMM: number): number {
  if (!volumeML || !diameterMM) return 0;
  const radiusCM = diameterMM / 2 / 10;
  const areaCM2 = Math.PI * Math.pow(radiusCM, 2);
  // 1 mL = 1 cm³. Depth (cm) = Vol / Area. Depth (mm) = Depth (cm) * 10
  return (volumeML / areaCM2) * 10;
}

export function calculateResults(volumes: number[], diameter: number) {
  const validVolumes = volumes.filter(v => v > 0);
  if (validVolumes.length === 0) {
    return { du: 0, cv: 0, avgDepth: 0, allDepths: [] };
  }

  const depths = validVolumes.map(v => convertVolumeToDepth(v, diameter));
  const sum = depths.reduce((a, b) => a + b, 0);
  const avgDepth = sum / depths.length;

  // DU calculation
  const sortedDepths = [...depths].sort((a, b) => a - b);
  const lowestQuarterCount = Math.max(1, Math.floor(sortedDepths.length * 0.25));
  const lowestQuarter = sortedDepths.slice(0, lowestQuarterCount);
  const lowestQuarterAvg = lowestQuarter.reduce((a, b) => a + b, 0) / lowestQuarterCount;
  const du = (lowestQuarterAvg / avgDepth) * 100;

  // CV calculation
  const squareDiffs = depths.map(d => Math.pow(d - avgDepth, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / depths.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avgDepth) * 100;

  return {
    du: isNaN(du) ? 0 : du,
    cv: isNaN(cv) ? 0 : cv,
    avgDepth: isNaN(avgDepth) ? 0 : avgDepth,
    allDepths: depths
  };
}
