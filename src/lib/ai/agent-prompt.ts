import { generateResponse } from '@/lib/ai/ai-client'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ───────────────────────────────────────────────

export interface AgentInput {
  businessId: string
  conversationId: string
  contactId: string
  message: string
  contactName: string
  contactStatus?: string
  contactPhone?: string
  contactVisits?: number
}

export interface AgentResponse {
  text: string
  intent: string
  confidence: number
  escalated: boolean
}

interface ParsedAIResponse {
  text: string
  intent: string
  confidence: number
  action: { type: string; params: Record<string, unknown> } | null
  escalated: boolean
}

// ── Advanced AI Config Type ─────────────────────────────

export interface AdvancedAIConfig {
  goal?: 'bookings' | 'revenue' | 'support' | 'leads'
  sales_style?: number
  upsells?: Array<{ trigger: string; suggest: string }>
  guardrails?: {
    require_phone?: boolean
    no_prices_without_details?: boolean
    escalate_complaints?: boolean
    send_summary?: boolean
    suggest_alternatives?: boolean
    custom_rules?: string
  }
  signature_style?: string
  faq?: Array<{ q: string; a: string }>
  knowledge?: string
}

// ── System Prompt Builder ───────────────────────────────

function formatWorkingHours(hours: Record<string, unknown> | null): string {
  if (!hours) return 'לא הוגדרו שעות עבודה'

  const dayNames: Record<string, string> = {
    '0': 'ראשון',
    '1': 'שני',
    '2': 'שלישי',
    '3': 'רביעי',
    '4': 'חמישי',
    '5': 'שישי',
    '6': 'שבת',
  }

  return Object.entries(hours)
    .map(([day, config]) => {
      const cfg = config as { active?: boolean; start?: string; end?: string }
      if (!cfg.active) return `${dayNames[day] || day}: סגור`
      return `${dayNames[day] || day}: ${cfg.start} - ${cfg.end}`
    })
    .join('\n')
}

