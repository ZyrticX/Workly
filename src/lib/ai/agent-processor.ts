import { generateResponse, generateResponseWithTools } from '@/lib/ai/ai-client'
import type { ToolCall } from '@/lib/ai/ai-client'
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentInput, AgentResponse, ParsedAIResponse, AdvancedAIConfig } from './types'
import { buildSystemPrompt } from './prompt-builder'
import { ERROR_MESSAGES, ActionError } from './error-messages'
import { executeAction, formatDateHebrew } from './action-executor'
import { logError } from '@/lib/utils/error-logger'
import { cached, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis'

// ── Clean AI response: strip JSON, code blocks, and mixed content ──

function cleanAIResponse(raw: string): string {
  let text = raw.trim()

  // 1. Remove markdown code blocks
  text = text.replace(/```json\n?[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim()

  // 2. Try parsing as pure JSON → extract "text" field
  try {
    const parsed = JSON.parse(text)
    if (parsed.text) return parsed.text.trim()
    if (parsed.response) return parsed.response.trim()
  } catch { /* not pure JSON */ }

  // 3. Remove inline JSON objects from mixed text (e.g. "היי!\n\n{...}")
  text = text.replace(/\{[\s\S]*?"text"\s*:\s*"[\s\S]*?\}/g, '').trim()
  // Also remove any remaining JSON-like blocks
  text = text.replace(/\{[^{}]*"intent"[^{}]*\}/g, '').trim()
  text = text.replace(/\{[^{}]*"action"[^{}]*\}/g, '').trim()

  // 4. Clean up leftover whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return text || raw.trim()
}

// ── Convert tool call to action ──

function toolCallToAction(tc: ToolCall): { type: string; params: Record<string, unknown> } | null {
  try {
    const params = JSON.parse(tc.function.arguments || '{}')
    return { type: tc.function.name, params }
  } catch {
    console.warn(`[agent] Failed to parse tool call arguments: ${tc.function.arguments}`)
    return null
  }
}

// ── Fallback text when model returns tool_calls without content ──

function generateFallbackText(actionType: string, contactName: string): string {
  const name = contactName || ''
  switch (actionType) {
    case 'book_appointment':
      return `שנייה ${name}, מסדר לך את התור... 📋`
    case 'cancel_appointment':
      return `מבטל את התור ${name ? `שלך ${name}` : ''}...`
    case 'reschedule_appointment':
      return `מזיז את התור ${name ? `שלך ${name}` : ''}...`
    case 'escalate':
      return `שנייה, מעביר אותך לצוות 🙏`
    case 'update_contact':
      return '' // Silent — no need to message customer for contact updates
    default:
      return `שנייה ${name}, בודק... 🔍`
  }
}

// ── Main Agent Processor ────────────────────────────────

export async function processAIAgent(
  input: AgentInput
): Promise<AgentResponse> {
  const supabase = createServiceClient()

  try {
  // 1. Load business context (cached) + fresh data in parallel
  const [businessData, settingsData, personaData, historyResult, contactResult] =
    await Promise.all([
      // Cached: business info (rarely changes)
      cached(
        CACHE_KEYS.businessInfo(input.businessId),
        async () => {
          const { data } = await supabase.from('businesses').select('id, name, business_type').eq('id', input.businessId).single()
          return data
        },
        CACHE_TTL.SETTINGS
      ),
      // Cached: business settings (rarely changes)
      cached(
        CACHE_KEYS.businessSettings(input.businessId),
        async () => {
          const { data } = await supabase.from('business_settings').select('id, business_id, services, working_hours, cancellation_policy, ai_config, ai_advanced').eq('business_id', input.businessId).single()
          return data
        },
        CACHE_TTL.SETTINGS
      ),
      // Cached: AI persona (rarely changes)
      cached(
        CACHE_KEYS.aiPersona(input.businessId),
        async () => {
          const { data } = await supabase.from('ai_personas').select('id, business_id, tone, emoji_usage, style_examples, system_prompt').eq('business_id', input.businessId).single()
          return data
        },
        CACHE_TTL.PERSONA
      ),
      // NOT cached: messages (always fresh)
      supabase
        .from('messages')
        .select('content, direction, sender_type')
        .eq('conversation_id', input.conversationId)
        .order('created_at', { ascending: false })
        .limit(20),
      // NOT cached: contact (can change mid-conversation)
      supabase
        .from('contacts')
        .select('name, status, phone, total_visits')
        .eq('id', input.contactId)
        .single(),
    ])

  // Wrap cached results to match original { data } format
  const businessResult = { data: businessData }
  const settingsResult = { data: settingsData }
  const personaResult = { data: personaData }

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

  // Load upcoming appointments for this contact + linked contacts (booked by this contact)
  const israelNowForApts = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const nowForApts = `${israelNowForApts.getFullYear()}-${String(israelNowForApts.getMonth() + 1).padStart(2, '0')}-${String(israelNowForApts.getDate()).padStart(2, '0')}T${String(israelNowForApts.getHours()).padStart(2, '0')}:${String(israelNowForApts.getMinutes()).padStart(2, '0')}:00`

  // Get own appointments
  const { data: ownApts } = await supabase
    .from('appointments')
    .select('id, contact_name, service_type, start_time, status')
    .eq('business_id', input.businessId)
    .eq('contact_id', input.contactId)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', nowForApts)
    .order('start_time')
    .limit(5)

  // Get appointments booked for linked contacts (friends/family)
  const { data: linkedContacts } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('business_id', input.businessId)
    .eq('linked_to', input.contactId)

  let linkedApts: typeof ownApts = []
  if (linkedContacts && linkedContacts.length > 0) {
    const linkedIds = linkedContacts.map(c => c.id)
    const { data } = await supabase
      .from('appointments')
      .select('id, contact_name, service_type, start_time, status')
      .eq('business_id', input.businessId)
      .in('contact_id', linkedIds)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', nowForApts)
      .order('start_time')
      .limit(5)
    linkedApts = data || []
  }

  // Build appointment context string for AI
  const allApts = [...(ownApts || []), ...(linkedApts || [])]
  const appointmentContext = allApts.length > 0
    ? allApts.map(a => {
        const time = (a.start_time as string).substring(11, 16)
        const date = (a.start_time as string).substring(0, 10)
        const isLinked = linkedApts?.some(la => la.id === a.id)
        return `${date} ${time} - ${a.service_type} - ${a.contact_name}${isLinked ? ' (קבעת עבורו/ה)' : ''}`
      }).join('\n')
    : 'אין תורים קרובים'

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

  // Build date lookup table in Israel timezone (precise, no timezone bugs)
  const israelNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const israelToday = `${israelNow.getFullYear()}-${String(israelNow.getMonth() + 1).padStart(2, '0')}-${String(israelNow.getDate()).padStart(2, '0')}`
  const israelTime = `${String(israelNow.getHours()).padStart(2, '0')}:${String(israelNow.getMinutes()).padStart(2, '0')}`
  const israelDayOfWeek = israelNow.getDay() // 0=Sunday
  const hebrewDayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const todayHebrew = hebrewDayNames[israelDayOfWeek]

  // Build next 14 days lookup — today FIRST, clearly marked
  const dayLookup: string[] = []
  for (let i = 0; i <= 13; i++) {
    const d = new Date(israelNow)
    d.setDate(d.getDate() + i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dayName = hebrewDayNames[d.getDay()]
    if (i === 0) {
      dayLookup.push(`*** היום = ${dateStr} (${dayName}) ← USE THIS FOR "היום" AND "${dayName}"`)
    } else if (i === 1) {
      dayLookup.push(`*** מחר = ${dateStr} (${dayName})`)
    } else {
      dayLookup.push(`${dayName} = ${dateStr} (in ${i} days)`)
    }
  }

  const extractionPrompt = `IMPORTANT: Respond ONLY in valid JSON. Extract information from the user's message.
You are extracting data for a booking system for "${businessResult.data?.name || 'business'}".

Available services: ${services.map(s => s.name).join(', ')}
Current booking step: ${bookingState.step}
${!contactNameIsPlaceholder ? `Known customer name from DB: ${knownContactName}` : 'Customer name is NOT known yet — extract it from the message if mentioned.'}

## CRITICAL — Date & Time Reference (Israel timezone):
Today is: ${israelToday} (יום ${todayHebrew})
Current time: ${israelTime}

## Date lookup — USE THESE EXACT DATES, DO NOT CALCULATE YOUR OWN:
${dayLookup.join('\n')}

## RULES FOR DATE EXTRACTION — VERY IMPORTANT:
- "היום" = ${israelToday}
- "מחר" = ${dayLookup[1]?.split(' = ')[1]?.split(' ')[0] || ''}
- If customer says a day name (e.g. "יום ראשון") AND today IS that day → use TODAY's date (${israelToday}), NOT next week!
- If customer says a day name and today is NOT that day → use the NEAREST future occurrence from the list
- CRITICAL: Today is ${todayHebrew} (${israelToday}). If someone says "${todayHebrew}" they mean TODAY.
- "29.3" or "29/3" or "ב-29" = ${israelNow.getFullYear()}-03-29
- NEVER invent a date. ONLY use dates from the lookup table above.
- If you can't determine the date, return null.
- NEVER say a date "already passed" if it's today's date!

## RULES FOR TIME EXTRACTION:
- "ב-3" or "בשלוש" = 15:00 (afternoon, not 03:00)
- "ב-9" or "בתשע" = 09:00
- "ב-10 בבוקר" = 10:00
- "ב-8 בערב" = 20:00
- Time must be in HH:MM format (24-hour). Examples: 09:00, 14:30, 17:00
- If you can't determine the time, return null.
- NEVER guess a time the customer didn't mention.

Extract these fields:
{
  "intent": "book|cancel|reschedule|confirm|deny|provide_info|greeting|question|other",
  "service": "service name if mentioned, or null",
  "name": "person name if mentioned, or null",
  "gender": "male|female|null",
  "date": "YYYY-MM-DD from the lookup table above, or null",
  "time": "HH:MM in 24h format, or null",
  "notes": "any notes/comments, or null",
  "confirmation": true/false/null,
  "for_other": true/false,
  "other_name": "name or null",
  "other_relationship": "relationship or null"
}

Additional rules:
- "כן"/"בטח"/"מאשר"/"יאללה"/"סבבה" → confirmation: true
- "לא"/"ביטול" → confirmation: false
- If step is "collecting_name" and message is 1-3 words, it's probably a name
${contactCtx.gender ? `Known gender: ${contactCtx.gender}` : ''}`

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
    // Log extraction for debugging
    console.log(`[agent] Extracted: intent=${extracted.intent}, date=${extracted.date || '-'}, time=${extracted.time || '-'}, service=${extracted.service || '-'}, name=${extracted.name || '-'}`)
  } catch {
    console.warn(`[agent] Failed to parse AI extraction: "${rawResponse.substring(0, 100)}"`)
    extracted = { intent: 'other' }
  }

  // 5.5 VALIDATE extracted date and time (prevent AI hallucinations)
  if (extracted.date) {
    // Validate date format: must be YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) {
      console.warn(`[agent] Invalid date format from AI: "${extracted.date}" — clearing`)
      extracted.date = undefined as unknown as string
    } else {
      // Validate date is real (not Feb 30, etc.)
      const testDate = new Date(extracted.date + 'T12:00:00')
      if (isNaN(testDate.getTime())) {
        console.warn(`[agent] Invalid date from AI: "${extracted.date}" — clearing`)
        extracted.date = undefined as unknown as string
      }
      // Validate date is not in the past
      if (extracted.date && extracted.date < israelToday) {
        console.warn(`[agent] Past date from AI: "${extracted.date}" (today: ${israelToday}) — clearing`)
        extracted.date = undefined as unknown as string
      }
    }
  }
  if (extracted.time) {
    // Validate time format: must be HH:MM
    if (!/^\d{2}:\d{2}$/.test(extracted.time)) {
      // Try to fix common formats: "9:00" → "09:00"
      const timeMatch = extracted.time.match(/^(\d{1,2}):(\d{2})$/)
      if (timeMatch) {
        extracted.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      } else {
        console.warn(`[agent] Invalid time format from AI: "${extracted.time}" — clearing`)
        extracted.time = undefined as unknown as string
      }
    }
    // Validate time range (00:00-23:59) + round to nearest slot
    if (extracted.time) {
      const [h, m] = extracted.time.split(':').map(Number)
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        console.warn(`[agent] Invalid time range from AI: "${extracted.time}" — clearing`)
        extracted.time = undefined as unknown as string
      } else {
        // Round to nearest 30-minute slot (avoid 16:09, 10:15, etc.)
        const roundedM = m < 15 ? 0 : m < 45 ? 30 : 0
        const roundedH = m >= 45 ? h + 1 : h
        const roundedTime = `${String(roundedH).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`
        if (extracted.time !== roundedTime) {
          console.log(`[agent] Rounded time: ${extracted.time} → ${roundedTime}`)
          extracted.time = roundedTime
        }
      }
    }
  }

  // 5.6 Auto-update gender if detected and not already known
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
      // Check if the conflict is the customer's OWN appointment
      const { data: ownConflict } = await supabase
        .from('appointments')
        .select('id, service_type, start_time')
        .eq('business_id', input.businessId)
        .eq('contact_id', input.contactId)
        .in('status', ['confirmed', 'pending'])
        .gte('start_time', `${stateResult.newState.date}T${stateResult.newState.time}:00`)
        .lte('start_time', `${stateResult.newState.date}T${stateResult.newState.time}:59`)
        .limit(1)
        .single()

      if (ownConflict) {
        // It's their OWN appointment — tell them!
        const ownTime = (ownConflict.start_time as string).substring(11, 16)
        stateResult.aiInstruction = `ללקוח כבר יש תור ב-${ownTime} ל${ownConflict.service_type}. אמור לו בחמימות שכבר קבוע לו, ושאל אם רוצה לשנות או להוסיף תור בשעה אחרת.`
        stateResult.newState.step = 'idle'
        stateResult.newState.time = undefined
        stateResult.action = null
        stateResult.skipAI = false
      } else {
      // Slot is taken by someone else — go back to collecting_time
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
      } // end else (not own appointment)
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
    console.log(`[agent] Filtering slots: ${stateResult.availableSlots.length} theoretical for ${stateResult.newState.date}`)
    const { filterBookedSlots } = await import('@/lib/ai/booking-state')
    const realSlots = await filterBookedSlots(
      input.businessId,
      stateResult.newState.date,
      stateResult.availableSlots,
      stateResult.newState.serviceDuration || 30
    )

    console.log(`[agent] After filtering: ${realSlots.length} real slots available (from ${stateResult.availableSlots.length} theoretical)`)
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

  // 6.8 Guard cancel/reschedule — verify appointment exists before executing
  if (stateResult.action?.type === 'cancel_appointment' || stateResult.action?.type === 'reschedule_appointment') {
    const israelNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
    const nowStr = `${israelNow.getFullYear()}-${String(israelNow.getMonth() + 1).padStart(2, '0')}-${String(israelNow.getDate()).padStart(2, '0')}T${String(israelNow.getHours()).padStart(2, '0')}:${String(israelNow.getMinutes()).padStart(2, '0')}:00`

    const { data: existingApt } = await supabase
      .from('appointments')
      .select('id')
      .eq('contact_id', input.contactId)
      .eq('business_id', input.businessId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', nowStr)
      .order('start_time')
      .limit(1)

    if (!existingApt || existingApt.length === 0) {
      stateResult.action = null
      stateResult.skipAI = false
      stateResult.aiInstruction = 'אין תור קיים לביטול או להזזה. שאל את הלקוח אם רוצה לקבוע תור חדש.'
    }
  }

  // Save new state
  await saveBookingState(input.conversationId, stateResult.newState)

  // 7. Generate response
  const aiAdvanced = (settingsResult.data?.ai_advanced as AdvancedAIConfig) || null
  // If name is placeholder, override contactCtx so the AI doesn't use "לקוח 2589" as a real name
  const promptContactCtx = contactNameIsPlaceholder
    ? { ...contactCtx, name: '' }
    : contactCtx
  const baseSystemPrompt = buildSystemPrompt(
    businessResult.data,
    settingsResult.data,
    personaResult.data,
    promptContactCtx,
    aiAdvanced
  ) + `\n\n## תורים קרובים של ${contactCtx.name}:\n${appointmentContext}\n\nכשלקוח שואל "איזה תורים יש לי" — הצג את כל התורים מהרשימה למעלה. אם יש תורים שקבע לאחרים, אמור "וגם קבעת תור ל[שם] ב-[שעה]".`
  + (contactNameIsPlaceholder ? `\n\n## חשוב — השם של הלקוח לא ידוע!\nהשם שיש לנו הוא מזהה זמני בלבד. **אל תקרא ללקוח "${contactCtx.name}"!** פנה אליו בצורה ידידותית בלי שם (למשל "היי!" או "אהלן!"). ברגע הראשון הנוח — שאל "איך קוראים לך?" והשתמש ב-tool update_contact עם השם שהוא נותן.` : '')

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
    // State machine gave instructions - AI generates natural response with tool calling
    const guidedPrompt = `${baseSystemPrompt}

## הנחיה נוכחית (חובה לבצע):
${stateResult.aiInstruction}

כללים:
- ענה בעברית טבעית וחמה. אתה בן אדם אמיתי, לא בוט.
- אל תגיד "אני בוט" או "אני AI" לעולם.
- תהיה קצר - 1-3 משפטים מקסימום.
- אל תחזור על מידע שכבר נאמר בשיחה.
- אם הלקוח חוזר, הראה שאתה זוכר אותו.
- ענה בטקסט רגיל, בלי JSON, בלי פורמט מיוחד.
- **אסור לבקש מספר טלפון! הלקוח כבר בוואטסאפ.**
- אם צריך לבצע פעולה (קביעת תור, ביטול, עדכון פרטים) — השתמש ב-tools שזמינים לך. אל תכתוב JSON בגוף ההודעה.
- **חובה**: תמיד כתוב הודעה ללקוח בנוסף לשימוש ב-tool! אל תשלח tool בלי טקסט.`

    const toolResponse = await generateResponseWithTools(
      guidedPrompt,
      conversationHistory.slice(-8),
      input.message
    )

    let cleanText = cleanAIResponse(toolResponse.text || '')

    // Merge: state machine action takes priority, then tool calls
    let action = stateResult.action
    const allToolActions = toolResponse.toolCalls.map(tc => toolCallToAction(tc)).filter(Boolean) as Array<{ type: string; params: Record<string, unknown> }>

    // Process multiple tool calls: primary action + side effects (like update_contact)
    let sideEffectAction: { type: string; params: Record<string, unknown> } | null = null
    for (const tc of allToolActions) {
      if (!action && (tc.type === 'book_appointment' || tc.type === 'cancel_appointment' || tc.type === 'reschedule_appointment' || tc.type === 'escalate')) {
        action = tc
      } else if (tc.type === 'update_contact') {
        sideEffectAction = tc
      } else if (!action) {
        action = tc
      }
    }

    // Execute side-effect tool calls immediately (e.g., update_contact alongside a booking)
    if (sideEffectAction) {
      try {
        await executeAction(sideEffectAction, input, settingsResult.data)
        console.log(`[agent] Side-effect tool call executed: ${sideEffectAction.type}`)
      } catch (sideErr) {
        console.warn(`[agent] Side-effect tool call failed (non-critical): ${sideErr}`)
      }
    }

    // If model returned tool calls but no text, generate fallback text
    if (!cleanText && action) {
      cleanText = generateFallbackText(action.type, contactCtx.name)
    }

    parsed = {
      text: cleanText,
      intent: extracted.intent || 'other',
      confidence: 0.9,
      action,
      escalated: false,
    }
  } else {
    // No state machine instruction - free AI response with tool calling
    const freePrompt = `${baseSystemPrompt}

ענה בעברית טבעית, חמה, כאילו אתה חבר. 1-3 משפטים.
אם הלקוח שואל שאלה שאתה לא יודע - אמור שתבדוק ותחזור אליו.
אם הלקוח רוצה לדבר עם בן אדם - השתמש ב-tool escalate.
**אסור לבקש מספר טלפון! הלקוח כבר בוואטסאפ.**
- אם צריך לבצע פעולה (קביעת תור, ביטול, עדכון פרטים, העברה לבעל העסק) — השתמש ב-tools שזמינים לך. אל תכתוב JSON.
- **חובה**: תמיד כתוב הודעה ללקוח בנוסף לשימוש ב-tool! אל תשלח tool בלי טקסט.`

    const toolResponse = await generateResponseWithTools(
      freePrompt,
      conversationHistory,
      input.message
    )

    let cleanText = cleanAIResponse(toolResponse.text || '')

    // Process multiple tool calls
    let action = stateResult.action
    const allToolActions = toolResponse.toolCalls.map(tc => toolCallToAction(tc)).filter(Boolean) as Array<{ type: string; params: Record<string, unknown> }>

    let sideEffectAction: { type: string; params: Record<string, unknown> } | null = null
    for (const tc of allToolActions) {
      if (!action && (tc.type === 'book_appointment' || tc.type === 'cancel_appointment' || tc.type === 'reschedule_appointment' || tc.type === 'escalate')) {
        action = tc
      } else if (tc.type === 'update_contact') {
        sideEffectAction = tc
      } else if (!action) {
        action = tc
      }
    }

    // Execute side-effect tool calls immediately
    if (sideEffectAction) {
      try {
        await executeAction(sideEffectAction, input, settingsResult.data)
        console.log(`[agent] Side-effect tool call executed: ${sideEffectAction.type}`)
      } catch (sideErr) {
        console.warn(`[agent] Side-effect tool call failed (non-critical): ${sideErr}`)
      }
    }

    // If model returned tool calls but no text, generate fallback text
    if (!cleanText && action) {
      cleanText = generateFallbackText(action.type, contactCtx.name)
    }

    parsed = {
      text: cleanText,
      intent: extracted.intent || 'other',
      confidence: 0.5,
      action,
      escalated: allToolActions.some(tc => tc.type === 'escalate')
        || (cleanText.includes('מעביר') || cleanText.includes('אעביר') || cleanText.includes('יצור איתך קשר')),
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
      // Check contact name is real (not "לקוח 382")
      const bookingName = (actionParams.contact_name as string) || contactCtx.name || ''
      const nameIsPlaceholder = !bookingName || /^\d+$/.test(bookingName) || bookingName.startsWith('לקוח') || /^\+?\d{7,}/.test(bookingName)
      if (!hasDate || !hasTime || !hasService || nameIsPlaceholder) {
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
        const bookingName = actionParams.contact_name || contactCtx.name || ''
        const service = actionParams.service || ''
        const date = actionParams.date ? formatDateHebrew(actionParams.date as string) : ''
        const time = actionParams.time || ''
        const isForOther = actionParams.for_other as boolean
        if (isForOther) {
          parsed.text = `מעולה! קבעתי ל${bookingName} ${service} ב${date} בשעה ${time}. נתראה! 🙏`
        } else {
          parsed.text = `מעולה ${bookingName}! קבעתי לך ${service} ב${date} בשעה ${time}. נתראה! 🙏`
        }
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

  // 6b. Safety net: AI said "מעביר" but didn't send escalate action → force escalation
  if (parsed.escalated && parsed.action?.type !== 'escalate') {
    try {
      await executeAction({ type: 'escalate', params: {} }, input, settingsResult.data)
      console.log('[agent] Auto-escalated: AI said "מעביר" without escalate action')
    } catch (escErr) {
      console.error('[agent] Auto-escalation failed:', escErr)
    }
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

    // Log to error_logs + send WhatsApp alert
    await logError({
      businessId: input.businessId,
      source: 'ai_agent',
      severity: 'critical',
      message: errMsg,
      contactName: input.contactName,
      details: { conversationId: input.conversationId, status: errStatus },
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
