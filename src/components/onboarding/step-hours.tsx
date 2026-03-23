'use client'

import { useState, useEffect } from 'react'

interface Break {
  id: string
  start: string
  end: string
}

export interface DaySchedule {
  day: string
  dayHe: string
  active: boolean
  start: string
  end: string
  breaks: Break[]
}

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 'sunday', dayHe: 'ראשון', active: true, start: '09:00', end: '18:00', breaks: [] },
  { day: 'monday', dayHe: 'שני', active: true, start: '09:00', end: '18:00', breaks: [] },
  { day: 'tuesday', dayHe: 'שלישי', active: true, start: '09:00', end: '18:00', breaks: [] },
  { day: 'wednesday', dayHe: 'רביעי', active: true, start: '09:00', end: '18:00', breaks: [] },
  { day: 'thursday', dayHe: 'חמישי', active: true, start: '09:00', end: '18:00', breaks: [] },
  { day: 'friday', dayHe: 'שישי', active: true, start: '09:00', end: '14:00', breaks: [] },
  { day: 'saturday', dayHe: 'שבת', active: false, start: '09:00', end: '18:00', breaks: [] },
]

interface StepHoursProps {
  initialSchedule?: DaySchedule[]
  onChange: (schedule: DaySchedule[]) => void
}

export default function StepHours({ initialSchedule, onChange }: StepHoursProps) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    initialSchedule && initialSchedule.length > 0 ? initialSchedule : DEFAULT_SCHEDULE
  )

  useEffect(() => {
    onChange(schedule)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDay = (dayIndex: number, updates: Partial<DaySchedule>) => {
    const updated = schedule.map((d, i) =>
      i === dayIndex ? { ...d, ...updates } : d
    )
    setSchedule(updated)
    onChange(updated)
  }

  const addBreak = (dayIndex: number) => {
    const day = schedule[dayIndex]
    const newBreak: Break = {
      id: Date.now().toString(),
      start: '12:00',
      end: '13:00',
    }
    updateDay(dayIndex, { breaks: [...day.breaks, newBreak] })
  }

  const updateBreak = (dayIndex: number, breakId: string, field: 'start' | 'end', value: string) => {
    const day = schedule[dayIndex]
    const updatedBreaks = day.breaks.map((b) =>
      b.id === breakId ? { ...b, [field]: value } : b
    )
    updateDay(dayIndex, { breaks: updatedBreaks })
  }

  const removeBreak = (dayIndex: number, breakId: string) => {
    const day = schedule[dayIndex]
    updateDay(dayIndex, { breaks: day.breaks.filter((b) => b.id !== breakId) })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-text">שעות פעילות</h3>
        <p className="text-sm text-text-secondary mt-1">
          הגדר את שעות העבודה שלך לכל יום בשבוע
        </p>
      </div>

      <div className="space-y-3">
        {schedule.map((day, index) => (
          <div
            key={day.day}
            className={`border rounded-[var(--radius-card)] transition-colors ${
              day.active
                ? 'bg-white border-border'
                : 'bg-neutral-bg border-transparent'
            }`}
          >
            {/* Day header */}
            <div className="flex items-center gap-3 p-4">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => updateDay(index, { active: !day.active })}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                  day.active ? 'bg-[var(--color-primary)]' : 'bg-border'
                }`}
                role="switch"
                aria-checked={day.active}
                aria-label={`${day.dayHe} - ${day.active ? 'פעיל' : 'לא פעיל'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    day.active ? 'start-0.5' : 'start-[22px]'
                  }`}
                />
              </button>

              {/* Day name */}
              <span className={`text-sm font-medium min-w-[50px] ${day.active ? 'text-text' : 'text-text-muted'}`}>
                {day.dayHe}
              </span>

              {/* Time inputs */}
              {day.active && (
                <div className="flex items-center gap-2 me-auto">
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => updateDay(index, { start: e.target.value })}
                    className="px-2 py-1.5 rounded-[var(--radius-badge)] border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                    dir="ltr"
                  />
                  <span className="text-text-muted text-sm">עד</span>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => updateDay(index, { end: e.target.value })}
                    className="px-2 py-1.5 rounded-[var(--radius-badge)] border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                    dir="ltr"
                  />
                </div>
              )}

              {!day.active && (
                <span className="text-sm text-text-muted me-auto">סגור</span>
              )}
            </div>

            {/* Breaks section */}
            {day.active && (
              <div className="px-4 pb-4 space-y-2">
                {day.breaks.map((brk) => (
                  <div key={brk.id} className="flex items-center gap-2 bg-surface rounded-[var(--radius-badge)] p-2">
                    <span className="text-xs text-text-muted min-w-[40px]">הפסקה:</span>
                    <input
                      type="time"
                      value={brk.start}
                      onChange={(e) => updateBreak(index, brk.id, 'start', e.target.value)}
                      className="px-2 py-1 rounded-md border border-border bg-white text-text text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                      dir="ltr"
                    />
                    <span className="text-text-muted text-xs">-</span>
                    <input
                      type="time"
                      value={brk.end}
                      onChange={(e) => updateBreak(index, brk.id, 'end', e.target.value)}
                      className="px-2 py-1 rounded-md border border-border bg-white text-text text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => removeBreak(index, brk.id)}
                      className="p-1 text-text-muted hover:text-danger transition-colors me-auto"
                      aria-label="הסר הפסקה"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addBreak(index)}
                  className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  הוסף הפסקה
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
