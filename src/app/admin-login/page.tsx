'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B2E24] px-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Workly Admin</h1>
          <p className="text-sm text-white/50 mt-1">פאנל ניהול</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 space-y-4 border border-white/10">
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-sm text-red-200 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@workly.com"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-base focus:outline-none focus:ring-2 focus:ring-white/30"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-base focus:outline-none focus:ring-2 focus:ring-white/30"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-[#1B2E24] text-sm font-bold rounded-xl hover:bg-white/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" /></svg>
                מתחבר...
              </>
            ) : (
              'כניסה לפאנל ניהול'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">Workly Admin Panel v1.0</p>
      </div>
    </div>
  )
}
