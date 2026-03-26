'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToastContext } from '@/components/ui/toast'
import QrScanner from '@/components/admin/qr-scanner'
import ThemePicker from '@/components/settings/theme-picker'
import {
  Settings,
  Clock,
  Briefcase,
  Sparkles,
  Palette,
  ShieldAlert,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  Building2,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TimeInput } from '@/components/ui/time-input'

// ── Types ──────────────────────────────────────────────

interface WorkingDay {
  active: boolean
  start: string
  end: string
  breaks: { start: string; end: string }[]
}

type WorkingHours = Record<string, WorkingDay>

interface ServiceItem {
  name: string
  type: string
  duration: number
  price: number
}

interface AIStyle {
  tone: 'formal' | 'friendly' | 'casual'
  emoji_usage: 'none' | 'light' | 'heavy'
  custom_instructions: string
}

interface CancellationPolicy {
  text: string
  hours_before: number
}

interface WhatsAppStatus {
  connected: boolean
  phone: string | null
  session_name: string | null
}

// ── Day labels ─────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  '0': 'ראשון',
  '1': 'שני',
  '2': 'שלישי',
  '3': 'רביעי',
  '4': 'חמישי',
  '5': 'שישי',
  '6': 'שבת',
}

const DEFAULT_WORKING_HOURS: WorkingHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, i) => [
    String(i),
    {
      active: i >= 0 && i <= 4,
      start: '09:00',
      end: '18:00',
      breaks: [],
    },
  ])
)

const DEFAULT_AI_STYLE: AIStyle = {
  tone: 'friendly',
  emoji_usage: 'light',
  custom_instructions: '',
}

const DEFAULT_CANCELLATION: CancellationPolicy = {
  text: 'ביטול עד 2 שעות לפני התור ללא חיוב. ביטול מאוחר יותר יחויב ב-50% מעלות השירות.',
  hours_before: 2,
}

// ── Collapsible Section ────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="glass-card shadow-ios rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-4 text-start hover:bg-white/60 transition-ios press-effect"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
            <Icon className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <span className="text-base font-semibold text-gray-800">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {open && <div className="border-t border-gray-100/50 px-4 py-5">{children}</div>}
    </div>
  )
}

// ── Save Button ────────────────────────────────────────

function SaveButton({
  saving,
  saved,
  error,
  onClick,
}: {
  saving: boolean
  saved: boolean
  error?: string | null
  onClick: () => void
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
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
      {saved && (
        <span className="flex items-center gap-1 text-sm text-green-600 animate-page-in">
          <CheckCircle2 className="h-4 w-4" />
          נשמר בהצלחה
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1 text-sm text-[var(--color-danger)] animate-page-in">
          <XCircle className="h-4 w-4" />
          {error}
        </span>
      )}
    </div>
  )
}

// ── Working Hours Section ──────────────────────────────

