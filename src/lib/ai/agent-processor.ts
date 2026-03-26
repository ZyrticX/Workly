import { generateResponse } from '@/lib/ai/ai-client'
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentInput, AgentResponse, ParsedAIResponse, AdvancedAIConfig } from './types'
import { buildSystemPrompt } from './prompt-builder'
import { ERROR_MESSAGES, ActionError } from './error-messages'
import { executeAction, formatDateHebrew } from './action-executor'

// ── Main Agent Processor ────────────────────────────────

export async function processAIAgent(
  input: AgentInput
): Promise<AgentResponse> {
  const supabase = createServiceClient()

  try {
  // 1. Load business context + contact info in parallel
  const [businessResult, settingsResult, personaResult, historyResult, contactResult] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('id, name, business_type')
        .eq('id', input.businessId)
        .single(),
      supabase
        .from('business_settings')
        .select('id, business_id, services, working_hours, cancellation_policy, ai_config, ai_advanced')
        .eq('business_id', input.businessId)
        .single(),
      supabase
        .from('ai_personas')
        .select('id, business_id, tone, emoji_usage, style_examples, system_prompt')
        .eq('business_id', input.businessId)
        .single(),
      supabase
        .from('messages')
        .select('content, direction, sender_type')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('contacts')
        .select('name, status, phone, total_visits')
        .eq('id', input.contactId)
        .single(),
    ])

  // Build contact context for the AI
  const contactCtx = contactResult.data ? {
    name: contactResult.data.name || input.contactName,
    status: contactResult.data.status || input.contactStatus || 'new',
    phone: contactResult.data.phone || input.contactPhone || '',
    visits: contactResult.data.total_visits || input.contactVisits || 0,
    gender: (contactResult.data as Record<string, unknown>).gender as string | null || null,
  } : {
    name: input.contactName,
    status: input.contactStatus || 'new',
    phone: input.contactPhone || '',
    visits: input.contactVisits || 0,
    gender: null as string | null,
  }

  // 2. Load booking state
  const { loadBookingState, saveBookingState, processState } = await import('@/lib/ai/booking-state')
  const bookingState = await loadBookingState(input.conversationId)
  const services = (settingsResult.data?.services as Array<{ name: string; duration: number; price: number }>) || []

  // 3. Build extraction prompt - AI only extracts data, doesn't decide
  // Determine if the contact has a real known name
  const knownContactName = contactCtx.name || ''
  const contactNameIsPlaceholder = !knownContactName
    || /^\d+$/.test(knownContactName)
    || /^[\d\s]+$/.test(knownContactName)
    || knownContactName.startsWith('לקוח')
    || knownContactName.startsWith('972')
    || /^\+?\d{7,}/.test(knownContactName)

  const extractionPrompt = `IMPORTANT: Respond ONLY in valid JSON. Extract information from the user's message.
You are extracting data for a booking system for "${businessResult.data?.name || 'business'}".

Available services: ${services.map(s => s.name).join(', ')}
Current booking step: ${bookingState.step}
${!contactNameIsPlaceholder ? `Known customer name from DB: ${knownContactName} (use this as the name if the customer doesn't provide a different one)` : 'Customer name is NOT known yet — extract it from the message if mentioned.'}
Today: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })} (${new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long' })})
Current time in Israel: ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false })}
IMPORTANT: If the customer asks for today, only offer times AFTER the current time. Don't offer 09:00 if it's already 17:00.

Day lookup (next occurrence of each day):
${(() => {
  // Get current date in Israel timezone
  const now = new Date()
  const israelDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  const israelDayStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'long' })
  const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
  const todayDow = dayMap[israelDayStr] ?? 0
  const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

  return [0, 1, 2, 3, 4, 5, 6].map(targetDay => {
    let diff = (targetDay - todayDow + 7) % 7
    if (diff === 0) diff = 7 // next week if same day
    const future = new Date(israelDateStr + 'T12:00:00')
    future.setDate(future.getDate() + diff)
    return `${hebrewDays[targetDay]} = ${future.toLocaleDateString('en-CA')}`
  }).join('\n')
})()}
היום = ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })}
מחר = ${(() => { const t = new Date(); const isr = new Date(t.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + 'T12:00:00'); isr.setDate(isr.getDate() + 1); return isr.toLocaleDateString('en-CA'); })()}

