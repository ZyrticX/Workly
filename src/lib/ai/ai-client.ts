/**
 * AI Client — Uses OpenRouter API (OpenAI-compatible)
 * Supports any model available on OpenRouter (Claude, GPT, Gemini, etc.)
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4.1-mini'

export interface ConversationEntry {
  role: 'user' | 'model' | 'assistant'
  text: string
}

export interface GenerateOptions {
  maxTokens?: number
  temperature?: number
}

/**
 * Generate a response using OpenRouter API.
 * Compatible with any model on OpenRouter.
 */
export async function generateResponse(
  systemPrompt: string,
  conversationHistory: ConversationEntry[],
  userMessage: string,
  options?: GenerateOptions
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map((entry) => ({
      role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant',
      content: entry.text,
    })),
    { role: 'user' as const, content: userMessage },
  ]

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
    const err = new Error(`AI request failed: ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * Generate a response with vision (for screenshot analysis)
 */
export async function generateVisionResponse(
  systemPrompt: string,
  images: { base64: string; mimeType: string }[],
  userMessage: string
): Promise<string> {
  const content: any[] = [{ type: 'text', text: userMessage }]

  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    })
  }

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
    throw new Error(`AI vision request failed: ${res.status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
