/**
 * imarPRO — BuildingGeometry.tsx
 * Gerçek bina geometrisi: kalınlıklı duvarlar, pencere/kapı boşlukları,
 * döşeme kenar profili, çatı, saçak, merdiven, temel bandı.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Floor3D, Room3D, ColumnData, BuildingInfo, WallSegment, WindowData, DoorData, Vec3, ViewMode } from './types3d'
import { ROOM_COLORS, CONSTRUCTION_PHASES } from './types3d'

// ── Helpers ──

function wallGeometryWithHoles(
  wall: WallSegment,
  windows: WindowData[],
  doors: DoorData[],
  floorY: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const hw = wall.size.width / 2
  const hh = wall.size.height / 2
  shape.moveTo(-hw, -hh)
  shape.lineTo(hw, -hh)
  shape.lineTo(hw, hh)
  shape.lineTo(-hw, hh)
  shape.closePath()

  // Pencere boşlukları
  for (const win of windows) {
    // Pencere merkezini duvar lokal koordinatına çevir
    const isNS = wall.side === 'north' || wall.side === 'south'
    const localX = isNS
      ? win.center.x - wall.center.x
      : win.center.z - wall.center.z
    const localY = win.center.y - wall.center.y

    const ww = win.size.width / 2
    const wh = win.size.height / 2
    const hole = new THREE.Path()
    hole.moveTo(localX - ww, localY - wh)
    hole.lineTo(localX + ww, localY - wh)
    hole.lineTo(localX + ww, localY + wh)
    hole.lineTo(localX - ww, localY + wh)
    hole.closePath()
    shape.holes.push(hole)
  }

  // Kapı boşlukları
  for (const door of doors) {
    const isNS = wall.side === 'north' || wall.side === 'south'
    const localX = isNS
      ? door.center.x - wall.center.x
      : door.center.z - wall.center.z
    const localY = door.center.y - wall.center.y

    const dw = door.size.width / 2
    const dh = door.size.height / 2
    const hole = new THREE.Path()
    hole.moveTo(localX - dw, localY - dh)
    hole.lineTo(localX + dw, localY - dh)
    hole.lineTo(localX + dw, localY + dh)
    hole.lineTo(localX - dw, localY + dh)
    hole.closePath()
    shape.holes.push(hole)
  }

  const depth = wall.size.depth || (wall.is_exterior ? 0.25 : 0.10)
  const extrudeSettings = { depth, bevelEnabled: false }
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geo.translate(0, 0, -depth / 2)
  return geo
}

function getWallRotation(side: string): THREE.Euler {
  switch (side) {
    case 'north':
    case 'south':
      return new THREE.Euler(0, 0, 0)
    case 'east':
    case 'west':
      return new THREE.Euler(0, Math.PI / 2, 0)
    default:
      return new THREE.Euler(0, 0, 0)
  }
}

// ── Wall Component ──

interface WallProps {
  wall: WallSegment
  windows: WindowData[]
  doors: DoorData[]
  floorY: number
  material: THREE.Material
  viewMode: ViewMode
  opacity: number
  costHeatmapColor?: string
}

export function Wall({ wall, windows, doors, floorY, material, viewMode, opacity, costHeatmapColor }: WallProps) {
  const geometry = useMemo(
    () => wallGeometryWithHoles(wall, windows, doors, floorY),
    [wall, windows, doors, floorY],
  )

  const rotation = useMemo(() => getWallRotation(wall.side), [wall.side])

  const activeMaterial = useMemo(() => {
    if (viewMode === 'wireframe') {
      return new THREE.MeshBasicMaterial({ wireframe: true, color: wall.is_exterior ? '#666' : '#999' })
    }
    if (viewMode === 'thermal') {
      const uValue = wall.is_exterior ? 0.35 : 1.5
      const color = uValue < 0.3 ? '#1565C0' : uValue < 0.5 ? '#43A047' : uValue < 1.0 ? '#FDD835' : '#F4511E'
      return new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    }
    if (costHeatmapColor) {
      return new THREE.MeshStandardMaterial({ color: costHeatmapColor, roughness: 0.6 })
    }
    if (viewMode === 'xray' || opacity < 1) {
      const mat = material.clone() as THREE.MeshStandardMaterial
      mat.transparent = true
      mat.opacity = viewMode === 'xray' ? 0.12 : opacity
      mat.depthWrite = false
      return mat
    }
    return material
  }, [viewMode, opacity, material, wall.is_exterior, costHeatmapColor])

  return (
    <mesh
      geometry={geometry}
      material={activeMaterial}
      position={[wall.center.x, wall.center.y, wall.center.z]}
      rotation={rotation}
      castShadow
      receiveShadow
    />
  )
}

// ── Window Glass + Frame ──

interface WindowProps {
  win: WindowData
  glassMaterial: THREE.Material
  frameMaterial: THREE.Material
  viewMode: ViewMode
}

export function WindowMesh({ win, glassMaterial, frameMaterial, viewMode }: WindowProps) {
  const isNS = win.facing === 'north' || win.facing === 'south'
  const glassArgs: [number, number, number] = isNS
    ? [win.size.width, win.size.height, 0.012]
    : [0.012, win.size.height, win.size.width]

  const frameW = win.size.width + 0.06
  const frameH = win.size.height + 0.06
  const frameArgs: [number, number, number] = isNS
    ? [frameW, frameH, 0.035]
    : [0.035, frameH, frameW]

  // Pencere çerçeve detayı: ortada yatay kayıt
  const mullionArgs: [number, number, number] = isNS
    ? [win.size.width, 0.04, 0.03]
    : [0.03, 0.04, win.size.width]

  if (viewMode === 'wireframe') return null

  return (
    <group position={[win.center.x, win.center.y, win.center.z]}>
      {/* Glass */}
      <mesh>
        <boxGeometry args={glassArgs} />
        {viewMode === 'thermal' ? (
          <meshStandardMaterial color={win.u_value && win.u_value < 1.4 ? '#43A047' : '#F4511E'} roughness={0.3} transparent opacity={0.7} />
        ) : (
          <primitive object={glassMaterial} attach="material" />
        )}
      </mesh>
      {/* Frame */}
      <mesh>
        <boxGeometry args={frameArgs} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      {/* Horizontal mullion */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={mullionArgs} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
    </group>
  )
}

