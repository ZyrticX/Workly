'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { Bot, User, Send, CheckCircle, Sparkles } from 'lucide-react'
import { saveAiOnboardingData, type OnboardingData } from '@/lib/auth/save-onboarding'

// ── Types ──────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface AiOnboardingChatProps {
  businessId: string
  onComplete: () => void
}

// ── Quick Reply Chips ──────────────────────────────────

const INITIAL_SUGGESTIONS = [
  'מספרה',
  'קוסמטיקה',
  'ציפורניים',
  'מאמן אישי',
  'מרפאה',
  'עורך דין',
  'רואה חשבון',
]

// ── Helper: parse JSON from AI response ────────────────

function extractJsonFromResponse(text: string): OnboardingData | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[1])
    if (parsed.ready && parsed.businessName && parsed.services) {
      return {
        businessType: parsed.businessType || '',
        businessName: parsed.businessName || '',
        services: parsed.services || [],
        workingHours: parsed.workingHours || [],
        tone: parsed.tone || 'friendly',
        cancellationPolicy: parsed.cancellationPolicy || '',
      }
    }
  } catch {
    // JSON parse failed, not ready yet
  }

  return null
}

/** Strip the JSON block from the display text */
function getDisplayText(text: string): string {
  return text.replace(/```json[\s\S]*?```/, '').trim()
}

// ── Typing Indicator ───────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
        <Bot className="h-4 w-4 text-[var(--color-primary)]" />
      </div>
      <div className="rounded-2xl rounded-ts-sm bg-white/80 backdrop-blur-sm border border-white/40 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ── Summary Card ───────────────────────────────────────

