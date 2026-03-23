'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerBusiness } from '@/lib/auth/register'

const BUSINESS_TYPES = [
  'מספרה',
  'קוסמטיקה',
  'ציפורניים',
  'מאמן אישי',
  'בריאות',
  'שירותים מקצועיים',
  'חינוך',
  'בעלי מלאכה',
  'אחר',
]

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!/^05\d{8}$/.test(phone)) {
      setError('מספר טלפון לא תקין (05XXXXXXXX)')
      return
    }

    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים')
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError('הסיסמה חייבת להכיל לפחות אות גדולה אחת')
      return
    }

    if (!/[0-9]/.test(password)) {
      setError('הסיסמה חייבת להכיל לפחות ספרה אחת')
      return
    }

    if (!businessType) {
      setError('יש לבחור סוג עסק')
      return
    }

    setLoading(true)

    try {
      const result = await registerBusiness({
        fullName,
        email,
        phone,
        password,
        businessName,
        businessType,
      })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      router.push('/onboarding')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בהרשמה. נסה שוב.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative space-y-8">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl glass-strong">
          <svg className="w-8 h-8 text-[var(--color-primary)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-text-secondary">יוצר חשבון...</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-2xl object-contain mx-auto" />
        <h1 className="text-2xl font-bold text-text">הרשמה לעסק</h1>
        <p className="text-text-secondary text-sm">צור חשבון חדש והתחל לנהל את העסק שלך</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-bg/80 backdrop-blur-sm border border-danger/20 text-danger text-sm rounded-2xl p-4">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="fullName" className="block text-sm font-medium text-text">
            שם מלא
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ישראל ישראלי"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-text">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="block text-sm font-medium text-text">
            טלפון
          </label>
          <input
            id="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0501234567"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-text">
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="לפחות 8 תווים, אות גדולה וספרה"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
            dir="ltr"
          />
          <p className="text-xs text-text-muted">לפחות 8 תווים, אות גדולה אחת וספרה אחת</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="businessName" className="block text-sm font-medium text-text">
            שם העסק
          </label>
          <input
            id="businessName"
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="שם העסק שלך"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="businessType" className="block text-sm font-medium text-text">
            סוג עסק
          </label>
          <select
            id="businessType"
            required
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios appearance-none min-h-[48px]"
          >
            <option value="">בחר סוג עסק</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-label="צור חשבון חדש"
          className="w-full py-3 px-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold shadow-ios hover:bg-[var(--color-primary-dark)] press-effect transition-ios disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {loading ? 'נרשם...' : 'צור חשבון'}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-text-secondary">
        כבר יש לך חשבון?{' '}
        <Link href="/login" className="text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-dark)] transition-colors">
          התחבר
        </Link>
      </p>
    </div>
  )
}