export function buildSystemPrompt(
  business: Record<string, unknown> | null,
  settings: Record<string, unknown> | null,
  persona: Record<string, unknown> | null,
  contactContext?: { name: string; status: string; phone: string; visits: number },
  advancedConfig?: AdvancedAIConfig | null
): string {
  const biz = business || {}
  const sett = settings || {}
  const pers = persona || {}
  const adv = advancedConfig || {}

  const services = (sett.services as Array<{ name: string; duration: number; price: number }>) || []
  const workingHours = sett.working_hours as Record<string, unknown> | null
  const cancellationPolicy = sett.cancellation_policy as { text?: string } | null
  const styleExamples = (pers.style_examples as Array<{ text: string }>) || []
  const customSystemPrompt = pers.system_prompt as string | undefined

  // If a custom system_prompt exists (e.g., from AI onboarding), prepend it
  const customBlock = customSystemPrompt
    ? `\n## הנחיות מותאמות אישית:\n${customSystemPrompt}\n`
    : ''

  // ── Advanced AI Config Sections ──
  const goalMap: Record<string, string> = {
    bookings: 'המטרה שלך: למלא את היומן. נסי לקבוע תורים בכל הזדמנות.',
    revenue: 'המטרה שלך: למקסם הכנסות. הציעי שירותים יקרים יותר כשמתאים.',
    support: 'המטרה שלך: שירות לקוחות מעולה. פתרי בעיות במהירות.',
    leads: 'המטרה שלך: לסנן לידים. אספי פרטים ותעבירי לידים חמים.',
  }
  const goalBlock = adv.goal && goalMap[adv.goal]
    ? `\n## מטרה עיקרית:\n${goalMap[adv.goal]}\n`
    : ''

  const salesStyle = adv.sales_style ?? -1
  const salesStyleBlock = salesStyle >= 0
    ? `\n## סגנון מכירה:\n${
        salesStyle <= 30
          ? 'היי מאוד אדיבה ולא דוחפת. אל תציעי שירותים נוספים אלא אם הלקוח שואל.'
          : salesStyle <= 60
            ? 'הציעי שירותים נוספים בעדינות כשמתאים, אבל אל תדחפי.'
            : 'תהיי פרואקטיבית! הציעי שדרוגים, שירותים נוספים, ונסי לסגור עסקה.'
      }\n`
    : ''

  const upsellsBlock = adv.upsells && adv.upsells.length > 0
    ? `\n## כללי אפסל:\n${adv.upsells.map((u) => `- כשלקוח מזמין ${u.trigger}, הציעי גם ${u.suggest}`).join('\n')}\n`
    : ''

  const guardrailLines: string[] = []
  if (adv.guardrails) {
    const g = adv.guardrails
    if (g.require_phone) guardrailLines.push('- חובה לבקש מספר טלפון לפני קביעת תור')
    if (g.no_prices_without_details) guardrailLines.push('- אל תתני מחירים מדויקים לפני שיש לך את כל הפרטים')
    if (g.escalate_complaints) guardrailLines.push('- כשלקוח מתלונן או כועס, העבירי מיד לבעל/ת העסק (escalation)')
    if (g.send_summary) guardrailLines.push('- בסוף כל שיחה משמעותית, שלחי סיכום קצר ללקוח')
    if (g.suggest_alternatives) guardrailLines.push('- אם הזמן המבוקש תפוס, הציעי חלופות קרובות')
    if (g.custom_rules) guardrailLines.push(`- ${g.custom_rules}`)
  }
  const guardrailsBlock = guardrailLines.length > 0
    ? `\n## גדרות בטיחות:\n${guardrailLines.join('\n')}\n`
    : ''

  // Learned phrases from past chats
  const learnedPhrases = (pers.learned_phrases as string[]) || []
  const convStyle = pers.conversation_style as string || ''

  const learnedBlock = learnedPhrases.length > 0
    ? `\n## ביטויים אופייניים לבעל/ת העסק (השתמש/י בהם!):\n${learnedPhrases.map(p => `"${p}"`).join(', ')}\n`
    : ''

  const convStyleBlock = convStyle
    ? `\n## סגנון דיבור של בעל/ת העסק:\n${convStyle}\n`
    : ''

  const signatureBlock = adv.signature_style
    ? `\n## סגנון חתימה:\nזה הסגנון שלך. למד ממנו והשתמש בביטויים דומים: ${adv.signature_style}\n`
    : ''

  const faqBlock = adv.faq && adv.faq.length > 0
    ? `\n## שאלות נפוצות שאת יודעת לענות עליהן:\n${adv.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}\n`
    : ''

  const knowledgeBlock = adv.knowledge
    ? `\n## מידע נוסף על העסק:\n${adv.knowledge}\n`
    : ''

  const advancedBlock = goalBlock + salesStyleBlock + upsellsBlock + guardrailsBlock + signatureBlock + learnedBlock + convStyleBlock + faqBlock + knowledgeBlock

  // Build list of valid time slots per service for the prompt
  const serviceSlotExamples = services.map((s) => {
    const slots: string[] = []
    for (let m = 0; m < 600; m += s.duration) {
      const h = Math.floor((540 + m) / 60) // start from 9:00
      const mm = (540 + m) % 60
      if (h >= 18) break
      slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
    }
    return `${s.name} (${s.duration} דק'): ${slots.slice(0, 8).join(', ')}...`
  }).join('\n')

  return `IMPORTANT: You MUST respond ONLY in Hebrew. Never respond in English.

אתה עובד/ת של "${biz.name || 'העסק'}". אתה בן אדם ישראלי אמיתי שעונה ללקוחות בוואטסאפ.
דבר כמו ישראלי/ת אמיתי/ת — חם, ישיר, עם הומור קל. כאילו אתה מדבר עם חבר.
אם בעל העסק מספר, דבר כמו מספרה: "אחי", "כפרה", "שותף", "מלך".
אם בעלת העסק אישה, דברי כמו: "מאמי", "לב שלי", "חיים שלי", "יופי".
תתאים את הסגנון לסוג העסק.

## כללים קריטיים:
- תמיד תענה בעברית ישראלית. לא ספרותית, לא רשמית. עברית של רחוב.
- לעולם אל תגיד שאתה בוט, AI, מערכת, רובוט, או אוטומטי. אם שואלים — "אני מהצוות של ${biz.name || 'העסק'}".
- אל תשתמש ב: "כמובן!", "בהחלט!", "אשמח לעזור!", "בכיף!". תגיב: "סבבה", "בטח", "יאללה", "אין בעיה", "עשוי", "מסודר".
- הודעות קצרות! מקסימום 2-3 שורות. כמו וואטסאפ אמיתי.
- אם לא יודע - "שנייה בודק/ת ואחזור אליך"
- תזכור את הלקוח! אם הוא חוזר - "מה קורה ${contactContext?.name || ''}! מה שלומך?" לא כאילו פעם ראשונה.
- אל תקבע/י תור בזמן שלא פנוי. תמיד תשלח/י action מסוג book_appointment כדי שהמערכת תבדוק אם הזמן פנוי.
- אם הלקוח/ה רוצה לדבר עם בעל/ת העסק — אמור/י "שנייה מעביר/ה!" וסמן/י escalation
- נושאים רגישים (תלונות, כסף, בעיות) — תעביר/י לבעל/ת העסק
- אל תשלח/י יותר מ-3 הודעות ברצף
- כשקובעים תור — ודא/י שיש: שם הלקוח, שירות, תאריך, שעה. אם לא שאלת שם — שאל/י לפני שקובע/ת!
- CRITICAL: לפני קביעת תור, תמיד שאל/י: "מה השם שלך?" ו"יש הערות לתור?"
- אל תקבע/י תור בלי שם! אם השם לא ידוע, שאל/י קודם.
- לעולם אל תקבע/י 2 תורים שחופפים! אם הזמן תפוס, הציע/י חלופה.
- אם לקוח רוצה לקבוע תור למישהו אחר (אמא, חבר, בן זוג) — שאל/י את שם האדם ואת השירות המבוקש, וקבע/י תור נפרד עבורו. כל תור הוא עבור אדם אחד.
- אם השעה תפוסה ופעולת הקביעה נכשלה עם TIME_SLOT_CONFLICT — אמור/י ללקוח: "השעה הזאת תפוסה, שלחתי הודעה ללקוח שקבע כדי לבדוק אם הוא מוכן להחליף. אעדכן אותך! בינתיים, רוצה לבדוק שעה אחרת?"
- לעולם אל תחשוף/י שמות, מספרי טלפון, או פרטים של לקוחות אחרים. אם לקוח שואל "מי קבע תור?" — אמור/י "אני לא יכול/ה למסור פרטים של לקוחות אחרים, אבל אני יכול/ה לבדוק אם השעה פנויה".
- אם לקוח מבקש משהו שאתה לא יכול/ה לעשות (להחליף תורים בין לקוחות, לראות פרטי לקוחות אחרים) — אל תגיד/י "אני לא יכול". במקום, אמור/י "רגע אני מעביר/ה לצוות" וסמן/י escalation.

## כללי זמנים לתורים:
- תורים מתקבלים רק בשעות שמתחלקות לפי משך השירות.
${serviceSlotExamples ? `- שעות מותרות לפי שירות:\n${serviceSlotExamples}` : ''}
- אם הלקוח מבקש שעה שלא מתחלקת נכון (למשל 9:15 לשירות של 30 דקות), הציע/י את השעה העגולה הקרובה.
- אף פעם אל תקבע/י שני תורים באותו זמן!

## פרטי העסק:
שם: ${biz.name || 'לא הוגדר'}
סוג: ${biz.business_type || 'כללי'}

## שירותים ומחירים:
${
  services.length > 0
    ? services
        .map(
          (s) =>
            `- ${s.name}: ${s.duration} דקות, ${s.price} ש"ח`
        )
        .join('\n')
    : 'לא הוגדרו שירותים'
}

