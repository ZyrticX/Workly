import { createServiceClient } from '@/lib/supabase/service'
import { HealthClient } from './health-client'

async function getHealthData() {
  const supabase = createServiceClient()

  const [sessionsRes, alertsRes] = await Promise.all([
    // Active phone sessions for health display
    supabase
      .from('phone_numbers')
      .select('id, phone_number, display_name, session_id, status, server_node, last_health_check')
      .not('session_id', 'is', null)
      .order('last_health_check', { ascending: false }),

    // Recent health alerts from webhook logs
    supabase
      .from('webhook_logs')
      .select('id, event_type, payload, created_at')
      .eq('event_type', 'health_alert')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    sessions: (sessionsRes.data ?? []).map((s) => ({
      id: s.id,
      phone_number: s.phone_number,
      display_name: s.display_name,
      session_id: s.session_id,
      status: s.status,
      server_node: s.server_node,
      last_health_check: s.last_health_check,
    })),
    alerts: (alertsRes.data ?? []).map((a) => ({
      id: a.id,
      event_type: a.event_type,
      payload: a.payload,
      created_at: a.created_at,
    })),
  }
}

export default async function HealthPage() {
  const { sessions, alerts } = await getHealthData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">מוניטור בריאות</h2>
        <p className="text-sm text-text-muted mt-1">
          מעקב בזמן אמת אחר סשנים ומספרי טלפון
        </p>
      </div>

      <HealthClient sessions={sessions} alerts={alerts} />
    </div>
  )
}
