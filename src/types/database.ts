// ── Database Row Types ──────────────────────────────────
// Mirrors the Supabase schema for type-safe queries.
// Re-exports key types from @/lib/data/messages for convenience.

export type {
  ConversationWithContact,
  ConversationWithContact as ConversationListItem,
  Message,
} from '@/lib/data/messages'

export interface Contact {
  id: string
  business_id: string
  wa_id: string | null
  phone: string | null
  name: string | null
  status: string
  tags: string[]
  notes: string | null
  birthday: string | null
  last_visit: string | null
  total_visits: number
  total_revenue: number
  created_at: string
}

export interface Conversation {
  id: string
  business_id: string
  contact_id: string
  status: string
  assigned_to: string | null
  is_bot_active: boolean
  last_message_at: string
  created_at: string
}

export interface PhoneNumber {
  id: string
  business_id: string
  phone_number: string
  display_name: string | null
  provider: string
  session_id: string | null
  server_node: string | null
  status: string
  ownership: string
  last_health_check: string | null
  created_at: string
}
