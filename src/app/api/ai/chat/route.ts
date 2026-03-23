import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processBusinessQuery } from '@/lib/ai/bi-chat'

// ── BI Chat Endpoint ────────────────────────────────────
// POST /api/ai/chat
// Body: { question: string }
// Returns: { answer: string, data: unknown }

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

    // Get user's business
    const { data: businessUser, error: bizError } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()

    if (bizError || !businessUser) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await req.json()
    const question = body.question as string

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Process the BI query
    const result = await processBusinessQuery(
      businessUser.business_id,
      question.trim()
    )

    return NextResponse.json({
      answer: result.answer,
      data: result.data,
    })
  } catch (err) {
    console.error('[api/ai/chat] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
