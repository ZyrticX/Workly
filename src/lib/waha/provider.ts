import { waha } from '@/lib/waha/waha-client'

// ── WhatsApp Provider Interface ─────────────────────────
// Abstract interface so we can swap WAHA for Cloud API later.

export interface WhatsAppProvider {
  sendMessage(sessionId: string, to: string, text: string): Promise<void>
  sendImage(
    sessionId: string,
    to: string,
    url: string,
    caption?: string
  ): Promise<void>
  getSessionStatus(
    sessionId: string
  ): Promise<'WORKING' | 'STOPPED' | 'STARTING' | 'FAILED'>
  createSession(name: string): Promise<string>
  getQR(sessionId: string): Promise<string>
}

// ── WAHA Implementation ─────────────────────────────────

export class WahaProvider implements WhatsAppProvider {
  async sendMessage(sessionId: string, to: string, text: string): Promise<void> {
    await waha.sendText(sessionId, to, text)
  }

  async sendImage(
    sessionId: string,
    to: string,
    url: string,
    caption?: string
  ): Promise<void> {
    await waha.sendImage(sessionId, to, url, caption)
  }

  async getSessionStatus(
    sessionId: string
  ): Promise<'WORKING' | 'STOPPED' | 'STARTING' | 'FAILED'> {
    const session = await waha.getSession(sessionId)
    return session.status
  }

  async createSession(name: string): Promise<string> {
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/waha`
      : undefined

    const session = await waha.createSession(name, webhookUrl)
    return session.name
  }

  async getQR(sessionId: string): Promise<string> {
    const qr = await waha.getQR(sessionId)
    return qr.value
  }
}

// Future: CloudApiProvider implements WhatsAppProvider

/** Singleton WhatsApp provider */
export const whatsapp: WhatsAppProvider = new WahaProvider()
