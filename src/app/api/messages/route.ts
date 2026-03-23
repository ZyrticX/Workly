import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { whatsapp } from '@/lib/waha/provider'

/**
 * POST /api/messages
 *
 * Send a manual (agent) message in a conversation.
 * 1. Validates the user owns the conversation's business.
 * 2. Gets the business's connected WAHA session.
 * 3. Sends the message via WAHA.
 * 4. Saves the message to the DB.
 * 5. Updates the conversation's last_message_at.
 *
 * Body: { conversationId: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, content } = body

    // ── Validation ──
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'content is required and must not be empty' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // ── Auth check ──
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Verify business ownership ──
    const { data: bu } = await supabase
      .from('business_users')
      .select('business_id')
      .eq('user_id', user.id)
      .single()

    if (!bu) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // ── Get the conversation (scoped to user's business) ──
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contacts ( wa_id, phone )')
      .eq('id', conversationId)
      .eq('business_id', bu.business_id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // ── Get the business phone / WAHA session ──
    const { data: phone } = await supabase
      .from('phone_numbers')
      .select('session_id')
      .eq('business_id', conversation.business_id)
      .eq('status', 'connected')
      .single()

    if (!phone?.session_id) {
      return NextResponse.json(
        { error: 'No connected WhatsApp session found' },
        { status: 503 }
      )
    }

    // ── Resolve recipient ──
    // Priority: wa_id (WhatsApp identifier, may be @lid or @c.us format) > phone
    const waId = conversation.contacts?.wa_id || ''
    const contactPhone = conversation.contacts?.phone || ''
    let recipientId = waId || contactPhone

    if (!recipientId) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 }
      )
    }

    // If wa_id already has @ (like @lid or @c.us), use as-is - WAHA handles it
    // Otherwise normalize phone number
    if (!recipientId.includes('@')) {
      if (recipientId.startsWith('05') && recipientId.length === 10) {
        recipientId = '972' + recipientId.slice(1)
      } else if (recipientId.startsWith('0') && recipientId.length === 10) {
        recipientId = '972' + recipientId.slice(1)
      }
    }

    // ── Send via WAHA ──
    await whatsapp.sendMessage(phone.session_id, recipientId, content.trim())

    // ── Save message to DB ──
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        business_id: conversation.business_id,
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'agent',
        type: 'text',
        content: content.trim(),
        status: 'sent',
      })
      .select()
      .single()

    if (msgError) {
      // Message was sent via WAHA but failed to save — log but don't fail
      console.error('[api/messages] Failed to save message:', msgError)
      return NextResponse.json(
        { error: 'Message sent but failed to save' },
        { status: 500 }
      )
    }

    // ── Update conversation timestamp ──
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error('[api/messages] Unhandled error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
