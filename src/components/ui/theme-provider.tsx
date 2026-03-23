'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

function lighten(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * ratio)
  const lg = Math.round(g + (255 - g) * ratio)
  const lb = Math.round(b + (255 - b) * ratio)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/**
 * Applies the business theme colors once on mount.
 * No re-render loops — runs once.
 */
export function ThemeProvider() {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function loadTheme() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: bu } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', user.id)
          .single()
        if (!bu) return

        const { data } = await supabase
          .from('business_settings')
          .select('ai_config')
          .eq('business_id', bu.business_id)
          .single()

        if (data?.ai_config?.theme) {
          const theme = data.ai_config.theme
          const root = document.documentElement
          root.style.setProperty('--color-primary', theme.primary)
          root.style.setProperty('--color-primary-dark', theme.primaryDark)
          root.style.setProperty('--color-primary-light', lighten(theme.primary, 0.9))
        }
      } catch {
        // Silent fail — use default theme
      }
    }

    loadTheme()
  }, [])

  return null
}
