/**
 * imarPRO — RoomInteraction.tsx
 * Hover emissive highlight + tooltip, click → detail panel,
 * double-click → fly-to, ölçüm modu (iki nokta mesafe).
 */

import { useCallback, useState, useMemo } from 'react'
import { Html, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Room3D, Vec3, CostElementData, ViewMode } from './types3d'
import { ROOM_COLORS, ROOM_LABELS } from './types3d'

// ── Room Tooltip (HTML overlay) ──

interface RoomTooltipProps {
  room: Room3D
  costData?: CostElementData
  showCost: boolean
}

export function RoomTooltip({ room, costData, showCost }: RoomTooltipProps) {
  const area = (room.dimensions.width * room.dimensions.depth).toFixed(1)
  return (
    <Html
      position={[room.position.x, room.position.y + room.dimensions.height / 2 + 0.8, room.position.z]}
      center
      distanceFactor={18}
      style={{ pointerEvents: 'none' }}
    >
      <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl shadow-xl border border-border/50 text-xs whitespace-nowrap min-w-[120px]">
        <div className="font-bold text-primary text-sm">{room.name}</div>
        <div className="text-text-muted mt-0.5">
          {room.dimensions.width.toFixed(1)} × {room.dimensions.depth.toFixed(1)} m
        </div>
        <div className="text-text-muted">{area} m²</div>
        {room.facing && (
          <div className="text-text-muted">Cephe: {room.facing === 'south' ? 'Güney' : room.facing === 'north' ? 'Kuzey' : room.facing === 'east' ? 'Doğu' : 'Batı'}</div>
        )}
        {showCost && costData && (
          <div className="mt-1 pt-1 border-t border-border/30">
            <div className="font-semibold text-emerald-700">
              ₺{(costData.cost / 1000).toFixed(0)}K
            </div>
            <div className="text-text-muted text-[10px]">{costData.costCategory}</div>
          </div>
        )}
      </div>
    </Html>
  )
}

// ── Room Detail Side Panel (outside Canvas — rendered in parent) ──

export interface RoomDetailData {
  name: string
  type: string
  area: number
  dimensions: { width: number; height: number; depth: number }
  facing: string
  is_exterior: boolean
  floor_index: number
  cost?: number
  costCategory?: string
}

export function RoomDetailPanel({ room, onClose, onFlyTo }: {
  room: RoomDetailData
  onClose: () => void
  onFlyTo: () => void
}) {
  const typeLabel = ROOM_LABELS[room.type] || room.type
  const facingLabel = room.facing === 'south' ? 'Güney' : room.facing === 'north' ? 'Kuzey' : room.facing === 'east' ? 'Doğu' : room.facing === 'west' ? 'Batı' : '-'

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-border/50 p-4 min-w-[280px] max-w-[340px]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-base text-text">{room.name}</h3>
          <span className="text-xs text-text-muted">{typeLabel} · Kat {room.floor_index}</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text p-1">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="text-text-muted">Boyutlar</div>
          <div className="font-semibold">{room.dimensions.width.toFixed(1)} × {room.dimensions.depth.toFixed(1)} m</div>
        </div>
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="text-text-muted">Alan</div>
          <div className="font-semibold">{room.area.toFixed(1)} m²</div>
        </div>
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="text-text-muted">Cephe</div>
          <div className="font-semibold">{facingLabel}</div>
        </div>
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="text-text-muted">Yükseklik</div>
          <div className="font-semibold">{room.dimensions.height.toFixed(2)} m</div>
        </div>
        {room.cost !== undefined && (
          <>
            <div className="bg-emerald-50 rounded-lg p-2 col-span-2">
              <div className="text-text-muted">Tahmini Maliyet</div>
              <div className="font-semibold text-emerald-700">₺{(room.cost / 1000).toFixed(0)}K</div>
              {room.costCategory && <div className="text-[10px] text-text-muted">{room.costCategory}</div>}
            </div>
          </>
        )}
      </div>

      <button onClick={onFlyTo}
        className="mt-3 w-full bg-primary text-white text-xs font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors">
        🎥 Odaya Git (Fly-To)
      </button>
    </div>
  )
}

// ── Measurement Mode Line ──

interface MeasurementLineProps {
  points: Vec3[]
  active: boolean
}

export function MeasurementLine({ points, active }: MeasurementLineProps) {
  if (!active || points.length < 1) return null

  const linePoints = points.map(p => new THREE.Vector3(p.x, p.y, p.z))

  if (points.length === 1) {
    // Single point marker
    return (
      <mesh position={[points[0].x, points[0].y, points[0].z]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#FF1744" />
      </mesh>
    )
  }

  // Two points → line + distance label
  const p1 = points[0]
  const p2 = points[1]
  const distance = Math.sqrt(
    (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2,
  )
  const midpoint: [number, number, number] = [
    (p1.x + p2.x) / 2,
    (p1.y + p2.y) / 2 + 0.3,
    (p1.z + p2.z) / 2,
  ]

  return (
    <group>
      {/* Line */}
      <Line
        points={linePoints}
        color="#FF1744"
        lineWidth={2}
        dashed={false}
      />
      {/* Endpoint markers */}
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#FF1744" />
        </mesh>
      ))}
      {/* Distance label */}
      <Html position={midpoint} center style={{ pointerEvents: 'none' }}>
        <div className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
          {distance.toFixed(2)} m
        </div>
      </Html>
    </group>
  )
}

// ── Interactive Room Wrapper ──
// Wraps room floor with pointer events for hover/click/double-click

interface InteractiveRoomProps {
  room: Room3D
  floorY: number
  isHovered: boolean
  isSelected: boolean
  viewMode: ViewMode
  measureMode: boolean
  onHover: (name: string) => void
  onUnhover: () => void
  onClick: (room: Room3D) => void
  onDoubleClick: (room: Room3D) => void
  onMeasureClick: (point: Vec3) => void
}

export function InteractiveRoom({
  room, floorY, isHovered, isSelected, viewMode,
  measureMode, onHover, onUnhover, onClick, onDoubleClick, onMeasureClick,
}: InteractiveRoomProps) {
  if (viewMode === 'wireframe') return null

  const color = isSelected
    ? '#42A5F5'
    : isHovered
      ? '#90CAF9'
      : ROOM_COLORS[room.type] || '#F5F5F5'

  const handlePointerDown = useCallback((e: { point?: THREE.Vector3; stopPropagation?: () => void }) => {
    e.stopPropagation?.()
    if (measureMode && e.point) {
      onMeasureClick({ x: e.point.x, y: e.point.y, z: e.point.z })
    } else {
      onClick(room)
    }
  }, [measureMode, room, onClick, onMeasureClick])

  return (
    <mesh
      position={[room.position.x, floorY + 0.005, room.position.z]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(room.name) }}
      onPointerOut={() => onUnhover()}
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(room) }}
      receiveShadow
    >
      <boxGeometry args={[room.dimensions.width - 0.02, 0.015, room.dimensions.depth - 0.02]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        emissive={isHovered ? '#2196F3' : isSelected ? '#1565C0' : '#000000'}
        emissiveIntensity={isHovered ? 0.15 : isSelected ? 0.2 : 0}
      />
    </mesh>
  )
}
