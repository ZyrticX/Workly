/**
 * AI Client — Uses Vercel AI SDK with OpenRouter provider
 * Supports any model available on OpenRouter (Claude, GPT, Gemini, etc.)
 */

import { generateText, tool } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'

const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4.1'

// ── Circuit Breaker ─────────────────────────────────
// Tracks consecutive failures and short-circuits when unhealthy.

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

// Tool call types (used by agent-processor)
export interface ToolCallResult {
  toolName: string
  args: Record<string, unknown>
}

export interface ToolResponse {
  text: string | null
  toolCalls: ToolCallResult[]
}

// ── Helper: Convert conversation entries to SDK messages ──

function toSDKMessages(history: ConversationEntry[]) {
  return history.map((entry) => ({
    role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant',
    content: entry.text,
  }))
}

// ── API Functions ───────────────────────────────────

/**
 * Generate a text response (no tools).
 * Used for data extraction, BI chat, insights, etc.
 */
export async function generateResponse(
  systemPrompt: string,
  conversationHistory: ConversationEntry[],
  userMessage: string,
  options?: GenerateOptions
): Promise<string> {
  const state = getCircuitState()
  if (state === 'OPEN') {
    console.warn('[AI Circuit Breaker] Circuit is OPEN — returning fallback')
    return FALLBACK_MESSAGE
  }
  if (state === 'HALF_OPEN') {
    console.info('[AI Circuit Breaker] Circuit is HALF_OPEN — attempting single request')
  }

  try {
    const { text } = await generateText({
      model: openrouter(AI_MODEL),
      system: systemPrompt,
      messages: [
        ...toSDKMessages(conversationHistory),
        { role: 'user' as const, content: userMessage },
      ],
      maxOutputTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
    })

    onSuccess()
    return text
  } catch (err) {
    onFailure()
    throw err
  }
}

// ── Tool Definitions (Zod schemas) ──────────────────

const AGENT_TOOLS = {
  update_contact: tool({
    description: 'Update contact info when customer provides new details (name, gender). Do NOT ask for phone — they are already on WhatsApp.',
    inputSchema: z.object({
      name: z.string().optional().describe('Customer name'),
      gender: z.enum(['male', 'female']).optional().describe('Detected gender from name or speech patterns'),
      notes: z.string().optional().describe('Notes about the customer'),
    }),
  }),
  escalate: tool({
    description: 'Transfer conversation to the business owner. Use when customer asks to speak with a human, has complaints, or sensitive issues.',
    inputSchema: z.object({}),
  }),
}

/**
 * Generate a response with tool calling support.
 * The model can respond with text, tool calls, or both.
 */
export async function generateResponseWithTools(
  systemPrompt: string,
  conversationHistory: ConversationEntry[],
  userMessage: string,
  options?: GenerateOptions
): Promise<ToolResponse> {
  const state = getCircuitState()
  if (state === 'OPEN') {
    return { text: FALLBACK_MESSAGE, toolCalls: [] }
  }

  try {
    const result = await generateText({
      model: openrouter(AI_MODEL),
      system: systemPrompt,
      messages: [
        ...toSDKMessages(conversationHistory),
        { role: 'user' as const, content: userMessage },
      ],
      tools: AGENT_TOOLS,
      maxOutputTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
    })

    onSuccess()

    // Convert SDK tool calls to our format
    const toolCalls: ToolCallResult[] = (result.toolCalls || []).map((tc) => ({
      toolName: tc.toolName,
      args: tc.input as Record<string, unknown>,
    }))

    return {
      text: result.text || null,
      toolCalls,
    }
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
  const state = getCircuitState()
  if (state === 'OPEN') {
    console.warn('[AI Circuit Breaker] Circuit is OPEN — returning fallback (vision)')
    return FALLBACK_MESSAGE
  }

  try {
    const visionModel = process.env.AI_VISION_MODEL || 'openai/gpt-4.1'

    const imageParts = images.map((img) => ({
      type: 'image' as const,
      image: Buffer.from(img.base64, 'base64'),
      mimeType: img.mimeType,
    }))

    const { text } = await generateText({
      model: openrouter(visionModel),
      system: systemPrompt,
      messages: [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: userMessage },
            ...imageParts,
          ],
        },
      ],
      maxOutputTokens: 2048,
      temperature: 0.5,
    })

    onSuccess()
    return text
  } catch (err) {
    onFailure()
    throw err
  }
}
