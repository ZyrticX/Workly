import type { WahaSession, WahaQR, WahaSendResult } from '@/lib/waha/types'

const WAHA_URL = process.env.WAHA_API_URL
const WAHA_KEY = process.env.WAHA_API_KEY

export class WahaClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || WAHA_URL || ''
    this.apiKey = apiKey || WAHA_KEY || ''
  }

  private async request<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
        ...options.headers,
      },
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error')
      throw new Error(
        `WAHA API error: ${res.status} ${res.statusText} — ${errorBody}`
      )
    }

    return res.json() as Promise<T>
  }

  // ── Sessions ──────────────────────────────────────────

  async createSession(
    name: string,
    webhookUrl?: string
  ): Promise<WahaSession> {
    const config: Record<string, unknown> = {}

    if (webhookUrl) {
      config.webhooks = [
        {
          url: webhookUrl,
          events: ['message', 'message.ack', 'session.status'],
        },
      ]
    }

    return this.request<WahaSession>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    })
  }

  async getSession(name: string): Promise<WahaSession> {
    return this.request<WahaSession>(`/api/sessions/${name}`)
  }

  async getSessions(): Promise<WahaSession[]> {
    return this.request<WahaSession[]>('/api/sessions')
  }

  // ── Auth / QR ─────────────────────────────────────────

  async getQR(sessionName: string): Promise<WahaQR> {
    return this.request<WahaQR>(`/api/${sessionName}/auth/qr`)
  }

  // ── Messaging ─────────────────────────────────────────

  async sendText(
    session: string,
    to: string,
    text: string
  ): Promise<WahaSendResult> {
    // If 'to' already has @c.us or @lid suffix, use as-is; otherwise add @c.us
    const chatId = to.includes('@') ? to : `${to}@c.us`
    return this.request<WahaSendResult>('/api/sendText', {
      method: 'POST',
      body: JSON.stringify({
        session,
        chatId,
        text,
      }),
    })
  }

  async sendImage(
    session: string,
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WahaSendResult> {
    const chatId = to.includes('@') ? to : `${to}@c.us`
    return this.request<WahaSendResult>('/api/sendImage', {
      method: 'POST',
      body: JSON.stringify({
        session,
        chatId,
        file: { url: imageUrl },
        caption,
      }),
    })
  }
}

/** Singleton client instance */
export const waha = new WahaClient()
