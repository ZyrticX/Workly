import { createServiceClient } from '@/lib/supabase/service'
import { AdminStatCard } from '@/components/admin/admin-stat-card'

// ── Helpers ────────────────────────────────────
function getStartOfMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

// ── Data fetching ──────────────────────────────
async function getAdminDashboardData() {
  const supabase = createServiceClient()
  const startOfMonth = getStartOfMonth()

  const [
    businessesRes,
    phonesRes,
    messagesRes,
    revenueRes,
    recentSignupsRes,
    disconnectedRes,
  ] = await Promise.all([
    // Total businesses + active count
    supabase.from('businesses').select('id, status'),

    // Phone numbers with status
    supabase.from('phone_numbers').select('id, status'),

    // Messages this month
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),

    // Revenue this month from billing
    supabase
      .from('platform_payments')
      .select('amount')
      .gte('created_at', startOfMonth)
      .eq('status', 'completed'),

    // Recent signups (last 5)
    supabase
      .from('businesses')
      .select('id, name, business_type, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // Disconnected phones
    supabase
      .from('phone_numbers')
      .select('id, phone_number, business_id, last_health_check, session_id')
      .eq('status', 'disconnected'),
  ])

  const businesses = businessesRes.data ?? []
  const phones = phonesRes.data ?? []
  const totalBusinesses = businesses.length
  const activeBusinesses = businesses.filter((b) => b.status === 'active').length
  const totalPhones = phones.length
  const connectedPhones = phones.filter((p) => p.status === 'connected').length
  const disconnectedPhones = phones.filter((p) => p.status === 'disconnected').length
  const totalMessages = messagesRes.count ?? 0
  const monthRevenue = (revenueRes.data ?? []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  )

  return {
    totalBusinesses,
    activeBusinesses,
    totalPhones,
    connectedPhones,
    disconnectedPhones,
    totalMessages,
    monthRevenue,
    recentSignups: recentSignupsRes.data ?? [],
    disconnectedList: disconnectedRes.data ?? [],
  }
}

// ── Page ───────────────────────────────────────
export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData()

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold text-text">סקירה כללית</h2>
        <p className="text-sm text-text-muted mt-1">
          מבט על מצב הפלטפורמה
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminStatCard
          label="עסקים"
          value={data.totalBusinesses}
          sublabel={`${data.activeBusinesses} פעילים`}
          color="primary"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
        <AdminStatCard
          label="מספרי טלפון"
          value={data.totalPhones}
          sublabel={`${data.connectedPhones} מחוברים`}
          color="info"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
        <AdminStatCard
          label="מנותקים"
          value={data.disconnectedPhones}
          sublabel="מספרים לא פעילים"
          color="danger"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <AdminStatCard
          label="הודעות החודש"
          value={data.totalMessages.toLocaleString('he-IL')}
          sublabel="סה״כ הודעות"
          color="primary"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        />
        <AdminStatCard
          label="הכנסות החודש"
          value={`₪${data.monthRevenue.toLocaleString('he-IL')}`}
          sublabel="מחיובים"
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <AdminStatCard
          label="מנותקים"
          value={data.disconnectedList.length}
          sublabel="דורשים טיפול"
          color="warning"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-text mb-4">
            הרשמות אחרונות
          </h3>
          {data.recentSignups.length === 0 ? (
            <p className="text-sm text-text-muted">אין הרשמות אחרונות</p>
          ) : (
            <div className="space-y-3">
              {data.recentSignups.map((biz) => (
                <div
                  key={biz.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{biz.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {biz.business_type || 'לא צוין'} &middot; {biz.plan}
                    </p>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {new Date(biz.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disconnected Phones Alert */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <h3 className="text-sm font-semibold text-text">
              התראות מנותקים
            </h3>
          </div>
          {data.disconnectedList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-text-muted">כל המספרים מחוברים</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.disconnectedList.map((phone) => (
                <div
                  key={phone.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-danger-bg/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-danger" />
                    <div>
                      <p className="text-sm font-mono font-medium text-text">
                        {phone.phone_number}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {phone.session_id || 'ללא session'}
                        {phone.last_health_check &&
                          ` · בדיקה: ${new Date(phone.last_health_check).toLocaleString('he-IL')}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-danger px-2 py-0.5 rounded-md bg-danger-bg">
                    מנותק
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
