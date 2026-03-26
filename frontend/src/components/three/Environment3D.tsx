/**
 * imarPRO — Environment3D.tsx (Professional Rewrite)
 *
 * Arazi ve çevre: Parsel sınırı, yeşil alan, yol sistemi, peyzaj,
 * sokak mobilyaları, 3D kuzey oku pusula, HDR sky dome.
 *
 * Mimari site plan standardı:
 * - Parsel sınır direkleri + tel örgü çizgisi
 * - Çim, çakıl, bitki bölgeleri
 * - Yaprak döken ağaç (IcosphereGeometry) + iğne yapraklı (koni)
 * - Yol: asfalt + bordür + kaldırım + yaya geçidi
 * - Sokak lambası, bank, çöp kovası
 * - Araba (2 model)
 * - 3D pusula (N/S/E/W)
 */

import { useMemo } from 'react'
import { Environment, Sky, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { BuildingInfo, ViewMode } from './types3d'

/* ════════════════════════════════════
   TREE — 2 Tip: Yaprak döken + İğne yapraklı
   ════════════════════════════════════ */

function DeciduousTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const s = scale
  return (
    <group position={position}>
      <mesh position={[0, 1.5 * s, 0]} castShadow>
        <cylinderGeometry args={[0.08 * s, 0.14 * s, 3.0 * s, 6]} />
        <meshStandardMaterial color="#5D4037" roughness={0.9} />
      </mesh>
      {/* Canopy — 3 overlapping spheres for volume */}
      <mesh position={[0, 3.8 * s, 0]} castShadow>
        <icosahedronGeometry args={[1.6 * s, 1]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.5 * s, 3.3 * s, 0.3 * s]} castShadow>
        <icosahedronGeometry args={[1.2 * s, 1]} />
        <meshStandardMaterial color="#388E3C" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[-0.4 * s, 3.5 * s, -0.2 * s]} castShadow>
        <icosahedronGeometry args={[1.0 * s, 1]} />
        <meshStandardMaterial color="#43A047" roughness={0.85} flatShading />
      </mesh>
      {/* Gölge diski — zemin */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.8 * s, 12]} />
        <meshStandardMaterial color="#4E7A3E" roughness={1} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

function EvergreenTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const s = scale
  return (
    <group position={position}>
      <mesh position={[0, 1.0 * s, 0]} castShadow>
        <cylinderGeometry args={[0.07 * s, 0.12 * s, 2.0 * s, 6]} />
        <meshStandardMaterial color="#4E342E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.6 * s, 0]} castShadow>
        <coneGeometry args={[1.0 * s, 2.0 * s, 8]} />
        <meshStandardMaterial color="#1B5E20" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.8 * s, 0]} castShadow>
        <coneGeometry args={[0.7 * s, 1.6 * s, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.7 * s, 0]} castShadow>
        <coneGeometry args={[0.4 * s, 1.2 * s, 6]} />
        <meshStandardMaterial color="#33691E" roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ════════════════════════════════════
   BUSH — Alçak çalı
   ════════════════════════════════════ */

function Bush({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <mesh position={[position[0], position[1] + 0.35 * scale, position[2]]} castShadow>
      <sphereGeometry args={[0.45 * scale, 8, 6]} />
      <meshStandardMaterial color="#558B2F" roughness={0.9} flatShading />
    </mesh>
  )
}

/* ════════════════════════════════════
   CAR — Detaylı araç
   ════════════════════════════════════ */

