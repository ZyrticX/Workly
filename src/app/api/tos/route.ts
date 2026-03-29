import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const CURRENT_TOS_VERSION = '1.0'

// GET — Check if user accepted TOS
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ accepted: false })

  const admin = createServiceClient()
  const { data } = await admin
    .from('tos_acceptances')
    .select('id, tos_version, accepted_at')
    .eq('user_id', user.id)
    .eq('tos_version', CURRENT_TOS_VERSION)
    .limit(1)
    .single()

  return NextResponse.json({
    accepted: !!data,
    version: CURRENT_TOS_VERSION,
    acceptedAt: data?.accepted_at || null,
  })
}

// POST — Accept TOS with signature
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signatureData } = await req.json()
  if (!signatureData) return NextResponse.json({ error: 'חתימה נדרשת' }, { status: 400 })

  const admin = createServiceClient()

  // Check if already accepted this version
  const { data: existing } = await admin
    .from('tos_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('tos_version', CURRENT_TOS_VERSION)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ ok: true, message: 'כבר אושר' })
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

  await admin.from('tos_acceptances').insert({
    user_id: user.id,
    user_email: user.email,
    tos_version: CURRENT_TOS_VERSION,
    signature_data: signatureData,
    ip_address: ip,
  })

  return NextResponse.json({ ok: true })
}
