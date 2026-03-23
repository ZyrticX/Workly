import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DayHours {
  active: boolean
  start?: string
  end?: string
  breaks?: { start: string; end: string }[]
}

export type WorkingHours = Record<string, DayHours>

export interface ServiceItem {
  name: string
  type?: string
  duration: number
  price: number
}

export interface AIPersonaUpdate {
  systemPrompt?: string
  tone?: string
  emojiUsage?: string
  boundaries?: Record<string, any>
}

// ──────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────

/**
 * Update the working hours for a business.
 * The `hours` object is keyed by day of week (0 = Sunday .. 6 = Saturday).
 */
export async function updateWorkingHours(
  businessId: string,
  hours: WorkingHours
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('business_settings')
    .update({
      working_hours: hours,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)

  if (error) {
    throw new Error(`Failed to update working hours: ${error.message}`)
  }
}

/**
 * Replace the full services list for a business.
 */
export async function updateServices(
  businessId: string,
  services: ServiceItem[]
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('business_settings')
    .update({
      services,
      updated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)

  if (error) {
    throw new Error(`Failed to update services: ${error.message}`)
  }
}

/**
 * Partially update the AI persona settings for a business.
 * Only provided fields are overwritten.
 */
export async function updateAIPersona(
  businessId: string,
  data: AIPersonaUpdate
): Promise<void> {
  const supabase = await createClient()

  // Build update payload from provided fields only
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (data.systemPrompt !== undefined) {
    updatePayload.system_prompt = data.systemPrompt
  }
  if (data.tone !== undefined) {
    updatePayload.tone = data.tone
  }
  if (data.emojiUsage !== undefined) {
    updatePayload.emoji_usage = data.emojiUsage
  }
  if (data.boundaries !== undefined) {
    updatePayload.boundaries = data.boundaries
  }

  const { error } = await supabase
    .from('ai_personas')
    .update(updatePayload)
    .eq('business_id', businessId)

  if (error) {
    throw new Error(`Failed to update AI persona: ${error.message}`)
  }
}