Extract these fields from the message:
{
  "intent": "book|cancel|reschedule|confirm|deny|provide_info|greeting|question|other",
  "service": "service name if mentioned, or null",
  "name": "person name if mentioned, or null",
  "gender": "male|female|null — detect from Hebrew grammar, name, or context",
  "date": "YYYY-MM-DD if a date/day is mentioned, or null",
  "time": "HH:MM if time mentioned, or null",
  "notes": "any notes/comments, or null",
  "confirmation": true/false/null,
  "for_other": true if booking for someone else (לאמא/לחבר/לבן זוג/למישהו), false otherwise,
  "other_name": "name of the other person if mentioned, or null",
  "other_relationship": "mother|father|friend|spouse|child|sibling|other — relationship if mentioned, or null"
}

Rules:
- "כן", "בטח", "מאשר", "יאללה", "סבבה", "אוקיי" → confirmation: true
- "לא", "ביטול", "לא רוצה" → confirmation: false
- "מחר" → tomorrow's date
- "היום" → today's date
- If step is "collecting_name" and message is a short word (1-3 words), it's probably a name
- Gender detection: "רוצה" (male), "רוצה" can be both, "רציתי" → check context. Names like דוד/משה/יוסי = male. שרה/מיכל/נועה = female.
${contactCtx.gender ? `Known gender from DB: ${contactCtx.gender}` : 'Gender unknown — try to detect from message'}`

  // 4. Send to AI for extraction only
  const conversationHistory = (historyResult.data || [])
    .reverse()
    .map((msg) => ({
      role: (msg.direction === 'inbound' ? 'user' : 'model') as 'user' | 'model',
      text: msg.content || '',
    }))

  const rawResponse = await generateResponse(
    extractionPrompt,
    conversationHistory.slice(-6), // Only last few messages for context
    input.message
  )

  // 5. Parse extracted data
  let extracted: import('@/lib/ai/booking-state').ExtractedData
  try {
    const cleaned = rawResponse.replace(/```json\n?|```/g, '').trim()
    extracted = JSON.parse(cleaned)
  } catch {
    extracted = { intent: 'other' }
  }

  // 5.5 Auto-update gender if detected and not already known
  const extractedAny = extracted as unknown as Record<string, unknown>
  if (extractedAny.gender && !contactCtx.gender) {
    const detectedGender = extractedAny.gender as string
    if (['male', 'female'].includes(detectedGender)) {
      contactCtx.gender = detectedGender
      supabase.from('contacts').update({ gender: detectedGender }).eq('id', input.contactId).then(() => {})
    }
  }

  // 6. Run state machine (with holidays config)
  const holidaysConfig = ((settingsResult.data as Record<string, unknown>)?.holidays_config as import('@/lib/utils/hebrew-calendar').HolidaysConfig) || null
  const stateResult = processState(
    bookingState,
    extracted,
    services,
    contactCtx.name,
    settingsResult.data?.working_hours as Record<string, unknown> | null,
    holidaysConfig
  )

  // 6.5 CRITICAL: Check availability BEFORE confirming
  // If state machine selected a time and moved to collecting_notes or confirming,
  // verify the slot is actually free in the DB
  if (stateResult.newState.time && stateResult.newState.date &&
      (stateResult.newState.step === 'collecting_notes' || stateResult.newState.step === 'confirming') &&
      bookingState.step === 'collecting_time') {
    const { checkAvailability, filterBookedSlots, getValidSlots: getSlots } = await import('@/lib/ai/booking-state')
    const availability = await checkAvailability(
      input.businessId,
      stateResult.newState.date,
      stateResult.newState.time,
      stateResult.newState.serviceDuration || 30
    )

    if (!availability.available) {
      // Slot is taken! Don't proceed to notes/confirming — go back to collecting_time
      stateResult.newState.step = 'collecting_time'
      stateResult.newState.time = undefined

      // Get real available slots
      const dayIdx = new Date(stateResult.newState.date + 'T12:00:00').getDay()
      const workingHours = settingsResult.data?.working_hours as Record<string, unknown> | null
      const theoreticalSlots = getSlots(stateResult.newState.serviceDuration || 30, workingHours, dayIdx, stateResult.newState.date)
      const realSlots = await filterBookedSlots(
        input.businessId,
        stateResult.newState.date,
        theoreticalSlots,
        stateResult.newState.serviceDuration || 30
      )

      if (realSlots.length === 0) {
        stateResult.newState.step = 'waitlist_offer'
        stateResult.aiInstruction = `השעה שהלקוח ביקש תפוסה, וגם כל שאר השעות ביום הזה. שאל אם רוצה להיכנס לרשימת המתנה או לנסות יום אחר.`
      } else {
        stateResult.aiInstruction = `השעה הזאת כבר תפוסה! אמור ללקוח בעדינות ותציע שעות פנויות: ${realSlots.slice(0, 4).join(', ')}. תהיה נחמד ולא מתנצל.`
        stateResult.availableSlots = realSlots
      }
      stateResult.action = null
      stateResult.skipAI = false
    }
  }

  // 6.6 Also check before booking action (belt and suspenders)
  if (stateResult.action?.type === 'book_appointment' && stateResult.newState.step === 'idle') {
    const params = stateResult.action.params as { date?: string; time?: string }
    if (params.date && params.time) {
      const { checkAvailability: checkAvail2 } = await import('@/lib/ai/booking-state')
      const avail = await checkAvail2(
        input.businessId,
        params.date,
        params.time,
        stateResult.newState.serviceDuration || services[0]?.duration || 30
      )
      if (!avail.available) {
        // Cancel the booking action
        stateResult.action = null
        stateResult.skipAI = false
        stateResult.aiInstruction = `רגע, מישהו תפס את השעה הזאת ממש עכשיו. אמור ללקוח שהשעה כבר לא פנויה, ושאל אם רוצה שעה אחרת.`
        stateResult.newState = { ...stateResult.newState, step: 'collecting_time', time: undefined }
      }
    }
  }

  // 6.7 Filter available slots by actual DB bookings (for time selection display)
  if (stateResult.availableSlots && stateResult.availableSlots.length > 0 && stateResult.newState.date) {
    const { filterBookedSlots } = await import('@/lib/ai/booking-state')
    const realSlots = await filterBookedSlots(
      input.businessId,
      stateResult.newState.date,
      stateResult.availableSlots,
      stateResult.newState.serviceDuration || 30
    )

    if (realSlots.length === 0) {
      // All slots are booked — offer waitlist
      stateResult.newState.step = 'waitlist_offer'
      stateResult.aiInstruction = `כל השעות ביום הזה תפוסות. שאל את הלקוח אם רוצה להיכנס לרשימת המתנה, או לנסות יום אחר.`
      stateResult.availableSlots = []
    } else {
      // Update instruction with real available slots
      stateResult.availableSlots = realSlots
      if (stateResult.aiInstruction) {
        // Replace the theoretical slots in the instruction with real ones
        stateResult.aiInstruction = stateResult.aiInstruction.replace(
          /שעות פנויות:.*$/m,
          `שעות פנויות: ${realSlots.slice(0, 6).join(', ')}`
        )
        // Also replace slot suggestions in other patterns
        stateResult.aiInstruction = stateResult.aiInstruction.replace(
          /הצע [\d\-]+ שעות מתוך:.*$/m,
          `הצע 2-3 שעות מתוך: ${realSlots.slice(0, 5).join(', ')}`
        )
      }
    }
  }

  // Save new state
  await saveBookingState(input.conversationId, stateResult.newState)

  // 7. Generate response
  const aiAdvanced = (settingsResult.data?.ai_advanced as AdvancedAIConfig) || null
  const baseSystemPrompt = buildSystemPrompt(
    businessResult.data,
    settingsResult.data,
    personaResult.data,
    contactCtx,
    aiAdvanced
  )

  let parsed: ParsedAIResponse

  if (stateResult.aiInstruction && stateResult.skipAI) {
    // Confirmation message - use literal text (already perfect)
    parsed = {
      text: stateResult.aiInstruction,
      intent: extracted.intent || 'other',
      confidence: 1.0,
      action: stateResult.action,
      escalated: false,
    }
  } else if (stateResult.aiInstruction) {
    // State machine gave instructions - AI generates natural response
    const guidedPrompt = `${baseSystemPrompt}

