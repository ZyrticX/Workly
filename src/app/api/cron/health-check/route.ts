import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { waha } from '@/lib/waha/waha-client'

// ── Health Check Cron ───────────────────────────────────
// GET /api/cron/health-check
// Compares WAHA sessions with DB phone_numbers, updates statuses,
// and sends Telegram alerts for disconnected numbers.
//
// Meant to be called by a cron service (e.g., Vercel Cron, external cron).
// Protected by CRON_SECRET env var.

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret — fail closed if not configured
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[health-check] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // 1. Get all sessions from WAHA
    let sessions: Array<{ name: string; status: string }>
    try {
      sessions = await waha.getSessions()
    } catch (err) {
      console.error('[health-check] Failed to fetch WAHA sessions:', err)
      await sendTelegramAlert(
        '🔴 Health Check: Failed to connect to WAHA server!'
      )
      return NextResponse.json(
        { error: 'Failed to connect to WAHA' },
        { status: 502 }
      )
    }

    // 2. Get all phone numbers from DB that have a session
    const { data: phones, error: dbError } = await supabase
      .from('phone_numbers')
      .select('id, session_id, status, business_id, phone_number')
      .not('session_id', 'is', null)

    if (dbError) {
      console.error('[health-check] DB error:', dbError)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    const results: Array<{
      session: string
      phone: string | null
      previousStatus: string
      currentStatus: string
      changed: boolean
    }> = []

    // 3. Compare and update
    for (const phone of phones || []) {
      const wahaSession = sessions.find(
        (s) => s.name === phone.session_id
      )
      const wahaStatus =
        wahaSession?.status === 'WORKING' ? 'connected' : 'disconnected'

      const changed = phone.status !== wahaStatus

      if (changed) {
        // Update status in DB
        const { error: updateError } = await supabase
          .from('phone_numbers')
          .update({
            status: wahaStatus,
            last_health_check: new Date().toISOString(),
          })
          .eq('id', phone.id)

        if (updateError) {
          console.error(
            `[health-check] Failed to update ${phone.session_id}:`,
            updateError
          )
        }

        // Send alert if newly disconnected
        if (wahaStatus === 'disconnected') {
          await sendTelegramAlert(
            `⚠️ מספר מנותק: ${phone.phone_number || phone.session_id} (Business: ${phone.business_id})`
          )
        }

        // Send recovery notice
        if (
          wahaStatus === 'connected' &&
          phone.status === 'disconnected'
        ) {
          await sendTelegramAlert(
            `✅ מספר חזר לפעולה: ${phone.phone_number || phone.session_id} (Business: ${phone.business_id})`
          )
        }
      }
      // If status hasn't changed, skip the DB update entirely to reduce writes

      results.push({
        session: phone.session_id!,
        phone: phone.phone_number,
        previousStatus: phone.status,
        currentStatus: wahaStatus,
        changed,
      })
    }

    // 4. Check for orphaned WAHA sessions (in WAHA but not in DB)
    const dbSessionIds = new Set(
      (phones || []).map((p) => p.session_id)
    )
    const orphanedSessions = sessions.filter(
      (s) => !dbSessionIds.has(s.name)
    )

    if (orphanedSessions.length > 0) {
      console.warn(
        '[health-check] Orphaned WAHA sessions:',
        orphanedSessions.map((s) => s.name)
      )
    }

    return NextResponse.json({
      results,
      orphanedSessions: orphanedSessions.map((s) => ({
        name: s.name,
        status: s.status,
      })),
      totalPhones: (phones || []).length,
      totalWahaSessions: sessions.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[health-check] Unhandled error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ── Telegram Alert Helper ───────────────────────────────

async function sendTelegramAlert(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.warn(
      '[health-check] Telegram not configured, skipping alert:',
      message
    )
    return
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    if (!res.ok) {
      const errorBody = await res.text()
      console.error('[health-check] Telegram API error:', errorBody)
    }
  } catch (err) {
    console.error('[health-check] Failed to send Telegram alert:', err)
  }
}
