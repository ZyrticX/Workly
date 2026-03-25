'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { BusinessDetailModal } from '@/components/admin/business-detail-modal'

interface BusinessPhone {
  id: string
  phone_number: string
  status: string
  session_id: string | null
}

interface BusinessBilling {
  plan: string
  monthly_price: number
  status: string
  next_billing_date: string | null
}

interface BusinessRow {
  id: string
  name: string
  business_type: string | null
  plan: string
  status: string
  created_at: string
  owner_email: string | null
  phone_number: string | null
  phone_status: string | null
  phones: BusinessPhone[]
  billing: BusinessBilling | null
}

interface BusinessesClientProps {
  businesses: BusinessRow[]
}

const planLabels: Record<string, string> = {
  trial: 'ניסיון',
  basic: 'בסיסי',
  pro: 'מקצועי',
  premium: 'פרימיום',
}

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  suspended: 'מושעה',
  trial: 'ניסיון',
  lead: 'פוטנציאלי',
  onboarding: 'בהקמה',
}

const planColors: Record<string, string> = {
  trial: 'bg-warning-bg text-warning',
  basic: 'bg-neutral-bg text-neutral',
  pro: 'bg-info-bg text-info',
  premium: 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]',
}

const statusColors: Record<string, string> = {
  active: 'bg-success-bg text-success',
  suspended: 'bg-danger-bg text-danger',
  trial: 'bg-warning-bg text-warning',
  lead: 'bg-amber-100 text-amber-700',
  onboarding: 'bg-blue-100 text-blue-700',
}

export function BusinessesClient({ businesses }: BusinessesClientProps) {
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null)

  const filtered = useMemo(() => {
    return businesses.filter((biz) => {
      const matchesSearch =
        search === '' ||
        biz.name.toLowerCase().includes(search.toLowerCase()) ||
        biz.owner_email?.toLowerCase().includes(search.toLowerCase())

      const matchesPlan = planFilter === 'all' || biz.plan === planFilter
      const matchesStatus = statusFilter === 'all' || biz.status === statusFilter

      return matchesSearch && matchesPlan && matchesStatus
    })
  }, [businesses, search, planFilter, statusFilter])

  return (
    <>
      {/* Header + Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1B2E24]">עסקים ({businesses.length})</h1>
        <Link
          href="/admin/businesses/new"
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          לקוח חדש
        </Link>
      </div>

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
            placeholder="חיפוש לפי שם עסק..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Plan filter */}
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        >
          <option value="all">כל התוכניות</option>
          <option value="trial">ניסיון</option>
          <option value="basic">בסיסי</option>
          <option value="pro">מקצועי</option>
          <option value="premium">פרימיום</option>
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="suspended">מושעה</option>
          <option value="trial">ניסיון</option>
        </select>

        {/* Count */}
        <span className="text-xs text-text-muted">
          {filtered.length} תוצאות
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  שם עסק
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  סוג
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  תוכנית
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  סטטוס
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  טלפון
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  בעלים
                </th>
                <th className="text-start px-4 py-3 font-semibold text-text-muted text-xs">
                  הצטרפות
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    לא נמצאו עסקים
                  </td>
                </tr>
              ) : (
                filtered.map((biz) => (
                  <tr
                    key={biz.id}
                    onClick={() => setSelectedBusiness(biz)}
                    className="border-b border-border/50 hover:bg-surface/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-text">{biz.name}</span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {biz.business_type || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-md',
                          planColors[biz.plan] || 'bg-neutral-bg text-neutral'
                        )}
                      >
                        {planLabels[biz.plan] || biz.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-md',
                          statusColors[biz.status] || 'bg-neutral-bg text-neutral'
                        )}
                      >
                        {statusLabels[biz.status] || biz.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {biz.phone_number ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              biz.phone_status === 'connected'
                                ? 'bg-success'
                                : biz.phone_status === 'pending_qr'
                                ? 'bg-warning'
                                : 'bg-danger'
                            )}
                          />
                          <span className="font-mono text-xs text-text-secondary">
                            {biz.phone_number}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[160px]">
                      {biz.owner_email || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(biz.created_at).toLocaleDateString('he-IL')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* Detail Modal */}
      <BusinessDetailModal
        business={
          selectedBusiness
            ? {
                ...selectedBusiness,
                messages_count: 0,
                contacts_count: 0,
              }
            : null
        }
        open={!!selectedBusiness}
        onClose={() => setSelectedBusiness(null)}
      />
    </>
  )
}
