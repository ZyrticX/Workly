import { createServiceClient } from '@/lib/supabase/service'
import { LogsClient } from './logs-client'

async function getLogsData() {
  const supabase = createServiceClient()

  const [webhookRes, auditRes, aiRes, errorRes] = await Promise.all([
    // Webhook logs
    supabase
      .from('webhook_logs')
      .select('id, event_type, business_id, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // Audit log
    supabase
      .from('audit_log')
      .select('id, user_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // AI conversation logs
    supabase
      .from('ai_conversation_logs')
      .select('id, business_id, intent, confidence, escalated, response, user_message, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // Error logs
    supabase
      .from('error_logs')
      .select('id, business_id, source, severity, message, details, contact_name, resolved, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Try to resolve user emails for audit log entries
  let userEmailMap: Record<string, string> = {}
  const userIds = [
    ...new Set(
      (auditRes.data ?? [])
        .map((a) => a.user_id)
        .filter(Boolean)
    ),
  ]

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)

    if (profiles) {
      userEmailMap = Object.fromEntries(
        profiles.map((p: any) => [p.id, p.email])
      )
    }
  }

  return {
    webhookLogs: (webhookRes.data ?? []).map((w) => ({
      id: w.id,
      event_type: w.event_type,
      business_id: w.business_id,
      payload: w.payload,
      created_at: w.created_at,
    })),
    auditLogs: (auditRes.data ?? []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      user_email: userEmailMap[a.user_id] ?? null,
      action: a.action,
      details: a.details,
      created_at: a.created_at,
    })),
    aiLogs: (aiRes.data ?? []).map((ai) => ({
      id: ai.id,
      business_id: ai.business_id,
      intent: ai.intent,
      confidence: ai.confidence,
      escalated: ai.escalated,
      response: ai.response,
      user_message: ai.user_message,
      created_at: ai.created_at,
    })),
    errorLogs: (errorRes.data ?? []).map((e) => ({
      id: e.id,
      business_id: e.business_id,
      source: e.source,
      severity: e.severity,
      message: e.message,
      details: e.details,
      contact_name: e.contact_name,
      resolved: e.resolved,
      created_at: e.created_at,
    })),
  }
}

export default async function LogsPage() {
  const { webhookLogs, auditLogs, aiLogs, errorLogs } = await getLogsData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">לוגים</h2>
        <p className="text-sm text-text-muted mt-1">
          מעקב אחרי Webhooks, פעולות משתמשים ושיחות AI
        </p>
      </div>

      <LogsClient
        webhookLogs={webhookLogs}
        auditLogs={auditLogs}
        aiLogs={aiLogs}
        errorLogs={errorLogs}
      />
    </div>
  )
}
