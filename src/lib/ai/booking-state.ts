import { createServiceClient } from '@/lib/supabase/service'
import { isClosedForBusiness, isErevChag, getHolidayName, type HolidaysConfig } from '@/lib/utils/hebrew-calendar'

// ── Types ──────────────────────────────────────────

export interface BookingState {
  step: 'idle' | 'collecting_service' | 'collecting_name' | 'collecting_date' | 'collecting_time' | 'collecting_notes' | 'confirming' | 'cancelling' | 'rescheduling' | 'waitlist_offer'
  service?: string
  serviceDuration?: number
  servicePrice?: number
  name?: string
  date?: string
  time?: string
  notes?: string
  forOther?: boolean // Booking for someone else (friend, family)
  otherName?: string // Name of the other person
  otherRelationship?: string // 'mother', 'friend', 'spouse', 'child', etc.
}

export interface ExtractedData {
  intent: 'book' | 'cancel' | 'reschedule' | 'check_availability' | 'confirm' | 'deny' | 'provide_info' | 'greeting' | 'question' | 'other'
  service?: string
  name?: string
  date?: string
  time?: string
  notes?: string
  confirmation?: boolean
}

interface ServiceDef {
  name: string
  duration: number
  price: number
}

// Return type: instead of hardcoded response text, return AI instructions
interface StateResult {
  newState: BookingState
  aiInstruction: string // Tell the AI what to say (natural language instruction)
  action: { type: string; params: Record<string, unknown> } | null
  availableSlots?: string[] // For time selection
  skipAI?: boolean // If true, use aiInstruction as literal response (for confirmations only)
}

// ── State Machine ──────────────────────────────────

