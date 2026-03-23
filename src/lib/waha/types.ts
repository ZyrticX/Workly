export interface WahaSession {
  name: string
  status: 'STARTING' | 'WORKING' | 'STOPPED' | 'FAILED'
  config?: Record<string, unknown>
}

export interface WahaMessage {
  id: string
  from: string
  to: string
  body: string
  fromMe: boolean
  type: string
  session: string
  notifyName?: string
}

export interface WebhookPayload {
  event: 'message' | 'message.ack' | 'session.status'
  session: string
  payload: Record<string, unknown>
}

export interface WahaQR {
  value: string
  mimetype: string
}

export interface WahaSendResult {
  id: string
  status: string
}
