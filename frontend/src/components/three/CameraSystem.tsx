/**
 * imarPRO — CameraSystem.tsx
 * 6 kamera preset: kuş bakışı, 4 cephe (güney/kuzey/doğu/batı), iç mekan.
 * Animasyonlu geçiş (lerp), oda double-click fly-to.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { BuildingInfo, CameraPreset, Vec3 } from './types3d'

// ── Camera Preset Generator ──

export function generateCameraPresets(building: BuildingInfo): CameraPreset[] {
  const cx = building.width / 2
  const cy = building.total_height / 2
  const cz = building.depth / 2
  const dist = Math.max(building.width, building.depth) * 1.8
  const hdist = dist * 0.7

  return [
    {
      id: 'bird',
      name: 'Kuş Bakışı',
      icon: '🦅',
      position: [cx, building.total_height * 2.5, cz + 2],
      target: [cx, 0, cz],
      fov: 50,
    },
    {
      id: 'south',
      name: 'Güney Cephe',
      icon: '🏢',
      position: [cx, cy, -hdist],
      target: [cx, cy * 0.8, cz],
      fov: 40,
    },
    {
      id: 'north',
      name: 'Kuzey Cephe',
      icon: '🏢',
      position: [cx, cy, building.depth + hdist],
      target: [cx, cy * 0.8, cz],
      fov: 40,
    },
    {
      id: 'east',
      name: 'Doğu Cephe',
      icon: '🏢',
      position: [building.width + hdist, cy, cz],
      target: [cx, cy * 0.8, cz],
      fov: 40,
    },
    {
      id: 'west',
      name: 'Batı Cephe',
      icon: '🏢',
      position: [-hdist, cy, cz],
      target: [cx, cy * 0.8, cz],
      fov: 40,
    },
    {
      id: 'interior',
      name: 'İç Mekan',
      icon: '🏠',
      position: [cx, building.floor_height * 0.5, cz],
      target: [cx + 3, building.floor_height * 0.4, cz - 2],
      fov: 65,
    },
  ]
}

// ── Animated Camera Controller ──

interface CameraControllerProps {
  building: BuildingInfo
  targetPreset: CameraPreset | null
  flyToTarget: { position: Vec3; dimensions: { width: number; height: number; depth: number } } | null
  onFlyToComplete?: () => void
  enabled: boolean
}

export function CameraController({
  building, targetPreset, flyToTarget, onFlyToComplete, enabled,
}: CameraControllerProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const animRef = useRef<{
    active: boolean
    startPos: THREE.Vector3
    endPos: THREE.Vector3
    startTarget: THREE.Vector3
    endTarget: THREE.Vector3
    progress: number
    duration: number
    onComplete?: () => void
  }>({ active: false, startPos: new THREE.Vector3(), endPos: new THREE.Vector3(), startTarget: new THREE.Vector3(), endTarget: new THREE.Vector3(), progress: 0, duration: 1.2 })

  const startAnimation = useCallback((
    endPos: [number, number, number],
    endTarget: [number, number, number],
    duration: number = 1.2,
    onComplete?: () => void,
  ) => {
    const anim = animRef.current
    anim.active = true
    anim.startPos.copy(camera.position)
    anim.endPos.set(...endPos)
    anim.startTarget.set(0, 0, 0)
    if (controlsRef.current) {
      anim.startTarget.copy(controlsRef.current.target)
    }
    anim.endTarget.set(...endTarget)
    anim.progress = 0
    anim.duration = duration
    anim.onComplete = onComplete
  }, [camera])

  // Preset change → animate
  useEffect(() => {
    if (targetPreset) {
      startAnimation(targetPreset.position, targetPreset.target, 1.5)
      if (targetPreset.fov && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = targetPreset.fov
        camera.updateProjectionMatrix()
      }
    }
  }, [targetPreset, startAnimation, camera])

  // Fly-to room
  useEffect(() => {
    if (flyToTarget) {
      const { position: p, dimensions: d } = flyToTarget
      const dist = Math.max(d.width, d.depth) * 2.5
      const endPos: [number, number, number] = [
        p.x + dist * 0.6,
        p.y + d.height * 1.5,
        p.z + dist * 0.6,
      ]
      const endTarget: [number, number, number] = [p.x, p.y, p.z]
      startAnimation(endPos, endTarget, 1.8, onFlyToComplete)
    }
  }, [flyToTarget, startAnimation, onFlyToComplete])

  // Animation frame
  useFrame((_, delta) => {
    const anim = animRef.current
    if (!anim.active) return

    anim.progress += delta / anim.duration
    const t = Math.min(anim.progress, 1)
    // Smooth ease-in-out
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    camera.position.lerpVectors(anim.startPos, anim.endPos, ease)

    if (controlsRef.current) {
      const target = new THREE.Vector3().lerpVectors(anim.startTarget, anim.endTarget, ease)
      controlsRef.current.target.copy(target)
      controlsRef.current.update()
    }

    if (t >= 1) {
      anim.active = false
      anim.onComplete?.()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      target={[building.width / 2, building.total_height / 3, building.depth / 2]}
      maxPolarAngle={Math.PI / 2 - 0.02}
      minDistance={3}
      maxDistance={120}
      enableDamping
      dampingFactor={0.08}
      enabled={enabled && !animRef.current.active}
    />
  )
}