// ── Door ──

interface DoorProps {
  door: DoorData
  material: THREE.Material
  viewMode: ViewMode
}

export function DoorMesh({ door, material, viewMode }: DoorProps) {
  if (viewMode === 'wireframe') return null
  return (
    <group position={[door.center.x, door.center.y, door.center.z]}>
      {/* Door panel */}
      <mesh castShadow>
        <boxGeometry args={[door.size.width, door.size.height, 0.05]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Door handle */}
      <mesh position={[door.size.width * 0.35, 0, 0.035]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

// ── Floor Slab with Edge Profile ──

interface SlabProps {
  y: number
  width: number
  depth: number
  thickness: number
  viewMode: ViewMode
  material: THREE.Material
  isGround?: boolean
  isTop?: boolean
  costHeatmapColor?: string
}

export function FloorSlab({ y, width, depth, thickness, viewMode, material, isGround, costHeatmapColor }: SlabProps) {
  const geometry = useMemo(() => {
    // Döşeme kenar profili — hafif çıkıntı (0.15m saçak)
    const overhang = 0.15
    const shape = new THREE.Shape()
    const hw = (width + overhang * 2) / 2
    const hd = (depth + overhang * 2) / 2
    shape.moveTo(-hw, -hd)
    shape.lineTo(hw, -hd)
    shape.lineTo(hw, hd)
    shape.lineTo(-hw, hd)
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [width, depth, thickness])

  const activeMat = useMemo(() => {
    if (viewMode === 'wireframe') return new THREE.MeshBasicMaterial({ wireframe: true, color: '#777' })
    if (costHeatmapColor) return new THREE.MeshStandardMaterial({ color: costHeatmapColor, roughness: 0.7 })
    return material
  }, [viewMode, material, costHeatmapColor])

  return (
    <mesh
      geometry={geometry}
      material={activeMat}
      position={[width / 2, y - thickness, depth / 2]}
      castShadow
      receiveShadow
    />
  )
}

// ── Room Floor (zemin kaplama) ──

interface RoomFloorProps {
  room: Room3D
  floorY: number
  viewMode: ViewMode
  isHovered: boolean
  isSelected: boolean
}

export function RoomFloor({ room, floorY, viewMode, isHovered, isSelected }: RoomFloorProps) {
  if (viewMode === 'wireframe') return null
  const color = isSelected
    ? '#42A5F5'
    : isHovered
      ? '#90CAF9'
      : ROOM_COLORS[room.type] || '#F5F5F5'

  return (
    <mesh
      position={[room.position.x, floorY + 0.005, room.position.z]}
      receiveShadow
    >
      <boxGeometry args={[room.dimensions.width - 0.02, 0.01, room.dimensions.depth - 0.02]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}

// ── Column ──

interface ColumnProps {
  col: ColumnData
  viewMode: ViewMode
  opacity: number
  costHeatmapColor?: string
}

export function Column({ col, viewMode, opacity, costHeatmapColor }: ColumnProps) {
  const mat = useMemo(() => {
    if (viewMode === 'wireframe') return new THREE.MeshBasicMaterial({ wireframe: true, color: '#555' })
    if (costHeatmapColor) return new THREE.MeshStandardMaterial({ color: costHeatmapColor, roughness: 0.8 })
    return new THREE.MeshStandardMaterial({
      color: '#B0B0B0',
      roughness: 0.8,
      transparent: opacity < 1,
      opacity,
    })
  }, [viewMode, opacity, costHeatmapColor])

  return (
    <mesh position={[col.x, col.height / 2, col.z]} material={mat} castShadow receiveShadow>
      <boxGeometry args={[col.size, col.height, col.size]} />
    </mesh>
  )
}

// ── Roof (Beşik veya Teras) ──

interface RoofProps {
  building: BuildingInfo
  roofType: 'flat' | 'gable'
  viewMode: ViewMode
  visible: boolean
  material: THREE.Material
}

export function Roof({ building, roofType, viewMode, visible, material }: RoofProps) {
  if (!visible) return null

  const topY = building.total_height

  if (roofType === 'flat') {
    // Teras çatı — düz beton + korkuluk
    return (
      <group>
        {/* Teras döşeme */}
        <mesh position={[building.width / 2, topY + 0.05, building.depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[building.width + 0.4, 0.10, building.depth + 0.4]} />
          <primitive object={material} attach="material" />
        </mesh>
        {/* Korkuluk — 4 kenar */}
        {[
          [building.width / 2, topY + 0.5, 0, building.width + 0.6, 0.9, 0.08],
          [building.width / 2, topY + 0.5, building.depth, building.width + 0.6, 0.9, 0.08],
          [0, topY + 0.5, building.depth / 2, 0.08, 0.9, building.depth],
          [building.width, topY + 0.5, building.depth / 2, 0.08, 0.9, building.depth],
        ].map(([x, y, z, w, h, d], i) => (
          <mesh key={`parapet-${i}`} position={[x, y, z]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color="#D4C9B8" roughness={0.7} />
          </mesh>
        ))}
      </group>
    )
  }

  // Beşik çatı
  const roofHeight = Math.min(2.5, building.depth * 0.2)
  const eaveOverhang = 0.5

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const hw = building.width / 2 + eaveOverhang
    shape.moveTo(-hw, 0)
    shape.lineTo(0, roofHeight)
    shape.lineTo(hw, 0)
    shape.closePath()

    return new THREE.ExtrudeGeometry(shape, {
      depth: building.depth + eaveOverhang * 2,
      bevelEnabled: false,
    })
  }, [building.width, building.depth, roofHeight])

  const mat = viewMode === 'wireframe'
    ? new THREE.MeshBasicMaterial({ wireframe: true, color: '#884' })
    : new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.8 })

  return (
    <mesh
      geometry={geometry}
      material={mat}
      position={[building.width / 2, topY, -eaveOverhang]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
    />
  )
}

// ── Foundation Band (Temel Bandı) ──

interface FoundationProps {
  building: BuildingInfo
  viewMode: ViewMode
}

export function Foundation({ building, viewMode }: FoundationProps) {
  if (viewMode === 'wireframe') return null
  const bandHeight = 0.6
  const bandThickness = 0.4
  return (
    <group>
      {/* Front */}
      <mesh position={[building.width / 2, -bandHeight / 2, -bandThickness / 2]} receiveShadow>
        <boxGeometry args={[building.width + 0.8, bandHeight, bandThickness]} />
        <meshStandardMaterial color="#7B7B7B" roughness={0.9} />
      </mesh>
      {/* Back */}
      <mesh position={[building.width / 2, -bandHeight / 2, building.depth + bandThickness / 2]} receiveShadow>
        <boxGeometry args={[building.width + 0.8, bandHeight, bandThickness]} />
        <meshStandardMaterial color="#7B7B7B" roughness={0.9} />
      </mesh>
      {/* Left */}
      <mesh position={[-bandThickness / 2, -bandHeight / 2, building.depth / 2]} receiveShadow>
        <boxGeometry args={[bandThickness, bandHeight, building.depth + 0.8]} />
        <meshStandardMaterial color="#7B7B7B" roughness={0.9} />
      </mesh>
      {/* Right */}
      <mesh position={[building.width + bandThickness / 2, -bandHeight / 2, building.depth / 2]} receiveShadow>
        <boxGeometry args={[bandThickness, bandHeight, building.depth + 0.8]} />
        <meshStandardMaterial color="#7B7B7B" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── Entrance Steps (Giriş Basamakları) ──

export function EntranceSteps({ building, viewMode }: { building: BuildingInfo; viewMode: ViewMode }) {
  if (viewMode === 'wireframe') return null
  const stepCount = 3
  const stepH = 0.17
  const stepD = 0.30
  const stepW = 2.0
  const startX = building.width * 0.3

  return (
    <group position={[startX, 0, -0.1]}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <mesh key={`step-${i}`} position={[0, -i * stepH - stepH / 2, -i * stepD - stepD / 2]} castShadow receiveShadow>
          <boxGeometry args={[stepW, stepH, stepD]} />
          <meshStandardMaterial color="#C0B8A8" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// ── Section Cut Plane ──

export function SectionPlane({
  position, rotation, width, depth, visible,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  depth: number
  visible: boolean
}) {
  if (!visible) return null
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width + 6, depth + 6]} />
      <meshBasicMaterial color="#dc2626" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── 4D BIM: Faz Renklendirmesi İçin Yardımcı ──

export function getPhaseForMonth(month: number) {
  return CONSTRUCTION_PHASES.find(p => month >= p.startMonth && month <= p.endMonth) || null
}

export function isElementBuiltAtMonth(
  elementType: string,
  floorIndex: number,
  totalFloors: number,
  month: number,
): boolean {
  // Foundation: aylar 1-2
  if (elementType === 'foundation') return month >= 1

  // Her kat ~1.5 ayda yapılır, 2. aydan başlar
  const katStartMonth = 2 + floorIndex * 1.5
  const katEndMonth = katStartMonth + 1.5

  if (elementType === 'slab' || elementType === 'columns') {
    return month >= katStartMonth
  }
  if (elementType === 'walls_exterior' || elementType === 'roof') {
    return month >= Math.max(8, katStartMonth + 3)
  }
  if (elementType === 'facade' || elementType === 'windows') {
    return month >= 10
  }
  if (elementType === 'walls_interior' || elementType === 'doors' || elementType === 'interior_finish') {
    return month >= 13
  }
  if (elementType === 'mep') {
    return month >= 16
  }
  return month >= 18
}

// ── 4D: Elementin opaklık seviyesi ──
export function get4DOpacity(
  elementType: string,
  floorIndex: number,
  totalFloors: number,
  month: number,
): { opacity: number; color?: string } {
  const built = isElementBuiltAtMonth(elementType, floorIndex, totalFloors, month)
  if (!built) {
    return { opacity: 0.08, color: '#CCCCCC' }
  }

  // Hangi fazda olduğunu bul
  const phase = getPhaseForMonth(month)
  if (phase && phase.elements.includes(elementType as never)) {
    return { opacity: 1.0, color: phase.color }
  }
  return { opacity: 1.0 }
}

// ── 5D: Maliyet Isı Haritası Rengi ──
export function getCostHeatmapColor(cost: number, maxCost: number): string {
  const ratio = Math.min(cost / maxCost, 1)
  // Yeşil → Sarı → Kırmızı
  if (ratio < 0.33) {
    const t = ratio / 0.33
    const r = Math.round(46 + t * (253 - 46))
    const g = Math.round(125 + t * (216 - 125))
    const b = Math.round(50 + t * (53 - 50))
    return `rgb(${r},${g},${b})`
  }
  if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33
    const r = Math.round(253 + t * (244 - 253))
    const g = Math.round(216 - t * (216 - 81))
    const b = Math.round(53 - t * (53 - 30))
    return `rgb(${r},${g},${b})`
  }
  const t = (ratio - 0.66) / 0.34
  const r = Math.round(244 - t * (244 - 183))
  const g = Math.round(81 - t * (81 - 28))
  const b = Math.round(30 - t * (30 - 28))
  return `rgb(${r},${g},${b})`
}
