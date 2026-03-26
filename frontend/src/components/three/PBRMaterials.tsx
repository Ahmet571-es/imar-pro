/**
 * imarPRO — PBRMaterials.tsx
 * Programmatic PBR texture üretimi: sıva noise, seramik karo,
 * ahşap grain, beton noise, cam transmission.
 * HDR sky dome + environment map.
 */

import { useMemo } from 'react'
import * as THREE from 'three'

// ── Procedural Texture Generator ──

function createNoiseTexture(
  width: number,
  height: number,
  baseColor: [number, number, number],
  noiseAmount: number,
  seed: number = 42,
): THREE.DataTexture {
  const size = width * height
  const data = new Uint8Array(4 * size)

  // Simple seeded noise
  let s = seed
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647
    return (s / 2147483647)
  }

  for (let i = 0; i < size; i++) {
    const noise = (rand() - 0.5) * noiseAmount
    data[i * 4 + 0] = Math.max(0, Math.min(255, baseColor[0] + noise * 255))
    data[i * 4 + 1] = Math.max(0, Math.min(255, baseColor[1] + noise * 255))
    data[i * 4 + 2] = Math.max(0, Math.min(255, baseColor[2] + noise * 255))
    data[i * 4 + 3] = 255
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createCeramicTileTexture(
  tileW: number,
  tileH: number,
  groutWidth: number,
  tileColor: [number, number, number],
  groutColor: [number, number, number],
): THREE.DataTexture {
  const texW = 128
  const texH = 128
  const data = new Uint8Array(4 * texW * texH)

  const tilePxW = Math.floor(texW * tileW / (tileW + groutWidth))
  const tilePxH = Math.floor(texH * tileH / (tileH + groutWidth))

  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < texW; x++) {
      const inTileX = (x % (tilePxW + 2)) < tilePxW
      const inTileY = (y % (tilePxH + 2)) < tilePxH
      const isTile = inTileX && inTileY

      const idx = (y * texW + x) * 4
      const color = isTile ? tileColor : groutColor
      // Add slight variation
      const noise = (Math.sin(x * 0.5 + y * 0.3) * 0.02)
      data[idx + 0] = Math.max(0, Math.min(255, color[0] + noise * 255))
      data[idx + 1] = Math.max(0, Math.min(255, color[1] + noise * 255))
      data[idx + 2] = Math.max(0, Math.min(255, color[2] + noise * 255))
      data[idx + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, texW, texH, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createWoodGrainTexture(): THREE.DataTexture {
  const w = 128, h = 128
  const data = new Uint8Array(4 * w * h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const grain = Math.sin(y * 0.4 + Math.sin(x * 0.15) * 3) * 0.5 + 0.5
      const base = 0.45 + grain * 0.25
      const idx = (y * w + x) * 4
      data[idx + 0] = Math.floor(base * 180)     // R
      data[idx + 1] = Math.floor(base * 120)     // G
      data[idx + 2] = Math.floor(base * 60)      // B
      data[idx + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

// ── Material Hooks ──

export interface MaterialSet {
  exteriorWall: THREE.MeshStandardMaterial
  interiorWall: THREE.MeshStandardMaterial
  slab: THREE.MeshStandardMaterial
  glass: THREE.MeshPhysicalMaterial
  windowFrame: THREE.MeshStandardMaterial
  door: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  balcony: THREE.MeshStandardMaterial
  wetRoom: THREE.MeshStandardMaterial
  ground: THREE.MeshStandardMaterial
}

export function usePBRMaterials(): MaterialSet {
  return useMemo(() => {
    // Dış sıva — sıva noise texture
    const plasterTex = createNoiseTexture(64, 64, [232, 224, 212], 0.04, 42)
    plasterTex.repeat.set(4, 4)
    const exteriorWall = new THREE.MeshStandardMaterial({
      map: plasterTex,
      color: '#E8E0D4',
      roughness: 0.85,
      side: THREE.DoubleSide,
    })

    // İç sıva — daha pürüzsüz
    const innerTex = createNoiseTexture(64, 64, [245, 240, 235], 0.02, 99)
    innerTex.repeat.set(3, 3)
    const interiorWall = new THREE.MeshStandardMaterial({
      map: innerTex,
      color: '#F5F0EB',
      roughness: 0.92,
      side: THREE.DoubleSide,
    })

    // Beton döşeme
    const concreteTex = createNoiseTexture(64, 64, [212, 201, 184], 0.05, 77)
    concreteTex.repeat.set(2, 2)
    const slab = new THREE.MeshStandardMaterial({
      map: concreteTex,
      color: '#D4C9B8',
      roughness: 0.75,
    })

    // Cam — MeshPhysicalMaterial transmission
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#88CCEE',
      transparent: true,
      opacity: 0.25,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.7,
      ior: 1.5,
      thickness: 0.006,
      side: THREE.DoubleSide,
      envMapIntensity: 1.0,
    })

    // Pencere çerçeve — alüminyum
    const windowFrame = new THREE.MeshStandardMaterial({
      color: '#4A4A4A',
      roughness: 0.3,
      metalness: 0.6,
    })

    // Ahşap kapı
    const woodTex = createWoodGrainTexture()
    woodTex.repeat.set(1, 2)
    const door = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: '#8B6914',
      roughness: 0.55,
    })

    // Çatı
    const roof = new THREE.MeshStandardMaterial({
      color: '#8B4513',
      roughness: 0.85,
    })

    // Balkon
    const balcony = new THREE.MeshStandardMaterial({
      color: '#A0A0A0',
      roughness: 0.6,
    })

    // Islak hacim zemin (seramik karo)
    const ceramicTex = createCeramicTileTexture(
      0.30, 0.30, 0.005,
      [220, 225, 230], [180, 180, 180],
    )
    ceramicTex.repeat.set(6, 6)
    const wetRoom = new THREE.MeshStandardMaterial({
      map: ceramicTex,
      color: '#E0E5EA',
      roughness: 0.4,
    })

    // Zemin
    const ground = new THREE.MeshStandardMaterial({
      color: '#8B9467',
      roughness: 1.0,
    })

    return {
      exteriorWall, interiorWall, slab, glass,
      windowFrame, door, roof, balcony, wetRoom, ground,
    }
  }, [])
}
