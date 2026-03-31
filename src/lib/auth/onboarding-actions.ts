'use server'

import { createServiceClient } from '@/lib/supabase/service'

export async function updateOnboardingStep(
  businessId: string,
  step: number,
  stepData: Record<string, unknown>
) {
  const supabase = createServiceClient()

  // Update onboarding_progress table
  const { data: current } = await supabase
    .from('onboarding_progress')
    .select('steps_data')
    .eq('business_id', businessId)
    .single()

  const existingStepsData = (current?.steps_data as Record<string, unknown>) || {}

  const { error } = await supabase
    .from('onboarding_progress')
    .update({
      current_step: step,
      steps_data: {
        ...existingStepsData,
        [`step_${step}`]: stepData,
      },
    })
    .eq('business_id', businessId)

  if (error) {
    throw new Error(`Failed to update onboarding step: ${error.message}`)
  }

  return { success: true }
}

export async function saveBusinessSettings(
  businessId: string,
  settings: Record<string, unknown>
) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('business_settings')
    .upsert(
      { business_id: businessId, ...settings },
      { onConflict: 'business_id' }
    )

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`)
  }

  return { success: true }
}

export async function saveAiPersona(
  businessId: string,
  persona: Record<string, unknown>
) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('ai_personas')
    .upsert(
      { business_id: businessId, ...persona },
      { onConflict: 'business_id' }
    )

  if (error) {
    throw new Error(`Failed to save AI persona: ${error.message}`)
  }

  return { success: true }
}

export async function completeOnboarding(businessId: string) {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('businesses')
    .update({ status: 'active' })
    .eq('id', businessId)

  if (error) {
    throw new Error(`Failed to complete onboarding: ${error.message}`)
  }

  await updateOnboardingStep(businessId, 9, { completed: true })

  // Explicitly ensure is_completed is set (belt-and-suspenders)
  await supabase
    .from('onboarding_progress')
    .update({ is_completed: true })
    .eq('business_id', businessId)

  return { success: true }
}
