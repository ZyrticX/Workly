# מחקר מעמיק: WAHA Plus, Data Pipeline, וסנכרון Frontend
## חלק ב' של מחקר ארכיטקטורת AI Agent

> **תאריך**: מרץ 2026
> **מותאם ל**: WAHA Plus + Supabase Realtime + Next.js

---

# חלק א': WAHA Plus — שימוש נכון ומקצועי

## 1. כל ה-API Endpoints של WAHA Plus

### Sessions API — ניהול סשנים

```
POST   /api/sessions/            → יצירת סשן חדש
GET    /api/sessions/            → רשימת כל הסשנים
GET    /api/sessions/{session}   → פרטי סשן ספציפי
PUT    /api/sessions/{session}   → עדכון הגדרות סשן
DELETE /api/sessions/{session}   → מחיקת סשן
POST   /api/sessions/{session}/start   → הפעלת סשן
POST   /api/sessions/{session}/stop    → עצירת סשן (עם אופציה ל-logout)
POST   /api/sessions/{session}/restart → הפעלה מחדש
POST   /api/sessions/{session}/logout  → התנתקות (מוחק credentials)
```

**יצירת סשן מלא (מומלץ):**

```typescript
// src/lib/waha/waha-client.ts - improved
async createSession(sessionName: string, businessId: string, webhookUrl: string) {
  return await fetch(`${this.baseUrl}/api/sessions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': this.apiKey
    },
    body: JSON.stringify({
      name: sessionName,
      start: true,
      config: {
        // === Webhooks ===
        webhooks: [{
          url: webhookUrl,
          events: [
            'message',           // הודעות נכנסות
            'message.any',       // כל הודעה (כולל שלנו) - לסנכרון
            'message.ack',       // אישורי קריאה
            'message.reaction',  // תגובות אימוג'י
            'message.edited',    // הודעות ערוכות
            'message.revoked',   // הודעות שנמחקו
            'session.status',    // שינויי סטטוס חיבור
            'presence.update',   // סטטוס typing / online
          ],
          hmac: {
            key: process.env.WAHA_WEBHOOK_SECRET || 'your-secret-key'
          },
          retries: {
            policy: 'exponential',   // constant | linear | exponential
            delaySeconds: 2,
            attempts: 10
          },
          customHeaders: [
            { name: 'X-Business-Id', value: businessId }
          ]
        }],

        // === Session Settings ===
        // WAHA Plus: התעלם מ-Status / Groups / Channels (רק DMs)
        noweb: {
          store: {
            enabled: true,         // שמור state לדיסק
            fullSync: false        // לא צריך סנכרון מלא
          }
        },

        // מטאדאטה מותאם
        metadata: {
          'business.id': businessId
        }
      }
    })
  });
}
```

### Messages API — שליחת הודעות

```
POST /api/sendText              → שליחת הודעת טקסט
POST /api/sendImage             → שליחת תמונה
POST /api/sendFile              → שליחת קובץ
POST /api/sendVoice             → שליחת הודעה קולית
POST /api/sendVideo             → שליחת וידאו
POST /api/sendLocation          → שליחת מיקום
POST /api/sendContactVcard      → שליחת כרטיס איש קשר
POST /api/sendButtons           → שליחת כפתורים (מוגבל)
POST /api/sendPoll              → שליחת סקר
POST /api/reply                 → מענה להודעה ספציפית
POST /api/forwardMessage        → העברת הודעה
POST /api/{session}/messages/{id}/react → תגובת אימוג'י
POST /api/{session}/messages/{id}/star  → סימון בכוכב
```

### Presence API — typing וסטטוס

```
PUT  /api/{session}/presence      → הגדרת presence (online/offline)
POST /api/startTyping             → התחלת typing
POST /api/stopTyping              → עצירת typing
GET  /api/{session}/presence/{chatId} → קבלת סטטוס של צ'אט
```

### Chats API — ניהול צ'אטים

```
GET    /api/{session}/chats             → רשימת צ'אטים
GET    /api/{session}/chats/{chatId}    → פרטי צ'אט
DELETE /api/{session}/chats/{chatId}    → מחיקת צ'אט
POST   /api/{session}/chats/{chatId}/archive   → ארכוב
POST   /api/{session}/chats/{chatId}/unarchive → ביטול ארכוב
GET    /api/{session}/chats/{chatId}/messages   → היסטוריית הודעות
POST   /api/sendSeen                    → סימון כנקרא
```

### Contacts API

```
GET    /api/contacts                      → כל אנשי קשר
GET    /api/contacts?contactId=XXX        → איש קשר ספציפי
GET    /api/{session}/contacts/{id}/profile-picture → תמונת פרופיל
POST   /api/contacts/check-exists         → בדיקת קיום מספר בוואטסאפ
```

### Labels API (WAHA Plus)

```
GET    /api/{session}/labels              → כל התגיות
PUT    /api/{session}/labels              → יצירה/עדכון תגית
DELETE /api/{session}/labels/{id}         → מחיקת תגית
PUT    /api/{session}/labels/{id}/chats/{chatId}    → הוספת תגית לצ'אט
DELETE /api/{session}/labels/{id}/chats/{chatId}    → הסרת תגית מצ'אט
```

## 2. ChatID Format — הנקודה הקריטית

### הבעיה: `@c.us` vs `@lid`

WhatsApp עובר למערכת LID (Linked ID) חדשה. זה אומר:

```
@c.us  = פורמט ישן, מבוסס מספר טלפון: 972501234567@c.us
@lid   = פורמט חדש, מזהה פנימי: ABC123DEF456@lid
@g.us  = קבוצות: 120363012345@g.us
```

**הפתרון שלך צריך לתמוך בשניהם:**

```typescript
// src/lib/waha/contact-resolver.ts

interface ContactIdentifier {
  wa_id: string;          // המזהה הגולמי מ-WAHA (יכול להיות @c.us או @lid)
  phone: string | null;   // מספר טלפון (אם זמין)
  pushName: string | null; // שם תצוגה מ-WhatsApp
}

