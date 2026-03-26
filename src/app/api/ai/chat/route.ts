import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateResponse } from '@/lib/ai/ai-client'

// ── AI Assistant for Business Owner ────────────────────
// Not just BI — can also book appointments, add contacts, etc.

const SYSTEM_PROMPT = `IMPORTANT: Respond ONLY in Hebrew.

אתה עוזר אישי חכם לבעל עסק. אתה יכול:
1. לענות על שאלות עסקיות (הכנסות, לקוחות, תורים)
2. לקבוע תורים ללקוחות
3. להוסיף לקוחות חדשים
4. לבטל/להזיז תורים
5. לתת תובנות ועצות

כשבעל העסק מבקש לבצע פעולה, החזר JSON עם action:

לקביעת תור:
\`\`\`json
{"action":"book","params":{"contact_name":"שם","service":"שירות","date":"YYYY-MM-DD","time":"HH:MM"},"text":"תשובה ללקוח"}
\`\`\`

להוספת לקוח:
\`\`\`json
{"action":"add_contact","params":{"name":"שם","phone":"טלפון","notes":"הערות"},"text":"תשובה"}
\`\`\`

לביטול תור:
\`\`\`json
{"action":"cancel","params":{"contact_name":"שם","date":"YYYY-MM-DD"},"text":"תשובה"}
\`\`\`

לשאלות רגילות — ענה בטקסט רגיל בלי JSON.
תהיה קצר וממוקד. עברית ישראלית.`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: businessUser } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!businessUser) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const businessId = businessUser.business_id
    const body = await req.json()
    const question = (body.question as string || '').trim()
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })

    const admin = createServiceClient()

    // Load business context for AI
    const [bizRes, settingsRes, contactsRes, aptsRes] = await Promise.all([
      admin.from('businesses').select('name, business_type').eq('id', businessId).single(),
      admin.from('business_settings').select('services, working_hours').eq('business_id', businessId).single(),
      admin.from('contacts').select('id, name, phone, status, total_visits, total_revenue').eq('business_id', businessId).order('total_visits', { ascending: false }).limit(30),
      admin.from('appointments').select('id, contact_name, service_type, start_time, status').eq('business_id', businessId).gte('start_time', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + 'T00:00:00').order('start_time').limit(20),
    ])

    const contextPrompt = `${SYSTEM_PROMPT}

## העסק:
שם: ${bizRes.data?.name || 'לא הוגדר'}
סוג: ${bizRes.data?.business_type || 'כללי'}

## שירותים:
${JSON.stringify(settingsRes.data?.services || [])}

## לקוחות (${contactsRes.data?.length || 0}):
${(contactsRes.data || []).map(c => `${c.name} | ${c.phone || ''} | ${c.status} | ${c.total_visits} ביקורים | ${c.total_revenue}₪`).join('\n')}

## תורים קרובים:
${(aptsRes.data || []).map(a => `${(a.start_time as string).substring(0, 16)} | ${a.contact_name} | ${a.service_type} | ${a.status}`).join('\n')}

היום: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })}
השעה: ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false })}`

    // Get chat history
    const { data: history } = await admin
      .from('ai_chat_history')
      .select('question, answer')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(5)

    const conversationHistory = (history || []).reverse().flatMap(h => [
      { role: 'user' as const, text: h.question },
      { role: 'assistant' as const, text: h.answer },
    ])

    const aiResponse = await generateResponse(contextPrompt, conversationHistory, question, { maxTokens: 1500 })

    // Check if AI returned an action
    let answer = aiResponse
    let actionResult: string | null = null

    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        answer = parsed.text || aiResponse.replace(/```json[\s\S]*?```/, '').trim()

        // Execute action
        if (parsed.action === 'book' && parsed.params) {
          const p = parsed.params
          // Find contact
          let contactId: string | null = null
          if (p.contact_name) {
            const { data: contact } = await admin
              .from('contacts')
              .select('id')
              .eq('business_id', businessId)
              .ilike('name', `%${p.contact_name}%`)
              .single()
            contactId = contact?.id || null
          }

          // Find service duration
          const services = (settingsRes.data?.services as Array<{ name: string; duration: number; price: number }>) || []
          const service = services.find(s => s.name.includes(p.service) || p.service?.includes(s.name)) || services[0]
          const duration = service?.duration || 30
          const price = service?.price || 0

          if (p.date && p.time) {
            const startTime = `${p.date}T${p.time}:00`
            const endMin = p.time.split(':').map(Number).reduce((h: number, m: number) => h * 60 + m, 0) + duration
            const endTime = `${p.date}T${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`

            const { error } = await admin.from('appointments').insert({
              business_id: businessId,
              contact_id: contactId,
              contact_name: p.contact_name || '',
              service_type: service?.name || p.service || '',
              start_time: startTime,
              end_time: endTime,
              duration_minutes: duration,
              price,
              status: 'confirmed',
            })
            actionResult = error ? `שגיאה: ${error.message}` : `✅ תור נקבע: ${p.contact_name} ב-${p.date} ${p.time}`
          }
        }

        if (parsed.action === 'add_contact' && parsed.params) {
          const p = parsed.params
          const { error } = await admin.from('contacts').insert({
            business_id: businessId,
            name: p.name,
            phone: p.phone || '',
            notes: p.notes || '',
            status: 'new',
          })
          actionResult = error ? `שגיאה: ${error.message}` : `✅ לקוח נוסף: ${p.name}`
        }

        if (parsed.action === 'cancel' && parsed.params) {
          const p = parsed.params
          let query = admin.from('appointments')
            .update({ status: 'cancelled' })
            .eq('business_id', businessId)
            .eq('status', 'confirmed')
          if (p.contact_name) query = query.ilike('contact_name', `%${p.contact_name}%`)
          if (p.date) query = query.gte('start_time', `${p.date}T00:00:00`).lte('start_time', `${p.date}T23:59:59`)

          const { error } = await query
          actionResult = error ? `שגיאה: ${error.message}` : `✅ תור בוטל${p.contact_name ? ` ל${p.contact_name}` : ''}`
        }

        if (actionResult) {
          answer = `${answer}\n\n${actionResult}`
        }
      } catch {
        // JSON parse failed — use raw text
        answer = aiResponse.replace(/```json[\s\S]*?```/, '').trim() || aiResponse
      }
    }

    // Save to history
    await admin.from('ai_chat_history').insert({
      business_id: businessId,
      question,
      answer,
    })

    return NextResponse.json({ answer, actionResult })
  } catch (err) {
    console.error('[api/ai/chat] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
