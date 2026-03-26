/**
 * imarPRO — BOQPanel.tsx
 * Bill of Quantities (Metraj Tablosu)
 *
 * 3D modelden otomatik metraj çıkarımı:
 * - Betonarme: döşeme m³, kolon m³, kiriş m³
 * - Duvar: dış duvar m², iç duvar m², tuğla/ytong m³
 * - Cephe: mantolama m², dış sıva m², boya m²
 * - Doğrama: pencere adet/m², kapı adet
 * - Döşeme kaplama: seramik m², parke m², halı m²
 * - Çatı: su yalıtım m², ısı yalıtım m², derz m
 * - Tesisat tahmini: elektrik, sıhhi, mekanik
 *
 * Her kalem: birim, miktar, birim fiyat, toplam
 * Excel/CSV export desteği
 */

import { useMemo, useState } from 'react'
import type { BuildingInfo, Floor3D, ColumnData } from './types3d'
import { COST_CATEGORIES } from './types3d'

// ── Metraj Kalemi ──
interface BOQItem {
  id: string
  group: string         // Yapısal / Mimari / Cephe / Tesisat
  pozNo: string         // Poz numarası (Y.16.050/1 vb.)
  description: string
  unit: string          // m², m³, m, adet, kg
  quantity: number
  unitPrice: number     // ₺
  total: number         // ₺
  source: string        // "3D model", "hesaplama", "yaklaşık"
}

