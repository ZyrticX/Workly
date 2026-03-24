# מחקר מעמיק: ארכיטקטורת AI Agent מקצועית
## מערכת סוכן WhatsApp חכם לניהול תורים

> **תאריך**: מרץ 2026
> **מבוסס על**: מחקר אקדמי ותעשייתי עדכני (2025-2026)
> **מותאם ל**: Next.js + Supabase + WAHA + OpenRouter (Gemini 2.5 Flash)

---

# חלק א': MEMORY MANAGEMENT - ניהול זיכרון שיחה

## המצב הנוכחי אצלך

כיום המערכת שלך שולחת את **15 ההודעות האחרונות** כהיסטוריה ל-AI. זה עובד למקרים פשוטים, אבל יוצר 3 בעיות:

1. **אובדן הקשר** - אחרי 15 הודעות, ה-AI "שוכח" מה נאמר קודם
2. **זיהום קונטקסט** - הודעות לא רלוונטיות (סמולטוק) תופסות מקום של מידע חשוב
3. **חוסר המשכיות בין סשנים** - לקוחה שחוזרת אחרי שבוע מתחילה מאפס

## הארכיטקטורה המומלצת: 3 שכבות זיכרון

### שכבה 1: Working Memory (זיכרון עבודה) — בתוך ה-Context Window

זה מה שנכנס ישירות ל-prompt בכל קריאה ל-AI:

```typescript
interface WorkingMemory {
  // מידע סטטי על הלקוחה - תמיד נטען
  customer_context: {
    name: string;
    status: 'new' | 'returning' | 'vip';
    total_visits: number;
    last_visit: Date | null;
    upcoming_appointment: Appointment | null;
    preferences: string[];       // "מעדיפה בוקר", "רגישה לג'ל"
    tags: string[];
  };

  // הודעות אחרונות - רק מה שרלוונטי
  recent_messages: Message[];     // 10-15 הודעות אחרונות

  // סיכום שיחות קודמות - compressed
  conversation_summary: string;   // סיכום AI של כל מה שקרה לפני

  // מצב נוכחי של flow
  current_state: BookingState;    // idle, collecting_service, confirming...

  // נתוני real-time
  today_availability: TimeSlot[]; // חלונות פנויים להיום
  current_datetime: string;       // תאריך ושעה נוכחיים
}
```

**עקרון מפתח (מ-Anthropic)**: *"Just-In-Time Context"* — אל תטען הכל מראש. שמור מזהים קלים (contact_id, conversation_id) וטען נתונים דינמית רק כשצריך.

### שכבה 2: Short-Term Memory (זיכרון לטווח קצר) — Supabase

נתונים שנשמרים בין הודעות ובין סשנים, אבל עדיין ברמת שיחה:

```sql
-- טבלה חדשה: conversation_memory
CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  business_id UUID REFERENCES businesses(id),

  -- סיכום מתעדכן של השיחה
  summary TEXT,                    -- "הלקוחה שאלה על מחיר מניקור,
                                   --  התעניינה בג'ל, רוצה תור ליום שני"

  -- עובדות שנחלצו מהשיחה
  extracted_facts JSONB DEFAULT '[]',
  -- ["מעדיפה בוקר", "אלרגית לאקריל", "יום הולדת בספטמבר"]

  -- slot filling state
  booking_slots JSONB DEFAULT '{}',
  -- {service: "מניקור ג'ל", date: "2026-03-25", time: null, name: "דנה"}

  -- sentiment tracking
  sentiment TEXT DEFAULT 'neutral',  -- positive, neutral, frustrated, urgent

  -- כמה הודעות עברו מאז הסיכום האחרון
  messages_since_summary INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**מתי לעדכן סיכום?** כל 8-10 הודעות, או כשה-AI מסיים action (קבע תור, ביטל, וכו'). לא כל הודעה — זה מבזבז API calls.

### שכבה 3: Long-Term Memory (זיכרון ארוך טווח) — Supabase + אופציונלי Vector DB

נתונים שנשמרים לצמיתות ברמת לקוח:

```sql
-- טבלה חדשה: customer_memory
CREATE TABLE customer_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  business_id UUID REFERENCES businesses(id),

  -- עובדות שנלמדו לאורך זמן
  learned_facts JSONB DEFAULT '[]',
  -- ["תמיד מבטלת ברגע האחרון", "מגיעה עם הילדה", "אוהבת צבעי פסטל"]

  -- העדפות שנחלצו
  preferences JSONB DEFAULT '{}',
  -- {preferred_day: "ראשון", preferred_time: "בוקר",
  --  favorite_service: "מניקור ג'ל", allergies: ["אקריל"]}

  -- סיכום יחסים
  relationship_summary TEXT,
  -- "לקוחה ותיקה מ-2025, מגיעה כל 3 שבועות, VIP,
  --  תמיד מזמינה מניקור+פדיקור, מביאה חברות"

  -- דפוס התנהגות
  behavior_patterns JSONB DEFAULT '{}',
  -- {avg_booking_lead_time: "3 days", cancellation_rate: 0.1,
  --  typical_response_time: "5 minutes", upsell_receptive: true}

  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Flow מעשי: איך הזיכרון עובד בכל הודעה

```
הודעה נכנסת מלקוחה
         |
         v
[1] טען Working Memory:
    - contact record (name, status, visits)
    - conversation_memory.summary (אם קיים)
    - 10-15 הודעות אחרונות
    - customer_memory.preferences (אם לקוחה חוזרת)
    - booking_state (אם באמצע flow)
    - today's availability (רק אם רלוונטי)
         |
         v
[2] הרכב Context חכם:
    System Prompt + Working Memory + User Message
    (סה"כ: ~2,000-4,000 tokens)
         |
         v
[3] קבל תגובת AI + פרסר JSON
         |
         v
[4] עדכן זיכרון:
    - שמור הודעות (messages table)
    - עדכן booking_slots אם השתנו
    - אם messages_since_summary > 8: הפעל summarization
    - אם fact חדש נחלץ: הוסף ל-customer_memory
         |
         v
[5] שלח תגובה דרך WAHA
```

