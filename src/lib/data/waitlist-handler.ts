import { createServiceClient } from '@/lib/supabase/service'

// ── Affirmative/Negative patterns (Hebrew) ──────

const YES_PATTERNS = /^(כן|בטח|יאללה|סבבה|מאשר|מאשרת|אשמח|כמובן|בוודאי|yes|yeah|yep|אני רוצה|רוצה|תקבע|תקבעי)$/i
const NO_PATTERNS = /^(לא|ביטול|לא תודה|no|nope|לא רוצה|אל|לא צריך|עזוב)$/i

const OFFER_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Check if an incoming message is a reply to a waitlist offer.
 * Returns { handled: true, responseMessage } if we processed it,
 * or { handled: false } if the message should go to the AI agent.
 */
export async function handleWaitlistReply(
  contactId: string,
  businessId: string,
  message: string,
): Promise<{ handled: boolean; responseMessage?: string }> {
  const supabase = createServiceClient()

  // Find active waitlist offer for this contact
  const { data: offer } = await supabase
    .from('waitlist')
    .select('id, offered_appointment_time, offered_at, offered_service_type, offered_duration_minutes, service_type')
    .eq('contact_id', contactId)
    .eq('business_id', businessId)
    .eq('status', 'offered')
    .order('offered_at', { ascending: false })
    .limit(1)
    .single()

  if (!offer || !offer.offered_at) {
    return { handled: false }
  }

  // Check TTL
  const offeredAt = new Date(offer.offered_at).getTime()
  const elapsed = Date.now() - offeredAt
  if (elapsed > OFFER_TTL_MS) {
    // Expired — update status and cascade
    await supabase.from('waitlist').update({ status: 'expired' }).eq('id', offer.id)
    await offerToNextInQueue(offer.id, businessId)

    if (YES_PATTERNS.test(message.trim())) {
      return {
        handled: true,
        responseMessage: 'סליחה, ההצעה כבר פגה 😔 רוצה שאקבע לך תור ביום אחר?',
      }
    }
    return { handled: false }
  }

  const trimmed = message.trim()

  // ── YES → auto-book ──
  if (YES_PATTERNS.test(trimmed)) {
    if (!offer.offered_appointment_time || !offer.offered_duration_minutes) {
      // Missing slot data — can't auto-book
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', offer.id)
      return {
        handled: true,
        responseMessage: 'משהו השתבש עם ההצעה. רוצה שאקבע לך תור?',
      }
    }

    const startTime = offer.offered_appointment_time
    const durationMin = offer.offered_duration_minutes
    const endTime = new Date(new Date(startTime).getTime() + durationMin * 60 * 1000).toISOString()
    const service = offer.offered_service_type || offer.service_type || ''

    // Get contact name for appointment
    const { data: contactData } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', contactId)
      .single()

    // Check slot is still free (race condition guard)
    const slotStart = new Date(startTime)
    const slotEnd = new Date(endTime)
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('business_id', businessId)
      .in('status', ['confirmed', 'pending'])
      .lt('start_time', slotEnd.toISOString())
      .gt('end_time', slotStart.toISOString())
      .limit(1)

    if (conflicts && conflicts.length > 0) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', offer.id)
      return {
        handled: true,
        responseMessage: 'אוי, מישהו תפס את השעה הזו ממש עכשיו 😔 רוצה שאמצא שעה אחרת?',
      }
    }

    // Book the appointment
    const { error: bookErr } = await supabase.from('appointments').insert({
      business_id: businessId,
      contact_id: contactId,
      service_type: service,
      contact_name: contactData?.name || '',
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMin,
      status: 'confirmed',
    })

    if (bookErr) {
      console.error('[waitlist] Failed to auto-book:', bookErr.message)
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', offer.id)
      return {
        handled: true,
        responseMessage: 'לא הצלחתי לקבוע את התור 😔 נסה שוב או שלח "קבע תור".',
      }
    }

    // Mark waitlist entry as booked
    await supabase.from('waitlist').update({ status: 'booked' }).eq('id', offer.id)

    // Notify business
    const timeStr = new Date(startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    const dateStr = new Date(startTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
    await supabase.from('notifications').insert({
      business_id: businessId,
      type: 'new_appointment',
      title: 'תור מרשימת המתנה!',
      body: `${contactData?.name || 'לקוח'} אישר/ה תור ל${service} ב-${dateStr} ${timeStr} (מרשימת המתנה)`,
      metadata: { contact_id: contactId },
    })

    return {
      handled: true,
      responseMessage: `מעולה! קבעתי לך ${service} ב-${dateStr} בשעה ${timeStr}. נתראה! 🎉`,
    }
  }

  // ── NO → decline and cascade ──
  if (NO_PATTERNS.test(trimmed)) {
    await supabase.from('waitlist').update({ status: 'declined' }).eq('id', offer.id)
    await offerToNextInQueue(offer.id, businessId)
    return {
      handled: true,
      responseMessage: 'בסדר, אין בעיה! אם תרצה לקבוע בזמן אחר, פשוט שלח הודעה 🙏',
    }
  }

  // Message doesn't match yes/no — let AI handle it
  return { handled: false }
}

/**
 * Offer the freed slot to the next person in the waitlist queue.
 */
export async function offerToNextInQueue(
  declinedWaitlistId: string,
  businessId: string,
): Promise<void> {
  const supabase = createServiceClient()

  // Get the declined entry to find the date
  const { data: declined } = await supabase
    .from('waitlist')
    .select('preferred_date, offered_appointment_time, offered_service_type, offered_duration_minutes')
    .eq('id', declinedWaitlistId)
    .single()

  if (!declined?.preferred_date || !declined.offered_appointment_time) return

  // Find next waiting entry for the same date
  const { data: nextEntry } = await supabase
    .from('waitlist')
    .select('id, contact_id, contacts(wa_id, name)')
    .eq('business_id', businessId)
    .eq('status', 'waiting')
    .eq('preferred_date', declined.preferred_date)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!nextEntry) return

  // Update with offer details
  await supabase
    .from('waitlist')
    .update({
      status: 'offered',
      offered_appointment_time: declined.offered_appointment_time,
      offered_at: new Date().toISOString(),
      offered_service_type: declined.offered_service_type,
      offered_duration_minutes: declined.offered_duration_minutes,
    })
    .eq('id', nextEntry.id)

  // Send WhatsApp
  const contact = nextEntry.contacts as { wa_id?: string; name?: string } | null
  if (!contact?.wa_id) return

  const { data: bizPhone } = await supabase
    .from('phone_numbers')
    .select('session_id')
    .eq('business_id', businessId)
    .eq('status', 'connected')
    .limit(1)
    .single()

  if (!bizPhone?.session_id) return

  const time = new Date(declined.offered_appointment_time).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  })

  try {
    const { whatsapp } = await import('@/lib/waha/provider')
    await whatsapp.sendMessage(
      bizPhone.session_id,
      contact.wa_id,
      `היי ${contact.name}! 🎉\nהתפנה תור ב-${time}.\nרוצה לקבוע? פשוט שלח/י "כן" ונסדר!`,
    )
    console.log(`[waitlist] Cascaded offer to contact ${nextEntry.contact_id}`)
  } catch (err) {
    console.error(`[waitlist] Failed to send cascade offer:`, err)
  }
}

/**
 * Expire stale waitlist offers (older than 30 min).
 * Called from cron job.
 */
export async function expireStaleOffers(businessId: string): Promise<number> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - OFFER_TTL_MS).toISOString()

  const { data: stale } = await supabase
    .from('waitlist')
    .select('id')
    .eq('business_id', businessId)
    .eq('status', 'offered')
    .lt('offered_at', cutoff)

  if (!stale || stale.length === 0) return 0

  let expired = 0
  for (const entry of stale) {
    await supabase.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
    await offerToNextInQueue(entry.id, businessId)
    expired++
  }

  if (expired > 0) {
    console.log(`[waitlist] Expired ${expired} stale offers for business ${businessId}`)
  }
  return expired
}
