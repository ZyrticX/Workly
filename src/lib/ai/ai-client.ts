/**
 * AI Client — Uses OpenRouter API (OpenAI-compatible)
 * Supports any model available on OpenRouter (Claude, GPT, Gemini, etc.)
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4.1-mini'

// ── Circuit Breaker ─────────────────────────────────
// Tracks consecutive failures to OpenRouter and short-circuits
// when the service appears unhealthy, avoiding cascading timeouts.

let consecutiveFailures = 0
let circuitOpenUntil = 0
const MAX_FAILURES = 5
const CIRCUIT_TIMEOUT = 60_000 // 60 seconds

const FALLBACK_MESSAGE = 'שנייה, בודק ואחזור אליך 🙏'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

function getCircuitState(): CircuitState {
  if (consecutiveFailures < MAX_FAILURES) return 'CLOSED'
  if (Date.now() < circuitOpenUntil) return 'OPEN'
  return 'HALF_OPEN'
}

function onSuccess(): void {
  consecutiveFailures = 0
  circuitOpenUntil = 0
}

function onFailure(): void {
  consecutiveFailures++
  if (consecutiveFailures >= MAX_FAILURES) {
    circuitOpenUntil = Date.now() + CIRCUIT_TIMEOUT
    console.error(`[AI Circuit Breaker] Circuit OPEN after ${consecutiveFailures} consecutive failures. Will retry after ${CIRCUIT_TIMEOUT / 1000}s.`)
  }
}

// ── Types ───────────────────────────────────────────

export interface ConversationEntry {
  role: 'user' | 'model' | 'assistant'
  text: string
}

export interface GenerateOptions {
  maxTokens?: number
  temperature?: number
}

type VisionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

// ── API Functions ───────────────────────────────────

/**
 * Generate a response using OpenRouter API.
 * Compatible with any model on OpenRouter.
 *
 * Includes a circuit breaker: after 5 consecutive failures the circuit
 * opens for 60 seconds and returns a Hebrew fallback message immediately.
 */
export async function generateResponse(
  systemPrompt: string,
  conversationHistory: ConversationEntry[],
  userMessage: string,
  options?: GenerateOptions
): Promise<string> {
  // Circuit breaker check
  const state = getCircuitState()
  if (state === 'OPEN') {
    console.warn('[AI Circuit Breaker] Circuit is OPEN — returning fallback')
    return FALLBACK_MESSAGE
  }
  if (state === 'HALF_OPEN') {
    console.info('[AI Circuit Breaker] Circuit is HALF_OPEN — attempting single request')
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((entry) => ({
      role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant',
      content: entry.text,
    })),
    { role: 'user' as const, content: userMessage },
  ]

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://auto-crm.org',
        'X-Title': 'WhatsApp AI Agent Platform',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('[AI] OpenRouter error:', error)
      onFailure()
      const err = new Error(`AI request failed: ${res.status}`) as Error & { status: number }
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    onSuccess()
    return content
  } catch (err) {
    onFailure()
    throw err
  }
}

/**
 * Generate a response with vision (for screenshot analysis)
 */
export async function generateVisionResponse(
  systemPrompt: string,
  images: { base64: string; mimeType: string }[],
  userMessage: string
): Promise<string> {
  // Circuit breaker check
  const state = getCircuitState()
  if (state === 'OPEN') {
    console.warn('[AI Circuit Breaker] Circuit is OPEN — returning fallback (vision)')
    return FALLBACK_MESSAGE
  }

  const content: VisionContentPart[] = [{ type: 'text', text: userMessage }]

  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    })
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://auto-crm.org',
        'X-Title': 'WhatsApp AI Agent Platform',
      },
      body: JSON.stringify({
        model: process.env.AI_VISION_MODEL || 'google/gemini-2.5-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        temperature: 0.5,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('[AI Vision] OpenRouter error:', error)
      onFailure()
      throw new Error(`AI vision request failed: ${res.status}`)
    }

    const data = await res.json()
    const result = data.choices?.[0]?.message?.content || ''
    onSuccess()
    return result
  } catch (err) {
    onFailure()
    throw err
  }
}
