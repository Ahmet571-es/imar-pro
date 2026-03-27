import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, ResponsiveContainer, Tooltip,
} from 'recharts'

interface PlanScore {
  plan_name: string
  source: string
  score: Record<string, string>
  final_score: number
}

interface Props {
  plans: PlanScore[]
}

// Türkçe kısa etiketler
const DIMENSION_LABELS: Record<string, string> = {
  'Oda Boyut Uyumu': 'Boyut',
  'En-Boy Oranı': 'Oran',
  'Bitişiklik Uyumu': 'Bitişiklik',
  'Dış Cephe Erişimi': 'Cephe',
  'Islak Hacim Gruplaması': 'Islak H.',
  'Sirkülasyon Verimliliği': 'Sirk.',
  'Güneş Optimizasyonu': 'Güneş',
  'Yapısal Grid': 'Grid',
  'Yönetmelik Uyumu': 'Yönetmelik',
}

const PLAN_COLORS = ['#0369a1', '#7c3aed', '#059669']

export function PlanRadarChart({ plans }: Props) {
  if (!plans || plans.length === 0) return null

  // Build radar data: one entry per dimension, with values for each plan
  const dimensions = Object.keys(DIMENSION_LABELS)

  const radarData = dimensions.map((dimKey) => {
    const entry: Record<string, unknown> = {
      dimension: DIMENSION_LABELS[dimKey] || dimKey,
      fullName: dimKey,
    }
    plans.forEach((plan, i) => {
      const rawVal = plan.score?.[dimKey] || '0'
      // Parse "12.5" from the score string
      const num = parseFloat(rawVal.replace('/100', ''))
      // Normalize to 0-100 for radar display
      // Score weights sum to 1.0, each dimension max contribution varies
      // We'll show raw score value (already 0-~20 range) scaled to 100
      entry[`plan${i}`] = Math.min(100, isNaN(num) ? 0 : num * 5) // Scale up for visual
    })
    return entry
  })

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h4 className="text-xs font-semibold text-text-muted mb-3 flex items-center gap-1.5">
        PLAN KARŞILAŞTIRMA — 9 BOYUTLU RADAR
      </h4>
      <div style={{ height: 280 }}>
        <ResponsiveContainer>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'var(--font-body)' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 7, fill: '#94a3b8' }}
              tickCount={5}
            />
            {plans.map((plan, i) => (
              <Radar
                key={i}
                name={plan.plan_name}
                dataKey={`plan${i}`}
                stroke={PLAN_COLORS[i % PLAN_COLORS.length]}
                fill={PLAN_COLORS[i % PLAN_COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={2}
                dot={{ r: 3, fill: PLAN_COLORS[i % PLAN_COLORS.length] }}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-body)' }}
              formatter={(value: string) => <span className="text-xs font-medium">{value}</span>}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              formatter={(value: unknown, name: unknown) => [`${(Number(value) / 5).toFixed(1)}`, String(name)]}
              labelFormatter={(label: unknown) => String(label)}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {/* Score summary below radar */}
      <div className="flex gap-3 mt-3 justify-center">
        {plans.map((plan, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
            />
            <span className="font-medium">{plan.plan_name}</span>
            <span className="font-mono font-bold" style={{ color: PLAN_COLORS[i % PLAN_COLORS.length] }}>
              {plan.final_score.toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {/* Dimension comparison table */}
      {plans.length >= 2 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1 pr-2 font-semibold text-text-muted">Boyut</th>
                {plans.map((p, i) => (
                  <th key={i} className="text-center py-1 px-1 font-semibold" style={{ color: PLAN_COLORS[i % PLAN_COLORS.length] }}>
                    {p.plan_name}
                  </th>
                ))}
                <th className="text-center py-1 px-1 font-semibold text-text-muted">En İyi</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((dimKey) => {
                const scores = plans.map(p => {
                  const raw = p.score?.[dimKey] || '0'
                  return parseFloat(raw.replace('/100', ''))
                })
                const maxScore = Math.max(...scores)
                const label = DIMENSION_LABELS[dimKey] || dimKey

                return (
                  <tr key={dimKey} className="border-b border-border/20 hover:bg-surface-alt/50">
                    <td className="py-1 pr-2 text-text-muted">{label}</td>
                    {scores.map((score, i) => (
                      <td key={i} className="text-center py-1 px-1 font-mono">
                        <span className={`inline-block min-w-[32px] px-1 py-0.5 rounded ${score === maxScore && maxScore > 0 ? 'bg-emerald-50 text-emerald-700 font-semibold' : ''}`}>
                          {isNaN(score) ? '-' : score.toFixed(1)}
                        </span>
                      </td>
                    ))}
                    <td className="text-center py-1 px-1">
                      {maxScore > 0 && (() => {
                        const bestIdx = scores.indexOf(maxScore)
                        return (
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: PLAN_COLORS[bestIdx % PLAN_COLORS.length] }}>
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: PLAN_COLORS[bestIdx % PLAN_COLORS.length] }} />
                            {plans[bestIdx]?.plan_name?.replace(/\s*\(.*\)/, '').substring(0, 8)}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
