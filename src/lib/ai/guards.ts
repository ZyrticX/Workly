/**
 * AI Guards — Input guardrails, output PII filtering, rate limiting
 */

import { getRedis } from '@/lib/cache/redis'

// ── Input Guard: Prompt Injection Detection ─────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(a\s+)?different/i,
  /pretend\s+you\s+are/i,
  /new\s+instructions?:/i,
  /system\s*prompt/i,
  /DAN\s+mode/i,
  /jailbreak/i,
  /bypass\s+(your\s+)?(safety|filter|restriction)/i,
  /reveal\s+(your\s+)?(system|instructions|prompt)/i,
]

export interface InputGuardResult {
  flagged: boolean
  pattern?: string
}

export function checkInput(message: string): InputGuardResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      console.warn(`[guard] Prompt injection detected: "${message.substring(0, 80)}" matched ${pattern}`)
      return { flagged: true, pattern: pattern.source }
    }
  }
  return { flagged: false }
}

// ── Output Guard: PII Stripping ──────────────────

// Israeli phone formats: 05X-XXXXXXX, +972-XX-XXXXXXX, 972XXXXXXXX
const PHONE_PATTERNS = [
  /\b0[2-9]\d[\s-]?\d{3}[\s-]?\d{4}\b/g,
  /\+?972[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
]

export function stripPII(text: string): string {
  let result = text
  for (const pattern of PHONE_PATTERNS) {
    result = result.replace(pattern, '[מספר טלפון]')
  }
  return result
}

// ── Rate Limiter ─────────────────────────────────

const RATE_LIMITS = {
  minute: { max: 10, window: 60 },
  hour: { max: 100, window: 3600 },
}

const RATE_LIMIT_MESSAGE = 'שנייה, קיבלתי הרבה הודעות 😅 נסה/י שוב בעוד דקה'

export interface RateLimitResult {
  allowed: boolean
  message?: string
}

export async function checkRateLimit(contactId: string): Promise<RateLimitResult> {
  try {
    const redis = getRedis()
    const minKey = `rl:${contactId}:min`
    const hrKey = `rl:${contactId}:hr`

    const [minCount, hrCount] = await Promise.all([
      redis.incr(minKey),
      redis.incr(hrKey),
    ])

    // Set TTL on first increment
    if (minCount === 1) await redis.expire(minKey, RATE_LIMITS.minute.window)
    if (hrCount === 1) await redis.expire(hrKey, RATE_LIMITS.hour.window)

    if (minCount > RATE_LIMITS.minute.max) {
      console.warn(`[guard] Rate limit (minute) exceeded for contact ${contactId}: ${minCount}/${RATE_LIMITS.minute.max}`)
      return { allowed: false, message: RATE_LIMIT_MESSAGE }
    }

    if (hrCount > RATE_LIMITS.hour.max) {
      console.warn(`[guard] Rate limit (hour) exceeded for contact ${contactId}: ${hrCount}/${RATE_LIMITS.hour.max}`)
      return { allowed: false, message: RATE_LIMIT_MESSAGE }
    }

    return { allowed: true }
  } catch {
    // Redis down — allow through (graceful degradation)
    return { allowed: true }
  }
}
