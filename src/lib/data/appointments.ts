import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface AppointmentWithContact {
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
    status: string
  } | null
}

interface WorkingDay {
  active: boolean
  start?: string
  end?: string
  breaks?: { start: string; end: string }[]
}

interface ServiceDefinition {
  name: string
  type?: string
  duration: number
  price: number
}

// ──────────────────────────────────────────────
// Time helpers
// ──────────────────────────────────────────────

/**
 * Parse a "HH:MM" string into total minutes since midnight.
 */
export function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Format total minutes since midnight into "HH:MM".
 */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

/**
 * Get all appointments for a specific date, joined with contact info.
 */
export async function getAppointmentsByDate(
  date: string
): Promise<AppointmentWithContact[]> {
  const supabase = await createClient()

  // Resolve business_id from authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
      *,
      contacts ( name, phone, status )
    `
    )
    .eq('business_id', businessUser.business_id)
    .gte('start_time', `${date}T00:00:00`)
    .lte('start_time', `${date}T23:59:59`)
    .order('start_time')

  if (error) {
    throw new Error(`Failed to fetch appointments: ${error.message}`)
  }

  return (data as AppointmentWithContact[]) ?? []
}

/**
 * Calculate available time slots for a given date and service type.
 * Loads business working hours + existing appointments, then returns
 * free 15-minute-interval start times.
 */
export async function getAvailableSlots(
  date: string,
  serviceType: string
): Promise<string[]> {
  const supabase = await createClient()

  // Resolve business
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  const businessId = businessUser.business_id

  // Parallel: settings + existing appointments
  const [settingsResult, existingResult] = await Promise.all([
    supabase
      .from('business_settings')
      .select('working_hours, services')
      .eq('business_id', businessId)
      .single(),

    supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('business_id', businessId)
      .neq('status', 'cancelled')
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`),
  ])

  if (!settingsResult.data) {
    throw new Error('Business settings not found')
  }

  const settings = settingsResult.data
  const existing = existingResult.data ?? []

  // Find service duration
  const services = settings.services as ServiceDefinition[]
  const service = services.find(
    (s) => s.type === serviceType || s.name === serviceType
  )
  const duration = service?.duration ?? 30

  // Determine working hours for this day of week
  const dayOfWeek = new Date(date).getDay()
  const workingHours = settings.working_hours as Record<string, WorkingDay>
  const dayConfig = workingHours[String(dayOfWeek)]

  if (!dayConfig || !dayConfig.active || !dayConfig.start || !dayConfig.end) {
    return [] // Business closed on this day
  }

  // Build break intervals (in minutes) for quick overlap checks
  const breaks = (dayConfig.breaks ?? []).map((b) => ({
    start: parseTime(b.start),
    end: parseTime(b.end),
  }))

  // Generate 15-minute interval slots
  const slots: string[] = []
  let current = parseTime(dayConfig.start)
  const endOfDay = parseTime(dayConfig.end)

  while (current + duration <= endOfDay) {
    const slotStartMinutes = current
    const slotEndMinutes = current + duration
    const timeStr = formatTime(current)
    const slotStartISO = `${date}T${timeStr}:00`
    const slotEndISO = `${date}T${formatTime(slotEndMinutes)}:00`

    // Check if slot overlaps a break
    const overlapBreak = breaks.some(
      (b) => slotStartMinutes < b.end && slotEndMinutes > b.start
    )

    // Check if slot overlaps an existing appointment
    const overlapAppointment = existing.some(
      (apt) => apt.start_time < slotEndISO && apt.end_time > slotStartISO
    )

    if (!overlapBreak && !overlapAppointment) {
      slots.push(timeStr)
    }

    current += duration // intervals match service duration
  }

  return slots
}

/**
 * Get appointments for a calendar week (7 days starting from startDate).
 */
export async function getWeekAppointments(
  startDate: string
): Promise<AppointmentWithContact[]> {
  const supabase = await createClient()

  // Resolve business_id from authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
      *,
      contacts ( name, phone, status )
    `
    )
    .eq('business_id', businessUser.business_id)
    .gte('start_time', start.toISOString())
    .lt('start_time', end.toISOString())
    .order('start_time')

  if (error) {
    throw new Error(`Failed to fetch week appointments: ${error.message}`)
  }

  return (data as AppointmentWithContact[]) ?? []
}

/**
 * Get appointments for an entire calendar month.
 */
export async function getMonthAppointments(
  year: number,
  month: number
): Promise<AppointmentWithContact[]> {
  const supabase = await createClient()

  // Resolve business_id from authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: businessUser } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!businessUser) throw new Error('Business not found')

  // month is 1-based (1 = January)
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 1).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
      *,
      contacts ( name, phone, status )
    `
    )
    .eq('business_id', businessUser.business_id)
    .gte('start_time', startDate)
    .lt('start_time', endDate)
    .order('start_time')

  if (error) {
    throw new Error(`Failed to fetch month appointments: ${error.message}`)
  }

  return (data as AppointmentWithContact[]) ?? []
}
