'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useOnboardingContext } from '@/components/onboarding/onboarding-context'
import StepServices, { type Service } from '@/components/onboarding/step-services'
import StepHours, { type DaySchedule } from '@/components/onboarding/step-hours'
import StepAiStyle, { type AiStyleConfig } from '@/components/onboarding/step-ai-style'
import QrScanner from '@/components/admin/qr-scanner'
import AiOnboardingChat from '@/components/onboarding/ai-onboarding-chat'
import {
  updateOnboardingStep,
  saveBusinessSettings,
  saveAiPersona,
  completeOnboarding,
} from '@/lib/auth/onboarding-actions'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, ListChecks } from 'lucide-react'

type OnboardingMode = 'choose' | 'ai' | 'manual'

export default function OnboardingPage() {
  const router = useRouter()
  const { businessId, loading: authLoading } = useAuth()
  const { currentStep, setCurrentStep } = useOnboardingContext()

  // Onboarding mode: choose (initial), ai, or manual
  const [mode, setMode] = useState<OnboardingMode>('choose')

  // Step data
  const [businessType, setBusinessType] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [schedule, setSchedule] = useState<DaySchedule[]>([])
  const [aiStyle, setAiStyle] = useState<AiStyleConfig>({
    tone: 'friendly',
    emojiLevel: 'light',
    customInstructions: '',
  })
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [testPhone, setTestPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [localBusinessId, setLocalBusinessId] = useState<string | null>(null)

  // The effective effectiveBusinessId - from auth hook or created locally
  const effectiveBusinessId = businessId || localBusinessId

  // Ensure business exists for this user (auto-create if needed)
  useEffect(() => {
    if (authLoading) return
    if (effectiveBusinessId) {
      setLocalBusinessId(businessId)
      return
    }

    // No effectiveBusinessId from auth - create business via API
    const ensureBusiness = async () => {
      try {
        const res = await fetch('/api/onboarding/ensure-business', { method: 'POST' })
        const data = await res.json()
        if (data.businessId) {
          setLocalBusinessId(data.businessId)
        } else {
          setError(data.error || 'שגיאה ביצירת עסק')
        }
      } catch {
        setError('שגיאה בהתחברות לשרת')
      }
    }

    ensureBusiness()
  }, [authLoading, businessId])

  // Load existing data
  useEffect(() => {
    if (!effectiveBusinessId) return

    const loadData = async () => {
      const supabase = createClient()

      const { data: biz } = await supabase
        .from('businesses')
        .select('name, business_type')
        .eq('id', effectiveBusinessId)
        .single()

      if (biz) {
        setBusinessName(biz.name || '')
        setBusinessType(biz.business_type || '')
      }

      const { data: progress } = await supabase
        .from('onboarding_progress')
        .select('current_step, steps_data')
        .eq('business_id', effectiveBusinessId)
        .single()

      if (progress?.current_step && progress.current_step > 1) {
        // If user was already in manual mode, resume there
        setMode('manual')
        setCurrentStep(progress.current_step)
      }
    }

    loadData()
  }, [effectiveBusinessId, setCurrentStep])

  const goNext = useCallback(async () => {
    if (!effectiveBusinessId) {
      setError('לא נמצא עסק מחובר. נא להתנתק ולהירשם מחדש.')
      return
    }
    setSaving(true)
    setError('')

    try {
      // Save step-specific data
      switch (currentStep) {
        case 1:
          await updateOnboardingStep(effectiveBusinessId, 2, { welcomeConfirmed: true })
          break

        case 2: {
          const supabase = createClient()
          const updates: Record<string, string> = { name: businessName }
          if (address) {
            updates.address = address
          }
          await supabase.from('businesses').update(updates).eq('id', effectiveBusinessId)

          if (logoFile) {
            const ext = logoFile.name.split('.').pop()
            const path = `logos/${effectiveBusinessId}.${ext}`
            await supabase.storage.from('business-assets').upload(path, logoFile, { upsert: true })
          }

          await updateOnboardingStep(effectiveBusinessId, 3, { businessName, address })
          break
        }

        case 3:
          await saveBusinessSettings(effectiveBusinessId, { services })
          await updateOnboardingStep(effectiveBusinessId, 4, { servicesCount: services.length })
          break

        case 4: {
          // Convert DaySchedule[] array to Record<string, WorkingDay> format
          // that getAvailableSlots and the rest of the system expect
          const dayNameToNumber: Record<string, string> = {
            'sunday': '0', 'monday': '1', 'tuesday': '2', 'wednesday': '3',
            'thursday': '4', 'friday': '5', 'saturday': '6',
          }
          const workingHoursRecord: Record<string, { active: boolean; start: string; end: string; breaks: { start: string; end: string }[] }> = {}
          schedule.forEach((wh, index) => {
            const dayKey = dayNameToNumber[wh.day?.toLowerCase()] ?? String(index)
            workingHoursRecord[dayKey] = {
              active: wh.active,
              start: wh.start,
              end: wh.end,
              breaks: wh.breaks.map(b => ({ start: b.start, end: b.end })),
            }
          })
          await saveBusinessSettings(effectiveBusinessId, { working_hours: workingHoursRecord })
          await updateOnboardingStep(effectiveBusinessId, 5, { scheduleSet: true })
          break
        }

        case 5:
          await saveAiPersona(effectiveBusinessId, {
            tone: aiStyle.tone,
            emoji_usage: aiStyle.emojiLevel,
            custom_instructions: aiStyle.customInstructions,
          })
          await updateOnboardingStep(effectiveBusinessId, 6, { aiStyleSet: true })
          break

        case 6:
          await updateOnboardingStep(effectiveBusinessId, 7, { whatsappConnected })
          break

        case 7:
          await updateOnboardingStep(effectiveBusinessId, 8, { testSent })
          break

        case 8:
          await updateOnboardingStep(effectiveBusinessId, 9, { reviewCompleted: true })
          break

        case 9:
          await completeOnboarding(effectiveBusinessId)
          router.push('/')
          return
      }

      setCurrentStep(currentStep + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירה'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [effectiveBusinessId, currentStep, setCurrentStep, businessName, address, logoFile, services, schedule, aiStyle, whatsappConnected, testSent, router])

  const goBack = () => {
    if (currentStep <= 1) {
      setMode('choose')
    } else {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSendTest = async () => {
    if (!testPhone || !effectiveBusinessId) return
    setSaving(true)

    try {
      await fetch('/api/waha/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, businessId: effectiveBusinessId }),
      })
      setTestSent(true)
    } catch {
      setError('שגיאה בשליחת הודעת טסט')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-[var(--color-primary)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-text-muted">טוען...</span>
        </div>
      </div>
    )
  }

  // ── Mode: Choose - Chat Welcome Screen ──────────────
  if (mode === 'choose') {
    return (
      <div className="space-y-6 max-w-lg mx-auto px-4 sm:px-0">
        {/* Chat-style welcome */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-ios">
          {/* Chat header - WhatsApp style */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-primary)]/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-ios">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[var(--color-text)]">העוזר החכם</h3>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 status-connected" />
                <p className="text-xs text-[var(--color-text-muted)]">מקוון</p>
              </div>
            </div>
          </div>

          {/* Chat messages area - WhatsApp-like background */}
          <div
            className="p-4 space-y-3 min-h-[300px]"
            style={{
              backgroundColor: '#E5DDD5',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23c8bfb0\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          >
            {/* AI welcome message bubble */}
            <div className="flex gap-2 items-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm">
                <p className="text-sm text-[var(--color-text)] leading-relaxed">
                  היי! ברוכים הבאים למערכת <strong>WhatsApp AI Agent</strong>
                </p>
                <p className="text-sm text-[var(--color-text)] leading-relaxed mt-2">
                  אני כאן כדי לעזור לך להגדיר את העסק שלך תוך דקות ספורות.
                </p>
                <div className="mt-3 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-medium text-[var(--color-text)]">המערכת כוללת:</p>
                  <p className="flex items-center gap-1.5"><span className="text-[var(--color-success)]">✓</span> סוכן AI חכם שעונה ללקוחות בוואטסאפ</p>
                  <p className="flex items-center gap-1.5"><span className="text-[var(--color-success)]">✓</span> ניהול תורים ויומן חכם</p>
                  <p className="flex items-center gap-1.5"><span className="text-[var(--color-success)]">✓</span> CRM לניהול לקוחות</p>
                  <p className="flex items-center gap-1.5"><span className="text-[var(--color-success)]">✓</span> דוחות, הוצאות ו-KPIs</p>
                </div>
                <p className="text-sm text-[var(--color-text)] leading-relaxed mt-3 font-medium">
                  איך תרצה להמשיך?
                </p>
                <span className="block text-[10px] text-[var(--color-text-muted)] text-left mt-1 select-none">
                  עכשיו
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons - inside chat */}
          <div className="p-4 space-y-3 border-t border-[var(--color-border)] bg-white">
            <button
              type="button"
              onClick={() => setMode('ai')}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-[var(--color-primary)] text-white font-semibold shadow-ios hover:bg-[var(--color-primary-dark)] press-effect transition-ios"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-start flex-1">
                <span className="block text-[15px]">המשך תהליך קליטה עם הבוט</span>
                <span className="block text-xs opacity-80 font-normal mt-0.5">מומלץ -- כ-2 דקות</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setMode('manual'); setCurrentStep(1); }}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-white hover:shadow-ios press-effect transition-ios"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-border)]">
                <ListChecks className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </div>
              <div className="text-start flex-1">
                <span className="block text-[15px]">המשך תהליך קליטה ידני</span>
                <span className="block text-xs text-[var(--color-text-muted)] font-normal mt-0.5">שלב אחרי שלב -- כ-5 דקות</span>
              </div>
            </button>
          </div>
        </div>

        {/* Error message if exists */}
        {error && (
          <div className="bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm rounded-xl p-4">
            {error}
          </div>
        )}
      </div>
    )
  }

  // ── Mode: AI Chat ────────────────────────────────────
  if (mode === 'ai') {
    return (
      <div className="space-y-4">
        {/* Back to choose */}
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="text-sm text-text-secondary hover:text-text transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          חזרה לבחירת שיטה
        </button>

        {/* AI Chat */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-white/80 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
              <Sparkles className="h-4.5 w-4.5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">העוזר החכם</h3>
              <p className="text-xs text-text-muted">הגדרת עסק אוטומטית</p>
            </div>
          </div>

          {effectiveBusinessId ? (
            <AiOnboardingChat
              businessId={effectiveBusinessId}
              onComplete={() => {
                router.push('/')
              }}
            />
          ) : (
            <div className="p-8 text-center space-y-3">
              <p className="text-red-500 font-medium">לא נמצא עסק מחובר</p>
              <p className="text-sm text-[#5A6E62]">נא להתנתק ולהירשם מחדש</p>
              <button
                onClick={() => { window.location.href = '/login' }}
                className="px-6 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium"
              >
                חזרה להתחברות
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Mode: Manual (existing wizard) ───────────────────
  return (
    <div className="space-y-8">
      {/* Back to choose (only on step 1) */}
      {currentStep === 1 && (
        <button
          type="button"
          onClick={() => setMode('choose')}
          className="text-sm text-text-secondary hover:text-text transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          חזרה לבחירת שיטה
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger-bg border border-danger/20 text-danger text-sm rounded-[var(--radius-card)] p-4">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-[var(--radius-card)] border border-border p-6 md:p-8">
        {/* Step 1: Welcome */}
        {currentStep === 1 && (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text">ברוכים הבאים!</h2>
              <p className="text-text-secondary">
                בואו נגדיר את הסוכן החכם שלכם בוואטסאפ. התהליך לוקח כ-5 דקות.
              </p>
            </div>

            {businessType && (
              <div className="bg-surface rounded-[var(--radius-card)] p-4 inline-block">
                <p className="text-sm text-text-secondary">סוג העסק שלך:</p>
                <p className="text-lg font-semibold text-text">{businessType}</p>
              </div>
            )}

            <p className="text-sm text-text-muted">
              נטען עבורך תבנית מותאמת לסוג העסק שלך, כך שתוכל להתחיל מהר.
            </p>
          </div>
        )}

        {/* Step 2: Business details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text">פרטי העסק</h2>
              <p className="text-sm text-text-secondary mt-1">מלא את הפרטים הבסיסיים</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="ob-name" className="block text-sm font-medium text-text">שם העסק</label>
                <input
                  id="ob-name"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ob-address" className="block text-sm font-medium text-text">כתובת העסק</label>
                <input
                  id="ob-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="רחוב, עיר"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors min-h-[48px]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-text">לוגו (אופציונלי)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-upload"
                />

                {logoPreview ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={logoPreview}
                      alt="לוגו העסק"
                      className="w-20 h-20 rounded-[var(--radius-card)] object-cover border border-border"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="text-sm text-[var(--color-primary)] font-medium cursor-pointer hover:text-[var(--color-primary-dark)] transition-colors"
                    >
                      החלף תמונה
                    </label>
                  </div>
                ) : (
                  <label
                    htmlFor="logo-upload"
                    className="flex items-center justify-center w-20 h-20 rounded-[var(--radius-card)] border-2 border-dashed border-border cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                  >
                    <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Services */}
        {currentStep === 3 && (
          <StepServices
            businessType={businessType}
            initialServices={services.length > 0 ? services : undefined}
            onChange={setServices}
          />
        )}

        {/* Step 4: Working hours */}
        {currentStep === 4 && (
          <StepHours
            initialSchedule={schedule.length > 0 ? schedule : undefined}
            onChange={setSchedule}
          />
        )}

        {/* Step 5: AI Style */}
        {currentStep === 5 && (
          <StepAiStyle
            initialConfig={aiStyle}
            onChange={setAiStyle}
          />
        )}

        {/* Step 6: WhatsApp connection */}
        {currentStep === 6 && effectiveBusinessId && (
          <QrScanner
            businessId={effectiveBusinessId}
            onConnected={() => setWhatsappConnected(true)}
          />
        )}

        {/* Step 7: Test */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-text">שליחת הודעת בדיקה</h2>
              <p className="text-sm text-text-secondary mt-1">
                בוא נוודא שהכול עובד. שלח לעצמך הודעת בדיקה.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="test-phone" className="block text-sm font-medium text-text">
                  מספר הטלפון שלך
                </label>
                <input
                  id="test-phone"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="0501234567"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-base text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors min-h-[48px]"
                  dir="ltr"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTest}
                disabled={saving || !testPhone || testSent}
                className="w-full py-3 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'שולח...' : testSent ? 'נשלח בהצלחה!' : 'שלח הודעת בדיקה'}
              </button>
            </div>

            {testSent && (
              <div className="bg-success-bg border border-success/20 rounded-[var(--radius-card)] p-4 text-center">
                <p className="text-success font-medium text-sm">
                  הודעת בדיקה נשלחה! בדוק את הוואטסאפ שלך.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 8: Review */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text">סיכום ההגדרות</h2>
              <p className="text-sm text-text-secondary mt-1">בדוק שהכול נכון לפני ההשקה</p>
            </div>

            <div className="space-y-4">
              {/* Business info */}
              <div className="bg-surface rounded-[var(--radius-card)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-text">פרטי עסק</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-text-muted">שם:</span>
                  <span className="text-text">{businessName || '-'}</span>
                  <span className="text-text-muted">סוג:</span>
                  <span className="text-text">{businessType || '-'}</span>
                  <span className="text-text-muted">כתובת:</span>
                  <span className="text-text">{address || '-'}</span>
                </div>
              </div>

              {/* Services summary */}
              <div className="bg-surface rounded-[var(--radius-card)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-text">שירותים ({services.length})</h4>
                <div className="space-y-1">
                  {services.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-text">{s.name}</span>
                      <span className="text-text-muted">{s.duration} דק' | {s.price} ₪</span>
                    </div>
                  ))}
                  {services.length > 5 && (
                    <p className="text-xs text-text-muted">+{services.length - 5} שירותים נוספים</p>
                  )}
                </div>
              </div>

              {/* Working hours summary */}
              <div className="bg-surface rounded-[var(--radius-card)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-text">שעות פעילות</h4>
                <div className="space-y-1">
                  {schedule.filter((d) => d.active).map((d) => (
                    <div key={d.day} className="flex items-center justify-between text-sm">
                      <span className="text-text">{d.dayHe}</span>
                      <span className="text-text-muted" dir="ltr">{d.start} - {d.end}</span>
                    </div>
                  ))}
                  {schedule.filter((d) => !d.active).length > 0 && (
                    <p className="text-xs text-text-muted">
                      סגור: {schedule.filter((d) => !d.active).map((d) => d.dayHe).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* AI style summary */}
              <div className="bg-surface rounded-[var(--radius-card)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-text">סגנון AI</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-text-muted">טון:</span>
                  <span className="text-text">
                    {aiStyle.tone === 'friendly' ? 'ידידותי' : aiStyle.tone === 'professional' ? 'מקצועי' : 'קז\'ואל'}
                  </span>
                  <span className="text-text-muted">אימוג'ים:</span>
                  <span className="text-text">
                    {aiStyle.emojiLevel === 'none' ? 'ללא' : aiStyle.emojiLevel === 'light' ? 'מעט' : 'הרבה'}
                  </span>
                </div>
              </div>

              {/* Connection status */}
              <div className="bg-surface rounded-[var(--radius-card)] p-4 space-y-2">
                <h4 className="text-sm font-semibold text-text">חיבורים</h4>
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-success' : 'bg-warning'}`} />
                  <span className="text-text">
                    וואטסאפ: {whatsappConnected ? 'מחובר' : 'לא מחובר'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 9: Go Live */}
        {currentStep === 9 && (
          <div className="text-center space-y-6 py-8">
            <div className="w-24 h-24 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-12 h-12 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text">הכול מוכן!</h2>
              <p className="text-text-secondary">
                הסוכן החכם שלך מוכן לפעולה. לחץ על "השקה" כדי להתחיל לקבל לקוחות בוואטסאפ.
              </p>
            </div>

            <div className="bg-[var(--color-primary-light)] rounded-[var(--radius-card)] p-6 space-y-3 text-start">
              <h4 className="font-semibold text-text">מה קורה עכשיו?</h4>
              <ul className="text-sm text-text-secondary space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>הסוכן יענה אוטומטית ללקוחות שפונים בוואטסאפ</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>תוכל לנהל תורים, לקוחות והכנסות מהדאשבורד</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>אפשר לשנות את כל ההגדרות בכל שלב דרך ההגדרות</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons - sticky at bottom on mobile */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 bg-white/90 backdrop-blur-md -mx-4 px-4 py-4 border-t border-[#E8EFE9] sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        <button
          type="button"
          onClick={goBack}
          className="px-6 py-3 rounded-[var(--radius-button)] border border-border text-text font-medium hover:bg-surface transition-colors"
        >
          חזור
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={saving}
          className="flex-1 py-3 px-6 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>שומר...</span>
            </>
          ) : currentStep === 9
            ? 'השקה!'
            : currentStep === 8
              ? 'הכול נכון, קדימה!'
              : 'המשך'}
        </button>
      </div>
    </div>
  )
}
