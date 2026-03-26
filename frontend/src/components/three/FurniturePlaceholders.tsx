/**
 * imarPRO — FurniturePlaceholders.tsx
 *
 * Oda tipine göre otomatik mobilya yerleştirme.
 * Mimari planlamada standart ölçülerde placeholder:
 *
 * - Yatak Odası: çift kişilik yatak (160×200) + komodin ×2 + gardırop
 * - Salon: kanepe (L-koltuk) + sehpa + TV ünitesi + yemek masası + sandalye
 * - Mutfak: tezgah (L/I) + ocak + evye + buzdolabı
 * - Banyo: duş teknesi + lavabo + klozet + ayna
 * - WC: klozet + lavabo
 * - Antre: ayakkabılık + ayna + portmanto
 * - Balkon: masa + 2 sandalye + saksı
 */

import * as THREE from 'three'
import type { Room3D, ViewMode } from './types3d'

interface FurnitureProps {
  room: Room3D
  floorY: number
  viewMode: ViewMode
}

// ── Temel Şekiller ──

function FBox({ pos, size, color, cast = true }: {
  pos: [number, number, number]; size: [number, number, number]; color: string; cast?: boolean
}) {
  return (
    <mesh position={pos} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  )
}

function FCyl({ pos, args, color }: {
  pos: [number, number, number]; args: [number, number, number, number]; color: string
}) {
  return (
    <mesh position={pos} castShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

// ── Yatak Odası Mobilyaları ──

function BedroomFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  // Çift kişilik yatak (160×200cm)
  const bedW = Math.min(1.6, w * 0.45)
  const bedD = Math.min(2.0, d * 0.55)

  return (
    <group>
      {/* Yatak çerçeve */}
      <FBox pos={[cx, y + 0.22, cz]} size={[bedW, 0.06, bedD]} color="#8D6E63" />
      {/* Şilte */}
      <FBox pos={[cx, y + 0.32, cz]} size={[bedW - 0.04, 0.16, bedD - 0.04]} color="#ECEFF1" />
      {/* Yastıklar */}
      <FBox pos={[cx - bedW * 0.2, y + 0.42, cz - bedD / 2 + 0.2]} size={[0.40, 0.08, 0.30]} color="#E8EAF6" />
      <FBox pos={[cx + bedW * 0.2, y + 0.42, cz - bedD / 2 + 0.2]} size={[0.40, 0.08, 0.30]} color="#E8EAF6" />
      {/* Başucu (headboard) */}
      <FBox pos={[cx, y + 0.55, cz - bedD / 2 + 0.03]} size={[bedW + 0.06, 0.60, 0.06]} color="#6D4C41" />

      {/* Komodinler */}
      <FBox pos={[cx - bedW / 2 - 0.30, y + 0.22, cz - bedD / 2 + 0.25]} size={[0.45, 0.44, 0.40]} color="#795548" />
      <FBox pos={[cx + bedW / 2 + 0.30, y + 0.22, cz - bedD / 2 + 0.25]} size={[0.45, 0.44, 0.40]} color="#795548" />

      {/* Gardırop — duvara yaslanmış */}
      {w > 3.0 && (
        <FBox pos={[cx + w / 2 - 0.35, y + 1.0, cz + d / 2 - 0.35]} size={[0.60, 2.0, 0.55]} color="#5D4037" />
      )}
    </group>
  )
}

// ── Salon Mobilyaları ──

function LivingRoomFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  const sofaW = Math.min(2.4, w * 0.4)

  return (
    <group>
      {/* L-Koltuk — oturma */}
      <FBox pos={[cx - w * 0.15, y + 0.22, cz + d * 0.15]} size={[sofaW, 0.44, 0.85]} color="#5C6BC0" />
      {/* L-Koltuk — sırt */}
      <FBox pos={[cx - w * 0.15, y + 0.42, cz + d * 0.15 + 0.35]} size={[sofaW, 0.35, 0.15]} color="#3F51B5" />
      {/* L-Koltuk — kol sol */}
      <FBox pos={[cx - w * 0.15 - sofaW / 2 + 0.08, y + 0.32, cz + d * 0.15]} size={[0.16, 0.20, 0.85]} color="#3F51B5" />

      {/* Sehpa */}
      <FBox pos={[cx - w * 0.15, y + 0.20, cz - d * 0.05]} size={[0.90, 0.04, 0.55]} color="#8D6E63" />
      <FCyl pos={[cx - w * 0.15 - 0.30, y + 0.09, cz - d * 0.05 - 0.15]} args={[0.025, 0.025, 0.18, 6]} color="#555" />
      <FCyl pos={[cx - w * 0.15 + 0.30, y + 0.09, cz - d * 0.05 - 0.15]} args={[0.025, 0.025, 0.18, 6]} color="#555" />
      <FCyl pos={[cx - w * 0.15 - 0.30, y + 0.09, cz - d * 0.05 + 0.15]} args={[0.025, 0.025, 0.18, 6]} color="#555" />
      <FCyl pos={[cx - w * 0.15 + 0.30, y + 0.09, cz - d * 0.05 + 0.15]} args={[0.025, 0.025, 0.18, 6]} color="#555" />

      {/* TV ünitesi */}
      <FBox pos={[cx - w * 0.15, y + 0.30, cz - d * 0.35]} size={[1.60, 0.55, 0.40]} color="#37474F" />
      {/* TV ekran */}
      <FBox pos={[cx - w * 0.15, y + 0.75, cz - d * 0.35 - 0.02]} size={[1.20, 0.70, 0.04]} color="#111" />

      {/* Yemek masası + sandalyeler (eğer alan yeterliyse) */}
      {w * d > 18 && (
        <group>
          <FBox pos={[cx + w * 0.22, y + 0.38, cz - d * 0.1]} size={[1.20, 0.04, 0.80]} color="#8D6E63" />
          <FCyl pos={[cx + w * 0.22, y + 0.19, cz - d * 0.1]} args={[0.04, 0.04, 0.38, 6]} color="#795548" />
          {/* 4 sandalye */}
          {[[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]].map(([dx, dz], i) => (
            <FBox key={`chair-${i}`} pos={[cx + w * 0.22 + dx, y + 0.22, cz - d * 0.1 + dz]}
              size={[0.40, 0.44, 0.40]} color="#A1887F" />
          ))}
        </group>
      )}
    </group>
  )
}

