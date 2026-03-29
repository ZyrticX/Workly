import { getConversations, type ConversationWithContact } from '@/lib/data/messages'
import { InboxShell } from '@/components/inbox/inbox-shell'

export const metadata = {
  title: 'הודעות — WhatsApp AI Agent',
}

/**
 * Inbox page — Server Component.
 *
 * Loads conversations server-side, then hands off to InboxShell (client)
 * which manages the split-view layout: ConversationList + ChatView.
 *
 * Mobile: full-screen list OR full-screen chat (toggles on selection).
 * Desktop (md+): side-by-side split view.
 */
export default async function InboxPage() {
  let conversations: ConversationWithContact[] = []
  let loadError: string | null = null
  try {
    conversations = await getConversations() || []
  } catch (err) {
    console.error('[InboxPage] Failed to load conversations:', err)
    loadError = err instanceof Error ? err.message : 'Unknown error'
    conversations = []
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <h1 className="text-xl font-bold text-[#1B2E24] mb-2 px-1 shrink-0">הודעות</h1>
      <div className="flex-1 min-h-0 overflow-hidden">
        <InboxShell initialConversations={conversations} />
      </div>
    </div>
  )
}
