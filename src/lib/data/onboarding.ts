import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface OnboardingProgress {
  id: string
  business_id: string
  current_step: number
  steps_data: Record<string, any>
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

// Total number of onboarding steps (completion triggers at this step)
const TOTAL_STEPS = 9

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

/**
 * Advance the onboarding wizard to the next step.
 *
 * Persists the data for the current step, bumps current_step,
 * and applies the step data to the appropriate table:
 *
 *  Step 2 — Business type  -> businesses.business_type
 *  Step 3 — Business name  -> businesses.name
 *  Step 4 — Services       -> business_settings.services
 *  Step 5 — Working hours  -> business_settings.working_hours
 *  Step 6 — AI persona     -> ai_personas (tone, emoji, prompt, examples)
 *
 * When the final step is reached, marks the onboarding as completed.
 */
export async function updateOnboardingStep(
  businessId: string,
  step: number,
  stepData: Record<string, any>
): Promise<OnboardingProgress> {
  const supabase = await createClient()

  // 1. Load current progress
  const { data: progress, error: fetchError } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('business_id', businessId)
    .single()

  if (fetchError || !progress) {
    throw new Error(
      `Onboarding progress not found for business ${businessId}`
    )
  }

  // 2. Merge step data
  const updatedStepsData = {
    ...progress.steps_data,
    [`step_${step}`]: stepData,
  }

  const isCompleted = step >= TOTAL_STEPS

  // 3. Update progress record
  const { data: updated, error: updateError } = await supabase
    .from('onboarding_progress')
    .update({
      current_step: step + 1,
      steps_data: updatedStepsData,
      ...(isCompleted
        ? { is_completed: true, completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('business_id', businessId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to update onboarding: ${updateError.message}`)
  }

  // 4. Apply step-specific data to the relevant table
  await applyStepData(supabase, businessId, step, stepData)

  return updated as OnboardingProgress
}

// ──────────────────────────────────────────────
// Step-specific side effects
// ──────────────────────────────────────────────

async function applyStepData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  step: number,
  stepData: Record<string, any>
): Promise<void> {
  switch (step) {
    case 2: {
      // Business type selected
      const { error } = await supabase
        .from('businesses')
        .update({ business_type: stepData.type })
        .eq('id', businessId)
      if (error) {
        console.error(`[Onboarding Step 2] ${error.message}`)
      }
      break
    }

    case 3: {
      // Business details / name
      const { error } = await supabase
        .from('businesses')
        .update({ name: stepData.name })
        .eq('id', businessId)
      if (error) {
        console.error(`[Onboarding Step 3] ${error.message}`)
      }
      break
    }

    case 4: {
      // Services configuration
      const { error } = await supabase
        .from('business_settings')
        .update({ services: stepData.services })
        .eq('business_id', businessId)
      if (error) {
        console.error(`[Onboarding Step 4] ${error.message}`)
      }
      break
    }

    case 5: {
      // Working hours
      const { error } = await supabase
        .from('business_settings')
        .update({ working_hours: stepData.hours })
        .eq('business_id', businessId)
      if (error) {
        console.error(`[Onboarding Step 5] ${error.message}`)
      }
      break
    }

    case 6: {
      // AI persona style
      const { error } = await supabase
        .from('ai_personas')
        .update({
          tone: stepData.tone,
          emoji_usage: stepData.emoji,
          style_examples: stepData.examples ?? [],
          system_prompt: stepData.generatedPrompt,
        })
        .eq('business_id', businessId)
      if (error) {
        console.error(`[Onboarding Step 6] ${error.message}`)
      }
      break
    }

    default:
      // Steps 1, 7, 8, 9 do not have side effects on other tables
      break
  }
}