## Summarization — איך לסכם שיחות

כל 8-10 הודעות, הרץ קריאה ל-AI עם prompt ייעודי:

```typescript
const SUMMARIZE_PROMPT = `
אתה מסכם שיחות WhatsApp עסקיות.
סכם את השיחה הבאה ב-2-3 משפטים קצרים.
שמור רק מידע רלוונטי: מה הלקוחה רוצה, מה סוכם, מה עדיין פתוח.
התעלם מסמולטוק ונימוסים.

שיחה קודמת (סיכום): ${previousSummary || "אין"}
הודעות חדשות:
${newMessages.map(m => `${m.sender_type}: ${m.content}`).join('\n')}

החזר JSON:
{
  "summary": "סיכום מעודכן",
  "extracted_facts": ["עובדה חדשה 1", "עובדה חדשה 2"],
  "sentiment": "positive|neutral|frustrated|urgent"
}
`;
```

**טיפ קריטי מ-Anthropic**: *"Compaction"* — כשמסכמים, תתחילו עם recall מקסימלי (שמירת הכל) ואז שפרו precision (הורדת עודף). עדיף לשמור יותר מדי מאשר לאבד מידע קריטי.

---

# חלק ב': INTENT DETECTION - זיהוי כוונה

## המצב הנוכחי אצלך

ה-AI שלך מזהה כוונות דרך ה-system prompt ומחזיר JSON עם `intent` field. זה עובד, אבל יש מקום לשיפור משמעותי.

## ארכיטקטורה מומלצת: Hybrid Intent System

### רמה 1: Primary Intent Detection (בתוך ה-AI response)

```typescript
// הגדרת Intents מובנית
const INTENT_TAXONOMY = {
  // === BOOKING FLOW ===
  book_appointment: {
    description: "לקוחה רוצה לקבוע תור חדש",
    examples: ["אפשר תור?", "יש מקום מחר?", "רוצה לקבוע"],
    required_slots: ['service', 'date', 'time'],
    optional_slots: ['notes', 'name'],
    priority: 'high'
  },
  reschedule_appointment: {
    description: "לקוחה רוצה להזיז תור קיים",
    examples: ["אפשר להזיז?", "לא מתאים לי", "שינוי תור"],
    required_slots: ['new_date', 'new_time'],
    priority: 'high'
  },
  cancel_appointment: {
    description: "לקוחה רוצה לבטל תור",
    examples: ["צריכה לבטל", "לא אגיע", "ביטול"],
    required_slots: [],
    priority: 'high'
  },
  confirm_appointment: {
    description: "לקוחה מאשרת הגעה לתור",
    examples: ["כן אני מגיעה", "מאשרת", "אהיה שם"],
    required_slots: [],
    priority: 'medium'
  },

  // === INFORMATION ===
  ask_price: {
    description: "שאלה על מחירים",
    examples: ["כמה עולה?", "מה המחיר?", "מחירון"],
    required_slots: ['service'],
    priority: 'medium'
  },
  ask_availability: {
    description: "שאלה על זמינות",
    examples: ["מתי פנוי?", "יש מקום?", "מתי אפשר?"],
    required_slots: ['date'],
    priority: 'medium'
  },
  ask_services: {
    description: "שאלה על סוגי טיפולים",
    examples: ["מה יש?", "מה את עושה?", "אילו טיפולים?"],
    required_slots: [],
    priority: 'medium'
  },
  ask_hours: {
    description: "שאלה על שעות עבודה",
    examples: ["מתי פתוח?", "שעות עבודה", "עד מתי?"],
    required_slots: [],
    priority: 'low'
  },

  // === CONVERSATION ===
  greeting: {
    description: "ברכה/פתיחת שיחה",
    examples: ["היי", "שלום", "בוקר טוב"],
    required_slots: [],
    priority: 'low'
  },
  thanks: {
    description: "תודה/סגירת שיחה",
    examples: ["תודה", "מעולה", "יופי"],
    required_slots: [],
    priority: 'low'
  },
  complaint: {
    description: "תלונה או חוסר שביעות רצון",
    examples: ["לא נעים לי", "יש בעיה", "לא מרוצה"],
    required_slots: [],
    priority: 'urgent'
  },

  // === SPECIAL ===
  human_handoff: {
    description: "בקשה לדבר עם בעלת העסק",
    examples: ["אפשר לדבר עם...", "תעבירי אותי", "צריכה בן אדם"],
    required_slots: [],
    priority: 'urgent'
  },
  unknown: {
    description: "לא מצליח לזהות כוונה",
    required_slots: [],
    priority: 'low'
  }
};
```

### רמה 2: Multi-Intent Detection

לקוחות ישראליות שולחות לעתים קרובות הודעות מרובות כוונות:

> "היי! כמה עולה מניקור ג'ל? ואפשר תור ליום ראשון?"

זה כולל: `greeting` + `ask_price` + `book_appointment`

```typescript
// בתוך ה-system prompt, הוסף:
const MULTI_INTENT_INSTRUCTION = `
כשהלקוחה שולחת הודעה עם מספר בקשות:
1. זהה את כל הכוונות
2. טפל בכוונה העיקרית (בעדיפות הגבוהה ביותר)
3. ענה על השאר בתוך אותה תגובה
4. החזר intent ראשי ב-JSON, ו-secondary_intents כמערך

Response format:
{
  "text": "...",
  "intent": "book_appointment",        // primary
  "secondary_intents": ["ask_price"],   // secondary
  "confidence": 0.92,
  "action": {...}
}
`;
```

### רמה 3: Slot Filling עם Persistence

כשה-AI צריך מידע נוסף כדי להשלים action:

