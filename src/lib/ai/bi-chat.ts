import { generateResponse } from './ai-client'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ───────────────────────────────────────────────

export interface BIChatResult {
  answer: string
  data: unknown
}

// ── Available tables and columns for the AI to query ────

const SCHEMA_CONTEXT = `
הטבלאות הזמינות (כולן מסוננות לפי business_id):

1. contacts — לקוחות
   עמודות: id, business_id, wa_id, phone, name, status (new/active/vip), tags (jsonb), notes, birthday, last_visit, total_visits, total_revenue, created_at

2. appointments — תורים
   עמודות: id, business_id, contact_id, service_type, start_time, end_time, duration_minutes, status (confirmed/completed/cancelled/no_show), reminder_sent, confirmed_by_client, price, notes, created_at

3. messages — הודעות
   עמודות: id, business_id, conversation_id, direction (inbound/outbound), sender_type (customer/ai/human), type, content, status, created_at

4. conversations — שיחות
   עמודות: id, business_id, contact_id, status, assigned_to, is_bot_active, last_message_at, created_at

5. expenses — הוצאות
   עמודות: id, business_id, category, amount, description, receipt_url, expense_date, is_recurring, created_at

6. ai_conversation_logs — לוגים של AI
   עמודות: id, business_id, conversation_id, detected_intent, ai_response, confidence, escalated, created_at

7. kpi_snapshots — תמונות מצב KPI
   עמודות: id, business_id, period_start, period_end, metrics (jsonb), created_at
`

// ── Query Plan Generator ────────────────────────────────

async function generateQueryPlan(
  question: string
): Promise<{ tables: string[]; description: string }> {
  const prompt = `אתה מנתח BI. הלקוח שאל: "${question}"

${SCHEMA_CONTEXT}

החזר JSON בלבד:
{
  "tables": ["שמות הטבלאות שצריך לשאול"],
  "description": "תיאור קצר של מה צריך לשלוף"
}

אל תכתוב SQL, רק ציין אילו טבלאות רלוונטיות ומה צריך.`

  const text = await generateResponse('אתה מנתח BI. תחזיר JSON בלבד.', [], prompt)
  const cleaned = text.replace(/```json\n?|```/g, '').trim()
  return JSON.parse(cleaned) as { tables: string[]; description: string }
}

// ── Data Fetcher ────────────────────────────────────────

async function fetchRelevantData(
  businessId: string,
  tables: string[]
): Promise<Record<string, unknown[]>> {
  const supabase = createServiceClient()
  const data: Record<string, unknown[]> = {}

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  for (const table of tables) {
    switch (table) {
      case 'contacts': {
        const { data: rows } = await supabase
          .from('contacts')
          .select('name, phone, status, tags, total_visits, total_revenue, last_visit, created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50)
        data.contacts = rows || []
        break
      }

      case 'appointments': {
        // Use aggregation-friendly approach: fetch limited rows, summarize in code
        const { data: rows } = await supabase
          .from('appointments')
          .select('service_type, start_time, status, price, duration_minutes')
          .eq('business_id', businessId)
          .gte('start_time', startOfMonth)
          .order('start_time', { ascending: false })
          .limit(50)
        data.appointments = rows || []
        break
      }

      case 'messages': {
        const { data: rows } = await supabase
          .from('messages')
          .select('direction, sender_type, type, created_at')
          .eq('business_id', businessId)
          .gte('created_at', startOfMonth)
          .order('created_at', { ascending: false })
          .limit(50)
        // Strip content field — only metadata is needed for BI analysis
        data.messages = rows || []
        break
      }

      case 'conversations': {
        const { data: rows } = await supabase
          .from('conversations')
          .select('status, is_bot_active, last_message_at, created_at')
          .eq('business_id', businessId)
          .order('last_message_at', { ascending: false })
          .limit(50)
        data.conversations = rows || []
        break
      }

      case 'expenses': {
        const { data: rows } = await supabase
          .from('expenses')
          .select('category, amount, expense_date, is_recurring')
          .eq('business_id', businessId)
          .gte('expense_date', startOfMonth.split('T')[0])
          .lte('expense_date', endOfMonth.split('T')[0])
          .order('expense_date', { ascending: false })
          .limit(50)
        // Description stripped to reduce token usage
        data.expenses = rows || []
        break
      }

      case 'ai_conversation_logs': {
        const { data: rows } = await supabase
          .from('ai_conversation_logs')
          .select('detected_intent, confidence, escalated, created_at')
          .eq('business_id', businessId)
          .gte('created_at', startOfMonth)
          .order('created_at', { ascending: false })
          .limit(50)
        data.ai_conversation_logs = rows || []
        break
      }

      case 'kpi_snapshots': {
        const { data: rows } = await supabase
          .from('kpi_snapshots')
          .select('period_start, period_end, metrics')
          .eq('business_id', businessId)
          .order('period_start', { ascending: false })
          .limit(12)
        data.kpi_snapshots = rows || []
        break
      }

      default:
        console.warn(`BI chat: unknown table "${table}"`)
    }
  }

  return data
}

// ── Answer Generator ────────────────────────────────────

async function generateAnswer(
  question: string,
  data: Record<string, unknown[]>
): Promise<string> {
  const prompt = `IMPORTANT: You MUST respond ONLY in Hebrew. Never respond in English.
אתה מנתח BI חכם. ענה בעברית בלבד על השאלה של הלקוח.

## שאלה:
${question}

## נתונים שנשלפו (מוגבל ל-50 שורות לכל טבלה):
${JSON.stringify(data)}

## הנחיות:
- ענה בעברית בצורה ברורה ומקצועית
- כלול מספרים ספציפיים כשאפשר
- אם הנתונים לא מספיקים, ציין מה חסר
- פרמט תשובות ארוכות עם נקודות
- אל תמציא נתונים — רק מה שיש
- אם יש מגמה מעניינת, ציין אותה`

  return await generateResponse('אתה מנתח BI חכם. ענה בעברית.', [], prompt)
}

// ── Main Entry Point ────────────────────────────────────

export async function processBusinessQuery(
  businessId: string,
  question: string
): Promise<BIChatResult> {
  // 1. Understand the question and decide which tables to query
  const plan = await generateQueryPlan(question)

  // 2. Fetch relevant data (always scoped to business_id)
  const data = await fetchRelevantData(businessId, plan.tables)

  // 3. Generate a Hebrew answer
  const answer = await generateAnswer(question, data)

  // 4. Save to chat history
  const supabase = createServiceClient()
  await supabase.from('ai_chat_history').insert({
    business_id: businessId,
    question,
    answer,
    query_generated: JSON.stringify(plan),
  })

  return { answer, data }
}
