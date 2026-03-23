import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateAppointmentData {
  businessId: string
  contactId: string
  serviceType: string
  startTime: string
  endTime: string
  durationMinutes: number
  price: number
  notes?: string
}

interface Appointment {
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
}

// ──────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────

/**
 * Create a new appointment, schedule a reminder, and update contact stats.
 */
export async function createAppointment(
  data: CreateAppointmentData
): Promise<Appointment> {
  const supabase = await createClient()

  // 1. Insert appointment
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      business_id: data.businessId,
      contact_id: data.contactId,
      service_type: data.serviceType,
      start_time: data.startTime,
      end_time: data.endTime,
      duration_minutes: data.durationMinutes,
      price: data.price,
      notes: data.notes ?? null,
      status: 'confirmed',
    })
    .select()
    .single()

  if (error || !appointment) {
    throw new Error(`Failed to create appointment: ${error?.message}`)
  }

  // 2. Schedule reminder — 1 hour before start
  //    Placeholder: when BullMQ is configured, uncomment the queue call.
  const reminderTime =
    new Date(data.startTime).getTime() - 60 * 60 * 1000
  const delay = reminderTime - Date.now()

  if (delay > 0) {
    // TODO: Replace with BullMQ queue when configured
    // await reminderQueue.add('appointment-reminder', {
    //   appointmentId: appointment.id,
    //   businessId: data.businessId,
    //   contactId: data.contactId,
    // }, { delay })
    console.log(
      `[Reminder] Scheduled for appointment ${appointment.id} in ${Math.round(delay / 60000)} minutes`
    )
  }

  // 3. Update contact stats via RPC (atomic increment)
  const { error: rpcError } = await supabase.rpc('increment_contact_visits', {
    p_contact_id: data.contactId,
    p_revenue: data.price,
  })

  if (rpcError) {
    console.error(
      `[Contact Stats] Failed to update for ${data.contactId}: ${rpcError.message}`
    )
  }

  return appointment as Appointment
}

/**
 * Cancel an appointment. Checks the waitlist and offers the freed slot
 * to waiting contacts.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<Appointment> {
  const supabase = await createClient()

  // 1. Fetch appointment details (with contact for notification)
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*, contacts(wa_id, name)')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appointment) {
    throw new Error('Appointment not found')
  }

  // 2. Mark as cancelled
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      notes: reason
        ? `${appointment.notes ? appointment.notes + ' | ' : ''}Cancelled: ${reason}`
        : appointment.notes,
    })
    .eq('id', appointmentId)

  if (updateError) {
    throw new Error(`Failed to cancel appointment: ${updateError.message}`)
  }

  // 3. Check waitlist for the same date and business
  const appointmentDate = appointment.start_time.split('T')[0]

  const { data: waitlisted } = await supabase
    .from('waitlist')
    .select('*, contacts(wa_id, name)')
    .eq('business_id', appointment.business_id)
    .eq('status', 'waiting')
    .eq('preferred_date', appointmentDate)
    .order('created_at', { ascending: true })
    .limit(3)

  // 4. Offer the freed slot to waitlisted contacts
  if (waitlisted && waitlisted.length > 0) {
    const time = new Date(appointment.start_time).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })

    for (const entry of waitlisted) {
      // Mark as offered
      await supabase
        .from('waitlist')
        .update({ status: 'offered' })
        .eq('id', entry.id)

      // TODO: Send WhatsApp message when WAHA provider is configured
      // const phone = await getBusinessPhone(appointment.business_id)
      // await whatsapp.sendMessage(
      //   phone.session_id!,
      //   entry.contacts.wa_id,
      //   `היי ${entry.contacts.name}! התפנה תור ב-${time}. מתאים לך?`
      // )
      console.log(
        `[Waitlist] Offered slot at ${time} to contact ${entry.contact_id}`
      )
    }
  }

  return appointment as Appointment
}

/**
 * Reschedule an appointment to a new start time.
 * Recalculates end_time based on existing duration.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newStartTime: string
): Promise<Appointment> {
  const supabase = await createClient()

  // 1. Fetch current appointment for duration
  const { data: current, error: fetchError } = await supabase
    .from('appointments')
    .select('duration_minutes')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !current) {
    throw new Error('Appointment not found')
  }

  // 2. Calculate new end time
  const start = new Date(newStartTime)
  const end = new Date(start.getTime() + current.duration_minutes * 60 * 1000)

  // 3. Update
  const { data: updated, error: updateError } = await supabase
    .from('appointments')
    .update({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single()

  if (updateError || !updated) {
    throw new Error(`Failed to reschedule appointment: ${updateError?.message}`)
  }

  // 4. Re-schedule reminder
  const reminderTime = start.getTime() - 60 * 60 * 1000
  const delay = reminderTime - Date.now()

  if (delay > 0) {
    // TODO: Replace with BullMQ — remove old job, add new one
    // await reminderQueue.removeJobs(`reminder-${appointmentId}`)
    // await reminderQueue.add('appointment-reminder', {
    //   appointmentId,
    //   businessId: updated.business_id,
    //   contactId: updated.contact_id,
    // }, { delay, jobId: `reminder-${appointmentId}` })
    console.log(
      `[Reminder] Rescheduled for appointment ${appointmentId} in ${Math.round(delay / 60000)} minutes`
    )
  }

  return updated as Appointment
}
