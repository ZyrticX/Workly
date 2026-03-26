'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('אימייל או סיסמה שגויים')
        } else {
          setError(authError.message)
        }
        return
      }

      // Keep loading state while redirecting
      router.push('/')
      router.refresh()
      // Don't set loading=false - let the overlay show until page changes
      return
    } catch {
      setError('שגיאה בהתחברות. נסה שוב.')
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
          <span className="text-sm font-medium text-text-secondary">מתחבר...</span>
        </div>
      )}

      {/* Logo / Header */}
      <div className="text-center space-y-3">
        <img src="/logo.png" alt="Logo" className="w-28 h-28 rounded-2xl object-contain mx-auto" />
        <h1 className="text-2xl font-bold text-text">התחברות</h1>
        <p className="text-text-secondary text-sm">היכנס לחשבון העסקי שלך</p>
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
          <label htmlFor="password" className="block text-sm font-medium text-text">
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className="w-full px-4 py-3 rounded-xl border border-gray-200/50 bg-white/80 text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 transition-ios min-h-[48px]"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-label="התחבר לחשבון"
          className="w-full py-3 px-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold shadow-ios hover:bg-[var(--color-primary-dark)] press-effect transition-ios disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
        >
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center text-sm text-text-secondary">
        אין לך חשבון?{' '}
        <Link href="/register" className="text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-dark)] transition-colors">
          הרשם עכשיו
        </Link>
      </p>
    </div>
  )
}
