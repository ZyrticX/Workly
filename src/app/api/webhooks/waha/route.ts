import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processAIAgent, ERROR_MESSAGES } from '@/lib/ai/agent-prompt'
import { whatsapp } from '@/lib/waha/provider'
import { logError } from '@/lib/utils/error-logger'

// ── Common English→Hebrew name transliteration ─────────

const NAME_MAP: Record<string, string> = {
  // Male names
  'david': 'דוד', 'daniel': 'דניאל', 'michael': 'מיכאל', 'moshe': 'משה', 'moses': 'משה',
  'yosef': 'יוסף', 'joseph': 'יוסף', 'avraham': 'אברהם', 'abraham': 'אברהם',
  'yakov': 'יעקב', 'jacob': 'יעקב', 'avi': 'אבי', 'eli': 'אלי', 'alon': 'אלון',
  'omer': 'עומר', 'omar': 'עומר', 'noam': 'נועם', 'adam': 'אדם', 'ben': 'בן',
  'tom': 'תום', 'guy': 'גיא', 'roi': 'רועי', 'roee': 'רועי', 'idan': 'עידן',
  'itay': 'איתי', 'itai': 'איתי', 'yonatan': 'יונתן', 'jonathan': 'יונתן',
  'ori': 'אורי', 'eyal': 'אייל', 'oren': 'אורן', 'yuval': 'יובל',
  'tomer': 'תומר', 'shahar': 'שחר', 'dor': 'דור', 'lior': 'ליאור',
  'matan': 'מתן', 'nir': 'ניר', 'gal': 'גל', 'amir': 'אמיר',
  'elad': 'אלעד', 'gilad': 'גלעד', 'ido': 'עידו', 'amit': 'עמית',
  'ofir': 'אופיר', 'ariel': 'אריאל', 'ron': 'רון', 'yaron': 'ירון',
  'ilan': 'אילן', 'boaz': 'בועז', 'nadav': 'נדב', 'assaf': 'אסף',
  'eran': 'ערן', 'tal': 'טל', 'shai': 'שי', 'shay': 'שי',
  'evgeny': 'יבגני', 'evgeniy': 'יבגני', 'ivgi': 'יבגני',
  'alex': 'אלכס', 'max': 'מקס', 'mark': 'מרק', 'vlad': 'ולד',
  // Female names
  'sarah': 'שרה', 'sara': 'שרה', 'michal': 'מיכל', 'rachel': 'רחל',
  'noa': 'נועה', 'maya': 'מאיה', 'shira': 'שירה', 'dana': 'דנה',
  'yael': 'יעל', 'tamar': 'תמר', 'mor': 'מור', 'hadar': 'הדר',
  'noy': 'נוי', 'lee': 'לי', 'chen': 'חן', 'shani': 'שני',
  'inbar': 'ענבר', 'orit': 'אורית', 'osnat': 'אסנת', 'keren': 'קרן',
  'efrat': 'אפרת', 'sigal': 'סיגל', 'orly': 'אורלי', 'merav': 'מירב',
  'anna': 'אנה', 'maria': 'מריה', 'lena': 'לנה', 'natasha': 'נטשה',
  'olga': 'אולגה', 'svetlana': 'סבטלנה', 'irina': 'אירינה',
}

function transliterateToHebrew(name: string): string {
  // Already Hebrew? Return as-is
  if (/[\u0590-\u05FF]/.test(name)) return name

  // Try exact match (case-insensitive)
  const parts = name.trim().split(/\s+/)
  const transliterated = parts.map(part => {
    const lower = part.toLowerCase().replace(/[^a-z]/g, '')
    return NAME_MAP[lower] || part // Keep original if no match
  })

  const result = transliterated.join(' ')
  // If at least one part was transliterated, return Hebrew version
  return result !== name ? result : name
}

// ── Webhook Handler for WAHA ────────────────────────────
// Uses service client — webhooks have no auth context.

// ── Conversation-level mutex (Redis-backed) to prevent double responses ──
import { getRedis } from '@/lib/cache/redis'
import { checkInput, checkRateLimit, stripPII } from '@/lib/ai/guards'

interface PendingMessage {
  businessId: string
  contactId: string
  contactName: string
  contactStatus: string
  contactPhone: string
  chatId: string
  sessionId: string
}

const LOCK_TTL_MS = 30_000 // 30s max lock duration

async function acquireLock(conversationId: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const result = await redis.set(`lock:conv:${conversationId}`, Date.now().toString(), 'PX', LOCK_TTL_MS, 'NX')
    return result === 'OK'
  } catch {
    return true // Redis down → allow through (graceful degradation)
  }
}

