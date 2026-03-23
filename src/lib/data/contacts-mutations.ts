import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateContactData {
  businessId: string
  name: string
  phone: string
  waId?: string
  tags?: string[]
  notes?: string
  birthday?: string
}

interface Contact {
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

type ContactStatus = 'new' | 'returning' | 'vip' | 'dormant'

// ──────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────

/**
 * Create a new contact record for a business.
 * If waId is not provided, falls back to the phone number.
 */
export async function createContact(
  data: CreateContactData
): Promise<Contact> {
  const supabase = await createClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      business_id: data.businessId,
      name: data.name,
      phone: data.phone,
      wa_id: data.waId ?? data.phone,
      tags: data.tags ?? [],
      notes: data.notes ?? null,
      birthday: data.birthday ?? null,
      status: 'new',
    })
    .select()
    .single()

  if (error || !contact) {
    throw new Error(`Failed to create contact: ${error?.message}`)
  }

  return contact as Contact
}

/**
 * Automatically compute and update a contact's status based on
 * their visit count and recency:
 *   - 10+ visits => VIP
 *   - 2+ visits  => returning
 *   - 0-1 visits => new
 *   - last_visit > 60 days ago => dormant (overrides the above)
 */
export async function updateContactStatus(
  contactId: string
): Promise<ContactStatus> {
  const supabase = await createClient()

  // Fetch current stats
  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('total_visits, last_visit')
    .eq('id', contactId)
    .single()

  if (fetchError || !contact) {
    throw new Error(`Contact not found: ${fetchError?.message}`)
  }

  // Determine status from visit count
  let newStatus: ContactStatus = 'new'
  if (contact.total_visits >= 10) {
    newStatus = 'vip'
  } else if (contact.total_visits >= 2) {
    newStatus = 'returning'
  }

  // Override to dormant if last visit was too long ago
  if (contact.last_visit) {
    const daysSinceVisit =
      (Date.now() - new Date(contact.last_visit).getTime()) /
      (1000 * 60 * 60 * 24)
    if (daysSinceVisit > 60) {
      newStatus = 'dormant'
    }
  }

  // Persist
  const { error: updateError } = await supabase
    .from('contacts')
    .update({ status: newStatus })
    .eq('id', contactId)

  if (updateError) {
    throw new Error(`Failed to update contact status: ${updateError.message}`)
  }

  return newStatus
}
