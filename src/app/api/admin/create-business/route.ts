import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify admin auth
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: check admin role

  const body = await req.json()
  const {
    businessName,
    ownerName,
    ownerEmail,
    ownerPhone,
    businessType,
    description,
    howItWorks,
    plan = 'trial',
  } = body

  if (!businessName || !ownerEmail || !businessType) {
    return NextResponse.json({ error: 'שם עסק, אימייל ונוג עסק הם שדות חובה' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // 1. Create auth user (with random password — owner will reset)
    const tempPassword = `Temp${Date.now()}!${Math.random().toString(36).slice(2, 8)}`
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName || businessName },
    })

    if (authError) {
      // If user already exists, try to find them
      if (authError.message?.includes('already')) {
        return NextResponse.json({ error: 'משתמש עם אימייל זה כבר קיים' }, { status: 409 })
      }
      throw authError
    }

    const userId = authData.user.id

    // 2. Create business
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({
        name: businessName,
        owner_user_id: userId,
        business_type: businessType,
        plan,
        status: 'onboarding',
      })
      .select('id')
      .single()

    if (bizError) throw bizError
    const businessId = business.id

    // 3. Link user to business
    await supabase.from('business_users').insert({
      business_id: businessId,
      user_id: userId,
      role: 'owner',
    })

    // 4. Create business settings with description
    const aiConfig: Record<string, unknown> = {}
    if (description) aiConfig.description = description
    if (howItWorks) aiConfig.how_it_works = howItWorks

    await supabase.from('business_settings').insert({
      business_id: businessId,
      services: [],
      working_hours: {
        '0': { active: true, start: '09:00', end: '18:00', breaks: [] },
        '1': { active: true, start: '09:00', end: '18:00', breaks: [] },
        '2': { active: true, start: '09:00', end: '18:00', breaks: [] },
        '3': { active: true, start: '09:00', end: '18:00', breaks: [] },
        '4': { active: true, start: '09:00', end: '18:00', breaks: [] },
        '5': { active: true, start: '09:00', end: '14:00', breaks: [] },
        '6': { active: false, start: '09:00', end: '18:00', breaks: [] },
      },
      ai_config: aiConfig,
    })

    // 5. Create AI persona with business context
    const systemPrompt = description
      ? `${description}\n\n${howItWorks ? `איך העסק עובד: ${howItWorks}` : ''}`
      : ''

    await supabase.from('ai_personas').insert({
      business_id: businessId,
      tone: 'friendly',
      emoji_usage: 'light',
      system_prompt: systemPrompt,
    })

    // 6. Create billing account
    await supabase.from('billing_accounts').insert({
      business_id: businessId,
      plan,
      monthly_price: plan === 'trial' ? 0 : plan === 'basic' ? 99 : plan === 'pro' ? 199 : 349,
      status: 'active',
    })

    // 7. Create onboarding progress
    await supabase.from('onboarding_progress').insert({
      business_id: businessId,
      current_step: 1,
      is_completed: false,
      step_data: {},
    })

    return NextResponse.json({
      success: true,
      businessId,
      userId,
      tempPassword,
      message: `עסק "${businessName}" נוצר בהצלחה. סיסמה זמנית: ${tempPassword}`,
    })
  } catch (err) {
    console.error('[admin] create-business error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה ביצירת העסק' },
      { status: 500 }
    )
  }
}
