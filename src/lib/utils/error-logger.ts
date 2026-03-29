import { createServiceClient } from '@/lib/supabase/service'

const ADMIN_WHATSAPP = '972533555148'
const WAHA_URL = process.env.WAHA_API_URL || 'http://localhost:3000'
const WAHA_KEY = process.env.WAHA_API_KEY || ''

interface ErrorLogEntry {
  businessId?: string
  source: string // 'webhook' | 'ai_agent' | 'action_executor' | 'api'
  severity: 'warning' | 'error' | 'critical'
  message: string
  details?: Record<string, unknown>
  contactName?: string
}

/**
 * Log error to DB + send critical errors to admin WhatsApp
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    const supabase = createServiceClient()

    // 1. Save to error_logs table
    await supabase.from('error_logs').insert({
      business_id: entry.businessId || null,
      source: entry.source,
      severity: entry.severity,
      message: entry.message,
      details: entry.details || {},
      contact_name: entry.contactName || null,
    })

    // 2. Send critical errors to admin WhatsApp
    if (entry.severity === 'critical') {
      await sendAdminAlert(entry)
    }
  } catch (err) {
    // Don't crash if logging fails
    console.error('[error-logger] Failed to log error:', err)
  }
}

async function sendAdminAlert(entry: ErrorLogEntry): Promise<void> {
  try {
    // Find any connected WAHA session to send from
    const supabase = createServiceClient()
    const { data: phone } = await supabase
      .from('phone_numbers')
      .select('session_id')
      .eq('status', 'connected')
      .limit(1)
      .single()

    if (!phone?.session_id) return

    const alertMsg = `⚠️ שגיאה קריטית
מקור: ${entry.source}
${entry.businessId ? `עסק: ${entry.businessId.slice(0, 8)}` : ''}
${entry.contactName ? `לקוח: ${entry.contactName}` : ''}
שגיאה: ${entry.message.slice(0, 200)}
⏰ ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}`

    await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_KEY,
      },
      body: JSON.stringify({
        session: phone.session_id,
        chatId: `${ADMIN_WHATSAPP}@c.us`,
        text: alertMsg,
      }),
    })
  } catch {
    // Silent — if WhatsApp alert fails, at least DB log exists
  }
}
