'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtimeMessages } from '@/hooks/use-realtime'
import { ChatBubble } from '@/components/inbox/chat-bubble'
import { createClient } from '@/lib/supabase/client'
import {
  Bug,
  Send,
  Loader2,
  Search,
  ChevronDown,
  ChevronLeft,
  Clock,
  Brain,
  Shield,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const supabase = createClient()

interface ContactOption {
  id: string
  name: string | null
  phone: string
}

interface DebugInfo {
  extracted: Record<string, unknown> | null
  bookingStateBefore: Record<string, unknown> | null
  bookingStateAfter: Record<string, unknown> | null
  timing: { extraction: number; aiGeneration: number; total: number }
  conversationId: string
  contactName: string | null
  intent: string | null
  confidence: number | null
  escalated: boolean
  inputGuard: { flagged: boolean; pattern?: string }
  error: string | null
}

// ── Contact Selector ────────────────────────────────

function ContactSelector({
  onSelect,
  selected,
  businessId,
}: {
  onSelect: (c: ContactOption) => void
  selected: ContactOption | null
  businessId: string | null
}) {
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchContacts = useCallback(
    async (q: string) => {
      if (!businessId) return
      setLoading(true)
      let query = supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('business_id', businessId)
        .order('name', { ascending: true })
        .limit(15)

      if (q.trim()) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      }

      const { data } = await query
      setContacts((data as ContactOption[]) || [])
      setLoading(false)
    },
    [businessId]
  )

  useEffect(() => {
    if (open) fetchContacts(search)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchContacts(val), 300)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={dropdownRef} className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-sm hover:border-[var(--color-primary)] transition-colors"
      >
        <Search className="h-4 w-4 text-text-muted shrink-0" />
        <span className={cn('flex-1 text-start truncate', !selected && 'text-text-muted')}>
          {selected ? `${selected.name || 'ללא שם'} — ${selected.phone}` : 'בחר לקוח...'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-xl border border-[var(--color-border)] bg-white shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון..."
              className="w-full px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-4">לא נמצאו לקוחות</p>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={cn(
                    'flex flex-col w-full px-3 py-2 text-start text-sm hover:bg-[var(--color-primary-light)] transition-colors',
                    selected?.id === c.id && 'bg-[var(--color-primary-light)]'
                  )}
                >
                  <span className="font-medium text-text">{c.name || 'ללא שם'}</span>
                  <span className="text-xs text-text-muted">{c.phone}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Debug Panel ─────────────────────────────────────

function DebugPanel({ debug }: { debug: DebugInfo | null }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    extracted: true,
    state: true,
    timing: true,
    response: true,
  })

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  if (!debug)
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-2">
        <Bug className="h-8 w-8 opacity-40" />
        <p>שלח הודעה כדי לראות מידע דיבאג</p>
      </div>
    )

  const intentColor: Record<string, string> = {
    book: 'bg-green-100 text-green-700',
    cancel: 'bg-red-100 text-red-700',
    reschedule: 'bg-amber-100 text-amber-700',
    greeting: 'bg-blue-100 text-blue-700',
    question: 'bg-purple-100 text-purple-700',
    escalate: 'bg-orange-100 text-orange-700',
  }

  const extracted = debug.extracted as Record<string, unknown> | null

  return (
    <div className="flex flex-col gap-2 text-sm">
      {/* Error banner */}
      {debug.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 font-medium text-xs">שגיאה</p>
          <p className="text-red-600 text-xs mt-1 font-mono break-all">{debug.error}</p>
        </div>
      )}

      {/* Extracted Data */}
      <Section
        title="נתונים שחולצו"
        icon={<Brain className="h-4 w-4" />}
        open={openSections.extracted}
        onToggle={() => toggle('extracted')}
      >
        {extracted ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <DebugRow label="Intent" value={extracted.intent as string} badge={intentColor[(extracted.intent as string) || ''] || 'bg-gray-100 text-gray-700'} />
            <DebugRow label="Service" value={extracted.service as string} />
            <DebugRow label="Date" value={extracted.date as string} />
            <DebugRow label="Time" value={extracted.time as string} />
            <DebugRow label="Name" value={extracted.name as string} />
            <DebugRow label="Confirmation" value={extracted.confirmation != null ? String(extracted.confirmation) : null} />
            <DebugRow label="For Other" value={extracted.for_other != null ? String(extracted.for_other) : null} />
            <DebugRow label="Gender" value={extracted.gender as string} />
            <DebugRow label="Notes" value={extracted.notes as string} />
          </div>
        ) : (
          <p className="text-text-muted text-xs">לא בוצעה חילוץ</p>
        )}
      </Section>

      {/* Booking State */}
      <Section
        title="מצב הזמנה"
        icon={<Zap className="h-4 w-4" />}
        open={openSections.state}
        onToggle={() => toggle('state')}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 font-mono">
            {(debug.bookingStateBefore as Record<string, unknown>)?.step as string || 'idle'}
          </span>
          <ChevronLeft className="h-3 w-3 text-text-muted" />
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-mono">
            {(debug.bookingStateAfter as Record<string, unknown>)?.step as string || 'idle'}
          </span>
        </div>
        {debug.bookingStateAfter && Object.keys(debug.bookingStateAfter).length > 1 && (
          <pre className="mt-2 text-[10px] font-mono bg-gray-50 rounded-lg p-2 overflow-x-auto max-h-32 overflow-y-auto">
            {JSON.stringify(debug.bookingStateAfter, null, 2)}
          </pre>
        )}
      </Section>

      {/* Timing */}
      <Section
        title="זמנים"
        icon={<Clock className="h-4 w-4" />}
        open={openSections.timing}
        onToggle={() => toggle('timing')}
      >
        <div className="flex flex-col gap-1.5">
          <TimingBar label="חילוץ" ms={debug.timing.extraction} max={debug.timing.total} />
          <TimingBar label="AI" ms={debug.timing.aiGeneration} max={debug.timing.total} />
          <div className="flex justify-between text-xs text-text-muted pt-1 border-t border-[var(--color-border)]">
            <span>סה״כ</span>
            <span className="font-mono font-medium text-text">{debug.timing.total}ms</span>
          </div>
        </div>
      </Section>

      {/* Response Info */}
      <Section
        title="תגובה"
        icon={<Shield className="h-4 w-4" />}
        open={openSections.response}
        onToggle={() => toggle('response')}
      >
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <DebugRow label="Intent" value={debug.intent} badge={intentColor[debug.intent || ''] || 'bg-gray-100 text-gray-700'} />
          <DebugRow label="Confidence" value={debug.confidence != null ? `${Math.round(debug.confidence * 100)}%` : null} />
          <DebugRow label="Escalated" value={debug.escalated ? 'כן' : 'לא'} />
          <DebugRow label="Guard" value={debug.inputGuard.flagged ? `חסום: ${debug.inputGuard.pattern}` : 'תקין'} badge={debug.inputGuard.flagged ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} />
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors text-xs font-medium text-text"
      >
        {icon}
        <span className="flex-1 text-start">{title}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  )
}

