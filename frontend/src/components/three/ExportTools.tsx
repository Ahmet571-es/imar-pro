/**
 * imarPRO — ExportTools.tsx
 * Screenshot PNG (2×/4× çözünürlük), GLTF/GLB export.
 * Canvas capture + GLTFExporter.
 */

import { useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ── Screenshot Capture Hook ──

export function useScreenshot() {
  const { gl, scene, camera } = useThree()

  const captureScreenshot = useCallback((multiplier: number = 2) => {
    try {
      const originalSize = gl.getSize(new THREE.Vector2())
      const w = originalSize.x * multiplier
      const h = originalSize.y * multiplier

      // Create high-res render target
      const renderTarget = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      })

      // Render to target
      gl.setRenderTarget(renderTarget)
      gl.render(scene, camera)

      // Read pixels
      const pixels = new Uint8Array(w * h * 4)
      gl.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixels)

      // Flip Y
      const rowSize = w * 4
      const halfHeight = Math.floor(h / 2)
      const temp = new Uint8Array(rowSize)
      for (let y = 0; y < halfHeight; y++) {
        const topOffset = y * rowSize
        const bottomOffset = (h - y - 1) * rowSize
        temp.set(pixels.subarray(topOffset, topOffset + rowSize))
        pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize)
        pixels.set(temp, bottomOffset)
      }

      // Create canvas and draw
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      const imageData = new ImageData(new Uint8ClampedArray(pixels), w, h)
      ctx.putImageData(imageData, 0, 0)

      // Download
      const link = document.createElement('a')
      link.download = `imarPRO_screenshot_${multiplier}x_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      // Cleanup
      gl.setRenderTarget(null)
      renderTarget.dispose()

      return true
    } catch (e) {
      console.error('Screenshot failed:', e)
      return false
    }
  }, [gl, scene, camera])

  return captureScreenshot
}

// ── GLTF Export Hook ──

export function useGLTFExport() {
  const { scene } = useThree()

  const exportGLTF = useCallback(async () => {
    try {
      // Dynamic import GLTFExporter
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
      const exporter = new GLTFExporter()

      return new Promise<boolean>((resolve) => {
        exporter.parse(
          scene,
          (result) => {
            let blob: Blob
            if (result instanceof ArrayBuffer) {
              // Binary GLB
              blob = new Blob([result], { type: 'application/octet-stream' })
            } else {
              // JSON GLTF
              const json = JSON.stringify(result, null, 2)
              blob = new Blob([json], { type: 'application/json' })
            }

            const link = document.createElement('a')
            link.download = `imarPRO_model_${Date.now()}.glb`
            link.href = URL.createObjectURL(blob)
            link.click()
            URL.revokeObjectURL(link.href)
            resolve(true)
          },
          (error) => {
            console.error('GLTF export error:', error)
            resolve(false)
          },
          { binary: true }, // GLB format
        )
      })
    } catch (e) {
      console.error('GLTF export failed:', e)
      return false
    }
  }, [scene])

  return exportGLTF
}

// ── Export Action Component (inside Canvas) ──
// This component sits inside Canvas and exposes actions via ref

import { useImperativeHandle, forwardRef } from 'react'

export interface ExportActionsRef {
  screenshot: (multiplier?: number) => boolean
  exportGLTF: () => Promise<boolean>
}

export const ExportActions = forwardRef<ExportActionsRef, object>(function ExportActions(_, ref) {
  const screenshot = useScreenshot()
  const gltfExport = useGLTFExport()

  useImperativeHandle(ref, () => ({
    screenshot: (multiplier = 2) => screenshot(multiplier),
    exportGLTF: () => gltfExport(),
  }), [screenshot, gltfExport])

  return null
})
