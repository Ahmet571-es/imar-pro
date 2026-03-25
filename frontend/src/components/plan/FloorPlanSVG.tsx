import { useMemo } from 'react'

interface Room {
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  area: number
  is_exterior: boolean
  facing: string
  doors: { wall: string; position: number; width: number }[]
  windows: { wall: string; position: number; width: number }[]
}

interface Props {
  rooms: Room[]
  buildableWidth: number
  buildableHeight: number
  svgWidth?: number
  svgHeight?: number
  showDimensions?: boolean
  showGrid?: boolean
  showAxisGrid?: boolean
  planName?: string
}

const ROOM_COLORS: Record<string, string> = {
  salon: '#DBEAFE',
  yatak_odasi: '#EDE9FE',
  mutfak: '#FEF3C7',
  banyo: '#CCFBF1',
  wc: '#CCFBF1',
  antre: '#FEF9C3',
  koridor: '#E2E8F0',
  balkon: '#D1FAE5',
  diger: '#F1F5F9',
}

const ROOM_LABELS: Record<string, string> = {
  salon: 'Salon',
  yatak_odasi: 'Y.Odası',
  mutfak: 'Mutfak',
  banyo: 'Banyo',
  wc: 'WC',
  antre: 'Antre',
  koridor: 'Koridor',
  balkon: 'Balkon',
}

const WET_ROOMS = new Set(['banyo', 'wc', 'mutfak'])

// Duvar kalınlıkları (SVG pixel cinsinden — scale ile çarpılacak)
const OUTER_WALL_M = 0.25
const INNER_WALL_M = 0.10

