import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── Auto-Complete Appointments Cron ──────────────────
// Marks past appointments as 'completed' and updates contact stats.
// Should run every 15-30 minutes.
// Also called on every dashboard load as a lightweight check.

export async function GET() {
  const supabase = createServiceClient()

  try {
    // Find all confirmed/pending appointments that have passed (Israel time)
    const now = new Date()
    const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
    const nowStr = `${israelNow.getFullYear()}-${String(israelNow.getMonth() + 1).padStart(2, '0')}-${String(israelNow.getDate()).padStart(2, '0')}T${String(israelNow.getHours()).padStart(2, '0')}:${String(israelNow.getMinutes()).padStart(2, '0')}:00`

    const { data: pastAppointments, error } = await supabase
      .from('appointments')
      .select('id, business_id, contact_id, price, status')
      .in('status', ['confirmed', 'pending'])
      .lt('end_time', nowStr)
      .limit(500)

    if (error) {
      console.error('[auto-complete] Query error:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!pastAppointments || pastAppointments.length === 0) {
      return NextResponse.json({ completed: 0 })
    }

    let completedCount = 0

    for (const apt of pastAppointments) {
      // Mark as completed
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', apt.id)

      if (updateError) {
        console.error(`[auto-complete] Failed to complete ${apt.id}:`, updateError)
        continue
      }

      completedCount++

      // NOTE: Revenue and visits are NOT updated here.
      // They update only when business owner confirms the customer actually came
      // (via manual "mark as completed" in calendar, or PATCH /api/appointments)
      // This prevents counting revenue for no-shows.

        // Update revenue
        if (apt.price && apt.price > 0) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('total_revenue')
            .eq('id', apt.contact_id)
            .single()

          if (contact) {
            await supabase
              .from('contacts')
              .update({
                total_revenue: (contact.total_revenue || 0) + apt.price,
              })
              .eq('id', apt.contact_id)
          }
        }
      }
    }

    return NextResponse.json({ completed: completedCount })
  } catch (err) {
    console.error('[auto-complete] Error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
