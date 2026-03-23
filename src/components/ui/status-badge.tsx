import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusBadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-bg/80 text-success',
  warning: 'bg-warning-bg/80 text-warning',
  danger: 'bg-danger-bg/80 text-danger',
  info: 'bg-info-bg/80 text-info',
  neutral: 'bg-neutral-bg/80 text-neutral',
}

export function StatusBadge({
  variant,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5',
        'text-xs font-medium leading-tight',
        'rounded-[8px] backdrop-blur-sm',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
