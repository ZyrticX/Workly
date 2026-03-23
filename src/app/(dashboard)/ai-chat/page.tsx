'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  AIChatBubble,
  TypingIndicator,
  type AIChatMessage,
  type ChatAction,
} from '@/components/dashboard/ai-chat-bubble'
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  CalendarX,
} from 'lucide-react'

// ── Example prompts ────────────────────────────────────

const EXAMPLE_PROMPTS = [
  {
    text: 'כמה הרווחתי החודש?',
    icon: TrendingUp,
  },
  {
    text: 'מי הלקוחה הכי רווחית?',
    icon: Users,
  },
  {
    text: 'כמה ביטולים היו השבוע?',
    icon: CalendarX,
  },
  {
    text: 'מה התורים של מחר?',
    icon: Sparkles,
  },
]

// ── Main Page ──────────────────────────────────────────

export default function AIChatPage() {
  const { businessId, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, sending, scrollToBottom])

  // Load chat history from Supabase
  useEffect(() => {
    const loadHistory = async () => {
      if (!businessId) return
      setLoadingHistory(true)

      try {
        const { data } = await supabase
          .from('ai_chat_history')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: true })
          .limit(100)

        if (data && data.length > 0) {
          const mapped: AIChatMessage[] = []
          for (const row of data) {
            // Each row has a question (user) and answer (assistant)
            if (row.question) {
              mapped.push({
                id: `${row.id}-q`,
                role: 'user',
                content: row.question,
                created_at: row.created_at,
              })
            }
            if (row.answer) {
              mapped.push({
                id: `${row.id}-a`,
                role: 'assistant',
                content: row.answer,
                created_at: row.created_at,
              })
            }
          }
          setMessages(mapped)
        }
      } catch (err) {
        console.error('Failed to load AI chat history:', err)
      }

      setLoadingHistory(false)
    }

    loadHistory()
  }, [businessId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending || !businessId) return

    const userMessage: AIChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      // Send to API
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          question: userMessage.content,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await res.json()

      const assistantMessage: AIChatMessage = {
        id: data.id || `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer || data.content || data.text || 'לא הצלחתי לעבד את הבקשה. נסה שוב.',
        table: data.table || null,
        actions: data.actions || undefined,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // History is saved by the API route via bi-chat.ts (question + answer in one row)
    } catch (err) {
      console.error('AI chat error:', err)
      const errorMessage: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'מצטער, משהו השתבש. נסה שוב בבקשה.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }

    setSending(false)
    inputRef.current?.focus()
  }

  // Handle action buttons in AI messages
  const handleAction = async (action: ChatAction) => {
    try {
      const res = await fetch('/api/ai/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          action: action.action,
          params: action.params,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const resultMessage: AIChatMessage = {
          id: `action-${Date.now()}`,
          role: 'assistant',
          content: data.message || `הפעולה "${action.label}" בוצעה בהצלחה.`,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, resultMessage])
      }
    } catch (err) {
      console.error('Action error:', err)
    }
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  const isEmpty = messages.length === 0 && !loadingHistory

  return (
    <div dir="rtl" className="flex flex-col bg-mesh h-[calc(100dvh-5rem-80px)] lg:h-[calc(100dvh-5rem)] min-h-0">
      {/* Header */}
      <div className="shrink-0 glass-strong shadow-ios px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <a href="/" className="flex items-center gap-1 text-sm text-[#5A6E62] hover:text-[#1B2E24] transition-colors mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            חזרה
          </a>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
              <Bot className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                צ'אט AI
              </h1>
              <p className="text-xs text-gray-500">שאל כל שאלה על העסק שלך</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl py-4">
          {/* Loading history */}
          {loadingHistory && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center px-4 pt-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 mb-4">
                <Sparkles className="h-8 w-8 text-[var(--color-primary)]" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                שלום! אני ה-AI העסקי שלך
              </h2>
              <p className="text-sm text-gray-500 text-center mb-8 max-w-sm">
                אני יכול לעזור לך להבין את הנתונים של העסק, לנתח מגמות, ולתת לך
                תובנות מעשיות
              </p>

              <div className="grid w-full max-w-md gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example.text}
                    type="button"
                    onClick={() => sendMessage(example.text)}
                    className="flex items-center gap-3 rounded-2xl glass-card shadow-ios px-4 py-3 text-start text-sm text-gray-700 hover:shadow-ios-lg hover:border-[var(--color-primary)]/40 transition-ios press-effect"
                  >
                    <example.icon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    {example.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <AIChatBubble
              key={msg.id}
              message={msg}
              onAction={handleAction}
            />
          ))}

          {/* Typing indicator */}
          {sending && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 glass-strong shadow-ios px-4 py-3 pb-2 lg:pb-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה על העסק שלך..."
            aria-label="שאל שאלה על העסק"
            disabled={sending}
            className="flex-1 rounded-xl border border-gray-200/50 bg-white/80 px-4 py-3 text-base text-gray-800 placeholder:text-gray-400 focus:border-[var(--color-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-50 transition-ios min-h-[48px]"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="שלח שאלה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-ios transition-ios press-effect hover:bg-[var(--color-primary-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 rtl:rotate-180" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
