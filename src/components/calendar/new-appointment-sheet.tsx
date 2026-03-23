'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, Clock, Loader2 } from 'lucide-react'
import { useToastContext } from '@/components/ui/toast'

interface Contact {
  id: string
  name: string
  phone: string
}

interface NewAppointmentSheetProps {
  date: string
  onClose: () => void
  onCreated: () => void
}

const SERVICE_TYPES = [
  'תספורת',
  'צבע',
  'טיפול פנים',
  'מניקור',
  'פדיקור',
  'עיסוי',
  'ייעוץ',
  'אחר',
]

const DURATIONS = [15, 30, 45, 60, 90, 120]

function generateAvailableSlots(): string[] {
  const slots: string[] = []
  for (let h = 6; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export function NewAppointmentSheet({ date, onClose, onCreated }: NewAppointmentSheetProps) {
  const { toast } = useToastContext()
  const [contactQuery, setContactQuery] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactResults, setShowContactResults] = useState(false)
  const [serviceType, setServiceType] = useState('')
  const [selectedDate, setSelectedDate] = useState(date)
  const [selectedTime, setSelectedTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (contactQuery.length < 2) {
      setContacts([])
      setShowContactResults(false)
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts?q=${encodeURIComponent(contactQuery)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setContacts(data.contacts ?? [])
          setShowContactResults(true)
        }
      } catch {
        // Silently fail
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [contactQuery])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!selectedContact) newErrors.contact = 'יש לבחור איש קשר'
    if (!serviceType) newErrors.service = 'יש לבחור סוג שירות'
    if (!selectedDate) newErrors.date = 'יש לבחור תאריך'
    if (!selectedTime) newErrors.time = 'יש לבחור שעה'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    setSubmitting(true)
    try {
      const startTime = `${selectedDate}T${selectedTime}:00`
      const endMs = new Date(startTime).getTime() + duration * 60 * 1000
      const endTime = new Date(endMs).toISOString()

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact!.id,
          serviceType,
          startTime,
          endTime,
          durationMinutes: duration,
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        toast('התור נוצר בהצלחה', 'success')
        onCreated()
      } else {
        const data = await res.json()
        const errMsg = data.error ?? 'שגיאה ביצירת התור'
        setErrors({ submit: errMsg })
        toast(errMsg, 'error')
      }
    } catch {
      setErrors({ submit: 'שגיאה בחיבור לשרת' })
      toast('שגיאה בחיבור לשרת', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const availableSlots = generateAvailableSlots()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[85dvh] overflow-y-auto shadow-xl pb-[env(safe-area-inset-bottom,24px)]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8EFE9] px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-[#1B2E24]">תור חדש</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-[#6B7B73]" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Contact Search */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">איש קשר</label>
            {selectedContact ? (
              <div className="flex items-center justify-between bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-lg px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-[#1B2E24]">{selectedContact.name}</div>
                  <div className="text-xs text-[#6B7B73]" dir="ltr">{selectedContact.phone}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedContact(null)
                    setContactQuery('')
                  }}
                  className="text-xs text-[#6B7B73] hover:text-red-500 transition-colors"
                >
                  שנה
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7B73]" />
                <input
                  type="text"
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  placeholder="חפש שם או טלפון..."
                  className="w-full ps-10 pe-3 py-2.5 border border-[#E8EFE9] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 min-h-[48px]"
                />
                {showContactResults && contacts.length > 0 && (
                  <div className="absolute top-full inset-x-0 mt-1 bg-white border border-[#E8EFE9] rounded-lg shadow-lg z-20 overflow-hidden">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedContact(c)
                          setShowContactResults(false)
                          setContactQuery('')
                        }}
                        className="w-full text-start px-3 py-2.5 hover:bg-[#F7FAF8] transition-colors border-b border-[#E8EFE9] last:border-b-0"
                      >
                        <div className="text-sm font-medium text-[#1B2E24]">{c.name}</div>
                        <div className="text-xs text-[#6B7B73]" dir="ltr">{c.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">סוג שירות</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SERVICE_TYPES.map((st) => (
                <button
                  key={st}
                  onClick={() => setServiceType(st)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all min-h-[44px] ${
                    serviceType === st
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-[#1B2E24] border-[#E8EFE9] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            {errors.service && <p className="text-xs text-red-500 mt-1">{errors.service}</p>}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">תאריך</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white min-h-[48px]"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Time Slots */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">
              <Clock className="w-4 h-4 inline-block ms-1" />
              שעה
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-[200px] overflow-y-auto p-1">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={`px-2 py-1.5 text-sm rounded-lg border transition-all min-h-[44px] ${
                    selectedTime === slot
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-[#1B2E24] border-[#E8EFE9] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            {errors.time && <p className="text-xs text-red-500 mt-1">{errors.time}</p>}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">משך (דקות)</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-1.5 text-sm rounded-lg border transition-all min-h-[44px] min-w-[44px] ${
                    duration === d
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-[#1B2E24] border-[#E8EFE9] hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1B2E24] mb-1.5">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="הערות נוספות..."
              className="w-full px-3 py-2.5 border border-[#E8EFE9] rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] bg-white placeholder:text-[#6B7B73]/60 resize-none"
            />
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 mb-6 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                יוצר תור...
              </>
            ) : (
              'צור תור'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