export function FloorPlanSVG({
  rooms,
  buildableWidth,
  buildableHeight,
  svgWidth = 620,
  svgHeight = 480,
  showDimensions = true,
  showGrid = true,
  showAxisGrid = false,
  planName,
}: Props) {
  const { scale, offsetX, offsetY } = useMemo(() => {
    const padding = 55
    const scaleX = (svgWidth - 2 * padding) / (buildableWidth || 1)
    const scaleY = (svgHeight - 2 * padding) / (buildableHeight || 1)
    const s = Math.min(scaleX, scaleY)
    const ox = padding + ((svgWidth - 2 * padding) - buildableWidth * s) / 2
    const oy = padding + ((svgHeight - 2 * padding) - buildableHeight * s) / 2
    return { scale: s, offsetX: ox, offsetY: oy }
  }, [buildableWidth, buildableHeight, svgWidth, svgHeight])

  const tx = (x: number) => offsetX + x * scale
  const ty = (y: number) => svgHeight - (offsetY + y * scale)
  const ts = (s: number) => s * scale

  if (!rooms || rooms.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        Plan verisi bekleniyor...
      </div>
    )
  }

  const outerW = OUTER_WALL_M * scale
  const innerW = INNER_WALL_M * scale

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" style={{ maxHeight: svgHeight }}>
      <defs>
        {/* Background grid */}
        <pattern id="floorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#edf0f4" strokeWidth="0.3" />
        </pattern>
        {/* ANSI31 hatch for wet areas (45° diagonal) */}
        <pattern id="ansi31" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#94A3B8" strokeWidth="0.4" opacity="0.35" />
        </pattern>
        {/* Axis grid dash pattern */}
        <pattern id="axisDash" width="8" height="1" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="4" y2="0" stroke="#CBD5E1" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Background */}
      {showGrid && <rect width="100%" height="100%" fill="url(#floorGrid)" rx="4" />}

      {/* Buildable area outline (çekme sınırı) */}
      <rect
        x={tx(0)} y={ty(buildableHeight)}
        width={ts(buildableWidth)} height={ts(buildableHeight)}
        fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="6 3"
      />

      {/* Axis grid (A-B-C / 1-2-3) */}
      {showAxisGrid && <AxisGrid rooms={rooms} tx={tx} ty={ty} ts={ts} bw={buildableWidth} bh={buildableHeight} svgWidth={svgWidth} svgHeight={svgHeight} />}

      {/* Rooms */}
      {rooms.map((room, i) => {
        const rx = tx(room.x)
        const ry = ty(room.y + room.height)
        const rw = ts(room.width)
        const rh = ts(room.height)
        const isWet = WET_ROOMS.has(room.type)
        const fillColor = ROOM_COLORS[room.type] || ROOM_COLORS.diger

        return (
          <g key={i}>
            {/* Room fill */}
            <rect x={rx} y={ry} width={rw} height={rh} fill={fillColor} />

            {/* ANSI31 hatch for wet areas */}
            {isWet && <rect x={rx} y={ry} width={rw} height={rh} fill="url(#ansi31)" />}

            {/* Walls — double line for exterior, single for interior */}
            {room.is_exterior ? (
              <>
                {/* Outer wall (thick) */}
                <rect x={rx - outerW / 2} y={ry - outerW / 2}
                  width={rw + outerW} height={rh + outerW}
                  fill="none" stroke="#1e293b" strokeWidth={outerW} />
                {/* Inner wall line (thin) */}
                <rect x={rx + innerW / 2} y={ry + innerW / 2}
                  width={rw - innerW} height={rh - innerW}
                  fill="none" stroke="#475569" strokeWidth="0.4" strokeDasharray="2 2" />
              </>
            ) : (
              <rect x={rx} y={ry} width={rw} height={rh}
                fill="none" stroke="#475569" strokeWidth={innerW > 1.5 ? innerW : 1.5} />
            )}

            {/* Doors — 90° arc + wall gap */}
            {room.doors?.map((door, di) => (
              <DoorSymbol key={`door-${di}`} door={door} rx={rx} ry={ry} rw={rw} rh={rh}
                fillColor={fillColor} scale={scale} />
            ))}

            {/* Windows — triple line symbol */}
            {room.windows?.map((win, wi) => (
              <WindowSymbol key={`win-${wi}`} win={win} rx={rx} ry={ry} rw={rw} rh={rh} scale={scale} />
            ))}

            {/* Room dimension lines (per room) — extension + dimension outside room */}
            {showDimensions && rw > 35 && rh > 25 && (
              <RoomDimensions rx={rx} ry={ry} rw={rw} rh={rh} width={room.width} height={room.height} />
            )}

            {/* Room label: name + area m² + ceiling height */}
            <text
              x={rx + rw / 2} y={ry + rh / 2 - (rh > 40 ? 8 : 4)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(8, Math.min(11, rw / 6))} fontWeight="600"
              fill="#1e293b" fontFamily="var(--font-display)"
            >
              {room.name}
            </text>
            <text
              x={rx + rw / 2} y={ry + rh / 2 + 4}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(7, Math.min(9, rw / 7))} fontWeight="500"
              fill="#64748b" fontFamily="var(--font-mono)"
            >
              {room.area?.toFixed(1) || (room.width * room.height).toFixed(1)} m²
            </text>
            {/* Ceiling height label */}
            {rh > 40 && (
              <text
                x={rx + rw / 2} y={ry + rh / 2 + 14}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="6.5" fontWeight="400"
                fill="#94a3b8" fontFamily="var(--font-mono)"
              >
                h=3.00
              </text>
            )}

            {/* Furniture placeholders (very subtle) */}
            <FurniturePlaceholder type={room.type} rx={rx} ry={ry} rw={rw} rh={rh} />
          </g>
        )
      })}

      {/* Overall dimension lines */}
      {showDimensions && (
        <>
          {/* Width */}
          <DimensionLine
            x1={tx(0)} y1={svgHeight - 16} x2={tx(buildableWidth)} y2={svgHeight - 16}
            label={`${buildableWidth.toFixed(1)}m`} labelY={svgHeight - 5}
          />
          {/* Height */}
          <DimensionLineVertical
            x={12} y1={ty(0)} y2={ty(buildableHeight)}
            label={`${buildableHeight.toFixed(1)}m`}
          />
        </>
      )}

      {/* North arrow */}
      <g transform={`translate(${svgWidth - 30}, 28)`}>
        <line x1="0" y1="18" x2="0" y2="-2" stroke="#dc2626" strokeWidth="1.5" />
        <polygon points="-4,2 0,-6 4,2" fill="#dc2626" />
        <text x="0" y="-10" textAnchor="middle" fontSize="8" fontWeight="700" fill="#dc2626"
          fontFamily="var(--font-display)">K</text>
      </g>

      {/* Scale bar */}
      <g transform={`translate(${svgWidth - 85}, ${svgHeight - 14})`}>
        <line x1="0" y1="0" x2={ts(1)} y2="0" stroke="#334155" strokeWidth="2" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#334155" strokeWidth="1" />
        <line x1={ts(1)} y1="-3" x2={ts(1)} y2="3" stroke="#334155" strokeWidth="1" />
        <text x={ts(1) / 2} y="10" textAnchor="middle" fontSize="7" fill="#64748b"
          fontFamily="var(--font-mono)" fontWeight="600">1m</text>
      </g>

      {/* Plan name */}
      {planName && (
        <text x={svgWidth / 2} y={16} textAnchor="middle" fontSize="11" fontWeight="700"
          fill="#0f172a" fontFamily="var(--font-display)">
          {planName}
        </text>
      )}
    </svg>
  )
}


// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function DoorSymbol({ door, rx, ry, rw, rh, fillColor, scale }: {
  door: { wall: string; position: number; width: number }
  rx: number; ry: number; rw: number; rh: number; fillColor: string; scale: number
}) {
  const dw = door.width * scale
  const arcR = dw * 0.85
  let dx: number, dy: number, arcPath: string, gapX1: number, gapY1: number, gapX2: number, gapY2: number

  switch (door.wall) {
    case 'north':
      dx = rx + rw * door.position
      dy = ry
      arcPath = `M ${dx} ${dy} A ${arcR} ${arcR} 0 0 1 ${dx + dw} ${dy}`
      gapX1 = dx; gapY1 = dy; gapX2 = dx + dw; gapY2 = dy
      break
    case 'south':
      dx = rx + rw * door.position
      dy = ry + rh
      arcPath = `M ${dx} ${dy} A ${arcR} ${arcR} 0 0 0 ${dx + dw} ${dy}`
      gapX1 = dx; gapY1 = dy; gapX2 = dx + dw; gapY2 = dy
      break
    case 'east':
      dx = rx + rw
      dy = ry + rh * door.position
      arcPath = `M ${dx} ${dy} A ${arcR} ${arcR} 0 0 1 ${dx} ${dy + dw}`
      gapX1 = dx; gapY1 = dy; gapX2 = dx; gapY2 = dy + dw
      break
    case 'west':
    default:
      dx = rx
      dy = ry + rh * door.position
      arcPath = `M ${dx} ${dy} A ${arcR} ${arcR} 0 0 0 ${dx} ${dy + dw}`
      gapX1 = dx; gapY1 = dy; gapX2 = dx; gapY2 = dy + dw
      break
  }

  return (
    <g>
      {/* Wall gap (clear the wall line) */}
      <line x1={gapX1} y1={gapY1} x2={gapX2} y2={gapY2}
        stroke={fillColor} strokeWidth="5" />
      {/* 90° arc */}
      <path d={arcPath} fill="none" stroke="#64748b" strokeWidth="0.7" strokeDasharray="2 1.5" />
    </g>
  )
}

function WindowSymbol({ win, rx, ry, rw, rh, scale }: {
  win: { wall: string; position: number; width: number }
  rx: number; ry: number; rw: number; rh: number; scale: number
}) {
  const ww = win.width * scale
  const isH = win.wall === 'north' || win.wall === 'south'

  let wx: number, wy: number
  if (win.wall === 'south') { wx = rx + rw * win.position - ww / 2; wy = ry + rh }
  else if (win.wall === 'north') { wx = rx + rw * win.position - ww / 2; wy = ry }
  else if (win.wall === 'east') { wx = rx + rw; wy = ry + rh * win.position - ww / 2 }
  else { wx = rx; wy = ry + rh * win.position - ww / 2 }

  if (isH) {
    return (
      <g>
        <line x1={wx} y1={wy - 2.5} x2={wx + ww} y2={wy - 2.5} stroke="#0284c7" strokeWidth="0.8" />
        <line x1={wx} y1={wy} x2={wx + ww} y2={wy} stroke="#0284c7" strokeWidth="1.8" />
        <line x1={wx} y1={wy + 2.5} x2={wx + ww} y2={wy + 2.5} stroke="#0284c7" strokeWidth="0.8" />
        {/* Width label */}
        <text x={wx + ww / 2} y={wy + (win.wall === 'south' ? 10 : -6)}
          textAnchor="middle" fontSize="6" fill="#0284c7" fontFamily="var(--font-mono)">
          {win.width.toFixed(2)}
        </text>
      </g>
    )
  } else {
    return (
      <g>
        <line x1={wx - 2.5} y1={wy} x2={wx - 2.5} y2={wy + ww} stroke="#0284c7" strokeWidth="0.8" />
        <line x1={wx} y1={wy} x2={wx} y2={wy + ww} stroke="#0284c7" strokeWidth="1.8" />
        <line x1={wx + 2.5} y1={wy} x2={wx + 2.5} y2={wy + ww} stroke="#0284c7" strokeWidth="0.8" />
      </g>
    )
  }
}

