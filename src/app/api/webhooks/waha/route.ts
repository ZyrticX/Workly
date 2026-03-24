import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processAIAgent } from '@/lib/ai/agent-prompt'
import { whatsapp } from '@/lib/waha/provider'

// ── Webhook Handler for WAHA ────────────────────────────
// Uses service client — webhooks have no auth context.

export async function POST(req: NextRequest) {
  // WAHA webhooks don't send auth headers by default.
  // The webhook URL itself acts as a secret (not publicly discoverable).
  // If WAHA_WEBHOOK_SECRET is set, verify it via query param: ?secret=xxx
  const webhookSecret = process.env.WAHA_WEBHOOK_SECRET
  if (webhookSecret) {
    const providedSecret = req.nextUrl.searchParams.get('secret')
    if (providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json()
  const supabase = createServiceClient()

  try {
    // ── MESSAGE EVENT ─────────────────────────────────
    if (body.event === 'message') {
      const payload = body.payload
      const session = payload.session || body.session
      const rawFrom = (payload.from as string) || ''
      // Handle both regular (@c.us) and LID (@lid) formats
      const isLid = rawFrom.includes('@lid')
      const from = rawFrom.replace('@c.us', '').replace('@lid', '')
      // Keep the full chatId for replying (WAHA needs it with suffix)
      const chatId = rawFrom
      const messageContent = (payload.body as string) || ''
      const messageType = (payload.type as string) || 'text'

      // Skip outgoing messages
      if (payload.fromMe) {
        return NextResponse.json({ ok: true })
      }

      // Skip group messages (group IDs contain a hyphen, but not LIDs)
      if (from.includes('-') && !isLid) {
        return NextResponse.json({ ok: true })
      }

      // Skip empty messages
      if (!messageContent.trim()) {
        return NextResponse.json({ ok: true })
      }

      // 1. Find business by session
      const { data: phone } = await supabase
        .from('phone_numbers')
        .select('id, business_id, session_id')
        .eq('session_id', session)
        .eq('status', 'connected')
        .single()

      if (!phone) {
        console.error(`[webhook] No business found for session: ${session}`)
        return NextResponse.json(
          { error: 'unknown session' },
          { status: 404 }
        )
      }

      // 2. Find or create contact
      // Try chatId first (full format with @c.us/@lid), then stripped format for backwards compat
      let { data: contact } = await supabase
        .from('contacts')
        .select('id, business_id, wa_id, phone, name, status')
        .eq('business_id', phone.business_id)
        .eq('wa_id', chatId)
        .single()

      // Backwards compat: old contacts stored wa_id without suffix
      if (!contact) {
        const { data: legacyContact } = await supabase
          .from('contacts')
          .select('id, business_id, wa_id, phone, name, status')
          .eq('business_id', phone.business_id)
          .eq('wa_id', from)
          .single()
        if (legacyContact) {
          contact = legacyContact
          // Migrate: update wa_id to include suffix
          await supabase.from('contacts').update({ wa_id: chatId }).eq('id', legacyContact.id)
        }
      }

      if (!contact) {
        // Extract a display name - for LIDs use notifyName, for regular use phone
        const displayName = (payload.notifyName as string) || (isLid ? `לקוח ${from.slice(-4)}` : from)
        // Format phone: 972xx → 0xx for display, LID → empty
        let contactPhone = ''
        if (!isLid && from) {
          if (from.startsWith('972') && from.length >= 12) {
            contactPhone = '0' + from.slice(3) // 972547530955 → 0547530955
          } else {
            contactPhone = from
          }
        }

        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            business_id: phone.business_id,
            wa_id: chatId, // Store full chatId with @c.us or @lid suffix — send exactly as-is
            phone: contactPhone,
            name: displayName,
            status: 'new',
          })
          .select()
          .single()

        if (contactError) {
          console.error('[webhook] Failed to create contact:', contactError)
          return NextResponse.json(
            { error: 'failed to create contact' },
            { status: 500 }
          )
        }

        contact = newContact!

        // Notify business owner about new contact
        await supabase.from('notifications').insert({
          business_id: phone.business_id,
          type: 'new_contact',
          title: 'לקוח/ה חדש/ה',
          body: `${newContact!.name} פנה/תה אליך לראשונה בוואטסאפ`,
          metadata: { contact_id: newContact!.id },
        })
      }

      // 3. Find or create active conversation
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id, business_id, contact_id, status, is_bot_active')
        .eq('business_id', phone.business_id)
        .eq('contact_id', contact!.id)
        .eq('status', 'active')
        .single()

      if (!conversation) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            business_id: phone.business_id,
            contact_id: contact!.id,
            status: 'active',
            is_bot_active: true,
          })
          .select()
          .single()

        if (convError) {
          console.error('[webhook] Failed to create conversation:', convError)
          return NextResponse.json(
            { error: 'failed to create conversation' },
            { status: 500 }
          )
        }

        conversation = newConv!
      }

      // 4. Save incoming message
      const { error: msgError } = await supabase.from('messages').insert({
        business_id: phone.business_id,
        conversation_id: conversation!.id,
        direction: 'inbound',
        sender_type: 'customer',
        type: messageType,
        content: messageContent,
        status: 'delivered',
        provider_message_id: payload.id as string,
      })

      if (msgError) {
        console.error('[webhook] Failed to save message:', msgError)
      }

      // 5. Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation!.id)

      // 6. Run AI agent if bot is active
      if (conversation!.is_bot_active) {
        try {
          const aiResponse = await processAIAgent({
            businessId: phone.business_id,
            conversationId: conversation!.id,
            contactId: contact!.id,
            message: messageContent,
            contactName: contact!.name || from,
            contactStatus: contact!.status || 'new',
            contactPhone: contact!.phone || '',
          })

          if (aiResponse && aiResponse.text) {
            // Send response via WAHA - use chatId (with @c.us or @lid suffix)
            await whatsapp.sendMessage(
              phone.session_id!,
              chatId,
              aiResponse.text
            )

            // Save outgoing AI message
            await supabase.from('messages').insert({
              business_id: phone.business_id,
              conversation_id: conversation!.id,
              direction: 'outbound',
              sender_type: 'ai',
              type: 'text',
              content: aiResponse.text,
              status: 'sent',
            })

            // Save AI conversation log
            await supabase.from('ai_conversation_logs').insert({
              business_id: phone.business_id,
              conversation_id: conversation!.id,
              detected_intent: aiResponse.intent,
              ai_response: aiResponse.text,
              confidence: aiResponse.confidence,
              escalated: aiResponse.escalated,
            })
          }
        } catch (aiError) {
          console.error('[webhook] AI agent error:', aiError)
          // Don't fail the webhook — the message is already saved
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── SESSION STATUS EVENT ──────────────────────────
    if (body.event === 'session.status') {
      const session = body.payload?.name || body.session
      const wahaStatus = body.payload?.status as string

      const dbStatus = wahaStatus === 'WORKING' ? 'connected' : 'disconnected'

      const { error } = await supabase
        .from('phone_numbers')
        .update({
          status: dbStatus,
          last_health_check: new Date().toISOString(),
        })
        .eq('session_id', session)

      if (error) {
        console.error('[webhook] Failed to update session status:', error)
      }

      return NextResponse.json({ ok: true })
    }

    // ── MESSAGE ACK EVENT ─────────────────────────────
    if (body.event === 'message.ack') {
      const ack = body.payload?.ack as number
      const messageId = body.payload?.id as string

      const ackMap: Record<number, string> = {
        1: 'sent',
        2: 'delivered',
        3: 'read',
        4: 'read',
      }

      const status = ackMap[ack] || 'sent'

      if (messageId) {
        const { error } = await supabase
          .from('messages')
          .update({ status })
          .eq('provider_message_id', messageId)

        if (error) {
          console.error('[webhook] Failed to update message ack:', error)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Unknown event — acknowledge anyway
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook] Unhandled error:', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    )
  }
}
