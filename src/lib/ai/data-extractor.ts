import { generateObject } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import type { ContactContext } from './context-builder'
import type { BookingState, ExtractedData } from '@/lib/ai/booking-state'
import { getIsraelNow, getIsraelToday, getIsraelTime, getIsraelDayOfWeek, formatDateISO } from '@/lib/utils/timezone'

const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.5-flash'

// ── Extraction Schema ────────────────────────────

const ExtractionSchema = z.object({
  intent: z.enum(['book', 'cancel', 'reschedule', 'check_availability', 'confirm', 'deny', 'provide_info', 'greeting', 'question', 'other']),
  service: z.string().nullable().describe('Service name if mentioned'),
  name: z.string().nullable().describe('Person name if mentioned'),
  gender: z.enum(['male', 'female']).nullable().describe('Detected gender from name or speech patterns'),
  date: z.string().nullable().describe('Date in YYYY-MM-DD format from lookup table'),
  time: z.string().nullable().describe('Time in HH:MM 24h format'),
  notes: z.string().nullable().describe('Any notes or comments'),
  confirmation: z.boolean().nullable().describe('true for yes/confirm, false for no/cancel'),
  for_other: z.boolean().default(false).describe('Whether booking is for someone else'),
  other_name: z.string().nullable().describe('Name of the other person if for_other'),
  other_relationship: z.string().nullable().describe('Relationship to other person'),
})

// ── Build Extraction Prompt ──────────────────────

function buildExtractionPrompt(
  businessName: string,
  services: Array<{ name: string; duration: number; price: number }>,
  bookingState: BookingState,
  contact: ContactContext,
): string {
  const knownContactName = contact.name || ''
  const contactNameIsPlaceholder = !knownContactName
    || /^\d+$/.test(knownContactName)
    || /^[\d\s]+$/.test(knownContactName)
    || knownContactName.startsWith('לקוח')
    || knownContactName.startsWith('972')
    || /^\+?\d{7,}/.test(knownContactName)

  // Build date lookup table
  const israelNow = getIsraelNow()
  const israelToday = getIsraelToday()
  const israelTime = getIsraelTime()
  const israelDayOfWeek = getIsraelDayOfWeek()
  const hebrewDayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const todayHebrew = hebrewDayNames[israelDayOfWeek]

  const dayLookup: string[] = []
  for (let i = 0; i <= 13; i++) {
    const d = new Date(israelNow)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateISO(d)
    const dayName = hebrewDayNames[d.getDay()]
    if (i === 0) {
      dayLookup.push(`*** היום = ${dateStr} (${dayName}) ← USE THIS FOR "היום" AND "${dayName}"`)
    } else if (i === 1) {
      dayLookup.push(`*** מחר = ${dateStr} (${dayName})`)
    } else {
      dayLookup.push(`${dayName} = ${dateStr} (in ${i} days)`)
    }
  }

  return `Extract information from the user's message for a booking system for "${businessName}".

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

Additional rules:
- "כן"/"בטח"/"מאשר"/"יאללה"/"סבבה" → confirmation: true
- "לא"/"ביטול" → confirmation: false
- If step is "collecting_name" and message is 1-3 words, it's probably a name
${contact.gender ? `Known gender: ${contact.gender}` : ''}`
}

// ── Validate Extracted Data ──────────────────────

function validateExtracted(extracted: ExtractedData, israelToday: string): ExtractedData {
  // Validate date
  if (extracted.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) {
      console.warn(`[agent] Invalid date format from AI: "${extracted.date}" — clearing`)
      extracted.date = undefined as unknown as string
    } else {
      const testDate = new Date(extracted.date + 'T12:00:00')
      if (isNaN(testDate.getTime())) {
        console.warn(`[agent] Invalid date from AI: "${extracted.date}" — clearing`)
        extracted.date = undefined as unknown as string
      }
      if (extracted.date && extracted.date < israelToday) {
        console.warn(`[agent] Past date from AI: "${extracted.date}" (today: ${israelToday}) — clearing`)
        extracted.date = undefined as unknown as string
      }
    }
  }

  // Validate time
  if (extracted.time) {
    if (!/^\d{2}:\d{2}$/.test(extracted.time)) {
      const timeMatch = extracted.time.match(/^(\d{1,2}):(\d{2})$/)
      if (timeMatch) {
        extracted.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      } else {
        console.warn(`[agent] Invalid time format from AI: "${extracted.time}" — clearing`)
        extracted.time = undefined as unknown as string
      }
    }
    if (extracted.time) {
      const [h, m] = extracted.time.split(':').map(Number)
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        console.warn(`[agent] Invalid time range from AI: "${extracted.time}" — clearing`)
        extracted.time = undefined as unknown as string
      } else {
        // Round to nearest 30-minute slot
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

  return extracted
}

// ── Helper: Convert conversation entries to SDK messages ──

function toSDKMessages(history: Array<{ role: 'user' | 'model'; text: string }>) {
  return history.map((entry) => ({
    role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant',
    content: entry.text,
  }))
}

// ── Extract Data From Message ────────────────────

export async function extractDataFromMessage(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'model'; text: string }>,
  businessName: string,
  services: Array<{ name: string; duration: number; price: number }>,
  bookingState: BookingState,
  contact: ContactContext,
): Promise<ExtractedData> {
  const prompt = buildExtractionPrompt(businessName, services, bookingState, contact)

  try {
    const { object: extracted } = await generateObject({
      model: openrouter(AI_MODEL),
      schema: ExtractionSchema,
      system: prompt,
      messages: [
        ...toSDKMessages(conversationHistory.slice(-6)),
        { role: 'user' as const, content: message },
      ],
      maxOutputTokens: 512,
      temperature: 0.3,
    })

    console.log(`[agent] Extracted: intent=${extracted.intent}, date=${extracted.date || '-'}, time=${extracted.time || '-'}, service=${extracted.service || '-'}, name=${extracted.name || '-'}`)

    // Map nullable fields to optional for ExtractedData compatibility
    const result: ExtractedData & Record<string, unknown> = {
      intent: extracted.intent,
      service: extracted.service || undefined,
      name: extracted.name || undefined,
      date: extracted.date || undefined,
      time: extracted.time || undefined,
      notes: extracted.notes || undefined,
      confirmation: extracted.confirmation ?? undefined,
    }

    // Pass through extra fields for agent-processor
    if (extracted.gender) result.gender = extracted.gender
    if (extracted.for_other) result.for_other = true
    if (extracted.other_name) result.other_name = extracted.other_name
    if (extracted.other_relationship) result.other_relationship = extracted.other_relationship

    return validateExtracted(result, getIsraelToday())
  } catch (err) {
    console.warn(`[agent] Structured extraction failed, falling back:`, err)
    return { intent: 'other' }
  }
}
