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
  planName?: string
}

const ROOM_COLORS: Record<string, string> = {
  salon: '#E3F2FD',
  yatak_odasi: '#F3E5F5',
  mutfak: '#FFF3E0',
  banyo: '#E0F2F1',
  wc: '#E0F2F1',
  antre: '#FFF8E1',
  koridor: '#ECEFF1',
  balkon: '#E8F5E9',
  diger: '#F5F5F5',
}

const WET_ROOMS = new Set(['banyo', 'wc', 'mutfak'])

export function FloorPlanSVG({
  rooms,
  buildableWidth,
  buildableHeight,
  svgWidth = 520,
  svgHeight = 440,
  showDimensions = true,
  showGrid = true,
  planName,
}: Props) {
  const { scale, offsetX, offsetY, padding } = useMemo(() => {
    const padding = 50
    const scaleX = (svgWidth - 2 * padding) / (buildableWidth || 1)
    const scaleY = (svgHeight - 2 * padding) / (buildableHeight || 1)
    const scale = Math.min(scaleX, scaleY)
    const offsetX = padding + ((svgWidth - 2 * padding) - buildableWidth * scale) / 2
    const offsetY = padding + ((svgHeight - 2 * padding) - buildableHeight * scale) / 2
    return { scale, offsetX, offsetY, padding }
  }, [buildableWidth, buildableHeight, svgWidth, svgHeight])

  const tx = (x: number) => offsetX + x * scale
  const ty = (y: number) => svgHeight - (offsetY + y * scale) // flip Y
  const ts = (s: number) => s * scale

  if (!rooms || rooms.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        Plan verisi bekleniyor...
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full" style={{ maxHeight: svgHeight }}>
      <defs>
        {/* Grid pattern */}
        <pattern id="floorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8edf2" strokeWidth="0.3" />
        </pattern>
        {/* Wet area hatch */}
        <pattern id="wetHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#90A4AE" strokeWidth="0.5" opacity="0.4" />
        </pattern>
        {/* Door arc marker */}
        <marker id="doorArc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4">
          <circle cx="5" cy="5" r="4" fill="none" stroke="#555" strokeWidth="1" />
        </marker>
      </defs>

      {/* Background grid */}
      {showGrid && <rect width="100%" height="100%" fill="url(#floorGrid)" rx="4" />}

      {/* Buildable area outline */}
      <rect
        x={tx(0)} y={ty(buildableHeight)}
        width={ts(buildableWidth)} height={ts(buildableHeight)}
        fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2"
      />

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

            {/* Wet area hatching */}
            {isWet && (
              <rect x={rx} y={ry} width={rw} height={rh} fill="url(#wetHatch)" />
            )}

            {/* Walls - double line for exterior, single for interior */}
            {room.is_exterior ? (
              <>
                {/* Outer wall */}
                <rect x={rx - 1.5} y={ry - 1.5} width={rw + 3} height={rh + 3}
                  fill="none" stroke="#1e293b" strokeWidth="3" />
                {/* Inner wall line */}
                <rect x={rx + 1} y={ry + 1} width={rw - 2} height={rh - 2}
                  fill="none" stroke="#475569" strokeWidth="0.5" />
              </>
            ) : (
              <rect x={rx} y={ry} width={rw} height={rh}
                fill="none" stroke="#475569" strokeWidth="1.5" />
            )}

            {/* Doors */}
            {room.doors?.map((door, di) => {
              const dw = ts(door.width)
              const arcR = dw * 0.9
              let dx: number, dy: number, arcPath: string

              switch (door.wall) {
                case 'north':
                  dx = rx + rw * door.position
                  dy = ry
                  arcPath = `M ${dx} ${dy} L ${dx} ${dy - arcR} A ${arcR} ${arcR} 0 0 1 ${dx + dw} ${dy}`
                  break
                case 'south':
                  dx = rx + rw * door.position
                  dy = ry + rh
                  arcPath = `M ${dx} ${dy} L ${dx} ${dy + arcR} A ${arcR} ${arcR} 0 0 0 ${dx + dw} ${dy}`
                  break
                case 'east':
                  dx = rx + rw
                  dy = ry + rh * door.position
                  arcPath = `M ${dx} ${dy} L ${dx + arcR} ${dy} A ${arcR} ${arcR} 0 0 1 ${dx} ${dy + dw}`
                  break
                case 'west':
                default:
                  dx = rx
                  dy = ry + rh * door.position
                  arcPath = `M ${dx} ${dy} L ${dx - arcR} ${dy} A ${arcR} ${arcR} 0 0 0 ${dx} ${dy + dw}`
                  break
              }

              return (
                <g key={`door-${di}`}>
                  {/* Door opening (gap in wall) */}
                  {door.wall === 'north' || door.wall === 'south' ? (
                    <line x1={dx} y1={door.wall === 'north' ? ry : ry + rh}
                      x2={dx + dw} y2={door.wall === 'north' ? ry : ry + rh}
                      stroke={fillColor} strokeWidth="4" />
                  ) : (
                    <line x1={door.wall === 'west' ? rx : rx + rw} y1={dy}
                      x2={door.wall === 'west' ? rx : rx + rw} y2={dy + dw}
                      stroke={fillColor} strokeWidth="4" />
                  )}
                  {/* 90° arc */}
                  <path d={arcPath} fill="none" stroke="#64748b" strokeWidth="0.7" strokeDasharray="2 1" />
                </g>
              )
            })}

            {/* Windows (triple line symbol) */}
            {room.windows?.map((win, wi) => {
              const ww = ts(win.width)
              const isHorizontal = win.wall === 'north' || win.wall === 'south'

              let wx: number, wy: number

              if (win.wall === 'south') {
                wx = rx + rw * win.position - ww / 2
                wy = ry + rh
              } else if (win.wall === 'north') {
                wx = rx + rw * win.position - ww / 2
                wy = ry
              } else if (win.wall === 'east') {
                wx = rx + rw
                wy = ry + rh * win.position - ww / 2
              } else {
                wx = rx
                wy = ry + rh * win.position - ww / 2
              }

              if (isHorizontal) {
                return (
                  <g key={`win-${wi}`}>
                    <line x1={wx} y1={wy - 2} x2={wx + ww} y2={wy - 2} stroke="#0ea5e9" strokeWidth="1" />
                    <line x1={wx} y1={wy} x2={wx + ww} y2={wy} stroke="#0ea5e9" strokeWidth="1.5" />
                    <line x1={wx} y1={wy + 2} x2={wx + ww} y2={wy + 2} stroke="#0ea5e9" strokeWidth="1" />
                  </g>
                )
              } else {
                return (
                  <g key={`win-${wi}`}>
                    <line x1={wx - 2} y1={wy} x2={wx - 2} y2={wy + ww} stroke="#0ea5e9" strokeWidth="1" />
                    <line x1={wx} y1={wy} x2={wx} y2={wy + ww} stroke="#0ea5e9" strokeWidth="1.5" />
                    <line x1={wx + 2} y1={wy} x2={wx + 2} y2={wy + ww} stroke="#0ea5e9" strokeWidth="1" />
                  </g>
                )
              }
            })}

            {/* Room label */}
            <text
              x={rx + rw / 2} y={ry + rh / 2 - 4}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.min(11, rw / 6)} fontWeight="600"
              fill="#334155" fontFamily="var(--font-display)"
            >
              {room.name}
            </text>
            <text
              x={rx + rw / 2} y={ry + rh / 2 + 9}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.min(9, rw / 7)} fontWeight="500"
              fill="#64748b" fontFamily="var(--font-mono)"
            >
              {room.area.toFixed(1)} m²
            </text>
          </g>
        )
      })}

      {/* Dimension lines */}
      {showDimensions && (
        <>
          {/* Width dimension */}
          <g>
            <line x1={tx(0)} y1={svgHeight - 18} x2={tx(buildableWidth)} y2={svgHeight - 18}
              stroke="#94a3b8" strokeWidth="0.7" markerStart="url(#dimStart)" markerEnd="url(#dimEnd)" />
            <line x1={tx(0)} y1={svgHeight - 14} x2={tx(0)} y2={svgHeight - 22} stroke="#94a3b8" strokeWidth="0.5" />
            <line x1={tx(buildableWidth)} y1={svgHeight - 14} x2={tx(buildableWidth)} y2={svgHeight - 22}
              stroke="#94a3b8" strokeWidth="0.5" />
            <text x={(tx(0) + tx(buildableWidth)) / 2} y={svgHeight - 8}
              textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="var(--font-mono)">
              {buildableWidth.toFixed(1)}m
            </text>
          </g>
          {/* Height dimension */}
          <g>
            <line x1={14} y1={ty(0)} x2={14} y2={ty(buildableHeight)}
              stroke="#94a3b8" strokeWidth="0.7" />
            <line x1={10} y1={ty(0)} x2={18} y2={ty(0)} stroke="#94a3b8" strokeWidth="0.5" />
            <line x1={10} y1={ty(buildableHeight)} x2={18} y2={ty(buildableHeight)} stroke="#94a3b8" strokeWidth="0.5" />
            <text x={8} y={(ty(0) + ty(buildableHeight)) / 2}
              textAnchor="middle" fontSize="9" fill="#64748b"
              fontFamily="var(--font-mono)" transform={`rotate(-90, 8, ${(ty(0) + ty(buildableHeight)) / 2})`}>
              {buildableHeight.toFixed(1)}m
            </text>
          </g>
        </>
      )}

      {/* North arrow */}
      <g transform={`translate(${svgWidth - 30}, 25)`}>
        <line x1="0" y1="18" x2="0" y2="-2" stroke="#dc2626" strokeWidth="1.5" />
        <polygon points="-4,2 0,-6 4,2" fill="#dc2626" />
        <text x="0" y="-10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#dc2626">K</text>
      </g>

      {/* Scale bar */}
      <g transform={`translate(${svgWidth - 80}, ${svgHeight - 16})`}>
        <line x1="0" y1="0" x2={ts(1)} y2="0" stroke="#475569" strokeWidth="1.5" />
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#475569" strokeWidth="0.7" />
        <line x1={ts(1)} y1="-3" x2={ts(1)} y2="3" stroke="#475569" strokeWidth="0.7" />
        <text x={ts(1) / 2} y="10" textAnchor="middle" fontSize="7" fill="#64748b" fontFamily="var(--font-mono)">
          1m
        </text>
      </g>

      {/* Plan name */}
      {planName && (
        <text x={svgWidth / 2} y={16} textAnchor="middle" fontSize="11" fontWeight="600"
          fill="#334155" fontFamily="var(--font-display)">
          {planName}
        </text>
      )}
    </svg>
  )
}
