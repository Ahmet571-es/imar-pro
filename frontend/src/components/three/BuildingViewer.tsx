/**
 * imarPRO — BuildingViewer.tsx (Complete Rewrite)
 * Seviye 3 BIM Viewer: 3D/4D/5D, 6 görünüm modu,
 * PBR materyaller, post-processing, kamera preset,
 * interaktivite, export.
 */

import React, { useRef, useState, useMemo, useCallback, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import type {
  Floor3D, Room3D, ColumnData, BuildingInfo, ViewMode,
  CameraPreset, Vec3, CostElementData,
} from './types3d'
import {
  CONSTRUCTION_PHASES, COST_CATEGORIES,
} from './types3d'

import {
  Wall, WindowMesh, DoorMesh, FloorSlab, Column, Beam,
  Roof, Foundation, EntranceSteps, SectionPlane,
  Staircase, BalconyRailing,
  get4DOpacity, getCostHeatmapColor,
} from './BuildingGeometry'

import { usePBRMaterials } from './PBRMaterials'
import { EnvironmentScene } from './Environment3D'
import { CameraController, generateCameraPresets } from './CameraSystem'
import { PostProcessingEffects } from './PostProcessing3D'
import { ExportActions, type ExportActionsRef } from './ExportTools'
import { RoomTooltip, InteractiveRoom, MeasurementLine, RoomDetailPanel, type RoomDetailData } from './RoomInteraction'
import { RoomFurniture } from './FurniturePlaceholders'
import { RoomLabel, FloorLevelMarkers, AxisGridLines, BuildingDimensions } from './Annotations3D'
import type { MaterialDef } from './types3d'

// ── View Mode Buttons ──
const VIEW_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'solid', label: 'Solid', icon: '🧊' },
  { id: 'xray', label: 'X-Ray', icon: '🔍' },
  { id: 'wireframe', label: 'Wireframe', icon: '🔲' },
  { id: 'section', label: 'Kesit', icon: '✂️' },
  { id: 'exploded', label: 'Patlatılmış', icon: '💥' },
  { id: 'thermal', label: 'Termal', icon: '🌡️' },
]

// ── Building Scene (inside Canvas) ──

interface SceneProps {
  floors: Floor3D[]
  columns: ColumnData[]
  building: BuildingInfo
  viewMode: ViewMode
  selectedFloor: number
  sectionHeight: number
  sectionVerticalPos: number
  sunHour: number
  exploded: boolean
  showColumns: boolean
  showPostProcessing: boolean
  showFurniture: boolean
  showAnnotations: boolean
  showAxisGrid: boolean
  constructionMonth: number
  show4D: boolean
  showCostHeatmap: boolean
  totalCost: number
  hoveredRoom: string | null
  selectedRoom: string | null
  measureMode: boolean
  measurePoints: Vec3[]
  onHoverRoom: (name: string | null) => void
  onClickRoom: (room: Room3D) => void
  onDoubleClickRoom: (room: Room3D) => void
  onMeasureClick: (point: Vec3) => void
  targetPreset: CameraPreset | null
  flyToTarget: { position: Vec3; dimensions: { width: number; height: number; depth: number } } | null
  onFlyToComplete: () => void
  exportRef: React.RefObject<ExportActionsRef | null>
  // ── D+F derinleştirme ──
  visibleDisciplines: Set<string>
  showShadowAnalysis: boolean
  windDirection: number  // derece (0=kuzey, 90=doğu, 180=güney, 270=batı)
}

