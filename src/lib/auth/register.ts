'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface RegisterBusinessData {
  email: string
  password: string
  fullName: string
  phone: string
  businessName: string
  businessType: string
}

interface Business {
  id: string
  name: string
  owner_user_id: string
  business_type: string
  plan: string
  status: string
  created_at: string
}

type RegisterResult =
  | {
      userId: string
      businessId: string
      error?: undefined
    }
  | {
      userId?: undefined
      businessId?: undefined
      error: string
    }

// ──────────────────────────────────────────────
// Default data generators
// ──────────────────────────────────────────────

function defaultWorkingHours(): Record<string, any> {
  return {
    '0': { active: true, start: '09:00', end: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
    '1': { active: true, start: '09:00', end: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
    '2': { active: true, start: '09:00', end: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
    '3': { active: true, start: '09:00', end: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
    '4': { active: true, start: '09:00', end: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
    '5': { active: true, start: '08:00', end: '14:00', breaks: [] },
    '6': { active: false },
  }
}

function generateDefaultPrompt(businessName: string, businessType: string): string {
  return [
    `אתה העוזר הוירטואלי של "${businessName}" (${businessType}).`,
    'תפקידך לעזור ללקוחות לקבוע תורים, לענות על שאלות על השירותים, ולתת מידע כללי על העסק.',
    'תענה תמיד בעברית, בנימה ידידותית ומקצועית.',
    'אם אתה לא בטוח במשהו, הפנה את הלקוח לבעל העסק.',
    'אל תמציא מידע שאינו קיים.',
  ].join('\n')
}

// ──────────────────────────────────────────────
// Registration flow (Server Action)
// ──────────────────────────────────────────────

export async function registerBusiness(data: RegisterBusinessData): Promise<RegisterResult> {
  // Use server client for auth signup
  const supabase = await createClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { full_name: data.fullName, phone: data.phone },
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'שגיאה ביצירת משתמש' }
  }

  const userId = authData.user.id

  // Use service client for DB operations (bypasses RLS for new user)
  const admin = createServiceClient()

  // 2. Create business
  const { data: business, error: bizError } = await admin
    .from('businesses')
    .insert({
      name: data.businessName,
      owner_user_id: userId,
      business_type: data.businessType,
      plan: 'trial',
      status: 'active',
    })
    .select()
    .single()

  if (bizError || !business) {
    return { error: bizError?.message ?? 'שגיאה ביצירת עסק' }
  }

  const businessId = business.id

  // 3. Link user to business (owner)
  const { error: linkError } = await admin.from('business_users').insert({
    business_id: businessId,
    user_id: userId,
    role: 'owner',
  })
  if (linkError) {
    console.error('[register] Failed to link user to business:', linkError)
    return { error: 'שגיאה בקישור המשתמש לעסק: ' + linkError.message }
  }

  // 4. Create settings from template
  try {
    const { data: template } = await admin
      .from('business_templates')
      .select('template_data')
      .eq('business_type', data.businessType)
      .single()

    const templateData = template?.template_data as Record<string, any> | null

    const { error: settingsError } = await admin.from('business_settings').insert({
      business_id: businessId,
      working_hours: templateData?.working_hours ?? defaultWorkingHours(),
      services: templateData?.services ?? [],
      cancellation_policy: templateData?.cancellation_policy ?? {},
      ai_config: {},
    })
    if (settingsError) {
      console.error('[register] Failed to create business settings:', settingsError)
    }
  } catch (err) {
    console.error('[register] Error creating business settings:', err)
  }

  // 5. Create default AI persona
  try {
    const { error: personaError } = await admin.from('ai_personas').insert({
      business_id: businessId,
      system_prompt: generateDefaultPrompt(data.businessName, data.businessType),
      tone: 'friendly',
      emoji_usage: 'light',
      boundaries: { active_hours: '08:00-20:00', sensitive_topics: [] },
    })
    if (personaError) {
      console.error('[register] Failed to create AI persona:', personaError)
    }
  } catch (err) {
    console.error('[register] Error creating AI persona:', err)
  }

  // 6. Create billing account (trial)
  try {
    const { error: billingError } = await admin.from('billing_accounts').insert({
      business_id: businessId,
      plan: 'trial',
      monthly_price: 0,
      status: 'active',
    })
    if (billingError) {
      console.error('[register] Failed to create billing account:', billingError)
    }
  } catch (err) {
    console.error('[register] Error creating billing account:', err)
  }

  // 7. Create onboarding progress
  try {
    const { error: onboardingError } = await admin.from('onboarding_progress').insert({
      business_id: businessId,
      current_step: 1,
      steps_data: {},
    })
    if (onboardingError) {
      console.error('[register] Failed to create onboarding progress:', onboardingError)
    }
  } catch (err) {
    console.error('[register] Error creating onboarding progress:', err)
  }

  return { userId, businessId }
}
