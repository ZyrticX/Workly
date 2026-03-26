import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { generateResponse } from '@/lib/ai/ai-client'

const ADMIN_EMAIL = 'evgeniyphotos1@gmail.com'

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    businessName,
    ownerEmail,
    ownerPassword,
    ownerPhone,
    businessType,
    description,
    howItWorks,
    clientStatus = 'lead',
    assignedTo = '',
  } = body

  if (!businessName || !ownerEmail || !businessType) {
    return NextResponse.json({ error: 'שם עסק, אימייל וסוג עסק הם שדות חובה' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // === DRAFT MODE: Create business WITHOUT creating auth user ===
    // User will be created only when admin approves

    // 1. Create business as draft
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .insert({
        name: businessName,
        owner_user_id: null, // No user yet — draft
        business_type: businessType,
        plan: 'trial',
        status: clientStatus === 'lead' ? 'lead' : 'draft',
        is_draft: true,
        description: description || null,
        how_it_works: howItWorks || null,
        assigned_to: assignedTo || null,
      })
      .select('id')
      .single()

    if (bizError) throw bizError
    const businessId = business.id

    // 2. Store email/password/phone in metadata for later user creation
    await supabase.from('business_settings').insert({
      business_id: businessId,
      services: [],
      working_hours: {},
      ai_config: {
        draft_email: ownerEmail,
        draft_password: ownerPassword || null,
        draft_phone: ownerPhone || null,
        description,
        how_it_works: howItWorks,
        assigned_to: assignedTo,
        client_status: clientStatus,
      },
    })

    // 3. Generate AI setup summary (async, don't block response)
    generateAISummary(supabase, businessId, businessName, businessType, description || '', howItWorks || '').catch(console.error)

    // 4. Notify admin (you)
    await supabase.from('admin_notifications').insert({
      target_email: ADMIN_EMAIL,
      type: 'new_client',
      title: `לקוח חדש: ${businessName}`,
      body: `${assignedTo ? `מטפל: ${assignedTo}\n` : ''}סוג: ${businessType}\nסטטוס: ${clientStatus === 'lead' ? 'פוטנציאלי' : 'פעיל'}\nמייל: ${ownerEmail}`,
      metadata: { business_id: businessId, email: ownerEmail, type: businessType },
    })

    return NextResponse.json({
      success: true,
      businessId,
      isDraft: true,
      message: `"${businessName}" נוצר כטיוטה. צריך אישור כדי להפעיל.`,
    })
  } catch (err) {
    console.error('[admin] create-business error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'שגיאה ביצירת העסק' },
      { status: 500 }
    )
  }
}

// === Approve draft → create actual user ===
export async function PATCH(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Only main admin can approve' }, { status: 403 })
  }

  const { businessId, action } = await req.json()
  const supabase = createServiceClient()

  if (action === 'approve') {
    // Get stored credentials
    const { data: settings } = await supabase
      .from('business_settings')
      .select('ai_config')
      .eq('business_id', businessId)
      .single()

    const config = settings?.ai_config as Record<string, unknown> || {}
    const email = config.draft_email as string
    const password = (config.draft_password as string) || `Temp${Date.now()}`
    const phone = config.draft_phone as string

    if (!email) return NextResponse.json({ error: 'No email found' }, { status: 400 })

    // Create auth user now
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const userId = authData.user.id

    // Link user to business
    await supabase.from('business_users').insert({
      business_id: businessId,
      user_id: userId,
      role: 'owner',
    })

    // Update business: no longer draft
    await supabase.from('businesses')
      .update({ owner_user_id: userId, is_draft: false, status: 'onboarding' })
      .eq('id', businessId)

    // Create remaining records
    await supabase.from('ai_personas').insert({
      business_id: businessId,
      tone: 'friendly',
      emoji_usage: 'light',
    })
    await supabase.from('billing_accounts').insert({
      business_id: businessId, plan: 'trial', monthly_price: 0, status: 'active',
    })
    await supabase.from('onboarding_progress').insert({
      business_id: businessId, current_step: 1, is_completed: false,
    })

    // Clean draft credentials from settings
    const cleanConfig = { ...config }
    delete cleanConfig.draft_email
    delete cleanConfig.draft_password
    delete cleanConfig.draft_phone
    await supabase.from('business_settings')
      .update({ ai_config: cleanConfig })
      .eq('business_id', businessId)

    // Notify
    await supabase.from('admin_notifications').insert({
      target_email: ADMIN_EMAIL,
      type: 'client_approved',
      title: `לקוח אושר`,
      body: `${email} הופעל. סיסמה: ${password}`,
      metadata: { business_id: businessId },
    })

    return NextResponse.json({ success: true, userId, password })
  }

  if (action === 'reject') {
    await supabase.from('businesses').delete().eq('id', businessId)
    await supabase.from('business_settings').delete().eq('business_id', businessId)
    return NextResponse.json({ success: true, message: 'Deleted' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// === AI Setup Summary (background) ===
async function generateAISummary(
  supabase: ReturnType<typeof createServiceClient>,
  businessId: string,
  name: string,
  type: string,
  description: string,
  howItWorks: string
) {
  try {
    const prompt = `אתה יועץ AI לעסקים. קיבלת פרטים על עסק חדש. תן סיכום קצר (5-8 שורות) איך הכי נכון להתאים לו בוט WhatsApp.

פרטי העסק:
- שם: ${name}
- סוג: ${type}
- תיאור: ${description || 'לא צוין'}
- איך העסק עובד: ${howItWorks || 'לא צוין'}

תכלול:
1. טון מומלץ (ידידותי/מקצועי/צעיר/וכו')
2. שירותים מומלצים לבוט
3. כללים מיוחדים שכדאי להגדיר
4. טיפים ספציפיים לסוג העסק
5. מה לשים לב אליו`

    const summary = await generateResponse(prompt, [], 'תן סיכום', { maxTokens: 500 })

    await supabase.from('businesses')
      .update({ ai_setup_summary: summary })
      .eq('id', businessId)
  } catch (err) {
    console.error('[AI Summary] Error:', err)
  }
}