export function processState(
  currentState: BookingState,
  extracted: ExtractedData,
  services: ServiceDef[],
  contactName: string,
  workingHours: Record<string, unknown> | null,
  holidaysConfig?: HolidaysConfig | null
): StateResult {
  const state = { ...currentState }
  let aiInstruction = ''
  let action: { type: string; params: Record<string, unknown> } | null = null
  let availableSlots: string[] | undefined
  let skipAI = false

  // ── New booking intent from idle ──
  if (state.step === 'idle' && (extracted.intent === 'book' || extracted.intent === 'check_availability')) {
    if (extracted.service) {
      const svc = findService(extracted.service, services)
      if (svc) {
        state.service = svc.name
        state.serviceDuration = svc.duration
        state.servicePrice = svc.price
      }
    }

    // Use known name from DB — but only if it's a real name, not a placeholder
    const isPlaceholderName = !contactName
      || /^\d+$/.test(contactName)
      || /^[\d\s]+$/.test(contactName)
      || contactName.startsWith('לקוח')
      || contactName.startsWith('972')
      || /^\+?\d{7,}/.test(contactName)
    const hasName = contactName && !isPlaceholderName
    if (extracted.name) state.name = extracted.name
    else if (hasName) state.name = contactName

    if (extracted.date) state.date = extracted.date
    if (extracted.time) state.time = extracted.time

    // Check if booking for someone else
    const extractedAny = extracted as unknown as Record<string, unknown>
    if (extractedAny.for_other) {
      state.forOther = true
      if (extractedAny.other_name) state.otherName = extractedAny.other_name as string
      if (extractedAny.other_relationship) state.otherRelationship = extractedAny.other_relationship as string
    }

    // Determine next step
    if (!state.service) {
      state.step = 'collecting_service'
      const serviceList = services.map(s => `${s.name} (${s.duration} דקות, ${s.price} ₪)`).join(', ')
      aiInstruction = `הלקוח רוצה לקבוע תור. שאל אותו בחמימות איזה שירות מעניין אותו. השירותים שלנו: ${serviceList}. אל תציג כרשימה יבשה - שאל בצורה שיחתית.`
    } else if (state.forOther && !state.otherName) {
      state.step = 'collecting_name'
      aiInstruction = `הלקוח רוצה לקבוע ${state.service} למישהו אחר${state.otherRelationship ? ` (${state.otherRelationship})` : ''}. שאל מה השם של האדם שמגיע לתור.`
    } else if (!state.name && !state.forOther) {
      state.step = 'collecting_name'
      aiInstruction = `הלקוח רוצה ${state.service}. שאל אותו מה שמו בצורה חמה וידידותית. אם זה לקוח חוזר אמור לו שאתה שמח שחזר.`
    } else if (!state.date) {
      state.step = 'collecting_date'
      aiInstruction = `שלום ${state.name}! הוא רוצה ${state.service}. שאל אותו בצורה טבעית איזה יום מתאים לו. אפשר להציע "השבוע?" או "מתי נוח לך?"`
    } else if (!state.time) {
      state.step = 'collecting_time'
      availableSlots = getValidSlots(state.serviceDuration || 30, workingHours, state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined, state.date)
      const dayName = getDayName(state.date!)
      aiInstruction = `${state.name} רוצה ${state.service} ביום ${dayName}. שאל אותו באיזו שעה נוח לו. השעות הפנויות: ${availableSlots.join(', ')}. הצע 2-3 שעות מומלצות, אל תזרוק את כל הרשימה.`
    } else {
      state.step = 'confirming'
      aiInstruction = buildConfirmationInstruction(state)
    }

    return { newState: state, aiInstruction, action, availableSlots }
  }

  // ── Collecting service ──
  if (state.step === 'collecting_service') {
    const svc = findService(extracted.service || '', services)
    if (svc) {
      state.service = svc.name
      state.serviceDuration = svc.duration
      state.servicePrice = svc.price

      if (!state.name) {
        state.step = 'collecting_name'
        aiInstruction = `הלקוח בחר ${svc.name}, אחלה בחירה! שאל אותו מה שמו.`
      } else if (!state.date) {
        state.step = 'collecting_date'
        aiInstruction = `${state.name} בחר ${svc.name}. שאל אותו איזה יום מתאים לו.`
      } else {
        state.step = 'collecting_time'
        availableSlots = getValidSlots(svc.duration, workingHours, state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined, state.date)
        aiInstruction = `${state.name} רוצה ${svc.name}. שאל אותו באיזו שעה. שעות פנויות: ${availableSlots.slice(0, 5).join(', ')}...`
      }
    } else {
      const serviceList = services.map(s => s.name).join(', ')
      aiInstruction = `לא הבנתי איזה שירות הלקוח רוצה. תשאל אותו שוב בעדינות, בלי לגרום לו להרגיש רע. השירותים: ${serviceList}`
    }
    return { newState: state, aiInstruction, action, availableSlots }
  }

  // ── Collecting name ──
  if (state.step === 'collecting_name') {
    const name = extracted.name
    if (name && name.length > 1) {
      // If booking for other, store as otherName
      if (state.forOther && !state.otherName) {
        state.otherName = name
        state.name = state.name || contactName // Keep original customer name
      } else {
        state.name = name
      }
      const displayName = state.forOther ? state.otherName : state.name
      if (!state.date) {
        state.step = 'collecting_date'
        aiInstruction = state.forOther
          ? `אחלה! אז תור ל${displayName}. איזה יום מתאים?`
          : `נעים מאוד ${displayName}! עכשיו שאל אותו איזה יום מתאים לו ל${state.service}. תהיה חם וידידותי.`
      } else if (!state.time) {
        state.step = 'collecting_time'
        availableSlots = getValidSlots(state.serviceDuration || 30, workingHours, state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined, state.date)
        aiInstruction = `${name} רוצה ${state.service}. שאל באיזו שעה. שעות: ${availableSlots.slice(0, 5).join(', ')}...`
      } else {
        state.step = 'confirming'
        aiInstruction = buildConfirmationInstruction(state)
      }
    } else {
      aiInstruction = `לא הצלחתי להבין את השם. שאל שוב בצורה ידידותית, למשל "איך קוראים לך?" או "מה השם שאני רושם?"`
    }
    return { newState: state, aiInstruction, action, availableSlots }
  }

  // ── Collecting date ──
  if (state.step === 'collecting_date') {
    const date = extracted.date
    if (date) {
      // Check if it's a Jewish holiday (business-specific config)
      if (isClosedForBusiness(date, holidaysConfig)) {
        const holidayName = getHolidayName(date) || 'חג'
        aiInstruction = `הלקוח ביקש תור ביום ${getDayName(date)} (${formatDate(date)}) אבל זה ${holidayName} — אנחנו סגורים. אמור לו בחמימות ושאל אם רוצה יום אחר.`
        return { newState: state, aiInstruction, action }
      }
      // Check if it's erev chag (early closing)
      if (isErevChag(date)) {
        const holidayName = getHolidayName(date) || 'ערב חג'
        // Continue but note early closing
        aiInstruction += ` (שים לב: ${holidayName} — סגירה מוקדמת)`
      }
      state.date = date
      if (!state.time) {
        state.step = 'collecting_time'
        const dayName = getDayName(date)
        availableSlots = getValidSlots(state.serviceDuration || 30, workingHours, state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined, state.date)
        aiInstruction = `${state.name} בחר יום ${dayName}. שאל אותו באיזו שעה נוח לו. הצע 2-3 שעות מתוך: ${availableSlots.slice(0, 6).join(', ')}. תהיה טבעי.`
      } else {
        state.step = 'confirming'
        aiInstruction = buildConfirmationInstruction(state)
      }
    } else {
      aiInstruction = `לא הצלחתי להבין את היום. שאל שוב בצורה טבעית, למשל "איזה יום היה נוח לך? אפשר להגיד מחר, יום ראשון, או תאריך מדויק"`
    }
    return { newState: state, aiInstruction, action, availableSlots }
  }

  // ── Collecting time ──
  if (state.step === 'collecting_time') {
    const time = extracted.time
    if (time) {
      const duration = state.serviceDuration || 30
      const [h, m] = time.split(':').map(Number)
      const totalMin = h * 60 + m

      // Validate against real working hours (not hardcoded)
      const dayIdx = state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined
      const validSlots = getValidSlots(duration, workingHours, dayIdx, state.date)
      if (validSlots.length === 0) {
        aiInstruction = `הלקוח ביקש שעה ${time} אבל אנחנו סגורים ביום הזה. אמור לו בעדינות ושאל אם רוצה יום אחר.`
        state.date = undefined
        state.step = 'collecting_date'
        return { newState: state, aiInstruction, action }
      }
      if (!validSlots.includes(time)) {
        availableSlots = validSlots
        const closest = validSlots.reduce((prev, curr) => {
          const prevDiff = Math.abs(prev.split(':').reduce((h2, m2) => Number(h2) * 60 + Number(m2), 0) - totalMin)
          const currDiff = Math.abs(curr.split(':').reduce((h2, m2) => Number(h2) * 60 + Number(m2), 0) - totalMin)
          return currDiff < prevDiff ? curr : prev
        })
        aiInstruction = `הלקוח ביקש ${time} אבל זה לא מתאים. הצע בעדינות שעות קרובות: ${closest} או ${validSlots.slice(0, 4).join(', ')}`
        return { newState: state, aiInstruction, action, availableSlots }
      }

      // Round to valid slot
      const rounded = Math.round(totalMin / duration) * duration
      const rH = Math.floor(rounded / 60)
      const rM = rounded % 60
      const validTime = `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`

      state.time = validTime
      state.step = 'collecting_notes'
      aiInstruction = `${state.name} בחר שעה ${validTime} ל${state.service}. שאל אותו אם יש משהו שחשוב שנדע לפני התור, הערות מיוחדות, או שאפשר להמשיך. תהיה קל.`
    } else {
      availableSlots = getValidSlots(state.serviceDuration || 30, workingHours, state.date ? new Date(state.date + 'T12:00:00').getDay() : undefined, state.date)
      aiInstruction = `לא הצלחתי להבין את השעה. שאל שוב, הצע 2-3 שעות מתוך: ${availableSlots.slice(0, 5).join(', ')}`
    }
    return { newState: state, aiInstruction, action, availableSlots }
  }

  // ── Collecting notes ──
  if (state.step === 'collecting_notes') {
    if (extracted.notes && !['אין', 'לא', 'אין הערות', 'לא צריך', 'הכל טוב', 'בסדר'].includes(extracted.notes.trim())) {
      state.notes = extracted.notes
    }
    state.step = 'confirming'
    aiInstruction = buildConfirmationInstruction(state)
    return { newState: state, aiInstruction, action }
  }

  // ── Confirming ──
  if (state.step === 'confirming') {
    if (extracted.confirmation === true || extracted.intent === 'confirm') {
      const bookingName = state.forOther ? state.otherName : state.name
      action = {
        type: 'book_appointment',
        params: {
          service: state.service,
          date: state.date,
          time: state.time,
          contact_name: bookingName,
          notes: state.notes || '',
          for_other: state.forOther || false,
          other_relationship: state.otherRelationship || null,
          booked_by_contact_name: state.forOther ? state.name : null,
        }
      }
      skipAI = true
      const confirmName = bookingName || state.name || contactName || ''
      const confirmDate = state.date || ''
      const confirmTime = state.time || ''
      const confirmService = state.service || ''
      const dayName = confirmDate ? getDayName(confirmDate) : ''
      const dateStr = confirmDate ? formatDate(confirmDate) : ''
      aiInstruction = `מעולה ${confirmName}! קבעתי לך ${confirmService} ליום ${dayName} (${dateStr}) בשעה ${confirmTime}. אם תצטרך לשנות משהו - פשוט תכתוב לי 🙏`
      return { newState: { step: 'idle' }, aiInstruction, action, skipAI }
    } else if (extracted.confirmation === false || extracted.intent === 'deny') {
      aiInstruction = `הלקוח לא רוצה את התור הזה. אמור לו שאין בעיה, ושאל אם הוא רוצה לקבוע בזמן אחר. תהיה נחמד ולא לוחץ.`
      return { newState: { step: 'idle' }, aiInstruction, action: null }
    } else {
      aiInstruction = buildConfirmationInstruction(state) + ' הלקוח לא אישר עדיין, שאל שוב בעדינות אם מאשר.'
      return { newState: state, aiInstruction, action }
    }
  }

  // ── Waitlist offer ──
  if (state.step === 'waitlist_offer') {
    if (extracted.confirmation === true || extracted.intent === 'confirm') {
      action = {
        type: 'add_to_waitlist',
        params: {
          date: state.date,
          service: state.service,
          contact_name: state.name,
        }
      }
      skipAI = true
      aiInstruction = `אין בעיה ${state.name}! הוספתי אותך לרשימת ההמתנה ל${state.service} ביום ${getDayName(state.date!)}. ברגע שיתפנה מקום - נודיע לך מיד 🙏`
      return { newState: { step: 'idle' }, aiInstruction, action, skipAI }
    } else if (extracted.confirmation === false || extracted.intent === 'deny') {
      state.date = undefined
      state.step = 'collecting_date'
      aiInstruction = `בסדר, אין בעיה. רוצה לנסות יום אחר?`
      return { newState: state, aiInstruction, action: null }
    } else {
      aiInstruction = `אין תורים פנויים ביום הזה. רוצה שאוסיף אותך לרשימת ההמתנה? ברגע שיתפנה מקום נודיע לך.`
      return { newState: state, aiInstruction, action: null }
    }
  }

  // ── Cancel intent ──
  if (extracted.intent === 'cancel') {
    action = { type: 'cancel_appointment', params: {} }
    aiInstruction = `הלקוח רוצה לבטל תור. אמור לו שביטלת ושאל אם רוצה לקבוע תור חדש.`
    return { newState: { step: 'idle' }, aiInstruction, action }
  }

  // ── Reschedule intent ──
  if (extracted.intent === 'reschedule') {
    aiInstruction = `הלקוח רוצה להזיז תור. שאל אותו לאיזה יום חדש הוא רוצה.`
    return { newState: { ...state, step: 'collecting_date' }, aiInstruction, action: null }
  }

  // ── Default: let AI handle freely ──
  return { newState: state, aiInstruction: '', action: null }
}

