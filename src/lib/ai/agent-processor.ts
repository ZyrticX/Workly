import { generateResponseWithTools } from '@/lib/ai/ai-client'
import type { ToolCallResult } from '@/lib/ai/ai-client'
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentInput, AgentResponse, ParsedAIResponse, AdvancedAIConfig } from './types'
import { buildSystemPrompt } from './prompt-builder'
import { ERROR_MESSAGES, ActionError } from './error-messages'
import { executeAction, formatDateHebrew } from './action-executor'
import { logError } from '@/lib/utils/error-logger'
import { buildAgentContext } from './context-builder'
import { extractDataFromMessage } from './data-extractor'
import { formatIsraelSQL } from '@/lib/utils/timezone'

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

// ── Convert SDK tool call to action ──

function toolCallToAction(tc: ToolCallResult): { type: string; params: Record<string, unknown> } {
  return { type: tc.toolName, params: tc.args }
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
  // 1. Load business context (cached) + appointments + conversation history
  const ctx = await buildAgentContext(input)

  // Wrap for backward compatibility with rest of function
  const businessResult = { data: { name: ctx.businessName, business_type: ctx.businessType } }
  const settingsResult = { data: ctx.settings }
  const personaResult = { data: ctx.persona }
  const contactCtx = ctx.contact
  const appointmentContext = ctx.appointmentContext
  const services = ctx.services
  const conversationHistory = ctx.conversationHistory

  // Check if contact name is a placeholder (phone number or "לקוח 123")
  const knownName = contactCtx.name || ''
  const contactNameIsPlaceholder = !knownName
    || /^\d+$/.test(knownName)
    || /^[\d\s]+$/.test(knownName)
    || knownName.startsWith('לקוח')
    || knownName.startsWith('972')
    || /^\+?\d{7,}/.test(knownName)

  // 2. Load booking state
  const { loadBookingState, saveBookingState, processState } = await import('@/lib/ai/booking-state')
  const bookingState = await loadBookingState(input.conversationId)

  // 3-5. Extract data from message (prompt building + AI call + validation)
  const extracted = await extractDataFromMessage(
    input.message,
    ctx.conversationHistory,
    ctx.businessName,
    services,
    bookingState,
    contactCtx,
  )

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
    const nowStr = formatIsraelSQL()

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
  ) + `\n\n## תורים קרובים של ${contactCtx.name}:\n${appointmentContext}\n\nכשלקוח שואל "איזה תורים יש לי" או "מה התורים שלי" — הצג את כל התורים מהרשימה למעלה, כולל תורים שקבע לאחרים.\n**חשוב**: תורים המסומנים "(קבעת עבורו/ה)" הם תורים שהלקוח הנוכחי קבע לחבר/משפחה שלו. זה **לא** מידע של לקוח אחר — זה המידע של הלקוח הנוכחי! מותר ואף חובה לספר לו על התורים האלה. למשל: "יש לך תור ב-20:30, ו**גם** קבעת ליוסי תור ב-21:00".`
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
- **אל תנסה לקבוע/לבטל/להזיז תור בעצמך. המערכת מנהלת את זה אוטומטית.**
- אם הלקוח רוצה לדבר עם בן אדם — השתמש ב-tool escalate.
- כשלומדים שם או מגדר חדש — השתמש ב-tool update_contact.
- **חובה**: תמיד כתוב הודעה ללקוח בנוסף לשימוש ב-tool! אל תשלח tool בלי טקסט.`

    const toolResponse = await generateResponseWithTools(
      guidedPrompt,
      conversationHistory.slice(-8),
      input.message
    )

    let cleanText = cleanAIResponse(toolResponse.text || '')

    // Action comes ONLY from state machine — AI cannot book/cancel/reschedule
    const action = stateResult.action

    // Process AI tool calls: only update_contact and escalate are allowed
    const allToolActions = toolResponse.toolCalls.map(tc => toolCallToAction(tc))
    let escalated = false

    for (const tc of allToolActions) {
      if (tc.type === 'update_contact') {
        try {
          await executeAction(tc, input, settingsResult.data)
          console.log(`[agent] Side-effect tool call executed: update_contact`)
        } catch (sideErr) {
          console.warn(`[agent] update_contact failed (non-critical): ${sideErr}`)
        }
      } else if (tc.type === 'escalate') {
        escalated = true
      }
      // Silently ignore any booking tool calls — state machine is the sole owner
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
      escalated,
    }
  } else {
    // No state machine instruction - free AI response with tool calling
    const freePrompt = `${baseSystemPrompt}

ענה בעברית טבעית, חמה, כאילו אתה חבר. 1-3 משפטים.
אם הלקוח שואל שאלה שאתה לא יודע - אמור שתבדוק ותחזור אליו.
אם הלקוח רוצה לדבר עם בן אדם - השתמש ב-tool escalate.
**אסור לבקש מספר טלפון! הלקוח כבר בוואטסאפ.**
- **אל תנסה לקבוע/לבטל/להזיז תור בעצמך. המערכת מנהלת את זה אוטומטית.**
- כשלומדים שם או מגדר חדש — השתמש ב-tool update_contact.
- **חובה**: תמיד כתוב הודעה ללקוח בנוסף לשימוש ב-tool! אל תשלח tool בלי טקסט.`

    const toolResponse = await generateResponseWithTools(
      freePrompt,
      conversationHistory,
      input.message
    )

    let cleanText = cleanAIResponse(toolResponse.text || '')

    // Action comes ONLY from state machine — AI cannot book/cancel/reschedule
    const action = stateResult.action

    // Process AI tool calls: only update_contact and escalate are allowed
    const allToolActions = toolResponse.toolCalls.map(tc => toolCallToAction(tc))
    let escalated = false

    for (const tc of allToolActions) {
      if (tc.type === 'update_contact') {
        try {
          await executeAction(tc, input, settingsResult.data)
          console.log(`[agent] Side-effect tool call executed: update_contact`)
        } catch (sideErr) {
          console.warn(`[agent] update_contact failed (non-critical): ${sideErr}`)
        }
      } else if (tc.type === 'escalate') {
        escalated = true
      }
      // Silently ignore any booking tool calls — state machine is the sole owner
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
      escalated: escalated
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
        // All bookings come from state machine — return to collecting_time on conflict
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

  // 7. Safety net: AI said "booked" but didn't send action → notify owner
  const bookingKeywords = ['קבעתי', 'נקבע', 'אישרתי', 'התור שלך', 'מאושר']
  const textLower = parsed.text || ''
  const aiClaimedBooking = bookingKeywords.some(kw => textLower.includes(kw))

  if (aiClaimedBooking && !parsed.action) {
    // Check if booking was already saved by the action
    const recentCheck = await supabase
      .from('appointments')
      .select('id')
      .eq('business_id', input.businessId)
      .eq('contact_id', input.contactId)
      .eq('status', 'confirmed')
      .gte('created_at', new Date(Date.now() - 30000).toISOString())
      .limit(1)

    if (!recentCheck.data || recentCheck.data.length === 0) {
      console.warn('[agent] AI claimed booking but sent no action — notifying owner')
      await supabase.from('notifications').insert({
        business_id: input.businessId,
        type: 'system',
        title: '⚠️ תור לא נשמר',
        body: `הסוכן אמר ללקוח ${input.contactName} שנקבע תור, אבל לא שלח פעולת הזמנה. בדוק ידנית.`,
        metadata: { contact_id: input.contactId, conversation_id: input.conversationId, ai_text: parsed.text },
      })
    }
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
