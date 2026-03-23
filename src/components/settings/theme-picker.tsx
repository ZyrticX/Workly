'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Loader2, Save, CheckCircle2, Palette } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ThemeConfig } from '@/hooks/use-theme'

// ── Preset Themes ───────────────────────────────────────

interface PresetTheme {
  id: string
  label: string
  primary: string
  primaryDark: string
}

const PRESETS: PresetTheme[] = [
  { id: 'whatsapp', label: 'ירוק', primary: '#25D366', primaryDark: '#128C7E' },
  { id: 'ocean', label: 'כחול', primary: '#3B82F6', primaryDark: '#1D4ED8' },
  { id: 'purple', label: 'סגול', primary: '#8B5CF6', primaryDark: '#6D28D9' },
  { id: 'sunset', label: 'כתום', primary: '#F97316', primaryDark: '#EA580C' },
  { id: 'rose', label: 'ורוד', primary: '#EC4899', primaryDark: '#DB2777' },
  { id: 'slate', label: 'אפור', primary: '#64748B', primaryDark: '#475569' },
]

// ── Helpers ─────────────────────────────────────────────

function lighten(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const lr = Math.round(r + (255 - r) * ratio)
  const lg = Math.round(g + (255 - g) * ratio)
  const lb = Math.round(b + (255 - b) * ratio)

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}

// ── Preview Component ───────────────────────────────────