function DebugRow({
  label,
  value,
  badge,
}: {
  label: string
  value: string | null | undefined
  badge?: string
}) {
  return (
    <>
      <span className="text-text-muted text-xs">{label}</span>
      {badge && value ? (
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium w-fit', badge)}>
          {value}
        </span>
      ) : (
        <span className={cn('text-xs font-mono', value ? 'text-text' : 'text-text-muted')}>
          {value || '—'}
        </span>
      )}
    </>
  )
}

function TimingBar({ label, ms, max }: { label: string; ms: number; max: number }) {
  const pct = max > 0 ? Math.min((ms / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted w-12">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-text-muted w-14 text-left">{ms}ms</span>
    </div>
  )
}

// ── Typing Indicator ────────────────────────────────

function TypingIndicator() {
  return (
    <div className="self-start flex items-center gap-1.5 px-4 py-3 rounded-2xl glass-card max-w-[100px]">
      <span className="h-2 w-2 rounded-full bg-[#8FA89A] animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-[#8FA89A] animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-[#8FA89A] animate-bounce" />
    </div>
  )
}

// ── Main Page ───────────────────────────────────────

export default function SimulatorPage() {
  const { businessId, loading: authLoading } = useAuth()
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showDebug, setShowDebug] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, loading: messagesLoading } = useRealtimeMessages(conversationId)

  // Load existing conversation when contact changes
  useEffect(() => {
    if (!selectedContact || !businessId) {
      setConversationId(null)
      setDebugInfo(null)
      return
    }

    const fetchConversation = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('business_id', businessId)
        .eq('contact_id', selectedContact.id)
        .eq('status', 'active')
        .single()
      setConversationId(data?.id || null)
    }
    fetchConversation()
  }, [selectedContact, businessId])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send simulated message
  const sendMessage = async () => {
    if (!input.trim() || !selectedContact || sending) return
    const msg = input.trim()
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: selectedContact.id, message: msg }),
      })
      const data = await res.json()

      if (res.ok) {
        if (data.debug?.conversationId && !conversationId) {
          setConversationId(data.debug.conversationId)
        }
        setDebugInfo(data.debug)
      } else {
        setDebugInfo({
          extracted: null,
          bookingStateBefore: null,
          bookingStateAfter: null,
          timing: { extraction: 0, aiGeneration: 0, total: 0 },
          conversationId: conversationId || '',
          contactName: selectedContact.name,
          intent: null,
          confidence: null,
          escalated: false,
          inputGuard: { flagged: false },
          error: data.error || 'Unknown error',
        })
      }
    } catch (err) {
      setDebugInfo({
        extracted: null,
        bookingStateBefore: null,
        bookingStateAfter: null,
        timing: { extraction: 0, aiGeneration: 0, total: 0 },
        conversationId: conversationId || '',
        contactName: selectedContact.name,
        intent: null,
        confidence: null,
        escalated: false,
        inputGuard: { flagged: false },
        error: err instanceof Error ? err.message : 'Network error',
      })
    }

    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="flex flex-col h-[calc(100dvh-3.5rem)] bg-[#F7FAF8]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-white shrink-0">
        <Bug className="h-5 w-5 text-[var(--color-primary)]" />
        <h1 className="text-base font-semibold text-text">סימולטור בוט</h1>
        <div className="flex-1" />
        <ContactSelector
          businessId={businessId}
          selected={selectedContact}
          onSelect={setSelectedContact}
        />
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            showDebug
              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]'
              : 'bg-gray-100 text-text-muted hover:bg-gray-200'
          )}
        >
          Debug
        </button>
      </header>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedContact ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <Bug className="h-8 w-8 text-[var(--color-primary)]" />
              </div>
              <p className="text-base font-medium text-text mt-2">סימולטור בוט</p>
              <p className="text-sm text-text-muted">בחר לקוח כדי להתחיל שיחת בדיקה</p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                    </div>
                  ) : messages.length === 0 && !conversationId ? (
                    <p className="text-center text-sm text-text-muted py-8">
                      שלח הודעה ראשונה כדי להתחיל
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <ChatBubble
                        key={msg.id}
                        content={msg.content || ''}
                        direction={msg.direction}
                        senderType={msg.sender_type as 'customer' | 'agent' | 'ai'}
                        time={msg.created_at}
                      />
                    ))
                  )}
                  {sending && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar */}
              <div className="border-t border-[var(--color-border)] bg-white px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 max-w-2xl mx-auto">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="הקלד הודעה בתור הלקוח..."
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 bg-gray-50/50"
                    dir="auto"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 scale-x-[-1]" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="w-[340px] border-r border-[var(--color-border)] bg-white overflow-y-auto p-3 shrink-0 hidden lg:block">
            <DebugPanel debug={debugInfo} />
          </div>
        )}
      </div>
    </div>
  )
}
