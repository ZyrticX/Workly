'use client'

import { useState } from 'react'
import { Clock, User } from 'lucide-react'
import { AppointmentDetail } from './appointment-detail'
import type { Appointment } from './calendar-view'

interface AppointmentBlockProps {
  appointment: Appointment
  variant: 'full' | 'compact'
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

export function AppointmentBlock({ appointment, variant, onRefresh }: AppointmentBlockProps) {
  const [showDetail, setShowDetail] = useState(false)
  const colors = getServiceColor(appointment.service_type)

  const startDate = new Date(appointment.start_time)
  const timeStr = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' })

  const isCancelled = appointment.status === 'cancelled'
  const isCompleted = appointment.status === 'completed'

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowDetail(true)}
          className={`w-full text-start rounded px-1.5 py-1 text-[10px] sm:text-xs border-s-2 ${colors.bg} ${colors.border} ${colors.text} truncate transition-opacity hover:opacity-80 ${isCancelled ? 'opacity-50 line-through' : ''}`}
        >
          <span className="font-medium">{timeStr}</span>{' '}
          <span className="hidden sm:inline">{appointment.contacts?.name || appointment.contact_name}</span>
        </button>

        {showDetail && (
          <AppointmentDetail
            appointment={appointment}
            onClose={() => setShowDetail(false)}
            onRefresh={onRefresh}
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className={`w-full text-start rounded-lg px-3 py-2 border-s-3 ${colors.bg} ${colors.border} ${colors.text} transition-opacity hover:opacity-80 ${isCancelled ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className={`font-medium text-sm truncate ${isCancelled ? 'line-through' : ''}`}>
              {appointment.contacts?.name || appointment.contact_name}
            </span>
            {isCancelled && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                בוטל
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                הושלם
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            <span className="text-xs">
              {timeStr} ({appointment.duration_minutes} ד&apos;)
            </span>
          </div>
        </div>
        <div className="text-xs mt-0.5 opacity-75">{appointment.service_type}</div>
      </button>

      {showDetail && (
        <AppointmentDetail
          appointment={appointment}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}
