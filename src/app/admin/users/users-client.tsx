'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils/cn'

interface UserRow {
  id: string
  email: string
  created_at: string
  business_name: string | null
  role: string | null
  plan: string | null
}

interface UsersClientProps {
  users: UserRow[]
}

const roleLabels: Record<string, string> = {
  owner: 'בעלים',
  agent: 'סוכן',
}

const planLabels: Record<string, string> = {
  trial: 'ניסיון',
  basic: 'בסיסי',
  pro: 'מקצועי',
  premium: 'פרימיום',
}

const planColors: Record<string, string> = {
  trial: 'bg-warning-bg text-warning',
  basic: 'bg-neutral-bg text-neutral',
  pro: 'bg-info-bg text-info',
  premium: 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]',
}

export function UsersClient({ users }: UsersClientProps) {
  const [search, setSearch] = useState('')
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.business_name?.toLowerCase().includes(q)
    )
  }, [users, search])

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setResetMessage({ type: 'error', text: 'סיסמה חייבת להכיל לפחות 6 תווים' })
      return
    }

    setResetLoading(true)
    setResetMessage(null)

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResetMessage({ type: 'error', text: data.error || 'שגיאה באיפוס הסיסמה' })
      } else {
        setResetMessage({ type: 'success', text: 'הסיסמה אופסה בהצלחה' })
        setNewPassword('')
        setTimeout(() => {
          setResetUserId(null)
          setResetMessage(null)
        }, 2000)
      }
    } catch {
      setResetMessage({ type: 'error', text: 'שגיאת רשת' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      {/* Filters */}
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
            placeholder="חיפוש לפי אימייל או שם עסק..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Count */}
        <span className="text-xs text-text-muted">
          {filtered.length} תוצאות
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  מייל
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  שם עסק
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  תפקיד
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  תוכנית
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  תאריך הצטרפות
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted">
                    לא נמצאו משתמשים
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-surface/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-text text-xs">{user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {user.business_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {user.role ? (
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md',
                            user.role === 'owner'
                              ? 'bg-info-bg text-info'
                              : 'bg-neutral-bg text-neutral'
                          )}
                        >
                          {roleLabels[user.role] || user.role}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.plan ? (
                        <span
                          className={cn(
                            'text-[11px] font-medium px-2 py-0.5 rounded-md',
                            planColors[user.plan] || 'bg-neutral-bg text-neutral'
                          )}
                        >
                          {planLabels[user.plan] || user.plan}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(user.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3">
                      {resetUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="סיסמה חדשה"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-32 px-2 py-1.5 rounded-lg border border-border bg-white text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                            autoFocus
                          />
                          <button
                            onClick={() => handleResetPassword(user.id)}
                            disabled={resetLoading}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {resetLoading ? '...' : 'אישור'}
                          </button>
                          <button
                            onClick={() => {
                              setResetUserId(null)
                              setNewPassword('')
                              setResetMessage(null)
                            }}
                            className="px-2 py-1.5 rounded-lg text-xs text-text-muted hover:bg-surface transition-colors"
                          >
                            ביטול
                          </button>
                          {resetMessage && (
                            <span
                              className={cn(
                                'text-[11px]',
                                resetMessage.type === 'success' ? 'text-success' : 'text-danger'
                              )}
                            >
                              {resetMessage.text}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResetUserId(user.id)
                            setNewPassword('')
                            setResetMessage(null)
                          }}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-surface transition-colors"
                        >
                          אפס סיסמה
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
