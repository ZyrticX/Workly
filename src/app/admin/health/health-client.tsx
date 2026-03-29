'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'

interface Session {
  id: string
  phone_number: string
  display_name: string | null
  session_id: string | null
  status: string
  server_node: string | null
  last_health_check: string | null
}

interface Alert {
  id: string
  event_type: string
  payload: Record<string, unknown> | string
  created_at: string
}

interface HealthClientProps {
  sessions: Session[]
  alerts: Alert[]
}

const statusDisplay: Record<string, { label: string; color: string; dotColor: string; bg: string }> = {
  connected: {
    label: 'WORKING',
    color: 'text-success',
    dotColor: 'bg-success',
    bg: 'bg-success-bg',
  },
  disconnected: {
    label: 'FAILED',
    color: 'text-danger',
    dotColor: 'bg-danger',
    bg: 'bg-danger-bg',
  },
  pending_qr: {
    label: 'STARTING',
    color: 'text-warning',
    dotColor: 'bg-warning',
    bg: 'bg-warning-bg',
  },
}

export function HealthClient({ sessions: initialSessions, alerts: initialAlerts }: HealthClientProps) {
  const [sessions, setSessions] = useState(initialSessions)
  const [alerts] = useState(initialAlerts)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isPending, startTransition] = useTransition()
  const [autoRefresh, setAutoRefresh] = useState(true)

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/health-status')
        if (res.ok) {
          const data = await res.json()
          if (data.sessions) {
            setSessions(data.sessions)
          }
          setLastRefresh(new Date())
        }
      } catch {
        // Silently fail - will retry on next interval
      }
    })
  }, [])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [autoRefresh, refresh])

  const workingCount = sessions.filter((s) => s.status === 'connected').length
  const failedCount = sessions.filter((s) => s.status === 'disconnected').length
  const startingCount = sessions.filter((s) => s.status === 'pending_qr').length

  return (
    <>
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-6 bg-white rounded-2xl border border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-sm font-medium text-text">
              {workingCount} תקינים
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-danger" />
            <span className="text-sm font-medium text-text">
              {failedCount} נכשלו
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-warning" />
            <span className="text-sm font-medium text-text">
              {startingCount} מתחילים
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 me-auto">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded accent-primary"
            />
            רענון אוטומטי (10 שניות)
          </label>
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {isPending ? 'מרענן...' : 'רענן הכל'}
          </button>
          <span className="text-[11px] text-text-muted">
            עדכון: {lastRefresh.toLocaleTimeString('he-IL')}
          </span>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-text-muted bg-white rounded-2xl border border-border">
            אין סשנים פעילים
          </div>
        ) : (
          sessions.map((session) => {
            const display = statusDisplay[session.status] || {
              label: session.status,
              color: 'text-neutral',
              dotColor: 'bg-neutral',
              bg: 'bg-neutral-bg',
            }
            return (
              <div
                key={session.id}
                className={cn(
                  'bg-white rounded-2xl border border-border p-4 transition-all',
                  session.status === 'disconnected' && 'border-danger/30'
                )}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={cn(
                      'text-[11px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5',
                      display.bg,
                      display.color
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', display.dotColor, session.status === 'connected' && 'animate-pulse')} />
                    {display.label}
                  </span>
                  {session.server_node && (
                    <span className="text-[10px] font-mono text-text-muted bg-surface px-2 py-0.5 rounded-md">
                      {session.server_node}
                    </span>
                  )}
                </div>

                {/* Session Info */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-text">
                    {session.display_name || session.session_id || 'ללא שם'}
                  </p>
                  <p className="text-xs font-mono text-text-secondary">
                    {session.phone_number}
                  </p>
                  {session.session_id && (
                    <p className="text-[11px] font-mono text-text-muted truncate">
                      ID: {session.session_id}
                    </p>
                  )}
                </div>

                {/* Last Check */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] text-text-muted">
                    בדיקה אחרונה:{' '}
                    {session.last_health_check
                      ? new Date(session.last_health_check).toLocaleString('he-IL')
                      : 'לא ידוע'}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Alert History */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-sm font-semibold text-text">
            היסטוריית התראות ({alerts.length})
          </h3>
        </div>

        {alerts.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">
            אין התראות אחרונות
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map((alert) => {
              const payload = typeof alert.payload === 'string' ? JSON.parse(alert.payload) : alert.payload
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-surface"
                >
                  <div className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text">
                      {payload?.message || payload?.description || 'התראת בריאות'}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {payload?.session_id && `Session: ${payload.session_id} · `}
                      {new Date(alert.created_at).toLocaleString('he-IL')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
