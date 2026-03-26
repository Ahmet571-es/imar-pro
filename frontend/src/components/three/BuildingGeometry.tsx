/**
 * imarPRO — BuildingGeometry.tsx (SaaS Professional Rewrite)
 *
 * Mimari + Yapısal BIM geometrileri:
 * - Duvar: ExtrudeGeometry ile pencere/kapı boşluklu, kalınlıklı
 * - Pencere: Denizlik (sill), lento (lintel), şpalyet (reveal), cam + çerçeve + kayıt
 * - Kapı: Kasa (frame), eşik (threshold), 90° açılma yayı
 * - Merdiven: U-dönüşlü, basamak + rıht + kol (stringer) + korkuluk + küpeşte
 * - Balkon: Kantilever döşeme + dikey çubuk korkuluk + küpeşte
 * - Döşeme: Pah (chamfer) detaylı kenar profili
 * - Kolon: Kısa başlık (capital), yapısal aks etiketleri
 * - Kiriş: Kolon arası yatay betonarme kiriş
 * - Çatı: Teras (korkuluk + derz bandı + su gideri) veya beşik (mahya + saçak)
 * - Temel: Sürekli temel bandı + radye profil
 * - 4D/5D yardımcı fonksiyonları
 */

import React, { useMemo } from 'react'
import type { ReactElement } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type {
  Floor3D, Room3D, ColumnData, BuildingInfo,
  WallSegment, WindowData, DoorData, Vec3, ViewMode,
} from './types3d'
import { ROOM_COLORS, CONSTRUCTION_PHASES } from './types3d'

/* ================================================================
   HELPERS
   ================================================================ */