function RoomDimensions({ rx, ry, rw, rh, width, height }: {
  rx: number; ry: number; rw: number; rh: number; width: number; height: number
}) {
  // Proper architectural dimension lines with extension lines
  const ext = 5  // extension line overshoot
  const gap = 3  // gap from wall to dimension line
  const offset = 10 // dimension line offset from wall

  return (
    <g opacity={0.55}>
      {/* Width dimension (bottom of room) */}
      {/* Extension lines */}
      <line x1={rx} y1={ry + rh + gap} x2={rx} y2={ry + rh + offset + ext}
        stroke="#64748b" strokeWidth="0.4" />
      <line x1={rx + rw} y1={ry + rh + gap} x2={rx + rw} y2={ry + rh + offset + ext}
        stroke="#64748b" strokeWidth="0.4" />
      {/* Dimension line */}
      <line x1={rx} y1={ry + rh + offset} x2={rx + rw} y2={ry + rh + offset}
        stroke="#64748b" strokeWidth="0.5" />
      {/* Tick marks */}
      <line x1={rx} y1={ry + rh + offset - 2} x2={rx + 3} y2={ry + rh + offset + 2}
        stroke="#64748b" strokeWidth="0.6" />
      <line x1={rx + rw} y1={ry + rh + offset - 2} x2={rx + rw - 3} y2={ry + rh + offset + 2}
        stroke="#64748b" strokeWidth="0.6" />
      {/* Width text */}
      <text x={rx + rw / 2} y={ry + rh + offset + ext + 4} textAnchor="middle"
        fontSize="6.5" fill="#475569" fontFamily="var(--font-mono)" fontWeight="500">
        {width.toFixed(2)}
      </text>

      {/* Height dimension (right of room) */}
      {/* Extension lines */}
      <line x1={rx + rw + gap} y1={ry} x2={rx + rw + offset + ext} y2={ry}
        stroke="#64748b" strokeWidth="0.4" />
      <line x1={rx + rw + gap} y1={ry + rh} x2={rx + rw + offset + ext} y2={ry + rh}
        stroke="#64748b" strokeWidth="0.4" />
      {/* Dimension line */}
      <line x1={rx + rw + offset} y1={ry} x2={rx + rw + offset} y2={ry + rh}
        stroke="#64748b" strokeWidth="0.5" />
      {/* Tick marks */}
      <line x1={rx + rw + offset - 2} y1={ry} x2={rx + rw + offset + 2} y2={ry + 3}
        stroke="#64748b" strokeWidth="0.6" />
      <line x1={rx + rw + offset - 2} y1={ry + rh} x2={rx + rw + offset + 2} y2={ry + rh - 3}
        stroke="#64748b" strokeWidth="0.6" />
      {/* Height text */}
      <text x={rx + rw + offset + ext + 4} y={ry + rh / 2} textAnchor="middle"
        fontSize="6.5" fill="#475569" fontFamily="var(--font-mono)" fontWeight="500"
        transform={`rotate(-90, ${rx + rw + offset + ext + 4}, ${ry + rh / 2})`}>
        {height.toFixed(2)}
      </text>
    </g>
  )
}

function DimensionLine({ x1, y1, x2, y2, label, labelY }: {
  x1: number; y1: number; x2: number; y2: number; label: string; labelY: number
}) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="0.7" />
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke="#64748b" strokeWidth="0.5" />
      <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} stroke="#64748b" strokeWidth="0.5" />
      <text x={(x1 + x2) / 2} y={labelY} textAnchor="middle" fontSize="8" fontWeight="600"
        fill="#475569" fontFamily="var(--font-mono)">{label}</text>
    </g>
  )
}

function DimensionLineVertical({ x, y1, y2, label }: {
  x: number; y1: number; y2: number; label: string
}) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#64748b" strokeWidth="0.7" />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke="#64748b" strokeWidth="0.5" />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke="#64748b" strokeWidth="0.5" />
      <text x={x} y={(y1 + y2) / 2} textAnchor="middle" fontSize="8" fontWeight="600"
        fill="#475569" fontFamily="var(--font-mono)"
        transform={`rotate(-90, ${x}, ${(y1 + y2) / 2})`}>{label}</text>
    </g>
  )
}

