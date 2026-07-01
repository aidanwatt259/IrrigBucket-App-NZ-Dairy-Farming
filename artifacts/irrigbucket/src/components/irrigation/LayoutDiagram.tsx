import { SystemParams, Plan, PivotSection } from '@/lib/calculations';

/* ----------------------------------------------------------------------------
 * Shared visual language
 *   - pale wetted zone rectangles
 *   - blue bucket dots
 *   - teal sprinkler / pod nodes
 *   - dashed travel arrows + dimension lines
 * -------------------------------------------------------------------------- */

const COLORS = {
  ground: '#94a3b8',
  zone: '#dbeafe',
  zoneBorder: '#93c5fd',
  laneZone: '#bfdbfe',
  bucket: '#2563eb',
  node: '#0d9488',
  nodeWet: '#ccfbf1',
  muted: '#64748b',
  dark: '#1e293b',
  dim: '#94a3b8',
};

function bucketRow(count: number, x0: number, x1: number, y: number, r = 3.5) {
  const dots: React.ReactNode[] = [];
  const n = Math.max(1, Math.min(count, 24));
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1);
    dots.push(<circle key={i} cx={x} cy={y} r={r} fill={COLORS.bucket} />);
  }
  return dots;
}

function VArrow({ x, y1, y2, label }: { x: number; y1: number; y2: number; label?: string }) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={COLORS.muted} strokeWidth={1.2} strokeDasharray="3,2" />
      <polygon points={`${x - 3.5},${y2 - 7} ${x + 3.5},${y2 - 7} ${x},${y2}`} fill={COLORS.muted} />
      {label && (
        <text x={x + 6} y={(y1 + y2) / 2} fill={COLORS.muted} fontSize={8}>{label}</text>
      )}
    </g>
  );
}

function Dim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={COLORS.dim} strokeWidth={1} />
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} stroke={COLORS.dim} strokeWidth={1} />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke={COLORS.dim} strokeWidth={1} />
      <text x={(x1 + x2) / 2} y={y + 12} textAnchor="middle" fill={COLORS.muted} fontSize={9}>{label}</text>
    </g>
  );
}

/* ---------------------------------- Pivot --------------------------------- */

const SECTION_COLORS = {
  A: { fill: '#e2e8f0', text: '#94a3b8' },
  B: { fill: '#dbeafe', border: '#3b82f6', text: '#1d4ed8', dot: '#3b82f6' },
  C: { fill: '#ccfbf1', border: '#0d9488', text: '#0f766e', dot: '#0d9488' },
  gun: { fill: '#ffedd5', border: '#f97316', text: '#c2410c', dot: '#f97316' },
};

