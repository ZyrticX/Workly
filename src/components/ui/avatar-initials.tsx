import { cn } from '@/lib/utils/cn'

type AvatarVariant = 'teal' | 'pink' | 'blue' | 'amber'

interface AvatarInitialsProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variantStyles: Record<AvatarVariant, string> = {
  teal: 'bg-[#E0F5F0] text-[#0F6E56]',
  pink: 'bg-[#FCE4EC] text-[#C62828]',
  blue: 'bg-[#E3F2FD] text-[#1565C0]',
  amber: 'bg-[#FFF8E1] text-[#F57F17]',
}

const variants: AvatarVariant[] = ['teal', 'pink', 'blue', 'amber']

const sizeStyles: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getVariant(name: string): AvatarVariant {
  const charCode = name.charCodeAt(0) || 0
  return variants[charCode % variants.length]
}

export function AvatarInitials({
  name,
  size = 'md',
  className,
}: AvatarInitialsProps) {
  const initials = getInitials(name)
  const variant = getVariant(name)

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold shrink-0',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      role="img"
      aria-label={name}
    >
      {initials}
    </div>
  )
}
