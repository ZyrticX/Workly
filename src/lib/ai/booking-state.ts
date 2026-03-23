import { createServiceClient } from '@/lib/supabase/service'

// ── Types ──────────────────────────────────────────

export interface BookingState {
  step: 'idle' | 'collecting_service' | 'collecting_name' | 'collecting_date' | 'collecting_time' | 'collecting_notes' | 'confirming' | 'cancelling' | 'rescheduling'
  service?: string
  serviceDuration?: number
  servicePrice?: number
  name?: string
  date?: string
  time?: string
  notes?: string
  forOther?: boolean
  otherName?: string
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

// ── State Machine ──────────────────────────────────

export function processState(
  currentState: BookingState,
  extracted: ExtractedData,
  services: ServiceDef[],
  contactName: string,
  workingHours: Record<string, unknown> | null
): { newState: BookingState; response: string; action: { type: string; params: Record<string, unknown> } | null } {
  const state = { ...currentState }
  let response = ''
  let action: { type: string; params: Record<string, unknown> } | null = null

  // ── New booking intent from idle ──
  if (state.step === 'idle' && (extracted.intent === 'book' || extracted.intent === 'check_availability')) {
    // Check if service was mentioned
    if (extracted.service) {
      const svc = findService(extracted.service, services)
      if (svc) {
        state.service = svc.name
        state.serviceDuration = svc.duration
        state.servicePrice = svc.price
      }
    }

    // Check if name is known from contact DB or message
    const hasName = contactName && !/^\d+$/.test(contactName) && contactName !== 'לקוח' && !contactName.startsWith('972')
    if (extracted.name) state.name = extracted.name
    else if (hasName) state.name = contactName // Already known from previous conversations!

    // Check if date/time provided upfront
    if (extracted.date) state.date = extracted.date
    if (extracted.time) state.time = extracted.time

    // Determine next step
    if (!state.service) {
      state.step = 'collecting_service'
      const serviceList = services.map(s => `• ${s.name} (${s.duration} דק', ${s.price} ₪)`).join('\n')
      response = `היי! איזה שירות מעניין אותך?\n${serviceList}`
    } else if (!state.name) {
      state.step = 'collecting_name'
      response = `סבבה, ${state.service}. מה השם שלך?`
    } else if (!state.date) {
      state.step = 'collecting_date'
      response = `${state.name}, איזה יום מתאים לך?`
    } else if (!state.time) {
      state.step = 'collecting_time'
      const slots = getValidSlots(state.serviceDuration || 30)
      response = `באיזו שעה?\nשעות פנויות: ${slots}`
    } else {
      state.step = 'confirming'
      response = buildConfirmation(state)
    }

    return { newState: state, response, action }
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
        response = `${svc.name}, אחלה בחירה. מה השם שלך?`
      } else if (!state.date) {
        state.step = 'collecting_date'
        response = `מעולה. איזה יום מתאים לך?`
      } else {
        state.step = 'collecting_time'
        const slots = getValidSlots(svc.duration)
        response = `באיזו שעה?\n${slots}`
      }
    } else {
      const serviceList = services.map(s => `• ${s.name}`).join('\n')
      response = `לא הבנתי איזה שירות. תבחר מהרשימה:\n${serviceList}`
    }
    return { newState: state, response, action }
  }

  // ── Collecting name ──
  if (state.step === 'collecting_name') {
    const name = extracted.name || extractNameFromText(extracted)
    if (name && name.length > 1) {
      state.name = name
      if (!state.date) {
        state.step = 'collecting_date'
        response = `נעים מאוד ${name}! איזה יום מתאים לך?`
      } else if (!state.time) {
        state.step = 'collecting_time'
        const slots = getValidSlots(state.serviceDuration || 30)
        response = `${name}, באיזו שעה? ${slots}`
      } else {
        state.step = 'confirming'
        response = buildConfirmation(state)
      }
    } else {
      response = `מה השם שלך? 😊`
    }
    return { newState: state, response, action }
  }

  // ── Collecting date ──
  if (state.step === 'collecting_date') {
    const date = extracted.date || extractDateFromText(extracted)
    if (date) {
      state.date = date
      if (!state.time) {
        state.step = 'collecting_time'
        const dayName = getDayName(date)
        const slots = getValidSlots(state.serviceDuration || 30)
        response = `יום ${dayName}, מעולה. באיזו שעה?\n${slots}`
      } else {
        state.step = 'confirming'
        response = buildConfirmation(state)
      }
    } else {
      response = `לא הצלחתי להבין את היום. תגיד למשל "יום ראשון" או "מחר" או תאריך מדויק`
    }
    return { newState: state, response, action }
  }

  // ── Collecting time ──
  if (state.step === 'collecting_time') {
    const time = extracted.time
    if (time) {
      // Validate time is a valid slot
      const duration = state.serviceDuration || 30
      const [h, m] = time.split(':').map(Number)
      const totalMin = h * 60 + m
      if (totalMin % duration !== 0) {
        const rounded = Math.round(totalMin / duration) * duration
        const rH = Math.floor(rounded / 60)
        const rM = rounded % 60
        const roundedTime = `${String(rH).padStart(2, '0')}:${String(rM).padStart(2, '0')}`
        response = `השעה ${time} לא מתאימה ל${state.service}. השעה הקרובה היא ${roundedTime}. מתאים?`
        state.time = roundedTime
        state.step = 'confirming'
        response = buildConfirmation(state)
      } else {
        state.time = time
        state.step = 'collecting_notes'
        response = `${time}, סבבה. יש הערות לתור? (אם אין, כתוב "אין")`
      }
    } else {
      const slots = getValidSlots(state.serviceDuration || 30)
      response = `באיזו שעה? ${slots}`
    }
    return { newState: state, response, action }
  }

  // ── Collecting notes ──
  if (state.step === 'collecting_notes') {
    const notes = extracted.notes
    if (notes && !['אין', 'לא', 'אין הערות', 'לא צריך'].includes(notes.trim())) {
      state.notes = notes
    }
    state.step = 'confirming'
    response = buildConfirmation(state)
    return { newState: state, response, action }
  }

  // ── Confirming ──
  if (state.step === 'confirming') {
    if (extracted.confirmation === true || extracted.intent === 'confirm') {
      // Send action but DON'T say "קבעתי" yet - let executeAction confirm
      action = {
        type: 'book_appointment',
        params: {
          service: state.service,
          date: state.date,
          time: state.time,
          contact_name: state.name,
          notes: state.notes || '',
        }
      }
      // Response will be set AFTER executeAction succeeds in processAIAgent
      response = `__BOOKING_PENDING__`
      // Keep state until we know booking succeeded
      return { newState: { ...state, step: 'idle' }, response, action }
    } else if (extracted.confirmation === false || extracted.intent === 'deny') {
      response = `אין בעיה, ביטלתי. רוצה לקבוע תור אחר?`
      return { newState: { step: 'idle' }, response, action: null }
    } else {
      response = buildConfirmation(state) + '\n\nמאשר? (כן/לא)'
      return { newState: state, response, action }
    }
  }

  // ── Cancel intent ──
  if (extracted.intent === 'cancel') {
    action = { type: 'cancel_appointment', params: {} }
    response = `בסדר, ביטלתי את התור הקרוב שלך. רוצה לקבוע תור חדש?`
    return { newState: { step: 'idle' }, response, action }
  }

  // ── Reschedule intent ──
  if (extracted.intent === 'reschedule') {
    state.step = 'collecting_date'
    state.service = state.service || undefined
    response = `בטח, לאיזה יום תרצה להזיז?`
    return { newState: { ...state, step: 'collecting_date' }, response, action: null }
  }

  // ── Default: pass to AI for general response ──
  return { newState: state, response: '', action: null }
}