// ── Helpers ──────────────────────────────────────

function findService(input: string, services: ServiceDef[]): ServiceDef | null {
  if (!input) return null
  const lower = input.trim()
  let svc = services.find(s => s.name === lower)
  if (!svc) svc = services.find(s => s.name.includes(lower) || lower.includes(s.name))
  // Fuzzy: check if any word matches
  if (!svc) {
    const words = lower.split(/\s+/)
    svc = services.find(s => words.some(w => w.length > 2 && s.name.includes(w)))
  }
  if (!svc && services.length === 1) svc = services[0]
  return svc || null
}

export function getValidSlots(
  duration: number,
  workingHours?: Record<string, unknown> | null,
  dayOfWeek?: number,
  dateStr?: string // YYYY-MM-DD — if today, filter past times
): string[] {
  // Read real working hours from business settings
  let startMin = 9 * 60 // fallback 09:00
  let endMin = 18 * 60  // fallback 18:00
  let breaks: Array<{ start: string; end: string }> = []

  if (workingHours && dayOfWeek !== undefined) {
    const dayKey = String(dayOfWeek)
    const dayConfig = workingHours[dayKey] as { active?: boolean; start?: string; end?: string; breaks?: Array<{ start: string; end: string }> } | undefined

    if (dayConfig) {
      if (!dayConfig.active) return [] // Day is closed

      if (dayConfig.start) {
        const [h, m] = dayConfig.start.split(':').map(Number)
        startMin = h * 60 + (m || 0)
      }
      if (dayConfig.end) {
        const [h, m] = dayConfig.end.split(':').map(Number)
        endMin = h * 60 + (m || 0)
      }
      if (dayConfig.breaks) {
        breaks = dayConfig.breaks
      }
    }
  }

  // If date is today, only show future slots (+ 30 min buffer)
  let minTimeMin = 0
  if (dateStr) {
    const now = new Date()
    const todayISR = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    if (dateStr === todayISR) {
      const nowISR = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
      minTimeMin = nowISR.getHours() * 60 + nowISR.getMinutes() + 30 // 30 min buffer
    }
  }

  const slots: string[] = []
  for (let m = startMin; m + duration <= endMin; m += duration) {
    // Skip past times for today
    if (m < minTimeMin) continue

    const h = Math.floor(m / 60)
    const mm = m % 60
    const slotTime = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    const slotEnd = m + duration

    // Check if slot overlaps with any break
    let duringBreak = false
    for (const brk of breaks) {
      const [bh, bm] = brk.start.split(':').map(Number)
      const [eh, em] = brk.end.split(':').map(Number)
      const breakStart = bh * 60 + (bm || 0)
      const breakEnd = eh * 60 + (em || 0)
      if (m < breakEnd && slotEnd > breakStart) {
        duringBreak = true
        break
      }
    }

    if (!duringBreak) {
      slots.push(slotTime)
    }
  }
  return slots
}