export function PivotDiagram({ pivotSections, armLength }: { pivotSections: PivotSection[]; armLength: number }) {
  const W = 400; const H = 100;
  const ML = 20; const MR = 20;
  const armW = W - ML - MR;
  const hasGun = pivotSections.some(s => s.isGun);

  const getX = (m: number) => ML + (m / (hasGun ? (armLength + 25) : armLength)) * armW;

  const sectionA = pivotSections.find(s => s.isExcluded);
  const nonGun = pivotSections.filter(x => !x.isExcluded && !x.isGun);
  const sectionB = nonGun[0];
  const sectionC = nonGun[1];
  const sectionGun = pivotSections.find(s => s.isGun);

  const renderDots = (sec: PivotSection, color: string) => {
    const dots: React.ReactNode[] = [];
    const maxDots = Math.min(sec.buckets, 15);
    for (let i = 0; i < maxDots; i++) {
      const pos = sec.from + (sec.buckets === 1 ? 0 : i * (sec.sectionLength / (sec.buckets - 1)));
      dots.push(<circle key={i} cx={getX(pos)} cy={55} r={3.5} fill={color} />);
    }
    return dots;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Pivot section diagram">
      <line x1={ML} y1={60} x2={W - MR} y2={60} stroke={COLORS.ground} strokeWidth={3} />

      {sectionA && (
        <rect x={getX(sectionA.from)} y={45} width={getX(sectionA.to) - getX(sectionA.from)} height={15}
          fill={SECTION_COLORS.A.fill} rx={2} />
      )}
      {sectionB && (
        <rect x={getX(sectionB.from)} y={45} width={getX(sectionB.to) - getX(sectionB.from)} height={15}
          fill={SECTION_COLORS.B.fill} stroke={SECTION_COLORS.B.border} strokeWidth={1} rx={2} />
      )}
      {sectionC && (
        <rect x={getX(sectionC.from)} y={45} width={getX(sectionC.to) - getX(sectionC.from)} height={15}
          fill={SECTION_COLORS.C.fill} stroke={SECTION_COLORS.C.border} strokeWidth={1} rx={2} />
      )}
      {sectionGun && (
        <rect x={getX(sectionGun.from)} y={45} width={getX(sectionGun.to) - getX(sectionGun.from)} height={15}
          fill={SECTION_COLORS.gun.fill} stroke={SECTION_COLORS.gun.border} strokeWidth={1} rx={2} />
      )}

      {sectionB && renderDots(sectionB, SECTION_COLORS.B.dot!)}
      {sectionC && renderDots(sectionC, SECTION_COLORS.C.dot!)}
      {sectionGun && renderDots(sectionGun, SECTION_COLORS.gun.dot!)}

      <circle cx={ML} cy={60} r={5} fill={COLORS.dark} />
      <text x={ML} y={80} textAnchor="middle" fill={COLORS.muted} fontSize={9}>Centre</text>

      <line x1={getX(armLength)} y1={40} x2={getX(armLength)} y2={70} stroke={COLORS.muted} strokeWidth={1.5} strokeDasharray="3,2" />
      <text x={getX(armLength)} y={82} textAnchor="middle" fill={COLORS.muted} fontSize={9}>Tip</text>

      {sectionA && (
        <text x={(getX(sectionA.from) + getX(sectionA.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.A.text} fontSize={8} fontWeight="bold">A</text>
      )}
      {sectionB && (
        <text x={(getX(sectionB.from) + getX(sectionB.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.B.text} fontSize={8} fontWeight="bold">B</text>
      )}
      {sectionC && (
        <text x={(getX(sectionC.from) + getX(sectionC.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.C.text} fontSize={8} fontWeight="bold">C</text>
      )}
      {sectionGun && (
        <text x={(getX(sectionGun.from) + getX(sectionGun.to)) / 2} y={38} textAnchor="middle" fill={SECTION_COLORS.gun.text} fontSize={8} fontWeight="bold">Gun</text>
      )}
    </svg>
  );
}

/* --------------------------------- Lateral -------------------------------- */
// Single line of buckets across the machine width, perpendicular to travel.

function LateralDiagram({ params, plan }: { params: SystemParams; plan: Plan }) {
  const W = 400; const H = 150;
  const x0 = 40; const x1 = W - 40;
  const width = params.machineWidth || 100;
  const pipeY = 46; const bucketY = 84;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Lateral move layout diagram">
      {/* Lateral pipe with tower ticks */}
      <line x1={x0} y1={pipeY} x2={x1} y2={pipeY} stroke={COLORS.dark} strokeWidth={3} />
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={x0 + f * (x1 - x0)} y1={pipeY - 4} x2={x0 + f * (x1 - x0)} y2={pipeY + 4} stroke={COLORS.dark} strokeWidth={1.5} />
      ))}
      <text x={(x0 + x1) / 2} y={pipeY - 8} textAnchor="middle" fill={COLORS.muted} fontSize={9}>Lateral machine</text>

      {/* Wetted zone band */}
      <rect x={x0} y={bucketY - 12} width={x1 - x0} height={24} fill={COLORS.zone} stroke={COLORS.zoneBorder} strokeWidth={1} rx={3} />

      {/* Bucket line */}
      {bucketRow(plan.bucketCount, x0, x1, bucketY)}

      {/* Travel arrow (perpendicular to the bucket line) */}
      <VArrow x={x1 + 16} y1={pipeY} y2={bucketY + 22} label="travel" />

      {/* Width dimension */}
      <Dim x1={x0} x2={x1} y={bucketY + 30} label={`${width} m machine width`} />
    </svg>
  );
}

/* --------------------------------- K-Line --------------------------------- */
// Pods along a lateral; one bucket near each pod plus one at each end.

function KlineDiagram({ params, plan }: { params: SystemParams; plan: Plan }) {
  const W = 400; const H = 150;
  const x0 = 40; const x1 = W - 40;
  const lineY = 70;
  const podSpacing = params.podSpacing || 15;
  const podCount = Math.max(2, Math.min(params.podsPerLateral || 8, 12));

  const podXs: number[] = [];
  for (let i = 0; i < podCount; i++) {
    const x = podCount === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (podCount - 1);
    podXs.push(x);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="K-Line layout diagram">
      {/* Lateral hose */}
      <line x1={x0 - 6} y1={lineY} x2={x1 + 6} y2={lineY} stroke={COLORS.dark} strokeWidth={2} />

      {/* Pods with pale wetted circles */}
      {podXs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={lineY} r={13} fill={COLORS.nodeWet} stroke={COLORS.node} strokeWidth={0.75} opacity={0.7} />
          <circle cx={x} cy={lineY} r={3.5} fill={COLORS.node} />
        </g>
      ))}

      {/* Buckets: one just below each pod + one beyond each end */}
      {podXs.map((x, i) => (
        <circle key={`b${i}`} cx={x} cy={lineY + 22} r={3.5} fill={COLORS.bucket} />
      ))}
      <circle cx={x0 - 16} cy={lineY + 22} r={3.5} fill={COLORS.bucket} />
      <circle cx={x1 + 16} cy={lineY + 22} r={3.5} fill={COLORS.bucket} />

      <text x={(x0 + x1) / 2} y={26} textAnchor="middle" fill={COLORS.muted} fontSize={9}>
        {plan.bucketCount} buckets — one per pod + one each end
      </text>

      {/* Pod spacing dimension between first two pods */}
      {podXs.length >= 2 && (
        <Dim x1={podXs[0]} x2={podXs[1]} y={lineY + 38} label={`${podSpacing} m pod spacing`} />
      )}
    </svg>
  );
}

