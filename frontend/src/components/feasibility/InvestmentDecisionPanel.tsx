/**
 * imarPRO — InvestmentDecisionPanel.tsx
 * GO / NO-GO Yatırım Karar Paneli
 *
 * Profesyonel gayrimenkul değerleme standardı:
 * - Trafik ışığı puanlama (Yeşil/Sarı/Kırmızı)
 * - 8 kritik parametre sektör benchmark karşılaştırma
 * - Risk matrisi (olasılık × etki)
 * - Nihai karar: YATIR / DİKKATLİ / VAZGEÇ
 * - Bankanın fizibilite departmanının beklediği format
 */

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Shield, Clock, Target, Percent,
} from 'lucide-react'

interface Props {
  karMarji: number
  irr: number
  roi: number
  zararOlasiligi: number
  paybackAy: number | null
  toplamMaliyet: number
  toplamGelir: number
  insaatSuresiAy: number
}

interface KriterSkor {
  parametre: string
  deger: string
  benchmark: string
  durum: 'yesil' | 'sari' | 'kirmizi'
  puan: number // 0-10
  aciklama: string
}

const BENCHMARK = {
  karMarji: { iyi: 20, orta: 10, kotu: 0 },
  irr: { iyi: 25, orta: 15, kotu: 5 },
  roi: { iyi: 25, orta: 12, kotu: 0 },
  zararOlasiligi: { iyi: 10, orta: 25, kotu: 40 },
  paybackAy: { iyi: 18, orta: 24, kotu: 36 },
}