// ── Filter slots by actual DB availability ──────────

export async function filterBookedSlots(
  businessId: string,
  date: string,
  theoreticalSlots: string[],
  duration: number
): Promise<string[]> {
  const supabase = createServiceClient()

  // Get all booked appointments for that date
  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const { data: booked } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .in('status', ['confirmed', 'pending'])
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)

  if (!booked || booked.length === 0) return theoreticalSlots

  // Filter out slots that overlap with existing appointments
  return theoreticalSlots.filter(slot => {
    const [h, m] = slot.split(':').map(Number)
    const slotStart = h * 60 + m
    const slotEnd = slotStart + duration

    for (const apt of booked) {
      const aptStart = parseInt((apt.start_time as string).substring(11, 13)) * 60 +
                       parseInt((apt.start_time as string).substring(14, 16))
      const aptEnd = parseInt((apt.end_time as string).substring(11, 13)) * 60 +
                     parseInt((apt.end_time as string).substring(14, 16))

      if (slotStart < aptEnd && slotEnd > aptStart) {
        return false // Overlaps — not available
      }
    }
    return true
  })
}

function buildConfirmationInstruction(state: BookingState): string {
  const dayName = state.date ? getDayName(state.date) : ''
  const dateStr = state.date ? formatDate(state.date) : ''
  const bookingName = state.forOther ? state.otherName : state.name
  const forOtherNote = state.forOther ? ` (תור עבור ${state.otherRelationship || 'אדם אחר'} — ${state.otherName})` : ''
  return `סכם את התור ובקש אישור. הפרטים: שם: ${bookingName}${forOtherNote}, שירות: ${state.service}, יום ${dayName} ${dateStr}, שעה: ${state.time}${state.servicePrice ? `, מחיר: ${state.servicePrice} ₪` : ''}${state.notes ? `, הערות: ${state.notes}` : ''}. שאל "מאשר?"`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function getDayName(dateStr: string): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const d = new Date(dateStr + 'T12:00:00')
  return days[d.getDay()] || ''
}

