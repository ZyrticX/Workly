import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/whatsapp/status?businessId=<id>
// Returns { connected: boolean, phone: string | null, session_name: string | null }

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    // Verify the requested businessId matches the user's business
    const requestedBizId = req.nextUrl.searchParams.get('businessId')
    if (requestedBizId && requestedBizId !== bu.business_id) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }

    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('phone_number, session_id, status')
      .eq('business_id', bu.business_id)
      .single()

    if (!phoneNumber) {
      return NextResponse.json({
        connected: false,
        phone: null,
        session_name: null,
      })
    }

    return NextResponse.json({
      connected: phoneNumber.status === 'connected',
      phone: phoneNumber.phone_number || null,
      session_name: phoneNumber.session_id || null,
    })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
