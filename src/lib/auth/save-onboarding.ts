'use server'

import { createServiceClient } from '@/lib/supabase/service'

export interface OnboardingData {
  businessType: string
  businessName: string
  services: { name: string; duration: number; price: number }[]
  workingHours: {
    day: string
    dayHe: string
    active: boolean
    start: string
    end: string
  }[]
  tone: 'friendly' | 'professional' | 'casual' | 'humorous'
  cancellationPolicy: string
}

/**
 * Save all onboarding data gathered by the AI chat in a single action.
 * Updates: businesses, business_settings, ai_personas, onboarding_progress
 */
export async function saveAiOnboardingData(
  businessId: string,
  data: OnboardingData
) {
  const supabase = createServiceClient()

  // 1. Update business name & type
  const { error: bizError } = await supabase
    .from('businesses')
    .update({
      name: data.businessName,
      business_type: data.businessType,
      status: 'active',
    })
    .eq('id', businessId)

  if (bizError) {
    throw new Error(`Failed to update business: ${bizError.message}`)
  }

  // 2. Save business settings (services, working hours, cancellation policy)
  const servicesWithIds = data.services.map((s, i) => ({
    id: (i + 1).toString(),
    ...s,
  }))

  // BUG-10 fix: Transform working hours array into Record<string, WorkingDay> format
  // The AI onboarding saves as array [{day, dayHe, active, start, end}]
  // but getAvailableSlots expects Record keyed by day-of-week number
  const dayNameToNumber: Record<string, string> = {
    'sunday': '0', 'monday': '1', 'tuesday': '2', 'wednesday': '3',
    'thursday': '4', 'friday': '5', 'saturday': '6',
    'ראשון': '0', 'שני': '1', 'שלישי': '2', 'רביעי': '3',
    'חמישי': '4', 'שישי': '5', 'שבת': '6',
  }

  const workingHoursRecord: Record<string, { active: boolean; start: string; end: string; breaks: never[] }> = {}
  if (Array.isArray(data.workingHours)) {
    data.workingHours.forEach((wh, index) => {
      // Try to resolve day number from the day name, or fall back to index
      const dayKey = dayNameToNumber[wh.day?.toLowerCase()] ?? dayNameToNumber[wh.dayHe] ?? String(index)
      workingHoursRecord[dayKey] = {
        active: wh.active,
        start: wh.start,
        end: wh.end,
        breaks: [],
      }
    })
  }

  const { error: settingsError } = await supabase
    .from('business_settings')
    .upsert(
      {
        business_id: businessId,
        services: servicesWithIds,
        working_hours: workingHoursRecord,
        cancellation_policy: data.cancellationPolicy,
      },
      { onConflict: 'business_id' }
    )

  if (settingsError) {
    throw new Error(`Failed to save settings: ${settingsError.message}`)
  }

  // 3. Save AI persona (tone + auto-generated system prompt)
  const toneLabels: Record<string, string> = {
    friendly: 'ידידותי וחם',
    professional: 'מקצועי ורשמי',
    casual: "קז'ואל ונינוח",
    humorous: 'הומוריסטי ומשעשע',
  }

  const toneLabel = toneLabels[data.tone] || 'ידידותי וחם'

  const systemPrompt = `אתה עוזר וירטואלי של "${data.businessName}" (${data.businessType}).
הסגנון שלך: ${toneLabel}.
מדיניות ביטולים: ${data.cancellationPolicy}.
עזור ללקוחות לקבוע תורים, לקבל מידע על שירותים ומחירים, ולענות על שאלות.`

  // BUG-11 fix: Save to system_prompt (which agent-prompt.ts reads) instead of custom_instructions
  const { error: personaError } = await supabase
    .from('ai_personas')
    .upsert(
      {
        business_id: businessId,
        tone: data.tone,
        system_prompt: systemPrompt,
        custom_instructions: systemPrompt,
      },
      { onConflict: 'business_id' }
    )

  if (personaError) {
    throw new Error(`Failed to save AI persona: ${personaError.message}`)
  }

  // 4. Mark onboarding as completed
  // BUG-08 fix: Include is_completed: true so middleware recognizes onboarding as done
  const { error: progressError } = await supabase
    .from('onboarding_progress')
    .upsert(
      {
        business_id: businessId,
        current_step: 9,
        is_completed: true,
        completed_at: new Date().toISOString(),
        steps_data: {
          method: 'ai_chat',
          completed_via: 'ai_onboarding',
          business_type: data.businessType,
          business_name: data.businessName,
          services_count: data.services.length,
        },
      },
      { onConflict: 'business_id' }
    )

  if (progressError) {
    throw new Error(`Failed to update onboarding progress: ${progressError.message}`)
  }

  return { success: true }
}
