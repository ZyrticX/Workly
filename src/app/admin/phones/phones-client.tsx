'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'
import { AdminStatCard } from '@/components/admin/admin-stat-card'

interface PhoneRow {
  id: string
  phone_number: string
  display_name: string | null
  session_id: string | null
  server_node: string | null
  status: string
  ownership: string
  last_health_check: string | null
  business_id: string | null
  created_at: string
  business_name: string | null
}

interface PhonesClientProps {
  phones: PhoneRow[]
  counts: {
    total: number
    connected: number
    disconnected: number
    free: number
  }
}

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  connected: { label: 'מחובר', color: 'bg-success-bg text-success', dotColor: 'bg-success' },
  disconnected: { label: 'מנותק', color: 'bg-danger-bg text-danger', dotColor: 'bg-danger' },
  pending_qr: { label: 'ממתין ל-QR', color: 'bg-warning-bg text-warning', dotColor: 'bg-warning' },
}

export function PhonesClient({ phones, counts }: PhonesClientProps) {
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newNode, setNewNode] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  async function handleReconnect(phoneId: string) {
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/phone-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneId, action: 'reconnect' }),
        })
        if (res.ok) {
          setActionMessage('בקשת חיבור מחדש נשלחה')
          window.location.reload()
        } else {
          setActionMessage('שגיאה בחיבור מחדש')
        }
      } catch {
        setActionMessage('שגיאה בחיבור מחדש')
      }
    })
  }

  async function handleDisconnect(phoneId: string) {
    if (!confirm('בטוח שרוצה לנתק את המספר?')) return
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/phone-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneId, action: 'disconnect' }),
        })
        if (res.ok) {
          setActionMessage('המספר נותק בהצלחה')
          window.location.reload()
        } else {
          setActionMessage('שגיאה בניתוק')
        }
      } catch {
        setActionMessage('שגיאה בניתוק')
      }
    })
  }

  async function handleRegister() {
    if (!newPhone.trim()) return
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/phone-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            phoneNumber: newPhone.trim(),
            serverNode: newNode.trim() || null,
          }),
        })
        if (res.ok) {
          setActionMessage('סים נרשם בהצלחה')
          setNewPhone('')
          setNewNode('')
          setShowRegisterForm(false)
        } else {
          setActionMessage('שגיאה ברישום הסים')
        }
      } catch {
        setActionMessage('שגיאה ברישום הסים')
      }
    })
  }

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="סה״כ מספרים"
          value={counts.total}
          color="info"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <AdminStatCard
          label="מחוברים"
          value={counts.connected}
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <AdminStatCard
          label="מנותקים"
          value={counts.disconnected}
          color="danger"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        />
        <AdminStatCard
          label="פנויים"
          value={counts.free}
          sublabel="ללא עסק מוקצה"
          color="warning"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          }
        />
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className="text-sm text-center py-2 px-4 rounded-xl bg-info-bg text-info">
          {actionMessage}
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + רישום סים חדש
        </button>
      </div>

      {/* Register Form */}
      {showRegisterForm && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-text mb-4">רישום סים חדש</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">מספר טלפון</label>
              <input
                type="text"
                placeholder="972501234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">שרת (Server Node)</label>
              <input
                type="text"
                placeholder="node-1"
                value={newNode}
                onChange={(e) => setNewNode(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                dir="ltr"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={isPending || !newPhone.trim()}
              className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
            >
              {isPending ? 'רושם...' : 'רשום'}
            </button>
            <button
              onClick={() => {
                setShowRegisterForm(false)
                setNewPhone('')
                setNewNode('')
              }}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Phone Numbers Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">מספר</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">עסק</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">Session</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">סטטוס</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">בעלות</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">שרת</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">בדיקה אחרונה</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {phones.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-text-muted">
                    אין מספרי טלפון רשומים
                  </td>
                </tr>
              ) : (
                phones.map((phone) => {
                  const config = statusConfig[phone.status] || {
                    label: phone.status,
                    color: 'bg-neutral-bg text-neutral',
                    dotColor: 'bg-neutral',
                  }
                  return (
                    <tr
                      key={phone.id}
                      className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-text">
                          {phone.phone_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {phone.business_name || (
                          <span className="text-text-muted text-xs">פנוי</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-text-muted">
                          {phone.session_id || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1.5',
                            config.color
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {phone.ownership === 'platform' ? 'פלטפורמה' : 'לקוח'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-text-muted">
                          {phone.server_node || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {phone.last_health_check
                          ? new Date(phone.last_health_check).toLocaleString('he-IL')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        {phone.status === 'disconnected' && (
                          <button
                            onClick={() => handleReconnect(phone.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                          >
                            חבר מחדש
                          </button>
                        )}
                        {phone.status === 'connected' && (
                          <button
                            onClick={() => handleDisconnect(phone.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          >
                            נתק
                          </button>
                        )}
                        {phone.status === 'pending_qr' && (
                          <button
                            onClick={() => handleReconnect(phone.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                          >
                            סרוק QR
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  )
}
