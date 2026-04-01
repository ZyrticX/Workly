import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getIsraelNow, formatIsraelSQL } from '@/lib/utils/timezone'

// ── Appointment Reminders Cron ──────────────────
// Sends WhatsApp reminders 1 hour before appointments.
// Should run every 15 minutes.

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    // Get Israel time
    const israelNow = getIsraelNow()

    // Window: 45-75 minutes from now (catches appointments in the next hour)
    const from = new Date(israelNow)
    from.setMinutes(from.getMinutes() + 45)
    const to = new Date(israelNow)
    to.setMinutes(to.getMinutes() + 75)

    const fromStr = formatIsraelSQL(from)
    const toStr = formatIsraelSQL(to)

    // Find upcoming appointments that haven't been reminded
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, business_id, contact_id, contact_name, service_type, start_time, reminder_sent, contacts(wa_id, name)')
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', fromStr)
      .lte('start_time', toStr)
      .eq('reminder_sent', false)
      .limit(50)

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    let sentCount = 0

    for (const apt of appointments) {
      const contact = apt.contacts as { wa_id?: string; name?: string } | null
      if (!contact?.wa_id) continue

      // Get connected WAHA session for this business
      const { data: phone } = await supabase
        .from('phone_numbers')
        .select('session_id')
        .eq('business_id', apt.business_id)
        .eq('status', 'connected')
        .limit(1)
        .single()

      if (!phone?.session_id) continue

      // Send reminder
      const time = (apt.start_time as string).substring(11, 16)
      const name = contact.name || apt.contact_name || ''
      const msg = `היי ${name} 👋\nתזכורת: יש לך תור ל${apt.service_type} בשעה ${time}.\nנתראה! 🙏`

      try {
        const { whatsapp } = await import('@/lib/waha/provider')
        await whatsapp.sendMessage(phone.session_id, contact.wa_id, msg)

        // Mark as reminded
        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', apt.id)
        sentCount++
      } catch (err) {
        console.error(`[reminders] Failed to send to ${name}:`, err)
      }
    }

    return NextResponse.json({ sent: sentCount })
  } catch (err) {
    console.error('[reminders] Error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