export function InvestmentDecisionPanel({
  karMarji, irr, roi, zararOlasiligi, paybackAy, toplamMaliyet, toplamGelir, insaatSuresiAy,
}: Props) {
  const kriterler = useMemo((): KriterSkor[] => {
    const k: KriterSkor[] = []

    // 1. Kâr Marjı
    const kmDurum = karMarji >= BENCHMARK.karMarji.iyi ? 'yesil' : karMarji >= BENCHMARK.karMarji.orta ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'Kâr Marjı',
      deger: `%${karMarji.toFixed(1)}`,
      benchmark: `İyi: >%${BENCHMARK.karMarji.iyi}`,
      durum: kmDurum,
      puan: kmDurum === 'yesil' ? 10 : kmDurum === 'sari' ? 6 : 2,
      aciklama: karMarji >= 20 ? 'Güçlü kârlılık' : karMarji >= 10 ? 'Kabul edilebilir' : karMarji >= 0 ? 'Düşük kârlılık' : 'Zararda',
    })

    // 2. IRR
    const irrDurum = irr >= BENCHMARK.irr.iyi ? 'yesil' : irr >= BENCHMARK.irr.orta ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'Yıllık IRR',
      deger: `%${irr.toFixed(1)}`,
      benchmark: `İyi: >%${BENCHMARK.irr.iyi}`,
      durum: irrDurum,
      puan: irrDurum === 'yesil' ? 10 : irrDurum === 'sari' ? 6 : 2,
      aciklama: irr >= 25 ? 'Yüksek getiri' : irr >= 15 ? 'Piyasa ortalaması' : 'Düşük getiri',
    })

    // 3. ROI
    const roiDurum = roi >= BENCHMARK.roi.iyi ? 'yesil' : roi >= BENCHMARK.roi.orta ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'ROI',
      deger: `%${roi.toFixed(1)}`,
      benchmark: `İyi: >%${BENCHMARK.roi.iyi}`,
      durum: roiDurum,
      puan: roiDurum === 'yesil' ? 10 : roiDurum === 'sari' ? 6 : 2,
      aciklama: roi >= 25 ? 'Yüksek yatırım getirisi' : roi >= 12 ? 'Makul' : 'Yetersiz',
    })

    // 4. Zarar Olasılığı
    const zoDurum = zararOlasiligi <= BENCHMARK.zararOlasiligi.iyi ? 'yesil' : zararOlasiligi <= BENCHMARK.zararOlasiligi.orta ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'Zarar Olasılığı',
      deger: `%${zararOlasiligi.toFixed(1)}`,
      benchmark: `İyi: <%${BENCHMARK.zararOlasiligi.iyi}`,
      durum: zoDurum,
      puan: zoDurum === 'yesil' ? 10 : zoDurum === 'sari' ? 5 : 1,
      aciklama: zararOlasiligi <= 10 ? 'Düşük risk' : zararOlasiligi <= 25 ? 'Orta risk' : 'Yüksek risk',
    })

    // 5. Payback
    const pb = paybackAy || 99
    const pbDurum = pb <= BENCHMARK.paybackAy.iyi ? 'yesil' : pb <= BENCHMARK.paybackAy.orta ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'Geri Dönüş Süresi',
      deger: paybackAy ? `${paybackAy} ay` : 'N/A',
      benchmark: `İyi: <${BENCHMARK.paybackAy.iyi} ay`,
      durum: pbDurum,
      puan: pbDurum === 'yesil' ? 10 : pbDurum === 'sari' ? 6 : 2,
      aciklama: pb <= 18 ? 'Hızlı geri dönüş' : pb <= 24 ? 'Normal' : 'Yavaş',
    })

    // 6. Gelir/Maliyet Oranı
    const gmOran = toplamGelir / Math.max(toplamMaliyet, 1)
    const gmDurum = gmOran >= 1.25 ? 'yesil' : gmOran >= 1.10 ? 'sari' : 'kirmizi'
    k.push({
      parametre: 'Gelir/Maliyet',
      deger: `${gmOran.toFixed(2)}x`,
      benchmark: 'İyi: >1.25x',
      durum: gmDurum,
      puan: gmDurum === 'yesil' ? 10 : gmDurum === 'sari' ? 6 : 2,
      aciklama: gmOran >= 1.25 ? 'Sağlıklı oran' : gmOran >= 1.10 ? 'Dar marj' : 'Yetersiz',
    })

    return k
  }, [karMarji, irr, roi, zararOlasiligi, paybackAy, toplamMaliyet, toplamGelir])

  // Genel puan (0-100)
  const genelPuan = useMemo(() => {
    const toplam = kriterler.reduce((s, k) => s + k.puan, 0)
    return Math.round(toplam / kriterler.length * 10)
  }, [kriterler])

  // Karar
  const karar = useMemo(() => {
    if (genelPuan >= 70) return { label: 'YATIR', color: 'bg-emerald-600', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50', icon: CheckCircle2, aciklama: 'Bu proje güçlü finansal göstergelere sahiptir. Yatırım yapılması önerilir.' }
    if (genelPuan >= 45) return { label: 'DİKKATLİ İLERLE', color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50', icon: AlertTriangle, aciklama: 'Orta düzeyde risk. Maliyet optimizasyonu ve piyasa izlemesi ile ilerlenebilir.' }
    return { label: 'VAZGEÇ / REVİZE ET', color: 'bg-red-600', textColor: 'text-red-700', bgLight: 'bg-red-50', icon: XCircle, aciklama: 'Mevcut parametrelerle yatırım riskli. Proje parametrelerini revize edin.' }
  }, [genelPuan])

  const KararIcon = karar.icon

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      {/* Header — karar bandı */}
      <div className={cn('px-5 py-4 flex items-center gap-4', karar.color)}>
        <KararIcon className="w-8 h-8 text-white" />
        <div className="flex-1">
          <div className="text-white text-lg font-bold">{karar.label}</div>
          <div className="text-white/80 text-xs">{karar.aciklama}</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{genelPuan}</div>
          <div className="text-white/70 text-[10px]">/ 100</div>
        </div>
      </div>

      {/* Kriter tablosu */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-text-muted mb-3">KRİTER BAZLI DEĞERLENDİRME</h4>
        <div className="space-y-2">
          {kriterler.map((k, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-alt/50 transition-colors">
              {/* Trafik ışığı */}
              <div className={cn('w-3 h-3 rounded-full shrink-0',
                k.durum === 'yesil' ? 'bg-emerald-500' :
                k.durum === 'sari' ? 'bg-amber-500' : 'bg-red-500',
              )} />

              {/* Parametre */}
              <div className="w-32 text-xs font-medium">{k.parametre}</div>

              {/* Değer */}
              <div className={cn('w-20 text-sm font-bold font-mono text-right',
                k.durum === 'yesil' ? 'text-emerald-700' :
                k.durum === 'sari' ? 'text-amber-700' : 'text-red-700',
              )}>
                {k.deger}
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-2 bg-surface-alt rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all',
                  k.durum === 'yesil' ? 'bg-emerald-500' :
                  k.durum === 'sari' ? 'bg-amber-500' : 'bg-red-500',
                )} style={{ width: `${k.puan * 10}%` }} />
              </div>

              {/* Benchmark */}
              <div className="w-28 text-[10px] text-text-muted text-right">{k.benchmark}</div>

              {/* Açıklama */}
              <div className="w-32 text-[10px] text-text-muted">{k.aciklama}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Skor dağılımı */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Yeşil ({kriterler.filter(k => k.durum === 'yesil').length})</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Sarı ({kriterler.filter(k => k.durum === 'sari').length})</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Kırmızı ({kriterler.filter(k => k.durum === 'kirmizi').length})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