// ── Helpers ──────────────────────────────────────

function findService(input: string, services: ServiceDef[]): ServiceDef | null {
  if (!input) return null
  let svc = services.find(s => s.name === input)
  if (!svc) svc = services.find(s => s.name.includes(input) || input.includes(s.name))
  if (!svc && services.length === 1) svc = services[0]
  return svc || null
}

function getValidSlots(duration: number): string {
  const slots: string[] = []
  for (let m = 0; m < 540; m += duration) { // 9 hours from 9:00
    const h = Math.floor((540 + m) / 60)
    const mm = (540 + m) % 60
    if (h >= 18) break
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }
  return slots.join(', ')
}

function buildConfirmation(state: BookingState): string {
  const dayName = state.date ? getDayName(state.date) : ''
  const dateStr = state.date ? formatDate(state.date) : ''
  return `אוקיי ${state.name}, מאשר/ת?\n📋 ${state.service}\n📅 יום ${dayName}, ${dateStr}\n🕐 ${state.time}\n${state.notes ? `📝 ${state.notes}\n` : ''}${state.servicePrice ? `💰 ${state.servicePrice} ₪` : ''}`
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

function extractNameFromText(data: ExtractedData): string | null {
  // The AI extraction should handle this, but fallback
  return data.name || null
}

function extractDateFromText(data: ExtractedData): string | null {
  return data.date || null
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
