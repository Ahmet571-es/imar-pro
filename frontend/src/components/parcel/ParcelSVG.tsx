/**
 * imarPRO — ParcelSVG.tsx (Professional Rewrite)
 *
 * Harita mühendisliği standardında parsel görselleştirme:
 * - Ölçek çubuğu (scale bar) — gerçek metrik
 * - Köşe açıları (interior angles) — derece
 * - Köşe numaraları (vertex markers) — kırmızı daireler
 * - Köşe koordinatları (hover tooltip)
 * - Kenar uzunlukları (dimension labels) — normal dışına offset
 * - Kenar yön açıları (bearing) — küçük ok
 * - Alan etiketi + çevre
 * - Çekme mesafesi alanı overlay (dashed yeşil)
 * - Kuzey oku (compass rose)
 * - Grid + arka plan
 * - Tıklanabilir kenarlar (seçili kenar highlight)
 */

import { useMemo, useState } from 'react'
import type { Coordinate } from '@/types'

interface Props {
  parselCoords: Coordinate[]
  cekmeCoords?: Coordinate[] | null
  width?: number
  height?: number
  onEdgeClick?: (edgeIndex: number) => void
}

export function ParcelSVG({ parselCoords, cekmeCoords, width = 480, height = 420, onEdgeClick }: Props) {
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null)

  const data = useMemo(() => {
    if (parselCoords.length < 3) return null

    const xs = parselCoords.map(c => c.x)
    const ys = parselCoords.map(c => c.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    const realW = maxX - minX || 1
    const realH = maxY - minY || 1

    const padding = 65
    const scaleX = (width - 2 * padding) / realW
    const scaleY = (height - 2 * padding) / realH
    const scale = Math.min(scaleX, scaleY)
    const ox = padding + ((width - 2 * padding) - realW * scale) / 2
    const oy = padding + ((height - 2 * padding) - realH * scale) / 2

    const toSVG = (c: Coordinate) => ({
      x: (c.x - minX) * scale + ox,
      y: height - ((c.y - minY) * scale + oy),
    })

    // Unique coords (remove closing duplicate)
    const unique = parselCoords.length > 0 &&
      parselCoords[0].x === parselCoords[parselCoords.length - 1].x &&
      parselCoords[0].y === parselCoords[parselCoords.length - 1].y
        ? parselCoords.slice(0, -1)
        : parselCoords

    const pts = unique.map(toSVG)
    const svgPoints = pts.map(p => `${p.x},${p.y}`).join(' ')

    // Çekme alanı
    let cekmePoints = ''
    if (cekmeCoords && cekmeCoords.length >= 3) {
      cekmePoints = cekmeCoords.map(toSVG).map(p => `${p.x},${p.y}`).join(' ')
    }

    // Kenar verileri
    const edges: {
      idx: number; p1: { x: number; y: number }; p2: { x: number; y: number }
      mx: number; my: number; len: number; bearing: number
      labelX: number; labelY: number
    }[] = []

    for (let i = 0; i < unique.length; i++) {
      const c1 = unique[i]
      const c2 = unique[(i + 1) % unique.length]
      const dx = c2.x - c1.x
      const dy = c2.y - c1.y
      const len = Math.sqrt(dx * dx + dy * dy)
      const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360

      const sp1 = toSVG(c1)
      const sp2 = toSVG(c2)
      const mx = (sp1.x + sp2.x) / 2
      const my = (sp1.y + sp2.y) / 2

      // Label offset — normal dışına
      const nx = -(sp2.y - sp1.y)
      const ny = sp2.x - sp1.x
      const nl = Math.sqrt(nx * nx + ny * ny) || 1
      const labelOffset = 20

      edges.push({
        idx: i,
        p1: sp1, p2: sp2,
        mx, my, len, bearing,
        labelX: mx + (nx / nl) * labelOffset,
        labelY: my + (ny / nl) * labelOffset,
      })
    }

    // Köşe açıları
    const angles: { x: number; y: number; angle: number }[] = []
    for (let i = 0; i < unique.length; i++) {
      const prev = unique[(i - 1 + unique.length) % unique.length]
      const curr = unique[i]
      const next = unique[(i + 1) % unique.length]

      const v1x = prev.x - curr.x
      const v1y = prev.y - curr.y
      const v2x = next.x - curr.x
      const v2y = next.y - curr.y

      const dot = v1x * v2x + v1y * v2y
      const cross = v1x * v2y - v1y * v2x
      const angle = Math.abs(Math.atan2(cross, dot) * 180 / Math.PI)

      const sp = toSVG(curr)
      angles.push({ x: sp.x, y: sp.y, angle })
    }

    // Alan (shoelace)
    let area = 0
    for (let i = 0; i < unique.length; i++) {
      const j = (i + 1) % unique.length
      area += unique[i].x * unique[j].y
      area -= unique[j].x * unique[i].y
    }
    area = Math.abs(area) / 2

    // Çevre
    const perimeter = edges.reduce((s, e) => s + e.len, 0)

    // Ölçek çubuğu
    const scaleBarMeters = realW > 30 ? 10 : realW > 15 ? 5 : realW > 5 ? 2 : 1
    const scaleBarPx = scaleBarMeters * scale

    return {
      svgPoints, cekmePoints, pts, edges, angles,
      area, perimeter, unique,
      scale, scaleBarMeters, scaleBarPx,
      minX, minY,
    }
  }, [parselCoords, cekmeCoords, width, height])

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-30">📐</div>
          Parsel verisi bekleniyor...
        </div>
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ maxHeight: height }}>
      <defs>
        <pattern id="parcelGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8ecf0" strokeWidth="0.3" />
        </pattern>
        <pattern id="areaHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#0369a1" strokeWidth="0.2" opacity="0.15" />
        </pattern>
        <marker id="arrowMarker" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 10 L 5 0 L 10 10 Z" fill="#dc2626" />
        </marker>
        <filter id="labelShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Grid */}
      <rect width="100%" height="100%" fill="url(#parcelGrid)" rx="8" />

      {/* Parsel polygon fill + hatch */}
      <polygon points={data.svgPoints} fill="rgba(3,105,161,0.06)" />
      <polygon points={data.svgPoints} fill="url(#areaHatch)" />
      <polygon points={data.svgPoints} fill="none" stroke="#0369a1" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Çekme alanı */}
      {data.cekmePoints && (
        <polygon points={data.cekmePoints}
          fill="rgba(5,150,105,0.10)" stroke="#059669"
          strokeWidth="1.5" strokeDasharray="6 3" strokeLinejoin="round" />
      )}

      {/* Kenar uzunlukları + seçili kenar highlight */}
      {data.edges.map((e) => (
        <g key={`edge-${e.idx}`}
          style={{ cursor: onEdgeClick ? 'pointer' : 'default' }}
          onClick={() => { setSelectedEdge(e.idx); onEdgeClick?.(e.idx) }}>

          {/* Seçili kenar highlight */}
          {selectedEdge === e.idx && (
            <line x1={e.p1.x} y1={e.p1.y} x2={e.p2.x} y2={e.p2.y}
              stroke="#f59e0b" strokeWidth="5" opacity="0.5" />
          )}

          {/* Uzunluk label */}
          <rect x={e.labelX - 24} y={e.labelY - 10} width="48" height="20"
            rx="4" fill="white" stroke="#cbd5e1" strokeWidth="0.5"
            filter="url(#labelShadow)" />
          <text x={e.labelX} y={e.labelY + 4} textAnchor="middle"
            fontSize="9.5" fontWeight="600" fill="#1e3a5f" fontFamily="var(--font-mono)">
            {e.len.toFixed(2)}m
          </text>
        </g>
      ))}

      {/* Köşe noktaları (vertex markers) + numaralar */}
      {data.pts.map((pt, i) => (
        <g key={`vertex-${i}`}
          onMouseEnter={() => setHoveredVertex(i)}
          onMouseLeave={() => setHoveredVertex(null)}>
          {/* Daire */}
          <circle cx={pt.x} cy={pt.y} r="5" fill="#dc2626" stroke="white" strokeWidth="1.5" />
          {/* Numara */}
          <text x={pt.x} y={pt.y + 3.5} textAnchor="middle"
            fontSize="7" fontWeight="700" fill="white">
            {i + 1}
          </text>

          {/* Açı label — köşenin biraz içinde */}
          {data.angles[i] && (
            <g>
              <rect x={pt.x + 8} y={pt.y - 16} width="30" height="14"
                rx="3" fill="rgba(255,255,255,0.9)" stroke="#e2e8f0" strokeWidth="0.5" />
              <text x={pt.x + 23} y={pt.y - 6} textAnchor="middle"
                fontSize="7.5" fontWeight="500" fill="#64748b" fontFamily="var(--font-mono)">
                {data.angles[i].angle.toFixed(1)}°
              </text>
            </g>
          )}

          {/* Koordinat tooltip on hover */}
          {hoveredVertex === i && (
            <g>
              <rect x={pt.x - 38} y={pt.y + 10} width="76" height="28"
                rx="4" fill="#1e293b" opacity="0.92" />
              <text x={pt.x} y={pt.y + 22} textAnchor="middle"
                fontSize="7" fill="#e2e8f0" fontFamily="var(--font-mono)">
                X: {data.unique[i].x.toFixed(2)}
              </text>
              <text x={pt.x} y={pt.y + 32} textAnchor="middle"
                fontSize="7" fill="#e2e8f0" fontFamily="var(--font-mono)">
                Y: {data.unique[i].y.toFixed(2)}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Alan + Çevre etiketi — merkez */}
      <g>
        <rect x={width / 2 - 52} y={height / 2 - 18} width="104" height="36"
          rx="8" fill="white" stroke="#0369a1" strokeWidth="1.2" opacity="0.95"
          filter="url(#labelShadow)" />
        <text x={width / 2} y={height / 2 - 2} textAnchor="middle"
          fontSize="13" fontWeight="700" fill="#0c4a6e" fontFamily="var(--font-display)">
          {data.area.toFixed(1)} m²
        </text>
        <text x={width / 2} y={height / 2 + 12} textAnchor="middle"
          fontSize="8" fontWeight="500" fill="#64748b" fontFamily="var(--font-mono)">
          Ç: {data.perimeter.toFixed(1)}m · {data.unique.length} köşe
        </text>
      </g>

      {/* ═══ Ölçek Çubuğu (Scale Bar) ═══ */}
      <g transform={`translate(14, ${height - 30})`}>
        {/* Çubuk */}
        <line x1="0" y1="0" x2={data.scaleBarPx} y2="0" stroke="#1e293b" strokeWidth="2" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#1e293b" strokeWidth="1.5" />
        <line x1={data.scaleBarPx} y1="-4" x2={data.scaleBarPx} y2="4" stroke="#1e293b" strokeWidth="1.5" />
        {/* Orta çizgi */}
        <line x1={data.scaleBarPx / 2} y1="-3" x2={data.scaleBarPx / 2} y2="3" stroke="#1e293b" strokeWidth="0.5" />
        {/* Etiketler */}
        <text x="0" y="12" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="var(--font-mono)">0</text>
        <text x={data.scaleBarPx / 2} y="12" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="var(--font-mono)">
          {data.scaleBarMeters / 2}
        </text>
        <text x={data.scaleBarPx} y="12" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="var(--font-mono)">
          {data.scaleBarMeters}m
        </text>
        {/* Ölçek oranı */}
        <text x={data.scaleBarPx + 10} y="3" fontSize="7" fill="#94a3b8" fontFamily="var(--font-mono)">
          1:{Math.round(1 / data.scale * 100) / 100}
        </text>
      </g>

      {/* ═══ Kuzey Oku (Compass) ═══ */}
      <g transform={`translate(${width - 32}, 28)`}>
        <circle cx="0" cy="0" r="14" fill="white" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.9" />
        <line x1="0" y1="10" x2="0" y2="-10" stroke="#dc2626" strokeWidth="1.8" markerEnd="url(#arrowMarker)" />
        <text x="0" y="-16" textAnchor="middle" fontSize="9" fontWeight="700" fill="#dc2626">K</text>
        {/* E/W/S küçük */}
        <text x="17" y="3" textAnchor="middle" fontSize="5.5" fill="#94a3b8">D</text>
        <text x="-17" y="3" textAnchor="middle" fontSize="5.5" fill="#94a3b8">B</text>
        <text x="0" y="20" textAnchor="middle" fontSize="5.5" fill="#94a3b8">G</text>
      </g>

      {/* Legend */}
      <g transform={`translate(${width - 130}, ${height - 30})`}>
        <rect width="10" height="10" fill="rgba(3,105,161,0.12)" stroke="#0369a1" strokeWidth="0.8" rx="2" />
        <text x="13" y="8" fontSize="8" fill="#64748b">Parsel</text>
        {data.cekmePoints && (
          <>
            <rect x="55" width="10" height="10" fill="rgba(5,150,105,0.15)" stroke="#059669" strokeWidth="0.8" rx="2" />
            <text x="68" y="8" fontSize="8" fill="#64748b">Yapılaşma</text>
          </>
        )}
      </g>
    </svg>
  )
}
