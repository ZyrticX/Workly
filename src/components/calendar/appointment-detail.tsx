'use client'

import { useState } from 'react'
import {
  X,
  User,
  Phone,
  Clock,
  Calendar,
  Tag,
  FileText,
  Loader2,
  Ban,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
} from 'lucide-react'
import { useToastContext } from '@/components/ui/toast'
import type { Appointment } from './calendar-view'

interface AppointmentDetailProps {
  appointment: Appointment
  onClose: () => void
  onRefresh: () => void
}

const SERVICE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'תספורת': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  'צבע': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700' },
  'טיפול פנים': { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700' },
  'מניקור': { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700' },
  'פדיקור': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  'עיסוי': { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700' },
  'ייעוץ': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
  'אחר': { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' },
}

function getServiceColor(serviceType: string) {
  return SERVICE_COLORS[serviceType] ?? SERVICE_COLORS['אחר']
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'מתוכנן',
  confirmed: 'מאושר',
  completed: 'הושלם',
  cancelled: 'בוטל',
  no_show: 'לא הגיע',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-amber-100 text-amber-700',
}

function generateAvailableSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export function AppointmentDetail({ appointment, onClose, onRefresh }: AppointmentDetailProps) {
  const { toast } = useToastContext()
  const [mode, setMode] = useState<'view' | 'reschedule' | 'confirm-cancel'>('view')
  const [loading, setLoading] = useState(false)

  // Reschedule state
  const [newDate, setNewDate] = useState(appointment.start_time.slice(0, 10))
  const [newTime, setNewTime] = useState(() => {
    const d = new Date(appointment.start_time)
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' })
  })

  const colors = getServiceColor(appointment.service_type)
  const startDate = new Date(appointment.start_time)
  const timeStr = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' })
  const dateStr = startDate.toLocaleDateString('he-IL', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const contactName = appointment.contacts?.name || appointment.contact_name || 'לקוח'
  const contactPhone = appointment.contacts?.phone || ''
  const isCancelled = appointment.status === 'cancelled'
  const isCompleted = appointment.status === 'completed'
  const canEdit = !isCancelled && !isCompleted

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/appointments?id=${appointment.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast('התור בוטל בהצלחה', 'success')
        onRefresh()
        onClose()
      } else {
        const data = await res.json()
        toast(data.error || 'שגיאה בביטול התור', 'error')
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete() {
    setLoading(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appointment.id,
          status: 'completed',
        }),
      })

      if (res.ok) {
        toast('התור סומן כהושלם', 'success')
        onRefresh()
        onClose()
      } else {
        const data = await res.json()
        toast(data.error || 'שגיאה בעדכון התור', 'error')
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReschedule() {
    if (!newDate || !newTime) {
      toast('יש לבחור תאריך ושעה', 'error')
      return
    }

    setLoading(true)
    try {
      const startTime = `${newDate}T${newTime}:00`
      const endMs = new Date(startTime).getTime() + appointment.duration_minutes * 60 * 1000
      const endTime = new Date(endMs).toISOString()

      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appointment.id,
          startTime,
          endTime,
        }),
      })

      if (res.ok) {
        toast('התור עודכן בהצלחה', 'success')
        onRefresh()
        onClose()
      } else {
        const data = await res.json()
        toast(data.error || 'שגיאה בעדכון התור', 'error')
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setLoading(false)
    }
  }

  const availableSlots = generateAvailableSlots()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-md max-h-[92vh] bg-white/95 backdrop-blur-xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-bottom duration-300 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#E8EFE9] px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text}`}
            >
              {appointment.service_type}
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[appointment.status]}`}
            >
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-[#6B7B73]" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Contact Info */}
          <div className="bg-[#F7FAF8] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                <User className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1B2E24]">{contactName}</h3>
                {contactPhone && (
                  <div className="flex items-center gap-1 text-sm text-[#6B7B73]">
                    <Phone className="w-3.5 h-3.5" />
                    <span dir="ltr">{contactPhone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Appointment Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F7FAF8] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7B73] mb-1">
                <Calendar className="w-3.5 h-3.5" />
                תאריך
              </div>
              <div className="text-sm font-medium text-[#1B2E24]">{dateStr}</div>
            </div>
            <div className="bg-[#F7FAF8] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7B73] mb-1">
                <Clock className="w-3.5 h-3.5" />
                שעה
              </div>
              <div className="text-sm font-medium text-[#1B2E24]">{timeStr}</div>
            </div>
            <div className="bg-[#F7FAF8] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7B73] mb-1">
                <Tag className="w-3.5 h-3.5" />
                משך
              </div>
              <div className="text-sm font-medium text-[#1B2E24]">{appointment.duration_minutes} דקות</div>
            </div>
            {appointment.price !== undefined && appointment.price > 0 && (
              <div className="bg-[#F7FAF8] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-[#6B7B73] mb-1">
                  <Banknote className="w-3.5 h-3.5" />
                  מחיר
                </div>
                <div className="text-sm font-medium text-[#1B2E24]">{appointment.price} &#8362;</div>
              </div>
            )}
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="bg-[#F7FAF8] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-[#6B7B73] mb-1">
                <FileText className="w-3.5 h-3.5" />
                הערות
              </div>
              <div className="text-sm text-[#1B2E24] leading-relaxed">{appointment.notes}</div>
            </div>
          )}

          {/* Cancel Confirmation */}
          {mode === 'confirm-cancel' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold text-sm">ביטול תור</span>
              </div>
              <p className="text-sm text-red-600">
                האם אתה בטוח שברצונך לבטל את התור של{' '}
                <span className="font-semibold">{contactName}</span>?
              </p>
              <p className="text-xs text-red-500">
                פעולה זו תשלח הודעת ביטול ללקוח.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      מבטל...
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      כן, בטל תור
                    </>
                  )}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-white text-[#1B2E24] text-sm font-medium rounded-lg border border-[#E8EFE9] hover:bg-[#F7FAF8] transition-colors disabled:opacity-60"
                >
                  חזור
                </button>
              </div>
            </div>
          )}

          {/* Reschedule Panel */}
          {mode === 'reschedule' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-orange-700">
                <CalendarClock className="w-5 h-5" />
                <span className="font-semibold text-sm">שינוי שעה</span>
              </div>

              {/* Date picker */}
              <div>
                <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">תאריך חדש</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white"
                />
              </div>

              {/* Time picker */}
              <div>
                <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">שעה חדשה</label>
                <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto p-1">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setNewTime(slot)}
                      className={`px-2 py-1.5 text-sm rounded-lg border transition-all ${
                        newTime === slot
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-[#1B2E24] border-[#E8EFE9] hover:border-orange-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReschedule}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      מעדכן...
                    </>
                  ) : (
                    <>
                      <CalendarClock className="w-4 h-4" />
                      עדכן תור
                    </>
                  )}
                </button>
                <button
                  onClick={() => setMode('view')}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-white text-[#1B2E24] text-sm font-medium rounded-lg border border-[#E8EFE9] hover:bg-[#F7FAF8] transition-colors disabled:opacity-60"
                >
                  חזור
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer - only when in view mode and appointment is editable */}
        {mode === 'view' && canEdit && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-[#E8EFE9] px-5 py-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('confirm-cancel')}
                className="flex-1 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Ban className="w-4 h-4" />
                בטל תור
              </button>
              <button
                onClick={() => setMode('reschedule')}
                className="flex-1 py-2.5 bg-orange-50 text-orange-600 text-sm font-semibold rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <CalendarClock className="w-4 h-4" />
                שנה שעה
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 text-sm font-semibold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                סמן כהושלם
              </button>
            </div>
          </div>
        )}

        {/* Status message for non-editable appointments */}
        {mode === 'view' && !canEdit && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-[#E8EFE9] px-5 py-4">
            <div className={`text-center text-sm font-medium py-2.5 rounded-xl ${
              isCancelled ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {isCancelled ? 'תור זה בוטל' : 'תור זה הושלם'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