/* -------------------------------- Gun / Boom ------------------------------ */
// Transverse line across the full wetted width of one lane.

function GunDiagram({ params, plan }: { params: SystemParams; plan: Plan }) {
  const W = 400; const H = 160;
  const x0 = 30; const x1 = W - 30;
  const gunRadius = params.gunRadius || 40;
  const wetted = gunRadius * 2;
  const laneSpacing = params.laneSpacing || 60;
  const bucketY = 84;

  const span = Math.max(wetted, laneSpacing);
  const mToPx = (x1 - x0) / span;
  const wettedPx = wetted * mToPx;
  const lanePx = laneSpacing * mToPx;
  const cx = (x0 + x1) / 2;
  const wettedX0 = cx - wettedPx / 2;
  const wettedX1 = cx + wettedPx / 2;
  const laneX0 = cx - lanePx / 2;
  const laneX1 = cx + lanePx / 2;
  const overlap = laneSpacing < wetted;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Travelling gun layout diagram">
      {/* Full wetted-width band */}
      <rect x={wettedX0} y={bucketY - 14} width={wettedPx} height={28} fill={COLORS.zone} stroke={COLORS.zoneBorder} strokeWidth={1} rx={3} />
      {/* Lane band (where the gun path centres) */}
      <rect x={laneX0} y={bucketY - 14} width={lanePx} height={28} fill={COLORS.laneZone} stroke={COLORS.zoneBorder} strokeWidth={1} rx={3} />

      {/* Gun cart on the lane centre-line */}
      <circle cx={cx} cy={bucketY - 26} r={4} fill={COLORS.dark} />
      <text x={cx} y={bucketY - 32} textAnchor="middle" fill={COLORS.muted} fontSize={8}>Gun path</text>

      {/* Buckets across the full wetted width */}
      {bucketRow(plan.bucketCount, wettedX0 + 6, wettedX1 - 6, bucketY)}

      {/* Travel arrow (gun travels along the lane, perpendicular to the line) */}
      <VArrow x={cx} y1={bucketY - 22} y2={bucketY + 34} label="travel" />

      {/* Dimensions */}
      <Dim x1={wettedX0} x2={wettedX1} y={bucketY + 30} label={`${wetted} m wetted width`} />
      <Dim x1={laneX0} x2={laneX1} y={bucketY + 48} label={`${laneSpacing} m lane spacing${overlap ? ' (overlaps)' : ''}`} />
    </svg>
  );
}

function BoomDiagram({ params, plan }: { params: SystemParams; plan: Plan }) {
  const W = 400; const H = 150;
  const x0 = 40; const x1 = W - 40;
  const boomWidth = params.boomWidth || 30;
  const nozzleSpacing = params.nozzleSpacing || 2;
  const boomY = 46; const bucketY = 84;

  const nozzleCount = Math.max(2, Math.min(Math.round(boomWidth / nozzleSpacing) + 1, 20));
  const nozzleXs: number[] = [];
  for (let i = 0; i < nozzleCount; i++) {
    nozzleXs.push(x0 + (i * (x1 - x0)) / (nozzleCount - 1));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Roto Rainer boom layout diagram">
      {/* Boom bar with nozzle ticks */}
      <line x1={x0} y1={boomY} x2={x1} y2={boomY} stroke={COLORS.dark} strokeWidth={3} />
      {nozzleXs.map((x, i) => (
        <line key={i} x1={x} y1={boomY} x2={x} y2={boomY + 7} stroke={COLORS.node} strokeWidth={1.5} />
      ))}
      <text x={(x0 + x1) / 2} y={boomY - 8} textAnchor="middle" fill={COLORS.muted} fontSize={9}>Boom + nozzles</text>

      {/* Wetted zone band */}
      <rect x={x0} y={bucketY - 12} width={x1 - x0} height={24} fill={COLORS.zone} stroke={COLORS.zoneBorder} strokeWidth={1} rx={3} />

      {/* Bucket line under the boom */}
      {bucketRow(plan.bucketCount, x0, x1, bucketY)}

      {/* Travel arrow */}
      <VArrow x={x1 + 16} y1={boomY} y2={bucketY + 22} label="travel" />

      {/* Dimensions */}
      <Dim x1={x0} x2={x1} y={bucketY + 30} label={`${boomWidth} m boom width`} />
      {nozzleXs.length >= 2 && (
        <Dim x1={nozzleXs[0]} x2={nozzleXs[1]} y={bucketY + 48} label={`${nozzleSpacing} m nozzle spacing`} />
      )}
    </svg>
  );
}