function BuildingScene({
  floors, columns, building, viewMode,
  selectedFloor, sectionHeight, sectionVerticalPos, sunHour,
  exploded, showColumns, showPostProcessing,
  showFurniture, showAnnotations, showAxisGrid,
  constructionMonth, show4D,
  showCostHeatmap, totalCost,
  hoveredRoom, selectedRoom, measureMode, measurePoints,
  onHoverRoom, onClickRoom, onDoubleClickRoom, onMeasureClick,
  targetPreset, flyToTarget, onFlyToComplete,
  exportRef,
  visibleDisciplines, showShadowAnalysis, windDirection,
}: SceneProps) {
  const materials = usePBRMaterials()
  const explodeOffset = exploded ? 2.0 : 0
  const costPerFloor = totalCost > 0 ? totalCost / building.floor_count : 0

  const maxElementCost = useMemo(() => {
    if (!showCostHeatmap || totalCost <= 0) return 1
    return costPerFloor * 0.5
  }, [showCostHeatmap, totalCost, costPerFloor])

  return (
    <>
      <EnvironmentScene building={building} sunHour={sunHour} viewMode={viewMode} />

      <CameraController
        building={building}
        targetPreset={targetPreset}
        flyToTarget={flyToTarget}
        onFlyToComplete={onFlyToComplete}
        enabled={!measureMode}
      />

      <PostProcessingEffects enabled={showPostProcessing && viewMode === 'solid'} />

      <ExportActions ref={exportRef} />

      <Foundation building={building} viewMode={viewMode} />
      <EntranceSteps building={building} viewMode={viewMode} />

      {/* Floors */}
      {floors.map((floor) => {
        const visible = selectedFloor === -1 || selectedFloor === floor.floor_index
        const belowSection = viewMode !== 'section' || floor.floor_y < sectionHeight
        if (!visible || !belowSection) return null

        const yOffset = exploded ? floor.floor_index * explodeOffset : 0
        const opacity = selectedFloor === -1 ? 1 : (floor.floor_index === selectedFloor ? 1 : 0.12)

        const floorBuilt4D = !show4D || constructionMonth >= (2 + floor.floor_index * 1.5)
        const slab4DOpacity = show4D ? get4DOpacity('slab', floor.floor_index, building.floor_count, constructionMonth) : { opacity: 1 }

        const slabCost = costPerFloor * (COST_CATEGORIES.betonarme.percent * 0.6)
        const slabHeatmapColor = showCostHeatmap ? getCostHeatmapColor(slabCost, maxElementCost) : undefined

        return (
          <group key={floor.floor_index} position={[0, yOffset, 0]}>
            {floorBuilt4D && (
              <FloorSlab
                y={floor.slab.y}
                width={floor.slab.width}
                depth={floor.slab.depth}
                thickness={floor.slab.thickness}
                viewMode={viewMode}
                material={materials.slab}
                isGround={floor.is_ground}
                costHeatmapColor={show4D ? slab4DOpacity.color : slabHeatmapColor}
              />
            )}

            {floor.rooms.map((room, ri) => {
              const wallsBuilt = !show4D || constructionMonth >= 8
              const windowsBuilt = !show4D || constructionMonth >= 10
              const doorsBuilt = !show4D || constructionMonth >= 13

              const wallMaterial = room.is_exterior ? materials.exteriorWall : materials.interiorWall
              const isHovered = hoveredRoom === room.name
              const isSelected = selectedRoom === room.name

              const wallCost = costPerFloor * (room.is_exterior ? COST_CATEGORIES.dis_cephe.percent * 0.5 : COST_CATEGORIES.ince_insaat.percent * 0.15)
              const wallHeatmapColor = showCostHeatmap ? getCostHeatmapColor(wallCost, maxElementCost) : undefined

              const wall4D = show4D ? get4DOpacity(room.is_exterior ? 'walls_exterior' : 'walls_interior', floor.floor_index, building.floor_count, constructionMonth) : { opacity: 1 }

              const getWindowsForWall = (wallSide: string) =>
                room.windows.filter(w => w.facing === wallSide || (wallSide === 'south' && !w.facing))
              const getDoorsForWall = (wallSide: string) =>
                room.door && wallSide === 'south' ? [room.door] : []

              return (
                <group key={ri}>
                  <InteractiveRoom
                    room={room}
                    floorY={floor.floor_y}
                    isHovered={isHovered}
                    isSelected={isSelected}
                    viewMode={viewMode}
                    measureMode={measureMode}
                    onHover={(name) => onHoverRoom(name)}
                    onUnhover={() => onHoverRoom(null)}
                    onClick={() => onClickRoom(room)}
                    onDoubleClick={() => onDoubleClickRoom(room)}
                    onMeasureClick={onMeasureClick}
                  />

                  {wallsBuilt && room.walls.map((wall, wi) => (
                    <Wall
                      key={`wall-${wi}`}
                      wall={wall}
                      windows={windowsBuilt ? getWindowsForWall(wall.side) : []}
                      doors={doorsBuilt ? getDoorsForWall(wall.side) : []}
                      floorY={floor.floor_y}
                      material={wallMaterial}
                      viewMode={viewMode}
                      opacity={show4D ? wall4D.opacity : opacity}
                      costHeatmapColor={show4D ? wall4D.color : wallHeatmapColor}
                    />
                  ))}

                  {windowsBuilt && room.windows.map((win, wi) => (
                    <WindowMesh
                      key={`win-${wi}`}
                      win={win}
                      glassMat={materials.glass}
                      frameMat={materials.windowFrame}
                      viewMode={viewMode}
                    />
                  ))}

                  {doorsBuilt && room.door && (
                    <DoorMesh
                      door={room.door}
                      material={materials.door}
                      viewMode={viewMode}
                    />
                  )}

                  {isHovered && (
                    <RoomTooltip
                      room={room}
                      showCost={showCostHeatmap}
                      costData={showCostHeatmap ? {
                        id: room.name,
                        elementType: 'room_finish',
                        name: room.name,
                        description: '',
                        cost: wallCost + slabCost / floor.rooms.length,
                        costCategory: 'İnce İnşaat',
                        costPercent: 0,
                      } : undefined}
                    />
                  )}

                  {/* Mobilya placeholder */}
                  {showFurniture && doorsBuilt && (
                    <RoomFurniture room={room} floorY={floor.floor_y} viewMode={viewMode} />
                  )}

                  {/* Oda etiketi + boyut çizgileri */}
                  {showAnnotations && (
                    <RoomLabel room={room} floorY={floor.floor_y} viewMode={viewMode} showDimensions={selectedFloor === floor.floor_index} />
                  )}
                </group>
              )
            })}

            {floor.is_top && floorBuilt4D && (
              <FloorSlab
                y={floor.floor_y + building.floor_height}
                width={floor.slab.width}
                depth={floor.slab.depth}
                thickness={floor.slab.thickness}
                viewMode={viewMode}
                material={materials.slab}
              />
            )}
          </group>
        )
      })}

      {showColumns && visibleDisciplines.has('struktur') && columns.map((col) => (
        <Column
          key={col.id}
          col={col}
          viewMode={viewMode}
          opacity={viewMode === 'xray' ? 0.4 : 0.8}
          showLabels={showColumns}
        />
      ))}

      {/* Beams — kolon arası kirişler (her kat seviyesinde) */}
      {showColumns && visibleDisciplines.has('struktur') && viewMode !== 'wireframe' && columns.length > 1 && floors.map((floor) => {
        const beamY = floor.floor_y + building.floor_height
        const beams: React.JSX.Element[] = []
        // Yatay kirişler (x yönü) — aynı z'deki kolonlar arası
        const zGroups: Record<string, typeof columns> = {}
        for (const col of columns) {
          const key = col.z.toFixed(1)
          if (!zGroups[key]) zGroups[key] = []
          zGroups[key].push(col)
        }
        for (const group of Object.values(zGroups)) {
          const sorted = [...group].sort((a, b) => a.x - b.x)
          for (let i = 0; i < sorted.length - 1; i++) {
            beams.push(
              <Beam key={`bx-${floor.floor_index}-${i}-${sorted[i].z}`}
                from={{ x: sorted[i].x, z: sorted[i].z }}
                to={{ x: sorted[i + 1].x, z: sorted[i + 1].z }}
                y={beamY} width={0.25} height={0.45} viewMode={viewMode} />,
            )
          }
        }
        // Dikey kirişler (z yönü)
        const xGroups: Record<string, typeof columns> = {}
        for (const col of columns) {
          const key = col.x.toFixed(1)
          if (!xGroups[key]) xGroups[key] = []
          xGroups[key].push(col)
        }
        for (const group of Object.values(xGroups)) {
          const sorted = [...group].sort((a, b) => a.z - b.z)
          for (let i = 0; i < sorted.length - 1; i++) {
            beams.push(
              <Beam key={`bz-${floor.floor_index}-${i}-${sorted[i].x}`}
                from={{ x: sorted[i].x, z: sorted[i].z }}
                to={{ x: sorted[i + 1].x, z: sorted[i + 1].z }}
                y={beamY} width={0.25} height={0.45} viewMode={viewMode} />,
            )
          }
        }
        return <group key={`beams-${floor.floor_index}`}>{beams}</group>
      })}

      {/* Staircase — merdiven kovası (bina sağ arka köşe) */}
      {viewMode !== 'wireframe' && (!show4D || constructionMonth >= 4) && (
        <Staircase
          position={[building.width - 3.2, 0, building.depth - 4.5]}
          floorHeight={building.floor_height}
          width={2.8}
          depth={4.0}
          viewMode={viewMode}
        />
      )}

      {/* Balcony railings — plan verisinden balkon odalarına korkuluk */}
      {viewMode !== 'wireframe' && floors.map((floor) =>
        floor.rooms
          .filter(r => r.type === 'balkon')
          .map((balkon, bi) => (
            <BalconyRailing
              key={`balcony-${floor.floor_index}-${bi}`}
              x={balkon.position.x}
              y={floor.floor_y + 0.05}
              z={balkon.position.z}
              width={balkon.dimensions.width}
              depth={balkon.dimensions.depth}
              viewMode={viewMode}
            />
          )),
      )}

      <Roof
        building={building}
        roofType="flat"
        viewMode={viewMode}
        visible={selectedFloor === -1 && (!show4D || constructionMonth >= 8)}
        material={materials.slab}
      />

      {viewMode === 'section' && (
        <>
          <SectionPlane
            position={[building.width / 2, sectionHeight, building.depth / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={building.width}
            depth={building.depth}
            visible={true}
          />
          <SectionPlane
            position={[sectionVerticalPos, building.total_height / 2, building.depth / 2]}
            rotation={[0, Math.PI / 2, 0]}
            width={building.total_height}
            depth={building.depth}
            visible={sectionVerticalPos > 0}
          />
        </>
      )}

      {/* Annotations */}
      {showAnnotations && (
        <>
          <FloorLevelMarkers building={building} viewMode={viewMode} />
          <BuildingDimensions building={building} viewMode={viewMode} />
        </>
      )}

      {/* Aks grid çizgileri */}
      <AxisGridLines columns={columns} building={building} viewMode={viewMode} visible={showAxisGrid} />

      <MeasurementLine points={measurePoints} active={measureMode} />

      {/* ── F5. Rüzgar Yönü Gösterimi ── */}
      <WindDirectionArrow
        building={building}
        windDirection={windDirection}
        visible={showAnnotations || viewMode === 'thermal'}
      />

      {/* ── F1. Gölge Analizi Zemini ── */}
      {showShadowAnalysis && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[building.width / 2, -0.02, building.depth / 2]}
          receiveShadow
        >
          <planeGeometry args={[building.width * 3, building.depth * 3]} />
          <shadowMaterial opacity={0.35} />
        </mesh>
      )}
    </>
  )
}

