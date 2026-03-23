import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/ai/chat/action
// Body: { businessId: string, action: string, params: Record<string, unknown> }
// Returns: { message: string, success: boolean }

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
    const { action, params } = body as {
      action: string
      params: Record<string, unknown>
    }

    if (!action) {
      return NextResponse.json({ error: 'נדרש סוג פעולה' }, { status: 400 })
    }

    const businessId = bu.business_id

    switch (action) {
      case 'create_appointment': {
        const { contactId, serviceType, startTime, endTime, durationMinutes, price } =
          params as {
            contactId: string
            serviceType: string
            startTime: string
            endTime: string
            durationMinutes: number
            price: number
          }

        if (!contactId || !startTime || !endTime) {
          return NextResponse.json(
            { error: 'חסרים פרטים ליצירת תור', success: false },
            { status: 400 }
          )
        }

        const { error } = await supabase.from('appointments').insert({
          business_id: businessId,
          contact_id: contactId,
          service_type: serviceType || 'כללי',
          start_time: startTime,
          end_time: endTime,
          duration_minutes: durationMinutes || 30,
          price: price || 0,
          status: 'confirmed',
        })

        if (error) {
          return NextResponse.json(
            { error: error.message, success: false },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: 'התור נוצר בהצלחה',
          success: true,
        })
      }

      case 'cancel_appointment': {
        const { appointmentId } = params as { appointmentId: string }

        if (!appointmentId) {
          return NextResponse.json(
            { error: 'חסר מזהה תור', success: false },
            { status: 400 }
          )
        }

        const { error } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', appointmentId)
          .eq('business_id', businessId)

        if (error) {
          return NextResponse.json(
            { error: error.message, success: false },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message: 'התור בוטל בהצלחה',
          success: true,
        })
      }

      case 'send_campaign': {
        // Placeholder for campaign sending - log and acknowledge
        const { message: campaignMessage, targetFilter } = params as {
          message: string
          targetFilter: string
        }

        console.log(
          `[ai/chat/action] Campaign requested for business ${businessId}:`,
          { campaignMessage, targetFilter }
        )

        return NextResponse.json({
          message: 'הקמפיין נשמר ויישלח בהמשך',
          success: true,
        })
      }

      case 'export_data': {
        // Placeholder for data export
        return NextResponse.json({
          message: 'הנתונים מוכנים לייצוא',
          success: true,
        })
      }

      default:
        return NextResponse.json(
          { error: `פעולה לא מזוהה: ${action}`, success: false },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('[api/ai/chat/action] Error:', err)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
