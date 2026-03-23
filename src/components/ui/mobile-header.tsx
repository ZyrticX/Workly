'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, LogOut, Settings } from 'lucide-react'
import { NotificationsBell } from '@/components/ui/notifications-bell'
import { useAuth } from '@/hooks/use-auth'

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { businessName } = useAuth()

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="lg:hidden sticky top-0 z-40 glass-strong shadow-ios px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-sm font-bold text-[#1B2E24] truncate max-w-[150px]">
            {businessName || 'העסק שלי'}
          </span>
        </div>

        {/* Notifications + User menu */}
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-ios press-effect min-h-[44px] min-w-[44px]"
              aria-label="תפריט משתמש"
            >
              <User className="h-5 w-5" />
            </button>

            {open && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl glass-card shadow-ios-lg border border-[var(--color-border)] overflow-hidden z-50 animate-slide-in-top">
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  <Settings className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <span>הגדרות</span>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    const { createClient } = await import('@/lib/supabase/client')
                    const supabase = createClient()
                    await supabase.auth.signOut()
                    window.location.href = '/login'
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors border-t border-[var(--color-border)]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>התנתק</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
