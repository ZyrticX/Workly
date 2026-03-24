import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/stat-card'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { StatusBadge } from '@/components/ui/status-badge'
import { Calendar, DollarSign, UserPlus, XCircle, Settings, MessageCircle } from 'lucide-react'
import Link from 'next/link'

/* ─── Data fetching ─── */
async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!bu) return null

  const businessId = bu.business_id
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [businessRes, todayAptsRes, monthRevenueRes, newContactsRes, cancelledRes, totalAptsRes, waSessionRes] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', businessId).single(),
    supabase
      .from('appointments')
      .select('id, start_time, service_type, status, contacts(name)')
      .eq('business_id', businessId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', new Date().toISOString())
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time', { ascending: true }),
    supabase
      .from('appointments')
      .select('price')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('start_time', startOfMonth),
    supabase
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('created_at', startOfWeek),
    supabase
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('status', 'cancelled')
      .gte('start_time', startOfMonth),
    supabase
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('start_time', startOfMonth),
    supabase
      .from('phone_numbers')
      .select('status')
      .eq('business_id', businessId)
      .single(),
  ])

  const businessName = businessRes.data?.name || 'העסק שלי'
  const todayAppointments = todayAptsRes.data || []
  const monthRevenue = (monthRevenueRes.data || []).reduce((sum, a) => sum + (a.price || 0), 0)
  const newContactsCount = newContactsRes.count || 0
  const cancelledCount = cancelledRes.count || 0
  const totalAptsCount = totalAptsRes.count || 0
  const cancellationRate = totalAptsCount > 0 ? ((cancelledCount / totalAptsCount) * 100) : 0
  const whatsappConnected = waSessionRes.data?.status === 'connected'

  return {
    businessName,
    whatsappConnected,
    stats: {
      todayAppointments: todayAppointments.length,
      monthRevenue,
      newContacts: newContactsCount,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
    },
    upcomingAppointments: todayAppointments.map((apt: any) => ({
      id: apt.id,
      time: (() => { const d = new Date(apt.start_time); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })(),
      contactName: apt.contacts?.name || 'לא ידוע',
      service: apt.service_type || '',
      status: apt.status as 'confirmed' | 'pending' | 'cancelled',
    })),
  }
}

/* ─── Greeting ─── */
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'בוקר טוב'
  if (hour < 17) return 'צהריים טובים'
  return 'ערב טוב'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

/* ─── Page ─── */
export default async function DashboardPage() {
  const data = await getDashboardData()

  if (!data) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-20 h-20 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-ios">
          <Calendar className="w-10 h-10 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
          {getGreeting()}!
        </h1>
        <p className="text-[var(--color-text-secondary)] max-w-sm mx-auto mb-8 leading-relaxed">
          ברוכים הבאים! הנה הדאשבורד שלך. התחל בחיבור WhatsApp מההגדרות.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-ios press-effect shadow-ios"
        >
          <Settings className="w-5 h-5" />
          עבור להגדרות
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-full space-y-6">
      {/* Greeting + WhatsApp Status */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {getGreeting()}, {data.businessName}
        </h1>
        <Link
          href="/settings"
          aria-label={data.whatsappConnected ? 'WhatsApp מחובר' : 'WhatsApp לא מחובר - לחץ לחיבור'}
          className={`flex items-center gap-2 rounded-xl glass-card shadow-ios px-3.5 py-2.5 transition-ios hover:shadow-ios-lg press-effect ${
            !data.whatsappConnected ? 'ring-1 ring-[var(--color-danger)]/30' : ''
          }`}
        >
          <MessageCircle className={`w-4 h-4 ${data.whatsappConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`} />
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">WhatsApp</span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              data.whatsappConnected
                ? 'bg-green-500 status-connected'
                : 'bg-[var(--color-danger)]'
            }`}
            aria-hidden="true"
          />
          <span className={`text-[10px] font-medium ${data.whatsappConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {data.whatsappConnected ? 'מחובר' : 'מנותק'}
          </span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="תורים היום"
          value={data.stats.todayAppointments}
          icon={<Calendar className="w-5 h-5" />}
        />
        <StatCard
          label="הכנסה החודש"
          value={formatCurrency(data.stats.monthRevenue)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="לקוחות חדשים"
          value={data.stats.newContacts}
          icon={<UserPlus className="w-5 h-5" />}
        />
        <StatCard
          label="ביטולים"
          value={`${data.stats.cancellationRate}%`}
          icon={<XCircle className="w-5 h-5" />}
        />
      </div>

      {/* Upcoming Appointments */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">תורים קרובים</h2>
        {data.upcomingAppointments.length === 0 ? (
          <div className="glass-card shadow-ios rounded-2xl p-10 text-center">
            <div className="w-16 h-16 bg-[var(--color-primary)]/8 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-[var(--color-primary)] opacity-60" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">אין תורים להיום</p>
            <p className="text-xs text-[var(--color-text-muted)]">היומן פנוי - זמן מצוין להזמין לקוחות חדשים</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                className="glass-card shadow-ios rounded-2xl p-4 flex items-center gap-3 transition-ios hover:shadow-ios-lg"
              >
                <div className="text-sm font-bold text-[var(--color-primary-dark)] min-w-[50px]">
                  {apt.time}
                </div>
                <AvatarInitials name={apt.contactName} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2E24] truncate">{apt.contactName}</p>
                  <p className="text-xs text-[#8FA89A] truncate">{apt.service}</p>
                </div>
                <StatusBadge
                  variant={apt.status === 'confirmed' ? 'success' : apt.status === 'cancelled' ? 'danger' : 'warning'}
                >
                  {apt.status === 'confirmed' ? 'מאושר' : apt.status === 'cancelled' ? 'בוטל' : 'ממתין'}
                </StatusBadge>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/calendar"
          className="block text-center text-xs text-[var(--color-primary-dark)] font-medium mt-3 py-2 hover:underline"
        >
          היסטוריית תורים →
        </Link>
      </div>
    </div>
  )
}
