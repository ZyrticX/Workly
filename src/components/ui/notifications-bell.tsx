'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Calendar, UserPlus, XCircle, ArrowRightLeft, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

const typeIcons: Record<string, typeof Bell> = {
  new_appointment: Calendar,
  cancelled_appointment: XCircle,
  rescheduled_appointment: ArrowRightLeft,
  new_contact: UserPlus,
  escalation: AlertTriangle,
  system: Bell,
}

const typeColors: Record<string, string> = {
  new_appointment: 'text-green-600 bg-green-50',
  cancelled_appointment: 'text-red-500 bg-red-50',
  rescheduled_appointment: 'text-amber-500 bg-amber-50',
  new_contact: 'text-blue-500 bg-blue-50',
  escalation: 'text-orange-500 bg-orange-50',
  system: 'text-gray-500 bg-gray-50',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'עכשיו'
  if (diffMin < 60) return `לפני ${diffMin} דק׳`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `לפני ${diffHr} שע׳`
  const diffDays = Math.floor(diffHr / 24)
  return `לפני ${diffDays} ימים`
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications() }}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/60 transition-ios min-h-[44px] min-w-[44px]"
        aria-label="התראות"
      >
        <Bell className="h-5 w-5 text-[#5A6E62]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -start-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed top-14 left-2 right-2 sm:absolute sm:top-12 sm:end-0 sm:left-auto sm:right-auto sm:w-96 z-50 max-h-[70vh] overflow-hidden rounded-2xl bg-white shadow-xl border border-[#E8EFE9] animate-page-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8EFE9]">
            <h3 className="text-sm font-bold text-[#1B2E24]">התראות</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              >
                <Check className="h-3 w-3" />
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto max-h-[60vh]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">אין התראות</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcons[n.type] || Bell
                const colorClass = typeColors[n.type] || typeColors.system
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-[#E8EFE9]/50 transition-colors',
                      !n.is_read && 'bg-blue-50/30'
                    )}
                  >
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm', !n.is_read ? 'font-semibold text-[#1B2E24]' : 'text-[#5A6E62]')}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-xs text-[#8FA89A] mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[11px] text-[#8FA89A] mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
