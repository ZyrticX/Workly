import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { whatsapp } from '@/lib/waha/provider'

// POST /api/waha/send-test
// Body: { phone: string, businessId: string }
// Sends a test WhatsApp message via WAHA to verify the connection works.

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { phone } = body as { phone: string }

    if (!phone) {
      return NextResponse.json({ error: 'נדרש מספר טלפון' }, { status: 400 })
    }

    // Look up the WAHA session for this business
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('session_id, status')
      .eq('business_id', bu.business_id)
      .single()

    if (!phoneNumber || !phoneNumber.session_id) {
      return NextResponse.json(
        { error: 'לא נמצא חיבור WhatsApp פעיל. חבר את WhatsApp קודם.' },
        { status: 400 }
      )
    }

    if (phoneNumber.status !== 'connected') {
      return NextResponse.json(
        { error: 'WhatsApp לא מחובר. סרוק את קוד ה-QR קודם.' },
        { status: 400 }
      )
    }

    // Clean phone number: remove non-digits, convert Israeli format to international
    let cleanPhone = phone.replace(/[^0-9]/g, '')
    // Convert 05x to 9725x (Israeli mobile)
    if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
      cleanPhone = '972' + cleanPhone.slice(1)
    }
    // Remove leading 0 for other Israeli numbers
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '972' + cleanPhone.slice(1)
    }

    // Send test message via WAHA
    await whatsapp.sendMessage(
      phoneNumber.session_id,
      cleanPhone,
      'הודעת בדיקה מהמערכת - החיבור עובד בהצלחה! :)'
    )

    return NextResponse.json({
      success: true,
      message: 'הודעת בדיקה נשלחה בהצלחה',
    })
  } catch (err) {
    console.error('[api/waha/send-test] Error:', err)
    return NextResponse.json(
      { error: 'שליחת ההודעה נכשלה. ודא שהחיבור תקין.' },
      { status: 500 }
    )
  }
}
