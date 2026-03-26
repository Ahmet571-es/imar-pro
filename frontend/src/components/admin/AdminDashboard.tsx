/**
 * AdminDashboard — SaaS yönetim paneli.
 * Kullanıcı sayıları, proje istatistikleri, plan dağılımı, DAU grafiği.
 */

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { Users, FolderKanban, Building2, Activity, Shield, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface DashboardData {
  total_users: number
  active_users_7d: number
  total_projects: number
  projects_this_week: number
  total_organizations: number
  plan_distribution: Record<string, number>
  daily_active_users: { date: string; users: number }[]
  recent_activity: { action: string; date: string }[]
  mode?: string
}

const PLAN_COLORS: Record<string, string> = {
  free: '#94a3b8',
  pro: '#3b82f6',
  enterprise: '#8b5cf6',
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-User-Id': 'admin-1',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <span className="ml-3 text-slate-500">Dashboard yükleniyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={load} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition">
          Tekrar Dene
        </button>
      </div>
    )
  }

  if (!data) return null

  const planData = Object.entries(data.plan_distribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-sky-600" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">imarPRO SaaS yönetim paneli</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border rounded-lg transition">
          <RefreshCw className="w-4 h-4" /> Yenile
        </button>
      </div>

      {data.mode === 'demo' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ Demo mod — Supabase yapılandırıldığında gerçek veriler görünecek.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<Users className="w-5 h-5" />} label="Toplam Kullanıcı" value={data.total_users} color="sky" />
        <KPICard icon={<Activity className="w-5 h-5" />} label="Aktif (7 gün)" value={data.active_users_7d} color="green" />
        <KPICard icon={<FolderKanban className="w-5 h-5" />} label="Toplam Proje" value={data.total_projects} color="violet" />
        <KPICard icon={<Building2 className="w-5 h-5" />} label="Organizasyon" value={data.total_organizations} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DAU Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Günlük Aktif Kullanıcı (14 gün)</h3>
          {data.daily_active_users.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.daily_active_users}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              Henüz veri yok
            </div>
          )}
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Plan Dağılımı</h3>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {planData.map((entry, i) => (
                    <Cell key={i} fill={PLAN_COLORS[entry.name.toLowerCase()] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              Henüz kullanıcı yok
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {planData.map(p => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ background: PLAN_COLORS[p.name.toLowerCase()] || '#94a3b8' }} />
                {p.name}: {p.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bu hafta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Bu Hafta</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-sky-50 rounded-lg">
              <span className="text-sm text-slate-600">Yeni proje</span>
              <span className="text-lg font-bold text-sky-700">{data.projects_this_week}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-slate-600">Aktif kullanıcı</span>
              <span className="text-lg font-bold text-green-700">{data.active_users_7d}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Son Aktivite</h3>
          {data.recent_activity.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {data.recent_activity.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{a.action}</span>
                  <span className="text-xs text-slate-400">{new Date(a.date).toLocaleDateString('tr-TR')}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 text-sm py-8">Henüz aktivite yok</div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string
}) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600 border-sky-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    violet: 'bg-violet-50 text-violet-600 border-violet-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  }
  return (
    <div className={cn('rounded-xl border p-4', colors[color] || colors.sky)}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-sm font-medium">{label}</span></div>
      <div className="text-3xl font-bold">{value.toLocaleString('tr-TR')}</div>
    </div>
  )
}
