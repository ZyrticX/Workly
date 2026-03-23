import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateResponse, type ConversationEntry } from '@/lib/ai/ai-client'

const SYSTEM_PROMPT = `אתה עוזר חכם וידידותי שמלווה בעלי עסקים בהגדרת העסק שלהם במערכת.
דבר בעברית בלבד. היה ידידותי, מקצועי ותמציתי.

המטרה שלך: לאסוף את כל המידע הבא מהמשתמש דרך שיחה טבעית:
1. סוג העסק (למשל: מספרה, קוסמטיקה, מאמן אישי, מרפאה וכו')
2. שם העסק
3. שירותים - לכל שירות: שם, משך בדקות, מחיר בשקלים
4. שעות פעילות - באילו ימים ובאילו שעות העסק פתוח
5. טון התקשורת - איך הבוט ידבר (ידידותי/מקצועי/הומוריסטי/קז'ואל)
6. מדיניות ביטולים - כמה זמן מראש צריך לבטל, האם יש קנס

חוקים חשובים:
- שאל שאלה אחת בכל פעם, אל תציף את המשתמש
- אם המשתמש לא בטוח, הצע דוגמאות רלוונטיות לסוג העסק שלו
- היה חכם - אם המשתמש אומר "מספרה" אתה כבר יודע להציע שירותים רלוונטיים
- כשאתה מציע שירותים, הצע אותם עם מחירים ומשכי זמן סבירים והמשתמש יכול לאשר או לשנות
- לגבי שעות, הצע תבנית נפוצה (א-ה 9:00-19:00, ו 9:00-14:00) והמשתמש ישנה

כשיש לך מספיק מידע על כל 6 הנושאים, הצג למשתמש סיכום של כל מה שהגדרת ושאל אם הכל נכון.

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
