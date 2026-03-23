import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { whatsapp } from '@/lib/waha/provider'

// GET /api/waha/qr?session=<session_name>
// Returns { status, qr } where qr is a base64 PNG data URL

function mapStatus(wahaStatus: string): string {
  switch (wahaStatus) {
    case 'WORKING': return 'connected'
    case 'SCAN_QR_CODE': return 'scan_qr'
    case 'STARTING': return 'pending_qr'
    case 'STOPPED': return 'stopped'
    case 'FAILED': return 'failed'
    default: return wahaStatus
  }
}

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const session = req.nextUrl.searchParams.get('session')
    if (!session) {
      return NextResponse.json({ error: 'session parameter is required' }, { status: 400 })
    }

    // Verify the session belongs to this user's business
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('id')
      .eq('business_id', bu.business_id)
      .eq('session_id', session)
      .single()
    if (!phoneRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check session status
    let wahaStatus: string
    try {
      wahaStatus = await whatsapp.getSessionStatus(session)
    } catch {
      return NextResponse.json({ status: 'NOT_FOUND', qr: null })
    }

    const status = mapStatus(wahaStatus)

    // If connected, update phone_numbers status and return
    if (wahaStatus === 'WORKING') {
      const admin = createServiceClient()
      await admin
        .from('phone_numbers')
        .update({
          status: 'connected',
          last_health_check: new Date().toISOString(),
        })
        .eq('session_id', session)
      return NextResponse.json({ status: 'connected', qr: null })
    }

    // If not in QR scanning state
    if (wahaStatus !== 'SCAN_QR_CODE') {
      return NextResponse.json({ status, qr: null })
    }

    // Fetch QR as PNG image from WAHA and convert to base64
    try {
      const qrRes = await fetch(
        `${process.env.WAHA_API_URL}/api/${session}/auth/qr`,
        {
          headers: { 'X-Api-Key': process.env.WAHA_API_KEY! },
        }
      )

      if (!qrRes.ok) {
        return NextResponse.json({ status, qr: null })
      }

      const contentType = qrRes.headers.get('content-type') || ''

      // If it returns JSON (some WAHA versions return {value: "base64..."})
      if (contentType.includes('application/json')) {
        const data = await qrRes.json()
        return NextResponse.json({ status: 'scan_qr', qr: data.value || null })
      }

      // If it returns PNG binary, convert to base64 data URL
      if (contentType.includes('image/')) {
        const buffer = await qrRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const dataUrl = `data:image/png;base64,${base64}`
        return NextResponse.json({ status: 'scan_qr', qr: dataUrl })
      }

      // Fallback: try to read as text
      const text = await qrRes.text()
      return NextResponse.json({ status: 'scan_qr', qr: text })
    } catch {
      return NextResponse.json({ status, qr: null })
    }
  } catch (err) {
    console.error('[api/waha/qr] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
