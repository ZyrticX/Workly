import { createServiceClient } from '@/lib/supabase/service'
import type { AgentInput } from './types'
import { cached, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis'
import { formatIsraelSQL } from '@/lib/utils/timezone'

// ── Types ────────────────────────────────────────

export interface ContactContext {
  name: string
  status: string
  phone: string
  visits: number
  gender: string | null
  memory: Record<string, unknown>
  lastVisit: string | null
}

export interface AgentContext {
  businessName: string
  businessType: string
  settings: Record<string, unknown> | null
  persona: Record<string, unknown> | null
  contact: ContactContext
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }>
  conversationSummary: string | null
  appointmentContext: string
  services: Array<{ name: string; duration: number; price: number }>
  knowledgeContext: string | null
}

// ── Build Agent Context ──────────────────────────

export async function buildAgentContext(input: AgentInput): Promise<AgentContext> {
  const supabase = createServiceClient()

  // 1. Load business context (cached) + fresh data in parallel
  const [businessData, settingsData, personaData, historyResult, contactResult] =
    await Promise.all([
      cached(
        CACHE_KEYS.businessInfo(input.businessId),
        async () => {
          const { data } = await supabase.from('businesses').select('id, name, business_type').eq('id', input.businessId).single()
          return data
        },
        CACHE_TTL.SETTINGS
      ),
      cached(
        CACHE_KEYS.businessSettings(input.businessId),
        async () => {
          const { data } = await supabase.from('business_settings').select('id, business_id, services, working_hours, cancellation_policy, ai_config, ai_advanced').eq('business_id', input.businessId).single()
          return data
        },
        CACHE_TTL.SETTINGS
      ),
      cached(
        CACHE_KEYS.aiPersona(input.businessId),
        async () => {
          const { data } = await supabase.from('ai_personas').select('id, business_id, tone, emoji_usage, style_examples, system_prompt').eq('business_id', input.businessId).single()
          return data
        },
        CACHE_TTL.PERSONA
      ),
      supabase
        .from('messages')
        .select('content, direction, sender_type')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('contacts')
        .select('name, status, phone, total_visits, memory, last_visit')
        .eq('id', input.contactId)
        .single(),
    ])

  // Build contact context
  const contactData = contactResult.data as Record<string, unknown> | null
  const contact: ContactContext = contactData ? {
    name: (contactData.name as string) || input.contactName,
    status: (contactData.status as string) || input.contactStatus || 'new',
    phone: (contactData.phone as string) || input.contactPhone || '',
    visits: (contactData.total_visits as number) || input.contactVisits || 0,
    gender: (contactData.gender as string | null) || null,
    memory: (contactData.memory as Record<string, unknown>) || {},
    lastVisit: (contactData.last_visit as string | null) || null,
  } : {
    name: input.contactName,
    status: input.contactStatus || 'new',
    phone: input.contactPhone || '',
    visits: input.contactVisits || 0,
    gender: null,
    memory: {},
    lastVisit: null,
  }

  // Load upcoming appointments for this contact + linked contacts
  const nowForApts = formatIsraelSQL()

  const { data: ownApts } = await supabase
    .from('appointments')
    .select('id, contact_name, service_type, start_time, status')
    .eq('business_id', input.businessId)
    .eq('contact_id', input.contactId)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', nowForApts)
    .order('start_time')
    .limit(5)

  const { data: linkedContacts } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('business_id', input.businessId)
    .eq('linked_to', input.contactId)

  let linkedApts: typeof ownApts = []
  if (linkedContacts && linkedContacts.length > 0) {
    const linkedIds = linkedContacts.map(c => c.id)
    const { data } = await supabase
      .from('appointments')
      .select('id, contact_name, service_type, start_time, status')
      .eq('business_id', input.businessId)
      .in('contact_id', linkedIds)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', nowForApts)
      .order('start_time')
      .limit(5)
    linkedApts = data || []
  }

  // Build appointment context string for AI
  const allApts = [...(ownApts || []), ...(linkedApts || [])]
  const appointmentContext = allApts.length > 0
    ? allApts.map(a => {
        const time = (a.start_time as string).substring(11, 16)
        const date = (a.start_time as string).substring(0, 10)
        const isLinked = linkedApts?.some(la => la.id === a.id)
        return `${date} ${time} - ${a.service_type} - ${a.contact_name}${isLinked ? ' (קבעת עבורו/ה)' : ''}`
      }).join('\n')
    : 'אין תורים קרובים'

  // Build conversation history
  const conversationHistory = (historyResult.data || [])
    .reverse()
    .map((msg) => ({
      role: (msg.direction === 'inbound' ? 'user' : 'model') as 'user' | 'model',
      text: msg.content || '',
    }))

  const services = (settingsData?.services as Array<{ name: string; duration: number; price: number }>) || []

  // Load conversation summary (if exists)
  const { data: convData } = await supabase
    .from('conversations')
    .select('ai_summary')
    .eq('id', input.conversationId)
    .single()
  const conversationSummary = (convData?.ai_summary as string) || null

  // Load relevant knowledge base entries (keyword match against message)
  let knowledgeContext: string | null = null
  const messageWords = input.message.split(/\s+/).filter(w => w.length > 2)
  if (messageWords.length > 0) {
    const { data: kbEntries } = await supabase
      .from('business_knowledge')
      .select('question, answer')
      .eq('business_id', input.businessId)
      .overlaps('keywords', messageWords)
      .limit(3)

    if (kbEntries && kbEntries.length > 0) {
      knowledgeContext = kbEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')
    }
  }

  return {
    businessName: businessData?.name || '',
    businessType: businessData?.business_type || '',
    settings: settingsData as Record<string, unknown> | null,
    persona: personaData as Record<string, unknown> | null,
    contact,
    conversationHistory,
    conversationSummary,
    appointmentContext,
    services,
    knowledgeContext,
  }
}
