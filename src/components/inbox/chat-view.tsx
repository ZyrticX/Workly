'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRealtimeMessages } from '@/hooks/use-realtime'
import { createClient } from '@/lib/supabase/client'
import { ChatBubble } from '@/components/inbox/chat-bubble'
import { BotToggle } from '@/components/inbox/bot-toggle'
import { MessageInput } from '@/components/inbox/message-input'
import type { ConversationWithContact } from '@/lib/data/messages'

// Module-level singleton — avoids creating a new client on every render
const supabase = createClient()

interface ChatViewProps {
  conversationId: string | null
  /** Pre-loaded conversation data (from server or parent). */
  conversation?: ConversationWithContact | null
  /** Called when the user taps the back button (mobile). */
  onBack?: () => void
}

/**
 * Full chat view for a single conversation.
 *
 * - Header: contact name, phone, bot toggle, back button (mobile).
 * - Messages area: real-time via useRealtimeMessages.
 * - Input bar: disabled when AI bot is active.
 * - Auto-scrolls to the latest message.
 */
export function ChatView({ conversationId, conversation: initialConversation, onBack }: ChatViewProps) {
  const { messages, loading } = useRealtimeMessages(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [conversation, setConversation] = useState<ConversationWithContact | null>(
    initialConversation ?? null
  )
  const [isBotActive, setIsBotActive] = useState(initialConversation?.is_bot_active ?? true)

  // Fetch conversation details if not provided
  useEffect(() => {
    if (initialConversation) {
      setConversation(initialConversation)
      setIsBotActive(initialConversation.is_bot_active)
      return
    }

    if (!conversationId) {
      setConversation(null)
      return
    }

    const fetchConversation = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, contacts ( name, phone )')
        .eq('id', conversationId)
        .single()

      if (data) {
        setConversation(data as ConversationWithContact)
        setIsBotActive(data.is_bot_active)
      }
    }

    fetchConversation()
  }, [conversationId, initialConversation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark conversation as read when opened
  useEffect(() => {
    if (!conversationId) return
    fetch(`/api/conversations/${conversationId}/read`, { method: 'PATCH' }).catch(() => {})
  }, [conversationId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleBotToggle = useCallback((active: boolean) => {
    setIsBotActive(active)
  }, [])

  // ── Empty state: no conversation selected ──
  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#F7FAF8]">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-base font-medium text-[#1B2E24]">בחר שיחה</p>
          <p className="mt-1 text-sm text-[#8FA89A]">
            בחר שיחה מהרשימה כדי לצפות בהודעות
          </p>
        </div>
      </div>
    )
  }

  const contactName = conversation?.contacts?.name || 'ללא שם'
  const contactPhone = conversation?.contacts?.phone || ''

  return (
    <div className="flex h-full flex-col bg-white overflow-x-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-[#E8EFE9] bg-white px-3 py-2.5 shrink-0">
        {/* Back button (visible on mobile) */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="חזרה לרשימת שיחות"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#F7FAF8] transition-colors md:hidden min-h-[44px] min-w-[44px]"
          >
            <ArrowRight size={20} className="text-[#5A6E62]" />
          </button>
        )}

        {/* Contact info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-[#1B2E24] truncate">
            {contactName}
          </h2>
          {contactPhone && (
            <p className="text-[11px] text-[#8FA89A] truncate" dir="ltr">
              {contactPhone}
            </p>
          )}
        </div>

        {/* Bot toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[#5A6E62] hidden sm:inline">
            {isBotActive ? 'AI פעיל' : 'ידני'}
          </span>
          <BotToggle
            conversationId={conversationId}
            initialActive={isBotActive}
            onToggle={handleBotToggle}
          />
        </div>
      </header>

      {/* ── Messages area ── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 bg-[#F0F5F2]"
        style={{
          // WhatsApp-style subtle pattern (via repeating gradient)
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              <span className="text-xs text-[#8FA89A]">טוען הודעות...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#8FA89A]">אין הודעות עדיין</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                content={msg.content || ''}
                direction={msg.direction}
                senderType={msg.sender_type}
                time={msg.created_at}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <MessageInput
        conversationId={conversationId}
        isBotActive={isBotActive}
        onMessageSent={() => {
          // Scroll to bottom after sending
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          })
        }}
      />
    </div>
  )
}
