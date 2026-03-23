'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils/cn'
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Check,
  Sparkles,
  ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────

type BusinessGoal = 'bookings' | 'revenue' | 'support' | 'leads' | ''

interface UpsellRule {
  id: string
  trigger: string
  offer: string
}

interface FaqItem {
  id: string
  question: string
  answer: string
}

interface AiAdvancedConfig {
  businessGoal: BusinessGoal
  salesStyle: number
  upsells: UpsellRule[]
  rules: {
    requirePhone: boolean
    noPriceWithoutDetails: boolean
    escalateComplaints: boolean
    sendSummary: boolean
    offerAlternatives: boolean
    customRule: string
  }
  signature: {
    exampleMessage: string
    faqs: FaqItem[]
  }
}

// ── Constants ──────────────────────────────────────────

const TOTAL_STEPS = 5

const GOAL_OPTIONS: { value: BusinessGoal; icon: string; label: string; desc: string }[] = [
  { value: 'bookings', icon: '📅', label: 'למלא את היומן', desc: 'הסוכן יתמקד בקביעת תורים ומילוי זמנים פנויים' },
  { value: 'revenue', icon: '💰', label: 'למקסם הכנסות', desc: 'הסוכן ידחוף לשירותים יקרים יותר ותוספות' },
  { value: 'support', icon: '🎧', label: 'שירות לקוחות', desc: 'הסוכן יתמקד במענה מהיר ופתרון בעיות' },
  { value: 'leads', icon: '🎯', label: 'סינון לידים', desc: 'הסוכן יסנן לידים ויעביר רק את הרציניים' },
]