// ── Check real availability in DB ──────────────────

export async function checkAvailability(
  businessId: string,
  date: string,
  time: string,
  duration: number
): Promise<{ available: boolean; conflicts: string[] }> {
  const supabase = createServiceClient()

  // Naive timestamps — no timezone suffix. All times are Israel local.
  const startTime = `${date}T${time}:00`
  const endMinutes = time.split(':').map(Number).reduce((h, m) => h * 60 + m, 0) + duration
  const endH = Math.floor(endMinutes / 60)
  const endM = endMinutes % 60
  const endTime = `${date}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`

  const { data: existing } = await supabase
    .from('appointments')
    .select('id, start_time, contact_name, service_type')
    .eq('business_id', businessId)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', endTime)
    .gt('end_time', startTime)

  if (existing && existing.length > 0) {
    return {
      available: false,
      conflicts: existing.map(a => {
        const t = (a.start_time as string).substring(11, 16) // Extract HH:MM from naive timestamp
        return `${a.contact_name} - ${a.service_type} בשעה ${t}`
      })
    }
  }

  return { available: true, conflicts: [] }
}

// ── Load/Save State ──────────────────────────────

export async function loadBookingState(conversationId: string): Promise<BookingState> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('conversations')
    .select('booking_state')
    .eq('id', conversationId)
    .single()

  return (data?.booking_state as BookingState) || { step: 'idle' }
}

export async function saveBookingState(conversationId: string, state: BookingState): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('conversations')
    .update({ booking_state: state })
    .eq('id', conversationId)
}