function WorkingHoursSection({
  hours,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  hours: WorkingHours
  onChange: (h: WorkingHours) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error?: string | null
}) {
  const updateDay = (dayKey: string, updates: Partial<WorkingDay>) => {
    onChange({
      ...hours,
      [dayKey]: { ...hours[dayKey], ...updates },
    })
  }

  const addBreak = (dayKey: string) => {
    const day = hours[dayKey]
    onChange({
      ...hours,
      [dayKey]: {
        ...day,
        breaks: [...day.breaks, { start: '12:00', end: '13:00' }],
      },
    })
  }

  const removeBreak = (dayKey: string, idx: number) => {
    const day = hours[dayKey]
    onChange({
      ...hours,
      [dayKey]: {
        ...day,
        breaks: day.breaks.filter((_, i) => i !== idx),
      },
    })
  }

  const updateBreak = (
    dayKey: string,
    idx: number,
    field: 'start' | 'end',
    value: string
  ) => {
    const day = hours[dayKey]
    const newBreaks = [...day.breaks]
    newBreaks[idx] = { ...newBreaks[idx], [field]: value }
    onChange({
      ...hours,
      [dayKey]: { ...day, breaks: newBreaks },
    })
  }

  return (
    <div className="space-y-3">
      {Object.entries(DAY_LABELS).map(([key, label]) => {
        const day = hours[key] || { active: false, start: '09:00', end: '18:00', breaks: [] }
        return (
          <div key={key} className="rounded-lg border border-gray-100 p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="relative inline-flex cursor-pointer items-center min-h-[44px]">
                <input
                  type="checkbox"
                  checked={day.active}
                  onChange={(e) => updateDay(key, { active: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-gray-200 relative after:absolute after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:start-[2px] peer-checked:after:start-[calc(100%-22px)] peer-checked:bg-[var(--color-primary)]" />
              </label>
              <span className="min-w-[50px] text-sm font-medium text-gray-700">
                {label}
              </span>
              {day.active && (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <TimeInput
                    value={day.start}
                    onChange={(v) => updateDay(key, { start: v })}
                    className="w-[72px] rounded-md border border-gray-200 px-2 py-1.5 text-sm text-center min-h-[40px]"
                  />
                  <span className="text-gray-400">—</span>
                  <TimeInput
                    value={day.end}
                    onChange={(v) => updateDay(key, { end: v })}
                    className="w-[72px] rounded-md border border-gray-200 px-2 py-1.5 text-sm text-center min-h-[40px]"
                  />
                  <button
                    type="button"
                    onClick={() => addBreak(key)}
                    className="ms-2 text-xs text-[var(--color-primary)] hover:underline min-h-[44px] px-2"
                  >
                    + הפסקה
                  </button>
                </div>
              )}
            </div>
            {day.active && day.breaks.length > 0 && (
              <div className="mt-2 sm:me-14 space-y-1">
                {day.breaks.map((brk, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <span>הפסקה:</span>
                    <TimeInput
                      value={brk.start}
                      onChange={(v) => updateBreak(key, idx, 'start', v)}
                      className="w-[64px] rounded border border-gray-200 px-1.5 py-0.5 text-xs text-center"
                    />
                    <span>—</span>
                    <TimeInput
                      value={brk.end}
                      onChange={(v) => updateBreak(key, idx, 'end', v)}
                      className="w-[64px] rounded border border-gray-200 px-1.5 py-0.5 text-xs text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeBreak(key, idx)}
                      className="flex items-center justify-center text-red-400 hover:text-red-600 min-h-[44px] min-w-[44px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <SaveButton saving={saving} saved={saved} error={error} onClick={onSave} />
    </div>
  )
}

// ── Services Section ───────────────────────────────────

function ServicesSection({
  services,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  services: ServiceItem[]
  onChange: (s: ServiceItem[]) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error?: string | null
}) {
  const addService = () => {
    onChange([...services, { name: '', type: '', duration: 30, price: 0 }])
  }

  const removeService = (idx: number) => {
    onChange(services.filter((_, i) => i !== idx))
  }

  const updateService = (idx: number, updates: Partial<ServiceItem>) => {
    const updated = [...services]
    updated[idx] = { ...updated[idx], ...updates }
    // Auto-generate type from name
    if (updates.name !== undefined) {
      updated[idx].type = updates.name.toLowerCase().replace(/\s+/g, '_')
    }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      {services.map((svc, idx) => (
        <div
          key={idx}
          className="grid grid-cols-[1fr_64px_64px_40px] sm:grid-cols-[1fr_80px_80px_40px] gap-2 items-end rounded-lg border border-gray-100 p-3"
        >
          <div>
            <label className="mb-1 block text-xs text-gray-500">שם השירות</label>
            <input
              type="text"
              value={svc.name}
              onChange={(e) => updateService(idx, { name: e.target.value })}
              placeholder="למשל: תספורת גברים"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios min-h-[48px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">דקות</label>
            <input
              type="number"
              value={svc.duration}
              onChange={(e) => updateService(idx, { duration: Number(e.target.value) })}
              min={5}
              step={5}
              className="w-full rounded-xl border border-gray-200 px-2 py-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios min-h-[48px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">מחיר &#x20AA;</label>
            <input
              type="number"
              value={svc.price}
              onChange={(e) => updateService(idx, { price: Number(e.target.value) })}
              min={0}
              className="w-full rounded-xl border border-gray-200 px-2 py-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios min-h-[48px]"
            />
          </div>
          <button
            type="button"
            onClick={() => removeService(idx)}
            aria-label="הסר שירות"
            className="flex h-11 w-11 items-center justify-center rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addService}
        className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300/60 px-4 py-2.5 text-sm text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-ios press-effect w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        הוסף שירות
      </button>
      <SaveButton saving={saving} saved={saved} error={error} onClick={onSave} />
    </div>
  )
}

// ── AI Style Section ───────────────────────────────────

function AIStyleSection({
  style,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  style: AIStyle
  onChange: (s: AIStyle) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error?: string | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">טון דיבור</label>
        <div className="flex gap-2">
          {([
            { value: 'formal', label: 'רשמי' },
            { value: 'friendly', label: 'ידידותי' },
            { value: 'casual', label: 'חופשי' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...style, tone: opt.value })}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-medium transition-ios press-effect min-h-[44px]',
                style.tone === opt.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          שימוש באימוג&apos;ים
        </label>
        <div className="flex gap-2">
          {([
            { value: 'none', label: 'ללא' },
            { value: 'light', label: 'מעט' },
            { value: 'heavy', label: 'הרבה' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...style, emoji_usage: opt.value })}
              className={cn(
                'rounded-xl border px-4 py-2 text-sm font-medium transition-ios press-effect min-h-[44px]',
                style.emoji_usage === opt.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          הוראות מיוחדות ל-AI
        </label>
        <textarea
          value={style.custom_instructions}
          onChange={(e) =>
            onChange({ ...style, custom_instructions: e.target.value })
          }
          placeholder="למשל: תמיד תציעי ללקוחות שירות נוסף, אל תדברי על מחירים ללא אישור..."
          rows={4}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios"
        />
      </div>
      <SaveButton saving={saving} saved={saved} error={error} onClick={onSave} />
    </div>
  )
}

// ── Cancellation Policy Section ────────────────────────

function CancellationSection({
  policy,
  onChange,
  onSave,
  saving,
  saved,
  error,
}: {
  policy: CancellationPolicy
  onChange: (p: CancellationPolicy) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  error?: string | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          שעות לפני התור לביטול ללא חיוב
        </label>
        <input
          type="number"
          value={policy.hours_before}
          onChange={(e) =>
            onChange({ ...policy, hours_before: Number(e.target.value) })
          }
          min={0}
          max={72}
          className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios min-h-[48px]"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          טקסט מדיניות ביטולים (יוצג ללקוחות)
        </label>
        <textarea
          value={policy.text}
          onChange={(e) => onChange({ ...policy, text: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-ios"
        />
      </div>
      <SaveButton saving={saving} saved={saved} error={error} onClick={onSave} />
    </div>
  )
}

// ── WhatsApp Connection Section ────────────────────────

function WhatsAppSection({
  businessId,
  status,
  onRefresh,
  refreshing,
  onConnected,
}: {
  businessId: string
  status: WhatsAppStatus | null
  onRefresh: () => void
  refreshing: boolean
  onConnected: () => void
}) {
  const [showQr, setShowQr] = useState(false)

  return (
    <div className="space-y-4">
      {/* Current status display */}
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <div
          className={cn(
            'h-3 w-3 rounded-full',
            status?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-gray-700">
          {status?.connected ? 'מחובר' : 'לא מחובר'}
        </span>
        {status?.phone && !status.phone.startsWith('temp_') && (
          <span className="text-sm text-gray-500" dir="ltr">
            {status.phone}
          </span>
        )}
      </div>

      {status?.connected && (
        <div className="flex items-center gap-2 rounded-2xl bg-green-50/60 backdrop-blur-sm p-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-700">
            WhatsApp מחובר ופעיל. הסוכן עונה ללקוחות באופן אוטומטי.
          </span>
        </div>
      )}

      {/* Show QR scanner or button to reconnect */}
      {!status?.connected && !showQr && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200/50 glass-card p-8">
          <QrCode className="h-16 w-16 text-gray-300" />
          <p className="text-center text-sm text-gray-500">
            חבר את מספר הוואטסאפ שלך כדי שהסוכן יתחיל לענות ללקוחות
          </p>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-ios hover:bg-[var(--color-primary-dark)] transition-ios press-effect"
          >
            <MessageSquare className="h-4 w-4" />
            חבר WhatsApp
          </button>
        </div>
      )}

      {!status?.connected && showQr && (
        <QrScanner
          businessId={businessId}
          onConnected={() => {
            setShowQr(false)
            onConnected()
          }}
        />
      )}

      {/* Reconnect button when already connected */}
      {status?.connected && (
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="flex items-center gap-2 rounded-xl border border-gray-200/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/60 transition-ios press-effect"
        >
          <MessageSquare className="h-4 w-4" />
          חבר מחדש
        </button>
      )}

      {status?.connected && showQr && (
        <QrScanner
          businessId={businessId}
          onConnected={() => {
            setShowQr(false)
            onConnected()
          }}
        />
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-xl border border-gray-200/50 px-4 py-2 text-sm text-gray-600 hover:bg-white/60 transition-ios press-effect"
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
        רענן סטטוס
      </button>
    </div>
  )
}

// ── Holidays Section ────────────────────────────────────

const DEFAULT_CLOSED_HOLIDAYS = [
  'Rosh Hashana', 'Yom Kippur', 'Erev Yom Kippur',
  'Sukkot', 'Shmini Atzeret', 'Pesach', 'Erev Pesach',
  'Shavuot', 'Erev Shavuot', 'Yom HaZikaron', 'Yom HaAtzmaut', 'Tisha BAv',
]

const HOLIDAY_DISPLAY: Record<string, string> = {
  'Rosh Hashana': 'ראש השנה',
  'Yom Kippur': 'יום כיפור',
  'Erev Yom Kippur': 'ערב יום כיפור',
  'Sukkot': 'סוכות',
  'Shmini Atzeret': 'שמיני עצרת / שמחת תורה',
  'Pesach': 'פסח',
  'Erev Pesach': 'ערב פסח',
  'Shavuot': 'שבועות',
  'Erev Shavuot': 'ערב שבועות',
  'Yom HaZikaron': 'יום הזיכרון',
  'Yom HaAtzmaut': 'יום העצמאות',
  'Tisha BAv': 'תשעה באב',
  'Chanukah': 'חנוכה',
  'Purim': 'פורים',
  'Lag BaOmer': 'ל״ג בעומר',
  'Chol HaMoed Sukkot': 'חול המועד סוכות',
  'Chol HaMoed Pesach': 'חול המועד פסח',
  'Hoshana Raba': 'הושענא רבה',
  'Shushan Purim': 'שושן פורים',
  'Tzom Gedaliah': 'צום גדליה',
}

function HolidaysSection({ businessId, supabase, saving, saved, error, onSave }: {
  businessId: string
  supabase: ReturnType<typeof createClient>
  saving: boolean
  saved: boolean
  error: string | null
  onSave: () => void
}) {
  const [closedHolidays, setClosedHolidays] = useState<string[]>(DEFAULT_CLOSED_HOLIDAYS)
  const [customDates, setCustomDates] = useState<string[]>([])
  const [erevTime, setErevTime] = useState('14:00')
  const [loadingH, setLoadingH] = useState(true)
  const [savingH, setSavingH] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('business_settings')
        .select('holidays_config')
        .eq('business_id', businessId)
        .single()
      if (data && (data as Record<string, unknown>).holidays_config) {
        const cfg = (data as Record<string, unknown>).holidays_config as Record<string, unknown>
        if (cfg.closed_holidays) setClosedHolidays(cfg.closed_holidays as string[])
        if (cfg.custom_closed_dates) setCustomDates(cfg.custom_closed_dates as string[])
        if (cfg.erev_close_time) setErevTime(cfg.erev_close_time as string)
      }
      setLoadingH(false)
    }
    load()
  }, [businessId, supabase])

  const toggleHoliday = (name: string) => {
    setClosedHolidays(prev =>
      prev.includes(name) ? prev.filter(h => h !== name) : [...prev, name]
    )
  }

  const handleSave = async () => {
    setSavingH(true)
    await supabase
      .from('business_settings')
      .update({
        holidays_config: {
          closed_holidays: closedHolidays,
          custom_closed_dates: customDates,
          erev_close_time: erevTime,
        },
      })
      .eq('business_id', businessId)
    setSavingH(false)
    onSave()
  }

  if (loadingH) return <div className="p-4 text-center text-sm text-gray-400">טוען...</div>

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-[#6B7B73]">בחר באילו חגים העסק סגור. הבוט לא יקבע תורים בימים אלה.</p>

      <div className="space-y-2">
        {Object.entries(HOLIDAY_DISPLAY).map(([key, nameHe]) => (
          <label key={key} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={closedHolidays.includes(key)}
              onChange={() => toggleHoliday(key)}
              className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span className="text-sm font-medium text-[#1B2E24]">{nameHe}</span>
            <span className="text-xs text-[#8FA89A] ms-auto">
              {closedHolidays.includes(key) ? 'סגור' : 'פתוח'}
            </span>
          </label>
        ))}
      </div>

      <div className="border-t border-[#E8EFE9] pt-4">
        <label className="block text-sm font-medium text-[#1B2E24] mb-1">שעת סגירה בערב חג</label>
        <input
          type="text"
          value={erevTime}
          onChange={e => setErevTime(e.target.value)}
          placeholder="14:00"
          className="w-32 rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm"
        />
      </div>

      <SaveButton
        onClick={handleSave}
        saving={savingH}
        saved={saved}
        error={error}
      />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────

export default function SettingsPage() {
  const { businessId, loading: authLoading } = useAuth()
  const supabase = createClient()
  const { toast } = useToastContext()

  const [loading, setLoading] = useState(true)

  // Section state
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [aiStyle, setAIStyle] = useState<AIStyle>(DEFAULT_AI_STYLE)
  const [cancellation, setCancellation] = useState<CancellationPolicy>(DEFAULT_CANCELLATION)
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)

  // Business info state
  const [bizName, setBizName] = useState('')
  const [bizType, setBizType] = useState('')
  const [bizAddress, setBizAddress] = useState('')
  const [bizLogoUrl, setBizLogoUrl] = useState('')

  // Saving state per section
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)
  const [errorSection, setErrorSection] = useState<{ section: string; message: string } | null>(null)
  const [refreshingWA, setRefreshingWA] = useState(false)

  // Load settings
  const loadSettings = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    try {
      const [settingsResult, personaResult, bizResult] = await Promise.all([
        supabase
          .from('business_settings')
          .select('*')
          .eq('business_id', businessId)
          .single(),
        supabase
          .from('ai_personas')
          .select('*')
          .eq('business_id', businessId)
          .single(),
        supabase
          .from('businesses')
          .select('name, business_type, address, logo_url')
          .eq('id', businessId)
          .single(),
      ])

      if (bizResult.data) {
        setBizName(bizResult.data.name || '')
        setBizType(bizResult.data.business_type || '')
        setBizAddress((bizResult.data as Record<string, unknown>).address as string || '')
        setBizLogoUrl((bizResult.data as Record<string, unknown>).logo_url as string || '')
      }

      if (settingsResult.data) {
        const s = settingsResult.data
        if (s.working_hours) setWorkingHours(s.working_hours as WorkingHours)
        if (s.services) setServices(s.services as ServiceItem[])
        if (s.cancellation_policy) {
          setCancellation(s.cancellation_policy as CancellationPolicy)
        }
      }

      if (personaResult.data) {
        const p = personaResult.data
        setAIStyle({
          tone: p.tone || 'friendly',
          emoji_usage: p.emoji_usage || 'light',
          custom_instructions: p.custom_instructions || '',
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }

    setLoading(false)
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save helpers
  const saveSection = async (section: string, data: Record<string, unknown>) => {
    if (!businessId) return
    setSavingSection(section)
    setSavedSection(null)
    setErrorSection(null)

    try {
      if (section === 'business_info') {
        const { error } = await supabase
          .from('businesses')
          .update(data)
          .eq('id', businessId)
        if (error) throw error
      } else if (section === 'ai_style') {
        const { error } = await supabase
          .from('ai_personas')
          .upsert(
            { business_id: businessId, ...data },
            { onConflict: 'business_id' }
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('business_settings')
          .upsert(
            { business_id: businessId, ...data },
            { onConflict: 'business_id' }
          )
        if (error) throw error
      }
      setSavedSection(section)
      toast('ההגדרות נשמרו בהצלחה', 'success')
      setTimeout(() => setSavedSection(null), 2000)
    } catch (err) {
      console.error(`Failed to save ${section}:`, err)
      setErrorSection({ section, message: 'שגיאה בשמירה. נסה שוב.' })
      toast('שגיאה בשמירה. נסה שוב.', 'error')
      setTimeout(() => setErrorSection(null), 4000)
    }

    setSavingSection(null)
  }

  const refreshWhatsApp = async () => {
    if (!businessId) return
    setRefreshingWA(true)

    try {
      const res = await fetch(`/api/whatsapp/status?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        setWhatsappStatus(data)
      }
    } catch (err) {
      console.error('Failed to refresh WhatsApp status:', err)
      setWhatsappStatus({ connected: false, phone: null, session_name: null })
    }

    setRefreshingWA(false)
  }

  useEffect(() => {
    if (businessId) refreshWhatsApp()
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-full bg-mesh overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-strong shadow-ios px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <a href="/" className="flex items-center gap-1 text-sm text-[#5A6E62] hover:text-[#1B2E24] transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            חזרה
          </a>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
              <Settings className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">הגדרות</h1>
              <p className="text-xs text-gray-500">ניהול העסק והסוכן החכם</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-5 pb-24">
        {/* Business Info */}
        <CollapsibleSection title="פרטי עסק" icon={Building2} defaultOpen>
          <div className="space-y-4 p-4">
            <div>
              <label className="block text-sm font-medium text-[#1B2E24] mb-1">שם העסק</label>
              <input
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                placeholder="למשל: מספרת שמואל"
                className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1B2E24] mb-1">סוג עסק</label>
              <select
                value={bizType}
                onChange={e => setBizType(e.target.value)}
                className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm min-h-[48px]"
              >
                <option value="">בחר סוג</option>
                <option value="מספרה">מספרה</option>
                <option value="קוסמטיקה">קוסמטיקה</option>
                <option value="כושר">כושר</option>
                <option value="רפואה">רפואה</option>
                <option value="רואה חשבון">רואה חשבון</option>
                <option value="מסעדה">מסעדה</option>
                <option value="אחר">אחר</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1B2E24] mb-1">כתובת</label>
              <input
                value={bizAddress}
                onChange={e => setBizAddress(e.target.value)}
                placeholder="רחוב, עיר"
                className="w-full rounded-xl border border-[#E8EFE9] px-3 py-2.5 text-sm min-h-[48px]"
              />
            </div>
            <SaveButton
              onClick={() => saveSection('business_info', {
                name: bizName,
                business_type: bizType,
                address: bizAddress,
              })}
              saving={savingSection === 'business_info'}
              saved={savedSection === 'business_info'}
              error={errorSection?.section === 'business_info' ? errorSection.message : null}
            />
          </div>
        </CollapsibleSection>

        {/* Working Hours */}
        <CollapsibleSection title="שעות עבודה" icon={Clock}>
          <WorkingHoursSection
            hours={workingHours}
            onChange={setWorkingHours}
            onSave={() => saveSection('working_hours', { working_hours: workingHours })}
            saving={savingSection === 'working_hours'}
            saved={savedSection === 'working_hours'}
            error={errorSection?.section === 'working_hours' ? errorSection.message : null}
          />
        </CollapsibleSection>

        {/* Services */}
        <CollapsibleSection title="שירותים ומחירים" icon={Briefcase}>
          <ServicesSection
            services={services}
            onChange={setServices}
            onSave={() => saveSection('services', { services })}
            saving={savingSection === 'services'}
            saved={savedSection === 'services'}
            error={errorSection?.section === 'services' ? errorSection.message : null}
          />
        </CollapsibleSection>

        {/* AI Style */}
        <CollapsibleSection title="סגנון AI" icon={Sparkles}>
          <AIStyleSection
            style={aiStyle}
            onChange={setAIStyle}
            onSave={() =>
              saveSection('ai_style', {
                tone: aiStyle.tone,
                emoji_usage: aiStyle.emoji_usage,
                custom_instructions: aiStyle.custom_instructions,
              })
            }
            saving={savingSection === 'ai_style'}
            saved={savedSection === 'ai_style'}
            error={errorSection?.section === 'ai_style' ? errorSection.message : null}
          />
        </CollapsibleSection>

        {/* Colors & Design */}
        <CollapsibleSection title="צבעים ועיצוב" icon={Palette}>
          <ThemePicker businessId={businessId!} />
        </CollapsibleSection>

        {/* Cancellation Policy */}
        <CollapsibleSection title="מדיניות ביטולים" icon={ShieldAlert}>
          <CancellationSection
            policy={cancellation}
            onChange={setCancellation}
            onSave={() =>
              saveSection('cancellation', { cancellation_policy: cancellation })
            }
            saving={savingSection === 'cancellation'}
            saved={savedSection === 'cancellation'}
            error={errorSection?.section === 'cancellation' ? errorSection.message : null}
          />
        </CollapsibleSection>

        {/* Holidays */}
        <CollapsibleSection title="חגים וימי חופש" icon={Calendar}>
          <HolidaysSection
            businessId={businessId!}
            supabase={supabase}
            saving={savingSection === 'holidays'}
            saved={savedSection === 'holidays'}
            error={errorSection?.section === 'holidays' ? errorSection.message : null}
            onSave={() => { setSavingSection(null); setSavedSection('holidays'); setTimeout(() => setSavedSection(null), 3000) }}
          />
        </CollapsibleSection>

        {/* WhatsApp Connection */}
        <CollapsibleSection title="חיבור WhatsApp" icon={MessageSquare}>
          <WhatsAppSection
            businessId={businessId!}
            status={whatsappStatus}
            onRefresh={refreshWhatsApp}
            refreshing={refreshingWA}
            onConnected={() => {
              setWhatsappStatus({ connected: true, phone: whatsappStatus?.phone || null, session_name: whatsappStatus?.session_name || null })
              refreshWhatsApp()
            }}
          />
        </CollapsibleSection>
      </div>
    </div>
  )
}
