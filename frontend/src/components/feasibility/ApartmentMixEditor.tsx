/**
 * imarPRO — ApartmentMixEditor.tsx
 * Daire Karması Editörü — Kat bazlı farklı daire tipleri.
 *
 * Profesyonel gayrimenkul geliştirme standardı:
 * - Her kat ayrı ayrı konfigüre edilebilir
 * - Zemin kat: 1×3+1 + 1×2+1 (dükkan opsiyonel)
 * - Normal katlar: 2×3+1
 * - Çatı katı: 1×4+1 (dubleks opsiyonel)
 * - Şablon seçimi (hızlı başlangıç)
 * - Toplam daire sayısı, brüt/net alan, gelir tahmini
 * - Görsel kat planı tablosu
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Copy, Building2, ChevronDown, ChevronUp } from 'lucide-react'

// ── Daire Tipleri ──
const DAIRE_TIPLERI = [
  { id: '1+0', label: 'Stüdyo (1+0)', minAlan: 30, maxAlan: 50, odaSayisi: 1 },
  { id: '1+1', label: '1+1', minAlan: 45, maxAlan: 70, odaSayisi: 2 },
  { id: '2+1', label: '2+1', minAlan: 70, maxAlan: 100, odaSayisi: 3 },
  { id: '3+1', label: '3+1', minAlan: 100, maxAlan: 140, odaSayisi: 4 },
  { id: '4+1', label: '4+1', minAlan: 140, maxAlan: 200, odaSayisi: 5 },
  { id: '5+1', label: '5+1 (Dubleks)', minAlan: 180, maxAlan: 280, odaSayisi: 6 },
  { id: 'dukkan', label: 'Dükkan', minAlan: 40, maxAlan: 200, odaSayisi: 0 },
]

// ── Kat Primi ──
const KAT_PRIMLERI: Record<string, number> = {
  'bodrum': -0.15,
  'zemin': -0.05,
  'normal': 0.00,
  'ust': 0.05,
  'cati': 0.12,
}

// ── Cephe Primi ──
const CEPHE_PRIMLERI: Record<string, number> = {
  'guney': 0.04,
  'bati': 0.03,
  'dogu': 0.02,
  'kuzey': -0.03,
}

// ── Şablonlar ──
interface MixTemplate {
  id: string
  label: string
  description: string
  generate: (katAdedi: number) => KatConfig[]
}

const TEMPLATES: MixTemplate[] = [
  {
    id: 'standart_3plus1',
    label: 'Standart 3+1',
    description: 'Tüm katlarda 2×3+1',
    generate: (n) => Array.from({ length: n }, (_, i) => ({
      katNo: i,
      katTipi: i === 0 ? 'zemin' : i === n - 1 ? 'cati' : 'normal',
      daireler: [
        { tip: '3+1', adet: 2, brutAlan: 120, cephe: 'guney' },
      ],
    })),
  },
  {
    id: 'karisik',
    label: 'Karışık Karma',
    description: 'Zemin: dükkan+2+1, Normal: 3+1×2, Çatı: 4+1',
    generate: (n) => Array.from({ length: n }, (_, i) => ({
      katNo: i,
      katTipi: i === 0 ? 'zemin' : i === n - 1 ? 'cati' : 'normal',
      daireler: i === 0
        ? [{ tip: 'dukkan', adet: 1, brutAlan: 60, cephe: 'guney' }, { tip: '2+1', adet: 1, brutAlan: 85, cephe: 'kuzey' }]
        : i === n - 1
          ? [{ tip: '4+1', adet: 1, brutAlan: 160, cephe: 'guney' }]
          : [{ tip: '3+1', adet: 2, brutAlan: 120, cephe: 'guney' }],
    })),
  },
  {
    id: 'yatirimci',
    label: 'Yatırımcı Odaklı',
    description: 'Zemin: 2×1+1, Normal: 1×2+1+1×3+1, Çatı: 4+1',
    generate: (n) => Array.from({ length: n }, (_, i) => ({
      katNo: i,
      katTipi: i === 0 ? 'zemin' : i === n - 1 ? 'cati' : 'normal',
      daireler: i === 0
        ? [{ tip: '1+1', adet: 2, brutAlan: 55, cephe: 'guney' }]
        : i === n - 1
          ? [{ tip: '4+1', adet: 1, brutAlan: 155, cephe: 'guney' }]
          : [{ tip: '2+1', adet: 1, brutAlan: 85, cephe: 'guney' }, { tip: '3+1', adet: 1, brutAlan: 120, cephe: 'kuzey' }],
    })),
  },
]

// ── Veri Yapıları ──

export interface DaireConfig {
  tip: string
  adet: number
  brutAlan: number
  cephe: string
}

export interface KatConfig {
  katNo: number
  katTipi: string // zemin, normal, ust, cati
  daireler: DaireConfig[]
}

export interface ApartmentMixSummary {
  katlar: KatConfig[]
  toplamDaire: number
  toplamBrutAlan: number
  toplamNetAlan: number
  tahminiGelir: number
  daireDetay: {
    daireNo: number; kat: number; tip: string; brutAlan: number; netAlan: number
    cephe: string; katPrimi: number; cephePrimi: number; m2Fiyat: number; toplamFiyat: number
  }[]
}

// ── Bileşen ──

interface Props {
  katAdedi: number
  katBasiBrutAlan: number
  m2SatisFiyati: number
  onChange: (summary: ApartmentMixSummary) => void
}

export function ApartmentMixEditor({ katAdedi, katBasiBrutAlan, m2SatisFiyati, onChange }: Props) {
  const [katlar, setKatlar] = useState<KatConfig[]>(() =>
    TEMPLATES[0].generate(katAdedi),
  )
  const [expandedKat, setExpandedKat] = useState<number | null>(null)

  // Recalculate when katAdedi changes
  useEffect(() => {
    if (katlar.length !== katAdedi) {
      setKatlar(TEMPLATES[0].generate(katAdedi))
    }
  }, [katAdedi])

  // Şablon uygula
  const applyTemplate = useCallback((templateId: string) => {
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (tpl) {
      setKatlar(tpl.generate(katAdedi))
    }
  }, [katAdedi])

  // Daire ekle
  const addDaire = useCallback((katIndex: number) => {
    setKatlar(prev => prev.map((k, i) =>
      i === katIndex ? { ...k, daireler: [...k.daireler, { tip: '3+1', adet: 1, brutAlan: 120, cephe: 'guney' }] } : k,
    ))
  }, [])

  // Daire sil
  const removeDaire = useCallback((katIndex: number, daireIndex: number) => {
    setKatlar(prev => prev.map((k, i) =>
      i === katIndex ? { ...k, daireler: k.daireler.filter((_, di) => di !== daireIndex) } : k,
    ))
  }, [])

  // Daire güncelle
  const updateDaire = useCallback((katIndex: number, daireIndex: number, updates: Partial<DaireConfig>) => {
    setKatlar(prev => prev.map((k, i) =>
      i === katIndex ? {
        ...k,
        daireler: k.daireler.map((d, di) => di === daireIndex ? { ...d, ...updates } : d),
      } : k,
    ))
  }, [])

  // Katı kopyala (aynı konfigürasyonu diğer katlara uygula)
  const copyKatToAll = useCallback((katIndex: number) => {
    const source = katlar[katIndex]
    setKatlar(prev => prev.map((k, i) => {
      if (i === katIndex) return k
      // Sadece normal katlara kopyala
      if (k.katTipi === 'zemin' || k.katTipi === 'cati') return k
      return { ...k, daireler: source.daireler.map(d => ({ ...d })) }
    }))
  }, [katlar])

  // Hesapla
  const summary = useMemo((): ApartmentMixSummary => {
    let toplamDaire = 0
    let toplamBrutAlan = 0
    let daireNo = 1
    const daireDetay: ApartmentMixSummary['daireDetay'] = []

    for (const kat of katlar) {
      const katPrimiOran = KAT_PRIMLERI[kat.katTipi] || 0

      for (const daire of kat.daireler) {
        for (let a = 0; a < daire.adet; a++) {
          const netAlan = daire.brutAlan * 0.80 // %80 net/brüt
          const cephePrimiOran = CEPHE_PRIMLERI[daire.cephe] || 0
          const m2Fiyat = Math.round(m2SatisFiyati * (1 + katPrimiOran + cephePrimiOran))
          const toplamFiyat = Math.round(netAlan * m2Fiyat)

          daireDetay.push({
            daireNo: daireNo++,
            kat: kat.katNo + 1,
            tip: daire.tip,
            brutAlan: daire.brutAlan,
            netAlan: Math.round(netAlan * 10) / 10,
            cephe: daire.cephe,
            katPrimi: katPrimiOran * 100,
            cephePrimi: cephePrimiOran * 100,
            m2Fiyat,
            toplamFiyat,
          })

          toplamDaire++
          toplamBrutAlan += daire.brutAlan
        }
      }
    }

    const toplamNetAlan = Math.round(toplamBrutAlan * 0.80)
    const tahminiGelir = daireDetay.reduce((s, d) => s + d.toplamFiyat, 0)

    return { katlar, toplamDaire, toplamBrutAlan, toplamNetAlan, tahminiGelir, daireDetay }
  }, [katlar, m2SatisFiyati])

  // Notify parent
  useEffect(() => {
    onChange(summary)
  }, [summary, onChange])

  const katLabel = (k: KatConfig) => {
    switch (k.katTipi) {
      case 'zemin': return 'Zemin Kat'
      case 'cati': return 'Çatı Katı'
      default: return `${k.katNo + 1}. Kat`
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Template selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Daire Karması Editörü</h3>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {summary.toplamDaire} daire · {summary.toplamBrutAlan.toLocaleString('tr-TR')} m²
          </span>
        </div>
        <div className="flex gap-1.5">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t.id)}
              className="text-[10px] px-2 py-1 rounded-md border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              title={t.description}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kat listesi */}
      <div className="space-y-2">
        {katlar.map((kat, ki) => {
          const isExpanded = expandedKat === ki
          const katDaireSayisi = kat.daireler.reduce((s, d) => s + d.adet, 0)
          const katBrutAlan = kat.daireler.reduce((s, d) => s + d.brutAlan * d.adet, 0)
          const tipOzet = kat.daireler.map(d => `${d.adet}×${d.tip}`).join(' + ')

          return (
            <div key={ki} className="bg-white rounded-xl border border-border overflow-hidden">
              {/* Kat header */}
              <button onClick={() => setExpandedKat(isExpanded ? null : ki)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-alt/50 transition-colors">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                  kat.katTipi === 'zemin' ? 'bg-amber-100 text-amber-700' :
                  kat.katTipi === 'cati' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-50 text-blue-600',
                )}>
                  {kat.katNo === 0 ? 'Z' : kat.katNo + 1}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-xs font-semibold">{katLabel(kat)}</div>
                  <div className="text-[10px] text-text-muted">{tipOzet} · {katDaireSayisi} daire · {katBrutAlan} m²</div>
                </div>
                <div className="text-[10px] font-mono text-text-muted">
                  Prim: {((KAT_PRIMLERI[kat.katTipi] || 0) * 100).toFixed(0)}%
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </button>

              {/* Daire detay (expanded) */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-3">
                  {kat.daireler.map((daire, di) => (
                    <div key={di} className="flex items-center gap-2 bg-surface-alt/50 rounded-lg px-3 py-2">
                      <select value={daire.tip}
                        onChange={(e) => updateDaire(ki, di, { tip: e.target.value })}
                        className="input-field text-xs py-1 w-24">
                        {DAIRE_TIPLERI.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-text-muted">Adet:</label>
                        <input type="number" value={daire.adet} min={1} max={6}
                          onChange={(e) => updateDaire(ki, di, { adet: Number(e.target.value) })}
                          className="input-field text-xs py-1 w-14 font-mono" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-text-muted">Brüt m²:</label>
                        <input type="number" value={daire.brutAlan} min={30} max={300} step={5}
                          onChange={(e) => updateDaire(ki, di, { brutAlan: Number(e.target.value) })}
                          className="input-field text-xs py-1 w-16 font-mono" />
                      </div>
                      <select value={daire.cephe}
                        onChange={(e) => updateDaire(ki, di, { cephe: e.target.value })}
                        className="input-field text-xs py-1 w-20">
                        <option value="guney">Güney</option>
                        <option value="dogu">Doğu</option>
                        <option value="bati">Batı</option>
                        <option value="kuzey">Kuzey</option>
                      </select>
                      <button onClick={() => removeDaire(ki, di)}
                        className="p-1 text-danger hover:bg-danger/10 rounded transition-colors"
                        title="Daire sil">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-2">
                    <button onClick={() => addDaire(ki)}
                      className="text-[10px] px-2 py-1 rounded-md border border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-colors flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Daire Ekle
                    </button>
                    {kat.katTipi === 'normal' && (
                      <button onClick={() => copyKatToAll(ki)}
                        className="text-[10px] px-2 py-1 rounded-md border border-dashed border-border hover:border-primary text-text-muted hover:text-primary transition-colors flex items-center gap-1">
                        <Copy className="w-3 h-3" /> Tüm Normal Katlara Uygula
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Gelir Tablosu */}
      {summary.daireDetay.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-surface-alt/50 border-b border-border">
            <h4 className="text-xs font-semibold text-text-muted">
              DAİRE BAZLI GELİR TABLOSU — {summary.toplamDaire} daire
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">#</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Kat</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Tip</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Brüt m²</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Net m²</th>
                  <th className="px-2 py-1.5 text-center font-semibold">Cephe</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Kat P.</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Cephe P.</th>
                  <th className="px-2 py-1.5 text-right font-semibold">m² ₺</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Toplam ₺</th>
                </tr>
              </thead>
              <tbody>
                {summary.daireDetay.map((d, i) => (
                  <tr key={i} className={cn('border-t border-border/30', i % 2 === 0 ? '' : 'bg-surface-alt/20')}>
                    <td className="px-2 py-1 text-text-muted">{d.daireNo}</td>
                    <td className="px-2 py-1">{d.kat === 1 ? 'Zemin' : `Kat ${d.kat - 1}`}</td>
                    <td className="px-2 py-1 font-semibold">{d.tip}</td>
                    <td className="px-2 py-1 text-right font-mono">{d.brutAlan}</td>
                    <td className="px-2 py-1 text-right font-mono">{d.netAlan}</td>
                    <td className="px-2 py-1 text-center">{d.cephe === 'guney' ? 'G' : d.cephe === 'kuzey' ? 'K' : d.cephe === 'dogu' ? 'D' : 'B'}</td>
                    <td className="px-2 py-1 text-right font-mono">{d.katPrimi > 0 ? '+' : ''}{d.katPrimi.toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right font-mono">{d.cephePrimi > 0 ? '+' : ''}{d.cephePrimi.toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right font-mono">₺{d.m2Fiyat.toLocaleString('tr-TR')}</td>
                    <td className="px-2 py-1 text-right font-mono font-semibold">₺{d.toplamFiyat.toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-alt font-semibold">
                  <td colSpan={3} className="px-2 py-1.5">TOPLAM</td>
                  <td className="px-2 py-1.5 text-right font-mono">{summary.toplamBrutAlan.toLocaleString('tr-TR')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{summary.toplamNetAlan.toLocaleString('tr-TR')}</td>
                  <td colSpan={4} />
                  <td className="px-2 py-1.5 text-right font-mono text-primary">
                    ₺{summary.tahminiGelir.toLocaleString('tr-TR')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