/* -------------------------------- Solid Set ------------------------------- */
// Grid of buckets inside one cell bounded by four sprinkler heads.

function SolidDiagram({ params, plan }: { params: SystemParams; plan: Plan }) {
  const W = 400; const H = 200;
  const sprinklerSpacing = params.sprinklerSpacing || 18;
  const rowSpacing = params.rowSpacing || sprinklerSpacing;

  // Cell corners
  const cellX0 = 70; const cellX1 = W - 70;
  const cellY0 = 40; const cellY1 = 150;
  const corners = [
    [cellX0, cellY0], [cellX1, cellY0],
    [cellX0, cellY1], [cellX1, cellY1],
  ];

  // Bucket grid inside the cell
  const cols = 4;
  const rows = Math.max(2, Math.ceil(plan.bucketCount / cols));
  const dots: React.ReactNode[] = [];
  let placed = 0;
  for (let r = 0; r < rows && placed < plan.bucketCount; r++) {
    for (let c = 0; c < cols && placed < plan.bucketCount; c++) {
      const gx = cellX0 + ((c + 1) * (cellX1 - cellX0)) / (cols + 1);
      const gy = cellY0 + ((r + 1) * (cellY1 - cellY0)) / (rows + 1);
      dots.push(<circle key={`d${r}-${c}`} cx={gx} cy={gy} r={3.5} fill={COLORS.bucket} />);
      placed++;
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Solid set layout diagram">
      {/* Cell outline */}
      <rect x={cellX0} y={cellY0} width={cellX1 - cellX0} height={cellY1 - cellY0} fill={COLORS.zone} stroke={COLORS.zoneBorder} strokeWidth={1} rx={3} />

      {/* Bucket grid */}
      {dots}

      {/* Sprinkler heads at the four corners */}
      {corners.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={16} fill={COLORS.nodeWet} stroke={COLORS.node} strokeWidth={0.75} opacity={0.6} />
          <circle cx={x} cy={y} r={4} fill={COLORS.node} />
        </g>
      ))}
      <text x={(cellX0 + cellX1) / 2} y={24} textAnchor="middle" fill={COLORS.muted} fontSize={9}>
        {plan.bucketCount} buckets in one 4-sprinkler cell
      </text>

      {/* Dimensions */}
      <Dim x1={cellX0} x2={cellX1} y={cellY1 + 16} label={`${sprinklerSpacing} m sprinkler spacing`} />
      <g>
        <line x1={cellX0 - 14} y1={cellY0} x2={cellX0 - 14} y2={cellY1} stroke={COLORS.dim} strokeWidth={1} />
        <line x1={cellX0 - 17} y1={cellY0} x2={cellX0 - 11} y2={cellY0} stroke={COLORS.dim} strokeWidth={1} />
        <line x1={cellX0 - 17} y1={cellY1} x2={cellX0 - 11} y2={cellY1} stroke={COLORS.dim} strokeWidth={1} />
        <text x={cellX0 - 18} y={(cellY0 + cellY1) / 2} textAnchor="middle" fill={COLORS.muted} fontSize={9}
          transform={`rotate(-90 ${cellX0 - 18} ${(cellY0 + cellY1) / 2})`}>{`${rowSpacing} m row spacing`}</text>
      </g>
    </svg>
  );
}

/* -------------------------------- Wrapper --------------------------------- */

interface LayoutDiagramProps {
  type: string;
  params: SystemParams;
  plan: Plan;
  pivotSections?: PivotSection[];
}

export function LayoutDiagram({ type, params, plan, pivotSections }: LayoutDiagramProps) {
  switch (type) {
    case 'pivot':
      return <PivotDiagram pivotSections={pivotSections ?? plan.pivotSections ?? []} armLength={plan.armLength ?? params.armLength ?? 400} />;
    case 'lateral':
      return <LateralDiagram params={params} plan={plan} />;
    case 'kline':
      return <KlineDiagram params={params} plan={plan} />;
    case 'gun':
      return <GunDiagram params={params} plan={plan} />;
    case 'boom':
      return <BoomDiagram params={params} plan={plan} />;
    case 'solid':
      return <SolidDiagram params={params} plan={plan} />;
    default:
      return <LateralDiagram params={params} plan={plan} />;
  }
}