// ── Metraj Hesaplama ──
function calculateBOQ(
  building: BuildingInfo,
  floors: Floor3D[],
  columns: ColumnData[],
  totalCost: number,
): BOQItem[] {
  const items: BOQItem[] = []
  const w = building.width
  const d = building.depth
  const h = building.floor_height
  const n = building.floor_count
  const slabT = building.slab_thickness || 0.15
  const wallT = building.wall_thickness || 0.25

  // Toplam alanlar
  const katAlani = w * d
  const toplamInsaatAlani = katAlani * n
  const cevre = 2 * (w + d)

  // Oda sayıları (tüm katlar)
  let toplamOda = 0
  let toplamPencere = 0
  let toplamKapi = 0
  let islakHacimAlani = 0
  let kuruHacimAlani = 0

  for (const floor of floors) {
    for (const room of floor.rooms) {
      toplamOda++
      toplamPencere += room.windows?.length || 0
      if (room.door) toplamKapi++
      const area = room.dimensions.width * room.dimensions.depth
      if (['banyo', 'wc'].includes(room.type)) {
        islakHacimAlani += area
      } else {
        kuruHacimAlani += area
      }
    }
  }
  toplamPencere = Math.max(toplamPencere, n * 6) // minimum tahmin
  toplamKapi = Math.max(toplamKapi, n * 7)

  let itemId = 0
  const add = (group: string, pozNo: string, desc: string, unit: string, qty: number, unitPrice: number, source: string = '3D model') => {
    items.push({
      id: `boq-${++itemId}`,
      group, pozNo, description: desc, unit,
      quantity: Math.round(qty * 100) / 100,
      unitPrice: Math.round(unitPrice),
      total: Math.round(qty * unitPrice),
      source,
    })
  }

  // ═══════════════════════════════════════
  // 1. YAPISAL İŞLER (Betonarme)
  // ═══════════════════════════════════════

  // Döşeme betonu
  const dosemeBetonu = katAlani * slabT * (n + 1) // +1 çatı döşemesi
  add('Yapısal', 'Y.16.050/1', 'Betonarme döşeme betonu (C30/37)', 'm³', dosemeBetonu, 2800)

  // Döşeme demiri
  const dosemeDemiri = dosemeBetonu * 100 // ~100 kg/m³
  add('Yapısal', 'Y.23.176', 'Betonarme donatı çeliği (B420C) — döşeme', 'kg', dosemeDemiri, 28)

  // Kolon betonu
  const kolonSayisi = columns.length
  const kolonHacim = kolonSayisi * (columns[0]?.size || 0.4) ** 2 * building.total_height
  add('Yapısal', 'Y.16.050/2', 'Betonarme kolon betonu (C30/37)', 'm³', kolonHacim, 3200)

  // Kolon demiri
  add('Yapısal', 'Y.23.176', 'Betonarme donatı çeliği (B420C) — kolon', 'kg', kolonHacim * 150, 28)

  // Kiriş betonu (kolon arası)
  const kirisHacim = cevre * n * 0.25 * 0.50 // 25x50cm kiriş
  add('Yapısal', 'Y.16.050/3', 'Betonarme kiriş betonu (C30/37)', 'm³', kirisHacim, 3000)

  // Kiriş demiri
  add('Yapısal', 'Y.23.176', 'Betonarme donatı çeliği (B420C) — kiriş', 'kg', kirisHacim * 120, 28)

  // Temel
  const temelHacim = cevre * 0.50 * 0.80 + katAlani * 0.20 // sürekli temel + radye
  add('Yapısal', 'Y.16.050/4', 'Temel betonu (C25/30)', 'm³', temelHacim, 2500)

  // Kalıp
  const kalipAlani = dosemeBetonu / slabT + kolonSayisi * 4 * (columns[0]?.size || 0.4) * building.total_height + kirisHacim / 0.25 * 2
  add('Yapısal', 'Y.21.001', 'Düz yüzeyli beton kalıbı (plywood)', 'm²', kalipAlani, 350)

  // ═══════════════════════════════════════
  // 2. DUVAR İŞLERİ
  // ═══════════════════════════════════════

  const disduvarAlani = cevre * (h - slabT) * n
  const icduvarAlani = toplamOda * 2.5 * (h - slabT) * n * 0.6 // yaklaşık

  add('Mimari', 'Y.18.461/A', 'Dış duvar örme — 19cm gazbeton blok', 'm²', disduvarAlani, 420)
  add('Mimari', 'Y.18.461/B', 'İç duvar örme — 10cm gazbeton blok', 'm²', icduvarAlani, 280)

  // Sıva
  add('Mimari', 'Y.27.581', 'Dış cephe sıvası (çimento esaslı)', 'm²', disduvarAlani, 180)
  add('Mimari', 'Y.27.501', 'İç sıva (alçı sıva)', 'm²', icduvarAlani + disduvarAlani, 120)

  // Boya
  add('Mimari', 'Y.25.032', 'İç cephe boya (2 kat, akrilik)', 'm²', (icduvarAlani + disduvarAlani) * 1.1, 65)

  // ═══════════════════════════════════════
  // 3. DIŞ CEPHE
  // ═══════════════════════════════════════

  add('Cephe', 'Y.19.055/1', 'Isı yalıtım (EPS/XPS 5cm, mantolama)', 'm²', disduvarAlani, 380)
  add('Cephe', 'Y.27.582', 'Dış cephe son kat boya (silikonlu)', 'm²', disduvarAlani, 95)
  add('Cephe', 'Y.19.055/2', 'Denizlik (mermer, pencere altı)', 'm', toplamPencere * 1.5, 220)

  // ═══════════════════════════════════════
  // 4. DOĞRAMA
  // ═══════════════════════════════════════

  add('Doğrama', 'Y.26.016/1', 'PVC pencere (çift cam, Low-E)', 'adet', toplamPencere, 12500)
  add('Doğrama', 'Y.26.021/1', 'İç kapı (ahşap, amerikan panel)', 'adet', toplamKapi, 6500)
  add('Doğrama', 'Y.26.021/2', 'Giriş kapısı (çelik)', 'adet', n, 8500)
  add('Doğrama', 'Y.26.021/3', 'Balkon kapısı (PVC sürme)', 'adet', Math.ceil(n * 1.5), 15000)

  // ═══════════════════════════════════════
  // 5. DÖŞEME KAPLAMA
  // ═══════════════════════════════════════

  add('Döşeme', 'Y.26.006/1', 'Seramik kaplama (ıslak hacim, 30×60cm)', 'm²', islakHacimAlani * n, 350)
  add('Döşeme', 'Y.26.006/2', 'Duvar seramiği (ıslak hacim)', 'm²', islakHacimAlani * n * 2.5, 320) // duvar yüksekliği
  add('Döşeme', 'Y.26.008/1', 'Laminat parke (AC4, kuru hacimler)', 'm²', kuruHacimAlani * n, 280)
  add('Döşeme', 'Y.26.008/2', 'Süpürgelik (MDF)', 'm', cevre * n * 0.8, 45)

  // ═══════════════════════════════════════
  // 6. ÇATI
  // ═══════════════════════════════════════

  add('Çatı', 'Y.19.080/1', 'Çatı su yalıtım membranı (2 kat)', 'm²', katAlani * 1.1, 180)
  add('Çatı', 'Y.19.055/3', 'Çatı ısı yalıtım (XPS 8cm)', 'm²', katAlani, 280)
  add('Çatı', 'Y.18.001', 'Parapet duvar (h=90cm)', 'm', cevre, 450)

  // ═══════════════════════════════════════
  // 7. TESİSAT (yaklaşık)
  // ═══════════════════════════════════════

  add('Tesisat', 'E.01', 'Elektrik tesisatı (komple)', 'm²', toplamInsaatAlani, 250, 'yaklaşık')
  add('Tesisat', 'S.01', 'Sıhhi tesisat (komple)', 'm²', toplamInsaatAlani, 200, 'yaklaşık')
  add('Tesisat', 'M.01', 'Mekanik tesisat (ısıtma/soğutma)', 'm²', toplamInsaatAlani, 180, 'yaklaşık')
  add('Tesisat', 'A.01', 'Asansör (8 durak, 630kg)', 'adet', 1, 850000, 'yaklaşık')

  // ═══════════════════════════════════════
  // 8. ORTAK ALANLAR
  // ═══════════════════════════════════════

  add('Ortak', 'Y.MER.01', 'Merdiven basamak kaplaması (granit)', 'adet', n * 20, 650)
  add('Ortak', 'Y.MER.02', 'Merdiven korkuluk (paslanmaz çelik)', 'm', n * 6, 1200)
  add('Ortak', 'Y.MER.03', 'Giriş holü döşeme (mermer)', 'm²', 15, 800)

  return items
}

