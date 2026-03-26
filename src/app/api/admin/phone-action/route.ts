import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyAdmin } from '@/lib/auth/admin-guard'

const WAHA_URL = process.env.WAHA_API_URL || 'http://localhost:3000'
const WAHA_KEY = process.env.WAHA_API_KEY || ''

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const supabase = createServiceClient()
  const { phoneId, action } = await req.json()

  if (!phoneId || !action) {
    return NextResponse.json({ error: 'Missing phoneId or action' }, { status: 400 })
  }

  // Get phone record
  const { data: phone, error } = await supabase
    .from('phone_numbers')
    .select('id, session_id, status, business_id')
    .eq('id', phoneId)
    .single()

  if (error || !phone) {
    return NextResponse.json({ error: 'Phone not found' }, { status: 404 })
  }

  const sessionId = phone.session_id

  try {
    switch (action) {
      case 'reconnect': {
        // Try to restart the WAHA session
        await fetch(`${WAHA_URL}/api/sessions/${sessionId}/restart`, {
          method: 'POST',
          headers: { 'X-Api-Key': WAHA_KEY },
        })
        await supabase
          .from('phone_numbers')
          .update({ status: 'pending_qr' })
          .eq('id', phoneId)
        return NextResponse.json({ ok: true, message: 'Reconnect requested' })
      }

      case 'disconnect': {
        // Stop the WAHA session
        await fetch(`${WAHA_URL}/api/sessions/${sessionId}/stop`, {
          method: 'POST',
          headers: { 'X-Api-Key': WAHA_KEY },
        })
        await supabase
          .from('phone_numbers')
          .update({ status: 'disconnected' })
          .eq('id', phoneId)
        return NextResponse.json({ ok: true, message: 'Disconnected' })
      }

      case 'delete': {
        // Delete the WAHA session entirely
        await fetch(`${WAHA_URL}/api/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { 'X-Api-Key': WAHA_KEY },
        })
        await supabase
          .from('phone_numbers')
          .delete()
          .eq('id', phoneId)
        return NextResponse.json({ ok: true, message: 'Deleted' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[admin/phone-action] Error:', err)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
