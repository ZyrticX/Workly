const TZ = 'Asia/Jerusalem'

/** Get current Date object in Israel timezone */
export function getIsraelNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

/** Get today's date as YYYY-MM-DD in Israel timezone */
export function getIsraelToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Get current time as HH:MM in Israel timezone */
export function getIsraelTime(): string {
  const d = getIsraelNow()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Format Date to YYYY-MM-DDTHH:MM:00 for SQL queries */
export function formatIsraelSQL(date?: Date): string {
  const d = date || getIsraelNow()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`
}

/** Format Date to YYYY-MM-DD */
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Get day of week index (0=Sunday) in Israel timezone */
export function getIsraelDayOfWeek(): number {
  return getIsraelNow().getDay()
}
