import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateVisionResponse } from '@/lib/ai/ai-client'

const MAX_IMAGES = 5
const MAX_SIZE = 5 * 1024 * 1024 // 5MB per image

const ANALYSIS_PROMPT = `נתח את צילומי המסך של השיחות ותמצה את אופי התקשורת של בעל העסק:
1. טון דיבור (רשמי/ידידותי/חופשי)
2. שימוש באימוג'ים (הרבה/מעט/ללא)
3. אורך הודעות טיפוסי (קצר/בינוני/ארוך)
4. ביטויים ומילים חוזרות
5. סגנון פנייה ללקוח (שם ראשון/אחי/יקירי וכו')
6. דפוסי שיחה מיוחדים

החזר פרופיל סגנון בעברית, בצורה תמציתית וברורה, שאפשר להעתיק ישירות להנחיות AI.
אל תחזיר JSON — רק טקסט חופשי בעברית.`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מאומת' }, { status: 401 })

    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'לא הועלו תמונות' }, { status: 400 })
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `מקסימום ${MAX_IMAGES} תמונות` }, { status: 400 })
    }

    // Convert files to base64
    const images: { base64: string; mimeType: string }[] = []
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `תמונה גדולה מדי (מקסימום 5MB)` }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      images.push({
        base64: buffer.toString('base64'),
        mimeType: file.type || 'image/jpeg',
      })
    }

    const result = await generateVisionResponse(
      'אתה מומחה לניתוח סגנון תקשורת. נתח את השיחות בצילומי המסך.',
      images,
      ANALYSIS_PROMPT
    )

    return NextResponse.json({ style: result })
  } catch (err) {
    console.error('[analyze-style] Error:', err)
    return NextResponse.json({ error: 'שגיאה בניתוח' }, { status: 500 })
  }
}
