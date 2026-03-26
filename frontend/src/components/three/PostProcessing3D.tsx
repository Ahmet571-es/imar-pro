/**
 * imarPRO — PostProcessing3D.tsx
 * SSAO (köşe gölgeleri), bloom (cam/metal parlaması),
 * vignette, SMAA anti-aliasing, exposure kontrolü.
 *
 * @react-three/postprocessing kullanır.
 */

import { EffectComposer, SSAO, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

interface PostProcessingProps {
  enabled: boolean
  ssaoEnabled?: boolean
  bloomEnabled?: boolean
  vignetteEnabled?: boolean
}

export function PostProcessingEffects({
  enabled,
  ssaoEnabled = true,
  bloomEnabled = true,
  vignetteEnabled = true,
}: PostProcessingProps) {
  if (!enabled) return null

  return (
    <EffectComposer multisampling={0}>
      {ssaoEnabled ? (
        <SSAO
          samples={21}
          radius={0.12}
          intensity={22}
          luminanceInfluence={0.5}
          worldDistanceThreshold={1.0}
          worldDistanceFalloff={0.5}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.3}
        />
      ) : (
        <SMAA />
      )}
      {bloomEnabled ? (
        <Bloom
          intensity={0.15}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      ) : (
        <SMAA />
      )}
      {vignetteEnabled ? (
        <Vignette
          offset={0.35}
          darkness={0.4}
          blendFunction={BlendFunction.NORMAL}
        />
      ) : (
        <SMAA />
      )}
      <SMAA />
    </EffectComposer>
  )
}