function Car({ position, rotation = 0, color = '#1565C0' }: {
  position: [number, number, number]; rotation?: number; color?: string
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.55, 4.4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.95, -0.2]} castShadow>
        <boxGeometry args={[1.55, 0.50, 2.3]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.95, -0.2]}>
        <boxGeometry args={[1.57, 0.42, 2.1]} />
        <meshPhysicalMaterial color="#88CCEE" transparent opacity={0.35} roughness={0.05} transmission={0.5} />
      </mesh>
      {/* Far (headlight) */}
      <mesh position={[0.6, 0.45, 2.22]}>
        <boxGeometry args={[0.35, 0.15, 0.04]} />
        <meshStandardMaterial color="#FFF9C4" emissive="#FFF9C4" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.6, 0.45, 2.22]}>
        <boxGeometry args={[0.35, 0.15, 0.04]} />
        <meshStandardMaterial color="#FFF9C4" emissive="#FFF9C4" emissiveIntensity={0.3} />
      </mesh>
      {/* Tekerlek */}
      {[[-0.85, 0.22, 1.4], [0.85, 0.22, 1.4], [-0.85, 0.22, -1.3], [0.85, 0.22, -1.3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.16, 12]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/* ════════════════════════════════════
   STREET FURNITURE
   ════════════════════════════════════ */

function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 4.0, 6]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 3.9, 0]}>
        <boxGeometry args={[0.6, 0.08, 0.2]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0.5, 3.82, 0]}>
        <boxGeometry args={[0.35, 0.15, 0.18]} />
        <meshStandardMaterial color="#FFFDE7" emissive="#FFF59D" emissiveIntensity={0.15} roughness={0.2} />
      </mesh>
    </group>
  )
}

function ParkBench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.5, 0.06, 0.4]} />
        <meshStandardMaterial color="#6D4C41" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.50, -0.22]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[1.5, 0.5, 0.06]} />
        <meshStandardMaterial color="#6D4C41" roughness={0.7} />
      </mesh>
      {[[-0.6, 0.13, 0], [0.6, 0.13, 0]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.06, 0.26, 0.4]} />
          <meshStandardMaterial color="#333" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/* ════════════════════════════════════
   ROAD — Asfalt + Bordür + Kaldırım + Yaya Geçidi
   ════════════════════════════════════ */

function RoadSystem({ building }: { building: BuildingInfo }) {
  const roadW = 7
  const roadL = building.width + 20
  const cx = building.width / 2
  const cz = -6

  return (
    <group position={[cx, 0, cz]}>
      {/* Asfalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[roadL, roadW]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.95} />
      </mesh>
      {/* Orta şerit çizgisi (kesikli) */}
      {Array.from({ length: Math.floor(roadL / 3) }).map((_, i) => (
        <mesh key={`cl-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[-roadL / 2 + i * 3 + 1.5, 0.001, 0]}>
          <planeGeometry args={[1.8, 0.10]} />
          <meshStandardMaterial color="#FFEB3B" roughness={0.6} />
        </mesh>
      ))}
      {/* Kenar çizgileri */}
      {[-roadW / 2 + 0.15, roadW / 2 - 0.15].map((z, i) => (
        <mesh key={`el-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, z]}>
          <planeGeometry args={[roadL, 0.12]} />
          <meshStandardMaterial color="#EEEEEE" roughness={0.6} />
        </mesh>
      ))}
      {/* Yaya geçidi (zebra) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`zb-${i}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[building.width * 0.15, 0.002, -roadW / 2 + 0.6 + i * 0.9]}>
          <planeGeometry args={[3.5, 0.50]} />
          <meshStandardMaterial color="#EEEEEE" roughness={0.5} />
        </mesh>
      ))}

      {/* Bordür (curb) — bina tarafı */}
      <mesh position={[0, 0.09, roadW / 2 + 0.08]}>
        <boxGeometry args={[roadL, 0.18, 0.16]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.7} />
      </mesh>
      {/* Bordür — karşı taraf */}
      <mesh position={[0, 0.09, -roadW / 2 - 0.08]}>
        <boxGeometry args={[roadL, 0.18, 0.16]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.7} />
      </mesh>

      {/* Kaldırım (sidewalk) — bina tarafı */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, roadW / 2 + 1.2]} receiveShadow>
        <planeGeometry args={[roadL, 2.0]} />
        <meshStandardMaterial color="#C0B8A8" roughness={0.85} />
      </mesh>
      {/* Kaldırım — karşı taraf */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -roadW / 2 - 1.2]} receiveShadow>
        <planeGeometry args={[roadL, 2.0]} />
        <meshStandardMaterial color="#C0B8A8" roughness={0.85} />
      </mesh>
    </group>
  )
}

/* ════════════════════════════════════
   PARCEL — Sınır direkleri + tel çizgi + arazi
   ════════════════════════════════════ */

