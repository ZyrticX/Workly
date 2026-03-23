'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'
import { AdminStatCard } from '@/components/admin/admin-stat-card'

interface Sim {
  id: string
  phone_number: string
  display_name: string | null
  session_id: string | null
  server_node: string | null
  status: string
  sim_status: 'free' | 'allocated' | 'problem'
  business_id: string | null
  business_name: string | null
  last_health_check: string | null
  created_at: string
}

interface Business {
  id: string
  name: string
}

interface SimsClientProps {
  sims: Sim[]
  businesses: Business[]
  counts: {
    free: number
    allocated: number
    problem: number
  }
}

const simStatusConfig: Record<string, { label: string; color: string }> = {
  free: { label: 'פנוי', color: 'bg-success-bg text-success' },
  allocated: { label: 'מוקצה', color: 'bg-info-bg text-info' },
  problem: { label: 'בעייתי', color: 'bg-danger-bg text-danger' },
}

export function SimsClient({ sims, businesses, counts }: SimsClientProps) {
  const [allocatingId, setAllocatingId] = useState<string | null>(null)
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newNode, setNewNode] = useState('')
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  async function handleAllocate(simId: string) {
    if (!selectedBusinessId) return
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/sim-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'allocate',
            simId,
            businessId: selectedBusinessId,
          }),
        })
        if (res.ok) {
          setActionMessage('הסים הוקצה בהצלחה')
          setAllocatingId(null)
          setSelectedBusinessId('')
        } else {
          setActionMessage('שגיאה בהקצאת הסים')
        }
      } catch {
        setActionMessage('שגיאה בהקצאת הסים')
      }
    })
  }

  async function handleRegister() {
    if (!newPhone.trim()) return
    setActionMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/sim-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            phoneNumber: newPhone.trim(),
            serverNode: newNode.trim() || null,
          }),
        })
        if (res.ok) {
          setActionMessage('סים חדש נרשם בהצלחה')
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

  const filteredSims = statusFilter === 'all'
    ? sims
    : sims.filter((s) => s.sim_status === statusFilter)

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminStatCard
          label="פנויים"
          value={counts.free}
          sublabel="מוכנים להקצאה"
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <AdminStatCard
          label="מוקצים"
          value={counts.allocated}
          sublabel="מחוברים לעסקים"
          color="info"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          }
        />
        <AdminStatCard
          label="בעייתיים"
          value={counts.problem}
          sublabel="מנותקים עם עסק"
          color="danger"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

      {/* Actions & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          + רישום סים חדש
        </button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="free">פנויים</option>
          <option value="allocated">מוקצים</option>
          <option value="problem">בעייתיים</option>
        </select>
        <span className="text-xs text-text-muted">
          {filteredSims.length} תוצאות
        </span>
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
              <label className="text-xs text-text-muted mb-1 block">שרת</label>
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

      {/* SIMs Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">מספר</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">סטטוס סים</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">עסק מוקצה</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">חיבור</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">שרת</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">בדיקה אחרונה</th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredSims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    אין סימים להצגה
                  </td>
                </tr>
              ) : (
                filteredSims.map((sim) => {
                  const config = simStatusConfig[sim.sim_status]
                  return (
                    <tr
                      key={sim.id}
                      className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-text">
                          {sim.phone_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md',
                            config.color
                          )}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {sim.business_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md',
                            sim.status === 'connected'
                              ? 'bg-success-bg text-success'
                              : sim.status === 'pending_qr'
                              ? 'bg-warning-bg text-warning'
                              : 'bg-danger-bg text-danger'
                          )}
                        >
                          {sim.status === 'connected'
                            ? 'מחובר'
                            : sim.status === 'pending_qr'
                            ? 'ממתין'
                            : 'מנותק'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {sim.server_node || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {sim.last_health_check
                          ? new Date(sim.last_health_check).toLocaleString('he-IL')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {sim.sim_status === 'free' && (
                          <>
                            {allocatingId === sim.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedBusinessId}
                                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                                  className="px-2 py-1.5 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 max-w-[140px]"
                                >
                                  <option value="">בחר עסק...</option>
                                  {businesses.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAllocate(sim.id)}
                                  disabled={isPending || !selectedBusinessId}
                                  className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] disabled:opacity-50"
                                >
                                  אשר
                                </button>
                                <button
                                  onClick={() => {
                                    setAllocatingId(null)
                                    setSelectedBusinessId('')
                                  }}
                                  className="text-xs text-text-muted hover:text-text"
                                >
                                  ביטול
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAllocatingId(sim.id)}
                                className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
                              >
                                הקצה לעסק
                              </button>
                            )}
                          </>
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
