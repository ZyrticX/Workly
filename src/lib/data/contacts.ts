import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

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

export interface ContactsResult {
  contacts: Contact[]
  total: number
}

export interface ContactDetail {
  contact: Contact | null
  appointments: AppointmentSummary[]
  conversations: ConversationSummary[]
}

interface AppointmentSummary {
  id: string
  service_type: string
  start_time: string
  end_time: string
  status: string
  price: number | null
  created_at: string
}

interface ConversationSummary {
  id: string
  status: string
  last_message_at: string
}

export interface GetContactsOptions {
  search?: string
  status?: string
  sortBy?: 'name' | 'last_visit' | 'total_revenue' | 'created_at'
  limit?: number
  offset?: number
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Get a paginated, filterable, searchable list of contacts.
 * Search matches name or phone (case-insensitive).
 * Returns both the contact array and total count for pagination.
 */
export async function getContacts(
  options?: GetContactsOptions
): Promise<ContactsResult> {
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
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('business_id', businessUser.business_id)

  // Search by name or phone
  if (options?.search) {
    const term = options.search.replace(/[%_]/g, '\\$&') // escape SQL wildcards
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  // Filter by status
  if (options?.status) {
    query = query.eq('status', options.status)
  }

  // Sort
  const sortField = options?.sortBy ?? 'created_at'
  query = query.order(sortField, { ascending: sortField === 'name' })

  // Pagination
  if (options?.limit) {
    const from = options.offset ?? 0
    const to = from + options.limit - 1
    query = query.range(from, to)
  }

  const { data, count, error } = await query

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`)
  }

  return {
    contacts: (data as Contact[]) ?? [],
    total: count ?? 0,
  }
}

/**
 * Get a single contact by ID, together with recent appointments
 * and conversation history.
 */
export async function getContactById(
  contactId: string
): Promise<ContactDetail> {
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

  const [contactResult, appointmentsResult, conversationsResult] =
    await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('business_id', businessUser.business_id)
        .single(),

      supabase
        .from('appointments')
        .select('id, service_type, start_time, end_time, status, price, created_at')
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false })
        .limit(10),

      supabase
        .from('conversations')
        .select('id, status, last_message_at')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false })
        .limit(5),
    ])

  if (contactResult.error) {
    throw new Error(`Failed to fetch contact: ${contactResult.error.message}`)
  }

  return {
    contact: contactResult.data as Contact | null,
    appointments: (appointmentsResult.data as AppointmentSummary[]) ?? [],
    conversations: (conversationsResult.data as ConversationSummary[]) ?? [],
  }
}

/**
 * Find contacts who have not visited in more than `daysThreshold` days.
 * These are candidates for re-engagement campaigns.
 */
export async function getDormantContacts(
  daysThreshold: number = 60
): Promise<Contact[]> {
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

  const cutoff = new Date(
    Date.now() - daysThreshold * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('business_id', businessUser.business_id)
    .lt('last_visit', cutoff)
    .neq('status', 'dormant')
    .order('last_visit', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch dormant contacts: ${error.message}`)
  }

  return (data as Contact[]) ?? []
}