function AxisGrid({ rooms, tx, ty, ts, bw, bh, svgWidth, svgHeight }: {
  rooms: Room[]; tx: (x: number) => number; ty: (y: number) => number
  ts: (s: number) => number; bw: number; bh: number; svgWidth: number; svgHeight: number
}) {
  // Generate axis positions from room edges
  const xPositions = new Set<number>()
  const yPositions = new Set<number>()
  xPositions.add(0)
  xPositions.add(bw)
  yPositions.add(0)
  yPositions.add(bh)
  rooms.forEach(r => {
    xPositions.add(r.x)
    xPositions.add(r.x + r.width)
    yPositions.add(r.y)
    yPositions.add(r.y + r.height)
  })

  const xAxes = Array.from(xPositions).sort((a, b) => a - b)
  const yAxes = Array.from(yPositions).sort((a, b) => a - b)
  const labels = 'ABCDEFGHIJKLMNOP'

  return (
    <g opacity={0.4}>
      {xAxes.slice(0, 10).map((x, i) => (
        <g key={`ax-${i}`}>
          <line x1={tx(x)} y1={ty(bh) - 5} x2={tx(x)} y2={ty(0) + 5}
            stroke="#94a3b8" strokeWidth="0.4" strokeDasharray="4 3" />
          <circle cx={tx(x)} cy={ty(bh) - 12} r="7" fill="white" stroke="#94a3b8" strokeWidth="0.5" />
          <text x={tx(x)} y={ty(bh) - 9} textAnchor="middle" fontSize="7" fontWeight="600"
            fill="#64748b" fontFamily="var(--font-display)">{labels[i] || i}</text>
        </g>
      ))}
      {yAxes.slice(0, 10).map((y, i) => (
        <g key={`ay-${i}`}>
          <line x1={tx(0) - 5} y1={ty(y)} x2={tx(bw) + 5} y2={ty(y)}
            stroke="#94a3b8" strokeWidth="0.4" strokeDasharray="4 3" />
          <circle cx={tx(0) - 12} cy={ty(y)} r="7" fill="white" stroke="#94a3b8" strokeWidth="0.5" />
          <text x={tx(0) - 12} y={ty(y) + 3} textAnchor="middle" fontSize="7" fontWeight="600"
            fill="#64748b" fontFamily="var(--font-display)">{i + 1}</text>
        </g>
      ))}
    </g>
  )
}

function FurniturePlaceholder({ type, rx, ry, rw, rh }: {
  type: string; rx: number; ry: number; rw: number; rh: number
}) {
  const cx = rx + rw / 2
  const cy = ry + rh / 2

  switch (type) {
    case 'yatak_odasi':
      // Bed rectangle (subtle)
      if (rw > 35 && rh > 30) {
        const bedW = Math.min(rw * 0.5, 28)
        const bedH = Math.min(rh * 0.4, 20)
        return (
          <rect x={cx - bedW / 2} y={cy - bedH / 2 + 6} width={bedW} height={bedH}
            fill="none" stroke="#C4B5FD" strokeWidth="0.5" rx="2" opacity="0.4" />
        )
      }
      return null
    case 'mutfak':
      // Counter line along one wall
      if (rw > 30) {
        return (
          <line x1={rx + 4} y1={ry + rh - 6} x2={rx + rw - 4} y2={ry + rh - 6}
            stroke="#FCD34D" strokeWidth="2" opacity="0.3" />
        )
      }
      return null
    case 'banyo':
      // Bathtub outline
      if (rw > 25 && rh > 20) {
        return (
          <rect x={rx + 3} y={ry + 3} width={Math.min(rw * 0.7, 24)} height={Math.min(rh * 0.3, 10)}
            fill="none" stroke="#5EEAD4" strokeWidth="0.5" rx="3" opacity="0.35" />
        )
      }
      return null
    case 'salon':
      // Sofa outline
      if (rw > 50 && rh > 35) {
        const sofaW = Math.min(rw * 0.4, 35)
        return (
          <rect x={cx - sofaW / 2} y={ry + rh - 16} width={sofaW} height={10}
            fill="none" stroke="#93C5FD" strokeWidth="0.5" rx="2" opacity="0.3" />
        )
      }
      return null
    default:
      return null
  }
}
