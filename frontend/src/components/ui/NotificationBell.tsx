/**
 * NotificationBell — Header bildirim zili + dropdown.
 * Okunmamış sayacı, son 10 bildirim, tümünü okundu işaretle.
 */

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, X, Info, AlertTriangle, CheckCircle2, Share2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'invite' | 'share'
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  invite: Users,
  share: Share2,
}

const TYPE_COLORS: Record<string, string> = {
  info: 'text-sky-600 bg-sky-50',
  success: 'text-green-600 bg-green-50',
  warning: 'text-amber-600 bg-amber-50',
  error: 'text-red-600 bg-red-50',
  invite: 'text-violet-600 bg-violet-50',
  share: 'text-blue-600 bg-blue-50',
}

interface Props {
  demoUserId?: string
}

export function NotificationBell({ demoUserId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000) // Her 60 saniye
    return () => clearInterval(interval)
  }, [])

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (demoUserId) headers['X-Demo-User-Id'] = demoUserId
      const res = await fetch(`${API_BASE}/api/notifications`, { headers })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnread(data.unread_count || 0)
      }
    } catch { /* sessiz */ }
  }

  const markAllRead = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (demoUserId) headers['X-Demo-User-Id'] = demoUserId
      await fetch(`${API_BASE}/api/notifications/read-all`, { method: 'PUT', headers })
      setUnread(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* sessiz */ }
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Az önce'
    if (mins < 60) return `${mins}dk`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}sa`
    return `${Math.floor(hours / 24)}g`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
        title="Bildirimler"
      >
        <Bell className="w-4 h-4 text-white/70" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
            <span className="font-semibold text-sm text-slate-800">Bildirimler</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Tümü okundu
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Bildirim yok
              </div>
            ) : (
              notifications.slice(0, 10).map(n => {
                const Icon = TYPE_ICONS[n.type] || Info
                const color = TYPE_COLORS[n.type] || TYPE_COLORS.info

                return (
                  <div key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors',
                      !n.is_read && 'bg-sky-50/50',
                    )}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{n.title}</div>
                      {n.message && <div className="text-xs text-slate-500 truncate">{n.message}</div>}
                      <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0 mt-2" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
