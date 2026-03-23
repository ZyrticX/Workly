'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Plus, CalendarDays, CalendarPlus } from 'lucide-react'
import { AppointmentBlock } from './appointment-block'
import { NewAppointmentSheet } from './new-appointment-sheet'

type ViewMode = 'daily' | 'weekly' | 'monthly'

export interface Appointment {
  id: string
  contact_id: string
  contact_name?: string
  contacts?: { name: string; phone: string } | null
  service_type: string
  start_time: string
  end_time: string
  duration_minutes: number
  price?: number
  notes?: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
}

interface CalendarViewProps {
  initialDate: string
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const VIEW_LABELS: Record<ViewMode, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
}

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) {
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
  }
  return slots
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const start = new Date(date)
  start.setDate(date.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getMonthGrid(date: Date): (Date | null)[][] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()

  const weeks: (Date | null)[][] = []
  let current: (Date | null)[] = []

  for (let i = 0; i < startPadding; i++) {
    current.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    current.push(new Date(year, month, day))
    if (current.length === 7) {
      weeks.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    while (current.length < 7) {
      current.push(null)
    }
    weeks.push(current)
  }

  return weeks
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(date: Date, mode: ViewMode): string {
  if (mode === 'daily') {
    return `יום ${HEBREW_DAYS[date.getDay()]}, ${date.getDate()} ${HEBREW_MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }
  if (mode === 'monthly') {
    return `${HEBREW_MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }
  const week = getWeekDates(date)
  const first = week[0]
  const last = week[6]
  return `${first.getDate()} - ${last.getDate()} ${HEBREW_MONTHS[last.getMonth()]} ${last.getFullYear()}`
}

export function CalendarView({ initialDate }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate + 'T00:00:00'))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewSheet, setShowNewSheet] = useState(false)

  const fetchAppointments = useCallback(async (date: Date, mode: ViewMode) => {
    setLoading(true)
    try {
      let startDate: string
      let endDate: string

      if (mode === 'daily') {
        startDate = formatDateKey(date)
        endDate = startDate
      } else if (mode === 'weekly') {
        const week = getWeekDates(date)
        startDate = formatDateKey(week[0])
        endDate = formatDateKey(week[6])
      } else {
        const year = date.getFullYear()
        const month = date.getMonth()
        startDate = formatDateKey(new Date(year, month, 1))
        endDate = formatDateKey(new Date(year, month + 1, 0))
      }

      const res = await fetch(`/api/appointments?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) {
        const data = await res.json()
        setAppointments(data.appointments ?? [])
      }
    } catch {
      // Silently fail - appointments will be empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAppointments(currentDate, viewMode)
  }, [currentDate, viewMode, fetchAppointments])

  function navigate(direction: 'prev' | 'next') {
    const d = new Date(currentDate)
    const delta = direction === 'next' ? 1 : -1

    if (viewMode === 'daily') d.setDate(d.getDate() + delta)
    else if (viewMode === 'weekly') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)

    setCurrentDate(d)
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  function getAppointmentsForDate(dateKey: string): Appointment[] {
    return appointments.filter((a) => a.start_time.slice(0, 10) === dateKey && a.status !== 'cancelled')
  }

  function getAppointmentsForSlot(time: string): Appointment[] {
    return appointments.filter((a) => {
      const t = new Date(a.start_time)
      const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
      return hhmm === time
    })
  }

  const timeSlots = generateTimeSlots()

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="bg-white rounded-xl border border-[#E8EFE9] p-4">
        {/* Row 1: View mode + New appointment */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex bg-[#F7FAF8] rounded-lg p-1 border border-[#E8EFE9]">
            {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all min-h-[36px] ${
                  viewMode === mode
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[#6B7B73] hover:text-[#1B2E24]'
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowNewSheet(true)}
            aria-label="צור תור חדש"
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[var(--color-primary)] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">תור חדש</span>
            <span className="sm:hidden">חדש</span>
          </button>
        </div>

        {/* Row 2: Navigation */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => navigate('next')}
            className="p-2 rounded-lg hover:bg-[#F7FAF8] transition-colors border border-[#E8EFE9] min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="הקודם"
          >
            <ChevronRight className="w-5 h-5 text-[#6B7B73]" />
          </button>

          <span className="text-xs sm:text-sm font-medium text-[#1B2E24] text-center flex-1">
            {formatDisplayDate(currentDate, viewMode)}
          </span>

          <button
            onClick={() => navigate('prev')}
            className="p-2 rounded-lg hover:bg-[#F7FAF8] transition-colors border border-[#E8EFE9] min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="הבא"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7B73]" />
          </button>

          <button
            onClick={goToday}
            aria-label="עבור להיום"
            className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/5 transition-colors min-h-[40px]"
          >
            היום
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="bg-white rounded-xl border border-[#E8EFE9] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" aria-label="טוען תורים" />
          </div>
        ) : viewMode === 'daily' && appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10">
              <CalendarPlus className="w-8 h-8 text-[var(--color-primary)]" />
            </div>
            <p className="text-base font-semibold text-[#1B2E24]">אין תורים ליום הזה</p>
            <p className="mt-2 text-sm text-[#6B7B73] text-center max-w-[260px] leading-relaxed">
              אין תורים מתוכננים. לחץ למטה כדי להוסיף תור חדש
            </p>
            <button
              onClick={() => setShowNewSheet(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-ios hover:bg-[var(--color-primary-dark)] transition-ios press-effect"
              aria-label="הוסף תור חדש"
            >
              <Plus className="w-4 h-4" />
              הוסף תור
            </button>
          </div>
        ) : (
          <>
            {/* Daily View */}
            {viewMode === 'daily' && (
              <div className="divide-y divide-[#E8EFE9]">
                {timeSlots.map((slot) => {
                  const slotAppointments = getAppointmentsForSlot(slot)
                  return (
                    <div key={slot} className="flex min-h-[56px]">
                      <div className="w-16 sm:w-20 shrink-0 py-2 px-3 text-xs text-[#6B7B73] font-medium border-s border-[#E8EFE9] bg-[#F7FAF8]">
                        {slot}
                      </div>
                      <div className="flex-1 p-1 flex flex-col gap-1">
                        {slotAppointments.map((apt) => (
                          <AppointmentBlock key={apt.id} appointment={apt} variant="full" onRefresh={() => fetchAppointments(currentDate, viewMode)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Weekly View */}
            {viewMode === 'weekly' && (
              <div className="overflow-x-auto">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-[#E8EFE9] min-w-[500px]">
                  {getWeekDates(currentDate).map((date, i) => {
                    const isToday = formatDateKey(date) === formatDateKey(new Date())
                    return (
                      <div
                        key={i}
                        className={`text-center py-3 border-s border-[#E8EFE9] last:border-s-0 ${
                          isToday ? 'bg-[var(--color-primary)]/5' : ''
                        }`}
                      >
                        <div className="text-xs text-[#6B7B73]">{HEBREW_DAYS[i]}</div>
                        <div
                          className={`text-sm font-semibold mt-0.5 ${
                            isToday
                              ? 'w-7 h-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center mx-auto'
                              : 'text-[#1B2E24]'
                          }`}
                        >
                          {date.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Day columns with appointments */}
                <div className="grid grid-cols-7 min-h-[400px] min-w-[500px]">
                  {getWeekDates(currentDate).map((date, i) => {
                    const dateKey = formatDateKey(date)
                    const dayAppointments = getAppointmentsForDate(dateKey)
                    const isToday = dateKey === formatDateKey(new Date())
                    return (
                      <div
                        key={i}
                        className={`border-s border-[#E8EFE9] last:border-s-0 p-1 space-y-1 ${
                          isToday ? 'bg-[var(--color-primary)]/5' : ''
                        }`}
                      >
                        {dayAppointments.map((apt) => (
                          <AppointmentBlock key={apt.id} appointment={apt} variant="compact" onRefresh={() => fetchAppointments(currentDate, viewMode)} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Monthly View */}
            {viewMode === 'monthly' && (
              <div className="overflow-x-auto">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-[#E8EFE9]">
                  {HEBREW_DAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center py-2.5 text-xs font-medium text-[#6B7B73] border-s border-[#E8EFE9] last:border-s-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                {getMonthGrid(currentDate).map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b border-[#E8EFE9] last:border-b-0">
                    {week.map((date, di) => {
                      if (!date) {
                        return (
                          <div
                            key={`empty-${di}`}
                            className="min-h-[80px] sm:min-h-[100px] border-s border-[#E8EFE9] last:border-s-0 bg-gray-50/50"
                          />
                        )
                      }

                      const dateKey = formatDateKey(date)
                      const dayAppointments = getAppointmentsForDate(dateKey)
                      const isToday = dateKey === formatDateKey(new Date())

                      return (
                        <div
                          key={dateKey}
                          className={`min-h-[80px] sm:min-h-[100px] border-s border-[#E8EFE9] last:border-s-0 p-1.5 cursor-pointer hover:bg-[#F7FAF8] transition-colors ${
                            isToday ? 'bg-[var(--color-primary)]/5' : ''
                          }`}
                          onClick={() => {
                            setCurrentDate(date)
                            setViewMode('daily')
                          }}
                        >
                          <div
                            className={`text-sm mb-1 ${
                              isToday
                                ? 'w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-semibold'
                                : 'text-[#1B2E24] font-medium'
                            }`}
                          >
                            {date.getDate()}
                          </div>

                          {dayAppointments.length > 0 && (
                            <div className="space-y-0.5">
                              {dayAppointments.slice(0, 2).map((apt) => {
                                const t = new Date(apt.start_time)
                                const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
                                return (
                                <div
                                  key={apt.id}
                                  className="text-[10px] sm:text-xs truncate px-1 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]"
                                >
                                  {hhmm} {apt.contacts?.name || apt.contact_name}
                                </div>
                                )
                              })}
                              {dayAppointments.length > 2 && (
                                <div className="text-[10px] text-[#6B7B73] px-1">
                                  +{dayAppointments.length - 2} נוספים
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Appointment Sheet */}
      {showNewSheet && (
        <NewAppointmentSheet
          date={formatDateKey(currentDate)}
          onClose={() => setShowNewSheet(false)}
          onCreated={() => {
            setShowNewSheet(false)
            fetchAppointments(currentDate, viewMode)
          }}
        />
      )}
    </div>
  )
}
