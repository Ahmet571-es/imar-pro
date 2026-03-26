/**
 * imarPRO — Environment3D.tsx
 * Çevre elemanları: parsel sınırı yeşil alan, yol, ağaç, araba,
 * çim texture, 3D kuzey oku, HDR sky dome.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Sky, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { BuildingInfo, ViewMode } from './types3d'

// ── Tree (Procedural Billboard/Cone) ──

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const s = scale
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1.2 * s, 0]} castShadow>
        <cylinderGeometry args={[0.12 * s, 0.18 * s, 2.4 * s, 6]} />
        <meshStandardMaterial color="#6B4423" roughness={0.9} />
      </mesh>
      {/* Canopy — 2 stacked cones for more realism */}
      <mesh position={[0, 3.0 * s, 0]} castShadow>
        <coneGeometry args={[1.4 * s, 2.5 * s, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.2 * s, 0]} castShadow>
        <coneGeometry args={[1.0 * s, 2.0 * s, 8]} />
        <meshStandardMaterial color="#388E3C" roughness={0.8} />
      </mesh>
    </group>
  )
}

// ── Car (Simple Box) ──

function Car({ position, rotation = 0, color = '#1565C0' }: {
  position: [number, number, number]
  rotation?: number
  color?: string
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.8, 0.6, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.0, -0.3]} castShadow>
        <boxGeometry args={[1.5, 0.55, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 1.0, -0.3]}>
        <boxGeometry args={[1.52, 0.45, 2.0]} />
        <meshPhysicalMaterial color="#88CCEE" transparent opacity={0.4} roughness={0.05} transmission={0.5} />
      </mesh>
      {/* Wheels */}
      {[[-0.8, 0.2, -1.4], [0.8, 0.2, -1.4], [-0.8, 0.2, 1.2], [0.8, 0.2, 1.2]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.15, 12]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ── Road Surface ──

function Road({ building }: { building: BuildingInfo }) {
  const roadWidth = 7
  const roadLength = building.width + 16
  return (
    <group position={[building.width / 2, -0.02, -6]}>
      {/* Asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[roadLength, roadWidth]} />
        <meshStandardMaterial color="#404040" roughness={0.95} />
      </mesh>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[roadLength * 0.8, 0.12]} />
        <meshStandardMaterial color="#FFEB3B" roughness={0.7} />
      </mesh>
      {/* Sidewalk - building side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, roadWidth / 2 + 1]}>
        <planeGeometry args={[roadLength, 2]} />
        <meshStandardMaterial color="#BDBDBD" roughness={0.85} />
      </mesh>
      {/* Curb */}
      <mesh position={[0, 0.08, roadWidth / 2 + 0.05]}>
        <boxGeometry args={[roadLength, 0.16, 0.15]} />
        <meshStandardMaterial color="#9E9E9E" roughness={0.7} />
      </mesh>
    </group>
  )
}

// ── Parcel Green Area ──

function ParcelGround({ building }: { building: BuildingInfo }) {
  const margin = 8
  return (
    <group>
      {/* Main ground — large grass area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
        position={[building.width / 2, -0.04, building.depth / 2]}
        receiveShadow>
        <planeGeometry args={[building.width + margin * 2, building.depth + margin * 2]} />
        <meshStandardMaterial color="#7B9B5A" roughness={1.0} />
      </mesh>
      {/* Parsel sınırı — ince beyaz çizgi */}
      {[
        [building.width / 2, 0.01, -1, building.width + 2, 0.04, '#FFFFFF'],
        [building.width / 2, 0.01, building.depth + 1, building.width + 2, 0.04, '#FFFFFF'],
        [-1, 0.01, building.depth / 2, 0.04, building.depth + 2, '#FFFFFF'],
        [building.width + 1, 0.01, building.depth / 2, 0.04, building.depth + 2, '#FFFFFF'],
      ].map(([x, y, z, w, d, color], i) => (
        <mesh key={`boundary-${i}`}
          position={[x as number, y as number, z as number]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow>
          <planeGeometry args={[w as number, d as number]} />
          <meshStandardMaterial color={color as string} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ── 3D North Arrow ──

function NorthArrow({ building }: { building: BuildingInfo }) {
  const groupRef = useRef<THREE.Group>(null)
  const y = 0.1
  const x = building.width + 5
  const z = building.depth + 3

  return (
    <group ref={groupRef} position={[x, y, z]}>
      {/* Arrow body */}
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.4, 1.5, 4]} />
        <meshStandardMaterial color="#D32F2F" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Arrow shaft */}
      <mesh position={[0, 0.5, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.0, 6]} />
        <meshStandardMaterial color="#757575" roughness={0.5} />
      </mesh>
      {/* N label */}
      <Text
        position={[0, 0.5, -0.9]}
        fontSize={0.6}
        color="#D32F2F"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        K
      </Text>
    </group>
  )
}

// ── Sun Light System ──

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
  const target = useMemo(() => {
    const v = new THREE.Vector3(building.width / 2, building.total_height / 3, building.depth / 2)
    return v
  }, [building])

  return (
    <>
      <hemisphereLight
        args={['#B4D7FF', '#5C4033', 0.35]}
      />
      <directionalLight
        position={[x, y, z]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={120}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-bias={-0.0005}
        target-position={[target.x, target.y, target.z]}
      />
    </>
  )
}

// ── Main Environment Component ──

interface EnvironmentSceneProps {
  building: BuildingInfo
  sunHour: number
  viewMode: ViewMode
}

export function EnvironmentScene({ building, sunHour, viewMode }: EnvironmentSceneProps) {
  if (viewMode === 'wireframe') {
    return (
      <>
        <ambientLight intensity={0.6} />
        {/* Minimal wireframe ground */}
        <gridHelper
          args={[building.width + 20, 20, '#ccc', '#eee']}
          position={[building.width / 2, -0.01, building.depth / 2]}
        />
      </>
    )
  }

  // Tree positions — scattered around building
  const treePositions: [number, number, number][] = useMemo(() => [
    [building.width + 4, 0, 2],
    [building.width + 3, 0, building.depth - 2],
    [-4, 0, building.depth * 0.3],
    [-3.5, 0, building.depth * 0.7],
    [building.width * 0.3, 0, building.depth + 4],
  ], [building])

  return (
    <>
      <SunLight hour={sunHour} building={building} />

      {/* Sky */}
      <Sky
        sunPosition={getSunPosition(sunHour)}
        turbidity={8}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Environment map for reflections */}
      <Environment preset="city" background={false} />

      {/* Ground */}
      <ParcelGround building={building} />

      {/* Road */}
      <Road building={building} />

      {/* Trees */}
      {treePositions.map((pos, i) => (
        <Tree key={i} position={pos} scale={0.7 + Math.random() * 0.4} />
      ))}

      {/* Cars */}
      <Car position={[building.width * 0.4, 0, -6]} rotation={0} color="#1565C0" />
      <Car position={[building.width * 0.7, 0, -8.5]} rotation={Math.PI} color="#616161" />

      {/* North Arrow */}
      <NorthArrow building={building} />

      {/* Fog */}
      <fog attach="fog" args={['#D4E4F0', 80, 200]} />
    </>
  )
}
