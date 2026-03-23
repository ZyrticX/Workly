'use client'

import { useState, useMemo } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useRealtimeConversations } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils/cn'
import type { ConversationWithContact } from '@/lib/data/messages'

// ── Filter Tabs ──────────────────────────────────────────

type FilterTab = 'all' | 'waiting' | 'bot_active'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'waiting', label: 'ממתין' },
  { key: 'bot_active', label: 'AI פעיל' },
]

// ── Avatar Initials ──────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'bg-[#EDFAF0]', text: 'text-[#0F6E56]' },
  { bg: 'bg-[#FEF2F5]', text: 'text-[#C4546E]' },
  { bg: 'bg-[#EEF6FE]', text: 'text-[#3B7DD8]' },
  { bg: 'bg-[#FEF8EE]', text: 'text-[#B8860B]' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
}

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// ── Time Formatting ──────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays = Math.floor(diffMs / 86_400_000)

    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `${diffMins} דק׳`
    if (diffHours < 24) {
      return date.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
    if (diffDays === 1) return 'אתמול'
    if (diffDays < 7) {
      return date.toLocaleDateString('he-IL', { weekday: 'short' })
    }
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}

// ── Conversation Row ─────────────────────────────────────

interface ConversationRowProps {
  conversation: ConversationWithContact
  isActive: boolean
  onClick: (id: string) => void
}

function ConversationRow({ conversation, isActive, onClick }: ConversationRowProps) {
  const contactName = conversation.contacts?.name || 'ללא שם'
  const color = getAvatarColor(contactName)
  const initials = getInitials(contactName)
  const lastMsg = conversation.lastMessage
  const hasUnread = lastMsg?.direction === 'inbound' && conversation.status === 'active'

  // Truncate the last message preview
  const preview = lastMsg?.content
    ? lastMsg.content.length > 50
      ? `${lastMsg.content.slice(0, 50)}...`
      : lastMsg.content
    : 'אין הודעות'

  const timeLabel = lastMsg?.created_at
    ? formatRelativeTime(lastMsg.created_at)
    : formatRelativeTime(conversation.last_message_at)

  return (
    <button
      type="button"
      onClick={() => onClick(conversation.id)}
      aria-label={`שיחה עם ${contactName}`}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-start transition-ios press-effect min-h-[60px]',
        'hover:bg-white/60 hover:backdrop-blur-sm',
        isActive && 'glass-card bg-[var(--color-primary-light)]/60'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-medium text-sm',
          color.bg,
          color.text
        )}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-sm truncate',
              hasUnread ? 'font-medium text-[#1B2E24]' : 'text-[#1B2E24]'
            )}
          >
            {contactName}
          </span>
          <span className="text-[10px] text-[#8FA89A] shrink-0">{timeLabel}</span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={cn(
              'text-[13px] truncate',
              hasUnread ? 'text-[#1B2E24] font-medium' : 'text-[#5A6E62]'
            )}
            dir="auto"
          >
            {lastMsg?.sender_type === 'ai' && (
              <span className="text-[#3B7DD8]">AI: </span>
            )}
            {preview}
          </p>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bot status badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium',
                conversation.is_bot_active
                  ? 'bg-[#EEF6FE] text-[#3B7DD8]'
                  : 'bg-[#F0F5F2] text-[#5A6E62]'
              )}
              aria-label={conversation.is_bot_active ? 'בוט AI פעיל' : 'מצב ידני'}
            >
              {conversation.is_bot_active && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B7DD8] animate-pulse" aria-hidden="true" />
              )}
              {conversation.is_bot_active ? 'AI' : 'ידני'}
            </span>

            {/* Unread indicator */}
            {hasUnread && (
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" aria-label="הודעה שלא נקראה" />
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Conversation List ────────────────────────────────────

interface ConversationListProps {
  /** Currently selected conversation ID (for active highlight). */
  activeId?: string | null
  /** Called when a conversation is clicked. */
  onSelect: (conversationId: string) => void
  /** Optional: server-loaded initial conversations (for SSR hydration). */
  initialConversations?: ConversationWithContact[]
}

export function ConversationList({
  activeId,
  onSelect,
  initialConversations,
}: ConversationListProps) {
  const { businessId } = useAuth()
  const { conversations: rawConversations, loading } =
    useRealtimeConversations(businessId, initialConversations || [])
  const conversations = rawConversations as ConversationWithContact[]

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  // Filter and search
  const filtered = useMemo(() => {
    let result = conversations

    // Tab filter
    if (activeFilter === 'waiting') {
      result = result.filter(
        (c) => !c.is_bot_active && c.status === 'active'
      )
    } else if (activeFilter === 'bot_active') {
      result = result.filter((c) => c.is_bot_active)
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.contacts?.name?.toLowerCase().includes(q) ||
          c.contacts?.phone?.includes(q)
      )
    }

    return result
  }, [conversations, activeFilter, search])

  return (
    <div className="flex h-full flex-col bg-white overflow-hidden overflow-x-hidden">
      {/* ── Header / Search ── */}
      <div className="shrink-0 border-b border-[#E8EFE9] px-4 pb-2 pt-3">
        <h1 className="text-lg font-medium text-[#1B2E24] mb-2">הודעות</h1>

        {/* Search bar */}
        <div className="relative mb-2">
          <Search
            size={16}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-[#8FA89A] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון..."
            aria-label="חיפוש שיחות"
            dir="rtl"
            className="
              w-full rounded-xl border border-gray-200/50 bg-white/80
              py-2 ps-9 pe-3 text-base text-[#1B2E24] placeholder-[#8FA89A] min-h-[44px]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50
              transition-ios
            "
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1" role="tablist" aria-label="סינון שיחות">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeFilter === tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-ios press-effect min-h-[44px] min-w-[44px]',
                activeFilter === tab.key
                  ? 'bg-[var(--color-primary)] text-white shadow-ios'
                  : 'bg-white/60 backdrop-blur-sm text-[#5A6E62] hover:bg-white/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              <span className="text-xs text-[#8FA89A]">טוען שיחות...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
              {search ? (
                <Search size={28} className="text-[var(--color-primary)]" />
              ) : (
                <MessageCircle size={28} className="text-[var(--color-primary)]" />
              )}
            </div>
            <p className="text-base font-semibold text-[#1B2E24]">
              {search ? 'לא נמצאו שיחות' : 'אין שיחות עדיין'}
            </p>
            <p className="mt-2 text-sm text-[#8FA89A] text-center max-w-[240px] leading-relaxed">
              {search
                ? 'לא נמצאו שיחות תואמות. נסה חיפוש אחר.'
                : 'חבר WhatsApp מההגדרות כדי להתחיל לקבל שיחות מלקוחות'}
            </p>
            {!search && (
              <Link
                href="/settings"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-ios hover:bg-[var(--color-primary-dark)] transition-ios press-effect"
                aria-label="עבור להגדרות לחיבור WhatsApp"
              >
                עבור להגדרות
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100/50">
            {filtered.map((conv) => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isActive={activeId === conv.id}
                onClick={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
