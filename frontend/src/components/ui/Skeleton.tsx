/**
 * Skeleton — İçerik yüklenirken gösterilen pulse animasyonlu placeholder.
 * Kullanım: <Skeleton className="h-4 w-32" />
 */

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circle' | 'card' | 'chart'
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const base = 'animate-pulse bg-slate-200 rounded'

  if (variant === 'circle') {
    return <div className={cn(base, 'rounded-full', className)} />
  }

  if (variant === 'card') {
    return (
      <div className={cn('rounded-xl border border-slate-100 p-4 space-y-3', className)}>
        <div className={cn(base, 'h-4 w-3/4')} />
        <div className={cn(base, 'h-3 w-1/2')} />
        <div className={cn(base, 'h-8 w-full')} />
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className={cn('rounded-xl border border-slate-100 p-4', className)}>
        <div className={cn(base, 'h-4 w-40 mb-3')} />
        <div className="flex items-end gap-2 h-32">
          {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
            <div key={i} className={cn(base, 'flex-1')} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return <div className={cn(base, className)} />
}

/** Proje kartı skeleton */
export function ProjectCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

/** Dashboard KPI skeleton */
export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Tablo skeleton */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
