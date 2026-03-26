import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── Auto-Complete Appointments Cron ──────────────────
// Marks past appointments as 'completed' and updates contact stats.
// Should run every 15-30 minutes.
// Also called on every dashboard load as a lightweight check.

export async function GET() {
  const supabase = createServiceClient()

  try {
    // Find all confirmed/pending appointments that have passed
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`

    const { data: pastAppointments, error } = await supabase
      .from('appointments')
      .select('id, business_id, contact_id, price, status')
      .in('status', ['confirmed', 'pending'])
      .lt('end_time', nowStr)

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

      // Update contact stats
      if (apt.contact_id) {
        // Increment visits - try RPC first, fallback to manual
        const rpcResult = await supabase.rpc('increment_contact_visits', {
          p_contact_id: apt.contact_id,
        })
        if (rpcResult.error) {
          // Fallback: manual increment
          const { data: contact } = await supabase
            .from('contacts')
            .select('total_visits, total_revenue')
            .eq('id', apt.contact_id)
            .single()
          if (contact) {
            await supabase
              .from('contacts')
              .update({
                total_visits: (contact.total_visits || 0) + 1,
                status: (contact.total_visits || 0) >= 5 ? 'vip' :
                        (contact.total_visits || 0) >= 1 ? 'returning' : 'active',
              })
              .eq('id', apt.contact_id)
          }
        }

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
