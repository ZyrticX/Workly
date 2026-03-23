'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface ThemeConfig {
  primary: string
  primaryDark: string
  preset: string | null
}

const DEFAULT_THEME: ThemeConfig = {
  primary: '#25D366',
  primaryDark: '#128C7E',
  preset: 'whatsapp',
}

const STORAGE_KEY = 'wa-theme'

function lighten(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * ratio)
  const lg = Math.round(g + (255 - g) * ratio)
  const lb = Math.round(b + (255 - b) * ratio)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function applyThemeToDOM(theme: ThemeConfig) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-primary-dark', theme.primaryDark)
  root.style.setProperty('--color-primary-light', lighten(theme.primary, 0.9))
}

// Load from localStorage IMMEDIATELY (before React renders)
function getInitialTheme(): ThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ThemeConfig
      // Apply immediately to prevent flash
      applyThemeToDOM(parsed)
      return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

export function useTheme(businessId: string | null) {
  const [theme, setThemeState] = useState<ThemeConfig>(getInitialTheme)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Sync with Supabase in the background
  useEffect(() => {
    if (!businessId) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('business_settings')
          .select('ai_config')
          .eq('business_id', businessId)
          .single()

        if (data?.ai_config?.theme) {
          const saved = data.ai_config.theme as ThemeConfig
          setThemeState(saved)
          applyThemeToDOM(saved)
          // Cache for next page load (localStorage + cookie for SSR)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
          document.cookie = `wa-theme-primary=${saved.primary};path=/;max-age=31536000`
          document.cookie = `wa-theme-dark=${saved.primaryDark};path=/;max-age=31536000`
        } else {
          applyThemeToDOM(theme)
        }
      } catch {
        applyThemeToDOM(theme)
      }
      setLoading(false)
    }

    load()
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = useCallback((newTheme: ThemeConfig) => {
    setThemeState(newTheme)
    applyThemeToDOM(newTheme)
    // Cache immediately (localStorage + cookie for SSR)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme))
    document.cookie = `wa-theme-primary=${newTheme.primary};path=/;max-age=31536000`
    document.cookie = `wa-theme-dark=${newTheme.primaryDark};path=/;max-age=31536000`
  }, [])

  return { theme, setTheme, loading }
}