/**
 * מנרמל chatId מ-WAHA לפורמט אחיד לשמירה ב-DB
 */
function normalizeContactId(rawId: string): ContactIdentifier {
  // Remove @c.us or @lid suffix for phone extraction
  if (rawId.endsWith('@c.us')) {
    const phone = rawId.replace('@c.us', '');
    return {
      wa_id: rawId,
      phone: formatPhoneNumber(phone), // +972-50-123-4567
      pushName: null
    };
  }

  if (rawId.endsWith('@lid')) {
    // LID format - phone not directly available
    return {
      wa_id: rawId,
      phone: null,  // נצטרך לפתור דרך WAHA contacts API
      pushName: null
    };
  }

  // Fallback: assume it's a phone number
  return {
    wa_id: rawId.includes('@') ? rawId : `${rawId}@c.us`,
    phone: rawId.replace(/[^0-9]/g, ''),
    pushName: null
  };
}

/**
 * פתרון LID → Phone Number
 * WAHA Plus מאפשר לבדוק contacts
 */
async function resolveLidToPhone(
  sessionId: string,
  lidId: string
): Promise<string | null> {
  try {
    const response = await waha.getContact(sessionId, lidId);
    return response?.number || null;
  } catch {
    return null;
  }
}

/**
 * מוצא או יוצר contact ב-DB מנתוני WAHA
 */
