import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processAIAgent } from '@/lib/ai/agent-prompt'

// ── Manual AI Agent Trigger ─────────────────────────────
// POST /api/ai/agent
// Body: { conversationId, contactId, message, contactName? }
// For testing and manual triggering of the AI agent.

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
    const { conversationId, contactId, message, contactName } = body as {
      conversationId: string
      contactId: string
      message: string
      contactName?: string
    }

    if (!conversationId || !contactId || !message) {
      return NextResponse.json(
        { error: 'conversationId, contactId, and message are required' },
        { status: 400 }
      )
    }

    // Verify conversation belongs to this business
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, business_id')
      .eq('id', conversationId)
      .eq('business_id', businessUser.business_id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Run the AI agent
    const response = await processAIAgent({
      businessId: businessUser.business_id,
      conversationId,
      contactId,
      message,
      contactName: contactName || 'Test User',
    })

    return NextResponse.json({
      text: response.text,
      intent: response.intent,
      confidence: response.confidence,
      escalated: response.escalated,
    })
  } catch (err) {
    console.error('[api/ai/agent] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
