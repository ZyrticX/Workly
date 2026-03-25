'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import {
  Home,
  MessageCircle,
  Calendar,
  Users,
  Sparkles,
  BrainCircuit,
  Settings,
  Receipt,
  BarChart3,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { NotificationsBell } from '@/components/ui/notifications-bell'

interface SidebarItem {
  label: string
  href: string
  icon: React.ElementType
}

const mainNavItems: SidebarItem[] = [
  { label: 'ראשי', href: '/', icon: Home },
  { label: 'הודעות', href: '/inbox', icon: MessageCircle },
  { label: 'יומן', href: '/calendar', icon: Calendar },
  { label: 'לקוחות', href: '/contacts', icon: Users },
  { label: 'AI', href: '/ai-chat', icon: Sparkles },
]

const secondaryNavItems: SidebarItem[] = [
  { label: 'שדרג AI', href: '/train-ai', icon: BrainCircuit },
  { label: 'הוצאות', href: '/expenses', icon: Receipt },
  { label: 'מדדים', href: '/kpis', icon: BarChart3 },
  { label: 'דוחות', href: '/reports', icon: FileText },
  { label: 'הגדרות', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { businessName, loading } = useAuth()

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col',
        'w-[240px] min-h-screen',
        'glass-sidebar',
        'py-6 px-3'
      )}
    >
      {/* Logo + Business Name */}
      <div className="flex items-center justify-between px-3 mb-8">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl object-contain shadow-ios" />
          {loading ? (
            <span className="inline-block h-4 w-20 rounded bg-[var(--color-border)] animate-pulse" />
          ) : (
            <span className="text-sm font-bold text-text truncate">{businessName || 'העסק שלי'}</span>
          )}
        </div>
        <NotificationsBell />
      </div>

      {/* Main Nav */}
      <nav className="flex flex-col gap-1">
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-ios press-effect text-sm',
              isActive(item.href)
                ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-semibold shadow-ios'
                : 'text-text-secondary hover:bg-white/60 hover:backdrop-blur-sm hover:text-text'
            )}
          >
            {isActive(item.href) && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--color-primary-dark)]" />
            )}
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="my-5 mx-3">
        <div className="h-px bg-[var(--color-border)]" />
        <span className="block text-[10px] font-medium text-text-muted mt-3 px-1 uppercase tracking-wider">כלים נוספים</span>
      </div>

      {/* Secondary Nav */}
      <nav className="flex flex-col gap-1">
        {secondaryNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-ios press-effect text-sm',
              isActive(item.href)
                ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-semibold shadow-ios'
                : 'text-text-secondary hover:bg-white/60 hover:backdrop-blur-sm hover:text-text'
            )}
          >
            {isActive(item.href) && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--color-primary-dark)]" />
            )}
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout + Footer */}
      <div className="px-3 pt-4 border-t border-[var(--color-border)] space-y-3">
        <button
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-ios press-effect"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>התנתק</span>
        </button>
        <p className="text-[10px] text-text-muted text-center opacity-60">
          WhatsApp AI Agent v0.1
        </p>
      </div>
    </aside>
  )
}
