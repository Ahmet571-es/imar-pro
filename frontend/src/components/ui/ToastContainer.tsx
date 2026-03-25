import { useToastStore } from '@/stores/toastStore'
import type { ToastType } from '@/types'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const TOAST_CONFIG: Record<ToastType, {
  icon: typeof CheckCircle2
  bg: string
  border: string
  iconColor: string
  title: string
}> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    title: 'text-emerald-900',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-600',
    title: 'text-red-900',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    title: 'text-blue-900',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    title: 'text-amber-900',
  },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const config = TOAST_CONFIG[t.type]
          const Icon = config.icon

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto ${config.bg} border ${config.border} rounded-xl px-4 py-3 shadow-lg shadow-black/5 flex items-start gap-3`}
            >
              <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${config.title}`}>{t.title}</p>
                {t.message && (
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-0.5 rounded-md hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