async function releaseLock(conversationId: string): Promise<void> {
  try {
    const redis = getRedis()
    await redis.del(`lock:conv:${conversationId}`)
  } catch {
    // Lock auto-expires via PX
  }
}

async function pushPending(conversationId: string, data: PendingMessage): Promise<void> {
  try {
    const redis = getRedis()
    await redis.set(`pending:${conversationId}`, JSON.stringify(data), 'EX', 300)
  } catch {}
}

async function popPending(conversationId: string): Promise<PendingMessage | null> {
  try {
    const redis = getRedis()
    const raw = await redis.getdel(`pending:${conversationId}`)
    return raw ? JSON.parse(raw) as PendingMessage : null
  } catch {
    return null
  }
}

// ── Error counter helpers ───────────────────────────────

/** Increment consecutive error count. If 3+, auto-disable bot and notify owner. */
async function incrementErrorCounter(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
  businessId: string
): Promise<void> {
  try {
    // Use RPC or raw update to atomically increment
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, error_count, is_bot_active')
      .eq('id', conversationId)
      .eq('business_id', businessId)
      .single()

    const newCount = (conv?.error_count ?? 0) + 1

    await supabase
      .from('conversations')
      .update({ error_count: newCount })
      .eq('id', conversationId)

    if (newCount >= 3 && conv?.is_bot_active) {
      // Auto-disable bot
      await supabase
        .from('conversations')
        .update({ is_bot_active: false, error_count: 0 })
        .eq('id', conversationId)

      // Notify business owner
      await supabase.from('notifications').insert({
        business_id: businessId,
        type: 'system',
        title: 'בוט כובה אוטומטית',
        body: ERROR_MESSAGES.BOT_AUTO_DISABLED,
        metadata: { conversation_id: conversationId, error_count: newCount },
      })

      console.warn(`[webhook] Bot auto-disabled for conversation ${conversationId} after ${newCount} consecutive errors`)
    }
  } catch (counterErr) {
    // Don't let the error counter itself crash the webhook
    console.error('[webhook] Failed to update error counter:', counterErr)
  }
}