const DEFAULT_RULES = {
  requirePhone: true,
  noPriceWithoutDetails: true,
  escalateComplaints: true,
  sendSummary: true,
  offerAlternatives: true,
  customRule: '',
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function getDefaultUpsells(): UpsellRule[] {
  return [
    { id: generateId(), trigger: 'תספורת גבר', offer: 'טיפול בזקן - 30 ש"ח' },
    { id: generateId(), trigger: 'צבע שיער', offer: 'טיפול קראטין - 150 ש"ח' },
  ]
}

function getDefaultFaqs(): FaqItem[] {
  return [
    { id: generateId(), question: 'מה שעות הפעילות שלכם?', answer: '' },
    { id: generateId(), question: 'האם אפשר לבטל תור?', answer: '' },
  ]
}

function getSalesStyleDescription(value: number): string {
  if (value <= 30) return 'הסוכן יהיה אדיב ומרוחק, לא ידחוף מכירות'
  if (value <= 60) return 'הסוכן יציע שירותים בעדינות כשמתאים'
  return 'הסוכן ינסה למקסם כל הזדמנות מכירה'
}

function getSalesStyleColor(value: number): string {
  if (value <= 30) return 'var(--color-success)'
  if (value <= 60) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

// ── Score calculation ──────────────────────────────────

function calculateScore(config: AiAdvancedConfig) {
  let score = 0
  const breakdown: Record<string, boolean | string> = {}

  // Goal (20 points)
  if (config.businessGoal) {
    score += 20
    breakdown.goal = true
  } else {
    breakdown.goal = false
  }

  // Sales style (15 points - always set)
  score += 15
  breakdown.style = true

  // Upsells (25 points)
  const validUpsells = config.upsells.filter(u => u.trigger.trim() && u.offer.trim())
  const upsellScore = Math.min(validUpsells.length * 8, 25)
  score += upsellScore
  breakdown.upsells = `${validUpsells.length}/3`

  // Rules (20 points)
  const activeRules = Object.entries(config.rules).filter(
    ([key, val]) => key !== 'customRule' && val === true
  ).length
  const customRuleBonus = config.rules.customRule.trim() ? 1 : 0
  const ruleScore = Math.min((activeRules + customRuleBonus) * 4, 20)
  score += ruleScore
  breakdown.rules = `${activeRules + customRuleBonus}/5`

  // Signature + FAQ (20 points)
  if (config.signature.exampleMessage.trim()) {
    score += 8
    breakdown.signature = true
  } else {
    breakdown.signature = false
  }
  const validFaqs = config.signature.faqs.filter(f => f.question.trim() && f.answer.trim())
  const faqScore = Math.min(validFaqs.length * 4, 12)
  score += faqScore
  breakdown.faqs = `${validFaqs.length}`

  // Tips
  const tips: string[] = []
  if (!config.businessGoal) tips.push('בחר מטרה עסקית ← +20%')
  if (validUpsells.length < 3) tips.push(`הוסף עוד ${3 - validUpsells.length} הצעות חכמות ← ${Math.min((3 - validUpsells.length) * 8, 25 - upsellScore)}%+`)
  if (!config.signature.exampleMessage.trim()) tips.push('הוסף הודעה לדוגמה ← +8%')
  if (validFaqs.length < 3) tips.push(`הוסף עוד ${3 - validFaqs.length} שאלות נפוצות ← ${score + (3 - validFaqs.length) * 4 > 100 ? 100 - score : (3 - validFaqs.length) * 4}%+`)
  if (activeRules < 5) tips.push(`הפעל עוד ${5 - activeRules} חוקים ← ${(5 - activeRules) * 4}%+`)

  return { score: Math.min(score, 100), breakdown, tips }
}

// ── Main Component ─────────────────────────────────────

export default function TrainAiPage() {
  const router = useRouter()
  const { businessId, loading: authLoading } = useAuth()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const [animatedScore, setAnimatedScore] = useState(0)
  const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 1
  const [businessGoal, setBusinessGoal] = useState<BusinessGoal>('')

  // Step 2
  const [salesStyle, setSalesStyle] = useState(40)

  // Step 3
  const [upsells, setUpsells] = useState<UpsellRule[]>(getDefaultUpsells)

  // Step 4
  const [rules, setRules] = useState(DEFAULT_RULES)

  // Step 5
  const [exampleMessage, setExampleMessage] = useState('')
  const [faqs, setFaqs] = useState<FaqItem[]>(getDefaultFaqs)

  // ── Load existing config ───────────────────────────

  useEffect(() => {
    if (authLoading) return
    if (!businessId) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const res = await fetch('/api/train-ai')
        const data = await res.json()

        if (data.ai_advanced) {
          const c: AiAdvancedConfig = data.ai_advanced
          if (c.businessGoal) setBusinessGoal(c.businessGoal)
          if (typeof c.salesStyle === 'number') setSalesStyle(c.salesStyle)
          if (c.upsells?.length) setUpsells(c.upsells)
          if (c.rules) setRules({ ...DEFAULT_RULES, ...c.rules })
          if (c.signature?.exampleMessage) setExampleMessage(c.signature.exampleMessage)
          if (c.signature?.faqs?.length) setFaqs(c.signature.faqs)
        }
      } catch {
        // First time - use defaults
      }
      setLoading(false)
    }

    load()
  }, [authLoading, businessId])

  // ── Build config object ────────────────────────────

  const buildConfig = useCallback((): AiAdvancedConfig => ({
    businessGoal,
    salesStyle,
    upsells,
    rules,
    signature: {
      exampleMessage,
      faqs,
    },
  }), [businessGoal, salesStyle, upsells, rules, exampleMessage, faqs])

  // ── Save ───────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/train-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_advanced: buildConfig() }),
      })
      router.push('/')
    } catch {
      // Silently handle
    }
    setSaving(false)
  }

  // ── Show score screen ──────────────────────────────

  const handleFinish = () => {
    setShowScore(true)
    const { score } = calculateScore(buildConfig())

    // Animate score
    setAnimatedScore(0)
    let current = 0
    scoreTimerRef.current = setInterval(() => {
      current += 1
      if (current >= score) {
        setAnimatedScore(score)
        if (scoreTimerRef.current) clearInterval(scoreTimerRef.current)
      } else {
        setAnimatedScore(current)
      }
    }, 15)
  }

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current)
    }
  }, [])

  // ── Step navigation ────────────────────────────────

  const canGoNext = () => {
    switch (step) {
      case 1: return !!businessGoal
      default: return true
    }
  }

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  const goBack = () => {
    if (showScore) {
      setShowScore(false)
      setStep(TOTAL_STEPS)
    } else if (step > 1) {
      setStep(step - 1)
    }
  }

  // ── Upsell helpers ─────────────────────────────────

  const addUpsell = () => {
    setUpsells([...upsells, { id: generateId(), trigger: '', offer: '' }])
  }

  const removeUpsell = (id: string) => {
    setUpsells(upsells.filter(u => u.id !== id))
  }

  const updateUpsell = (id: string, field: 'trigger' | 'offer', value: string) => {
    setUpsells(upsells.map(u => u.id === id ? { ...u, [field]: value } : u))
  }

  // ── FAQ helpers ────────────────────────────────────

  const addFaq = () => {
    setFaqs([...faqs, { id: generateId(), question: '', answer: '' }])
  }

  const removeFaq = (id: string) => {
    setFaqs(faqs.filter(f => f.id !== id))
  }

  const updateFaq = (id: string, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  // ── Loading state ──────────────────────────────────

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          <span className="text-sm text-[var(--color-text-muted)]">טוען...</span>
        </div>
      </div>
    )
  }

  // ── Score Screen ───────────────────────────────────

  if (showScore) {
    const { score, breakdown, tips } = calculateScore(buildConfig())
    const circumference = 2 * Math.PI * 54
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference

    const scoreColor =
      score >= 80 ? 'var(--color-success)' :
      score >= 50 ? 'var(--color-warning)' :
      'var(--color-danger)'

    return (
      <div className="max-w-lg mx-auto pb-28">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
            <h1 className="text-2xl font-bold text-[var(--color-text)]">ציון הסוכן שלך</h1>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            ככל שהציון גבוה יותר, הסוכן חכם יותר
          </p>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center mb-10">
          <div className="relative w-44 h-44">
            {/* Subtle glow behind the circle */}
            <div
              className="absolute inset-2 rounded-full blur-xl opacity-20 transition-colors duration-500"
              style={{ backgroundColor: scoreColor }}
            />
            <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120">
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="6"
              />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'stroke-dashoffset 0.05s linear',
                  filter: `drop-shadow(0 0 6px ${scoreColor}40)`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <span
                className="text-5xl font-bold tabular-nums"
                style={{ color: scoreColor }}
              >
                {animatedScore}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] mt-0.5">מתוך 100</span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">פירוט ציון</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">מטרה עסקית</span>
              <span>{breakdown.goal ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">סגנון מכירה</span>
              <span>{breakdown.style ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">הצעות חכמות</span>
              <span className="font-medium text-[var(--color-text)]">{breakdown.upsells}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">חוקים</span>
              <span className="font-medium text-[var(--color-text)]">{breakdown.rules}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">חתימה אישית</span>
              <span>{breakdown.signature ? '✅' : '❌'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">שאלות נפוצות</span>
              <span className="font-medium text-[var(--color-text)]">{breakdown.faqs}</span>
            </div>
          </div>
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-5 mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
              💡 טיפים לשיפור
            </h3>
            <ul className="space-y-2">
              {tips.slice(0, 3).map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                >
                  <span className="text-[var(--color-primary)] mt-0.5">→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom actions */}
        <div className="fixed bottom-0 left-0 right-0 glass-nav safe-area-bottom z-30">
          <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] rounded-[var(--radius-button)] hover:bg-[var(--color-surface)] transition-colors press-effect"
            >
              <ArrowRight className="w-4 h-4" />
              חזרה
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white rounded-[var(--radius-button)] press-effect transition-ios disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? 'שומר...' : 'סיום ושמירה'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ─────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#8FA89A]">
            שלב {step} מתוך {TOTAL_STEPS}
          </span>
          <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
            {Math.round((step / TOTAL_STEPS) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#E8EFE9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-primary-dynamic"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div
        key={step}
        className="animate-page-in"
      >
        {step === 1 && <Step1 businessGoal={businessGoal} setBusinessGoal={setBusinessGoal} />}
        {step === 2 && <Step2 salesStyle={salesStyle} setSalesStyle={setSalesStyle} />}
        {step === 3 && (
          <Step3
            upsells={upsells}
            addUpsell={addUpsell}
            removeUpsell={removeUpsell}
            updateUpsell={updateUpsell}
          />
        )}
        {step === 4 && <Step4 rules={rules} setRules={setRules} />}
        {step === 5 && (
          <Step5
            exampleMessage={exampleMessage}
            setExampleMessage={setExampleMessage}
            faqs={faqs}
            addFaq={addFaq}
            removeFaq={removeFaq}
            updateFaq={updateFaq}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="mt-8 mb-4">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-[#5A6E62] rounded-xl hover:bg-[#F7FAF8] transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              הקודם
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold rounded-xl shadow-sm transition-all btn-primary',
              !canGoNext() && 'opacity-40 cursor-not-allowed'
            )}
          >
            {step === TOTAL_STEPS ? 'סיום' : 'הבא'}
            {step < TOTAL_STEPS && <ArrowLeft className="w-4 h-4" />}
            {step === TOTAL_STEPS && <Sparkles className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// Step Components
// ══════════════════════════════════════════════════════

// ── Step 1: Business Goal ────────────────────────────

function Step1({
  businessGoal,
  setBusinessGoal,
}: {
  businessGoal: BusinessGoal
  setBusinessGoal: (g: BusinessGoal) => void
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
          מה המטרה העיקרית של הסוכן?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          בחר את המטרה שהכי חשובה לעסק שלך
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GOAL_OPTIONS.map(opt => {
          const selected = businessGoal === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setBusinessGoal(opt.value)}
              className={cn(
                'relative glass-card rounded-[var(--radius-card)] shadow-ios p-5 text-center transition-all duration-300 press-effect',
                'flex flex-col items-center gap-2.5',
                'hover:shadow-ios-lg hover:-translate-y-0.5',
                selected
                  ? 'ring-2 ring-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-ios-lg'
                  : 'hover:bg-white/80'
              )}
            >
              <span className={cn('text-3xl transition-transform duration-300', selected && 'scale-110')}>{opt.icon}</span>
              <span className="text-sm font-semibold text-[var(--color-text)]">{opt.label}</span>
              <span className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                {opt.desc}
              </span>
              {selected && (
                <div
                  className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center shadow-ios"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2: Sales Style ──────────────────────────────

function Step2({
  salesStyle,
  setSalesStyle,
}: {
  salesStyle: number
  setSalesStyle: (v: number) => void
}) {
  const dynamicColor = getSalesStyleColor(salesStyle)

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
          כמה אגרסיבי הסוכן צריך להיות?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          קבע את רמת המכירתיות של הסוכן
        </p>
      </div>

      <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-6">
        {/* Labels */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🟢</span>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              שירותי ורגוע
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              מכירתי ואגרסיבי
            </span>
            <span className="text-lg">🔴</span>
          </div>
        </div>

        {/* Slider */}
        <div className="relative mb-8 pt-10">
          {/* Value bubble */}
          <div
            className="absolute top-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-ios transition-all duration-150"
            style={{
              right: `${salesStyle}%`,
              backgroundColor: dynamicColor,
              transform: 'translateX(50%)',
            }}
          >
            {salesStyle}
            <div
              className="absolute -bottom-1 right-1/2 translate-x-1/2 w-2 h-2 rotate-45"
              style={{ backgroundColor: dynamicColor }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={salesStyle}
            onChange={e => setSalesStyle(Number(e.target.value))}
            className="w-full rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(to left, ${dynamicColor} ${salesStyle}%, var(--color-border) ${salesStyle}%)`,
              color: dynamicColor,
            }}
          />
        </div>

        {/* Dynamic description */}
        <div
          className="text-center p-3 rounded-[var(--radius-badge)] text-sm font-medium transition-all duration-300"
          style={{
            backgroundColor: `color-mix(in srgb, ${dynamicColor} 10%, transparent)`,
            color: dynamicColor,
          }}
        >
          {getSalesStyleDescription(salesStyle)}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Smart Upsells ────────────────────────────

function Step3({
  upsells,
  addUpsell,
  removeUpsell,
  updateUpsell,
}: {
  upsells: UpsellRule[]
  addUpsell: () => void
  removeUpsell: (id: string) => void
  updateUpsell: (id: string, field: 'trigger' | 'offer', value: string) => void
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
          הצעות חכמות
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          כשלקוח קובע תור, מה להציע בנוסף?
        </p>
      </div>

      <div className="space-y-3">
        {upsells.map((upsell, index) => (
          <div
            key={upsell.id}
            className="glass-card rounded-[var(--radius-card)] shadow-ios p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                הצעה {index + 1}
              </span>
              {upsells.length > 1 && (
                <button
                  onClick={() => removeUpsell(upsell.id)}
                  className="p-1.5 rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                  כשקובעים:
                </label>
                <input
                  type="text"
                  value={upsell.trigger}
                  onChange={e => updateUpsell(upsell.id, 'trigger', e.target.value)}
                  placeholder="לדוגמה: תספורת גבר"
                  className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow"
                />
              </div>

              <div className="flex items-center justify-center">
                <ChevronDown className="w-4 h-4 text-[var(--color-primary)]" />
              </div>

              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                  להציע:
                </label>
                <input
                  type="text"
                  value={upsell.offer}
                  onChange={e => updateUpsell(upsell.id, 'offer', e.target.value)}
                  placeholder="לדוגמה: טיפול בזקן - 30 ש&quot;ח"
                  className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addUpsell}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors press-effect"
        >
          <Plus className="w-4 h-4" />
          הוסף הצעה
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Rules & Guardrails ───────────────────────

function Step4({
  rules,
  setRules,
}: {
  rules: typeof DEFAULT_RULES
  setRules: (r: typeof DEFAULT_RULES) => void
}) {
  const RULE_ITEMS: { key: keyof Omit<typeof DEFAULT_RULES, 'customRule'>; label: string; icon: string }[] = [
    { key: 'requirePhone', label: 'לבקש מספר טלפון לפני קביעת תור', icon: '📱' },
    { key: 'noPriceWithoutDetails', label: 'לא לתת מחירים בלי לשאול פרטים', icon: '💲' },
    { key: 'escalateComplaints', label: 'להעביר אליי אם לקוח מתלונן', icon: '🚨' },
    { key: 'sendSummary', label: 'לשלוח סיכום שיחה אחרי כל תור', icon: '📋' },
    { key: 'offerAlternatives', label: 'להציע זמנים חלופיים כשאין פנוי', icon: '🔄' },
  ]

  const toggleRule = (key: keyof Omit<typeof DEFAULT_RULES, 'customRule'>) => {
    setRules({ ...rules, [key]: !rules[key] })
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
          חוקים והנחיות
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          איך הסוכן צריך להתנהג?
        </p>
      </div>

      <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-4 mb-4">
        <div className="space-y-1">
          {RULE_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => toggleRule(item.key)}
              className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors"
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              <span className="text-sm text-[var(--color-text)] text-right flex-1">
                {item.label}
              </span>
              {/* Toggle switch */}
              <div
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                  rules[item.key] ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    rules[item.key] ? 'translate-x-0.5' : 'translate-x-5'
                  )}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom rule */}
      <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-4">
        <label className="text-sm font-medium text-[var(--color-text)] mb-2 block">
          הוסף חוק נוסף...
        </label>
        <textarea
          value={rules.customRule}
          onChange={e => setRules({ ...rules, customRule: e.target.value })}
          placeholder="לדוגמה: תמיד להציע ללקוחות חדשים 10% הנחה..."
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow resize-none"
        />
      </div>
    </div>
  )
}

// ── Step 5: Signature Style + FAQ ────────────────────

function Step5({
  exampleMessage,
  setExampleMessage,
  faqs,
  addFaq,
  removeFaq,
  updateFaq,
}: {
  exampleMessage: string
  setExampleMessage: (v: string) => void
  faqs: FaqItem[]
  addFaq: () => void
  removeFaq: (id: string) => void
  updateFaq: (id: string, field: 'question' | 'answer', value: string) => void
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
          חתימה אישית
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          איך אתה מדבר עם לקוחות?
        </p>
      </div>

      {/* Example message */}
      <div className="glass-card rounded-[var(--radius-card)] shadow-ios p-4 mb-4">
        <label className="text-sm font-medium text-[var(--color-text)] mb-2 block">
          כתוב דוגמה להודעה אופיינית שלך
        </label>
        <textarea
          value={exampleMessage}
          onChange={e => setExampleMessage(e.target.value)}
          placeholder={'אח יקר \u2764\uFE0F הכל טוב? רוצה לקבוע לך למחר?'}
          rows={3}
          className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow resize-none"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          הסוכן ילמד מהסגנון שלך וידבר בצורה דומה
        </p>
      </div>

      {/* FAQs */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📚</span>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">שאלות נפוצות</h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className="glass-card rounded-[var(--radius-card)] shadow-ios p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  שאלה {index + 1}
                </span>
                {faqs.length > 1 && (
                  <button
                    onClick={() => removeFaq(faq.id)}
                    className="p-1.5 rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <input
                type="text"
                value={faq.question}
                onChange={e => updateFaq(faq.id, 'question', e.target.value)}
                placeholder="השאלה שלקוחות שואלים"
                className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow mb-2"
              />

              <textarea
                value={faq.answer}
                onChange={e => updateFaq(faq.id, 'answer', e.target.value)}
                placeholder="התשובה שהסוכן צריך לתת"
                rows={2}
                className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-badge)] border border-[var(--color-border)] bg-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow resize-none"
              />
            </div>
          ))}
        </div>

        <button
          onClick={addFaq}
          className="w-full flex items-center justify-center gap-2 py-3 mt-3 text-sm font-medium rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors press-effect"
        >
          <Plus className="w-4 h-4" />
          הוסף שאלה
        </button>
      </div>
    </div>
  )
}
