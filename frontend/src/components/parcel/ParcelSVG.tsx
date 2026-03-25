import { useMemo } from 'react'
import type { Coordinate } from '@/types'

interface Props {
  parselCoords: Coordinate[]
  cekmeCoords?: Coordinate[] | null
  width?: number
  height?: number
}

export function ParcelSVG({ parselCoords, cekmeCoords, width = 400, height = 400 }: Props) {
  const { svgPoints, cekmePoints, transform, edgeLengths, area } = useMemo(() => {
    if (parselCoords.length < 3) return { svgPoints: '', cekmePoints: '', transform: '', edgeLengths: [], area: 0 }

    const xs = parselCoords.map((c) => c.x)
    const ys = parselCoords.map((c) => c.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    const w = maxX - minX || 1
    const h = maxY - minY || 1

    const padding = 60
    const scaleX = (width - 2 * padding) / w
    const scaleY = (height - 2 * padding) / h
    const scale = Math.min(scaleX, scaleY)

    const offsetX = padding + ((width - 2 * padding) - w * scale) / 2
    const offsetY = padding + ((height - 2 * padding) - h * scale) / 2

    const toSVG = (c: Coordinate) => ({
      x: (c.x - minX) * scale + offsetX,
      y: height - ((c.y - minY) * scale + offsetY), // flip Y
    })

    const pts = parselCoords.map(toSVG)
    const svgPoints = pts.map((p) => `${p.x},${p.y}`).join(' ')

    let cekmePoints = ''
    if (cekmeCoords && cekmeCoords.length >= 3) {
      const cPts = cekmeCoords.map(toSVG)
      cekmePoints = cPts.map((p) => `${p.x},${p.y}`).join(' ')
    }

    // Edge lengths
    const edgeLengths: { mx: number; my: number; len: number; angle: number }[] = []
    const coordsNoLast = parselCoords.length > 0 && 
      parselCoords[0].x === parselCoords[parselCoords.length - 1].x &&
      parselCoords[0].y === parselCoords[parselCoords.length - 1].y
        ? parselCoords.slice(0, -1)
        : parselCoords

    for (let i = 0; i < coordsNoLast.length; i++) {
      const p1 = coordsNoLast[i]
      const p2 = coordsNoLast[(i + 1) % coordsNoLast.length]
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.sqrt(dx * dx + dy * dy)
      const sp1 = toSVG(p1)
      const sp2 = toSVG(p2)
      const mx = (sp1.x + sp2.x) / 2
      const my = (sp1.y + sp2.y) / 2

      // Normal outward
      const nx = -(sp2.y - sp1.y)
      const ny = sp2.x - sp1.x
      const nl = Math.sqrt(nx * nx + ny * ny) || 1
      const offset = 18
      edgeLengths.push({
        mx: mx + (nx / nl) * offset,
        my: my + (ny / nl) * offset,
        len,
        angle: 0,
      })
    }

    // Area via shoelace
    let areaCalc = 0
    for (let i = 0; i < coordsNoLast.length; i++) {
      const j = (i + 1) % coordsNoLast.length
      areaCalc += coordsNoLast[i].x * coordsNoLast[j].y
      areaCalc -= coordsNoLast[j].x * coordsNoLast[i].y
    }
    areaCalc = Math.abs(areaCalc) / 2

    return { svgPoints, cekmePoints, transform: '', edgeLengths, area: areaCalc }
  }, [parselCoords, cekmeCoords, width, height])

  if (parselCoords.length < 3) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        Parsel verisi bekleniyor...
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ maxHeight: height }}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Grid background */}
      <rect width="100%" height="100%" fill="url(#grid)" rx="8" />

      {/* Parsel polygon */}
      <polygon
        points={svgPoints}
        fill="rgba(3,105,161,0.08)"
        stroke="#0369a1"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Çekme alanı */}
      {cekmePoints && (
        <polygon
          points={cekmePoints}
          fill="rgba(5,150,105,0.12)"
          stroke="#059669"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          strokeLinejoin="round"
        />
      )}

      {/* Kenar uzunlukları */}
      {edgeLengths.map((e, i) => (
        <g key={i}>
          <rect
            x={e.mx - 22}
            y={e.my - 10}
            width="44"
            height="20"
            rx="4"
            fill="white"
            stroke="#cbd5e1"
            strokeWidth="0.5"
          />
          <text
            x={e.mx}
            y={e.my + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#334155"
            fontFamily="var(--font-mono)"
          >
            {e.len.toFixed(1)}m
          </text>
        </g>
      ))}

      {/* Alan etiketi */}
      <g>
        <rect
          x={width / 2 - 40}
          y={height / 2 - 14}
          width="80"
          height="28"
          rx="6"
          fill="white"
          stroke="#0369a1"
          strokeWidth="1"
          opacity="0.95"
        />
        <text
          x={width / 2}
          y={height / 2 + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#0c4a6e"
          fontFamily="var(--font-display)"
        >
          {area.toFixed(1)} m²
        </text>
      </g>

      {/* Kuzey oku */}
      <g transform={`translate(${width - 35}, 30)`}>
        <line x1="0" y1="20" x2="0" y2="-5" stroke="#dc2626" strokeWidth="2" markerEnd="url(#arrow)" />
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 10 L 5 0 L 10 10 Z" fill="#dc2626" />
          </marker>
        </defs>
        <text x="0" y="-10" textAnchor="middle" fontSize="11" fontWeight="700" fill="#dc2626">
          K
        </text>
      </g>

      {/* Legend */}
      {cekmePoints && (
        <g transform={`translate(12, ${height - 40})`}>
          <rect width="12" height="12" fill="rgba(3,105,161,0.15)" stroke="#0369a1" strokeWidth="1" rx="2" />
          <text x="16" y="10" fontSize="9" fill="#64748b">Parsel</text>
          <rect x="65" width="12" height="12" fill="rgba(5,150,105,0.2)" stroke="#059669" strokeWidth="1" rx="2" />
          <text x="81" y="10" fontSize="9" fill="#64748b">Yapılaşma Alanı</text>
        </g>
      )}
    </svg>
  )
}