// ── BOQ Panel Component ──

interface BOQPanelProps {
  building: BuildingInfo
  floors: Floor3D[]
  columns: ColumnData[]
  totalCost: number
}

export function BOQPanel({ building, floors, columns, totalCost }: BOQPanelProps) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'group' | 'total'>('group')

  const items = useMemo(
    () => calculateBOQ(building, floors, columns, totalCost),
    [building, floors, columns, totalCost],
  )

  // Grup toplamları
  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const item of items) {
      totals[item.group] = (totals[item.group] || 0) + item.total
    }
    return totals
  }, [items])

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items])

  // Filtreli ve sıralı kalemler
  const filteredItems = useMemo(() => {
    let result = activeGroup ? items.filter(i => i.group === activeGroup) : items
    if (sortBy === 'total') result = [...result].sort((a, b) => b.total - a.total)
    return result
  }, [items, activeGroup, sortBy])

  const groups = Object.keys(groupTotals)

  // CSV Export
  const handleExportCSV = () => {
    const header = 'Grup;Poz No;Açıklama;Birim;Miktar;Birim Fiyat (₺);Toplam (₺);Kaynak\n'
    const rows = items.map(i =>
      `${i.group};${i.pozNo};${i.description};${i.unit};${i.quantity};${i.unitPrice};${i.total};${i.source}`,
    ).join('\n')
    const footer = `\n\nGENEL TOPLAM;;;;;;;${grandTotal}`
    const csv = '\uFEFF' + header + rows + footer // BOM for Turkish chars
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `imarPRO_metraj_${Date.now()}.csv`
    link.href = URL.createObjectURL(blob)
    link.click()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-base">📋 Metraj / Bill of Quantities</h3>
            <p className="text-xs text-text-muted mt-0.5">
              3D modelden otomatik metraj çıkarımı · {items.length} kalem · {groups.length} grup
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV}
              className="btn-secondary text-xs px-3 py-1.5">
              📥 CSV İndir
            </button>
          </div>
        </div>

        {/* Grup kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
          <button onClick={() => setActiveGroup(null)}
            className={`rounded-lg p-2 text-center text-xs border transition-colors ${!activeGroup ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/30'}`}>
            <div className="font-bold">Tümü</div>
            <div className="text-[10px] mt-0.5">₺{(grandTotal / 1_000_000).toFixed(1)}M</div>
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(activeGroup === g ? null : g)}
              className={`rounded-lg p-2 text-center text-xs border transition-colors ${activeGroup === g ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary/30'}`}>
              <div className="font-semibold">{g}</div>
              <div className="text-[10px] mt-0.5">₺{(groupTotals[g] / 1_000_000).toFixed(2)}M</div>
            </button>
          ))}
        </div>

        {/* Sıralama */}
        <div className="flex gap-1 text-[10px]">
          <button onClick={() => setSortBy('group')}
            className={`px-2 py-0.5 rounded ${sortBy === 'group' ? 'bg-surface-alt font-semibold' : ''}`}>
            Gruba Göre
          </button>
          <button onClick={() => setSortBy('total')}
            className={`px-2 py-0.5 rounded ${sortBy === 'total' ? 'bg-surface-alt font-semibold' : ''}`}>
            Tutara Göre
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-alt">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Poz No</th>
                <th className="px-3 py-2 text-left font-semibold">Açıklama</th>
                <th className="px-3 py-2 text-right font-semibold">Birim</th>
                <th className="px-3 py-2 text-right font-semibold">Miktar</th>
                <th className="px-3 py-2 text-right font-semibold">B.Fiyat ₺</th>
                <th className="px-3 py-2 text-right font-semibold">Toplam ₺</th>
                <th className="px-3 py-2 text-center font-semibold">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={item.id} className={`border-t border-border/50 ${idx % 2 === 0 ? '' : 'bg-surface-alt/30'} hover:bg-primary/5`}>
                  <td className="px-3 py-1.5 font-mono text-text-muted">{item.pozNo}</td>
                  <td className="px-3 py-1.5">{item.description}</td>
                  <td className="px-3 py-1.5 text-right text-text-muted">{item.unit}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{item.quantity.toLocaleString('tr-TR')}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{item.unitPrice.toLocaleString('tr-TR')}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold">
                    {item.total.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.source === '3D model' ? 'bg-emerald-50 text-emerald-700' : item.source === 'hesaplama' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-alt font-semibold">
              <tr className="border-t-2 border-border">
                <td colSpan={5} className="px-3 py-2 text-right">GENEL TOPLAM</td>
                <td className="px-3 py-2 text-right font-mono text-primary text-sm">
                  ₺{grandTotal.toLocaleString('tr-TR')}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Karşılaştırma notu */}
      {totalCost > 0 && (
        <div className="bg-surface-alt rounded-xl p-3 text-xs text-text-muted">
          <span className="font-semibold">Fizibilite Karşılaştırma:</span>{' '}
          Metraj toplamı ₺{(grandTotal / 1_000_000).toFixed(2)}M vs Fizibilite tahmini ₺{(totalCost / 1_000_000).toFixed(2)}M
          <span className={`ml-1 font-semibold ${Math.abs(grandTotal - totalCost) / totalCost < 0.15 ? 'text-emerald-700' : 'text-amber-700'}`}>
            (Fark: %{(((grandTotal - totalCost) / totalCost) * 100).toFixed(1)})
          </span>
        </div>
      )}
    </div>
  )
}
