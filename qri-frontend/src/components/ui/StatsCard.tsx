import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  change,
  changeType = 'neutral',
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">
            {value}
          </p>
          {change && (
            <p
              className={cn('mt-1 text-xs font-medium', {
                'text-success': changeType === 'positive',
                'text-error': changeType === 'negative',
                'text-muted-foreground': changeType === 'neutral',
              })}
            >
              {change}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}