function wallGeometryWithHoles(
  wall: WallSegment,
  windows: WindowData[],
  doors: DoorData[],
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const hw = wall.size.width / 2
  const hh = wall.size.height / 2
  shape.moveTo(-hw, -hh)
  shape.lineTo(hw, -hh)
  shape.lineTo(hw, hh)
  shape.lineTo(-hw, hh)
  shape.closePath()

  const isNS = wall.side === 'north' || wall.side === 'south'

  for (const win of windows) {
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

  for (const door of doors) {
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  return geo
}

function getWallRotation(side: string): THREE.Euler {
  switch (side) {
    case 'north': case 'south': return new THREE.Euler(0, 0, 0)
    case 'east': case 'west': return new THREE.Euler(0, Math.PI / 2, 0)
    default: return new THREE.Euler(0, 0, 0)
  }
}

function resolveViewMaterial(
  baseMat: THREE.Material,
  viewMode: ViewMode,
  opacity: number,
  isExterior: boolean,
  costColor?: string,
  thermalU?: number,
): THREE.Material {
  if (viewMode === 'wireframe')
    return new THREE.MeshBasicMaterial({ wireframe: true, color: isExterior ? '#555' : '#888' })
  if (viewMode === 'thermal') {
    const u = thermalU ?? (isExterior ? 0.35 : 1.5)
    const c = u < 0.3 ? '#1565C0' : u < 0.5 ? '#43A047' : u < 1.0 ? '#FDD835' : u < 2.0 ? '#F4511E' : '#B71C1C'
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
  }
  if (costColor)
    return new THREE.MeshStandardMaterial({ color: costColor, roughness: 0.6 })
  if (viewMode === 'xray' || opacity < 1) {
    const mat = (baseMat as THREE.MeshStandardMaterial).clone()
    mat.transparent = true
    mat.opacity = viewMode === 'xray' ? 0.10 : opacity
    mat.depthWrite = false
    return mat
  }
  return baseMat
}

/* ================================================================
   WALL
   ================================================================ */

interface WallProps {
  wall: WallSegment; windows: WindowData[]; doors: DoorData[]; floorY: number
  material: THREE.Material; viewMode: ViewMode; opacity: number; costHeatmapColor?: string
}

export function Wall({ wall, windows, doors, material, viewMode, opacity, costHeatmapColor }: WallProps) {
  const geometry = useMemo(() => wallGeometryWithHoles(wall, windows, doors), [wall, windows, doors])
  const rotation = useMemo(() => getWallRotation(wall.side), [wall.side])
  const mat = useMemo(
    () => resolveViewMaterial(material, viewMode, opacity, wall.is_exterior, costHeatmapColor),
    [material, viewMode, opacity, wall.is_exterior, costHeatmapColor],
  )
  return (
    <mesh geometry={geometry} material={mat}
      position={[wall.center.x, wall.center.y, wall.center.z]}
      rotation={rotation} castShadow receiveShadow />
  )
}

/* ================================================================
   WINDOW — Denizlik (Sill) + Lento (Lintel) + Reveal + Cam + Çerçeve + Kayıt
   ================================================================ */

interface WindowProps {
  win: WindowData; glassMat: THREE.Material; frameMat: THREE.Material; viewMode: ViewMode
}

export function WindowMesh({ win, glassMat, frameMat, viewMode }: WindowProps) {
  if (viewMode === 'wireframe') return null
  const isNS = win.facing === 'north' || win.facing === 'south'

  const glassArgs: [number, number, number] = isNS
    ? [win.size.width - 0.04, win.size.height - 0.04, 0.008]
    : [0.008, win.size.height - 0.04, win.size.width - 0.04]

  const frameThick = 0.04
  const depth = 0.035

  // Outer frame
  const fW = win.size.width + 0.06
  const fH = win.size.height + 0.06
  const outerFrame: [number, number, number] = isNS ? [fW, fH, depth] : [depth, fH, fW]

  // Kayıt (mullion) — yatay + dikey
  const hMullion: [number, number, number] = isNS
    ? [win.size.width - 0.02, frameThick, depth * 0.8]
    : [depth * 0.8, frameThick, win.size.width - 0.02]
  const vMullion: [number, number, number] = isNS
    ? [frameThick, win.size.height - 0.02, depth * 0.8]
    : [depth * 0.8, win.size.height - 0.02, frameThick]

  // Denizlik (sill) — taş çıkıntı
  const sillProtrusion = 0.08
  const sillThick = 0.03
  const sillWidth = win.size.width + 0.14
  const sillDepth = depth + sillProtrusion * 2

  // Lento (lintel) — üst beton çizgi
  const lintelH = 0.06
  const lintelW = win.size.width + 0.16

  const thermalMat = viewMode === 'thermal'
    ? <meshStandardMaterial color={win.u_value && win.u_value < 1.4 ? '#43A047' : '#F4511E'} roughness={0.3} transparent opacity={0.7} />
    : null

  return (
    <group position={[win.center.x, win.center.y, win.center.z]}>
      {/* Cam */}
      <mesh>
        <boxGeometry args={glassArgs} />
        {thermalMat || <primitive object={glassMat} attach="material" />}
      </mesh>

      {/* Dış çerçeve */}
      <mesh><boxGeometry args={outerFrame} /><primitive object={frameMat} attach="material" /></mesh>

      {/* Yatay kayıt */}
      <mesh position={[0, 0.02, 0]}><boxGeometry args={hMullion} /><primitive object={frameMat} attach="material" /></mesh>
      {/* Dikey kayıt */}
      <mesh><boxGeometry args={vMullion} /><primitive object={frameMat} attach="material" /></mesh>

      {/* Denizlik (sill) — altta çıkıntılı mermer */}
      <mesh position={isNS
        ? [0, -win.size.height / 2 - sillThick / 2, sillProtrusion / 2]
        : [sillProtrusion / 2, -win.size.height / 2 - sillThick / 2, 0]}
      >
        <boxGeometry args={isNS ? [sillWidth, sillThick, sillDepth] : [sillDepth, sillThick, sillWidth]} />
        <meshStandardMaterial color="#D0CCC4" roughness={0.5} />
      </mesh>

      {/* Lento (lintel) — üstte beton bant */}
      <mesh position={[0, win.size.height / 2 + lintelH / 2, 0]}>
        <boxGeometry args={isNS ? [lintelW, lintelH, depth + 0.02] : [depth + 0.02, lintelH, lintelW]} />
        <meshStandardMaterial color="#B8B0A4" roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ================================================================
   DOOR — Kasa (Frame) + Eşik (Threshold) + Panel + Kol + 90° Açılma Yayı
   ================================================================ */

interface DoorProps { door: DoorData; material: THREE.Material; viewMode: ViewMode }

export function DoorMesh({ door, material, viewMode }: DoorProps) {
  if (viewMode === 'wireframe') return null

  const kasaDepth = 0.12
  const kasaWidth = 0.06
  const doorW = door.size.width
  const doorH = door.size.height

  return (
    <group position={[door.center.x, door.center.y, door.center.z]}>
      {/* Kasa (frame) — sol */}
      <mesh position={[-doorW / 2 - kasaWidth / 2, 0, 0]} castShadow>
        <boxGeometry args={[kasaWidth, doorH + 0.04, kasaDepth]} />
        <meshStandardMaterial color="#5C4033" roughness={0.6} />
      </mesh>
      {/* Kasa — sağ */}
      <mesh position={[doorW / 2 + kasaWidth / 2, 0, 0]} castShadow>
        <boxGeometry args={[kasaWidth, doorH + 0.04, kasaDepth]} />
        <meshStandardMaterial color="#5C4033" roughness={0.6} />
      </mesh>
      {/* Kasa — üst (lento) */}
      <mesh position={[0, doorH / 2 + kasaWidth / 2, 0]} castShadow>
        <boxGeometry args={[doorW + kasaWidth * 2, kasaWidth, kasaDepth]} />
        <meshStandardMaterial color="#5C4033" roughness={0.6} />
      </mesh>

      {/* Eşik (threshold) */}
      <mesh position={[0, -doorH / 2 + 0.01, 0]}>
        <boxGeometry args={[doorW + 0.04, 0.02, kasaDepth + 0.02]} />
        <meshStandardMaterial color="#888" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Kapı paneli */}
      <mesh castShadow>
        <boxGeometry args={[doorW - 0.02, doorH - 0.02, 0.04]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Panel detay — üst panel */}
      <mesh position={[0, doorH * 0.18, 0.022]}>
        <boxGeometry args={[doorW * 0.75, doorH * 0.35, 0.008]} />
        <meshStandardMaterial color="#7A5C2E" roughness={0.5} />
      </mesh>
      {/* Panel detay — alt panel */}
      <mesh position={[0, -doorH * 0.18, 0.022]}>
        <boxGeometry args={[doorW * 0.75, doorH * 0.28, 0.008]} />
        <meshStandardMaterial color="#7A5C2E" roughness={0.5} />
      </mesh>

      {/* Kol (handle) — manivela tip */}
      <mesh position={[doorW * 0.38, 0.02, 0.035]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.025, 0.025]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[doorW * 0.38, 0.02, 0.035]}>
        <cylinderGeometry args={[0.012, 0.012, 0.05, 8]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* 90° açılma yayı — mimari çizim standardı */}
      <mesh position={[-doorW / 2, -doorH / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[doorW - 0.02, doorW, 16, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#1976D2" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ================================================================
   FLOOR SLAB — Pah (Chamfer) Detaylı Kenar Profili
   ================================================================ */

interface SlabProps {
  y: number; width: number; depth: number; thickness: number
  viewMode: ViewMode; material: THREE.Material; isGround?: boolean; isTop?: boolean
  costHeatmapColor?: string
}

export function FloorSlab({ y, width, depth, thickness, viewMode, material, isGround, costHeatmapColor }: SlabProps) {
  const geo = useMemo(() => {
    // Pah profilli döşeme kesiti
    const chamfer = 0.03
    const oh = 0.12 // overhang
    const hw = (width + oh * 2) / 2
    const hd = (depth + oh * 2) / 2

    const shape = new THREE.Shape()
    // Pah ile köşeler
    shape.moveTo(-hw + chamfer, -hd)
    shape.lineTo(hw - chamfer, -hd)
    shape.lineTo(hw, -hd + chamfer)
    shape.lineTo(hw, hd - chamfer)
    shape.lineTo(hw - chamfer, hd)
    shape.lineTo(-hw + chamfer, hd)
    shape.lineTo(-hw, hd - chamfer)
    shape.lineTo(-hw, -hd + chamfer)
    shape.closePath()

    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [width, depth, thickness])

  const mat = useMemo(
    () => resolveViewMaterial(material, viewMode, 1, true, costHeatmapColor),
    [material, viewMode, costHeatmapColor],
  )

  return (
    <group>
      <mesh geometry={geo} material={mat}
        position={[width / 2, y - thickness, depth / 2]}
        castShadow receiveShadow />
      {/* Alt kenar (soffit) çizgisi — mimari detay */}
      {viewMode === 'solid' && (
        <mesh position={[width / 2, y - thickness - 0.002, depth / 2]}>
          <boxGeometry args={[width + 0.20, 0.004, depth + 0.20]} />
          <meshStandardMaterial color="#C8BFA8" roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

/* ================================================================
   COLUMN — Başlık (Capital) Detaylı + Aks Etiketleri
   ================================================================ */

interface ColumnProps {
  col: ColumnData; viewMode: ViewMode; opacity: number; costHeatmapColor?: string
  showLabels?: boolean
}

export function Column({ col, viewMode, opacity, costHeatmapColor, showLabels }: ColumnProps) {
  const mat = useMemo(
    () => resolveViewMaterial(
      new THREE.MeshStandardMaterial({ color: '#A8A8A8', roughness: 0.75 }),
      viewMode, opacity, true, costHeatmapColor,
    ),
    [viewMode, opacity, costHeatmapColor],
  )

  const capitalH = 0.12
  const capitalSize = col.size + 0.08

  return (
    <group>
      {/* Ana kolon gövdesi */}
      <mesh position={[col.x, col.height / 2, col.z]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[col.size, col.height - capitalH, col.size]} />
      </mesh>

      {/* Başlık (capital) — her kat seviyesinde genişleme */}
      {viewMode !== 'wireframe' && (
        <mesh position={[col.x, col.height - capitalH / 2, col.z]} castShadow>
          <boxGeometry args={[capitalSize, capitalH, capitalSize]} />
          <meshStandardMaterial color="#9E9E9E" roughness={0.7} />
        </mesh>
      )}

      {/* Taban (pedestal) */}
      {viewMode !== 'wireframe' && (
        <mesh position={[col.x, capitalH / 2, col.z]}>
          <boxGeometry args={[capitalSize, capitalH, capitalSize]} />
          <meshStandardMaterial color="#9E9E9E" roughness={0.7} />
        </mesh>
      )}

      {/* Aks etiketi */}
      {showLabels && viewMode !== 'wireframe' && (
        <Text
          position={[col.x, -0.5, col.z]}
          fontSize={0.35}
          color="#D32F2F"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {col.label}
        </Text>
      )}
    </group>
  )
}

/* ================================================================
   BEAM — Kolon arası yatay betonarme kiriş
   ================================================================ */

interface BeamProps {
  from: { x: number; z: number }; to: { x: number; z: number }
  y: number; width: number; height: number; viewMode: ViewMode
}

export function Beam({ from, to, y, width, height, viewMode }: BeamProps) {
  if (viewMode === 'wireframe') return null

  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dz, dx)
  const cx = (from.x + to.x) / 2
  const cz = (from.z + to.z) / 2

  return (
    <mesh position={[cx, y - height / 2, cz]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[length, height, width]} />
      <meshStandardMaterial color="#B0B0B0" roughness={0.8} />
    </mesh>
  )
}

/* ================================================================
   STAIRCASE — U-dönüşlü merdiven
   Basamak (tread) + Rıht (riser) + Kol (stringer) + Korkuluk + Küpeşte
   ================================================================ */

interface StaircaseProps {
  position: [number, number, number]
  floorHeight: number; width: number; depth: number; viewMode: ViewMode
}

export function Staircase({ position, floorHeight, width, depth, viewMode }: StaircaseProps) {
  if (viewMode === 'wireframe') return null

  const stepH = 0.17           // rıht yüksekliği (TBDY uyumlu ≤18cm)
  const stepD = 0.28           // basamak derinliği (≥25cm)
  const stepsPerFlight = Math.floor(floorHeight / 2 / stepH)
  const flightW = width / 2 - 0.1 // her kol genişliği
  const landingD = stepD * 1.2      // sahanlık derinliği
  const stringerW = 0.04       // kol (stringer) kalınlığı
  const railH = 0.90           // korkuluk yüksekliği
  const railD = 0.04           // korkuluk kalınlığı

  const steps: React.JSX.Element[] = []

  // 1. Kol (up flight)
  for (let i = 0; i < stepsPerFlight; i++) {
    const sy = i * stepH
    const sz = i * stepD
    // Basamak (tread)
    steps.push(
      <mesh key={`t1-${i}`} position={[flightW / 2, sy + stepH, sz + stepD / 2]} castShadow receiveShadow>
        <boxGeometry args={[flightW, 0.04, stepD + 0.03]} />
        <meshStandardMaterial color="#D4CEC4" roughness={0.6} />
      </mesh>,
    )
    // Rıht (riser)
    steps.push(
      <mesh key={`r1-${i}`} position={[flightW / 2, sy + stepH / 2, sz]} castShadow>
        <boxGeometry args={[flightW, stepH, 0.02]} />
        <meshStandardMaterial color="#C8C0B4" roughness={0.7} />
      </mesh>,
    )
  }

  // Ara sahanlık
  const landingY = stepsPerFlight * stepH
  const landingZ = stepsPerFlight * stepD
  steps.push(
    <mesh key="landing" position={[width / 2, landingY + 0.02, landingZ + landingD / 2]} castShadow receiveShadow>
      <boxGeometry args={[width, 0.04, landingD]} />
      <meshStandardMaterial color="#D4CEC4" roughness={0.6} />
    </mesh>,
  )

  // 2. Kol (down flight — ters yön)
  for (let i = 0; i < stepsPerFlight; i++) {
    const sy = landingY + (i + 1) * stepH
    const sz = landingZ + landingD - i * stepD
    steps.push(
      <mesh key={`t2-${i}`} position={[width - flightW / 2, sy, sz - stepD / 2]} castShadow receiveShadow>
        <boxGeometry args={[flightW, 0.04, stepD + 0.03]} />
        <meshStandardMaterial color="#D4CEC4" roughness={0.6} />
      </mesh>,
    )
    steps.push(
      <mesh key={`r2-${i}`} position={[width - flightW / 2, sy - stepH / 2, sz]} castShadow>
        <boxGeometry args={[flightW, stepH, 0.02]} />
        <meshStandardMaterial color="#C8C0B4" roughness={0.7} />
      </mesh>,
    )
  }

  // Kol (stringer) — sol + sağ yan levha
  const stringerLen = Math.sqrt((stepsPerFlight * stepD) ** 2 + (stepsPerFlight * stepH) ** 2)
  const stringerAngle = Math.atan2(stepsPerFlight * stepH, stepsPerFlight * stepD)

  // Korkuluk + küpeşte — basitleştirilmiş ama mimari standart
  const railPosts: React.JSX.Element[] = []
  for (let i = 0; i <= stepsPerFlight; i += 3) {
    const py = i * stepH + railH / 2
    const pz = i * stepD
    // 1. kol korkuluk dikmeleri
    railPosts.push(
      <mesh key={`rp1-${i}`} position={[0.04, py, pz]}>
        <boxGeometry args={[railD, railH, railD]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
      </mesh>,
    )
  }

  // Küpeşte (handrail) — üst yatay boru
  steps.push(
    <mesh key="hr1" position={[0.04, stepsPerFlight * stepH / 2 + railH, stepsPerFlight * stepD / 2]}
      rotation={[stringerAngle, 0, 0]}>
      <boxGeometry args={[railD, 0.05, stringerLen + 0.2]} />
      <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
    </mesh>,
  )

  return (
    <group position={position}>
      {steps}
      {railPosts}

      {/* Merdiven kovası çerçevesi — açık boşluk */}
      <mesh position={[width / 2, floorHeight / 2, depth / 2]}>
        <boxGeometry args={[0.12, floorHeight, depth]} />
        <meshStandardMaterial color="#C0B8A8" roughness={0.7} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

/* ================================================================
   BALCONY — Kantilever Döşeme + Dikey Çubuk Korkuluk + Küpeşte
   ================================================================ */

interface BalconyProps {
  x: number; y: number; z: number
  width: number; depth: number; viewMode: ViewMode
}

export function BalconyRailing({ x, y, z, width, depth, viewMode }: BalconyProps) {
  if (viewMode === 'wireframe') return null

  const railH = 1.10  // korkuluk yüksekliği (TS-EN 13374 min 1.00m)
  const postSpacing = 0.12  // dikme aralığı (max 11cm boşluk)
  const postDiameter = 0.016
  const handrailH = 0.05
  const handrailW = 0.06

  const postCount = Math.floor(width / postSpacing)
  const posts: React.JSX.Element[] = []

  // Dikey dikme çubukları — ön cephe
  for (let i = 0; i <= postCount; i++) {
    const px = -width / 2 + i * (width / postCount)
    posts.push(
      <mesh key={`fp-${i}`} position={[px, railH / 2, -depth / 2]}>
        <cylinderGeometry args={[postDiameter, postDiameter, railH, 6]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.25} />
      </mesh>,
    )
  }

  // Dikey dikme — yan kenarlar
  const sidePostCount = Math.max(2, Math.floor(depth / postSpacing))
  for (let i = 0; i <= sidePostCount; i++) {
    const pz = -depth / 2 + i * (depth / sidePostCount)
    // Sol
    posts.push(
      <mesh key={`lp-${i}`} position={[-width / 2, railH / 2, pz]}>
        <cylinderGeometry args={[postDiameter, postDiameter, railH, 6]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.25} />
      </mesh>,
    )
    // Sağ
    posts.push(
      <mesh key={`rp-${i}`} position={[width / 2, railH / 2, pz]}>
        <cylinderGeometry args={[postDiameter, postDiameter, railH, 6]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.25} />
      </mesh>,
    )
  }

  return (
    <group position={[x, y, z]}>
      {/* Balkon döşemesi */}
      <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.02, 0.12, depth + 0.02]} />
        <meshStandardMaterial color="#C8C0B4" roughness={0.7} />
      </mesh>

      {/* Su eğimi (slope) — ince üst katman */}
      <mesh position={[0, 0.02, 0.02]} receiveShadow>
        <boxGeometry args={[width - 0.04, 0.015, depth - 0.04]} />
        <meshStandardMaterial color="#B8B0A4" roughness={0.5} />
      </mesh>

      {/* Dikme çubukları */}
      {posts}

      {/* Küpeşte (handrail) — ön */}
      <mesh position={[0, railH + handrailH / 2, -depth / 2]}>
        <boxGeometry args={[width + 0.04, handrailH, handrailW]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Küpeşte — sol */}
      <mesh position={[-width / 2, railH + handrailH / 2, 0]}>
        <boxGeometry args={[handrailW, handrailH, depth]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Küpeşte — sağ */}
      <mesh position={[width / 2, railH + handrailH / 2, 0]}>
        <boxGeometry args={[handrailW, handrailH, depth]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Orta yatay bant (midrail) — çocuk güvenliği */}
      <mesh position={[0, railH * 0.5, -depth / 2]}>
        <boxGeometry args={[width, 0.03, 0.03]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ================================================================
   ROOF — Teras (korkuluk + derz bandı) / Beşik (mahya + saçak)
   ================================================================ */

interface RoofProps {
  building: BuildingInfo; roofType: 'flat' | 'gable'; viewMode: ViewMode
  visible: boolean; material: THREE.Material
}

export function Roof({ building, roofType, viewMode, visible, material }: RoofProps) {
  if (!visible) return null
  const topY = building.total_height

  if (roofType === 'flat') {
    return (
      <group>
        {/* Ana döşeme */}
        <mesh position={[building.width / 2, topY + 0.06, building.depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[building.width + 0.4, 0.12, building.depth + 0.4]} />
          <primitive object={material} attach="material" />
        </mesh>

        {/* Su yalıtım membranı — koyu şerit */}
        {viewMode !== 'wireframe' && (
          <mesh position={[building.width / 2, topY + 0.125, building.depth / 2]}>
            <boxGeometry args={[building.width + 0.2, 0.005, building.depth + 0.2]} />
            <meshStandardMaterial color="#3E3E3E" roughness={0.9} />
          </mesh>
        )}

        {/* Parapet duvarları (4 kenar) */}
        {[
          { p: [building.width / 2, topY + 0.55, 0] as [number, number, number], s: [building.width + 0.6, 0.9, 0.12] as [number, number, number] },
          { p: [building.width / 2, topY + 0.55, building.depth] as [number, number, number], s: [building.width + 0.6, 0.9, 0.12] as [number, number, number] },
          { p: [0, topY + 0.55, building.depth / 2] as [number, number, number], s: [0.12, 0.9, building.depth] as [number, number, number] },
          { p: [building.width, topY + 0.55, building.depth / 2] as [number, number, number], s: [0.12, 0.9, building.depth] as [number, number, number] },
        ].map((wall, i) => (
          <group key={`parapet-${i}`}>
            <mesh position={wall.p} castShadow>
              <boxGeometry args={wall.s} />
              <meshStandardMaterial color="#D4C9B8" roughness={0.7} />
            </mesh>
            {/* Parapet kapağı (coping) — üst metal bant */}
            {viewMode !== 'wireframe' && (
              <mesh position={[wall.p[0], topY + 1.02, wall.p[2]]}>
                <boxGeometry args={[wall.s[0] + 0.04, 0.04, wall.s[2] + 0.04]} />
                <meshStandardMaterial color="#888" metalness={0.5} roughness={0.3} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    )
  }

  // Beşik çatı
  const rh = Math.min(2.5, building.depth * 0.2)
  const eave = 0.6

  const geo = useMemo(() => {
    const s = new THREE.Shape()
    const hw = building.width / 2 + eave
    s.moveTo(-hw, 0)
    s.lineTo(0, rh)
    s.lineTo(hw, 0)
    s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: building.depth + eave * 2, bevelEnabled: false })
  }, [building.width, building.depth, rh])

  return (
    <group>
      <mesh geometry={geo}
        material={viewMode === 'wireframe'
          ? new THREE.MeshBasicMaterial({ wireframe: true, color: '#884' })
          : new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 })}
        position={[building.width / 2, topY, -eave]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow />
      {/* Mahya (ridge) — üst çizgi */}
      {viewMode !== 'wireframe' && (
        <mesh position={[building.width / 2, topY + rh + 0.02, building.depth / 2]}>
          <boxGeometry args={[0.12, 0.06, building.depth + eave * 2]} />
          <meshStandardMaterial color="#6D4C28" roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}

/* ================================================================
   FOUNDATION — Sürekli Temel Bandı + Radye Detayı
   ================================================================ */

export function Foundation({ building, viewMode }: { building: BuildingInfo; viewMode: ViewMode }) {
  if (viewMode === 'wireframe') return null
  const bH = 0.80
  const bW = 0.50
  const w = building.width
  const d = building.depth

  return (
    <group>
      {/* Radye temel (raft) — ince alt plaka */}
      <mesh position={[w / 2, -bH - 0.15, d / 2]} receiveShadow>
        <boxGeometry args={[w + 1.2, 0.30, d + 1.2]} />
        <meshStandardMaterial color="#6B6B6B" roughness={0.95} />
      </mesh>

      {/* Sürekli temel bandı — 4 kenar */}
      {[
        [w / 2, -bH / 2, -bW / 2, w + 0.8, bH, bW],
        [w / 2, -bH / 2, d + bW / 2, w + 0.8, bH, bW],
        [-bW / 2, -bH / 2, d / 2, bW, bH, d + 0.8],
        [w + bW / 2, -bH / 2, d / 2, bW, bH, d + 0.8],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={`fb-${i}`} position={[x, y, z]} receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#7B7B7B" roughness={0.9} />
        </mesh>
      ))}

      {/* Temel üst seviye çizgisi (±0.00 kotu) */}
      <mesh position={[w / 2, 0.005, d / 2]}>
        <boxGeometry args={[w + 1.0, 0.01, d + 1.0]} />
        <meshStandardMaterial color="#555" roughness={0.5} />
      </mesh>
    </group>
  )
}

/* ================================================================
   ENTRANCE STEPS — Profesyonel giriş basamakları + rampa çizgisi
   ================================================================ */

export function EntranceSteps({ building, viewMode }: { building: BuildingInfo; viewMode: ViewMode }) {
  if (viewMode === 'wireframe') return null
  const stepCount = 4
  const stepH = 0.16
  const stepD = 0.32
  const stepW = 2.4
  const startX = building.width * 0.3

  return (
    <group position={[startX, 0, -0.15]}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <group key={`step-${i}`}>
          {/* Basamak */}
          <mesh position={[0, -i * stepH - stepH / 2, -i * stepD - stepD / 2]} castShadow receiveShadow>
            <boxGeometry args={[stepW, stepH, stepD + 0.03]} />
            <meshStandardMaterial color="#C0B8A8" roughness={0.65} />
          </mesh>
          {/* Basamak burun profili (nosing) */}
          <mesh position={[0, -i * stepH - 0.01, -i * stepD - stepD + 0.01]}>
            <boxGeometry args={[stepW + 0.02, 0.025, 0.04]} />
            <meshStandardMaterial color="#A09888" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Giriş platformu */}
      <mesh position={[0, 0.02, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[stepW + 0.4, 0.04, 0.8]} />
        <meshStandardMaterial color="#B8B0A0" roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ================================================================
   SECTION CUT — Three.js ClippingPlane İçin Görsel Düzlem
   ================================================================ */

export function SectionPlane({ position, rotation, width, depth, visible }: {
  position: [number, number, number]; rotation: [number, number, number]
  width: number; depth: number; visible: boolean
}) {
  if (!visible) return null
  return (
    <group>
      {/* Yarı-saydam kesit düzlemi */}
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[width + 6, depth + 6]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* Kenar çizgisi */}
      <mesh position={position} rotation={rotation}>
        <ringGeometry args={[Math.max(width, depth) / 2 + 2.5, Math.max(width, depth) / 2 + 2.8, 64]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ================================================================
   ROOM FLOOR — Zemin kaplama
   ================================================================ */

export function RoomFloor({ room, floorY, viewMode, isHovered, isSelected }: {
  room: Room3D; floorY: number; viewMode: ViewMode; isHovered: boolean; isSelected: boolean
}) {
  if (viewMode === 'wireframe') return null
  const color = isSelected ? '#42A5F5' : isHovered ? '#90CAF9' : ROOM_COLORS[room.type] || '#F5F5F5'
  return (
    <mesh position={[room.position.x, floorY + 0.005, room.position.z]} receiveShadow>
      <boxGeometry args={[room.dimensions.width - 0.02, 0.01, room.dimensions.depth - 0.02]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}

/* ================================================================
   4D BIM HELPERS
   ================================================================ */

export function getPhaseForMonth(month: number) {
  return CONSTRUCTION_PHASES.find(p => month >= p.startMonth && month <= p.endMonth) || null
}

export function isElementBuiltAtMonth(
  elementType: string, floorIndex: number, totalFloors: number, month: number,
): boolean {
  if (elementType === 'foundation') return month >= 1
  const katStart = 2 + floorIndex * 1.5
  if (elementType === 'slab' || elementType === 'columns') return month >= katStart
  if (elementType === 'walls_exterior' || elementType === 'roof') return month >= Math.max(8, katStart + 3)
  if (elementType === 'facade' || elementType === 'windows') return month >= 10
  if (elementType === 'walls_interior' || elementType === 'doors' || elementType === 'interior_finish') return month >= 13
  if (elementType === 'mep') return month >= 16
  return month >= 18
}

export function get4DOpacity(
  elementType: string, floorIndex: number, totalFloors: number, month: number,
): { opacity: number; color?: string } {
  if (!isElementBuiltAtMonth(elementType, floorIndex, totalFloors, month))
    return { opacity: 0.06, color: '#CCCCCC' }
  const phase = getPhaseForMonth(month)
  if (phase && phase.elements.includes(elementType as never))
    return { opacity: 1.0, color: phase.color }
  return { opacity: 1.0 }
}

/* ================================================================
   5D COST HEATMAP
   ================================================================ */

export function getCostHeatmapColor(cost: number, maxCost: number): string {
  const ratio = Math.min(cost / maxCost, 1)
  if (ratio < 0.25) {
    const t = ratio / 0.25
    return `rgb(${Math.round(27 + t * (76 - 27))},${Math.round(94 + t * (175 - 94))},${Math.round(32 + t * (80 - 32))})`
  }
  if (ratio < 0.50) {
    const t = (ratio - 0.25) / 0.25
    return `rgb(${Math.round(76 + t * (251 - 76))},${Math.round(175 + t * (192 - 175))},${Math.round(80 - t * 30)})`
  }
  if (ratio < 0.75) {
    const t = (ratio - 0.50) / 0.25
    return `rgb(${Math.round(251 + t * (244 - 251))},${Math.round(192 - t * (192 - 67))},${Math.round(50 - t * 20)})`
  }
  const t = (ratio - 0.75) / 0.25
  return `rgb(${Math.round(244 - t * (244 - 183))},${Math.round(67 - t * 39)},${Math.round(30 - t * 2)})`
}
