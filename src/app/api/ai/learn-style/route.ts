import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateResponse } from '@/lib/ai/ai-client'

/**
 * POST /api/ai/learn-style
 *
 * Accepts sample chat messages from the business owner.
 * Uses AI to extract common phrases, tone, and style.
 * Saves to ai_personas for future use in the AI agent's responses.
 *
 * Body: { messages: string } - Raw chat text pasted by the user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!bu) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const body = await request.json()
    const { messages } = body

    if (!messages || typeof messages !== 'string' || messages.length < 20) {
      return NextResponse.json({ error: 'Please provide sample chat messages (at least 20 characters)' }, { status: 400 })
    }

    // Use AI to analyze the style
    const analysisPrompt = `IMPORTANT: Respond ONLY in valid JSON. Analyze these chat messages from a business owner talking to clients. Extract their communication style.

Messages:
${messages.slice(0, 3000)}

Return JSON:
{
  "phrases": ["list of recurring phrases/greetings like 'אחי כפרה', 'שותף', 'מאמי', 'לב שלי' etc."],
  "style_description": "Hebrew description of how they talk - formal/casual, emoji usage, sentence length, warmth level etc."
}`

    const rawResponse = await generateResponse(analysisPrompt, [], 'analyze')

    let analysis: { phrases: string[]; style_description: string }
    try {
      const cleaned = rawResponse.replace(/```json\n?|```/g, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to analyze style' }, { status: 500 })
    }

    // Save to ai_personas
    const { error } = await supabase
      .from('ai_personas')
      .update({
        learned_phrases: analysis.phrases,
        conversation_style: analysis.style_description,
      })
      .eq('business_id', bu.business_id)

    if (error) {
      console.error('[learn-style] DB error:', error)
      return NextResponse.json({ error: 'Failed to save style' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      phrases: analysis.phrases,
      style: analysis.style_description,
    })
  } catch (err) {
    console.error('[learn-style] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
