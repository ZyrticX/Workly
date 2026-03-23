import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!bu) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const phoneNumber = body.phoneNumber || ''

  const sessionName = `biz_${bu.business_id.slice(0, 8)}`
  const admin = createServiceClient()

  // Check if session already exists in phone_numbers
  const { data: existing } = await admin
    .from('phone_numbers')
    .select('id, business_id, session_id, phone_number, status')
    .eq('business_id', bu.business_id)
    .single()

  if (existing?.status === 'connected') {
    return NextResponse.json({ sessionName: existing.session_id, status: 'connected' })
  }

  // Create or restart WAHA session
  const wahaHeaders = {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.WAHA_API_KEY!,
  }
  const webhookConfig = {
    webhooks: [{
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/waha`,
      events: ['message', 'message.ack', 'session.status'],
    }],
  }

  try {
    // Try to create new session with auto-start
    const createRes = await fetch(`${process.env.WAHA_API_URL}/api/sessions`, {
      method: 'POST',
      headers: wahaHeaders,
      body: JSON.stringify({ name: sessionName, start: true, config: webhookConfig }),
    })

    // If session already exists (422), try to start it
    if (createRes.status === 422) {
      // Stop first (in case it's in FAILED state), then start
      await fetch(`${process.env.WAHA_API_URL}/api/sessions/${sessionName}/stop`, {
        method: 'POST',
        headers: wahaHeaders,
      }).catch(() => {})

      await fetch(`${process.env.WAHA_API_URL}/api/sessions/${sessionName}/start`, {
        method: 'POST',
        headers: wahaHeaders,
      })
    }
  } catch (e) {
    console.error('[api/waha/connect] WAHA session error:', e)
  }

  // Upsert phone_numbers record
  if (existing) {
    await admin
      .from('phone_numbers')
      .update({
        session_id: sessionName,
        status: 'pending_qr',
        phone_number: phoneNumber || existing.phone_number,
      })
      .eq('id', existing.id)
  } else {
    await admin.from('phone_numbers').insert({
      business_id: bu.business_id,
      phone_number: phoneNumber || `temp_${sessionName}`,
      session_id: sessionName,
      status: 'pending_qr',
      provider: 'waha',
      ownership: 'client',
    })
  }

  return NextResponse.json({ sessionName, status: 'pending_qr' })
}
