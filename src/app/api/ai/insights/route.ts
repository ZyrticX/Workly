import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateResponse } from '@/lib/ai/ai-client'

// POST /api/ai/insights
// Body: { businessId: string, kpis: Record<string, unknown> }
// Returns: { insights: string[] }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 })

    const body = await req.json()
    const { kpis } = body

    if (!kpis || typeof kpis !== 'object') {
      return NextResponse.json({ error: 'נדרשים נתוני KPI' }, { status: 400 })
    }

    // Build prompt for AI insights generation
    const systemPrompt = `אתה יועץ עסקי מנוסה. קיבלת נתוני ביצועים (KPIs) של עסק קטן.
נתח את הנתונים וספק בדיוק 3 תובנות קצרות וממוקדות בעברית.
כל תובנה צריכה להיות משפט אחד עד שניים.

תובנה 1: דבר חיובי / הישג
תובנה 2: טיפ מעשי לשיפור
תובנה 3: אזהרה או נקודת תשומת לב

החזר JSON בלבד בפורמט:
{ "insights": ["תובנה 1", "תובנה 2", "תובנה 3"] }`

    const kpiSummary = Object.entries(kpis)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    const rawResponse = await generateResponse(
      systemPrompt,
      [],
      `נתוני הביצועים של העסק:\n${kpiSummary}`
    )

    // Parse AI response
    let insights: string[] = []
    try {
      const cleaned = rawResponse.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      insights = Array.isArray(parsed.insights) ? parsed.insights : []
    } catch {
      // Fallback: split by newlines if JSON parsing fails
      insights = rawResponse
        .split('\n')
        .map((line: string) => line.replace(/^[\d\-\.\*]+\s*/, '').trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 3)
    }

    return NextResponse.json({ insights })
  } catch (err) {
    console.error('[api/ai/insights] Error:', err)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
