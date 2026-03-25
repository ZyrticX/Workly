'use client'

import { useRef, useCallback } from 'react'

interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * A controlled text input that enforces HH:MM 24-hour format.
 * Replaces <input type="time"> to avoid browser locale-dependent AM/PM display.
 */
export function TimeInput({ value, onChange, className }: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^\d:]/g, '')

      // Auto-insert colon after 2 digits if user hasn't typed one
      if (raw.length === 2 && !raw.includes(':')) {
        raw = raw + ':'
      }

      // Limit to 5 characters (HH:MM)
      if (raw.length > 5) raw = raw.slice(0, 5)

      // Validate partial input — allow typing in progress
      const match = raw.match(/^(\d{0,2}):?(\d{0,2})$/)
      if (!match) return

      const [, hStr, mStr] = match

      // Clamp hours 0-23 and minutes 0-59 only when fully typed
      if (hStr.length === 2 && Number(hStr) > 23) return
      if (mStr.length === 2 && Number(mStr) > 59) return

      onChange(raw)
    },
    [onChange]
  )

  const handleBlur = useCallback(() => {
    // Normalise on blur: pad to HH:MM
    const parts = value.split(':')
    const h = (parts[0] || '00').padStart(2, '0')
    const m = (parts[1] || '00').padStart(2, '0')
    const clamped = `${String(Math.min(Number(h), 23)).padStart(2, '0')}:${String(Math.min(Number(m), 59)).padStart(2, '0')}`
    if (clamped !== value) onChange(clamped)
  }, [value, onChange])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder="HH:MM"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  )
}
