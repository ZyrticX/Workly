import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { whatsapp } from '@/lib/waha/provider'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)

    // BUG-04 fix: Support ?contactId= parameter for contact-specific appointments
    const contactId = searchParams.get('contactId')
    if (contactId) {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, contacts(name, phone)')
        .eq('business_id', bu.business_id)
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false })
        .limit(50)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ appointments: data || [] })
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'חסר startDate או endDate' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('*, contacts(name, phone)')
      .eq('business_id', bu.business_id)
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${endDate}T23:59:59`)
      .order('start_time', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ appointments: data || [] })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { contactId, serviceType, startTime, endTime, durationMinutes, price, notes } = body

    if (!contactId || !startTime || !endTime) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        business_id: bu.business_id,
        contact_id: contactId,
        service_type: serviceType,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes || 30,
        price: price || 0,
        notes: notes || null,
        status: 'confirmed',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ appointment: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

// PATCH - update appointment (reschedule, change status)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { id, startTime, endTime, durationMinutes, status, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'חסר מזהה תור' }, { status: 400 })
    }

    // Verify the appointment belongs to this business
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, contact_id, service_type, start_time, contacts(name, phone, wa_id)')
      .eq('id', id)
      .eq('business_id', bu.business_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {}
    if (startTime !== undefined) updateFields.start_time = startTime
    if (endTime !== undefined) updateFields.end_time = endTime
    if (durationMinutes !== undefined) updateFields.duration_minutes = durationMinutes
    if (status !== undefined) updateFields.status = status
    if (notes !== undefined) updateFields.notes = notes

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'לא סופקו שדות לעדכון' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updateFields)
      .eq('id', id)
      .eq('business_id', bu.business_id)
      .select('*, contacts(name, phone)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If status changed → update contact stats
    if (status && existing.contact_id) {
      const aptPrice = (data as Record<string, unknown>).price as number || 0

      if (status === 'completed' && existing.service_type) {
        // Customer came! Add revenue + visit
        const { data: contact } = await supabase
          .from('contacts')
          .select('total_visits, total_revenue')
          .eq('id', existing.contact_id)
          .single()
        if (contact) {
          await supabase.from('contacts').update({
            total_visits: (contact.total_visits || 0) + 1,
            total_revenue: (contact.total_revenue || 0) + aptPrice,
            status: (contact.total_visits || 0) >= 5 ? 'vip' : (contact.total_visits || 0) >= 1 ? 'returning' : 'active',
          }).eq('id', existing.contact_id)
        }
      }

      if (status === 'cancelled') {
        // Cancelled — subtract revenue if was completed before
        // (only if appointment was previously completed)
        const wasCompleted = (existing as Record<string, unknown>).status === 'completed'
        if (wasCompleted) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('total_visits, total_revenue')
            .eq('id', existing.contact_id)
            .single()
          if (contact) {
            await supabase.from('contacts').update({
              total_visits: Math.max(0, (contact.total_visits || 0) - 1),
              total_revenue: Math.max(0, (contact.total_revenue || 0) - aptPrice),
            }).eq('id', existing.contact_id)
          }
        }
      }
    }

    // If rescheduled - notify + send WhatsApp
    if (startTime && startTime !== existing.start_time) {
      const newDate = new Date(startTime)
      const dateStr = newDate.toLocaleDateString('he-IL')
      const timeStr = newDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

      await supabase.from('notifications').insert({
        business_id: bu.business_id,
        type: 'rescheduled_appointment',
        title: 'תור הוזז',
        body: `התור ל${existing.service_type} הועבר ל${dateStr} בשעה ${timeStr}`,
        metadata: { contact_id: existing.contact_id },
      })

      // Send WhatsApp update to customer
      const contact = existing.contacts as { name?: string; phone?: string; wa_id?: string } | null
      if (contact?.wa_id || contact?.phone) {
        try {
          const admin = createServiceClient()
          const { data: phoneNum } = await admin
            .from('phone_numbers')
            .select('session_id, status')
            .eq('business_id', bu.business_id)
            .eq('status', 'connected')
            .single()

          if (phoneNum?.session_id) {
            let chatId = contact.wa_id || contact.phone || ''
            if (chatId && !chatId.includes('@')) {
              if (/^\d{15,}$/.test(chatId)) chatId = chatId + '@lid'
              else {
                if (chatId.startsWith('05')) chatId = '972' + chatId.slice(1)
                chatId = chatId + '@c.us'
              }
            }
            const displayName = (contact.name && !contact.name.startsWith('לקוח ')) ? contact.name : ''
            await whatsapp.sendMessage(
              phoneNum.session_id,
              chatId,
              `שלום${displayName ? ' ' + displayName : ''},\nהתור שלך ל${existing.service_type} *הועבר* לתאריך ${dateStr} בשעה ${timeStr}.\nנתראה! 😊`
            )
          }
        } catch (err) {
          console.error('[appointments/PATCH] Failed to send WhatsApp notification:', err)
        }
      }
    }

    return NextResponse.json({ appointment: data })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}

// DELETE - cancel appointment
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')

    // Also support body-based id + cancellation reason
    let cancellationReason = ''
    if (!id) {
      try {
        const body = await request.json()
        id = body.id
        cancellationReason = body.reason || ''
      } catch {
        // No body provided
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'חסר מזהה תור' }, { status: 400 })
    }

    // Verify the appointment belongs to this business - include contact + service details
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, contact_id, service_type, start_time, contacts(name, phone, wa_id)')
      .eq('id', id)
      .eq('business_id', bu.business_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 })
    }

    // Soft delete - set status to cancelled with optional reason
    const updateData: Record<string, unknown> = { status: 'cancelled' }
    if (cancellationReason) updateData.notes = `[ביטול] ${cancellationReason}`

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('business_id', bu.business_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create cancellation notification
    await supabase.from('notifications').insert({
      business_id: bu.business_id,
      type: 'cancelled_appointment',
      title: 'תור בוטל',
      body: `התור ל${existing.service_type} בוטל`,
      metadata: { contact_id: existing.contact_id },
    })

    // Send WhatsApp cancellation message to customer
    const contact = existing.contacts as { name?: string; phone?: string; wa_id?: string } | null
    if (contact?.wa_id || contact?.phone) {
      try {
        const admin = createServiceClient()
        const { data: phoneNum } = await admin
          .from('phone_numbers')
          .select('session_id, status')
          .eq('business_id', bu.business_id)
          .eq('status', 'connected')
          .single()

        if (phoneNum?.session_id) {
          // Format chatId - LID needs @lid suffix, phone needs @c.us
          let chatId = contact.wa_id || contact.phone || ''
          if (chatId && !chatId.includes('@')) {
            if (/^\d{15,}$/.test(chatId)) {
              chatId = chatId + '@lid'
            } else {
              if (chatId.startsWith('05')) chatId = '972' + chatId.slice(1)
              chatId = chatId + '@c.us'
            }
          }

          const date = new Date(existing.start_time)
          const dateStr = date.toLocaleDateString('he-IL')
          const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

          const displayName = (contact.name && !contact.name.startsWith('לקוח ')) ? contact.name : ''
          await whatsapp.sendMessage(
            phoneNum.session_id,
            chatId,
            `שלום${displayName ? ' ' + displayName : ''},\nהתור שלך ל${existing.service_type} בתאריך ${dateStr} בשעה ${timeStr} *בוטל*.\nאם תרצה/י לקבוע תור חדש, פשוט שלח/י לנו הודעה 😊`
          )
        }
      } catch (err) {
        console.error('[appointments/DELETE] Failed to send WhatsApp notification:', err)
      }
    }

    return NextResponse.json({ appointment: data })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
