'use client'

import { useState, useMemo } from 'react'
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

// ── Business Type Options ──
const businessTypes = [
  { value: 'barbershop', label: 'מספרה' },
  { value: 'beauty', label: 'קוסמטיקה' },
  { value: 'fitness', label: 'כושר' },
  { value: 'health', label: 'רפואה' },
  { value: 'accounting', label: 'רואה חשבון' },
  { value: 'restaurant', label: 'מסעדה' },
  { value: 'other', label: 'אחר' },
]

// ── New Business Form ──
function NewBusinessForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
    businessType: '',
    description: '',
    howItWorks: '',
    clientStatus: 'active' as 'lead' | 'active',
    assignedTo: '',
    notes: '',
    plan: 'trial',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ tempPassword: string; businessId: string } | null>(null)

  const handleSubmit = async () => {
    if (!form.businessName || !form.ownerEmail || !form.ownerPassword || !form.ownerPhone || !form.businessType) {
      setError('שם עסק, אימייל, סיסמה, טלפון וסוג עסק הם שדות חובה')
      return
    }
    if (form.ownerPassword.length < 6) {
      setError('סיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/admin/create-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setResult({ tempPassword: data.tempPassword, businessId: data.businessId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1B2E24]">עסק נוצר בהצלחה!</h3>
              <p className="text-sm text-[#6B7B73]">{form.businessName}</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800">פרטי התחברות (שמור!):</p>
            <p className="text-sm text-amber-700">אימייל: <span className="font-mono font-bold">{form.ownerEmail}</span></p>
            <p className="text-sm text-amber-700">סיסמה: <span className="font-mono font-bold">{result.tempPassword}</span></p>
          </div>
          <button
            onClick={() => { onCreated(); onClose() }}
            className="w-full py-3 btn-primary text-white text-sm font-semibold rounded-xl"
          >
            סגור
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom,16px)]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8EFE9] px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-[#1B2E24]">לקוח חדש</h2>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">שם העסק *</label>
            <input
              type="text"
              value={form.businessName}
              onChange={e => updateField('businessName', e.target.value)}
              placeholder="למשל: מספרת שמואל"
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">שם בעל העסק</label>
            <input
              type="text"
              value={form.ownerName}
              onChange={e => updateField('ownerName', e.target.value)}
              placeholder="שם מלא"
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Owner Email */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">מייל *</label>
            <input
              type="email"
              value={form.ownerEmail}
              onChange={e => updateField('ownerEmail', e.target.value)}
              placeholder="email@example.com"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">סיסמה *</label>
            <input
              type="text"
              value={form.ownerPassword}
              onChange={e => updateField('ownerPassword', e.target.value)}
              placeholder="לפחות 6 תווים"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Owner Phone */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">מספר טלפון *</label>
            <input
              type="tel"
              value={form.ownerPhone}
              onChange={e => updateField('ownerPhone', e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Client Status */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">סטטוס לקוח</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateField('clientStatus', 'active')}
                className={cn(
                  'flex-1 py-3 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2',
                  form.clientStatus === 'active'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-[#E8EFE9] text-[#6B7B73] hover:border-gray-300'
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                לקוח פעיל
              </button>
              <button
                onClick={() => updateField('clientStatus', 'lead')}
                className={cn(
                  'flex-1 py-3 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2',
                  form.clientStatus === 'lead'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-[#E8EFE9] text-[#6B7B73] hover:border-gray-300'
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                לקוח פוטנציאלי
              </button>
            </div>
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">סוג העסק *</label>
            <select
              value={form.businessType}
              onChange={e => updateField('businessType', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            >
              <option value="">בחר סוג עסק</option>
              {businessTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">אחראי / בטיפול של</label>
            <div className="flex flex-wrap gap-2">
              {['אורי', 'אלעד', 'דניאל', 'יבגני', 'איליה'].map(name => (
                <button
                  key={name}
                  onClick={() => updateField('assignedTo', form.assignedTo === name ? '' : name)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                    form.assignedTo === name
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]'
                      : 'border-[#E8EFE9] text-[#6B7B73] hover:border-gray-300'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">הערות פנימיות</label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="הערות לשימוש פנימי בלבד..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">תיאור העסק</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="מספרת גברים בראשון לציון, מתמחים בפיידים ועיצוב זקן..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* How It Works */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">איך העסק עובד</label>
            <textarea
              value={form.howItWorks}
              onChange={e => updateField('howItWorks', e.target.value)}
              placeholder="לקוחות קובעים תור בוואטסאפ, מגיעים, משלמים במזומן או בכרטיס אשראי..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          {/* Plan */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1">תוכנית</label>
            <div className="flex gap-2">
              {['trial', 'basic', 'pro', 'premium'].map(p => (
                <button
                  key={p}
                  onClick={() => updateField('plan', p)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
                    form.plan === p
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]'
                      : 'border-[#E8EFE9] text-[#6B7B73] hover:border-gray-300'
                  )}
                >
                  {planLabels[p] || p}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 mb-4 btn-primary text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" /></svg>
                יוצר עסק...
              </>
            ) : (
              'צור עסק חדש'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BusinessesClient({ businesses }: BusinessesClientProps) {
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRow | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

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
      {/* New Business Modal */}
      {showNewForm && (
        <NewBusinessForm
          onClose={() => setShowNewForm(false)}
          onCreated={() => window.location.reload()}
        />
      )}

      {/* Header + Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1B2E24]">עסקים ({businesses.length})</h1>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          לקוח חדש
        </button>
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