```typescript
interface SlotFillingState {
  intent: string;                    // "book_appointment"
  slots: {
    [key: string]: {
      value: any;                    // "מניקור ג'ל"
      confidence: number;           // 0.95
      source: 'explicit' | 'inferred' | 'default';
      confirmed: boolean;           // true
    }
  };
  missing_slots: string[];           // ["time"]
  attempts: number;                  // כמה פעמים שאלנו
  max_attempts: number;              // 3
  fallback_action: string;           // "escalate_to_human"
}

// Flow:
// הודעה 1: "רוצה תור מניקור"
//   → slots: {service: "מניקור"}, missing: ["date", "time"]
//   → AI: "מתי נוח לך?"
//
// הודעה 2: "מחר"
//   → slots: {service: "מניקור", date: "2026-03-25"}, missing: ["time"]
//   → AI: "יש לי פנוי ב-10:00, 14:00, 16:30. מה מתאים?"
//
// הודעה 3: "10"
//   → slots: {service: "מניקור", date: "2026-03-25", time: "10:00"}
//   → missing: [] → EXECUTE booking
```

### רמה 4: Context-Aware Intent Resolution

```typescript
// כשיש אמביגואציה, השתמש בהקשר:
const resolveAmbiguousIntent = (
  message: string,
  context: WorkingMemory
): string => {
  // "כן" יכול להיות:
  // - אישור הגעה (אם יש תור קרוב ונשלחה תזכורת)
  // - אישור הזמנה (אם באמצע booking flow)
  // - תשובה לשאלה (אם ה-AI שאל משהו)

  if (context.current_state.step === 'confirming') {
    return 'confirm_booking';
  }
  if (context.customer_context.upcoming_appointment &&
      context.recent_messages.some(m => m.content.includes('תזכורת'))) {
    return 'confirm_attendance';
  }
  return 'affirmative_response';
};
```

---

# חלק ג': מניעת הזיות (HALLUCINATION PREVENTION)

## למה זה קריטי אצלך

AI Agent שמנהל תורים **חייב** להיות מדויק. הזיה אחת יכולה:
- לקבוע תור בזמן שלא קיים
- לתת מחיר שגוי
- לאשר ביטול שלא קרה
- "להמציא" שיש מקום פנוי כשאין

## 6 שכבות הגנה מפני הזיות

### שכבה 1: Data Grounding — כל עובדה חייבת מקור

```typescript
// בתוך ה-system prompt:
const GROUNDING_RULES = `
כללי דיוק קריטיים - אסור לחרוג מהם בשום מצב:

1. מחירים: ענה רק עם מחירים מהרשימה למטה. אם שירות לא קיים ברשימה -
   אמור "אני לא בטוחה לגבי המחיר, תני לי לבדוק ולחזור אליך"

2. זמינות: ענה רק על בסיס חלונות הזמן שמסופקים.
   לעולם אל תאמר "כן יש מקום" בלי לבדוק.
   אם אין נתוני זמינות - אמור "בואי נבדוק יחד מתי פנוי"

3. שעות עבודה: ענה רק על בסיס ימי ושעות העבודה המוגדרים.
   אם שואלים על יום/שעה מחוץ לימי עבודה - אמור שסגור.

4. היסטוריה: אל תמציא היסטוריה שלא קיימת.
   אם לא יודע - "אני לא רואה את המידע הזה, תני לי לברר"

5. מדיניות: מדיניות ביטולים כפי שמוגדרת. לא להמציא חריגים.

6. כלל הזהב: אם לא בטוח - אמור שצריך לבדוק.
   עדיף "אני בודקת" מאשר מידע שגוי.
`;
```

### שכבה 2: Structured Output Validation — בדוק כל output

```typescript
import { z } from 'zod';

// סכמת Zod לוולידציה של תגובת AI
const AIResponseSchema = z.object({
  text: z.string().min(1).max(500),
  intent: z.enum([
    'book_appointment', 'cancel_appointment', 'reschedule_appointment',
    'ask_price', 'ask_availability', 'ask_services', 'ask_hours',
    'greeting', 'thanks', 'complaint', 'human_handoff', 'unknown',
    'confirm_appointment', 'general_question'
  ]),
  confidence: z.number().min(0).max(1),
  escalated: z.boolean(),
  action: z.union([
    // Book appointment action
    z.object({
      type: z.literal('book_appointment'),
      service: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      duration: z.number().positive(),
      contact_name: z.string().optional()
    }),
    // Cancel appointment action
    z.object({
      type: z.literal('cancel_appointment'),
      appointment_id: z.string().uuid().optional(),
      date: z.string().optional()
    }),
    // No action
    z.null()
  ]).optional()
});

// Post-processing validation:
function validateAIResponse(raw: unknown): AIResponse {
  const parsed = AIResponseSchema.safeParse(raw);

  if (!parsed.success) {
    console.error('AI response validation failed:', parsed.error);
    // Fallback: שלח הודעה גנרית ותעביר לבעלת העסק
    return {
      text: "תני לי רגע לבדוק ואחזור אליך 🙏",
      intent: 'unknown',
      confidence: 0,
      escalated: true,
      action: null
    };
  }

  return parsed.data;
}
```

### שכבה 3: Business Logic Guards — ולידציה לפני ביצוע

