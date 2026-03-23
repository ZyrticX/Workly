import { cn } from '@/lib/utils/cn'

interface AdminStatCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon: React.ReactNode
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const colorMap = {
  primary: {
    iconBg: 'bg-[var(--color-primary)]/10',
    iconText: 'text-[var(--color-primary)]',
  },
  success: {
    iconBg: 'bg-success-bg',
    iconText: 'text-success',
  },
  warning: {
    iconBg: 'bg-warning-bg',
    iconText: 'text-warning',
  },
  danger: {
    iconBg: 'bg-danger-bg',
    iconText: 'text-danger',
  },
  info: {
    iconBg: 'bg-info-bg',
    iconText: 'text-info',
  },
}

export function AdminStatCard({
  label,
  value,
  sublabel,
  icon,
  color = 'primary',
  className,
}: AdminStatCardProps) {
  const colors = colorMap[color]

  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-5 border border-border',
        'flex items-start gap-4',
        className
      )}
    >
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
          colors.iconBg,
          colors.iconText
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-muted mb-1">{label}</p>
        <p className="text-2xl font-bold text-text leading-none">{value}</p>
        {sublabel && (
          <p className="text-[11px] text-text-muted mt-1.5">{sublabel}</p>
        )}
      </div>
    </div>
  )
}
