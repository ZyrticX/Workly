import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface AppointmentWithContact {
  id: string
  business_id: string
  contact_id: string
  service_type: string
  start_time: string
  end_time: string
  duration_minutes: number
  status: string
  reminder_sent: boolean
  confirmed_by_client: boolean
  price: number | null
  notes: string | null
  created_at: string
  contacts: {
    name: string
    phone: string
  } | null
}

export interface DashboardData {
  todayAppointments: AppointmentWithContact[]
  monthRevenue: number
  newContactsCount: number
  cancellationRate: string
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getStartOfWeek(): string {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday
  const diff = now.getDate() - day
  const start = new Date(now.getFullYear(), now.getMonth(), diff)
  return start.toISOString()
}

function getStartOfMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Resolve current user's business
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { data: businessUser, error: buError } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (buError || !businessUser) {
    throw new Error('Business not found for current user')
  }

  const businessId = businessUser.business_id
  const today = new Date().toISOString().split('T')[0]

  // Parallel queries — all scoped by business_id + RLS
  const [appointments, monthRevenue, newContacts, cancellations] =
    await Promise.all([
      // 1. Today's upcoming appointments (exclude cancelled + past)
      supabase
        .from('appointments')
        .select('*, contacts(name, phone)')
        .eq('business_id', businessId)
        .in('status', ['confirmed', 'pending'])
        .gte('start_time', new Date().toISOString())
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time'),

      // 2. Monthly revenue (completed appointments)
      supabase
        .from('appointments')
        .select('price')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('start_time', getStartOfMonth()),

      // 3. New contacts this week
      supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .eq('business_id', businessId)
        .gte('created_at', getStartOfWeek()),

      // 4. Cancellation rate this month (all statuses)
      supabase
        .from('appointments')
        .select('status')
        .eq('business_id', businessId)
        .gte('start_time', getStartOfMonth()),
    ])

  // Compute revenue
  const revenue =
    monthRevenue.data?.reduce((sum, a) => sum + (Number(a.price) || 0), 0) ?? 0

  // Compute cancellation rate
  const totalApts = cancellations.data?.length ?? 0
  const cancelledApts =
    cancellations.data?.filter((a) => a.status === 'cancelled').length ?? 0
  const cancellationRate =
    totalApts > 0 ? ((cancelledApts / totalApts) * 100).toFixed(1) : '0'

  return {
    todayAppointments:
      (appointments.data as AppointmentWithContact[]) ?? [],
    monthRevenue: revenue,
    newContactsCount: newContacts.count ?? 0,
    cancellationRate,
  }
}
