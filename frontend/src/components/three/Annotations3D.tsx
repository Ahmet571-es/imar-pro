/**
 * imarPRO — Annotations3D.tsx
 *
 * Mimari çizim standardı 3D annotasyonlar:
 * - Oda etiketleri (isim + alan m² + tavan yüksekliği)
 * - Oda boyut ölçü çizgileri (genişlik × derinlik)
 * - Kat seviye işaretleri (+0.00, +3.00, +6.00...)
 * - Yapısal aks grid çizgileri (A-B-C / 1-2-3)
 * - Bina toplam boyut ölçüleri
 */

import { useMemo } from 'react'
import { Html, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Room3D, Floor3D, BuildingInfo, ColumnData, ViewMode } from './types3d'

// ── Room Label — isim + alan + yükseklik ──

interface RoomLabelProps {
  room: Room3D
  floorY: number
  viewMode: ViewMode
  showDimensions: boolean
}

export function RoomLabel({ room, floorY, viewMode, showDimensions }: RoomLabelProps) {
  if (viewMode === 'wireframe' || viewMode === 'xray') return null

  const area = (room.dimensions.width * room.dimensions.depth).toFixed(1)
  const labelY = floorY + 0.05

  return (
    <group>
      {/* Oda adı + alan — 3D text */}
      <Text
        position={[room.position.x, labelY, room.position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#333"
        anchorX="center"
        anchorY="middle"
        font={undefined}
        maxWidth={room.dimensions.width * 0.9}
      >
        {room.name}
      </Text>
      <Text
        position={[room.position.x, labelY, room.position.z + 0.30]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.16}
        color="#666"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {area} m²
      </Text>

      {/* Boyut ölçü çizgileri */}
      {showDimensions && (
        <RoomDimensionLines room={room} floorY={floorY} />
      )}
    </group>
  )
}

// ── Room Dimension Lines — genişlik × derinlik ──

function RoomDimensionLines({ room, floorY }: { room: Room3D; floorY: number }) {
  const y = floorY + 0.03
  const cx = room.position.x
  const cz = room.position.z
  const hw = room.dimensions.width / 2
  const hd = room.dimensions.depth / 2
  const offset = 0.3

  const wStr = `${room.dimensions.width.toFixed(2)}`
  const dStr = `${room.dimensions.depth.toFixed(2)}`

  return (
    <group>
      {/* Genişlik ölçüsü (x yönü) — alt kenar dışında */}
      <Line
        points={[
          new THREE.Vector3(cx - hw, y, cz - hd - offset),
          new THREE.Vector3(cx + hw, y, cz - hd - offset),
        ]}
        color="#1976D2"
        lineWidth={1.5}
      />
      {/* Extension lines */}
      <Line
        points={[
          new THREE.Vector3(cx - hw, y, cz - hd),
          new THREE.Vector3(cx - hw, y, cz - hd - offset - 0.1),
        ]}
        color="#1976D2"
        lineWidth={1}
      />
      <Line
        points={[
          new THREE.Vector3(cx + hw, y, cz - hd),
          new THREE.Vector3(cx + hw, y, cz - hd - offset - 0.1),
        ]}
        color="#1976D2"
        lineWidth={1}
      />
      {/* Width label */}
      <Text
        position={[cx, y + 0.01, cz - hd - offset - 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.12}
        color="#1976D2"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {wStr}
      </Text>

      {/* Derinlik ölçüsü (z yönü) — sol kenar dışında */}
      <Line
        points={[
          new THREE.Vector3(cx - hw - offset, y, cz - hd),
          new THREE.Vector3(cx - hw - offset, y, cz + hd),
        ]}
        color="#1976D2"
        lineWidth={1.5}
      />
      <Line
        points={[
          new THREE.Vector3(cx - hw, y, cz - hd),
          new THREE.Vector3(cx - hw - offset - 0.1, y, cz - hd),
        ]}
        color="#1976D2"
        lineWidth={1}
      />
      <Line
        points={[
          new THREE.Vector3(cx - hw, y, cz + hd),
          new THREE.Vector3(cx - hw - offset - 0.1, y, cz + hd),
        ]}
        color="#1976D2"
        lineWidth={1}
      />
      <Text
        position={[cx - hw - offset - 0.15, y + 0.01, cz]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.12}
        color="#1976D2"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {dStr}
      </Text>
    </group>
  )
}

// ── Floor Level Markers — +0.00, +3.00, +6.00... ──

interface FloorLevelMarkersProps {
  building: BuildingInfo
  viewMode: ViewMode
}

export function FloorLevelMarkers({ building, viewMode }: FloorLevelMarkersProps) {
  if (viewMode === 'wireframe') return null

  const markers = useMemo(() => {
    const result: { y: number; label: string }[] = []
    for (let i = 0; i <= building.floor_count; i++) {
      const y = i * building.floor_height
      const sign = y === 0 ? '±' : '+'
      result.push({ y, label: `${sign}${y.toFixed(2)}` })
    }
    return result
  }, [building])

  const x = -1.5

  return (
    <group>
      {markers.map((m, i) => (
        <group key={i}>
          {/* Yatay çizgi */}
          <Line
            points={[
              new THREE.Vector3(x - 0.5, m.y, -0.5),
              new THREE.Vector3(x + 0.5, m.y, -0.5),
            ]}
            color="#D32F2F"
            lineWidth={1.5}
          />
          {/* Seviye etiketi */}
          <Text
            position={[x - 0.8, m.y, -0.5]}
            fontSize={0.18}
            color="#D32F2F"
            anchorX="right"
            anchorY="middle"
            font={undefined}
          >
            {m.label}
          </Text>
          {/* Dikey bağlantı çizgisi */}
          {i < markers.length - 1 && (
            <Line
              points={[
                new THREE.Vector3(x, m.y, -0.5),
                new THREE.Vector3(x, markers[i + 1].y, -0.5),
              ]}
              color="#D32F2F"
              lineWidth={1}
              dashed
              dashSize={0.15}
              gapSize={0.10}
            />
          )}
        </group>
      ))}
    </group>
  )
}

// ── Axis Grid Lines — yapısal aks çizgileri (kesikli) ──

interface AxisGridProps {
  columns: ColumnData[]
  building: BuildingInfo
  viewMode: ViewMode
  visible: boolean
}

export function AxisGridLines({ columns, building, viewMode, visible }: AxisGridProps) {
  if (!visible || viewMode === 'wireframe') return null

  // X yönü akslar (aynı x'teki kolonları grupla)
  const xValues = useMemo(() => {
    const set = new Set<number>()
    for (const col of columns) set.add(Number(col.x.toFixed(1)))
    return Array.from(set).sort((a, b) => a - b)
  }, [columns])

  // Z yönü akslar
  const zValues = useMemo(() => {
    const set = new Set<number>()
    for (const col of columns) set.add(Number(col.z.toFixed(1)))
    return Array.from(set).sort((a, b) => a - b)
  }, [columns])

  const ext = 2.0 // aks çizgisi uzatma

  return (
    <group>
      {/* X aksları (A, B, C...) */}
      {xValues.map((x, i) => (
        <group key={`ax-${i}`}>
          <Line
            points={[
              new THREE.Vector3(x, 0.01, -ext),
              new THREE.Vector3(x, 0.01, building.depth + ext),
            ]}
            color="#E53935"
            lineWidth={0.8}
            dashed
            dashSize={0.3}
            gapSize={0.2}
          />
          {/* Aks dairesi + etiket — alt */}
          <mesh position={[x, 0.02, -ext - 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.30, 24]} />
            <meshBasicMaterial color="#E53935" side={THREE.DoubleSide} />
          </mesh>
          <Text position={[x, 0.03, -ext - 0.6]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.22} color="#E53935"
            anchorX="center" anchorY="middle" font={undefined}>
            {String.fromCharCode(65 + i)}
          </Text>
        </group>
      ))}

      {/* Z aksları (1, 2, 3...) */}
      {zValues.map((z, i) => (
        <group key={`az-${i}`}>
          <Line
            points={[
              new THREE.Vector3(-ext, 0.01, z),
              new THREE.Vector3(building.width + ext, 0.01, z),
            ]}
            color="#E53935"
            lineWidth={0.8}
            dashed
            dashSize={0.3}
            gapSize={0.2}
          />
          {/* Aks dairesi + etiket — sol */}
          <mesh position={[-ext - 0.6, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.30, 24]} />
            <meshBasicMaterial color="#E53935" side={THREE.DoubleSide} />
          </mesh>
          <Text position={[-ext - 0.6, 0.03, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.22} color="#E53935"
            anchorX="center" anchorY="middle" font={undefined}>
            {String(i + 1)}
          </Text>
        </group>
      ))}
    </group>
  )
}

// ── Building Overall Dimensions — bina toplam ölçüler ──

export function BuildingDimensions({ building, viewMode }: { building: BuildingInfo; viewMode: ViewMode }) {
  if (viewMode === 'wireframe') return null

  const w = building.width
  const d = building.depth
  const h = building.total_height
  const ext = 3.5

  return (
    <group>
      {/* Genişlik (x) */}
      <Line points={[
        new THREE.Vector3(0, 0.02, -ext),
        new THREE.Vector3(w, 0.02, -ext),
      ]} color="#333" lineWidth={1.5} />
      <Line points={[
        new THREE.Vector3(0, 0.02, -ext + 0.3), new THREE.Vector3(0, 0.02, -ext - 0.3),
      ]} color="#333" lineWidth={1} />
      <Line points={[
        new THREE.Vector3(w, 0.02, -ext + 0.3), new THREE.Vector3(w, 0.02, -ext - 0.3),
      ]} color="#333" lineWidth={1} />
      <Text position={[w / 2, 0.05, -ext - 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.20} color="#333" anchorX="center" anchorY="middle" font={undefined}>
        {w.toFixed(2)} m
      </Text>

      {/* Derinlik (z) */}
      <Line points={[
        new THREE.Vector3(-ext, 0.02, 0),
        new THREE.Vector3(-ext, 0.02, d),
      ]} color="#333" lineWidth={1.5} />
      <Line points={[
        new THREE.Vector3(-ext + 0.3, 0.02, 0), new THREE.Vector3(-ext - 0.3, 0.02, 0),
      ]} color="#333" lineWidth={1} />
      <Line points={[
        new THREE.Vector3(-ext + 0.3, 0.02, d), new THREE.Vector3(-ext - 0.3, 0.02, d),
      ]} color="#333" lineWidth={1} />
      <Text position={[-ext - 0.4, 0.05, d / 2]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        fontSize={0.20} color="#333" anchorX="center" anchorY="middle" font={undefined}>
        {d.toFixed(2)} m
      </Text>

      {/* Yükseklik (y) — sağ cephe */}
      <Line points={[
        new THREE.Vector3(w + ext, 0, d / 2),
        new THREE.Vector3(w + ext, h, d / 2),
      ]} color="#333" lineWidth={1.5} />
      <Line points={[
        new THREE.Vector3(w + ext - 0.3, 0, d / 2), new THREE.Vector3(w + ext + 0.3, 0, d / 2),
      ]} color="#333" lineWidth={1} />
      <Line points={[
        new THREE.Vector3(w + ext - 0.3, h, d / 2), new THREE.Vector3(w + ext + 0.3, h, d / 2),
      ]} color="#333" lineWidth={1} />
      <Text position={[w + ext + 0.4, h / 2, d / 2]}
        fontSize={0.20} color="#333" anchorX="left" anchorY="middle" font={undefined}>
        {h.toFixed(2)} m
      </Text>
    </group>
  )
}