async function findOrCreateContact(
  businessId: string,
  identifier: ContactIdentifier,
  pushName: string | null
): Promise<Contact> {
  const supabase = createServiceClient();

  // Strategy 1: חפש לפי wa_id (הכי מדויק)
  let { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('business_id', businessId)
    .eq('wa_id', identifier.wa_id)
    .single();

  if (contact) {
    // עדכן שם אם חדש
    if (pushName && (!contact.name || contact.name === 'לא ידוע')) {
      await supabase
        .from('contacts')
        .update({ name: pushName })
        .eq('id', contact.id);
      contact.name = pushName;
    }
    return contact;
  }

  // Strategy 2: חפש לפי phone (למקרה שהתחלף format)
  if (identifier.phone) {
    const cleanPhone = identifier.phone.replace(/[^0-9]/g, '');
    const { data: phoneContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('business_id', businessId)
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone},wa_id.eq.${cleanPhone}@c.us`)
      .single();

    if (phoneContact) {
      // עדכן wa_id לפורמט החדש
      await supabase
        .from('contacts')
        .update({ wa_id: identifier.wa_id })
        .eq('id', phoneContact.id);
      return phoneContact;
    }
  }

  // Strategy 3: צור contact חדש
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      business_id: businessId,
      wa_id: identifier.wa_id,
      phone: identifier.phone,
      name: pushName || 'לא ידוע',
      status: 'new',
      tags: [],
      total_visits: 0,
      total_revenue: 0
    })
    .select()
    .single();

  if (error) throw error;
  return newContact!;
}
```

## 3. Typing Simulation — לגרום לבוט להרגיש אנושי

```typescript
// src/lib/waha/human-simulation.ts

/**
 * שולח הודעה עם סימולציית typing אנושית
 * זה קריטי — בלי זה הלקוחה תרגיש שמדברת עם בוט
 */
async function sendWithTypingSimulation(
  sessionId: string,
  chatId: string,
  text: string,
  options: {
    minTypingMs?: number;    // מינימום זמן typing
    maxTypingMs?: number;    // מקסימום
    charsPerSecond?: number; // מהירות הקלדה
  } = {}
): Promise<void> {
  const {
    minTypingMs = 1000,
    maxTypingMs = 5000,
    charsPerSecond = 30
  } = options;

  // חשב זמן typing ריאליסטי לפי אורך ההודעה
  const estimatedMs = Math.round((text.length / charsPerSecond) * 1000);
  const typingDuration = Math.min(
    Math.max(estimatedMs, minTypingMs),
    maxTypingMs
  );

  // 1. סמן כנקרא (כמו בן אדם שפותח את ההודעה)
  await waha.sendSeen(sessionId, chatId);

  // 2. המתן קצת (כמו בן אדם שקורא)
  await delay(500 + Math.random() * 1000);

  // 3. התחל typing
  await waha.startTyping(sessionId, chatId);

  // 4. המתן (כמו בן אדם שמקליד)
  await delay(typingDuration);

  // 5. עצור typing ושלח
  await waha.stopTyping(sessionId, chatId);
  await waha.sendText(sessionId, chatId, text);
}

/**
 * לפיצול הודעות ארוכות — כמו בן אדם אמיתי
 * (אנשים לא שולחים הודעות של 500 תווים, הם שולחים כמה הודעות קצרות)
 */
async function sendLongMessage(
  sessionId: string,
  chatId: string,
  text: string
): Promise<void> {
  // אם ההודעה קצרה - שלח ישר
  if (text.length < 200) {
    await sendWithTypingSimulation(sessionId, chatId, text);
    return;
  }

  // פצל לפי שורות ריקות או ניקוד
  const parts = splitMessage(text);

  for (let i = 0; i < parts.length; i++) {
    await sendWithTypingSimulation(sessionId, chatId, parts[i], {
      minTypingMs: i === 0 ? 1500 : 800,  // הודעה ראשונה - יותר typing
      maxTypingMs: 4000
    });

    // המתנה קצרה בין הודעות
    if (i < parts.length - 1) {
      await delay(300 + Math.random() * 700);
    }
  }
}

function splitMessage(text: string, maxLength = 180): string[] {
  // פצל לפי \n\n (פסקאות)
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  if (paragraphs.length > 1 && paragraphs.every(p => p.length < maxLength)) {
    return paragraphs;
  }

  // פצל לפי משפטים
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const parts: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current.length > 0) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.length > 0 ? parts : [text];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 4. WAHA Webhook Handler — הלב של המערכת

```typescript
// src/app/api/webhooks/waha/route.ts — IMPROVED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { processAIAgentV2 } from '@/lib/ai/agent-prompt-v2';
import { sendWithTypingSimulation } from '@/lib/waha/human-simulation';
import { findOrCreateContact, normalizeContactId } from '@/lib/waha/contact-resolver';
import { createHmac } from 'crypto';

// ==========================================
// WEBHOOK SECURITY
// ==========================================

function verifyHmac(body: string, signature: string | null): boolean {
  if (!process.env.WAHA_WEBHOOK_SECRET) return true; // no HMAC configured
  if (!signature) return false;

  const expected = createHmac('sha512', process.env.WAHA_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return signature === expected;
}

// ==========================================
// DEDUPLICATION — מניעת הודעות כפולות
// ==========================================

// Cache בזיכרון למניעת כפילויות (WAHA שולח לפעמים duplicate לאנשי קשר חדשים)
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 60_000; // 60 שניות

function isDuplicate(messageId: string): boolean {
  const now = Date.now();

  // ניקוי ישנים
  if (processedMessages.size > 1000) {
    for (const [key, timestamp] of processedMessages) {
      if (now - timestamp > DEDUP_TTL_MS) processedMessages.delete(key);
    }
  }

  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

// ==========================================
// MAIN WEBHOOK HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const rawBody = await request.text();

  // === STEP 1: Security Verification ===
  const hmacSignature = request.headers.get('x-webhook-hmac');
  if (!verifyHmac(rawBody, hmacSignature)) {
    console.error('HMAC verification failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // === STEP 2: Route by event type ===
  try {
    switch (event.event) {
      case 'message':
        return await handleIncomingMessage(event);

      case 'message.any':
        return await handleMessageAny(event);

      case 'message.ack':
        return await handleMessageAck(event);

      case 'message.reaction':
        return await handleReaction(event);

      case 'message.edited':
        return await handleMessageEdited(event);

      case 'message.revoked':
        return await handleMessageRevoked(event);

      case 'session.status':
        return await handleSessionStatus(event);

      case 'presence.update':
        return await handlePresenceUpdate(event);

      default:
        // Log but don't fail on unknown events
        console.log(`Unhandled webhook event: ${event.event}`);
        return NextResponse.json({ status: 'ignored' });
    }
  } catch (error) {
    console.error(`Webhook error [${event.event}]:`, error);

    // Log to webhook_logs for debugging
    await logWebhookError(event, error);

    // IMPORTANT: Return 200 even on error to prevent WAHA retries
    // on errors we can't fix (bad data, etc.)
    return NextResponse.json({ status: 'error', message: String(error) });
  } finally {
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      console.warn(`Slow webhook processing: ${event.event} took ${duration}ms`);
    }
  }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handleIncomingMessage(event: WebhookEvent) {
  const payload = event.payload;
  const sessionName = event.session;

  // --- Filters ---
  // התעלם מהודעות ממני (message.any מטפל בזה)
  if (payload.fromMe) return NextResponse.json({ status: 'ignored_own' });

  // התעלם מהודעות מקבוצות
  if (payload.from?.endsWith('@g.us')) return NextResponse.json({ status: 'ignored_group' });

  // התעלם מ-status broadcast
  if (payload.from === 'status@broadcast') return NextResponse.json({ status: 'ignored_status' });

  // Deduplication
  if (isDuplicate(payload.id)) return NextResponse.json({ status: 'duplicate' });

  const supabase = createServiceClient();

  // --- Resolve business ---
  const { data: phoneRecord } = await supabase
    .from('phone_numbers')
    .select('business_id, business:businesses(name, status)')
    .eq('session_id', sessionName)
    .eq('status', 'connected')
    .single();

  if (!phoneRecord) {
    console.error(`No business found for session: ${sessionName}`);
    return NextResponse.json({ status: 'no_business' });
  }

  const businessId = phoneRecord.business_id;

  // --- Resolve contact ---
  const identifier = normalizeContactId(payload.from);
  const pushName = payload._data?.notifyName || payload.pushName || null;
  const contact = await findOrCreateContact(businessId, identifier, pushName);

  // --- Resolve conversation ---
  const conversation = await findOrCreateConversation(supabase, businessId, contact.id);

  // --- Save inbound message ---
  const messageContent = extractMessageContent(payload);
  const savedMessage = await saveMessage(supabase, {
    conversation_id: conversation.id,
    direction: 'inbound',
    sender_type: 'customer',
    type: messageContent.type,
    content: messageContent.text,
    media_url: messageContent.mediaUrl,
    provider_message_id: payload.id,
    status: 'delivered'
  });

  // --- Update conversation timestamp ---
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), status: 'active' })
    .eq('id', conversation.id);

  // --- Create notification for business owner ---
  await createNotification(supabase, businessId, {
    type: 'new_message',
    title: `הודעה חדשה מ${contact.name || 'לקוח/ה'}`,
    body: messageContent.text?.substring(0, 100) || '[מדיה]',
    data: { conversation_id: conversation.id, contact_id: contact.id }
  });

  // --- AI Processing (if bot is active) ---
  if (conversation.is_bot_active) {
    try {
      // Load recent messages for context
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(15);

      const messageHistory = (recentMessages || []).reverse();

      // Process through AI Agent
      const aiResponse = await processAIAgentV2({
        businessId,
        contactId: contact.id,
        conversationId: conversation.id,
        message: messageContent.text || '',
        messageHistory
      });

      // Send response with typing simulation
      if (aiResponse.text && !aiResponse.escalated) {
        await sendWithTypingSimulation(
          sessionName,
          payload.from,   // Use original chatId format for WAHA
          aiResponse.text
        );

        // Save outbound AI message
        await saveMessage(supabase, {
          conversation_id: conversation.id,
          direction: 'outbound',
          sender_type: 'ai',
          type: 'text',
          content: aiResponse.text,
          status: 'sent'
        });

        // Save AI log
        await supabase.from('ai_conversation_logs').insert({
          conversation_id: conversation.id,
          detected_intent: aiResponse.intent,
          ai_response: aiResponse.text,
          confidence: aiResponse.confidence,
          escalated: aiResponse.escalated,
          action_taken: aiResponse.action?.type || null,
          metadata: {
            secondary_intents: aiResponse.secondary_intents,
            extracted_data: aiResponse.extracted_data,
            processing_time_ms: Date.now() - startTime
          }
        });
      }

      // Handle escalation
      if (aiResponse.escalated) {
        await supabase
          .from('conversations')
          .update({ is_bot_active: false, status: 'waiting' })
          .eq('id', conversation.id);

        await createNotification(supabase, businessId, {
          type: 'escalation',
          title: `⚠️ נדרשת התערבות - ${contact.name || 'לקוח/ה'}`,
          body: `הבוט העביר את השיחה אליך. סיבה: ${aiResponse.intent}`,
          data: { conversation_id: conversation.id, urgent: true }
        });
      }

    } catch (aiError) {
      console.error('AI processing error:', aiError);
      // Log but don't fail - the message is already saved
      await logAIError(supabase, conversation.id, aiError);
    }
  }

  return NextResponse.json({ status: 'processed' });
}

/**
 * message.any — כל הודעה, כולל הודעות שלנו
 * שימוש: סנכרון הודעות שנשלחו ידנית מהטלפון של בעלת העסק
 */
async function handleMessageAny(event: WebhookEvent) {
  const payload = event.payload;

  // רק הודעות שלנו שנשלחו מהטלפון (לא דרך ה-API)
  if (!payload.fromMe) return NextResponse.json({ status: 'ignored' });

  // התעלם אם זו הודעה שנשלחה דרך WAHA (כבר שמרנו אותה)
  if (isDuplicate(payload.id)) return NextResponse.json({ status: 'duplicate' });

  const supabase = createServiceClient();
  const sessionName = event.session;

  // מצא business
  const { data: phoneRecord } = await supabase
    .from('phone_numbers')
    .select('business_id')
    .eq('session_id', sessionName)
    .single();

  if (!phoneRecord) return NextResponse.json({ status: 'no_business' });

  // מצא contact (ההודעה נשלחה אליו)
  const chatId = payload.to || payload.from;
  if (!chatId || chatId.endsWith('@g.us') || chatId === 'status@broadcast') {
    return NextResponse.json({ status: 'ignored' });
  }

  const identifier = normalizeContactId(chatId);
  const contact = await findOrCreateContact(phoneRecord.business_id, identifier, null);
  const conversation = await findOrCreateConversation(
    supabase, phoneRecord.business_id, contact.id
  );

  // שמור כהודעה ידנית של בעלת העסק
  await saveMessage(supabase, {
    conversation_id: conversation.id,
    direction: 'outbound',
    sender_type: 'human',  // חשוב! זה מבדיל מ-'ai'
    type: extractMessageContent(payload).type,
    content: extractMessageContent(payload).text,
    provider_message_id: payload.id,
    status: 'sent'
  });

  return NextResponse.json({ status: 'synced' });
}

/**
 * message.ack — עדכוני סטטוס הודעה (שליחה, מסירה, קריאה)
 */
async function handleMessageAck(event: WebhookEvent) {
  const payload = event.payload;
  const supabase = createServiceClient();

  // Map WAHA ack levels to status
  // 1 = PENDING, 2 = SERVER (sent), 3 = DEVICE (delivered), 4 = READ, 5 = PLAYED
  const ackToStatus: Record<number, string> = {
    1: 'pending',
    2: 'sent',
    3: 'delivered',
    4: 'read',
    5: 'read'
  };

  const newStatus = ackToStatus[payload.ack] || 'sent';

  // עדכן סטטוס ב-DB
  if (payload.id) {
    await supabase
      .from('messages')
      .update({ status: newStatus })
      .eq('provider_message_id', payload.id);
  }

  return NextResponse.json({ status: 'ack_updated' });
}

/**
 * session.status — שינויי חיבור WhatsApp
 */
async function handleSessionStatus(event: WebhookEvent) {
  const supabase = createServiceClient();
  const sessionName = event.session;
  const status = event.payload.status;

  // Map WAHA status to our status
  const statusMap: Record<string, string> = {
    'STOPPED': 'disconnected',
    'STARTING': 'pending_qr',
    'SCAN_QR_CODE': 'pending_qr',
    'WORKING': 'connected',
    'FAILED': 'disconnected'
  };

  const ourStatus = statusMap[status] || 'disconnected';

  await supabase
    .from('phone_numbers')
    .update({
      status: ourStatus,
      last_health_check: new Date().toISOString()
    })
    .eq('session_id', sessionName);

  // שלח התראת Telegram אם ניתוק
  if (['STOPPED', 'FAILED'].includes(status)) {
    await sendTelegramAlert(
      `⚠️ WhatsApp disconnected!\nSession: ${sessionName}\nStatus: ${status}`
    );
  }

  return NextResponse.json({ status: 'session_updated' });
}

/**
 * message.reaction — תגובות אימוג'י
 */
async function handleReaction(event: WebhookEvent) {
  const payload = event.payload;
  const supabase = createServiceClient();

  // שמור את התגובה
  if (payload.reaction?.messageId) {
    await supabase
      .from('messages')
      .update({
        reaction: payload.reaction.text  // האימוג'י
      })
      .eq('provider_message_id', payload.reaction.messageId);
  }

  return NextResponse.json({ status: 'reaction_saved' });
}

/**
 * message.revoked — הודעה שנמחקה
 */
async function handleMessageRevoked(event: WebhookEvent) {
  const supabase = createServiceClient();

  if (event.payload.id) {
    await supabase
      .from('messages')
      .update({
        content: '[הודעה נמחקה]',
        status: 'revoked'
      })
      .eq('provider_message_id', event.payload.id);
  }

  return NextResponse.json({ status: 'message_revoked' });
}

/**
 * message.edited — הודעה שנערכה
 */
async function handleMessageEdited(event: WebhookEvent) {
  const supabase = createServiceClient();

  if (event.payload.id && event.payload.body) {
    await supabase
      .from('messages')
      .update({
        content: event.payload.body,
        edited_at: new Date().toISOString()
      })
      .eq('provider_message_id', event.payload.id);
  }

  return NextResponse.json({ status: 'message_edited' });
}

/**
 * presence.update — לקוחה מקלידה
 */
async function handlePresenceUpdate(event: WebhookEvent) {
  // שימוש: Broadcast ל-frontend דרך Supabase Realtime
  const supabase = createServiceClient();

  // שמור ל-Supabase Broadcast channel (לא ב-DB, רק realtime)
  await supabase
    .channel(`presence:${event.session}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        chatId: event.payload.chatId,
        isTyping: event.payload.presence === 'typing'
      }
    });

  return NextResponse.json({ status: 'presence_broadcast' });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker';
  text: string | null;
  mediaUrl: string | null;
  caption: string | null;
}

function extractMessageContent(payload: any): MessageContent {
  // Text message
  if (payload.body && !payload.hasMedia) {
    return { type: 'text', text: payload.body, mediaUrl: null, caption: null };
  }

  // Media message
  if (payload.hasMedia || payload.mediaUrl) {
    const type = payload.type || 'document';
    return {
      type: type as MessageContent['type'],
      text: payload.caption || payload.body || null,
      mediaUrl: payload.mediaUrl || null,
      caption: payload.caption || null
    };
  }

  // Location
  if (payload.location) {
    return {
      type: 'location',
      text: `📍 ${payload.location.latitude}, ${payload.location.longitude}`,
      mediaUrl: null,
      caption: null
    };
  }

  // Fallback
  return {
    type: 'text',
    text: payload.body || payload.text || '[תוכן לא נתמך]',
    mediaUrl: null,
    caption: null
  };
}

async function findOrCreateConversation(
  supabase: any,
  businessId: string,
  contactId: string
) {
  // חפש שיחה פעילה קיימת
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .in('status', ['active', 'waiting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  // צור שיחה חדשה
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      business_id: businessId,
      contact_id: contactId,
      status: 'active',
      is_bot_active: true,
      last_message_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return newConv;
}

async function saveMessage(supabase: any, data: any) {
  const { data: message, error } = await supabase
    .from('messages')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return message;
}
```

---

# חלק ב': DATA PIPELINE — קליטת נתונים נכונה ל-DB

## עקרונות מפתח

### 1. Single Source of Truth

```
WAHA (WhatsApp) → Webhook → DB (Supabase) → Realtime → Frontend
        ↑                                         |
        └─────── Send API ←── Backend ←───────────┘

הכלל: כל פעולה עוברת דרך ה-DB.
- ה-Frontend לא שולח ישירות ל-WAHA
- ה-Frontend שולח ל-API Route → API Route שומר ב-DB → שולח ב-WAHA
- ה-Webhook שומר ב-DB → Supabase Realtime מעדכן Frontend
```

### 2. Data Normalization Pipeline

```typescript
// src/lib/data/data-pipeline.ts

/**
 * Pipeline שמנרמל ומעשיר כל הודעה נכנסת
 */
async function processInboundMessage(
  rawPayload: WahaMessage,
  businessId: string
): Promise<ProcessedMessage> {

  // === Stage 1: Normalize Contact ===
  const contactId = await normalizeAndResolveContact(rawPayload, businessId);

  // === Stage 2: Normalize Content ===
  const content = normalizeMessageContent(rawPayload);

  // === Stage 3: Detect Language ===
  // (לעתיד - זיהוי שפה לתמיכה רב-לשונית)
  const language = 'he'; // default Hebrew

  // === Stage 4: Extract Metadata ===
  const metadata = {
    timestamp: rawPayload.timestamp,
    provider_id: rawPayload.id,
    device_type: rawPayload._data?.deviceType,
    quoted_message_id: rawPayload._data?.quotedMsg?.id || null,
    forwarded: rawPayload._data?.isForwarded || false
  };

  // === Stage 5: Save to DB (atomic) ===
  return await saveNormalizedMessage({
    business_id: businessId,
    contact_id: contactId,
    content,
    metadata,
    language
  });
}
```

### 3. אטומיות — Transaction Pattern

```typescript
/**
 * כשקובעים תור, צריכים לעדכן כמה טבלאות בו-זמנית.
 * אם אחד נכשל - הכל צריך להתבטל.
 */
async function createAppointmentAtomic(
  data: CreateAppointmentData
): Promise<Appointment> {
  const supabase = createServiceClient();

  // Supabase doesn't have native transactions,
  // so we use an RPC function:

  const { data: result, error } = await supabase
    .rpc('create_appointment_transaction', {
      p_business_id: data.businessId,
      p_contact_id: data.contactId,
      p_service_type: data.serviceType,
      p_start_time: data.startTime,
      p_end_time: data.endTime,
      p_price: data.price,
      p_duration: data.duration,
      p_contact_name: data.contactName
    });

  if (error) throw error;
  return result;
}
```

```sql
-- Supabase RPC Function (migration):
CREATE OR REPLACE FUNCTION create_appointment_transaction(
  p_business_id UUID,
  p_contact_id UUID,
  p_service_type TEXT,
  p_start_time TIMESTAMP,
  p_end_time TIMESTAMP,
  p_price NUMERIC,
  p_duration INTEGER,
  p_contact_name TEXT
) RETURNS appointments AS $$
DECLARE
  v_appointment appointments;
  v_conflict INTEGER;
BEGIN
  -- Check for conflicts
  SELECT COUNT(*) INTO v_conflict
  FROM appointments
  WHERE business_id = p_business_id
    AND status IN ('confirmed', 'pending')
    AND (
      (start_time < p_end_time AND end_time > p_start_time)
    );

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'TIME_SLOT_CONFLICT: השעה כבר תפוסה';
  END IF;

  -- Create appointment
  INSERT INTO appointments (
    business_id, contact_id, service_type,
    start_time, end_time, duration_minutes,
    price, contact_name, status
  ) VALUES (
    p_business_id, p_contact_id, p_service_type,
    p_start_time, p_end_time, p_duration,
    p_price, p_contact_name, 'confirmed'
  ) RETURNING * INTO v_appointment;

  -- Update contact stats
  UPDATE contacts
  SET total_visits = total_visits + 1,
      total_revenue = total_revenue + p_price,
      status = CASE
        WHEN total_visits >= 10 THEN 'vip'
        WHEN total_visits >= 1 THEN 'returning'
        ELSE 'new'
      END
  WHERE id = p_contact_id;

  -- Create notification
  INSERT INTO notifications (
    business_id, type, title, body, data
  ) VALUES (
    p_business_id,
    'new_appointment',
    'תור חדש!',
    p_contact_name || ' - ' || p_service_type || ' ב-' || to_char(p_start_time, 'DD/MM HH24:MI'),
    jsonb_build_object(
      'appointment_id', v_appointment.id,
      'contact_id', p_contact_id
    )
  );

  RETURN v_appointment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Data Consistency Checks

```typescript
// src/lib/data/consistency.ts

/**
 * בדיקות עקביות שרצות כ-cron job (כל שעה)
 */
async function runConsistencyChecks(businessId: string) {
  const supabase = createServiceClient();
  const issues: ConsistencyIssue[] = [];

  // Check 1: Orphaned conversations (no contact)
  const { data: orphanedConvs } = await supabase
    .from('conversations')
    .select('id')
    .eq('business_id', businessId)
    .is('contact_id', null);

  if (orphanedConvs?.length) {
    issues.push({
      type: 'orphaned_conversation',
      count: orphanedConvs.length,
      severity: 'warning'
    });
  }

  // Check 2: Appointments with past dates still "confirmed"
  const { data: staleAppointments } = await supabase
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('status', 'confirmed')
    .lt('end_time', new Date().toISOString());

  if (staleAppointments?.length) {
    // Auto-fix: mark as completed or no_show
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .lt('end_time', new Date().toISOString());

    issues.push({
      type: 'stale_appointments_fixed',
      count: staleAppointments.length,
      severity: 'info'
    });
  }

  // Check 3: Contact stats mismatch
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, total_visits, total_revenue')
    .eq('business_id', businessId);

  for (const contact of contacts || []) {
    const { data: actualVisits } = await supabase
      .from('appointments')
      .select('id, price')
      .eq('contact_id', contact.id)
      .eq('status', 'completed');

    const actualCount = actualVisits?.length || 0;
    const actualRevenue = actualVisits?.reduce((sum, a) => sum + (a.price || 0), 0) || 0;

    if (actualCount !== contact.total_visits || Math.abs(actualRevenue - (contact.total_revenue || 0)) > 1) {
      // Auto-fix
      await supabase
        .from('contacts')
        .update({
          total_visits: actualCount,
          total_revenue: actualRevenue
        })
        .eq('id', contact.id);

      issues.push({
        type: 'contact_stats_fixed',
        contactId: contact.id,
        severity: 'info'
      });
    }
  }

  // Check 4: WhatsApp session health
  const { data: phones } = await supabase
    .from('phone_numbers')
    .select('session_id, status, last_health_check')
    .eq('business_id', businessId)
    .eq('status', 'connected');

  for (const phone of phones || []) {
    try {
      const session = await waha.getSession(phone.session_id);
      if (session.status !== 'WORKING') {
        await supabase
          .from('phone_numbers')
          .update({ status: 'disconnected' })
          .eq('session_id', phone.session_id);

        issues.push({
          type: 'session_disconnected',
          session: phone.session_id,
          severity: 'critical'
        });
      }
    } catch {
      issues.push({
        type: 'session_unreachable',
        session: phone.session_id,
        severity: 'critical'
      });
    }
  }

  return issues;
}
```

---

# חלק ג': SUPABASE REALTIME — סנכרון Frontend בזמן אמת

## 1. Architecture: מה להאזין ולמה

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
│                                                 │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Inbox   │  │ Calendar │  │ Dashboard    │   │
│  │ Page    │  │ Page     │  │ Page         │   │
│  └────┬────┘  └────┬─────┘  └──────┬───────┘   │
│       │            │               │            │
│  messages     appointments    notifications     │
│  conversations                                  │
│       │            │               │            │
│  ┌────┴────────────┴───────────────┴──────┐     │
│  │        Supabase Realtime Client        │     │
│  │   (postgres_changes subscriptions)     │     │
│  └────────────────┬───────────────────────┘     │
└───────────────────┼─────────────────────────────┘
                    │
           WebSocket Connection
                    │
┌───────────────────┼─────────────────────────────┐
│          SUPABASE REALTIME SERVER                │
│                                                 │
│  PostgreSQL WAL → Logical Replication →          │
│  Filter by RLS → Broadcast to subscribers       │
└─────────────────────────────────────────────────┘
```

## 2. Hooks שיפור — Realtime עם Optimistic Updates

```typescript
// src/hooks/use-realtime-v2.ts

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Hook: הודעות בזמן אמת עם optimistic updates
 */
export function useRealtimeMessages(
  conversationId: string | null,
  initialMessages: Message[] = []
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();
  const channelRef = useRef<any>(null);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    // Set initial data
    setMessages(initialMessages);

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Dedup: check if we already have this message (optimistic update)
            if (prev.some(m => m.id === newMessage.id ||
                m.provider_message_id === newMessage.provider_message_id)) {
              // Replace optimistic version with server version
              return prev.map(m =>
                (m.id === newMessage.id || m.provider_message_id === newMessage.provider_message_id)
                  ? newMessage
                  : m
              );
            }
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const updated = payload.new as Message;
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? { ...m, ...updated } : m)
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]); // Only re-subscribe when conversation changes

  // Optimistic send - adds message to UI immediately
  const sendOptimistic = useCallback((content: string) => {
    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId!,
      direction: 'outbound',
      sender_type: 'human',
      type: 'text',
      content,
      status: 'sending',  // special status
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);
    return optimisticMessage;
  }, [conversationId]);

  // Remove failed optimistic message
  const removeOptimistic = useCallback((optimisticId: string) => {
    setMessages(prev => prev.filter(m => m.id !== optimisticId));
  }, []);

  return {
    messages,
    isConnected,
    sendOptimistic,
    removeOptimistic
  };
}

/**
 * Hook: רשימת שיחות בזמן אמת
 */
export function useRealtimeConversations(
  businessId: string,
  initialConversations: ConversationWithContact[]
) {
  const [conversations, setConversations] = useState(initialConversations);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const supabase = createClient();

  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`conversations:${businessId}`)
      // New/Updated conversations
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT + UPDATE
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${businessId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch full conversation with contact
            const { data } = await supabase
              .from('conversations')
              .select(`*, contact:contacts(*)`)
              .eq('id', payload.new.id)
              .single();
            if (data) {
              setConversations(prev => [data, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setConversations(prev =>
              prev.map(c => c.id === payload.new.id
                ? { ...c, ...payload.new }
                : c
              ).sort((a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime()
              )
            );
          }
        }
      )
      // New messages (for last message preview + unread count)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.direction === 'inbound') {
            // Update unread count
            setUnreadCounts(prev => ({
              ...prev,
              [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1
            }));
          }

          // Update last message in conversation list
          setConversations(prev =>
            prev.map(c => c.id === msg.conversation_id
              ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
              : c
            ).sort((a, b) =>
              new Date(b.last_message_at).getTime() -
              new Date(a.last_message_at).getTime()
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId]);

  const markAsRead = useCallback((conversationId: string) => {
    setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
  }, []);

  return { conversations, unreadCounts, markAsRead };
}

/**
 * Hook: תורים בזמן אמת (ללוח שנה)
 */
export function useRealtimeAppointments(
  businessId: string,
  dateRange: { start: string; end: string },
  initialAppointments: Appointment[]
) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const supabase = createClient();

  useEffect(() => {
    if (!businessId) return;
    setAppointments(initialAppointments);

    const channel = supabase
      .channel(`appointments:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          const appointment = payload.new as Appointment;

          switch (payload.eventType) {
            case 'INSERT':
              // רק אם בטווח התאריכים שמוצג
              if (appointment.start_time >= dateRange.start &&
                  appointment.start_time <= dateRange.end) {
                setAppointments(prev => [...prev, appointment]);
              }
              break;

            case 'UPDATE':
              setAppointments(prev =>
                prev.map(a => a.id === appointment.id ? { ...a, ...appointment } : a)
                  .filter(a => a.status !== 'cancelled')  // הסר מבוטלים מהתצוגה
              );
              break;

            case 'DELETE':
              setAppointments(prev => prev.filter(a => a.id !== payload.old.id));
              break;
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId, dateRange.start, dateRange.end]);

  return appointments;
}

/**
 * Hook: Notifications בזמן אמת (פעמון)
 */
export function useRealtimeNotifications(businessId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!businessId) return;

    // Load initial
    supabase
      .from('notifications')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.read).length);
        }
      });

    // Subscribe to new
    const channel = supabase
      .channel(`notifications:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          const notification = payload.new as Notification;
          setNotifications(prev => [notification, ...prev.slice(0, 19)]);
          setUnreadCount(prev => prev + 1);

          // Optional: browser notification
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.body,
              icon: '/icon-192.png'
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [businessId]);

  return { notifications, unreadCount, setUnreadCount };
}

/**
 * Hook: Typing indicator (מלקוחה)
 */
export function useTypingIndicator(
  sessionId: string,
  chatId: string
) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const supabase = createClient();

  useEffect(() => {
    if (!sessionId || !chatId) return;

    const channel = supabase
      .channel(`presence:${sessionId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.chatId === chatId) {
          setIsTyping(payload.payload.isTyping);

          // Auto-clear after 5 seconds
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (payload.payload.isTyping) {
            timeoutRef.current = setTimeout(() => setIsTyping(false), 5000);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [sessionId, chatId]);

  return isTyping;
}
```

## 3. Send Message Flow — Optimistic Updates

```typescript
// src/components/inbox/message-input.tsx — improved

async function handleSendMessage(content: string) {
  if (!content.trim() || !conversationId) return;

  // === STEP 1: Optimistic Update (instant UI) ===
  const optimistic = sendOptimistic(content);

  try {
    // === STEP 2: Send to API ===
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: content.trim()
      })
    });

    if (!response.ok) throw new Error('Failed to send');

    // STEP 3: Supabase Realtime will replace optimistic with real message
    // (handled in useRealtimeMessages dedup logic)

  } catch (error) {
    // === STEP 4: Rollback on failure ===
    removeOptimistic(optimistic.id);
    toast.error('שליחת ההודעה נכשלה, נסה שוב');
  }
}
```

```typescript
// src/app/api/messages/route.ts — improved

