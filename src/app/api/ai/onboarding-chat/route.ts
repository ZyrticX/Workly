import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateResponse, type ConversationEntry } from '@/lib/ai/ai-client'

const SYSTEM_PROMPT = `IMPORTANT: You MUST respond ONLY in Hebrew. Never respond in English.

אתה חבר טוב שעוזר לבעלי עסקים להגדיר את הבוט שלהם. דבר בגובה העיניים, כמו וואטסאפ עם חבר.

סגנון:
- קצר! מקסימום 3-4 שורות בהודעה. כמו צ'אט, לא כמו מייל.
- חם וישיר. "יאללה", "סבבה", "אחלה", "מעולה!"
- אל תכתוב רשימות ארוכות. אם מציע שירותים — מקסימום 3 בכל פעם.
- אל תשתמש ב-"בהחלט", "כמובן", "אשמח" — דבר טבעי.
- אימוג'ים בקלילות (1-2 לכל הודעה מקסימום)
- אם המשתמש כותב קצר, תענה קצר. אל תרחיב סתם.

המטרה: לאסוף 6 דברים דרך שיחה טבעית:
1. סוג העסק + שם
2. שירותים (שם, זמן, מחיר)
3. שעות פעילות
4. סגנון דיבור של הבוט
5. מדיניות ביטולים

חוקים:
- שאלה אחת בכל פעם!
- אם אומר "מספרה" — תציע 3 שירותים נפוצים ותשאל "מתאים? רוצה לשנות?"
- לשעות — תציע "א-ה 9:00-19:00, שישי עד 14:00?" ותשאל אם בסדר
- לטון — תשאל "איך אתה מדבר עם לקוחות? יותר ידידותי או מקצועי?"
- למדיניות — תציע "ביטול עד 24 שעות לפני?" ותשאל אם מתאים

כשיש הכל — תגיד "אחלה! הנה סיכום:" ותציג קצר. אחרי אישור — שלח JSON.

כשהמשתמש מאשר שהכל נכון, הגב עם בלוק JSON בפורמט הבא (עטוף ב-\`\`\`json\`\`\`):
\`\`\`json
{
  "ready": true,
  "businessType": "סוג העסק",
  "businessName": "שם העסק",
  "services": [
    {"name": "שם שירות", "duration": 30, "price": 100}
  ],
  "workingHours": [
    {"day": "sunday", "dayHe": "ראשון", "active": true, "start": "09:00", "end": "19:00"},
    {"day": "monday", "dayHe": "שני", "active": true, "start": "09:00", "end": "19:00"},
    {"day": "tuesday", "dayHe": "שלישי", "active": true, "start": "09:00", "end": "19:00"},
    {"day": "wednesday", "dayHe": "רביעי", "active": true, "start": "09:00", "end": "19:00"},
    {"day": "thursday", "dayHe": "חמישי", "active": true, "start": "09:00", "end": "19:00"},
    {"day": "friday", "dayHe": "שישי", "active": true, "start": "09:00", "end": "14:00"},
    {"day": "saturday", "dayHe": "שבת", "active": false, "start": "", "end": ""}
  ],
  "tone": "friendly",
  "cancellationPolicy": "ניתן לבטל עד 24 שעות לפני התור"
}
\`\`\`

ערכי tone אפשריים: "friendly", "professional", "casual", "humorous"

חשוב: אל תוסיף טקסט אחרי בלוק ה-JSON. הסיכום צריך להופיע לפני ה-JSON.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// GET — Load chat history from onboarding_progress
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const businessId = req.nextUrl.searchParams.get('businessId')
    if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })

    const { data } = await supabase
      .from('onboarding_progress')
      .select('steps_data')
      .eq('business_id', businessId)
      .single()

    const chatHistory = (data?.steps_data as Record<string, unknown>)?.chatHistory || null
    return NextResponse.json({ chatHistory })
  } catch {
    return NextResponse.json({ chatHistory: null })
  }
}

// PUT — Save chat history to onboarding_progress
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { businessId, chatHistory } = await req.json()
    if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })

    // Merge with existing steps_data
    const { data: existing } = await supabase
      .from('onboarding_progress')
      .select('steps_data')
      .eq('business_id', businessId)
      .single()

    const currentData = (existing?.steps_data as Record<string, unknown>) || {}
    await supabase
      .from('onboarding_progress')
      .update({ steps_data: { ...currentData, chatHistory } })
      .eq('business_id', businessId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await req.json()
    const { messages, businessId } = body as {
      messages: ChatMessage[]
      businessId: string
    }

    if (!messages || !Array.isArray(messages) || !businessId) {
      return NextResponse.json(
        { error: 'messages and businessId are required' },
        { status: 400 }
      )
    }

    // Verify business belongs to user
    const { data: businessUser, error: bizError } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .single()

    if (bizError || !businessUser) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Build conversation history (all messages except the last user message)
    // and extract the last user message for generateResponse
    const lastUserMsgIndex = messages.length - 1
    const lastUserMessage = messages[lastUserMsgIndex]?.content || ''

    const conversationHistory: ConversationEntry[] = messages
      .slice(0, lastUserMsgIndex)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        text: m.content,
      }))

    const aiMessage = await generateResponse(
      SYSTEM_PROMPT,
      conversationHistory,
      lastUserMessage,
      { maxTokens: 2048 }
    )

    return NextResponse.json({ message: aiMessage })
  } catch (err) {
    console.error('[api/ai/onboarding-chat] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