/** Reset error counter on success */
async function resetErrorCounter(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string
): Promise<void> {
  try {
    await supabase
      .from('conversations')
      .update({ error_count: 0 })
      .eq('id', conversationId)
  } catch {
    // Non-critical, ignore
  }
}

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

      // Skip WhatsApp Status/Stories broadcasts
      if (rawFrom === 'status@broadcast') {
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

      // 2. Find or create contact — SINGLE query with OR for all possible matches
      const phoneFormatted = !isLid && from.startsWith('972') ? '0' + from.slice(3) : ''
      const searchConditions = [`wa_id.eq.${chatId}`, `wa_id.eq.${from}`]
      if (phoneFormatted) searchConditions.push(`phone.eq.${phoneFormatted}`, `phone.eq.${from}`)

      let { data: contactResults } = await supabase
        .from('contacts')
        .select('id, business_id, wa_id, phone, name, status')
        .eq('business_id', phone.business_id)
        .or(searchConditions.join(','))
        .limit(1)

      let contact = contactResults?.[0] || null

      // Migrate wa_id if found by legacy format
      if (contact && contact.wa_id !== chatId) {
        await supabase.from('contacts').update({ wa_id: chatId }).eq('id', contact.id)
      }

      // Extract WhatsApp display name
      const whatsappName = (payload.notifyName as string) || ''

      if (!contact) {
        // Format phone: 972xx → 0xx for display, LID → empty
        let contactPhone = ''
        if (!isLid && from) {
          if (from.startsWith('972') && from.length >= 12) {
            contactPhone = '0' + from.slice(3)
          } else {
            contactPhone = from
          }
        }

        // Use WhatsApp display name, transliterated to Hebrew
        const rawName = whatsappName || (isLid ? `לקוח ${from.slice(-4)}` : contactPhone)
        const displayName = transliterateToHebrew(rawName)

        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            business_id: phone.business_id,
            wa_id: chatId,
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

        if (!newContact) {
          console.error('[webhook] Contact insert returned null')
          return NextResponse.json({ error: 'contact creation failed' }, { status: 500 })
        }
        contact = newContact

        // Notify business owner about new contact
        await supabase.from('notifications').insert({
          business_id: phone.business_id,
          type: 'new_contact',
          title: 'לקוח/ה חדש/ה',
          body: `${newContact!.name} פנה/תה אליך לראשונה בוואטסאפ`,
          metadata: { contact_id: newContact!.id },
        })
      }

      // Update name from WhatsApp if current name is a placeholder
      if (contact && whatsappName && whatsappName.length > 1) {
        const currentName = contact.name || ''
        const isPlaceholder = !currentName
          || /^\d+$/.test(currentName)
          || /^[\d\s]+$/.test(currentName)
          || currentName.startsWith('לקוח')
          || currentName.startsWith('972')
          || currentName.startsWith('05')
          || /^\+?\d{7,}/.test(currentName)
        if (isPlaceholder && whatsappName !== currentName) {
          // Transliterate English name to Hebrew if needed
          const finalName = transliterateToHebrew(whatsappName)
          await supabase.from('contacts').update({ name: finalName }).eq('id', contact.id)
          contact.name = finalName
          console.log(`[webhook] Updated contact name: "${currentName}" → "${finalName}"${finalName !== whatsappName ? ` (from "${whatsappName}")` : ''}`)
        }
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
        // If it's a duplicate (unique constraint), skip silently — WAHA sent twice
        if (msgError.code === '23505' || msgError.message?.includes('duplicate')) {
          console.log(`[webhook] Duplicate message skipped: ${payload.id}`)
          return NextResponse.json({ ok: true, skipped: 'duplicate' })
        }
        console.error('[webhook] Failed to save message:', msgError)
        await logError({
          businessId: phone.business_id,
          source: 'webhook',
          severity: 'critical',
          message: `Message save failed: ${msgError.message}`,
          contactName: contact?.name || from,
        })
        return NextResponse.json({ error: 'message save failed' }, { status: 500 })
      }

      // 5. Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation!.id)

      // 6. Run AI agent if bot is active
      if (conversation!.is_bot_active) {
        const convId = conversation!.id

        // ── Mutex: prevent double responses from simultaneous webhooks ──
        if (!(await acquireLock(convId))) {
          // Message already saved to DB above — mark as pending so we process it after current request finishes
          await pushPending(convId, {
            businessId: phone.business_id,
            contactId: contact!.id,
            contactName: contact!.name || from,
            contactStatus: contact!.status || 'new',
            contactPhone: contact!.phone || '',
            chatId,
            sessionId: phone.session_id!,
          })
          console.log(`[webhook] Conversation ${convId} is busy — message saved, will process after current finishes`)
          return NextResponse.json({ ok: true })
        }

        try {
          // ── Guards: rate limit + input check ──
          const rateResult = await checkRateLimit(contact!.id)
          if (!rateResult.allowed) {
            await whatsapp.sendMessage(phone.session_id!, chatId, rateResult.message!)
            await releaseLock(convId)
            return NextResponse.json({ ok: true })
          }

          const inputCheck = checkInput(messageContent)
          if (inputCheck.flagged) {
            console.warn(`[webhook] Prompt injection blocked from ${contact?.name || from}`)
          }

          const aiResponse = await processAIAgent({
            businessId: phone.business_id,
            conversationId: convId,
            contactId: contact!.id,
            message: inputCheck.flagged ? 'שלום' : messageContent,
            contactName: contact!.name || from,
            contactStatus: contact!.status || 'new',
            contactPhone: contact!.phone || '',
          })

          if (aiResponse && aiResponse.text) {
            const safeText = stripPII(aiResponse.text)
            // Send response via WAHA - use chatId (with @c.us or @lid suffix)
            try {
              await whatsapp.sendMessage(
                phone.session_id!,
                chatId,
                safeText
              )
            } catch (sendError) {
              // WAHA sendMessage failed — save message as 'failed', notify owner
              console.error('[webhook] WAHA sendMessage failed:', sendError)
              await logError({
                businessId: phone.business_id,
                source: 'webhook',
                severity: 'error',
                message: `WAHA send failed: ${sendError instanceof Error ? sendError.message : 'unknown'}`,
                contactName: contact?.name || from,
              })

              await supabase.from('messages').insert({
                business_id: phone.business_id,
                conversation_id: convId,
                direction: 'outbound',
                sender_type: 'ai',
                type: 'text',
                content: safeText,
                status: 'failed',
              })

              await supabase.from('notifications').insert({
                business_id: phone.business_id,
                type: 'system',
                title: 'שליחת הודעה נכשלה',
                body: `לא הצלחנו לשלוח הודעה ללקוח ${contact!.name || from}. בדוק את חיבור הוואטסאפ.`,
                metadata: {
                  conversation_id: convId,
                  contact_id: contact!.id,
                  error: sendError instanceof Error ? sendError.message : String(sendError),
                },
              })

              await incrementErrorCounter(supabase, convId, phone.business_id)
              return NextResponse.json({ ok: true })
            }

            // Save outgoing AI message (success)
            await supabase.from('messages').insert({
              business_id: phone.business_id,
              conversation_id: convId,
              direction: 'outbound',
              sender_type: 'ai',
              type: 'text',
              content: safeText,
              status: 'sent',
            })

            // Save AI conversation log
            await supabase.from('ai_conversation_logs').insert({
              business_id: phone.business_id,
              conversation_id: convId,
              detected_intent: aiResponse.intent,
              ai_response: safeText,
              confidence: aiResponse.confidence,
              escalated: aiResponse.escalated,
            })

            // Reset error counter on successful response
            await resetErrorCounter(supabase, convId)
          }
        } catch (aiError) {
          console.error('[webhook] AI agent error:', aiError)

          // Log to error_logs + send WhatsApp alert for critical errors
          await logError({
            businessId: phone.business_id,
            source: 'webhook',
            severity: 'critical',
            message: aiError instanceof Error ? aiError.message : 'AI agent crash',
            contactName: contact?.name || from,
            details: { conversationId: convId, message: messageContent?.slice(0, 100) },
          })

          // Send a fallback message to the customer so they aren't left hanging
          try {
            await whatsapp.sendMessage(
              phone.session_id!,
              chatId,
              ERROR_MESSAGES.WEBHOOK_FALLBACK
            )

            // Save the fallback message
            await supabase.from('messages').insert({
              business_id: phone.business_id,
              conversation_id: convId,
              direction: 'outbound',
              sender_type: 'ai',
              type: 'text',
              content: ERROR_MESSAGES.WEBHOOK_FALLBACK,
              status: 'sent',
            })
          } catch (fallbackError) {
            console.error('[webhook] Failed to send fallback message:', fallbackError)
          }

          // Increment error counter (may auto-disable bot)
          await incrementErrorCounter(supabase, convId, phone.business_id)
        } finally {
          await releaseLock(convId)

          // Check if new messages arrived while we were processing
          const pending = await popPending(convId)
          if (pending) {
            // Re-acquire lock and process the latest unread message
            if (await acquireLock(convId)) {
              try {
                // Get the latest inbound message that has no AI response after it
                const { data: latestMsg } = await supabase
                  .from('messages')
                  .select('content')
                  .eq('conversation_id', convId)
                  .eq('direction', 'inbound')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single()

                if (latestMsg?.content) {
                  console.log(`[webhook] Processing pending message for ${convId}: "${latestMsg.content.slice(0, 50)}"`)
                  const pendingResponse = await processAIAgent({
                    businessId: pending.businessId,
                    conversationId: convId,
                    contactId: pending.contactId,
                    message: latestMsg.content,
                    contactName: pending.contactName,
                    contactStatus: pending.contactStatus,
                    contactPhone: pending.contactPhone,
                  })

                  if (pendingResponse?.text) {
                    const safePendingText = stripPII(pendingResponse.text)
                    try {
                      await whatsapp.sendMessage(pending.sessionId, pending.chatId, safePendingText)
                    } catch (sendErr) {
                      console.error('[webhook] Failed to send pending response:', sendErr)
                    }

                    await supabase.from('messages').insert({
                      business_id: pending.businessId,
                      conversation_id: convId,
                      direction: 'outbound',
                      sender_type: 'ai',
                      type: 'text',
                      content: safePendingText,
                      status: 'sent',
                    })
                  }
                }
              } catch (pendingErr) {
                console.error('[webhook] Failed to process pending message:', pendingErr)
              } finally {
                await releaseLock(convId)
              }
            }
          }
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── SESSION STATUS EVENT ──────────────────────────
    if (body.event === 'session.status') {
      const session = body.payload?.name || body.session
      const wahaStatus = body.payload?.status as string

      const dbStatus = wahaStatus === 'WORKING' ? 'connected' : 'disconnected'

      // If WORKING, try to get the real phone number from WAHA
      const updateData: Record<string, unknown> = {
        status: dbStatus,
        last_health_check: new Date().toISOString(),
      }

      if (wahaStatus === 'WORKING') {
        try {
          const wahaUrl = process.env.WAHA_API_URL || 'http://localhost:3000'
          const wahaKey = process.env.WAHA_API_KEY || ''
          const sessionRes = await fetch(`${wahaUrl}/api/sessions/${session}`, {
            headers: { 'X-Api-Key': wahaKey },
          })
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json()
            const phoneId = sessionData?.me?.id as string | undefined
            if (phoneId) {
              // Extract phone number from "972547530955@c.us"
              const realPhone = phoneId.replace('@c.us', '').replace('@lid', '')
              if (realPhone && !/^temp_/.test(realPhone)) {
                updateData.phone_number = realPhone
              }
            }
          }
        } catch { /* ignore - just update status */ }
      }

      const { error } = await supabase
        .from('phone_numbers')
        .update(updateData)
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