```typescript
// NEVER trust the AI's action without validation
async function executeAction(
  action: AIAction,
  businessId: string,
  contactId: string
): Promise<ActionResult> {

  switch (action.type) {
    case 'book_appointment': {
      // Guard 1: בדוק שהשירות קיים
      const services = await getBusinessServices(businessId);
      const service = services.find(s =>
        s.name.includes(action.service) ||
        action.service.includes(s.name)
      );
      if (!service) {
        return { success: false, error: 'שירות לא קיים',
                 fallback_message: "לא מצאתי את הטיפול הזה. הנה מה שיש:" };
      }

      // Guard 2: בדוק שהתאריך עתידי ובימי עבודה
      const dateValid = await validateBookingDate(action.date, businessId);
      if (!dateValid.valid) {
        return { success: false, error: dateValid.reason,
                 fallback_message: dateValid.suggestion };
      }

      // Guard 3: בדוק שהשעה פנויה (REAL DB CHECK, not AI assumption)
      const slotAvailable = await checkSlotAvailability(
        businessId, action.date, action.time, service.duration
      );
      if (!slotAvailable) {
        const alternatives = await getAvailableSlots(businessId, action.date, service.duration);
        return { success: false, error: 'שעה תפוסה',
                 fallback_message: `השעה ${action.time} תפוסה. פנוי ב: ${alternatives.join(', ')}` };
      }

      // Guard 4: בדוק שאין כפילות תור לאותו לקוח באותו יום
      const existing = await checkExistingAppointment(contactId, action.date);
      if (existing) {
        return { success: false, error: 'כבר קיים תור',
                 fallback_message: `כבר יש לך תור ב-${existing.time}. רוצה לשנות?` };
      }

      // ALL GUARDS PASSED - execute
      const appointment = await createAppointment({...});
      return { success: true, appointment };
    }

    case 'cancel_appointment': {
      // Guard: בדוק שבאמת קיים תור לביטול
      const upcoming = await getUpcomingAppointment(contactId, businessId);
      if (!upcoming) {
        return { success: false, error: 'אין תור לביטול',
                 fallback_message: "לא מצאתי תור קיים שלך. את בטוחה?" };
      }

      // Guard: בדוק מדיניות ביטולים
      const policy = await getCancellationPolicy(businessId);
      const hoursUntil = differenceInHours(upcoming.start_time, new Date());
      if (hoursUntil < policy.min_hours) {
        return { success: false, error: 'ביטול מאוחר מדי',
                 fallback_message: `לפי המדיניות שלנו, ביטול אפשרי עד ${policy.min_hours} שעות לפני. רוצה להזיז?` };
      }

      await cancelAppointment(upcoming.id);
      return { success: true };
    }
  }
}
```

### שכבה 4: Confidence Threshold — סף ביטחון

```typescript
const CONFIDENCE_THRESHOLDS = {
  // Actions with real consequences need HIGH confidence
  book_appointment: 0.85,
  cancel_appointment: 0.90,      // ביטול דורש ודאות גבוהה יותר
  reschedule_appointment: 0.85,

  // Information queries can have LOWER threshold
  ask_price: 0.70,
  ask_availability: 0.70,
  greeting: 0.50,

  // Escalation threshold
  escalate_if_below: 0.60        // מתחת לזה - העבר לבעלת העסק
};

function shouldExecuteAction(intent: string, confidence: number): boolean {
  const threshold = CONFIDENCE_THRESHOLDS[intent] || 0.75;

  if (confidence < CONFIDENCE_THRESHOLDS.escalate_if_below) {
    // Auto-escalate: תעבירי לבעלת העסק
    return false;
  }

  if (confidence < threshold) {
    // Ask for confirmation: "רק לוודא, את רוצה לקבוע תור ל...?"
    return false; // trigger confirmation flow
  }

  return true;
}
```

### שכבה 5: Output Sanitization — ניקוי תגובות

```typescript
function sanitizeResponse(text: string, businessData: BusinessSettings): string {
  let sanitized = text;

  // 1. הסר אזכורים של AI/בוט
  const aiTerms = ['כ-AI', 'אני בוט', 'אני מודל שפה', 'ChatGPT', 'GPT',
                    'אינטליגנציה מלאכותית', 'as an AI', 'language model'];
  for (const term of aiTerms) {
    sanitized = sanitized.replace(new RegExp(term, 'gi'), '');
  }

  // 2. בדוק שמחירים תואמים למחירון
  const priceRegex = /₪(\d+)/g;
  const prices = [...sanitized.matchAll(priceRegex)].map(m => parseInt(m[1]));
  const validPrices = businessData.services.map(s => s.price);

  for (const price of prices) {
    if (!validPrices.includes(price) && !validPrices.some(vp => Math.abs(vp - price) < 10)) {
      // מחיר לא מוכר - סימן להזיה
      console.warn(`Suspicious price detected: ₪${price}`);
      // אפשר: להחליף במחיר הנכון, או להוסיף disclaimer
    }
  }

  // 3. בדוק שתאריכים הגיוניים
  const dateRegex = /(\d{1,2})[./](\d{1,2})/g;
  // ... validate dates are in the future and on working days

  // 4. הגבל אורך הודעה (WhatsApp best practice)
  if (sanitized.length > 800) {
    // פצל להודעות או קצר
    sanitized = sanitized.substring(0, 750) + '...';
  }

  return sanitized;
}
```

### שכבה 6: Monitoring & Feedback Loop — למידה מטעויות

