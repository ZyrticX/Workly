'use client'

import { useState, useCallback } from 'react'
import { ConversationList } from '@/components/inbox/conversation-list'
import { ChatView } from '@/components/inbox/chat-view'
import { cn } from '@/lib/utils/cn'
import type { ConversationWithContact } from '@/lib/data/messages'

interface InboxShellProps {
  initialConversations: ConversationWithContact[]
}

/**
 * Client shell that manages the inbox layout.
 *
 * - Mobile: shows either the list or the chat (full-screen each).
 * - Desktop (md+): split view — list on the right, chat on the left (RTL).
 */
export function InboxShell({ initialConversations }: InboxShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)

  const handleSelect = useCallback((conversationId: string) => {
    setSelectedId(conversationId)
    setShowChat(true) // On mobile, switch to chat view
  }, [])

  const handleBack = useCallback(() => {
    setShowChat(false)
  }, [])

  const selectedConversation = initialConversations.find(
    (c) => c.id === selectedId
  ) ?? null

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-[#E8EFE9] bg-white max-w-full">
      {/* ── Conversation List Panel ── */}
      <div
        className={cn(
          'h-full w-full md:w-[340px] lg:w-[380px] md:border-e border-[#E8EFE9] shrink-0',
          // On mobile: hide when chat is open
          showChat ? 'hidden md:block' : 'block'
        )}
      >
        <ConversationList
          activeId={selectedId}
          onSelect={handleSelect}
          initialConversations={initialConversations}
        />
      </div>

      {/* ── Chat Panel ── */}
      <div
        className={cn(
          'h-full flex-1 min-w-0',
          // On mobile: only show when a chat is selected
          showChat ? 'block' : 'hidden md:block'
        )}
      >
        <ChatView
          conversationId={selectedId}
          conversation={selectedConversation}
          onBack={handleBack}
        />
      </div>
    </div>
  )
}