export async function POST(request: NextRequest) {
  const { conversation_id, content } = await request.json();

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get conversation + contact + phone
  const serviceClient = createServiceClient();

  const { data: conversation } = await serviceClient
    .from('conversations')
    .select(`
      *,
      contact:contacts(*),
      business:businesses!inner(
        phone_numbers(session_id, status)
      )
    `)
    .eq('id', conversation_id)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const phone = conversation.business.phone_numbers
    .find((p: any) => p.status === 'connected');

  if (!phone) {
    return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 });
  }

  // === Send via WAHA with typing simulation ===
  const chatId = conversation.contact.wa_id;
  await sendWithTypingSimulation(phone.session_id, chatId, content);

  // === Save to DB (triggers Realtime → Frontend) ===
  const { data: message, error } = await serviceClient
    .from('messages')
    .insert({
      conversation_id,
      direction: 'outbound',
      sender_type: 'human',
      type: 'text',
      content,
      status: 'sent'
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update conversation
  await serviceClient
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation_id);

  return NextResponse.json(message);
}
```

## 4. Reconnection & Error Handling

```typescript
// src/hooks/use-realtime-connection.ts

/**
 * Hook: ניהול חיבור Realtime עם reconnection אוטומטי
 */
export function useRealtimeConnection() {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const supabase = createClient();

  useEffect(() => {
    // Monitor realtime connection
    const statusChannel = supabase
      .channel('system:status')
      .subscribe((state) => {
        switch (state) {
          case 'SUBSCRIBED':
            setStatus('connected');
            break;
          case 'TIMED_OUT':
          case 'CLOSED':
            setStatus('reconnecting');
            // Supabase auto-reconnects, but we can show UI indicator
            break;
          case 'CHANNEL_ERROR':
            setStatus('disconnected');
            break;
        }
      });

    return () => { supabase.removeChannel(statusChannel); };
  }, []);

  return status;
}