## הנחיה נוכחית (חובה לבצע):
${stateResult.aiInstruction}

כללים:
- ענה בעברית טבעית וחמה. אתה בן אדם אמיתי, לא בוט.
- אל תגיד "אני בוט" או "אני AI" לעולם.
- תהיה קצר - 1-3 משפטים מקסימום.
- אל תחזור על מידע שכבר נאמר בשיחה.
- אם הלקוח חוזר, הראה שאתה זוכר אותו.
- ענה בטקסט רגיל, בלי JSON, בלי פורמט מיוחד.`

    const aiResponse = await generateResponse(
      guidedPrompt,
      conversationHistory.slice(-8),
      input.message
    )

    // Clean response - remove any JSON wrapping
    let cleanText = aiResponse.replace(/```json\n?|```/g, '').trim()
    try {
      const maybeJson = JSON.parse(cleanText)
      cleanText = maybeJson.text || maybeJson.response || cleanText
    } catch {
      // Not JSON, good - it's plain text
    }

    parsed = {
      text: cleanText,
      intent: extracted.intent || 'other',
      confidence: 0.9,
      action: stateResult.action,
      escalated: false,
    }
  } else {
    // No state machine instruction - free AI response
    const freePrompt = `${baseSystemPrompt}

ענה בעברית טבעית, חמה, כאילו אתה חבר. 1-3 משפטים. בלי JSON.
אם הלקוח שואל שאלה שאתה לא יודע - אמור שתבדוק ותחזור אליו.
אם הלקוח רוצה לדבר עם בן אדם - אמור שאתה מעביר לבעל העסק.`

    const aiResponse = await generateResponse(
      freePrompt,
      conversationHistory,
      input.message
    )

    let cleanText = aiResponse.replace(/```json\n?|```/g, '').trim()
    try {
      const maybeJson = JSON.parse(cleanText)
      cleanText = maybeJson.text || maybeJson.response || cleanText
    } catch {
      // Plain text
    }

    parsed = {
      text: cleanText,
      intent: extracted.intent || 'other',
      confidence: 0.5,
      action: stateResult.action,
      escalated: extracted.intent === 'other' && cleanText.includes('מעביר'),
    }
  }

  // 6. Execute action if needed — validate params first
  if (parsed.action) {
    const actionParams = parsed.action.params as Record<string, unknown>

    // SAFETY: Never execute book_appointment without all required fields
    if (parsed.action.type === 'book_appointment') {
      const hasDate = actionParams.date && typeof actionParams.date === 'string' && actionParams.date.length >= 8
      const hasTime = actionParams.time && typeof actionParams.time === 'string' && actionParams.time.includes(':')
      const hasService = actionParams.service && typeof actionParams.service === 'string'
      if (!hasDate || !hasTime || !hasService) {
        console.warn('[agent] Blocked book_appointment with missing params:', { date: actionParams.date, time: actionParams.time, service: actionParams.service })
        // Don't execute — notify owner and ask customer
        parsed.action = null
        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'system',
          title: '⚠️ תור לא נשמר',
          body: `הסוכן אמר ללקוח ${contactCtx.name || input.contactName} שנקבע תור, אבל חסרים פרטים (שעה/שירות). בדוק ידנית.`,
          metadata: { contact_id: input.contactId, params: actionParams },
        })
        if (parsed.text.includes('קבעתי') || parsed.text.includes('מסודר') || parsed.text.includes('נקבע')) {
          parsed.text = `שנייה ${contactCtx.name || ''}, בודק שהכל מסודר... 🔍`
        }
      }
    }
    try {
      if (!parsed.action) throw new Error('ACTION_BLOCKED')
      await executeAction(parsed.action, input, settingsResult.data)

      // If booking was pending confirmation, NOW confirm to user
      if (parsed.text === '__BOOKING_PENDING__') {
        const name = actionParams.contact_name || contactCtx.name || ''
        const service = actionParams.service || ''
        const date = actionParams.date ? formatDateHebrew(actionParams.date as string) : ''
        const time = actionParams.time || ''
        parsed.text = `מעולה ${name}! קבעתי לך ${service} ב${date} בשעה ${time}. נתראה! 🙏`
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'שגיאה'
      console.error('[agent] Failed to execute action:', errMsg)

      // Use customer-facing message from ActionError if available
      if (err instanceof ActionError) {
        parsed.text = err.customerMessage
        // Return to collecting_time for time conflicts
        if (errMsg.includes('TIME_SLOT_CONFLICT')) {
          await saveBookingState(input.conversationId, { ...stateResult.newState, step: 'collecting_time' as const })
        }
      } else if (errMsg.includes('TIME_SLOT_CONFLICT')) {
        parsed.text = ERROR_MESSAGES.TIME_SLOT_CONFLICT
        await saveBookingState(input.conversationId, { ...stateResult.newState, step: 'collecting_time' as const })
      } else {
        if (parsed.text === '__BOOKING_PENDING__') {
          parsed.text = ERROR_MESSAGES.DB_INSERT_ERROR
        }
        // Notify business owner about other failures
        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'system',
          title: 'פעולה נכשלה',
          body: `הסוכן ניסה לבצע "${parsed.action?.type || 'unknown'}" אך נכשל: ${errMsg}`,
          metadata: { action: parsed.action || {}, contact_id: input.contactId },
        })
      }
    }
  } else if (parsed.text === '__BOOKING_PENDING__') {
    parsed.text = 'סליחה, משהו השתבש. נסה שוב בבקשה.'
  }

  // 7. Safety net: AI said "booked" but didn't send action → AUTO-FIX
  const bookingKeywords = ['קבעתי', 'נקבע', 'אישרתי', 'התור שלך', 'מאושר']
  const textLower = parsed.text || ''
  const aiClaimedBooking = bookingKeywords.some(kw => textLower.includes(kw))

  if (aiClaimedBooking && !parsed.action) {
    // First check if a booking was ALREADY saved by the action (avoid double-booking)
    const recentCheck = await supabase
      .from('appointments')
      .select('id')
      .eq('business_id', input.businessId)
      .eq('contact_id', input.contactId)
      .eq('status', 'confirmed')
      .gte('created_at', new Date(Date.now() - 30000).toISOString()) // Last 30 seconds
      .limit(1)

    if (recentCheck.data && recentCheck.data.length > 0) {
      console.log('[agent] Booking already saved recently, skipping auto-fix.')
    } else {
    console.warn('[agent] AI claimed booking but sent no action! Attempting auto-fix...')

    // Try to extract date, time, service from the AI text
    const dateMatch = textLower.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}[./]\d{1,2}[./]?\d{0,4})/)
    const timeMatch = textLower.match(/(\d{1,2}:\d{2})/)
    const services = (settingsResult.data?.services as Array<{ name: string; duration: number; price: number }>) || []

    // Find which service the AI mentioned
    let matchedService = services.find(s => textLower.includes(s.name))
    if (!matchedService && services.length === 1) matchedService = services[0]

    if (timeMatch && matchedService) {
      // Try to determine the date
      let bookDate = ''
      if (dateMatch) {
        const raw = dateMatch[1] || dateMatch[2]
        if (raw.includes('-')) {
          bookDate = raw // Already YYYY-MM-DD
        } else {
          // Try DD/MM or DD.MM format
          const parts = raw.split(/[./]/)
          if (parts.length >= 2) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2] || new Date().getFullYear().toString()
            bookDate = `${year.length === 2 ? '20' + year : year}-${month}-${day}`
          }
        }
      }

      // If no date found, check for day names
      if (!bookDate) {
        const today = new Date()
        const dayNames: Record<string, number> = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 }
        const hebrewDay = Object.keys(dayNames).find(d => textLower.includes(d))
        if (hebrewDay) {
          const targetDay = dayNames[hebrewDay]
          const diff = (targetDay - today.getDay() + 7) % 7 || 7
          const target = new Date(today)
          target.setDate(today.getDate() + diff)
          bookDate = target.toISOString().split('T')[0]
        } else if (textLower.includes('מחר')) {
          const tomorrow = new Date(today)
          tomorrow.setDate(today.getDate() + 1)
          bookDate = tomorrow.toISOString().split('T')[0]
        } else if (textLower.includes('היום')) {
          bookDate = today.toISOString().split('T')[0]
        }
      }

      if (bookDate) {
        // Auto-execute booking!
        const autoAction = {
          type: 'book_appointment',
          params: { service: matchedService.name, date: bookDate, time: timeMatch[1] }
        }
        try {
          await executeAction(autoAction, input, settingsResult.data)
          console.log(`[agent] Auto-fix SUCCESS: booked ${matchedService.name} on ${bookDate} at ${timeMatch[1]}`)
        } catch (autoErr) {
          console.error('[agent] Auto-fix FAILED:', autoErr)
          await supabase.from('notifications').insert({
            business_id: input.businessId,
            type: 'system',
            title: '⚠️ תור לא נשמר',
            body: `הסוכן אמר ללקוח ${input.contactName} שנקבע תור, אבל לא הצלחנו לשמור. בדוק ידנית.`,
            metadata: { contact_id: input.contactId, conversation_id: input.conversationId, ai_text: parsed.text },
          })
        }
      } else {
        // Can't determine date
        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'system',
          title: '⚠️ תור לא נשמר',
          body: `הסוכן אמר ללקוח ${input.contactName} שנקבע תור, אבל לא הצלחנו לזהות את התאריך. בדוק ידנית.`,
          metadata: { contact_id: input.contactId, ai_text: parsed.text },
        })
      }
    } else {
      await supabase.from('notifications').insert({
        business_id: input.businessId,
        type: 'system',
        title: '⚠️ תור לא נשמר',
        body: `הסוכן אמר ללקוח ${input.contactName} שנקבע תור, אבל חסרים פרטים (שעה/שירות). בדוק ידנית.`,
        metadata: { contact_id: input.contactId, ai_text: parsed.text },
      })
    }
    } // end else (no recent booking)
  }

  // 8. Safety net: validate booking was actually saved
  if (parsed.action?.type === 'book_appointment') {
    const params = parsed.action.params as { date?: string; time?: string; service?: string }
    if (params.date && params.time) {
      const checkTime = `${params.date}T${params.time}`
      const { data: saved } = await supabase
        .from('appointments')
        .select('id')
        .eq('business_id', input.businessId)
        .eq('contact_id', input.contactId)
        .gte('start_time', checkTime + ':00')
        .lte('start_time', checkTime + ':59')
        .limit(1)

      if (!saved || saved.length === 0) {
        console.error('[agent] Booking action executed but appointment not found in DB!')
        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'system',
          title: '⚠️ תור לא נמצא במערכת',
          body: `הסוכן ניסה לקבוע תור ל${input.contactName} ב-${params.date} ${params.time} אבל התור לא נמצא ב-DB. בדוק ידנית.`,
          metadata: { contact_id: input.contactId, params },
        })
      }
    }
  }

  // 9. Return response
  return {
    text: parsed.text,
    intent: parsed.intent,
    confidence: parsed.confidence,
    escalated: parsed.escalated || false,
  }

  } catch (outerError) {
    // ── Top-level error handler for processAIAgent ──
    const errMsg = outerError instanceof Error ? outerError.message : String(outerError)
    const errStatus = (outerError as { status?: number }).status

    console.error('[agent] processAIAgent FATAL error:', {
      error: errMsg,
      status: errStatus,
      businessId: input.businessId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      message: input.message.slice(0, 100),
    })

    // Choose a friendly Hebrew message based on error type
    let fallbackText: string
    if (errStatus === 429 || errMsg.includes('429')) {
      fallbackText = ERROR_MESSAGES.RATE_LIMIT
    } else {
      fallbackText = ERROR_MESSAGES.GENERIC_FALLBACK
    }

    return {
      text: fallbackText,
      intent: 'error',
      confidence: 0,
      escalated: false,
    }
  }
}
