import { generateResponse } from '@/lib/ai/ai-client'
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentInput } from './types'
import { ERROR_MESSAGES } from './error-messages'
import { ActionError } from './error-messages'

// ── Action Executor ─────────────────────────────────────

export function formatDateHebrew(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function addMinutesToTimeString(startTime: string, minutes: number): string {
  // startTime format: "2026-03-18T21:00:00" (local time, no timezone)
  // Parse manually to avoid timezone issues
  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) return startTime

  const [, datePart, hourStr, minStr] = match
  let totalMinutes = parseInt(hourStr) * 60 + parseInt(minStr) + minutes
  const hours = Math.floor(totalMinutes / 60) % 24
  const mins = totalMinutes % 60
  return `${datePart}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
}

// ActionError imported from ./error-messages

export async function executeAction(
  action: { type: string; params: Record<string, unknown> },
  input: AgentInput,
  settings: Record<string, unknown> | null
): Promise<void> {
  const supabase = createServiceClient()

  switch (action.type) {
    case 'book_appointment': {
      const params = action.params as {
        date?: string
        time?: string
        service?: string
        contact_name?: string
        notes?: string
        for_other?: boolean
        other_relationship?: string | null
        booked_by_contact_name?: string | null
      }
      if (!params.date || !params.time || !params.service) {
        throw new ActionError(
          `MISSING_PARAMS: date=${params.date}, time=${params.time}, service=${params.service}`,
          'חסרים פרטים לקביעת התור. איזה יום ושעה מתאימים?'
        )
      }

      if (params.date && params.time && params.service) {
        // Validate date: ensure day-of-week matches the date
        const bookDate = new Date(params.date + 'T12:00:00')
        if (isNaN(bookDate.getTime())) {
          throw new ActionError('INVALID_DATE: ' + params.date, 'התאריך לא תקין. איזה תאריך מתאים לך?')
        }

        // Cross-check: look for the requested time in recent conversation
        // to catch AI sending wrong time
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', input.conversationId)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false })
          .limit(5)

        if (recentMsgs) {
          // Check if customer mentioned a different time than what AI is booking
          const customerMessages = recentMsgs.map(m => m.content || '').join(' ')
          const timesMentioned = customerMessages.match(/\d{1,2}:\d{2}/g) || []
          if (timesMentioned.length > 0) {
            const lastTimeMentioned = timesMentioned[timesMentioned.length - 1]
            // Normalize both times for comparison
            const normalize = (t: string) => {
              const [h, m] = t.split(':').map(Number)
              return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
            }
            const normalizedRequested = normalize(lastTimeMentioned)
            const normalizedAction = normalize(params.time)
            if (normalizedRequested !== normalizedAction) {
              console.warn(`[agent] Time mismatch! Customer asked ${normalizedRequested}, AI booking ${normalizedAction}. Using customer's time.`)
              params.time = normalizedRequested
            }
          }
        }

        const services =
          (settings?.services as Array<{
            name: string
            duration: number
            price: number
          }>) || []
        let service = services.find((s) => s.name === params.service)
          if (!service && params.service) service = services.find((s) => s.name.includes(params.service!) || params.service!.includes(s.name))
          if (!service && services.length === 1) service = services[0]

        if (!service) {
          throw new ActionError(
            `UNKNOWN_SERVICE: "${params.service}" not found in ${services.map(s => s.name).join(', ')}`,
            ERROR_MESSAGES.UNKNOWN_SERVICE
          )
        }

        if (service) {
          // Round time to valid interval for this service
          let timeStr = params.time || '09:00'
          const [hStr, mStr] = timeStr.split(':')
          const totalMin = parseInt(hStr) * 60 + parseInt(mStr)
          if (totalMin % service.duration !== 0) {
            const rounded = Math.round(totalMin / service.duration) * service.duration
            const rH = Math.floor(rounded / 60) % 24
            const rM = rounded % 60
            timeStr = `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`
          }

          // Save Israel time directly (no timezone offset)
          // Column is now timestamp WITHOUT timezone
          // 12:00 Israel = stored as 12:00 = displayed as 12:00
          let startTime = `${params.date}T${timeStr}:00`
          const endTime = addMinutesToTimeString(`${params.date}T${timeStr}:00`, service.duration)

          // Check for conflicting appointments before booking
          const { data: conflicts } = await supabase
            .from('appointments')
            .select('id, contact_id, contacts(name, wa_id, phone)')
            .eq('business_id', input.businessId)
            .in('status', ['confirmed', 'pending'])
            .lt('start_time', endTime)
            .gt('end_time', startTime)
            .limit(1)

          if (conflicts && conflicts.length > 0) {
            const conflictApt = conflicts[0]
            const conflictContactData = conflictApt.contacts as { wa_id?: string; phone?: string } | null

            // Send a GENERIC message to the existing customer — NO details about who wants the slot
            if (conflictContactData?.wa_id) {
              try {
                const { data: phoneNum } = await supabase
                  .from('phone_numbers')
                  .select('session_id')
                  .eq('business_id', input.businessId)
                  .eq('status', 'connected')
                  .single()

                if (phoneNum?.session_id) {
                  const { whatsapp } = await import('@/lib/waha/provider')
                  const chatId = conflictContactData.wa_id
                  // Generic message — no mention of other customer, no details
                  await whatsapp.sendMessage(
                    phoneNum.session_id,
                    chatId,
                    `היי 👋 יש אפשרות להזיז את התור שלך לשעה אחרת? אם כן, שלח/י לנו באיזו שעה נוח ונסדר 🙏`
                  )
                }
              } catch (sendErr) {
                console.error('[agent] Failed to send reschedule request:', sendErr)
              }
            }

            // Internal notification for dashboard
            await supabase.from('notifications').insert({
              business_id: input.businessId,
              type: 'system',
              title: 'שעה תפוסה — נשלחה בקשת הזזה',
              body: `${input.contactName} רצה תור ב-${timeStr} (${params.date}). נשלחה בקשה ללקוח הקיים להזיז.`,
              metadata: { requesting_contact: input.contactId, existing_appointment: conflictApt.id },
            })

            throw new ActionError('TIME_SLOT_CONFLICT', 'השעה הזאת תפוסה. שלחנו בקשה לבדוק אם אפשר לפנות. בינתיים, רוצה לנסות שעה אחרת?')
          }

          // Update contact name if we learned it during conversation
          const learnedName = params.contact_name as string | undefined
          if (learnedName && learnedName.length > 1) {
            // Check if the learned name is a real name (not a placeholder/phone number)
            const isPlaceholder = /^\d+$/.test(learnedName)
              || /^[\d\s]+$/.test(learnedName)
              || learnedName.startsWith('לקוח')
              || learnedName.startsWith('972')
              || /^\+?\d{7,}/.test(learnedName)
            if (!isPlaceholder) {
              // Also update if current contact name looks like a placeholder
              const currentName = input.contactName || ''
              const currentIsPlaceholder = /^\d+$/.test(currentName)
                || /^[\d\s]+$/.test(currentName)
                || currentName.startsWith('לקוח')
                || currentName.startsWith('972')
                || /^\+?\d{7,}/.test(currentName)
              // Always update if current name is placeholder, or if we have a new real name
              if (currentIsPlaceholder || learnedName !== currentName) {
                await supabase.from('contacts')
                  .update({ name: learnedName })
                  .eq('id', input.contactId)
                console.log(`[agent] Updated contact ${input.contactId} name to: ${learnedName}`)
              }
            }
          }

          // If booking for someone else, create a linked contact
          let bookingContactId = input.contactId
          const isForOther = params.for_other as boolean
          if (isForOther && params.contact_name) {
            const otherName = params.contact_name as string
            const relationship = (params.other_relationship as string) || 'other'

            // Check if linked contact already exists
            const { data: existingLinked } = await supabase
              .from('contacts')
              .select('id')
              .eq('business_id', input.businessId)
              .eq('linked_to', input.contactId)
              .eq('name', otherName)
              .single()

            if (existingLinked) {
              bookingContactId = existingLinked.id
            } else {
              // Create new linked contact
              const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                  business_id: input.businessId,
                  name: otherName,
                  wa_id: null,
                  phone: null,
                  status: 'new',
                  linked_to: input.contactId,
                  relationship: relationship,
                  notes: `נוצר דרך ${input.contactName} (${relationship})`,
                })
                .select('id')
                .single()

              if (newContact) {
                bookingContactId = newContact.id
              }
            }
          }

          // Use atomic RPC to prevent race conditions (advisory lock + conflict check + insert)
          const { error: rpcError } = await supabase.rpc('book_appointment_atomic', {
            p_business_id: input.businessId,
            p_contact_id: bookingContactId,
            p_service_type: params.service as string,
            p_start_time: startTime,
            p_end_time: endTime,
            p_duration_minutes: service.duration,
            p_price: service.price,
            p_contact_name: (params.contact_name as string) || learnedName || input.contactName || '',
            p_notes: (params.notes as string) || '',
          })

          if (rpcError) {
            if (rpcError.message?.includes('TIME_SLOT_CONFLICT')) {
              throw new ActionError('TIME_SLOT_CONFLICT', ERROR_MESSAGES.TIME_SLOT_CONFLICT)
            }
            throw new ActionError(
              `DB insert error: ${rpcError.message}`,
              ERROR_MESSAGES.DB_INSERT_ERROR
            )
          }

          // RPC already updates contact stats (total_visits + total_revenue)

          // Send notification
          await supabase.from('notifications').insert({
            business_id: input.businessId,
            type: 'new_appointment',
            title: 'תור חדש נקבע',
            body: `${input.contactName} קבע/ה תור ל${params.service} בתאריך ${params.date} בשעה ${params.time}`,
            metadata: { contact_id: input.contactId, service: params.service, date: params.date, time: params.time },
          })
        }
      }
      break
    }

    case 'cancel_appointment': {
      const params = action.params as { appointment_id?: string }
      if (params.appointment_id) {
        await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', params.appointment_id)
          .eq('business_id', input.businessId)
      } else {
        const { data: upcoming } = await supabase
          .from('appointments')
          .select('id, service_type, start_time')
          .eq('business_id', input.businessId)
          .eq('contact_id', input.contactId)
          .eq('status', 'confirmed')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .single()

        if (upcoming) {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', upcoming.id)

          await supabase.from('notifications').insert({
            business_id: input.businessId,
            type: 'cancelled_appointment',
            title: 'תור בוטל',
            body: `${input.contactName} ביטל/ה תור ל${upcoming.service_type}`,
            metadata: { contact_id: input.contactId, appointment_id: upcoming.id },
          })
        }
      }
      break
    }

    case 'update_contact': {
      const contactParams = action.params as {
        name?: string
        phone?: string
        gender?: string
        notes?: string
      }
      const updates: Record<string, unknown> = {}
      if (contactParams.name) updates.name = contactParams.name
      if (contactParams.phone) {
        let phone = contactParams.phone.replace(/[^0-9]/g, '')
        if (phone.startsWith('05') && phone.length === 10) {
          phone = '972' + phone.slice(1)
        }
        updates.phone = phone
        // NEVER update wa_id - it's the WhatsApp identifier and must stay as received from WAHA
      }
      if (contactParams.notes) updates.notes = contactParams.notes
      if (contactParams.gender && ['male', 'female'].includes(contactParams.gender)) {
        updates.gender = contactParams.gender
      }

      if (Object.keys(updates).length > 0) {
        try {
          await supabase
            .from('contacts')
            .update(updates)
            .eq('id', input.contactId)
            .eq('business_id', input.businessId)
        } catch (contactUpdateErr) {
          // Log but don't fail the whole response — contact update is non-critical
          console.error('[agent] Contact update failed (non-critical):', contactUpdateErr)
        }
      }
      break
    }

    case 'reschedule_appointment': {
      // ATOMIC: Insert new FIRST, cancel old AFTER (if insert fails, old stays)
      const rParams = action.params as { service?: string; date?: string; time?: string }

      // 1. Find existing appointment (don't cancel yet!)
      const { data: upcoming } = await supabase
        .from('appointments')
        .select('id, service_type, duration_minutes')
        .eq('business_id', input.businessId)
        .eq('contact_id', input.contactId)
        .in('status', ['confirmed', 'pending'])
        .gte('start_time', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + 'T00:00:00')
        .order('start_time', { ascending: true })
        .limit(1)
        .single()

      if (!upcoming) {
        throw new ActionError('NO_APPOINTMENT', 'לא מצאתי תור קיים להזזה. רוצה לקבוע תור חדש?')
      }

      // 2. Create new appointment FIRST (before cancelling old)
      if (rParams.date && rParams.time) {
        const services = (settings?.services as Array<{ name: string; duration: number; price: number }>) || []
        const serviceName = rParams.service || upcoming.service_type
        let service = services.find((s) => s.name === serviceName)
        if (!service && serviceName) service = services.find((s) => s.name.includes(serviceName) || serviceName.includes(s.name))
        if (!service && services.length === 1) service = services[0]

        const duration = service?.duration || upcoming.duration_minutes || 30
        const newStart = `${rParams.date}T${rParams.time}:00`
        const newEnd = addMinutesToTimeString(newStart, duration)

        const { error: insertError } = await supabase.from('appointments').insert({
          business_id: input.businessId,
          contact_id: input.contactId,
          service_type: serviceName,
          start_time: newStart,
          end_time: newEnd,
          duration_minutes: duration,
          price: service?.price || 0,
          status: 'confirmed',
        })

        if (insertError) {
          // Insert failed — DON'T cancel old appointment! Customer keeps their existing booking.
          throw new ActionError('DB_INSERT_ERROR', 'לא הצלחתי לקבוע תור חדש. התור הקיים שלך נשמר.')
        }

        // 3. Only NOW cancel old appointment (new one is safe in DB)
        await supabase.from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', upcoming.id)

        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'rescheduled_appointment',
          title: 'תור הוזז',
          body: `${input.contactName} הזיז/ה תור ל${serviceName} לתאריך ${rParams.date} בשעה ${rParams.time}`,
          metadata: { contact_id: input.contactId, service: serviceName, date: rParams.date, time: rParams.time },
        })
      } else {
        throw new ActionError('MISSING_PARAMS', 'חסרים תאריך או שעה להזזת התור. לאיזה יום ושעה תרצה להזיז?')
      }
      break
    }

    case 'escalate': {
      await supabase
        .from('conversations')
        .update({ is_bot_active: false, assigned_to: null })
        .eq('id', input.conversationId)

      await supabase.from('notifications').insert({
        business_id: input.businessId,
        type: 'escalation',
        title: 'לקוח מבקש לדבר איתך',
        body: `${input.contactName} ביקש/ה להעביר את השיחה אליך. הבוט כובה.`,
        metadata: { contact_id: input.contactId, conversation_id: input.conversationId },
      })
      break
    }

    case 'add_to_waitlist': {
      await supabase.from('waitlist').insert({
        business_id: input.businessId,
        contact_id: input.contactId,
        preferred_date: action.params.date,
        service_type: action.params.service,
        status: 'waiting',
      })

      await supabase.from('notifications').insert({
        business_id: input.businessId,
        type: 'waitlist',
        title: 'נוסף לרשימת המתנה',
        body: `${action.params.contact_name || input.contactName} נוסף/ה לרשימת המתנה ל${action.params.service} ב${action.params.date}`,
        metadata: { contact_id: input.contactId, date: action.params.date, service: action.params.service },
      })
      break
    }

    default:
      console.warn(`Unknown action type: ${action.type}`)
  }
}