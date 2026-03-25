import { useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

// ── Types ──
interface Vec3 { x: number; y: number; z: number }
interface Size2 { width: number; height: number }
interface Size3 { width: number; height: number; depth: number }

interface RoomData {
  name: string
  type: string
  position: Vec3
  dimensions: Size3
  is_exterior: boolean
  facing: string
  walls: { side: string; center: Vec3; size: Size3; is_exterior: boolean }[]
  windows: { center: Vec3; size: Size2; facing: string }[]
  door: { center: Vec3; size: Size2 } | null
}

interface FloorData {
  floor_index: number
  floor_y: number
  rooms: RoomData[]
  slab: { y: number; thickness: number; width: number; depth: number }
}

interface ColumnData {
  id: number; x: number; z: number; size: number; height: number; label: string
}

interface BuildingInfo {
  total_height: number; width: number; depth: number
  floor_height: number; floor_count: number
}

interface MaterialDef {
  color: string; roughness?: number; opacity?: number; name: string
}

interface BuildingViewerProps {
  floors: FloorData[]
  columns: ColumnData[]
  building: BuildingInfo
  materials: Record<string, MaterialDef>
}

// ── Room Colors ──
const ROOM_FLOOR_COLORS: Record<string, string> = {
  salon: '#E3F2FD', yatak_odasi: '#F3E5F5', mutfak: '#FFF3E0',
  banyo: '#E0F2F1', wc: '#E0F2F1', antre: '#FFF8E1',
  koridor: '#ECEFF1', balkon: '#C8E6C9',
}

// ── Sun Position ──
function getSunPosition(hour: number, lat: number = 39.9): [number, number, number] {
  const dayAngle = ((hour - 6) / 12) * Math.PI
  const altitude = Math.sin(dayAngle) * (90 - Math.abs(lat - 23.5)) * (Math.PI / 180)
  const azimuth = dayAngle - Math.PI / 2
  const r = 50
  return [
    r * Math.cos(altitude) * Math.sin(azimuth),
    r * Math.sin(altitude) + 10,
    r * Math.cos(altitude) * Math.cos(azimuth),
  ]
}

// ── Room Box ──
function RoomBox({ room, floorY, opacity, xray, onHover, onUnhover }: {
  room: RoomData; floorY: number; opacity: number
  xray: boolean; onHover: (name: string) => void; onUnhover: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const floorColor = ROOM_FLOOR_COLORS[room.type] || '#F5F5F5'

  const handlePointerOver = useCallback(() => {
    setHovered(true)
    onHover(room.name)
  }, [room.name, onHover])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
    onUnhover()
  }, [onUnhover])

  return (
    <group>
      {/* Floor slab per room */}
      <mesh position={[room.position.x, floorY + 0.01, room.position.z]}
        onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <boxGeometry args={[room.dimensions.width, 0.02, room.dimensions.depth]} />
        <meshStandardMaterial color={hovered ? '#90CAF9' : floorColor} roughness={0.6} />
      </mesh>

      {/* Walls */}
      {room.walls.map((wall, wi) => (
        <mesh key={wi} position={[wall.center.x, wall.center.y, wall.center.z]}>
          <boxGeometry args={[wall.size.width, wall.size.height, wall.size.depth]} />
          <meshStandardMaterial
            color={wall.is_exterior ? '#E8E0D4' : '#F5F0EB'}
            roughness={0.85}
            transparent={xray || opacity < 1}
            opacity={xray ? 0.15 : opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Windows */}
      {room.windows.map((win, wi) => {
        const isNS = win.facing === 'north' || win.facing === 'south'
        return (
          <group key={`win-${wi}`}>
            {/* Glass */}
            <mesh position={[win.center.x, win.center.y, win.center.z]}>
              <boxGeometry args={isNS
                ? [win.size.width, win.size.height, 0.02]
                : [0.02, win.size.height, win.size.width]
              } />
              <meshPhysicalMaterial
                color="#87CEEB" transparent opacity={0.3}
                roughness={0.05} metalness={0.1}
                transmission={0.6} thickness={0.01}
              />
            </mesh>
            {/* Frame */}
            <mesh position={[win.center.x, win.center.y, win.center.z]}>
              <boxGeometry args={isNS
                ? [win.size.width + 0.08, win.size.height + 0.08, 0.04]
                : [0.04, win.size.height + 0.08, win.size.width + 0.08]
              } />
              <meshStandardMaterial color="#555555" roughness={0.4} />
            </mesh>
          </group>
        )
      })}

      {/* Door */}
      {room.door && (
        <mesh position={[room.door.center.x, room.door.center.y, room.door.center.z]}>
          <boxGeometry args={[room.door.size.width, room.door.size.height, 0.06]} />
          <meshStandardMaterial color="#8B6914" roughness={0.6} />
        </mesh>
      )}

      {/* Room label (HTML overlay) */}
      {hovered && (
        <Html position={[room.position.x, room.position.y + room.dimensions.height / 2 + 0.5, room.position.z]}
          center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div className="bg-white/95 px-3 py-1.5 rounded-lg shadow-lg border text-xs whitespace-nowrap">
            <div className="font-bold text-primary">{room.name}</div>
            <div className="text-text-muted">
              {room.dimensions.width.toFixed(1)}×{room.dimensions.depth.toFixed(1)}m
              = {(room.dimensions.width * room.dimensions.depth).toFixed(1)}m²
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ── Floor Slab ──
function FloorSlab({ y, width, depth, thickness }: {
  y: number; width: number; depth: number; thickness: number
}) {
  return (
    <mesh position={[width / 2, y - thickness / 2, depth / 2]}>
      <boxGeometry args={[width + 0.5, thickness, depth + 0.5]} />
      <meshStandardMaterial color="#D4C9B8" roughness={0.7} />
    </mesh>
  )
}

// ── Column ──
function Column({ col, opacity }: { col: ColumnData; opacity: number }) {
  return (
    <mesh position={[col.x, col.height / 2, col.z]}>
      <boxGeometry args={[col.size, col.height, col.size]} />
      <meshStandardMaterial
        color="#B0B0B0" roughness={0.8}
        transparent={opacity < 1} opacity={opacity}
      />
    </mesh>
  )
}

// ── Sun Light ──
function SunLight({ hour }: { hour: number }) {
  const [x, y, z] = getSunPosition(hour)
  return (
    <directionalLight
      position={[x, y, z]}
      intensity={1.2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-far={100}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
    />
  )
}

// ── Section Cut Plane ──
function SectionPlane({ height, width, depth }: { height: number; width: number; depth: number }) {
  return (
    <mesh position={[width / 2, height, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width + 4, depth + 4]} />
      <meshBasicMaterial color="#dc2626" transparent opacity={0.08} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Main Scene ──
function Scene({ floors, columns, building, viewFloor, xray, showColumns, sectionHeight, sunHour, exploded }: {
  floors: FloorData[]
  columns: ColumnData[]
  building: BuildingInfo
  viewFloor: number // -1 = all
  xray: boolean
  showColumns: boolean
  sectionHeight: number | null
  sunHour: number
  exploded: boolean
}) {
  const [, setHoveredRoom] = useState<string | null>(null)

  const explodeOffset = exploded ? 1.5 : 0

  return (
    <>
      <ambientLight intensity={0.4} />
      <SunLight hour={sunHour} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[building.width / 2, -0.05, building.depth / 2]} receiveShadow>
        <planeGeometry args={[building.width + 20, building.depth + 20]} />
        <meshStandardMaterial color="#E8E5DE" roughness={1} />
      </mesh>

      {/* Floors */}
      {floors.map((floor) => {
        const visible = viewFloor === -1 || viewFloor === floor.floor_index
        const belowSection = sectionHeight === null || floor.floor_y < sectionHeight
        if (!visible || !belowSection) return null

        const yOffset = exploded ? floor.floor_index * explodeOffset : 0
        const opacity = viewFloor === -1 ? 1 : (floor.floor_index === viewFloor ? 1 : 0.15)

        return (
          <group key={floor.floor_index} position={[0, yOffset, 0]}>
            {/* Floor slab */}
            <FloorSlab
              y={floor.slab.y}
              width={floor.slab.width}
              depth={floor.slab.depth}
              thickness={floor.slab.thickness}
            />

            {/* Rooms */}
            {floor.rooms.map((room, ri) => (
              <RoomBox
                key={ri}
                room={room}
                floorY={floor.floor_y}
                opacity={opacity}
                xray={xray}
                onHover={setHoveredRoom}
                onUnhover={() => setHoveredRoom(null)}
              />
            ))}

            {/* Top slab for top floor */}
            {floor.floor_index === floors.length - 1 && (
              <FloorSlab
                y={floor.floor_y + building.floor_height}
                width={floor.slab.width}
                depth={floor.slab.depth}
                thickness={floor.slab.thickness}
              />
            )}
          </group>
        )
      })}

      {/* Columns */}
      {showColumns && columns.map((col) => (
        <Column key={col.id} col={col} opacity={xray ? 0.4 : 0.7} />
      ))}

      {/* Section cut plane */}
      {sectionHeight !== null && (
        <SectionPlane height={sectionHeight} width={building.width} depth={building.depth} />
      )}

      <ContactShadows position={[building.width / 2, 0, building.depth / 2]}
        opacity={0.3} scale={50} blur={2} far={20} />

      <OrbitControls
        target={[building.width / 2, building.total_height / 3, building.depth / 2]}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={5}
        maxDistance={80}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

// ── Main Component ──
export function BuildingViewer({ floors, columns, building, materials }: BuildingViewerProps) {
  const [viewFloor, setViewFloor] = useState(-1)
  const [xray, setXray] = useState(false)
  const [showColumns, setShowColumns] = useState(false)
  const [sectionCut, setSectionCut] = useState(false)
  const [sectionHeight, setSectionHeight] = useState(building.total_height / 2)
  const [sunHour, setSunHour] = useState(14)
  const [exploded, setExploded] = useState(false)

  return (
    <div className="relative w-full h-full min-h-[500px] bg-gradient-to-b from-sky-100 to-sky-50 rounded-xl overflow-hidden">
      <Canvas
        shadows
        camera={{
          position: [building.width * 1.5, building.total_height * 1.2, building.depth * 1.5],
          fov: 45,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <color attach="background" args={['#E8EFF5']} />
        <fog attach="fog" args={['#E8EFF5', 60, 120]} />

        <Scene
          floors={floors}
          columns={columns}
          building={building}
          viewFloor={viewFloor}
          xray={xray}
          showColumns={showColumns}
          sectionHeight={sectionCut ? sectionHeight : null}
          sunHour={sunHour}
          exploded={exploded}
        />
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        {/* Floor slider */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1.5">Kat Seçimi</div>
          <div className="flex flex-col gap-1">
            <button onClick={() => setViewFloor(-1)}
              className={`px-2 py-1 rounded text-left ${viewFloor === -1 ? 'bg-primary text-white' : 'hover:bg-surface-alt'}`}>
              Tümü
            </button>
            {floors.map((f) => (
              <button key={f.floor_index} onClick={() => setViewFloor(f.floor_index)}
                className={`px-2 py-1 rounded text-left ${viewFloor === f.floor_index ? 'bg-primary text-white' : 'hover:bg-surface-alt'}`}>
                {f.floor_index === 0 ? 'Zemin' : `Kat ${f.floor_index}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-xs space-y-2">
          <div className="font-semibold text-text">Görünüm</div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} className="rounded" />
            X-Ray
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={exploded} onChange={(e) => setExploded(e.target.checked)} className="rounded" />
            Exploded
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showColumns} onChange={(e) => setShowColumns(e.target.checked)} className="rounded" />
            Kolon Grid
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sectionCut} onChange={(e) => setSectionCut(e.target.checked)} className="rounded" />
            Kesit
          </label>

          {sectionCut && (
            <input type="range" min={0} max={building.total_height}
              step={0.5} value={sectionHeight}
              onChange={(e) => setSectionHeight(Number(e.target.value))}
              className="w-full" />
          )}
        </div>

        {/* Sun control */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1">
            Güneş: {sunHour}:00
          </div>
          <input type="range" min={6} max={20} step={1} value={sunHour}
            onChange={(e) => setSunHour(Number(e.target.value))}
            className="w-full" />
          <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
            <span>06:00</span>
            <span>20:00</span>
          </div>
        </div>
      </div>

      {/* Info badge */}
      <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[10px] text-text-muted">
        {building.floor_count} Kat · {building.width.toFixed(0)}×{building.depth.toFixed(0)}m · {building.total_height.toFixed(1)}m yükseklik
      </div>
    </div>
  )
}