// Usage in layout:
function DashboardLayout({ children }) {
  const realtimeStatus = useRealtimeConnection();

  return (
    <>
      {realtimeStatus === 'reconnecting' && (
        <div className="bg-yellow-500 text-white text-center text-sm py-1">
          מתחבר מחדש...
        </div>
      )}
      {realtimeStatus === 'disconnected' && (
        <div className="bg-red-500 text-white text-center text-sm py-1">
          אין חיבור — נסה לרענן את הדף
        </div>
      )}
      {children}
    </>
  );
}
```

---

# חלק ד': DB MIGRATIONS — טבלאות חדשות נדרשות

```sql
-- Migration: Add memory tables and improve existing schema

-- === 1. Conversation Memory (short-term) ===
CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  summary TEXT,
  extracted_facts JSONB DEFAULT '[]',
  booking_slots JSONB DEFAULT '{}',
  sentiment TEXT DEFAULT 'neutral'
    CHECK (sentiment IN ('positive', 'neutral', 'frustrated', 'urgent')),
  messages_since_summary INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id)
);

-- === 2. Customer Memory (long-term) ===
CREATE TABLE IF NOT EXISTS customer_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id),
  learned_facts JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  relationship_summary TEXT,
  behavior_patterns JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, business_id)
);

-- === 3. AI Quality Metrics ===
CREATE TABLE IF NOT EXISTS ai_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  ai_response TEXT,
  intent_detected TEXT,
  confidence NUMERIC,
  action_taken TEXT,
  validation_passed BOOLEAN,
  validation_errors JSONB,
  human_override BOOLEAN DEFAULT false,
  human_correction TEXT,
  action_success BOOLEAN,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === 4. Improve messages table ===
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reaction TEXT,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS quoted_message_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- === 5. Improve ai_conversation_logs ===
ALTER TABLE ai_conversation_logs
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- === 6. Indexes for performance ===
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_provider_id
  ON messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_business_date
  ON appointments(business_id, start_time)
  WHERE status IN ('confirmed', 'pending');