function SummaryCard({
  data,
  onConfirm,
  saving,
}: {
  data: OnboardingData
  onConfirm: () => void
  saving: boolean
}) {
  const toneLabels: Record<string, string> = {
    friendly: 'ידידותי',
    professional: 'מקצועי',
    casual: "קז'ואל",
    humorous: 'הומוריסטי',
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-white/40 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 text-[var(--color-primary)]">
        <CheckCircle className="h-5 w-5" />
        <h3 className="text-base font-bold">סיכום ההגדרות</h3>
      </div>

      {/* Business info */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">פרטי עסק</p>
        <div className="bg-surface rounded-xl p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">שם:</span>
            <span className="font-medium text-text">{data.businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">סוג:</span>
            <span className="font-medium text-text">{data.businessType}</span>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">שירותים ({data.services.length})</p>
        <div className="bg-surface rounded-xl p-3 space-y-1.5 text-sm">
          {data.services.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-text">{s.name}</span>
              <span className="text-text-muted text-xs">{s.duration} דק' | {s.price} ₪</span>
            </div>
          ))}
        </div>
      </div>

      {/* Working hours */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">שעות פעילות</p>
        <div className="bg-surface rounded-xl p-3 space-y-1 text-sm">
          {data.workingHours.filter((d) => d.active).map((d, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-text">{d.dayHe}</span>
              <span className="text-text-muted text-xs" dir="ltr">{d.start} - {d.end}</span>
            </div>
          ))}
          {data.workingHours.filter((d) => !d.active).length > 0 && (
            <p className="text-xs text-text-muted pt-1">
              סגור: {data.workingHours.filter((d) => !d.active).map((d) => d.dayHe).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Tone & Policy */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">טון הבוט</p>
          <div className="bg-surface rounded-xl p-3 text-sm text-text">
            {toneLabels[data.tone] || data.tone}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">מדיניות ביטולים</p>
          <div className="bg-surface rounded-xl p-3 text-sm text-text line-clamp-2">
            {data.cancellationPolicy}
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        className="w-full py-3.5 px-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-ios"
      >
        {saving ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            שומר...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            אישור והפעלה
          </>
        )}
      </button>
    </div>
  )
}

// ── Success Screen ─────────────────────────────────────

function SuccessScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-[var(--color-primary)]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text">העסק מוכן!</h2>
        <p className="text-text-secondary text-sm max-w-xs mx-auto">
          כל ההגדרות נשמרו בהצלחה. הסוכן החכם שלך מוכן לפעולה.
        </p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="py-3 px-8 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors shadow-ios"
      >
        לדאשבורד
      </button>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────

export default function AiOnboardingChat({ businessId, onComplete }: AiOnboardingChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [extractedData, setExtractedData] = useState<OnboardingData | null>(null)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Send initial greeting from AI
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const greeting: ChatMessage = {
      id: 'greeting',
      role: 'assistant',
      content:
        'היי! אני העוזר החכם שלך. בוא נגדיר את העסק שלך ב-2 דקות.\n\nקודם כל, ספר לי - מה סוג העסק שלך?',
      created_at: new Date().toISOString(),
    }
    setMessages([greeting])
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return

      setError('')
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        created_at: new Date().toISOString(),
      }

      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)
      setInput('')
      setIsTyping(true)

      try {
        // Build API payload (exclude greeting for cleaner context)
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetch('/api/ai/onboarding-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, businessId }),
        })

        if (!res.ok) {
          throw new Error('Failed to get AI response')
        }

        const data = await res.json()
        const aiContent: string = data.message || ''

        // Check if AI returned structured data
        const parsed = extractJsonFromResponse(aiContent)

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiContent,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, aiMsg])

        if (parsed) {
          setExtractedData(parsed)
        }
      } catch {
        setError('שגיאה בתקשורת עם ה-AI. נסה שוב.')
      } finally {
        setIsTyping(false)
        inputRef.current?.focus()
      }
    },
    [messages, isTyping, businessId]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickReply = (text: string) => {
    sendMessage(text)
  }

  const handleConfirm = async () => {
    if (!extractedData) return
    setSaving(true)
    setError('')

    try {
      await saveAiOnboardingData(businessId, extractedData)
      setCompleted(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בשמירת ההגדרות'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleGoToDashboard = () => {
    onComplete()
    router.push('/')
  }

  // Show success screen after saving
  if (completed) {
    return <SuccessScreen onContinue={handleGoToDashboard} />
  }

  // Determine if we should show quick reply chips (only before user has sent a message)
  const userHasReplied = messages.some((m) => m.role === 'user')

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-14rem)] max-h-[700px] min-h-[400px]">
      {/* Error banner */}
      {error && (
        <div className="bg-danger-bg border border-danger/20 text-danger text-sm rounded-xl p-3 mx-1 mb-2 animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-2 py-3 space-y-1"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.02) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user'
          const displayText = isUser ? msg.content : getDisplayText(msg.content)

          // Don't render empty assistant messages (if JSON was the only content)
          if (!displayText && !isUser) return null

          return (
            <div
              key={msg.id}
              className={cn(
                'flex items-start gap-2.5 py-1.5 animate-in fade-in slide-in-from-bottom-1 duration-200',
                isUser ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  isUser ? 'bg-gray-100' : 'bg-[var(--color-primary)]/10'
                )}
              >
                {isUser ? (
                  <User className="h-4 w-4 text-gray-500" />
                ) : (
                  <Bot className="h-4 w-4 text-[var(--color-primary)]" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm',
                  isUser
                    ? 'rounded-te-sm bg-[var(--color-primary)] text-white'
                    : 'rounded-ts-sm bg-white/80 backdrop-blur-sm border border-white/40 text-gray-800'
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {displayText}
                </p>
                <p
                  className={cn(
                    'mt-1 text-[10px]',
                    isUser ? 'text-white/70' : 'text-gray-400'
                  )}
                >
                  {new Date(msg.created_at).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Summary card (shown when AI has extracted all data) */}
        {extractedData && !completed && (
          <div className="pt-2">
            <SummaryCard data={extractedData} onConfirm={handleConfirm} saving={saving} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick reply chips (before first user message) */}
      {!userHasReplied && !isTyping && (
        <div className="px-2 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-wrap gap-2 justify-center">
            {INITIAL_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleQuickReply(suggestion)}
                className="px-3.5 py-2 rounded-full text-sm font-medium bg-white/80 backdrop-blur-sm border border-white/40 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30 transition-colors shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      {!extractedData && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-2 py-3 border-t border-border/50 bg-white/50 backdrop-blur-sm"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="הקלד הודעה..."
            disabled={isTyping}
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-white text-text text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors disabled:opacity-50"
            dir="rtl"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            aria-label="שלח"
          >
            <Send className="h-4 w-4 rotate-180" />
          </button>
        </form>
      )}
    </div>
  )
}
