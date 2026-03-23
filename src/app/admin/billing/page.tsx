import { createServiceClient } from '@/lib/supabase/service'
import { AdminStatCard } from '@/components/admin/admin-stat-card'

// ── Data fetching ──────────────────────────────
async function getBillingData() {
  const supabase = createServiceClient()

  const [accountsRes, paymentsRes] = await Promise.all([
    // Billing accounts with business name
    supabase
      .from('billing_accounts')
      .select(`
        id,
        business_id,
        plan,
        monthly_price,
        next_billing_date,
        status,
        created_at,
        businesses (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false }),

    // Recent payments
    supabase
      .from('platform_payments')
      .select(`
        id,
        billing_account_id,
        amount,
        status,
        payment_method,
        created_at,
        billing_accounts (
          business_id,
          businesses (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const accounts = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    business_id: a.business_id,
    business_name: (a.businesses as any)?.name ?? 'לא ידוע',
    plan: a.plan,
    monthly_price: Number(a.monthly_price) || 0,
    next_billing_date: a.next_billing_date,
    status: a.status,
    created_at: a.created_at,
  }))

  const payments = (paymentsRes.data ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount) || 0,
    status: p.status,
    payment_method: p.payment_method,
    created_at: p.created_at,
    business_name:
      (p.billing_accounts as any)?.businesses?.name ?? 'לא ידוע',
  }))

  // Compute MRR
  const activeAccounts = accounts.filter((a) => a.status === 'active')
  const totalMRR = activeAccounts.reduce((sum, a) => sum + a.monthly_price, 0)

  // Plan breakdown
  const planBreakdown: Record<string, { count: number; revenue: number }> = {}
  for (const acc of activeAccounts) {
    if (!planBreakdown[acc.plan]) {
      planBreakdown[acc.plan] = { count: 0, revenue: 0 }
    }
    planBreakdown[acc.plan].count++
    planBreakdown[acc.plan].revenue += acc.monthly_price
  }

  // Overdue
  const now = new Date().toISOString()
  const overdue = accounts.filter(
    (a) => a.status === 'overdue' || (a.next_billing_date && a.next_billing_date < now && a.status !== 'cancelled')
  )

  return {
    accounts,
    payments,
    totalMRR,
    planBreakdown,
    overdue,
    activeCount: activeAccounts.length,
  }
}

// ── Helpers ────────────────────────────────────
const planLabels: Record<string, string> = {
  trial: 'ניסיון',
  basic: 'בסיסי',
  pro: 'מקצועי',
  premium: 'פרימיום',
}

const planColors: Record<string, string> = {
  trial: 'bg-warning-bg text-warning',
  basic: 'bg-neutral-bg text-neutral',
  pro: 'bg-info-bg text-info',
  premium: 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]',
}

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  overdue: 'באיחור',
  cancelled: 'מבוטל',
  pending: 'ממתין',
  completed: 'הושלם',
  failed: 'נכשל',
}

const statusColors: Record<string, string> = {
  active: 'bg-success-bg text-success',
  overdue: 'bg-danger-bg text-danger',
  cancelled: 'bg-neutral-bg text-neutral',
  pending: 'bg-warning-bg text-warning',
  completed: 'bg-success-bg text-success',
  failed: 'bg-danger-bg text-danger',
}

// ── Page ───────────────────────────────────────
export default async function BillingPage() {
  const data = await getBillingData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">חיובים</h2>
        <p className="text-sm text-text-muted mt-1">
          סקירת חיובים והכנסות
        </p>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminStatCard
          label="MRR (הכנסה חודשית חוזרת)"
          value={`₪${data.totalMRR.toLocaleString('he-IL')}`}
          sublabel={`${data.activeCount} מנויים פעילים`}
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <AdminStatCard
          label="חיובים באיחור"
          value={data.overdue.length}
          sublabel="דורשים טיפול"
          color="danger"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <AdminStatCard
          label="סה״כ חשבונות"
          value={data.accounts.length}
          color="info"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>

      {/* Plan Breakdown */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-text mb-4">פירוט לפי תוכנית</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.planBreakdown).map(([plan, info]) => (
            <div key={plan} className="bg-surface rounded-xl p-4">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  planColors[plan] || 'bg-neutral-bg text-neutral'
                }`}
              >
                {planLabels[plan] || plan}
              </span>
              <p className="text-lg font-bold text-text mt-2">
                ₪{info.revenue.toLocaleString('he-IL')}
              </p>
              <p className="text-[11px] text-text-muted">
                {info.count} {info.count === 1 ? 'מנוי' : 'מנויים'}
              </p>
            </div>
          ))}
          {Object.keys(data.planBreakdown).length === 0 && (
            <p className="col-span-full text-sm text-text-muted text-center py-4">
              אין נתונים להצגה
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing Accounts Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text">
              חשבונות חיוב ({data.accounts.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-surface/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-2.5 font-semibold text-text-muted text-xs">
                    עסק
                  </th>
                  <th className="text-start px-4 py-2.5 font-semibold text-text-muted text-xs">
                    תוכנית
                  </th>
                  <th className="text-start px-4 py-2.5 font-semibold text-text-muted text-xs">
                    מחיר
                  </th>
                  <th className="text-start px-4 py-2.5 font-semibold text-text-muted text-xs">
                    חיוב הבא
                  </th>
                  <th className="text-start px-4 py-2.5 font-semibold text-text-muted text-xs">
                    סטטוס
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-text-muted">
                      אין חשבונות חיוב
                    </td>
                  </tr>
                ) : (
                  data.accounts.map((acc) => (
                    <tr key={acc.id} className="border-b border-border/50 hover:bg-surface/30">
                      <td className="px-4 py-2.5 font-medium text-text text-xs">
                        {acc.business_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                            planColors[acc.plan] || 'bg-neutral-bg text-neutral'
                          }`}
                        >
                          {planLabels[acc.plan] || acc.plan}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">
                        ₪{acc.monthly_price}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-muted">
                        {acc.next_billing_date
                          ? new Date(acc.next_billing_date).toLocaleDateString('he-IL')
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                            statusColors[acc.status] || 'bg-neutral-bg text-neutral'
                          }`}
                        >
                          {statusLabels[acc.status] || acc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table></div>
          </div>
        </div>

        {/* Overdue Payments */}
        <div className="space-y-6">
          {/* Overdue List */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <h3 className="text-sm font-semibold text-text">
                חיובים באיחור ({data.overdue.length})
              </h3>
            </div>
            {data.overdue.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs text-text-muted">אין חיובים באיחור</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.overdue.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-danger-bg/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">{acc.business_name}</p>
                      <p className="text-[11px] text-text-muted">
                        ₪{acc.monthly_price} / חודש &middot; {planLabels[acc.plan] || acc.plan}
                      </p>
                    </div>
                    <span className="text-[11px] text-danger font-medium">
                      {acc.next_billing_date
                        ? new Date(acc.next_billing_date).toLocaleDateString('he-IL')
                        : 'לא ידוע'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-semibold text-text mb-4">
              תשלומים אחרונים
            </h3>
            {data.payments.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">
                אין תשלומים אחרונים
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {data.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">
                        {payment.business_name}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {payment.payment_method || 'לא צוין'}
                        {' · '}
                        {new Date(payment.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-bold text-text">
                        ₪{payment.amount.toLocaleString('he-IL')}
                      </p>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          statusColors[payment.status] || 'bg-neutral-bg text-neutral'
                        }`}
                      >
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