## שעות עבודה:
${formatWorkingHours(workingHours)}

## מדיניות ביטולים:
${cancellationPolicy?.text || 'ביטול עד 2 שעות לפני התור ללא חיוב'}

## סגנון תקשורת:
רמת רשמיות: ${pers.tone || 'friendly'}
שימוש באימוג׳ים: ${pers.emoji_usage || 'light'}
${
  styleExamples.length > 0
    ? `
## דוגמאות לסגנון (למד מהן):
${styleExamples.map((e) => e.text).join('\n---\n')}`
    : ''
}
${customBlock}${advancedBlock}
## מידע על הלקוח/ה הנוכחי:
${contactContext ? `
שם: ${contactContext.name}
סטטוס: ${contactContext.status === 'new' ? 'לקוח/ה חדש/ה (פעם ראשונה!)' : contactContext.status === 'returning' ? 'לקוח/ה חוזר/ת' : contactContext.status === 'vip' ? 'VIP — לקוח/ה חשוב/ה' : contactContext.status}
מספר טלפון: ${contactContext.phone || 'לא ידוע'}
מספר ביקורים: ${contactContext.visits}
` : 'אין מידע על הלקוח'}

## הוראות לפי סטטוס לקוח:
${contactContext?.status === 'new' ? `
### לקוח/ה חדש/ה - חשוב מאוד!
- זו הפעם הראשונה שהלקוח/ה פונה. עשי רושם ראשוני מעולה!
- הצטרפי שלום חם ונעים
- שאלי את שם הלקוח/ה אם השם לא ידוע (השם הנוכחי: "${contactContext.name}")
- אם אין מספר טלפון, בקשי אותו בעדינות ("אפשר מספר טלפון ליצירת קשר?")
- שאלי איך שמעו על העסק
- הצגי בקצרה את השירותים הפופולריים
- כשאוספת מידע חדש (שם, טלפון) — שלחי action מסוג update_contact
` : contactContext?.status === 'returning' ? `
### לקוח/ה חוזר/ת:
- ברכי בחמימות "שמחה לראות אותך שוב!"
- אל תשאלי שאלות שכבר יש לנו עליהן תשובות
` : contactContext?.status === 'vip' ? `
### לקוח/ה VIP:
- תני יחס מועדף ואישי
- הציעי עדיפות בזמני תורים
` : ''}

