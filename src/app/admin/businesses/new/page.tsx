'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { ArrowRight } from 'lucide-react'

const businessTypes = [
  { value: 'barbershop', label: 'מספרה' },
  { value: 'beauty', label: 'קוסמטיקה' },
  { value: 'fitness', label: 'כושר' },
  { value: 'health', label: 'רפואה' },
  { value: 'accounting', label: 'רואה חשבון' },
  { value: 'restaurant', label: 'מסעדה' },
  { value: 'other', label: 'אחר' },
]

export default function NewBusinessPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    businessName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
    businessType: '',
    description: '',
    howItWorks: '',
    clientStatus: 'active' as 'lead' | 'active',
    assignedTo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.businessName || !form.ownerEmail || !form.businessType) {
      setError('שם עסק, מייל וסוג עסק הם שדות חובה')
      return
    }
    if (form.ownerPassword && form.ownerPassword.length < 6) {
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
      router.push('/admin/businesses')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/businesses"
          className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white border border-[#E8EFE9] transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-[#1B2E24]" />
        </Link>
        <h1 className="text-xl font-bold text-[#1B2E24]">לקוח חדש</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8EFE9] p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Business Name */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">שם העסק *</label>
          <input
            type="text"
            value={form.businessName}
            onChange={(e) => updateField('businessName', e.target.value)}
            placeholder="למשל: מספרת שמואל"
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">מייל *</label>
          <input
            type="email"
            value={form.ownerEmail}
            onChange={(e) => updateField('ownerEmail', e.target.value)}
            placeholder="email@example.com"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">סיסמה *</label>
          <input
            type="password"
            value={form.ownerPassword}
            onChange={(e) => updateField('ownerPassword', e.target.value)}
            placeholder="לפחות 6 תווים"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">מספר טלפון *</label>
          <input
            type="tel"
            value={form.ownerPhone}
            onChange={(e) => updateField('ownerPhone', e.target.value)}
            placeholder="050-0000000"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Business Type */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">סוג עסק</label>
          <select
            value={form.businessType}
            onChange={(e) => updateField('businessType', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          >
            <option value="">בחר סוג עסק</option>
            {businessTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">תיאור העסק</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
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
            onChange={(e) => updateField('howItWorks', e.target.value)}
            placeholder="לקוחות קובעים תור בוואטסאפ, מגיעים, משלמים במזומן או בכרטיס אשראי..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Client Status */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-2">סטטוס</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clientStatus"
                checked={form.clientStatus === 'lead'}
                onChange={() => updateField('clientStatus', 'lead')}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-[#1B2E24]">לקוח פוטנציאלי</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="clientStatus"
                checked={form.clientStatus === 'active'}
                onChange={() => updateField('clientStatus', 'active')}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-[#1B2E24]">לקוח פעיל</span>
            </label>
          </div>
        </div>

        {/* Assigned To */}
        <div>
          <label className="block text-sm font-medium text-[#1B2E24] mb-1">מטפל אחראי</label>
          <input
            type="text"
            value={form.assignedTo}
            onChange={(e) => updateField('assignedTo', e.target.value)}
            placeholder="שם המטפל האחראי"
            className="w-full px-4 py-3 rounded-xl border border-[#E8EFE9] text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-start pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 btn-primary text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    className="opacity-75"
                  />
                </svg>
                יוצר לקוח...
              </>
            ) : (
              'צור לקוח'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
