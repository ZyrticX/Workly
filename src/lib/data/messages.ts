import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface ContactInfo {
  name: string | null
  phone: string | null
  status: string
}

interface LastMessage {
  content: string | null
  created_at: string
  direction: 'inbound' | 'outbound'
  sender_type: string
}

export interface ConversationWithContact {
  id: string
  business_id: string
  contact_id: string
  status: string
  assigned_to: string | null
  is_bot_active: boolean
  last_message_at: string
  created_at: string
  contacts: ContactInfo | null
  lastMessage: LastMessage | null
}

export interface Message {
  id: string
  business_id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  sender_type: string
  type: string
  content: string | null
  status: string
  provider_message_id: string | null
  created_at: string
}

export interface ConversationFilters {
  status?: 'active' | 'closed' | 'waiting'
  botActive?: boolean
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Get conversations list with contact info, ordered by most recent message.
 * Each conversation includes only the last message for the list view.
 */
export async function getConversations(
  filters?: ConversationFilters
): Promise<ConversationWithContact[]> {
  const supabase = await createClient()

  // Auth check — resolve current user's business
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  let query = supabase
    .from('conversations')
    .select(
      `
      *,
      contacts ( name, phone, status ),
      messages ( content, created_at, direction, sender_type )
    `
    )
    .eq('business_id', businessUser.business_id)
    .order('last_message_at', { ascending: false })
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.botActive !== undefined) {
    query = query.eq('is_bot_active', filters.botActive)
  }

  const { data, error } = await query.limit(50)

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`)
  }

  // Transform: extract only the last message per conversation
  const conversations = (data ?? []).map((conv: any) => {
    // Messages come from the join; pick the most recent one
    const messages = conv.messages as LastMessage[] | null
    const lastMessage =
      messages && messages.length > 0
        ? messages.sort(
            (a: LastMessage, b: LastMessage) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0]
        : null

    return {
      id: conv.id,
      business_id: conv.business_id,
      contact_id: conv.contact_id,
      status: conv.status,
      assigned_to: conv.assigned_to,
      is_bot_active: conv.is_bot_active,
      last_message_at: conv.last_message_at,
      created_at: conv.created_at,
      contacts: conv.contacts,
      lastMessage,
    } as ConversationWithContact
  })

  return conversations
}

/**
 * Get messages for a single conversation, ordered ascending (oldest first)
 * so the UI can render them top-to-bottom.
 */
export async function getConversationMessages(
  conversationId: string,
  limit: number = 50
): Promise<Message[]> {
  const supabase = await createClient()

  // Auth check — resolve current user's business
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  // Verify conversation belongs to user's business
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('business_id', businessUser.business_id)
    .single()

  if (convError || !conversation) {
    throw new Error('Conversation not found')
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`)
  }

  return (data as Message[]) ?? []
}
