import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processAIAgent } from '@/lib/ai/agent-prompt'
import { extractDataFromMessage } from '@/lib/ai/data-extractor'
import { loadBookingState } from '@/lib/ai/booking-state'
import { buildAgentContext } from '@/lib/ai/context-builder'
import { checkInput, stripPII } from '@/lib/ai/guards'

/**
 * POST /api/simulator
 *
 * Runs the full AI pipeline for a selected contact — same as the webhook
 * but without WhatsApp sending. Returns debug info (extracted data,
 * booking state, timing) alongside the AI response.
 */
export async function POST(request: NextRequest) {
  const totalStart = Date.now()

  // 1. Auth — resolve business from logged-in user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!bu)
    return NextResponse.json({ error: 'No business found' }, { status: 404 })

  const { contactId, message } = await request.json()
  if (!contactId || !message?.trim())
    return NextResponse.json(
      { error: 'contactId and message are required' },
      { status: 400 }
    )

  // 2. Validate contact belongs to this business
  const serviceSupabase = createServiceClient()
  const { data: contact } = await serviceSupabase
    .from('contacts')
    .select('id, name, phone, status')
    .eq('id', contactId)
    .eq('business_id', bu.business_id)
    .single()
  if (!contact)
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // 3. Find or create active conversation (mirrors webhook lines 329-358)
  let { data: conversation } = await serviceSupabase
    .from('conversations')
    .select('id, business_id, contact_id, status, is_bot_active')
    .eq('business_id', bu.business_id)
    .eq('contact_id', contactId)
    .eq('status', 'active')
    .single()

  if (!conversation) {
    const { data: newConv, error: convError } = await serviceSupabase
      .from('conversations')
      .insert({
        business_id: bu.business_id,
        contact_id: contactId,
        status: 'active',
        is_bot_active: true,
      })
      .select()
      .single()

    if (convError)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )

    conversation = newConv!
  }

  const convId = conversation!.id

  // 4. Save inbound message (no provider_message_id — not from WhatsApp)
  await serviceSupabase.from('messages').insert({
    business_id: bu.business_id,
    conversation_id: convId,
    direction: 'inbound',
    sender_type: 'customer',
    type: 'text',
    content: message.trim(),
    status: 'delivered',
  })

  // 5. Increment unread count
  await serviceSupabase.rpc('increment_unread', { p_conversation_id: convId })

  // 6. Input guard
  const inputGuard = checkInput(message.trim())
  const safeMessage = inputGuard.flagged ? 'שלום' : message.trim()

  // 7. Debug: capture booking state BEFORE + run extraction separately
  const extractionStart = Date.now()
  const bookingStateBefore = await loadBookingState(convId)

  let extracted = null
  try {
    const ctx = await buildAgentContext({
      businessId: bu.business_id,
      conversationId: convId,
      contactId,
      message: safeMessage,
      contactName: contact.name || '',
      contactStatus: contact.status || 'new',
      contactPhone: contact.phone || '',
    })

    extracted = await extractDataFromMessage(
      safeMessage,
      ctx.conversationHistory,
      ctx.businessName,
      ctx.services,
      bookingStateBefore,
      ctx.contact
    )
  } catch {
    // Extraction failed — continue, processAIAgent will try again
  }
  const extractionMs = Date.now() - extractionStart

  // 8. Run full AI pipeline (same call as webhook line 444)
  const aiStart = Date.now()
  let aiResponse = null
  let aiError = null
  try {
    aiResponse = await processAIAgent({
      businessId: bu.business_id,
      conversationId: convId,
      contactId,
      message: safeMessage,
      contactName: contact.name || '',
      contactStatus: contact.status || 'new',
      contactPhone: contact.phone || '',
    })
  } catch (err) {
    aiError = err instanceof Error ? err.message : String(err)
  }
  const aiMs = Date.now() - aiStart

  // 9. Capture booking state AFTER
  const bookingStateAfter = await loadBookingState(convId)

  // 10. Save outbound AI message — NO WhatsApp send
  if (aiResponse?.text) {
    const safeText = stripPII(aiResponse.text)

    await serviceSupabase.from('messages').insert({
      business_id: bu.business_id,
      conversation_id: convId,
      direction: 'outbound',
      sender_type: 'ai',
      type: 'text',
      content: safeText,
      status: 'sent',
    })

    await serviceSupabase.from('ai_conversation_logs').insert({
      business_id: bu.business_id,
      conversation_id: convId,
      detected_intent: aiResponse.intent,
      ai_response: safeText,
      confidence: aiResponse.confidence,
      escalated: aiResponse.escalated,
    })
  }

  const totalMs = Date.now() - totalStart

  // 11. Return response + debug
  return NextResponse.json({
    response: aiResponse?.text ? stripPII(aiResponse.text) : '',
    debug: {
      extracted,
      bookingStateBefore,
      bookingStateAfter,
      timing: {
        extraction: extractionMs,
        aiGeneration: aiMs,
        total: totalMs,
      },
      conversationId: convId,
      contactName: contact.name,
      intent: aiResponse?.intent || null,
      confidence: aiResponse?.confidence || null,
      escalated: aiResponse?.escalated || false,
      inputGuard,
      error: aiError,
    },
  })
}
