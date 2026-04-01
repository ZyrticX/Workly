import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/stat-card'
import { AvatarInitials } from '@/components/ui/avatar-initials'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Calendar,
  DollarSign,
  UserPlus,
  XCircle,
  Settings,
  MessageCircle,
  Bell,
  AlertTriangle,
  ArrowRightLeft,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

/* ─── Helpers ─── */

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const

function hebrewDayName(dateStr: string): string {
  // Parse date parts directly from the ISO string to avoid timezone shifts
  // dateStr is a naive timestamp like "2026-03-26T06:30:00" (Israel local time)
  const [datePart] = dateStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return `יום ${HEBREW_DAYS[d.getDay()]}`
}

function formatShortDate(dateStr: string): string {
  // Parse date parts directly from the ISO string to avoid timezone shifts
  const [datePart] = dateStr.split('T')
  const [, month, day] = datePart.split('-').map(Number)
  return `${day}/${month}`
}

/** Returns true if the name looks like a raw phone number (e.g. "972533555148") */
function looksLikePhoneNumber(name: string): boolean {
  return /^\d{7,15}$/.test(name) || /^972\d+$/.test(name)
}

/** Display name for a contact — shows formatted phone or fallback if name is a raw number */
function displayContactName(name: string): string {
  if (!name || name === 'לא ידוע') return 'לקוח ללא שם'
  if (looksLikePhoneNumber(name)) {
    // Format 972XXXXXXXXX as 0XX-XXX-XXXX
    if (name.startsWith('972') && name.length >= 12) {
      const local = '0' + name.slice(3)
      return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
    }
    return name
  }
  return name
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'עכשיו'
  if (diffMin < 60) return `לפני ${diffMin} דק׳`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `לפני ${diffHr} שע׳`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return 'אתמול'
  return `לפני ${diffDays} ימים`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'בוקר טוב'
  if (hour < 17) return 'צהריים טובים'
  return 'ערב טוב'
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

/* ─── Notification type config ─── */

const notificationConfig: Record<string, { icon: typeof Bell; colorClass: string }> = {
  new_appointment: { icon: Calendar, colorClass: 'text-green-600 bg-green-50' },
  cancelled_appointment: { icon: XCircle, colorClass: 'text-red-500 bg-red-50' },
  rescheduled_appointment: { icon: ArrowRightLeft, colorClass: 'text-amber-500 bg-amber-50' },
  new_contact: { icon: UserPlus, colorClass: 'text-blue-500 bg-blue-50' },
  escalation: { icon: AlertTriangle, colorClass: 'text-orange-500 bg-orange-50' },
  waitlist: { icon: Clock, colorClass: 'text-purple-500 bg-purple-50' },
  system: { icon: Bell, colorClass: 'text-gray-500 bg-gray-50' },
}

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

  // Auto-complete past appointments (lightweight, runs on every dashboard load)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auto-crm.org'
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      fetch(`${appUrl}/api/cron/auto-complete`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch(() => {})
    }
  } catch { /* fire and forget */ }

  const now = new Date()
  // Use naive date strings (no Z suffix) to match DB naive timestamps (Israel local time)
  const today = now.toISOString().split('T')[0]
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of current month
  const endOfMonthStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}T23:59:59`
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00'

  // Calculate end of week (7 days from today)
  const endOfWeekDate = new Date(now)
  endOfWeekDate.setDate(endOfWeekDate.getDate() + 7)
  const endOfWeek = endOfWeekDate.toISOString().split('T')[0]

  const [
    businessRes,
    todayAptsRes,
    monthRevenueRes,
    newContactsRes,
    cancelledRes,
    totalAptsRes,
    waSessionRes,
    weekAptsRes,
    notificationsRes,
    todayCancelledRes,
  ] = await Promise.all([
    supabase.from('businesses').select('name').eq('id', businessId).single(),
    supabase
      .from('appointments')
      .select('id, start_time, service_type, status, contacts(name)')
      .eq('business_id', businessId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time', { ascending: true }),
    supabase
      .from('appointments')
      .select('price')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('start_time', startOfMonth)
      .lte('start_time', endOfMonthStr),
    supabase
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('created_at', startOfWeek),
    // Cancelled appointments this month only
    supabase
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('status', 'cancelled')
      .gte('start_time', startOfMonth)
      .lte('start_time', endOfMonthStr),
    // Total appointments this month (all statuses) for cancellation rate
    supabase
      .from('appointments')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('start_time', startOfMonth)
      .lte('start_time', endOfMonthStr),
    supabase
      .from('phone_numbers')
      .select('status')
      .eq('business_id', businessId)
      .single(),
    // Week appointments: all confirmed/pending from today through end of week
    supabase
      .from('appointments')
      .select('id, start_time, service_type, status, contacts(name)', { count: 'exact' })
      .eq('business_id', businessId)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${endOfWeek}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(5),
    // Recent notifications
    supabase
      .from('notifications')
      .select('id, type, title, body, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(10),
    // Today's cancellations with contact names
    supabase
      .from('appointments')
      .select('id, contacts(name)')
      .eq('business_id', businessId)
      .eq('status', 'cancelled')
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`),
  ])

  const businessName = businessRes.data?.name || 'העסק שלי'
  const todayAppointments = todayAptsRes.data || []
  const monthRevenue = (monthRevenueRes.data || []).reduce((sum, a) => sum + (a.price || 0), 0)
  const newContactsCount = newContactsRes.count || 0
  const cancelledCount = cancelledRes.count || 0
  const totalAptsCount = totalAptsRes.count || 0
  const cancellationRate = totalAptsCount > 0 ? ((cancelledCount / totalAptsCount) * 100) : 0
  const whatsappConnected = waSessionRes.data?.status === 'connected'

  // Week appointments
  const weekAppointments = (weekAptsRes.data || []).map((apt) => ({
    id: apt.id,
    startTime: apt.start_time as string,
    time: (apt.start_time as string).substring(11, 16),
    contactName: displayContactName((apt.contacts as unknown as { name: string } | null)?.name || ''),
    service: apt.service_type || '',
    status: apt.status as 'confirmed' | 'pending',
  }))
  const weekAptsTotal = weekAptsRes.count || 0

  // Notifications
  const recentNotifications = (notificationsRes.data || []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    body: n.body as string | null,
    createdAt: n.created_at as string,
  }))

  // Today's cancellations
  const todayCancellations = (todayCancelledRes.data || []).map((apt) => ({
    id: apt.id as string,
    contactName: displayContactName((apt.contacts as unknown as { name: string } | null)?.name || ''),
  }))

  return {
    businessName,
    whatsappConnected,
    stats: {
      todayAppointments: todayAppointments.length,
      monthRevenue,
      newContacts: newContactsCount,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
    },
    upcomingAppointments: todayAppointments.map((apt) => ({
      id: apt.id,
      time: (apt.start_time as string).substring(11, 16),
      contactName: displayContactName((apt.contacts as unknown as { name: string } | null)?.name || ''),
      service: apt.service_type || '',
      status: apt.status as 'confirmed' | 'pending' | 'cancelled',
    })),
    weekAppointments,
    weekAptsTotal,
    recentNotifications,
    todayCancellations,
  }
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
    <div className="min-h-full space-y-6 overflow-x-hidden">
      {/* Greeting + WhatsApp Status */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {getGreeting()}, {data.businessName}
        </h1>

        {/* §4 — WhatsApp Connection Status (prominent) */}
        <Link
          href="/settings"
          aria-label={data.whatsappConnected ? 'WhatsApp מחובר' : 'WhatsApp לא מחובר - לחץ לחיבור'}
          className={`flex items-center gap-2 rounded-xl glass-card shadow-ios px-3.5 py-2.5 transition-ios hover:shadow-ios-lg press-effect ${
            !data.whatsappConnected ? 'ring-1 ring-[var(--color-danger)]/30' : ''
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              data.whatsappConnected
                ? 'bg-green-500 status-connected'
                : 'bg-[var(--color-danger)] animate-pulse'
            }`}
            aria-hidden="true"
          />
          <MessageCircle className={`w-4 h-4 ${data.whatsappConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`} />
          <span className={`text-xs font-semibold ${data.whatsappConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {data.whatsappConnected ? 'WhatsApp מחובר' : 'WhatsApp מנותק — לחץ לחבר'}
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

      {/* §3 — Cancellations Today Warning */}
      {data.todayCancellations.length > 0 && (
        <div className="glass-card shadow-ios rounded-2xl p-4 flex items-start gap-3 ring-1 ring-red-200/50 bg-red-50/30">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-500">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-600">
              {data.todayCancellations.length} ביטולים היום
            </p>
            <p className="text-xs text-red-500/80 mt-0.5 truncate">
              {data.todayCancellations.map(c => c.contactName).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Appointments Today */}
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
          היסטוריית תורים &larr;
        </Link>
      </div>

      {/* Removed: "השבוע" and "פעילות אחרונה" sections — clean dashboard */}
    </div>
  )
}
