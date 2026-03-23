'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  MessageCircle,
  Calendar,
  Users,
  Sparkles,
  BrainCircuit,
  MoreHorizontal,
  Settings,
  LogOut,
  Receipt,
  BarChart3,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'ראשי', href: '/', icon: Home },
  { label: 'הודעות', href: '/inbox', icon: MessageCircle },
  { label: 'יומן', href: '/calendar', icon: Calendar },
  { label: 'לקוחות', href: '/contacts', icon: Users },
  { label: 'עוד', href: '#more', icon: MoreHorizontal },
]

const moreMenuItems: NavItem[] = [
  { label: 'צ\'אט AI', href: '/ai-chat', icon: Sparkles },
  { label: 'שדרג AI', href: '/train-ai', icon: BrainCircuit },
  { label: 'הוצאות', href: '/expenses', icon: Receipt },
  { label: 'מדדים', href: '/kpis', icon: BarChart3 },
  { label: 'דוחות', href: '/reports', icon: FileText },
  { label: 'הגדרות', href: '/settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [moreOpen])

  // Check if any "more" item is active
  const isMoreActive = moreMenuItems.some((item) =>
    pathname.startsWith(item.href)
  )

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'glass-nav shadow-ios',
        'safe-area-bottom',
        'lg:hidden'
      )}
    >
      {/* Backdrop overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More menu popup */}
      {moreOpen && (
        <div ref={menuRef} className="absolute bottom-full mb-2 left-3 right-3 mx-auto max-w-sm rounded-2xl glass-card shadow-ios-lg border border-[var(--color-border)] overflow-hidden z-50 animate-slide-in-top">
          <div className="grid grid-cols-3 gap-1 p-3">
            {moreMenuItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-label={item.label}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 min-h-[52px] min-w-[52px] text-xs justify-center',
                    'transition-all duration-200 ease-out active:scale-90 active:opacity-70',
                    isActive
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          {/* Logout */}
          <div className="border-t border-[var(--color-border)] p-2">
            <button
              type="button"
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client')
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              aria-label="התנתק מהחשבון"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 min-h-[44px] text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-all duration-200 active:scale-95 active:opacity-70"
            >
              <LogOut className="h-4 w-4" />
              <span>התנתק</span>
            </button>
          </div>
        </div>
      )}

      <ul className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const isMore = item.href === '#more'
          const isActive = isMore
            ? isMoreActive
            : item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          const showIndicator = isMore ? (isActive || moreOpen) : isActive

          return (
            <li key={item.href} className="flex-1 flex justify-center">
              {isMore ? (
                <button
                  type="button"
                  onClick={() => setMoreOpen(!moreOpen)}
                  aria-label="תפריט נוסף"
                  aria-expanded={moreOpen}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl min-w-[48px] min-h-[44px] justify-center',
                    'transition-all duration-200 ease-out',
                    'active:scale-90 active:opacity-70',
                    isActive || moreOpen
                      ? 'text-[var(--color-primary-dark)]'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  {showIndicator && (
                    <span className="absolute top-0.5 h-[3px] w-6 rounded-full bg-[var(--color-primary-dark)]" />
                  )}
                  <item.icon
                    className={cn(
                      'h-[22px] w-[22px] transition-all duration-200',
                      (isActive || moreOpen) && 'stroke-[2.5px] scale-110'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] leading-tight',
                      isActive || moreOpen ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-label={item.label}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl min-w-[48px] min-h-[44px] justify-center',
                    'transition-all duration-200 ease-out',
                    'active:scale-90 active:opacity-70',
                    isActive
                      ? 'text-[var(--color-primary-dark)]'
                      : 'text-text-muted hover:text-text-secondary'
                  )}
                >
                  {isActive && (
                    <span className="absolute top-0.5 h-[3px] w-6 rounded-full bg-[var(--color-primary-dark)]" />
                  )}
                  <item.icon
                    className={cn(
                      'h-[22px] w-[22px] transition-all duration-200',
                      isActive && 'stroke-[2.5px] scale-110'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] leading-tight',
                      isActive ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