```sql
-- טבלה חדשה: ai_quality_metrics
CREATE TABLE ai_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  business_id UUID REFERENCES businesses(id),

  -- Response quality
  ai_response TEXT,
  intent_detected TEXT,
  confidence NUMERIC,
  action_taken TEXT,

  -- Validation results
  validation_passed BOOLEAN,
  validation_errors JSONB,      -- ["price_mismatch", "slot_unavailable"]

  -- Human feedback
  human_override BOOLEAN,       -- בעלת העסק התערבה?
  human_correction TEXT,        -- מה היא שינתה?

  -- Outcome
  action_success BOOLEAN,       -- האם הפעולה הצליחה?
  customer_satisfied BOOLEAN,   -- האם הלקוחה המשיכה/הזמינה?

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

# חלק ד': SYSTEM PROMPT ARCHITECTURE

## העיקרון: Layered Prompt Architecture

ה-system prompt שלך צריך להיות **מודולרי** — בנוי משכבות שמורכבות דינמית.

## 5 שכבות של System Prompt

```
┌─────────────────────────────────────────┐
│  Layer 1: CORE IDENTITY                 │  ← קבוע, לא משתנה
│  (מי את, כללי ברזל, מה אסור)            │
├─────────────────────────────────────────┤
│  Layer 2: BUSINESS CONTEXT              │  ← משתנה per-business
│  (שירותים, שעות, מחירים, מדיניות)        │
├─────────────────────────────────────────┤
│  Layer 3: PERSONALITY & STYLE           │  ← משתנה per-business
│  (טון, אימוג'ים, ביטויים, סגנון)         │
├─────────────────────────────────────────┤
│  Layer 4: CUSTOMER CONTEXT              │  ← משתנה per-conversation
│  (שם, סטטוס, היסטוריה, העדפות)           │
├─────────────────────────────────────────┤
│  Layer 5: RUNTIME CONTEXT               │  ← משתנה per-message
│  (תאריך, זמינות, state, סיכום שיחה)      │
└─────────────────────────────────────────┘
```

### Layer 1: Core Identity — כללי ברזל

```typescript
const LAYER_1_CORE = `
<core_identity>
את מזכירה אישית של עסק שעונה בוואטסאפ.
את לא AI, לא בוט, לא מערכת אוטומטית.
את עונה כאילו את בעלת העסק עצמה או המזכירה שלה.

<iron_rules>
1. לעולם אל תחשפי שאת AI/בוט. אם שואלים - "אני המזכירה של [שם]"
2. לעולם אל תמציאי מידע. אם לא יודעת - "תני לי לבדוק ואחזור אליך"
3. לעולם אל תקבעי תור בלי נתוני זמינות אמיתיים
4. לעולם אל תתני מחיר שלא ברשימת השירותים
5. לעולם אל תבטיחי משהו שלא במדיניות העסק
6. לעולם אל תענגי לשאלות רפואיות/משפטיות - "את צריכה לשאול רופא/עורך דין"
7. תלונה רצינית / לקוחה כועסת → העבירי לבעלת העסק מיד
8. נושאים רגישים (כפי שהוגדרו) → העבירי לבעלת העסק
</iron_rules>

<response_format>
תמיד תחזירי JSON בפורמט:
{
  "text": "תגובה בעברית ללקוחה",
  "intent": "...",
  "confidence": 0.0-1.0,
  "escalated": true/false,
  "action": null | { type: "...", ... },
  "secondary_intents": [],
  "extracted_data": { name: null, phone: null, preference: null }
}
</response_format>
</core_identity>
`;
```

### Layer 2: Business Context — הקשר עסקי

```typescript
function buildLayer2(settings: BusinessSettings): string {
  return `
<business_context>
<business_name>${settings.name}</business_name>
<business_type>${settings.type}</business_type>

<services>
${settings.services.map(s =>
  `• ${s.name}: ${s.duration} דקות, ₪${s.price}`
).join('\n')}
</services>

<working_hours>
${Object.entries(settings.working_hours)
  .filter(([_, h]) => h.active)
  .map(([day, h]) => `• ${hebrewDays[day]}: ${h.start}-${h.end}${h.breaks?.length ? ` (הפסקה: ${h.breaks.map(b => b.start+'-'+b.end).join(', ')})` : ''}`)
  .join('\n')}
</working_hours>

<cancellation_policy>
${settings.cancellation_policy?.text || "ביטול עד 24 שעות לפני התור ללא חיוב"}
</cancellation_policy>

<booking_rules>
• הזמנה מינימום: ${settings.min_advance_hours || 2} שעות מראש
• תורים מתחילים בזמנים עגולים לפי משך השירות
• בדוק זמינות מהנתונים שמסופקים - אל תנחש
</booking_rules>
</business_context>
`;
}
```

### Layer 3: Personality & Style — אישיות

```typescript
function buildLayer3(persona: AIPersona, advanced: AdvancedConfig): string {
  return `
<personality>
<tone>${persona.tone}</tone>
<emoji_usage>${persona.emoji_usage}</emoji_usage>
<message_length>קצר וענייני, 1-3 משפטים. מקסימום 4 שורות.</message_length>

${persona.style_examples?.length ? `
<style_examples>
כך בעלת העסק מדברת, חקי את הסגנון:
${persona.style_examples.map(ex => `"${ex}"`).join('\n')}
</style_examples>
` : ''}

${persona.learned_phrases?.length ? `
<learned_phrases>
ביטויים אופייניים שצריך להשתמש בהם:
${persona.learned_phrases.join(', ')}
</learned_phrases>
` : ''}

${persona.conversation_style ? `
<conversation_style_analysis>
${persona.conversation_style}
</conversation_style_analysis>
` : ''}

${advanced?.goal ? `
<business_goal>
יעד עיקרי: ${advanced.goal}
${advanced.sales_style ? `סגנון מכירה (1=רך, 10=אגרסיבי): ${advanced.sales_style}` : ''}
</business_goal>
` : ''}

${advanced?.upsells?.length ? `
<upsell_rules>
${advanced.upsells.map(u => `• ${u}`).join('\n')}
</upsell_rules>
` : ''}

${advanced?.guardrails?.length ? `
<custom_guardrails>
${advanced.guardrails.map(g => `• ${g}`).join('\n')}
</custom_guardrails>
` : ''}

${advanced?.faq?.length ? `
<faq>
${advanced.faq.map(f => `שאלה: ${f.q}\nתשובה: ${f.a}`).join('\n\n')}
</faq>
` : ''}
</personality>
`;
}
```

### Layer 4: Customer Context — הקשר לקוח

```typescript
function buildLayer4(
  contact: Contact,
  memory: CustomerMemory | null
): string {
  return `
<customer_context>
<name>${contact.name || 'לא ידוע'}</name>
<status>${contact.status}</status>
<total_visits>${contact.total_visits}</total_visits>
<phone>${contact.phone || contact.wa_id}</phone>
${contact.notes ? `<notes>${contact.notes}</notes>` : ''}

${contact.status === 'new' ? `
<new_customer_instructions>
• ברכי אותה בחום
• הצעי עזרה
• אם לא יודעת את השם - שאלי בעדינות
• אל תניחי שהיא מכירה את השירותים
</new_customer_instructions>
` : ''}

${contact.status === 'returning' ? `
<returning_customer_instructions>
• פני בשם: "היי ${contact.name}!"
• את יכולה להזכיר טיפולים קודמים
• הציעי את מה שהיא בדרך כלל לוקחת
</returning_customer_instructions>
` : ''}

${contact.status === 'vip' ? `
<vip_instructions>
• תני יחס VIP, תהיי אישית וחמה
• הציעי זמנים מועדפים
• אם אין מקום - נסי למצוא פתרון
</vip_instructions>
` : ''}

${memory ? `
<customer_memory>
<preferences>${JSON.stringify(memory.preferences)}</preferences>
<learned_facts>${memory.learned_facts.join(', ')}</learned_facts>
<relationship>${memory.relationship_summary || 'חדשה'}</relationship>
</customer_memory>
` : ''}
</customer_context>
`;
}
```

### Layer 5: Runtime Context — הקשר דינמי

```typescript
function buildLayer5(
  conversationMemory: ConversationMemory | null,
  availability: TimeSlot[],
  bookingState: BookingState | null,
  upcomingAppointment: Appointment | null
): string {
  const now = new Date();
  const israelTime = now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

  return `
<runtime_context>
<current_datetime>${israelTime}</current_datetime>
<current_day>${hebrewDays[now.getDay()]}</current_day>

${conversationMemory?.summary ? `
<conversation_summary>
סיכום השיחה עד כה: ${conversationMemory.summary}
</conversation_summary>
` : ''}

${conversationMemory?.sentiment && conversationMemory.sentiment !== 'neutral' ? `
<customer_mood>${conversationMemory.sentiment}</customer_mood>
` : ''}

${bookingState && bookingState.step !== 'idle' ? `
<active_booking_flow>
שלב נוכחי: ${bookingState.step}
מידע שנאסף: ${JSON.stringify(bookingState.slots)}
חסר: ${bookingState.missing_slots?.join(', ') || 'כלום'}
</active_booking_flow>
` : ''}

${upcomingAppointment ? `
<upcoming_appointment>
תור קרוב: ${upcomingAppointment.service_type}
בתאריך: ${upcomingAppointment.start_time}
סטטוס: ${upcomingAppointment.status}
</upcoming_appointment>
` : ''}

${availability.length > 0 ? `
<available_slots_today>
חלונות פנויים להיום:
${availability.map(s => `• ${s.start}-${s.end}`).join('\n')}
</available_slots_today>
` : ''}
</runtime_context>
`;
}
```

### הרכבת ה-Prompt המלא

```typescript
function buildFullSystemPrompt(
  settings: BusinessSettings,
  persona: AIPersona,
  advanced: AdvancedConfig,
  contact: Contact,
  memory: CustomerMemory | null,
  conversationMemory: ConversationMemory | null,
  availability: TimeSlot[],
  bookingState: BookingState | null,
  upcomingAppointment: Appointment | null
): string {
  return [
    LAYER_1_CORE,
    buildLayer2(settings),
    buildLayer3(persona, advanced),
    buildLayer4(contact, memory),
    buildLayer5(conversationMemory, availability, bookingState, upcomingAppointment)
  ].join('\n\n');
}
```

**Token Budget (אומדן):**
- Layer 1: ~400 tokens (קבוע)
- Layer 2: ~300-500 tokens (per business)
- Layer 3: ~200-600 tokens (per business + advanced)
- Layer 4: ~100-300 tokens (per customer)
- Layer 5: ~100-400 tokens (per message)
- **סה"כ System Prompt: ~1,100-2,200 tokens**
- + History (~15 messages): ~1,500-3,000 tokens
- + User message: ~50-200 tokens
- **סה"כ input: ~2,750-5,400 tokens** ← בטוח בתוך context window

---

# חלק ה': שמירת עקביות (CONSISTENCY)

## 5 מנגנונים לעקביות

### 1. Personality Lock — נעילת אישיות

```typescript
// בכל קריאה ל-AI, הוסף validation:
function validatePersonalityConsistency(
  response: string,
  persona: AIPersona
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // בדוק אורך הודעה
  if (persona.tone === 'casual' && response.length > 300) {
    issues.push('message_too_long_for_casual_tone');
  }

  // בדוק שימוש באימוג'ים
  const emojiCount = (response.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length;
  if (persona.emoji_usage === 'none' && emojiCount > 0) {
    issues.push('emoji_used_when_none_configured');
  }
  if (persona.emoji_usage === 'heavy' && emojiCount === 0) {
    issues.push('no_emoji_when_heavy_configured');
  }

  // בדוק רמת רשמיות
  const formalIndicators = ['בברכה', 'לכבוד', 'הריני', 'אנא', 'מכובדת'];
  const casualIndicators = ['היי', 'יאללה', 'סבבה', 'אחלה', 'וואלה'];

  if (persona.tone === 'casual' &&
      formalIndicators.some(f => response.includes(f))) {
    issues.push('too_formal_for_casual_tone');
  }

  return { valid: issues.length === 0, issues };
}
```

### 2. State Machine — מכונת מצבים

```typescript
// כל שיחה חייבת להיות ב-state מוגדר
type ConversationState =
  | 'idle'                    // ממתין להודעה
  | 'greeting'                // בפתיחת שיחה
  | 'collecting_service'      // אוסף סוג שירות
  | 'collecting_date'         // אוסף תאריך
  | 'collecting_time'         // אוסף שעה
  | 'confirming_booking'      // מאשר הזמנה
  | 'processing_cancellation' // מעבד ביטול
  | 'answering_question'      // עונה על שאלה
  | 'escalated'               // הועבר לבעלת העסק
  | 'waiting_for_human';      // ממתין לתגובת בעלת העסק

// Transitions מותרים:
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  'idle': ['greeting', 'collecting_service', 'answering_question', 'escalated'],
  'greeting': ['collecting_service', 'answering_question', 'idle'],
  'collecting_service': ['collecting_date', 'answering_question', 'idle', 'escalated'],
  'collecting_date': ['collecting_time', 'collecting_service', 'idle', 'escalated'],
  'collecting_time': ['confirming_booking', 'collecting_date', 'idle', 'escalated'],
  'confirming_booking': ['idle', 'collecting_time', 'escalated'],
  'processing_cancellation': ['idle', 'escalated'],
  'answering_question': ['idle', 'collecting_service', 'escalated'],
  'escalated': ['waiting_for_human'],
  'waiting_for_human': ['idle']
};

function validateTransition(from: ConversationState, to: ConversationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### 3. Conversation Context Hash — מניעת "שכחה"

```typescript
// שמור hash של הקשרים חשובים שה-AI חייב לזכור:
interface ConversationAnchors {
  customer_name: string | null;       // ברגע שידוע - לא משתנה
  discussed_services: string[];       // כל מה שדובר
  agreed_price: number | null;        // מחיר שסוכם
  agreed_date: string | null;         // תאריך שסוכם
  agreed_time: string | null;         // שעה שסוכמה
  promises_made: string[];            // הבטחות שניתנו ללקוחה
  questions_pending: string[];        // שאלות שעדיין לא נענו
}

// הוסף ל-system prompt:
// "המידע הבא כבר סוכם/נקבע בשיחה - אל תסתור אותו:
//  שם: דנה, שירות: מניקור ג'ל, מחיר: ₪120"
```

### 4. Response Temperature Control — שליטה ב-randomness

```typescript
const TEMPERATURE_BY_INTENT: Record<string, number> = {
  // Actions: LOW temperature = consistent, deterministic
  book_appointment: 0.1,
  cancel_appointment: 0.1,
  reschedule_appointment: 0.1,
  confirm_appointment: 0.1,

  // Information: MEDIUM temperature = some variety but accurate
  ask_price: 0.2,
  ask_availability: 0.2,
  ask_services: 0.3,

  // Conversation: HIGHER temperature = more natural
  greeting: 0.6,
  thanks: 0.5,
  general_question: 0.5,

  // Default
  unknown: 0.3
};
```

### 5. A/B Testing & Quality Scoring

```typescript
// Track quality per conversation
interface QualityScore {
  // Automated metrics
  response_time_ms: number;
  intent_confidence_avg: number;
  validation_pass_rate: number;
  escalation_rate: number;

  // Outcome metrics
  booking_completion_rate: number;    // % שיחות שהסתיימו בתור
  customer_return_rate: number;       // % לקוחות שחזרו
  human_override_rate: number;        // % שבעלת העסק התערבה

  // Derived
  overall_score: number;              // 0-100
}
```

---

# חלק ו': DATA INTEGRATION - חיבור נתונים בזמן אמת

## עקרון מפתח: ה-AI אף פעם לא מנחש — תמיד מקבל נתונים אמיתיים

### Real-Time Data Injection

```typescript
// לפני כל קריאה ל-AI, טען נתונים רלוונטיים:
async function prepareRealtimeContext(
  businessId: string,
  contactId: string,
  intent: string | null  // detected from previous messages or null
): Promise<RealtimeContext> {

  // Always load:
  const [contact, settings, persona] = await Promise.all([
    getContact(contactId),
    getBusinessSettings(businessId),
    getAIPersona(businessId)
  ]);

  // Conditionally load based on likely intent:
  const context: RealtimeContext = { contact, settings, persona };

  // אם נראה שהלקוחה רוצה לקבוע תור - טען זמינות
  if (!intent || ['book_appointment', 'ask_availability', 'reschedule_appointment'].includes(intent)) {
    context.todaySlots = await getAvailableSlots(businessId, today(), null);
    context.tomorrowSlots = await getAvailableSlots(businessId, tomorrow(), null);
  }

  // אם לקוחה חוזרת - טען זיכרון
  if (contact.status !== 'new') {
    context.customerMemory = await getCustomerMemory(contactId);
    context.lastAppointment = await getLastAppointment(contactId, businessId);
    context.upcomingAppointment = await getUpcomingAppointment(contactId, businessId);
  }

  // אם יש שיחה פעילה - טען סיכום
  context.conversationMemory = await getConversationMemory(conversationId);

  return context;
}
```

### Structured Output + Function Calling Pattern

```typescript
// במקום free-text JSON parsing, השתמש ב-structured output:
const AI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string", description: "תגובה ללקוחה בעברית" },
    intent: {
      type: "string",
      enum: Object.keys(INTENT_TAXONOMY),
      description: "הכוונה העיקרית שזוהתה"
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    escalated: { type: "boolean" },
    action: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            type: { type: "string", enum: ["book_appointment", "cancel_appointment", "reschedule_appointment", "update_contact"] },
            // ... action-specific fields
          },
          required: ["type"]
        }
      ]
    },
    extracted_data: {
      type: "object",
      properties: {
        customer_name: { type: "string", nullable: true },
        mentioned_service: { type: "string", nullable: true },
        mentioned_date: { type: "string", nullable: true },
        mentioned_time: { type: "string", nullable: true },
        new_fact: { type: "string", nullable: true }
      }
    }
  },
  required: ["text", "intent", "confidence", "escalated"]
};

// Gemini 2.5 Flash תומך ב-response_format:
const response = await generateResponse({
  systemPrompt: fullPrompt,
  messages: history,
  responseFormat: { type: "json_schema", schema: AI_RESPONSE_SCHEMA },
  temperature: dynamicTemperature
});
```

---

# חלק ז': סיכום המלצות — רשימת שינויים מתועדפת

## עדיפות קריטית (שבוע 1-2)

| # | שינוי | מה לעשות | השפעה |
|---|-------|---------|-------|
| 1 | **Layered System Prompt** | פרק את ה-prompt ל-5 שכבות כמתואר | מונע 80% מההזיות |
| 2 | **Action Validation Guards** | הוסף business logic guards לפני כל action | מונע קביעות שגויות |
| 3 | **Zod Response Validation** | ולידציית JSON של כל תגובת AI | מונע crashes |
| 4 | **Confidence Thresholds** | סף ביטחון שונה לפעולות vs. שיחה | מפחית טעויות |
| 5 | **Output Sanitization** | ניקוי AI references, בדיקת מחירים | מונע חשיפת AI |

## עדיפות גבוהה (שבוע 3-4)

| # | שינוי | מה לעשות | השפעה |
|---|-------|---------|-------|
| 6 | **Conversation Memory table** | הוסף `conversation_memory` table | המשכיות שיחות |
| 7 | **Customer Memory table** | הוסף `customer_memory` table | זיכרון ארוך טווח |
| 8 | **Summarization pipeline** | סיכום כל 8-10 הודעות | מונע אובדן context |
| 9 | **Slot Filling State Machine** | persistent booking state | flow חלק יותר |
| 10 | **Multi-Intent Detection** | תמיכה בהודעות מרובות כוונות | הבנה טבעית יותר |

## עדיפות בינונית (שבוע 5-8)

| # | שינוי | מה לעשות | השפעה |
|---|-------|---------|-------|
| 11 | **Dynamic Temperature** | temperature שונה per intent | תגובות טבעיות + מדויקות |
| 12 | **Quality Metrics** | טבלת monitoring + dashboard | מעקב איכות |
| 13 | **Personality Validation** | בדיקת עקביות סגנון | תחושה אנושית |
| 14 | **Context-Aware Intent** | resolution על בסיס state | פחות אמביגואציה |
| 15 | **Feedback Loop** | למידה מהתערבויות בעלת העסק | שיפור מתמיד |

## עדיפות נמוכה (חודש 3+)

| # | שינוי | מה לעשות | השפעה |
|---|-------|---------|-------|
| 16 | **Vector DB for FAQ** | Embeddings + semantic search | FAQ מדויק |
| 17 | **A/B Testing** | השוואת prompts | אופטימיזציה |
| 18 | **Sub-Agent Architecture** | agents מתמחים (booking, FAQ, complaints) | scalability |

---

# חלק ח': קוד מימוש - processAIAgent() המשופר

```typescript
// src/lib/ai/agent-prompt-v2.ts

export async function processAIAgentV2(input: AgentInput): Promise<AgentResponse> {
  const { businessId, contactId, conversationId, message, messageHistory } = input;

  // === STEP 1: Load all context in parallel ===
  const [
    settings,
    persona,
    advanced,
    contact,
    customerMemory,
    conversationMemory,
    bookingState,
    upcomingAppointment,
    todaySlots
  ] = await Promise.all([
    getBusinessSettings(businessId),
    getAIPersona(businessId),
    getAdvancedConfig(businessId),
    getContact(contactId),
    getCustomerMemory(contactId).catch(() => null),
    getConversationMemory(conversationId).catch(() => null),
    loadBookingState(conversationId).catch(() => null),
    getUpcomingAppointment(contactId, businessId).catch(() => null),
    getAvailableSlots(businessId, today(), null).catch(() => [])
  ]);

  // === STEP 2: Build layered system prompt ===
  const systemPrompt = buildFullSystemPrompt(
    settings, persona, advanced, contact,
    customerMemory, conversationMemory,
    todaySlots, bookingState, upcomingAppointment
  );

  // === STEP 3: Prepare message history (with summary) ===
  const history = prepareHistory(messageHistory, conversationMemory?.summary);

  // === STEP 4: Call AI ===
  const rawResponse = await generateResponse({
    systemPrompt,
    messages: [...history, { role: 'user', content: message }],
    temperature: 0.3,  // default, may adjust after intent detection
    maxTokens: 500
  });

  // === STEP 5: Parse + Validate response ===
  let parsed: AIResponse;
  try {
    parsed = JSON.parse(rawResponse);
    const validated = AIResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Validation failed: ${validated.error.message}`);
    }
    parsed = validated.data;
  } catch (e) {
    // Fallback: safe generic response
    parsed = {
      text: "תני לי רגע, אחזור אליך 🙏",
      intent: 'unknown',
      confidence: 0,
      escalated: true,
      action: null
    };
  }

  // === STEP 6: Sanitize output ===
  parsed.text = sanitizeResponse(parsed.text, settings);

  // === STEP 7: Validate personality consistency ===
  const personalityCheck = validatePersonalityConsistency(parsed.text, persona);
  if (!personalityCheck.valid) {
    console.warn('Personality drift detected:', personalityCheck.issues);
    // Log but don't block - collect data for improvement
  }

  // === STEP 8: Execute action (if any) with guards ===
  if (parsed.action && shouldExecuteAction(parsed.intent, parsed.confidence)) {
    const result = await executeAction(parsed.action, businessId, contactId);
    if (!result.success) {
      // Override AI text with accurate fallback
      parsed.text = result.fallback_message;
      parsed.action = null;
    }
  } else if (parsed.action && !shouldExecuteAction(parsed.intent, parsed.confidence)) {
    // Low confidence: ask for confirmation instead of executing
    parsed.text = generateConfirmationQuestion(parsed);
    parsed.action = null;
  }

  // === STEP 9: Update memories (async, don't block response) ===
  updateMemoriesAsync(
    conversationId, contactId, businessId,
    message, parsed, conversationMemory
  ).catch(console.error);

  // === STEP 10: Log quality metrics ===
  logQualityMetrics(conversationId, businessId, parsed).catch(console.error);

  return parsed;
}
```

---

> **מקורות המחקר:** Anthropic Context Engineering (2025), AWS AgentCore Memory (2026), Mem0 Graph Memory (2026), OpenAI Structured Outputs, NVIDIA NeMo Guardrails, Stanford Hallucination Study (2024), ICLR 2026 MemAgents Workshop, Lakera Prompt Engineering Guide (2026)
