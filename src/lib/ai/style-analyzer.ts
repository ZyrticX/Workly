import { generateVisionResponse } from './ai-client'

// ── Types ───────────────────────────────────────────────

export interface StyleAnalysis {
  message_length: 'short' | 'medium' | 'long'
  emoji_usage: 'none' | 'light' | 'heavy'
  formality_level: 'formal' | 'friendly' | 'very_personal'
  pricing_style: string
  opening_style: string
  closing_style: string
  recurring_phrases: string[]
  example_messages: string[]
}

export interface ScreenshotInput {
  base64: string
  mimeType: string
}

// ── Style Analyzer ──────────────────────────────────────

const ANALYSIS_PROMPT = `נתח את צילומי המסך האלה של שיחות WhatsApp של בעלת עסק עם לקוחות.
הוצא את המאפיינים הבאים:

1. אורך הודעות ממוצע — "short" / "medium" / "long"
2. שימוש באימוג'ים — "none" / "light" / "heavy"
3. רמת רשמיות — "formal" / "friendly" / "very_personal"
4. ניסוח מחירים — איך בעלת העסק מציגה מחירים (תאר בקצרה)
5. סגנון פתיחה — איך פותחת שיחה (תאר בקצרה)
6. סגנון סגירה — איך סוגרת שיחה (תאר בקצרה)
7. ביטויים חוזרים — רשימה של ביטויים שחוזרים על עצמם
8. דוגמאות להודעות — 3 דוגמאות להודעות טיפוסיות של בעלת העסק

תחזיר JSON מדויק בלבד:
{
  "message_length": "short|medium|long",
  "emoji_usage": "none|light|heavy",
  "formality_level": "formal|friendly|very_personal",
  "pricing_style": "תיאור קצר",
  "opening_style": "תיאור קצר",
  "closing_style": "תיאור קצר",
  "recurring_phrases": ["ביטוי 1", "ביטוי 2"],
  "example_messages": ["דוגמה 1", "דוגמה 2", "דוגמה 3"]
}`

/**
 * Analyze WhatsApp screenshots to extract the business owner's
 * communication style. Uses AI Vision to understand the images.
 */
export async function analyzeStyleFromScreenshots(
  images: ScreenshotInput[]
): Promise<StyleAnalysis> {
  if (images.length === 0) {
    throw new Error('At least one screenshot is required')
  }

  const systemPrompt = 'אתה מנתח סגנון תקשורת. תחזיר תמיד JSON תקין בלבד.'

  const text = await generateVisionResponse(
    systemPrompt,
    images,
    ANALYSIS_PROMPT
  )

  const cleaned = text.replace(/```json\n?|```/g, '').trim()

  try {
    return JSON.parse(cleaned) as StyleAnalysis
  } catch (err) {
    throw new Error(
      `Failed to parse style analysis response: ${err instanceof Error ? err.message : 'Unknown error'}`
    )
  }
}