function ThemePreview({ primary, primaryDark }: { primary: string; primaryDark: string }) {
  const primaryLight = lighten(primary, 0.9)

  return (
    <div className="rounded-xl border border-gray-100/50 bg-gray-50/50 p-4 space-y-3">
      <p className="text-xs font-medium text-gray-500 mb-2">תצוגה מקדימה</p>

      {/* Mini nav bar */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2.5"
        style={{ backgroundColor: primary }}
      >
        <span className="text-sm font-semibold text-white">העסק שלי</span>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-white/60" />
          <div className="h-2 w-2 rounded-full bg-white/60" />
          <div className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Mini stat cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div
            className="mb-1 text-lg font-bold"
            style={{ color: primary }}
          >
            24
          </div>
          <div className="text-[10px] text-gray-500">תורים היום</div>
        </div>
        <div
          className="rounded-lg p-3 shadow-sm"
          style={{ backgroundColor: primaryLight }}
        >
          <div
            className="mb-1 text-lg font-bold"
            style={{ color: primaryDark }}
          >
            89%
          </div>
          <div className="text-[10px]" style={{ color: primaryDark, opacity: 0.7 }}>
            שביעות רצון
          </div>
        </div>
      </div>

      {/* Mini button */}
      <button
        type="button"
        className="w-full rounded-xl py-2 text-sm font-medium text-white transition-ios"
        style={{ backgroundColor: primary }}
      >
        קביעת תור חדש
      </button>
    </div>
  )
}

// Module-level singleton — avoids creating a new client on every render
const supabase = createClient()

// ── Main ThemePicker ────────────────────────────────────

export default function ThemePicker({ businessId }: { businessId: string }) {

  const [selectedPreset, setSelectedPreset] = useState<string | null>('whatsapp')
  const [primary, setPrimary] = useState('#25D366')
  const [primaryDark, setPrimaryDark] = useState('#128C7E')
  const [isCustom, setIsCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load existing theme
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('business_settings')
          .select('ai_config')
          .eq('business_id', businessId)
          .single()

        if (data?.ai_config?.theme) {
          const t = data.ai_config.theme as ThemeConfig
          setPrimary(t.primary)
          setPrimaryDark(t.primaryDark)

          if (t.preset) {
            const found = PRESETS.find((p) => p.id === t.preset)
            if (found) {
              setSelectedPreset(t.preset)
              setIsCustom(false)
            } else {
              setSelectedPreset(null)
              setIsCustom(true)
            }
          } else {
            setSelectedPreset(null)
            setIsCustom(true)
          }
        }
      } catch {
        // Use defaults
      }
      setLoaded(true)
    }

    load()
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply preset
  const applyPreset = useCallback((preset: PresetTheme) => {
    setSelectedPreset(preset.id)
    setPrimary(preset.primary)
    setPrimaryDark(preset.primaryDark)
    setIsCustom(false)
  }, [])

  // Switch to custom
  const switchToCustom = useCallback(() => {
    setSelectedPreset(null)
    setIsCustom(true)
  }, [])

  // Save theme
  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      // First get existing ai_config
      const { data: existing } = await supabase
        .from('business_settings')
        .select('ai_config')
        .eq('business_id', businessId)
        .single()

      const currentConfig = existing?.ai_config || {}

      const themeData: ThemeConfig = {
        primary,
        primaryDark,
        preset: selectedPreset,
      }

      await supabase
        .from('business_settings')
        .upsert(
          {
            business_id: businessId,
            ai_config: {
              ...currentConfig,
              theme: themeData,
            },
          },
          { onConflict: 'business_id' }
        )

      // Apply to DOM immediately
      const root = document.documentElement
      root.style.setProperty('--color-primary', primary)
      root.style.setProperty('--color-primary-dark', primaryDark)
      root.style.setProperty('--color-primary-light', lighten(primary, 0.9))

      // Save to cookie for SSR (no flash on next load)
      document.cookie = `wa-theme-primary=${primary};path=/;max-age=31536000;SameSite=Lax`
      document.cookie = `wa-theme-dark=${primaryDark};path=/;max-age=31536000;SameSite=Lax`

      // Save to localStorage as backup
      localStorage.setItem('wa-theme', JSON.stringify({ primary, primaryDark, preset: selectedPreset }))

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save theme:', err)
    }

    setSaving(false)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Preset themes */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          ערכות צבעים מוכנות
        </label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PRESETS.map((preset) => {
            const isActive = selectedPreset === preset.id && !isCustom
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-ios press-effect',
                  isActive
                    ? 'border-gray-800 bg-white shadow-ios'
                    : 'border-transparent bg-white/40 hover:bg-white/80'
                )}
              >
                {/* Color circle */}
                <div className="relative">
                  <div
                    className="h-10 w-10 rounded-full shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.primaryDark} 50%)`,
                    }}
                  />
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom color option */}
      <div>
        <button
          type="button"
          onClick={switchToCustom}
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-ios press-effect',
            isCustom
              ? 'border-gray-800 bg-white shadow-ios text-gray-800'
              : 'border-transparent bg-white/40 text-gray-600 hover:bg-white/80'
          )}
        >
          <Palette className="h-4 w-4" />
          צבע מותאם אישית
        </button>

        {isCustom && (
          <div className="mt-3 grid grid-cols-2 gap-4 rounded-xl border border-gray-100/50 bg-white/40 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                צבע ראשי
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => {
                    setPrimary(e.target.value)
                    setSelectedPreset(null)
                  }}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  value={primary}
                  onChange={(e) => {
                    const val = e.target.value
                    setPrimary(val)
                    if (isValidHex(val)) setSelectedPreset(null)
                  }}
                  maxLength={7}
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-center"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                צבע כהה
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryDark}
                  onChange={(e) => {
                    setPrimaryDark(e.target.value)
                    setSelectedPreset(null)
                  }}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  value={primaryDark}
                  onChange={(e) => {
                    const val = e.target.value
                    setPrimaryDark(val)
                    if (isValidHex(val)) setSelectedPreset(null)
                  }}
                  maxLength={7}
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono text-center"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <ThemePreview primary={primary} primaryDark={primaryDark} />

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-ios',
          saved
            ? 'bg-green-500 shadow-ios'
            : saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[var(--color-primary)] shadow-ios hover:bg-[var(--color-primary-dark)] press-effect'
        )}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? 'שומר...' : saved ? 'נשמר!' : 'שמור שינויים'}
      </button>
    </div>
  )
}