CREATE INDEX IF NOT EXISTS idx_contacts_business_wa_id
  ON contacts(business_id, wa_id);

CREATE INDEX IF NOT EXISTS idx_conversations_business_status
  ON conversations(business_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_business_unread
  ON notifications(business_id, read, created_at DESC)
  WHERE read = false;

-- === 7. RLS Policies for new tables ===
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_quality_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business conversation_memory"
  ON conversation_memory FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own business customer_memory"
  ON customer_memory FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own business ai_quality_metrics"
  ON ai_quality_metrics FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM business_users WHERE user_id = auth.uid()
  ));

-- === 8. Enable Realtime on key tables ===
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- === 9. Atomic appointment creation function ===
CREATE OR REPLACE FUNCTION create_appointment_atomic(
  p_business_id UUID,
  p_contact_id UUID,
  p_service_type TEXT,
  p_start_time TIMESTAMP,
  p_end_time TIMESTAMP,
  p_price NUMERIC,
  p_duration INTEGER,
  p_contact_name TEXT
) RETURNS appointments AS $$
DECLARE
  v_appointment appointments;
  v_conflict INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_conflict
  FROM appointments
  WHERE business_id = p_business_id
    AND status IN ('confirmed', 'pending')
    AND start_time < p_end_time
    AND end_time > p_start_time;

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'TIME_SLOT_CONFLICT';
  END IF;

  INSERT INTO appointments (
    business_id, contact_id, service_type,
    start_time, end_time, duration_minutes,
    price, contact_name, status
  ) VALUES (
    p_business_id, p_contact_id, p_service_type,
    p_start_time, p_end_time, p_duration,
    p_price, p_contact_name, 'confirmed'
  ) RETURNING * INTO v_appointment;

  UPDATE contacts
  SET total_visits = total_visits + 1,
      total_revenue = total_revenue + COALESCE(p_price, 0),
      status = CASE
        WHEN total_visits >= 10 THEN 'vip'
        WHEN total_visits >= 1 THEN 'returning'
        ELSE status
      END
  WHERE id = p_contact_id;

  INSERT INTO notifications (business_id, type, title, body, data)
  VALUES (
    p_business_id, 'new_appointment',
    'תור חדש!',
    p_contact_name || ' - ' || p_service_type,
    jsonb_build_object('appointment_id', v_appointment.id, 'contact_id', p_contact_id)
  );

  RETURN v_appointment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

# חלק ה': סיכום — מפת דרכים מעודכנת

## מה לעשות ראשון

| # | משימה | קבצים מושפעים | מאמץ |
|---|-------|--------------|------|
| 1 | הרץ DB migration (טבלאות חדשות + indexes) | Supabase SQL Editor | שעה |
| 2 | שפר webhook handler עם dedup + כל event types | `api/webhooks/waha/route.ts` | 3-4 שעות |
| 3 | הוסף typing simulation | `lib/waha/human-simulation.ts` (חדש) | 2 שעות |
| 4 | שפר contact resolver (תמיכה ב-@lid) | `lib/waha/contact-resolver.ts` (חדש) | 2 שעות |
| 5 | שפר realtime hooks עם optimistic updates | `hooks/use-realtime-v2.ts` (חדש) | 3-4 שעות |
| 6 | הוסף reconnection indicator | `app/(dashboard)/layout.tsx` | שעה |
| 7 | Implement layered system prompt | `lib/ai/agent-prompt-v2.ts` | 4-6 שעות |
| 8 | הוסף consistency cron job | `api/cron/consistency/route.ts` (חדש) | 2-3 שעות |

**סה"כ: ~18-23 שעות עבודה** לשדרוג מהותי של כל ה-pipeline.