// ── F5. Rüzgar Yönü Oku ──
function WindDirectionArrow({ building, windDirection, visible }: {
  building: BuildingInfo; windDirection: number; visible: boolean
}) {
  if (!visible) return null

  const rad = (windDirection * Math.PI) / 180
  const r = Math.max(building.width, building.depth) * 0.7
  const cx = building.width / 2
  const cz = building.depth / 2
  const ax = cx + Math.sin(rad) * r
  const az = cz - Math.cos(rad) * r
  const h = building.total_height + 2

  const WIND_LABELS: Record<number, string> = {
    0: 'K', 45: 'KD', 90: 'D', 135: 'GD', 180: 'G', 225: 'GB', 270: 'B', 315: 'KB',
  }
  const closest = [0, 45, 90, 135, 180, 225, 270, 315].reduce(
    (prev, curr) => Math.abs(curr - windDirection) < Math.abs(prev - windDirection) ? curr : prev
  )
  const label = WIND_LABELS[closest] || ''

  return (
    <group>
      {/* Ok gövdesi — ince kutu */}
      <mesh position={[(ax + cx) / 2, h, (az + cz) / 2]}
        rotation={[0, -rad, 0]}>
        <boxGeometry args={[0.08, 0.08, r]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>

      {/* Ok ucu — koni */}
      <mesh position={[cx, h, cz]}
        rotation={[0, -rad, 0]}>
        <coneGeometry args={[0.3, 0.8, 8]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>

      {/* Başlangıç noktası */}
      <mesh position={[ax, h + 0.5, az]}>
        <sphereGeometry args={[0.25]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

// ── Main Viewer Props ──

export interface BuildingViewerProps {
  floors: Floor3D[]
  columns: ColumnData[]
  building: BuildingInfo
  materials: Record<string, MaterialDef>
  totalCost?: number
  cashFlowData?: { ay: number; kumulatif: number }[]
  visibleDisciplines?: Set<string>
}

// ── Main Component ──

export function BuildingViewer({ floors, columns, building, totalCost = 0, visibleDisciplines: extDisciplines }: BuildingViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('solid')
  const [selectedFloor, setSelectedFloor] = useState(-1)
  const [showColumns, setShowColumns] = useState(false)
  const [showPostProcessing, setShowPostProcessing] = useState(true)
  const [showFurniture, setShowFurniture] = useState(true)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [showAxisGrid, setShowAxisGrid] = useState(false)
  const [sectionHeight, setSectionHeight] = useState(building.total_height / 2)
  const [sectionVerticalPos, setSectionVerticalPos] = useState(0)
  const [sunHour, setSunHour] = useState(14)

  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedRoomData, setSelectedRoomData] = useState<RoomDetailData | null>(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<Vec3[]>([])

  const [targetPreset, setTargetPreset] = useState<CameraPreset | null>(null)
  const [flyToTarget, setFlyToTarget] = useState<{ position: Vec3; dimensions: { width: number; height: number; depth: number } } | null>(null)
  const cameraPresets = useMemo(() => generateCameraPresets(building), [building])

  const [constructionMonth, setConstructionMonth] = useState(18)
  const [show4D, setShow4D] = useState(false)
  const [is4DPlaying, setIs4DPlaying] = useState(false)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [showCostHeatmap, setShowCostHeatmap] = useState(false)

  // ── D+F Derinleştirme ──
  const [visibleDisciplines, setVisibleDisciplines] = useState<Set<string>>(
    extDisciplines || new Set(['mimari', 'struktur'])
  )
  const [showShadowAnalysis, setShowShadowAnalysis] = useState(false)
  const [windDirection, setWindDirection] = useState(225)
  const [walkMode, setWalkMode] = useState(false)

  // Sync external discipline visibility
  useEffect(() => {
    if (extDisciplines) setVisibleDisciplines(extDisciplines)
  }, [extDisciplines])

  const exportRef = useRef<ExportActionsRef>(null)

  const currentCostDisplay = useMemo(() => {
    if (!show4D || totalCost <= 0) return totalCost
    const phase = CONSTRUCTION_PHASES.find(p => constructionMonth >= p.startMonth && constructionMonth <= p.endMonth)
    return phase ? totalCost * phase.cumulativeCostPercent : totalCost
  }, [show4D, constructionMonth, totalCost])

  const currentCostPercent = useMemo(() => {
    if (!show4D || totalCost <= 0) return 100
    const phase = CONSTRUCTION_PHASES.find(p => constructionMonth >= p.startMonth && constructionMonth <= p.endMonth)
    return phase ? Math.round(phase.cumulativeCostPercent * 100) : 100
  }, [show4D, constructionMonth, totalCost])

  const toggle4DPlay = useCallback(() => {
    if (is4DPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
      setIs4DPlaying(false)
    } else {
      setConstructionMonth(1)
      setIs4DPlaying(true)
      playIntervalRef.current = setInterval(() => {
        setConstructionMonth(prev => {
          if (prev >= 18) {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current)
            setIs4DPlaying(false)
            return 18
          }
          return prev + 0.5
        })
      }, 800)
    }
  }, [is4DPlaying])

  useEffect(() => {
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current) }
  }, [])

  const handleClickRoom = useCallback((room: Room3D) => {
    setSelectedRoom(room.name)
    const cost = totalCost > 0 ? (totalCost / building.floor_count) * 0.1 : undefined
    setSelectedRoomData({
      name: room.name,
      type: room.type,
      area: room.dimensions.width * room.dimensions.depth,
      dimensions: room.dimensions,
      facing: room.facing,
      is_exterior: room.is_exterior,
      floor_index: room.floor_index,
      cost,
      costCategory: 'İnce İnşaat',
    })
  }, [totalCost, building.floor_count])

  const handleDoubleClickRoom = useCallback((room: Room3D) => {
    setFlyToTarget({ position: room.position, dimensions: room.dimensions })
  }, [])

  const handleMeasureClick = useCallback((point: Vec3) => {
    setMeasurePoints(prev => {
      if (prev.length >= 2) return [point]
      return [...prev, point]
    })
  }, [])

  const currentPhase = useMemo(() => {
    return CONSTRUCTION_PHASES.find(p => constructionMonth >= p.startMonth && constructionMonth <= p.endMonth)
  }, [constructionMonth])

  return (
    <div className="three-canvas-container relative w-full h-full min-h-[400px] sm:min-h-[500px] rounded-xl overflow-hidden bg-gradient-to-b from-sky-100 to-sky-50">
      <Canvas
        shadows
        camera={{
          position: [building.width * 1.5, building.total_height * 1.2, building.depth * 1.5],
          fov: 45, near: 0.1, far: 500,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          preserveDrawingBuffer: true,
        }}
        onPointerMissed={() => {
          if (!measureMode) { setSelectedRoom(null); setSelectedRoomData(null) }
        }}
      >
        <Suspense fallback={null}>
          <BuildingScene
            floors={floors} columns={columns} building={building}
            viewMode={viewMode} selectedFloor={selectedFloor}
            sectionHeight={sectionHeight} sectionVerticalPos={sectionVerticalPos}
            sunHour={sunHour} exploded={viewMode === 'exploded'}
            showColumns={showColumns} showPostProcessing={showPostProcessing}
            showFurniture={showFurniture} showAnnotations={showAnnotations} showAxisGrid={showAxisGrid}
            constructionMonth={constructionMonth} show4D={show4D}
            showCostHeatmap={showCostHeatmap} totalCost={totalCost}
            hoveredRoom={hoveredRoom} selectedRoom={selectedRoom}
            measureMode={measureMode} measurePoints={measurePoints}
            onHoverRoom={setHoveredRoom} onClickRoom={handleClickRoom}
            onDoubleClickRoom={handleDoubleClickRoom} onMeasureClick={handleMeasureClick}
            targetPreset={targetPreset} flyToTarget={flyToTarget}
            onFlyToComplete={() => setFlyToTarget(null)}
            exportRef={exportRef}
            visibleDisciplines={visibleDisciplines}
            showShadowAnalysis={showShadowAnalysis}
            windDirection={windDirection}
          />
        </Suspense>
      </Canvas>

      {/* Room Detail Panel */}
      {selectedRoomData && (
        <RoomDetailPanel
          room={selectedRoomData}
          onClose={() => { setSelectedRoom(null); setSelectedRoomData(null) }}
          onFlyTo={() => {
            const room = floors.flatMap(f => f.rooms).find(r => r.name === selectedRoomData.name)
            if (room) handleDoubleClickRoom(room)
          }}
        />
      )}

      {/* LEFT PANEL */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
        {/* Floor selector */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1.5">Kat</div>
          <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
            <button onClick={() => setSelectedFloor(-1)}
              className={`px-2 py-1 rounded-lg text-left transition-colors ${selectedFloor === -1 ? 'bg-primary text-white' : 'hover:bg-surface-alt'}`}>
              Tümü
            </button>
            {floors.map((f) => (
              <button key={f.floor_index} onClick={() => setSelectedFloor(f.floor_index)}
                className={`px-2 py-1 rounded-lg text-left transition-colors ${selectedFloor === f.floor_index ? 'bg-primary text-white' : 'hover:bg-surface-alt'}`}>
                {f.floor_index === 0 ? 'Zemin' : `Kat ${f.floor_index}`}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1.5">Görünüm</div>
          <div className="grid grid-cols-2 gap-1">
            {VIEW_MODES.map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                className={`px-2 py-1.5 rounded-lg text-left transition-colors flex items-center gap-1 ${viewMode === m.id ? 'bg-primary text-white' : 'hover:bg-surface-alt'}`}>
                <span className="text-[10px]">{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 max-h-[calc(100%-80px)] overflow-y-auto">
        {/* Camera presets */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1.5">Kamera</div>
          <div className="flex flex-col gap-0.5">
            {cameraPresets.map(p => (
              <button key={p.id} onClick={() => setTargetPreset(p)}
                className="px-2 py-1 rounded-lg text-left hover:bg-surface-alt transition-colors flex items-center gap-1">
                <span className="text-[10px]">{p.icon}</span> {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs space-y-1.5">
          <div className="font-semibold text-text">Araçlar</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showColumns} onChange={(e) => setShowColumns(e.target.checked)} className="rounded" />
            Kolon Grid
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAxisGrid} onChange={(e) => setShowAxisGrid(e.target.checked)} className="rounded" />
            Aks Çizgileri
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showFurniture} onChange={(e) => setShowFurniture(e.target.checked)} className="rounded" />
            🛋️ Mobilya
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAnnotations} onChange={(e) => setShowAnnotations(e.target.checked)} className="rounded" />
            📐 Ölçüler
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showPostProcessing} onChange={(e) => setShowPostProcessing(e.target.checked)} className="rounded" />
            Post-FX
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={measureMode}
              onChange={(e) => { setMeasureMode(e.target.checked); if (!e.target.checked) setMeasurePoints([]) }}
              className="rounded" />
            📏 Ölçüm
          </label>
        </div>

        {/* Sun + Shadow */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1">☀️ Güneş {sunHour}:00</div>
          <input type="range" min={6} max={20} step={1} value={sunHour}
            onChange={(e) => setSunHour(Number(e.target.value))}
            className="w-full accent-amber-500" />
          <label className="flex items-center gap-2 cursor-pointer mt-1.5">
            <input type="checkbox" checked={showShadowAnalysis}
              onChange={(e) => setShowShadowAnalysis(e.target.checked)} className="rounded" />
            🌤️ Gölge Analizi
          </label>
        </div>

        {/* Rüzgar */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
          <div className="font-semibold text-text mb-1">🌬️ Rüzgar {windDirection}°</div>
          <input type="range" min={0} max={359} step={15} value={windDirection}
            onChange={(e) => setWindDirection(Number(e.target.value))}
            className="w-full accent-sky-500" />
          <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
            <span>K</span><span>D</span><span>G</span><span>B</span><span>K</span>
          </div>
        </div>

        {/* Section controls */}
        {viewMode === 'section' && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs">
            <div className="font-semibold text-text mb-1">Yatay Kesit</div>
            <input type="range" min={0} max={building.total_height}
              step={0.25} value={sectionHeight}
              onChange={(e) => setSectionHeight(Number(e.target.value))}
              className="w-full accent-red-500" />
            <div className="font-semibold text-text mb-1 mt-2">Dikey Kesit</div>
            <input type="range" min={0} max={building.width}
              step={0.25} value={sectionVerticalPos}
              onChange={(e) => setSectionVerticalPos(Number(e.target.value))}
              className="w-full accent-red-500" />
          </div>
        )}

        {/* Export */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 text-xs space-y-1">
          <div className="font-semibold text-text">Dışa Aktar</div>
          <button onClick={() => exportRef.current?.screenshot(2)}
            className="w-full px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-left">
            📸 PNG (2×)
          </button>
          <button onClick={() => exportRef.current?.screenshot(4)}
            className="w-full px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-left">
            📸 PNG (4×)
          </button>
          <button onClick={() => exportRef.current?.exportGLTF()}
            className="w-full px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-left">
            📦 GLTF (.glb)
          </button>
        </div>
      </div>

      {/* 4D TIMELINE */}
      {show4D && (
        <div className="absolute bottom-14 left-3 right-3 z-10">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-border/50 p-3">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={toggle4DPlay}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${is4DPlaying ? 'bg-red-500 text-white' : 'bg-primary text-white'}`}>
                {is4DPlaying ? '⏸ Durdur' : '▶️ Oynat'}
              </button>
              <div className="text-xs font-semibold text-text">
                Ay {Math.round(constructionMonth)} / 18
              </div>
              {currentPhase && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: currentPhase.color }} />
                  <span className="text-xs text-text-muted">{currentPhase.name}</span>
                </div>
              )}
              <div className="flex-1" />
              {totalCost > 0 && (
                <div className="text-xs font-bold text-emerald-700">
                  ₺{(currentCostDisplay / 1_000_000).toFixed(1)}M ({currentCostPercent}%)
                </div>
              )}
            </div>
            <input type="range" min={1} max={18} step={0.5} value={constructionMonth}
              onChange={(e) => setConstructionMonth(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex flex-wrap gap-2 mt-2">
              {CONSTRUCTION_PHASES.map(p => (
                <div key={p.id} className="flex items-center gap-1 text-[10px] text-text-muted">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2">
        <div className="bg-white/85 backdrop-blur-sm rounded-xl px-3 py-1.5 text-[10px] text-text-muted">
          {building.floor_count} Kat · {building.width.toFixed(0)}×{building.depth.toFixed(0)}m · {building.total_height.toFixed(1)}m
        </div>
        <div className="flex-1" />
        <button onClick={() => setShow4D(!show4D)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm ${show4D ? 'bg-primary text-white' : 'bg-white/85 backdrop-blur-sm text-text-muted hover:text-text'}`}>
          ⏱️ 4D İnşaat
        </button>
        <button onClick={() => setShowCostHeatmap(!showCostHeatmap)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm ${showCostHeatmap ? 'bg-emerald-600 text-white' : 'bg-white/85 backdrop-blur-sm text-text-muted hover:text-text'}`}>
          💰 5D Maliyet
        </button>
        <button onClick={() => {
          setWalkMode(!walkMode)
          if (!walkMode) {
            // Walk-through: zemin kat iç mekan kamerası
            setTargetPreset({
              id: 'walkthrough',
              name: 'Walk-through',
              position: [building.width / 2, 1.7, building.depth / 2],
              target: [building.width / 2 + 2, 1.7, building.depth / 2],
              fov: 75,
              icon: '🚶',
            })
          }
        }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm ${walkMode ? 'bg-blue-600 text-white' : 'bg-white/85 backdrop-blur-sm text-text-muted hover:text-text'}`}>
          🚶 Walk-through
        </button>
        {(showCostHeatmap || show4D) && totalCost > 0 && (
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg px-3 py-1.5 text-xs font-bold text-emerald-700">
            Toplam: ₺{(totalCost / 1_000_000).toFixed(1)}M
          </div>
        )}
      </div>

      {measureMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
            📏 Ölçüm Modu — İki nokta tıklayın
          </div>
        </div>
      )}
    </div>
  )
}
