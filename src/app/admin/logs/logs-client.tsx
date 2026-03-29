'use client'

import { Fragment, useState, useMemo, useEffect, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'

// ── Types ──────────────────────────────────────────────────

interface WebhookLog {
  id: string
  event_type: string
  business_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

interface AiLog {
  id: string
  business_id: string | null
  intent: string | null
  confidence: number | null
  escalated: boolean | null
  response: string | null
  user_message: string | null
  created_at: string
}

interface ErrorLog {
  id: string
  business_id: string | null
  source: string
  severity: string
  message: string
  details: unknown
  contact_name: string | null
  resolved: boolean
  created_at: string
}

interface LogsClientProps {
  webhookLogs: WebhookLog[]
  auditLogs: AuditLog[]
  aiLogs: AiLog[]
  errorLogs?: ErrorLog[]
}

type TabKey = 'webhooks' | 'audit' | 'ai' | 'errors'

// ── Color maps ─────────────────────────────────────────────

const webhookEventColors: Record<string, string> = {
  message: 'bg-blue-500/10 text-blue-600',
  'session.status': 'bg-warning-bg text-warning',
  'message.ack': 'bg-neutral-bg text-neutral',
  health_alert: 'bg-danger-bg text-danger',
}

const auditActionColors: Record<string, string> = {
  login: 'bg-blue-500/10 text-blue-600',
  logout: 'bg-neutral-bg text-neutral',
  create: 'bg-success-bg text-success',
  update: 'bg-warning-bg text-warning',
  delete: 'bg-danger-bg text-danger',
  connect: 'bg-success-bg text-success',
  disconnect: 'bg-danger-bg text-danger',
}

// ── Helpers ────────────────────────────────────────────────

function truncateJson(value: unknown, maxLen = 80): string {
  if (value == null) return '-'
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function prettyJson(value: unknown): string {
  if (value == null) return '-'
  try {
    const obj = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(value)
  }
}

function getWebhookEventColor(eventType: string): string {
  // Try exact match first, then prefix match
  if (webhookEventColors[eventType]) return webhookEventColors[eventType]
  const prefix = Object.keys(webhookEventColors).find((key) =>
    eventType.startsWith(key)
  )
  return prefix
    ? webhookEventColors[prefix]
    : 'bg-neutral-bg text-neutral'
}

function getAuditActionColor(action: string): string {
  if (auditActionColors[action]) return auditActionColors[action]
  const prefix = Object.keys(auditActionColors).find((key) =>
    action.toLowerCase().includes(key)
  )
  return prefix
    ? auditActionColors[prefix]
    : 'bg-neutral-bg text-neutral'
}

function getConfidenceColor(confidence: number | null): string {
  if (confidence == null) return 'text-text-muted'
  if (confidence >= 0.8) return 'text-success'
  if (confidence >= 0.5) return 'text-warning'
  return 'text-danger'
}

// ── Tabs config ────────────────────────────────────────────

const tabs: { key: TabKey; label: string }[] = [
  { key: 'errors', label: '⚠️ שגיאות' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit', label: 'פעולות' },
  { key: 'ai', label: 'AI שיחות' },
]

// ── Component ──────────────────────────────────────────────

export function LogsClient({
  webhookLogs: initialWebhookLogs,
  auditLogs: initialAuditLogs,
  errorLogs: initialErrorLogs = [],
  aiLogs: initialAiLogs,
}: LogsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('webhooks')
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isPending, startTransition] = useTransition()

  const webhookLogs = initialWebhookLogs
  const auditLogs = initialAuditLogs
  const aiLogs = initialAiLogs

  // ── Refresh via full page reload ────────────────────────────

  function refresh() {
    startTransition(() => {
      window.location.reload()
    })
  }

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      window.location.reload()
    }, 10_000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // ── Filtered data ─────────────────────────────────────────

  const filteredWebhooks = useMemo(() => {
    if (!search) return webhookLogs
    const q = search.toLowerCase()
    return webhookLogs.filter(
      (w) =>
        w.event_type?.toLowerCase().includes(q) ||
        w.business_id?.toLowerCase().includes(q) ||
        truncateJson(w.payload, 300).toLowerCase().includes(q)
    )
  }, [webhookLogs, search])

  const filteredAudit = useMemo(() => {
    if (!search) return auditLogs
    const q = search.toLowerCase()
    return auditLogs.filter(
      (a) =>
        a.action?.toLowerCase().includes(q) ||
        a.user_email?.toLowerCase().includes(q) ||
        truncateJson(a.details, 300).toLowerCase().includes(q)
    )
  }, [auditLogs, search])

  const filteredAi = useMemo(() => {
    if (!search) return aiLogs
    const q = search.toLowerCase()
    return aiLogs.filter(
      (ai) =>
        ai.intent?.toLowerCase().includes(q) ||
        ai.business_id?.toLowerCase().includes(q) ||
        ai.response?.toLowerCase().includes(q) ||
        ai.user_message?.toLowerCase().includes(q)
    )
  }, [aiLogs, search])

  const currentCount =
    activeTab === 'webhooks'
      ? filteredWebhooks.length
      : activeTab === 'audit'
      ? filteredAudit.length
      : filteredAi.length

  // ── Row expand toggle ─────────────────────────────────────

  function toggleRow(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-2xl border border-border p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              setExpandedRow(null)
              setSearch('')
            }}
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'text-text-muted hover:bg-surface hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="חיפוש בלוגים..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Auto refresh + Refresh button */}
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
          {isPending ? 'מרענן...' : 'רענן'}
        </button>

        {/* Count */}
        <span className="text-xs text-text-muted">
          {currentCount} תוצאות
        </span>
      </div>

      {/* ── Webhook Logs Tab ────────────────────────────────── */}
      {activeTab === 'webhooks' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    זמן
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    סוג אירוע
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    עסק
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWebhooks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-12 text-text-muted"
                    >
                      אין לוגים להצגה
                    </td>
                  </tr>
                ) : (
                  filteredWebhooks.map((w) => (
                    <Fragment key={w.id}>
                      <tr
                        onClick={() => toggleRow(w.id)}
                        className="border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap font-mono">
                          {formatTime(w.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-[11px] font-medium px-2 py-0.5 rounded-md',
                              getWebhookEventColor(w.event_type)
                            )}
                          >
                            {w.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-text-secondary">
                          {w.business_id
                            ? w.business_id.slice(0, 8)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary max-w-[320px] truncate">
                          {truncateJson(w.payload)}
                        </td>
                      </tr>
                      {expandedRow === w.id && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-4 bg-surface/30 border-b border-border/50"
                          >
                            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto bg-white rounded-xl p-4 border border-border">
                              {prettyJson(w.payload)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* ── Audit Log Tab ───────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    זמן
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    אימייל
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    פעולה
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    פרטים
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-12 text-text-muted"
                    >
                      אין לוגים להצגה
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((a) => (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => toggleRow(a.id)}
                        className="border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap font-mono">
                          {formatTime(a.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[180px]">
                          {a.user_email || a.user_id?.slice(0, 8) || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-[11px] font-medium px-2 py-0.5 rounded-md',
                              getAuditActionColor(a.action)
                            )}
                          >
                            {a.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary max-w-[320px] truncate">
                          {truncateJson(a.details)}
                        </td>
                      </tr>
                      {expandedRow === a.id && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-4 bg-surface/30 border-b border-border/50"
                          >
                            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto bg-white rounded-xl p-4 border border-border">
                              {prettyJson(a.details)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* ── Error Logs Tab ────────────────────────── */}
      {activeTab === 'errors' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  <th className="text-start px-4 py-3 font-semibold text-text-muted">חומרה</th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted">מקור</th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted">שגיאה</th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted">לקוח</th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted">זמן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialErrorLogs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-text-muted">אין שגיאות 🎉</td></tr>
                ) : (
                  initialErrorLogs.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          e.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          e.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {e.severity === 'critical' ? '🔴 קריטי' : e.severity === 'error' ? '🟠 שגיאה' : '🟡 אזהרה'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{e.source}</td>
                      <td className="px-4 py-3 text-xs max-w-[300px] truncate" title={e.message}>{e.message}</td>
                      <td className="px-4 py-3 text-xs">{e.contact_name || '-'}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">{new Date(e.created_at).toLocaleString('he-IL')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AI Conversation Logs Tab ────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    זמן
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    עסק
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    Intent
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    ביטחון
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    הועבר
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                    תגובה
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAi.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-text-muted"
                    >
                      אין לוגים להצגה
                    </td>
                  </tr>
                ) : (
                  filteredAi.map((ai) => {
                    const confidencePct =
                      ai.confidence != null
                        ? Math.round(ai.confidence * 100)
                        : null

                    return (
                      <Fragment key={ai.id}>
                        <tr
                          onClick={() => toggleRow(ai.id)}
                          className="border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap font-mono">
                            {formatTime(ai.created_at)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-text-secondary">
                            {ai.business_id
                              ? ai.business_id.slice(0, 8)
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600">
                              {ai.intent || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'text-xs font-semibold',
                                getConfidenceColor(ai.confidence)
                              )}
                            >
                              {confidencePct != null
                                ? `${confidencePct}%`
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {ai.escalated ? (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-warning-bg text-warning">
                                כן
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-bg text-neutral">
                                לא
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-secondary max-w-[280px] truncate">
                            {ai.response
                              ? ai.response.length > 80
                                ? ai.response.slice(0, 80) + '...'
                                : ai.response
                              : '-'}
                          </td>
                        </tr>
                        {expandedRow === ai.id && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-4 bg-surface/30 border-b border-border/50"
                            >
                              <div className="space-y-3">
                                {ai.user_message && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-text-muted mb-1">
                                      הודעת משתמש:
                                    </p>
                                    <div className="text-xs text-text-secondary bg-white rounded-xl p-4 border border-border whitespace-pre-wrap">
                                      {ai.user_message}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <p className="text-[11px] font-semibold text-text-muted mb-1">
                                    תגובת AI:
                                  </p>
                                  <div className="text-xs text-text-secondary bg-white rounded-xl p-4 border border-border whitespace-pre-wrap">
                                    {ai.response || '-'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] text-text-muted">
                                  <span>Intent: {ai.intent || '-'}</span>
                                  <span>
                                    ביטחון:{' '}
                                    {confidencePct != null
                                      ? `${confidencePct}%`
                                      : '-'}
                                  </span>
                                  <span>
                                    הועבר: {ai.escalated ? 'כן' : 'לא'}
                                  </span>
                                  <span>
                                    עסק: {ai.business_id || '-'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </>
  )
}
