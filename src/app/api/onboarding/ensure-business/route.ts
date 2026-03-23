import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/onboarding/ensure-business
 *
 * Ensures the logged-in user has a business + business_users record.
 * If not, creates them. This handles cases where:
 * - Registration partially failed (auth user exists but no business)
 * - User was invited but has no business yet
 *
 * Returns { businessId } always.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
    }

    // Check if user already has a business
    const admin = createServiceClient()
    const { data: existingLink } = await admin
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()

    if (existingLink) {
      return NextResponse.json({ businessId: existingLink.business_id })
    }

    // Check if there's an orphaned business owned by this user
    const { data: orphanBiz } = await admin
      .from('businesses')
      .select('id')
      .eq('owner_user_id', user.id)
      .single()

    if (orphanBiz) {
      // Link exists in businesses but not in business_users - create the link
      await admin.from('business_users').insert({
        business_id: orphanBiz.id,
        user_id: user.id,
        role: 'owner',
      })

      // Ensure related records exist
      await ensureRelatedRecords(admin, orphanBiz.id)

      return NextResponse.json({ businessId: orphanBiz.id })
    }

    // No business at all - create everything
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'העסק שלי'

    const { data: newBiz, error: bizError } = await admin
      .from('businesses')
      .insert({
        name: userName,
        owner_user_id: user.id,
        business_type: '',
        plan: 'trial',
        status: 'onboarding',
      })
      .select('id')
      .single()

    if (bizError || !newBiz) {
      console.error('[ensure-business] Failed to create business:', bizError)
      return NextResponse.json({ error: 'שגיאה ביצירת עסק' }, { status: 500 })
    }

    // Create business_users link
    await admin.from('business_users').insert({
      business_id: newBiz.id,
      user_id: user.id,
      role: 'owner',
    })

    // Create related records
    await ensureRelatedRecords(admin, newBiz.id)

    return NextResponse.json({ businessId: newBiz.id })
  } catch (err) {
    console.error('[ensure-business] Error:', err)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

async function ensureRelatedRecords(admin: any, businessId: string) {
  // Ensure business_settings exists
  const { data: settings } = await admin
    .from('business_settings')
    .select('id')
    .eq('business_id', businessId)
    .single()

  if (!settings) {
    await admin.from('business_settings').insert({
      business_id: businessId,
      working_hours: {},
      services: [],
      cancellation_policy: {},
      ai_config: {},
    })
  }

  // Ensure ai_personas exists
  const { data: persona } = await admin
    .from('ai_personas')
    .select('id')
    .eq('business_id', businessId)
    .single()

  if (!persona) {
    await admin.from('ai_personas').insert({
      business_id: businessId,
      tone: 'friendly',
      emoji_usage: 'light',
      boundaries: {},
    })
  }

  // Ensure onboarding_progress exists
  const { data: onboarding } = await admin
    .from('onboarding_progress')
    .select('id')
    .eq('business_id', businessId)
    .single()

  if (!onboarding) {
    await admin.from('onboarding_progress').insert({
      business_id: businessId,
      current_step: 1,
      is_completed: false,
      steps_data: {},
    })
  }

  // Ensure billing_accounts exists
  const { data: billing } = await admin
    .from('billing_accounts')
    .select('id')
    .eq('business_id', businessId)
    .single()

  if (!billing) {
    await admin.from('billing_accounts').insert({
      business_id: businessId,
      plan: 'trial',
      monthly_price: 0,
      status: 'active',
    })
  }
}
