'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        const { data: bu } = await supabase
          .from('business_users')
          .select('business_id, businesses(name)')
          .eq('user_id', user.id)
          .single()
        if (bu) {
          setBusinessId(bu.business_id)
          const biz = bu.businesses as { name?: string } | null
          setBusinessName(biz?.name || null)
        }
      }
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setBusinessId(null)
        setBusinessName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, businessId, businessName, loading }
}