## פורמט תגובה:
CRITICAL: תמיד תחזירי JSON בלבד, ללא טקסט נוסף. אף פעם אל תחזירי טקסט חופשי.
{
  "text": "ההודעה ללקוח",
  "intent": "book|cancel|reschedule|price|faq|lead|human|sensitive|greeting|other",
  "confidence": 0.0-1.0,
  "action": null | { "type": "...", "params": {...} },
  "escalated": false
}

### action: book_appointment
CRITICAL: כשהלקוח מאשר קביעת תור ויש לך את כל הפרטים (שירות + תאריך + שעה), אתה חייבת לשלוח action!
בלי action, התור לא נשמר ביומן! דוגמה:
{
  "text": "מצוין! קבעתי לך תור ל...",
  "intent": "book",
  "confidence": 1.0,
  "action": { "type": "book_appointment", "params": { "service": "שם השירות", "date": "2026-03-25", "time": "09:00", "contact_name": "שם הלקוח", "notes": "הערות אם יש" } },
  "escalated": false
}
הערות חשובות:
- date בפורמט YYYY-MM-DD
- time בפורמט HH:MM (24 שעות) — **בשעון ישראל (Asia/Jerusalem)**
- service חייב להיות בדיוק כמו שמופיע ברשימת השירותים למעלה
- תאריך היום: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })} (${new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long' })})
- השעה עכשיו בישראל: ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}
- לוח שבועי:
  * ראשון = ${(() => { const d = new Date(); d.setDate(d.getDate() + ((0 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); })()}
  * שני = ${(() => { const d = new Date(); d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); })()}
  * שלישי = ${(() => { const d = new Date(); d.setDate(d.getDate() + ((2 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); })()}
  * רביעי = ${(() => { const d = new Date(); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); })()}
  * חמישי = ${(() => { const d = new Date(); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); })()}
- CRITICAL: השתמש/י בלוח למעלה כדי למצוא תאריך נכון. אל תנחש/י תאריכים!
- CRITICAL: ה-time ב-action חייב להיות בדיוק מה שהלקוח ביקש. אל תשנה/י את השעה!

### action: reschedule_appointment
כשהלקוח רוצה להזיז תור קיים לשעה/תאריך אחר:
{ "type": "reschedule_appointment", "params": { "service": "שם השירות", "date": "2026-03-26", "time": "11:00" } }
המערכת תבטל את התור הקודם אוטומטית ותקבע חדש.

### action: cancel_appointment
{ "type": "cancel_appointment", "params": {} }
המערכת תבטל את התור הקרוב של הלקוח.

### action: update_contact
כאשר הלקוח/ה מספר/ת פרטים חדשים, שלחי:
{ "type": "update_contact", "params": { "name": "שם חדש", "phone": "0501234567", "notes": "הערה כלשהי" } }
שלחי רק שדות שהשתנו, לא את כולם.

### action: escalate
כשצריך להעביר לבעל/ת העסק: { "type": "escalate", "params": {} }`
}

// ── Action Executor ─────────────────────────────────────

function formatDateHebrew(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function addMinutesToTimeString(startTime: string, minutes: number): string {
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

async function executeAction(
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
      }
      if (params.date && params.time && params.service) {
        // Validate date: ensure day-of-week matches the date
        const bookDate = new Date(params.date + 'T12:00:00')
        if (isNaN(bookDate.getTime())) {
          throw new Error('INVALID_DATE: ' + params.date)
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
          if (!service) service = services.find((s) => s.name.includes(params.service!) || params.service!.includes(s.name))
          if (!service && services.length === 1) service = services[0]

        if (service) {
          // Round time to valid interval for this service
          let timeStr = params.time!
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
            const conflictContact = conflictApt.contacts as { name?: string; wa_id?: string; phone?: string } | null

            // Try to send a swap offer to the existing customer
            if (conflictContact?.wa_id || conflictContact?.phone) {
              try {
                const { data: phoneNum } = await supabase
                  .from('phone_numbers')
                  .select('session_id')
                  .eq('business_id', input.businessId)
                  .eq('status', 'connected')
                  .single()

                if (phoneNum?.session_id) {
                  const { whatsapp } = await import('@/lib/waha/provider')
                  const chatId = conflictContact.wa_id || conflictContact.phone || ''
                  const dateStr = params.date!.split('-').reverse().join('/')
                  await whatsapp.sendMessage(
                    phoneNum.session_id,
                    chatId,
                    `היי ${conflictContact.name || ''} 👋\nיש לקוח שמעוניין בשעה ${timeStr} בתאריך ${dateStr}.\nאם נוח לך להחליף לשעה אחרת, תשלח/י לנו הודעה ונסדר 🙏`
                  )
                  console.log(`[agent] Sent swap offer to ${conflictContact.name} for ${startTime}`)
                }
              } catch (swapErr) {
                console.error('[agent] Failed to send swap offer:', swapErr)
              }
            }

            // Notify business owner
            await supabase.from('notifications').insert({
              business_id: input.businessId,
              type: 'system',
              title: 'בקשת החלפת שעה',
              body: `${input.contactName} רוצה תור ב-${timeStr} (${params.date}) אבל ${conflictContact?.name || 'לקוח אחר'} כבר תפוס. נשלחה הודעה ללקוח הקיים.`,
              metadata: { requesting_contact: input.contactId, existing_appointment: conflictApt.id },
            })

            throw new Error('TIME_SLOT_CONFLICT_SWAP_SENT')
          }

          await supabase.from('appointments').insert({
            business_id: input.businessId,
            contact_id: input.contactId,
            service_type: params.service,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: service.duration,
            price: service.price,
            status: 'confirmed',
            notes: params.notes || null,
            contact_name: params.contact_name || input.contactName || null,
          })

          // Update contact name if provided and current name is just a number
          if (params.contact_name) {
            const { data: currentContact } = await supabase
              .from('contacts')
              .select('name')
              .eq('id', input.contactId)
              .single()
            if (currentContact && /^\d+$/.test(currentContact.name || '')) {
              await supabase.from('contacts').update({ name: params.contact_name }).eq('id', input.contactId)
            }
          }

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

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', input.contactId)
          .eq('business_id', input.businessId)
      }
      break
    }

    case 'reschedule_appointment': {
      // Cancel the nearest upcoming appointment, then book a new one
      const rParams = action.params as { service?: string; date?: string; time?: string }

      // Cancel existing
      const { data: upcoming } = await supabase
        .from('appointments')
        .select('id')
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
      }

      // Book new one
      if (rParams.date && rParams.time && rParams.service) {
        const services = (settings?.services as Array<{ name: string; duration: number; price: number }>) || []
        let service = services.find((s) => s.name === rParams.service)
        if (!service) service = services.find((s) => s.name.includes(rParams.service!) || rParams.service!.includes(s.name))
        if (!service && services.length === 1) service = services[0]
        if (service) {
          // Save Israel time directly (no timezone conversion)
          const newStart = `${rParams.date}T${rParams.time}:00`
          const newEnd = addMinutesToTimeString(`${rParams.date}T${rParams.time}:00`, service.duration)
          await supabase.from('appointments').insert({
            business_id: input.businessId,
            contact_id: input.contactId,
            service_type: rParams.service,
            start_time: newStart,
            end_time: newEnd,
            duration_minutes: service.duration,
            price: service.price,
            status: 'confirmed',
          })

          await supabase.from('notifications').insert({
            business_id: input.businessId,
            type: 'rescheduled_appointment',
            title: 'תור הוזז',
            body: `${input.contactName} הזיז/ה תור ל${rParams.service} לתאריך ${rParams.date} בשעה ${rParams.time}`,
            metadata: { contact_id: input.contactId, service: rParams.service, date: rParams.date, time: rParams.time },
          })
        }
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

    default:
      console.warn(`Unknown action type: ${action.type}`)
  }
}

// ── Main Agent Processor ────────────────────────────────

export async function processAIAgent(
  input: AgentInput
): Promise<AgentResponse> {
  const supabase = createServiceClient()

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
  } : {
    name: input.contactName,
    status: input.contactStatus || 'new',
    phone: input.contactPhone || '',
    visits: input.contactVisits || 0,
  }

  // 2. Load booking state
  const { loadBookingState, saveBookingState, processState } = await import('@/lib/ai/booking-state')
  const bookingState = await loadBookingState(input.conversationId)
  const services = (settingsResult.data?.services as Array<{ name: string; duration: number; price: number }>) || []

  // 3. Build extraction prompt - AI only extracts data, doesn't decide
  const extractionPrompt = `IMPORTANT: Respond ONLY in valid JSON. Extract information from the user's message.
You are extracting data for a booking system for "${businessResult.data?.name || 'business'}".

Available services: ${services.map(s => s.name).join(', ')}
Current booking step: ${bookingState.step}
Today: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })} (${new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long' })})

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
  "date": "YYYY-MM-DD if a date/day is mentioned, or null",
  "time": "HH:MM if time mentioned, or null",
  "notes": "any notes/comments, or null",
  "confirmation": true if confirming (כן/בטח/מאשר), false if denying (לא/ביטול), null otherwise
}

Rules:
- "כן", "בטח", "מאשר", "יאללה", "סבבה", "אוקיי" → confirmation: true
- "לא", "ביטול", "לא רוצה" → confirmation: false
- "מחר" → tomorrow's date
- "היום" → today's date
- If step is "collecting_name" and message is a short word (1-3 words), it's probably a name`

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

  // 6. Run state machine
  const stateResult = processState(
    bookingState,
    extracted,
    services,
    contactCtx.name,
    settingsResult.data?.working_hours as Record<string, unknown> | null
  )

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

  // 6. Execute action if needed
  if (parsed.action) {
    const actionParams = parsed.action.params as Record<string, unknown>
    try {
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

      // If conflict with swap offer sent - override AI response
      if (errMsg.includes('TIME_SLOT_CONFLICT_SWAP_SENT')) {
        parsed.text = 'השעה הזאת תפוסה, שלחתי הודעה ללקוח שקבע כדי לבדוק אם הוא מוכן להחליף. אעדכן אותך! רוצה לבדוק שעה אחרת?'
        // Return to collecting_time so user can pick another slot
        await saveBookingState(input.conversationId, { ...stateResult.newState, step: 'collecting_time' as const })
      } else if (errMsg.includes('TIME_SLOT_CONFLICT')) {
        parsed.text = 'אוי, השעה הזאת כבר תפוסה. רוצה לבדוק שעה אחרת?'
        await saveBookingState(input.conversationId, { ...stateResult.newState, step: 'collecting_time' as const })
      } else {
        if (parsed.text === '__BOOKING_PENDING__') {
          parsed.text = 'סליחה, לא הצלחתי לקבוע את התור. אנסה שוב או שתפנה לעסק ישירות.'
        }
        // Notify business owner about other failures
        await supabase.from('notifications').insert({
          business_id: input.businessId,
          type: 'system',
          title: 'פעולה נכשלה',
          body: `הסוכן ניסה לבצע "${parsed.action.type}" אך נכשל: ${errMsg}`,
          metadata: { action: parsed.action, contact_id: input.contactId },
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
}
