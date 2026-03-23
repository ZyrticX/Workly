import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  change?: {
    value: number
    label?: string
  }
  icon?: React.ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  change,
  icon,
  className,
}: StatCardProps) {
  const isPositive = change && change.value >= 0
  const isNegative = change && change.value < 0

  return (
    <div
      className={cn(
        'glass-card shadow-ios rounded-2xl p-4',
        'flex flex-col gap-2',
        'hover:shadow-ios-lg transition-ios',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Subtle green accent line at top */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-l from-[var(--color-primary)]/40 to-[var(--color-primary)]/10" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {icon && (
          <span className="text-text-muted">{icon}</span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text leading-none">
          {value}
        </span>

        {change && (
          <span
            className={cn(
              'text-xs font-medium leading-none pb-0.5',
              isPositive && 'text-success',
              isNegative && 'text-danger'
            )}
          >
            {isPositive ? '+' : ''}
            {change.value}%
            {change.label && (
              <span className="text-text-muted me-1">{change.label}</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