// ── Mutfak ──

function KitchenFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  const counterW = Math.min(w * 0.85, 3.0)

  return (
    <group>
      {/* Alt dolap tezgah — duvar boyunca */}
      <FBox pos={[cx, y + 0.44, cz + d / 2 - 0.35]} size={[counterW, 0.88, 0.60]} color="#6D4C41" />
      {/* Tezgah üstü (mermer) */}
      <FBox pos={[cx, y + 0.90, cz + d / 2 - 0.35]} size={[counterW + 0.02, 0.04, 0.64]} color="#E0E0E0" />

      {/* Evye */}
      <FBox pos={[cx - 0.4, y + 0.92, cz + d / 2 - 0.35]} size={[0.55, 0.02, 0.45]} color="#B0BEC5" />
      {/* Ocak */}
      <FBox pos={[cx + 0.4, y + 0.92, cz + d / 2 - 0.35]} size={[0.55, 0.02, 0.45]} color="#212121" />

      {/* Üst dolap */}
      <FBox pos={[cx, y + 1.65, cz + d / 2 - 0.20]} size={[counterW, 0.65, 0.35]} color="#5D4037" />

      {/* Buzdolabı */}
      <FBox pos={[cx + counterW / 2 + 0.40, y + 0.90, cz + d / 2 - 0.35]}
        size={[0.65, 1.80, 0.65]} color="#CFD8DC" />
    </group>
  )
}

// ── Banyo ──

function BathroomFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  return (
    <group>
      {/* Duş teknesi */}
      <FBox pos={[cx - w / 2 + 0.50, y + 0.08, cz - d / 2 + 0.50]} size={[0.90, 0.16, 0.90]} color="#E0E0E0" />
      {/* Duş cam bölme */}
      <mesh position={[cx - w / 2 + 0.95, y + 1.0, cz - d / 2 + 0.50]}>
        <boxGeometry args={[0.02, 1.90, 0.90]} />
        <meshPhysicalMaterial color="#B3E5FC" transparent opacity={0.2} roughness={0.05} transmission={0.6} />
      </mesh>

      {/* Lavabo + dolap */}
      <FBox pos={[cx + w / 2 - 0.40, y + 0.40, cz - d / 2 + 0.30]} size={[0.65, 0.80, 0.50]} color="#ECEFF1" />
      {/* Lavabo üstü */}
      <FBox pos={[cx + w / 2 - 0.40, y + 0.82, cz - d / 2 + 0.30]} size={[0.60, 0.06, 0.45]} color="#FAFAFA" />

      {/* Ayna */}
      <mesh position={[cx + w / 2 - 0.40, y + 1.35, cz - d / 2 + 0.03]}>
        <boxGeometry args={[0.50, 0.70, 0.02]} />
        <meshPhysicalMaterial color="#B3E5FC" roughness={0.02} metalness={0.9} />
      </mesh>

      {/* Klozet */}
      <FBox pos={[cx, y + 0.22, cz + d / 2 - 0.30]} size={[0.40, 0.42, 0.60]} color="#FAFAFA" />
      {/* Klozet sifon */}
      <FBox pos={[cx, y + 0.50, cz + d / 2 - 0.05]} size={[0.35, 0.35, 0.16]} color="#FAFAFA" />
    </group>
  )
}

// ── WC ──

function WCFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  return (
    <group>
      <FBox pos={[cx, y + 0.22, cz + d * 0.15]} size={[0.38, 0.42, 0.55]} color="#FAFAFA" />
      <FBox pos={[cx, y + 0.48, cz + d * 0.15 + 0.22]} size={[0.32, 0.30, 0.14]} color="#FAFAFA" />
      {/* Lavabo küçük */}
      <FBox pos={[cx + w * 0.25, y + 0.42, cz - d * 0.25]} size={[0.40, 0.10, 0.35]} color="#ECEFF1" />
    </group>
  )
}

// ── Balkon ──

function BalconyFurniture({ cx, cz, w, d, y }: { cx: number; cz: number; w: number; d: number; y: number }) {
  return (
    <group>
      {/* Küçük masa */}
      <FCyl pos={[cx, y + 0.35, cz]} args={[0.30, 0.30, 0.04, 8]} color="#8D6E63" />
      <FCyl pos={[cx, y + 0.17, cz]} args={[0.03, 0.03, 0.34, 6]} color="#555" />
      {/* 2 Sandalye */}
      <FBox pos={[cx - 0.4, y + 0.22, cz]} size={[0.40, 0.44, 0.40]} color="#A1887F" />
      <FBox pos={[cx + 0.4, y + 0.22, cz]} size={[0.40, 0.44, 0.40]} color="#A1887F" />
      {/* Saksı bitki */}
      <FCyl pos={[cx + w / 2 - 0.3, y + 0.15, cz - d / 2 + 0.2]} args={[0.12, 0.15, 0.28, 8]} color="#795548" />
      <mesh position={[cx + w / 2 - 0.3, y + 0.40, cz - d / 2 + 0.2]} castShadow>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshStandardMaterial color="#4CAF50" roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}

// ── Main Furniture Router ──

export function RoomFurniture({ room, floorY, viewMode }: FurnitureProps) {
  if (viewMode === 'wireframe' || viewMode === 'thermal' || viewMode === 'xray') return null

  const cx = room.position.x
  const cz = room.position.z
  const w = room.dimensions.width
  const d = room.dimensions.depth
  const y = floorY

  switch (room.type) {
    case 'yatak_odasi':
      return <BedroomFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    case 'salon':
      return <LivingRoomFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    case 'mutfak':
      return <KitchenFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    case 'banyo':
      return <BathroomFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    case 'wc':
      return <WCFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    case 'balkon':
      return <BalconyFurniture cx={cx} cz={cz} w={w} d={d} y={y} />
    default:
      return null
  }
}