function ParcelGround({ building }: { building: BuildingInfo }) {
  const margin = 10
  const w = building.width
  const d = building.depth

  // Sınır noktaları (dikdörtgen parsel)
  const corners: [number, number][] = [[-1.5, -2], [w + 1.5, -2], [w + 1.5, d + 1.5], [-1.5, d + 1.5]]

  return (
    <group>
      {/* Ana zemin — büyük çim alan */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, -0.04, d / 2]} receiveShadow>
        <planeGeometry args={[w + margin * 2, d + margin * 2]} />
        <meshStandardMaterial color="#6B8E4E" roughness={1.0} />
      </mesh>

      {/* İnşaat alanı — çakıl/toprak */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, -0.02, d / 2]} receiveShadow>
        <planeGeometry args={[w + 3, d + 3]} />
        <meshStandardMaterial color="#A09880" roughness={0.95} />
      </mesh>

      {/* Parsel sınır direkleri */}
      {corners.map(([cx, cz], i) => (
        <group key={`post-${i}`}>
          <mesh position={[cx, 0.30, cz]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.60, 6]} />
            <meshStandardMaterial color="#EF5350" roughness={0.5} />
          </mesh>
          <mesh position={[cx, 0.62, cz]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#FF1744" roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Parsel sınır çizgisi (4 kenar) — ince beyaz */}
      {corners.map((start, i) => {
        const end = corners[(i + 1) % corners.length]
        const mx = (start[0] + end[0]) / 2
        const mz = (start[1] + end[1]) / 2
        const dx = end[0] - start[0]
        const dz = end[1] - start[1]
        const len = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        return (
          <mesh key={`bl-${i}`} position={[mx, 0.02, mz]} rotation={[-Math.PI / 2, angle, 0]}>
            <planeGeometry args={[0.05, len]} />
            <meshBasicMaterial color="#FFFFFF" transparent opacity={0.8} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ════════════════════════════════════
   COMPASS — 3D Kuzey Oku Pusulası
   ════════════════════════════════════ */

function Compass({ building }: { building: BuildingInfo }) {
  const x = building.width + 6
  const z = building.depth + 4

  return (
    <group position={[x, 0.1, z]}>
      {/* Zemin diski */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color="#F5F5F5" roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.05, 1.15, 32]} />
        <meshStandardMaterial color="#333" roughness={0.4} />
      </mesh>

      {/* N ok — kırmızı üçgen */}
      <mesh position={[0, 0.02, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.25, 0.9, 3]} />
        <meshStandardMaterial color="#D32F2F" roughness={0.3} />
      </mesh>
      {/* S ok — beyaz üçgen */}
      <mesh position={[0, 0.02, 0.5]} rotation={[-Math.PI / 2, Math.PI, 0]}>
        <coneGeometry args={[0.2, 0.7, 3]} />
        <meshStandardMaterial color="#BDBDBD" roughness={0.3} />
      </mesh>

      {/* Yön etiketleri */}
      {[
        { label: 'K', pos: [0, 0.3, -1.4] as [number, number, number], color: '#D32F2F' },
        { label: 'G', pos: [0, 0.3, 1.4] as [number, number, number], color: '#666' },
        { label: 'D', pos: [1.4, 0.3, 0] as [number, number, number], color: '#666' },
        { label: 'B', pos: [-1.4, 0.3, 0] as [number, number, number], color: '#666' },
      ].map(({ label, pos, color }) => (
        <Text key={label} position={pos} fontSize={0.4} color={color}
          anchorX="center" anchorY="middle" font={undefined}>
          {label}
        </Text>
      ))}
    </group>
  )
}

/* ════════════════════════════════════
   SUN LIGHT
   ════════════════════════════════════ */

function getSunPosition(hour: number, lat: number = 39.9): [number, number, number] {
  const dayAngle = ((hour - 6) / 12) * Math.PI
  const altitude = Math.sin(dayAngle) * (90 - Math.abs(lat - 23.5)) * (Math.PI / 180)
  const azimuth = dayAngle - Math.PI / 2
  const r = 60
  return [
    r * Math.cos(altitude) * Math.sin(azimuth),
    Math.max(5, r * Math.sin(altitude) + 10),
    r * Math.cos(altitude) * Math.cos(azimuth),
  ]
}

export function SunLight({ hour, building }: { hour: number; building: BuildingInfo }) {
  const [x, y, z] = getSunPosition(hour)
  return (
    <>
      <hemisphereLight args={['#B4D7FF', '#5C4033', 0.35]} />
      <directionalLight
        position={[x, y, z]} intensity={1.6} castShadow
        shadow-mapSize-width={4096} shadow-mapSize-height={4096}
        shadow-camera-far={120}
        shadow-camera-left={-40} shadow-camera-right={40}
        shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-bias={-0.0004}
      />
    </>
  )
}

/* ════════════════════════════════════
   MAIN ENVIRONMENT
   ════════════════════════════════════ */

interface EnvironmentSceneProps {
  building: BuildingInfo; sunHour: number; viewMode: ViewMode
}

export function EnvironmentScene({ building, sunHour, viewMode }: EnvironmentSceneProps) {
  if (viewMode === 'wireframe') {
    return (
      <>
        <ambientLight intensity={0.6} />
        <gridHelper args={[building.width + 20, 20, '#ccc', '#eee']}
          position={[building.width / 2, -0.01, building.depth / 2]} />
      </>
    )
  }

  const w = building.width
  const d = building.depth

  // Stabil ağaç pozisyonları
  const trees = useMemo(() => [
    { type: 'd', pos: [w + 4, 0, 2] as [number, number, number], s: 0.9 },
    { type: 'd', pos: [w + 3.5, 0, d - 1] as [number, number, number], s: 1.0 },
    { type: 'e', pos: [-4, 0, d * 0.3] as [number, number, number], s: 0.8 },
    { type: 'd', pos: [-3.5, 0, d * 0.75] as [number, number, number], s: 0.95 },
    { type: 'e', pos: [w * 0.25, 0, d + 4] as [number, number, number], s: 0.85 },
    { type: 'd', pos: [w * 0.65, 0, d + 3.5] as [number, number, number], s: 1.1 },
    { type: 'e', pos: [w + 5.5, 0, d * 0.5] as [number, number, number], s: 0.7 },
  ], [w, d])

  const bushes = useMemo(() => [
    [w + 2, 0, d + 1.5] as [number, number, number],
    [w + 2.5, 0, 0.5] as [number, number, number],
    [-2, 0, d + 1] as [number, number, number],
    [-2.5, 0, d * 0.5] as [number, number, number],
    [w * 0.5, 0, d + 2.5] as [number, number, number],
  ], [w, d])

  return (
    <>
      <SunLight hour={sunHour} building={building} />
      <Sky sunPosition={getSunPosition(sunHour)} turbidity={8} rayleigh={2}
        mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Environment preset="city" background={false} />

      <ParcelGround building={building} />
      <RoadSystem building={building} />

      {/* Ağaçlar */}
      {trees.map((t, i) =>
        t.type === 'd'
          ? <DeciduousTree key={`dt-${i}`} position={t.pos} scale={t.s} />
          : <EvergreenTree key={`et-${i}`} position={t.pos} scale={t.s} />,
      )}

      {/* Çalılar */}
      {bushes.map((pos, i) => <Bush key={`b-${i}`} position={pos} scale={0.8 + i * 0.1} />)}

      {/* Arabalar */}
      <Car position={[w * 0.35, 0, -6]} rotation={0} color="#1565C0" />
      <Car position={[w * 0.65, 0, -8.8]} rotation={Math.PI} color="#546E7A" />
      <Car position={[w + 4, 0, d * 0.4]} rotation={Math.PI / 2} color="#E53935" />

      {/* Sokak lambası */}
      <StreetLamp position={[w * 0.2, 0, -2.5]} />
      <StreetLamp position={[w * 0.8, 0, -2.5]} />

      {/* Park bankı */}
      <ParkBench position={[w + 3, 0, d * 0.5]} rotation={-Math.PI / 2} />

      {/* Pusula */}
      <Compass building={building} />

      {/* Sis */}
      <fog attach="fog" args={['#D4E4F0', 80, 200]} />
    </>
  )
}
