// ── Hebrew Calendar + Jewish Holidays ──────────────────
// Uses @hebcal/core for accurate Hebrew date conversion
// All dates are Gregorian equivalents for Jewish holidays.
// Coverage: 5786-5787 (2025-2027)

import { HDate, months } from '@hebcal/core'

// ── Hebrew Date Conversion ──────────────────────────

const HEBREW_MONTHS: Record<number, string> = {
  [months.NISAN]: 'ניסן',
  [months.IYYAR]: 'אייר',
  [months.SIVAN]: 'סיון',
  [months.TAMUZ]: 'תמוז',
  [months.AV]: 'אב',
  [months.ELUL]: 'אלול',
  [months.TISHREI]: 'תשרי',
  [months.CHESHVAN]: 'חשון',
  [months.KISLEV]: 'כסלו',
  [months.TEVET]: 'טבת',
  [months.SHVAT]: 'שבט',
  [months.ADAR_I]: 'אדר',
  [months.ADAR_II]: 'אדר ב׳',
}

const GEMATRIA_ONES = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳']
const GEMATRIA_TENS = ['', 'י׳', 'כ׳', 'ל׳']

function dayToGematria(day: number): string {
  if (day === 15) return 'ט״ו'
  if (day === 16) return 'ט״ז'
  const tens = Math.floor(day / 10)
  const ones = day % 10
  const t = GEMATRIA_TENS[tens] || ''
  const o = GEMATRIA_ONES[ones] || ''
  if (t && o) return `${t}${o}`.replace('׳', '״')
  return t || o
}

function yearToHebrew(year: number): string {
  // Simple conversion: 5786 → תשפ"ו
  const thousands = Math.floor(year / 1000) // Usually 5
  const hundreds = Math.floor((year % 1000) / 100)
  const tens = Math.floor((year % 100) / 10)
  const ones = year % 10

  const hLetters: Record<number, string> = {
    1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  }
  const hTens: Record<number, string> = {
    1: 'י', 2: 'כ', 3: 'ל', 4: 'מ', 5: 'נ', 6: 'ס', 7: 'ע', 8: 'פ', 9: 'צ',
  }
  const hHundreds: Record<number, string> = {
    1: 'ק', 2: 'ר', 3: 'ש', 4: 'ת', 5: 'תק', 6: 'תר', 7: 'תש', 8: 'תת',
  }

  let result = ''
  if (hundreds) result += hHundreds[hundreds] || ''
  if (tens === 1 && ones === 5) result += 'טו'
  else if (tens === 1 && ones === 6) result += 'טז'
  else {
    if (tens) result += hTens[tens] || ''
    if (ones) result += hLetters[ones] || ''
  }

  // Add geresh/gershayim
  if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1)
  } else if (result.length === 1) {
    result += '׳'
  }

  return result
}

/** Convert Gregorian date string (YYYY-MM-DD) to Hebrew date display */
export function getHebrewDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const hd = new HDate(new Date(y, m - 1, d))
    const day = dayToGematria(hd.getDate())
    const month = HEBREW_MONTHS[hd.getMonth()] || ''
    const year = yearToHebrew(hd.getFullYear())
    return `${day} ${month} ${year}`
  } catch {
    return ''
  }
}

/** Get short Hebrew date (day + month only) */
export function getHebrewDateShort(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const hd = new HDate(new Date(y, m - 1, d))
    const day = dayToGematria(hd.getDate())
    const month = HEBREW_MONTHS[hd.getMonth()] || ''
    return `${day} ${month}`
  } catch {
    return ''
  }
}

export interface HebrewHoliday {
  name: string
  nameHe: string
  date: string // YYYY-MM-DD
  isWorkDay: boolean // false = no appointments
  isErev: boolean // erev = might close early
}

// Jewish holidays with Gregorian dates
// Source: hebcal.com
const HOLIDAYS_5786_5787: HebrewHoliday[] = [
  // ── 5786 (2025-2026) ──
  // ראש השנה
  { name: 'Rosh Hashana 1', nameHe: 'ראש השנה א׳', date: '2025-09-23', isWorkDay: false, isErev: false },
  { name: 'Rosh Hashana 2', nameHe: 'ראש השנה ב׳', date: '2025-09-24', isWorkDay: false, isErev: false },
  // צום גדליה
  { name: 'Tzom Gedaliah', nameHe: 'צום גדליה', date: '2025-09-25', isWorkDay: true, isErev: false },
  // יום כיפור
  { name: 'Erev Yom Kippur', nameHe: 'ערב יום כיפור', date: '2025-10-01', isWorkDay: false, isErev: true },
  { name: 'Yom Kippur', nameHe: 'יום כיפור', date: '2025-10-02', isWorkDay: false, isErev: false },
  // סוכות
  { name: 'Sukkot 1', nameHe: 'סוכות א׳', date: '2025-10-07', isWorkDay: false, isErev: false },
  { name: 'Sukkot 2', nameHe: 'סוכות ב׳', date: '2025-10-08', isWorkDay: false, isErev: false },
  { name: 'Chol HaMoed Sukkot', nameHe: 'חול המועד סוכות', date: '2025-10-09', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Sukkot', nameHe: 'חול המועד סוכות', date: '2025-10-10', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Sukkot', nameHe: 'חול המועד סוכות', date: '2025-10-11', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Sukkot', nameHe: 'חול המועד סוכות', date: '2025-10-12', isWorkDay: true, isErev: false },
  { name: 'Hoshana Raba', nameHe: 'הושענא רבה', date: '2025-10-13', isWorkDay: true, isErev: true },
  { name: 'Shmini Atzeret', nameHe: 'שמיני עצרת / שמחת תורה', date: '2025-10-14', isWorkDay: false, isErev: false },
  // חנוכה
  { name: 'Chanukah 1', nameHe: 'חנוכה', date: '2025-12-15', isWorkDay: true, isErev: false },
  { name: 'Chanukah 2', nameHe: 'חנוכה', date: '2025-12-16', isWorkDay: true, isErev: false },
  { name: 'Chanukah 3', nameHe: 'חנוכה', date: '2025-12-17', isWorkDay: true, isErev: false },
  { name: 'Chanukah 4', nameHe: 'חנוכה', date: '2025-12-18', isWorkDay: true, isErev: false },
  { name: 'Chanukah 5', nameHe: 'חנוכה', date: '2025-12-19', isWorkDay: true, isErev: false },
  { name: 'Chanukah 6', nameHe: 'חנוכה', date: '2025-12-20', isWorkDay: true, isErev: false },
  { name: 'Chanukah 7', nameHe: 'חנוכה', date: '2025-12-21', isWorkDay: true, isErev: false },
  { name: 'Chanukah 8', nameHe: 'חנוכה', date: '2025-12-22', isWorkDay: true, isErev: false },
  // פורים
  { name: 'Purim', nameHe: 'פורים', date: '2026-03-17', isWorkDay: true, isErev: false },
  { name: 'Shushan Purim', nameHe: 'שושן פורים', date: '2026-03-18', isWorkDay: true, isErev: false },
  // פסח
  { name: 'Erev Pesach', nameHe: 'ערב פסח', date: '2026-04-01', isWorkDay: false, isErev: true },
  { name: 'Pesach 1', nameHe: 'פסח א׳', date: '2026-04-02', isWorkDay: false, isErev: false },
  { name: 'Pesach 2', nameHe: 'פסח ב׳', date: '2026-04-03', isWorkDay: false, isErev: false },
  { name: 'Chol HaMoed Pesach', nameHe: 'חול המועד פסח', date: '2026-04-04', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Pesach', nameHe: 'חול המועד פסח', date: '2026-04-05', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Pesach', nameHe: 'חול המועד פסח', date: '2026-04-06', isWorkDay: true, isErev: false },
  { name: 'Chol HaMoed Pesach', nameHe: 'חול המועד פסח', date: '2026-04-07', isWorkDay: true, isErev: false },
  { name: 'Pesach 7', nameHe: 'שביעי של פסח', date: '2026-04-08', isWorkDay: false, isErev: false },
  // יום הזיכרון + יום העצמאות
  { name: 'Yom HaZikaron', nameHe: 'יום הזיכרון', date: '2026-04-21', isWorkDay: false, isErev: false },
  { name: 'Yom HaAtzmaut', nameHe: 'יום העצמאות', date: '2026-04-22', isWorkDay: false, isErev: false },
  // ל"ג בעומר
  { name: 'Lag BaOmer', nameHe: 'ל״ג בעומר', date: '2026-05-12', isWorkDay: true, isErev: false },
  // שבועות
  { name: 'Erev Shavuot', nameHe: 'ערב שבועות', date: '2026-05-21', isWorkDay: false, isErev: true },
  { name: 'Shavuot', nameHe: 'שבועות', date: '2026-05-22', isWorkDay: false, isErev: false },
  // ט' באב
  { name: 'Tisha BAv', nameHe: 'תשעה באב', date: '2026-07-23', isWorkDay: false, isErev: false },

  // ── 5787 (2026-2027) ──
  // ראש השנה
  { name: 'Rosh Hashana 1', nameHe: 'ראש השנה א׳', date: '2026-09-12', isWorkDay: false, isErev: false },
  { name: 'Rosh Hashana 2', nameHe: 'ראש השנה ב׳', date: '2026-09-13', isWorkDay: false, isErev: false },
  // יום כיפור
  { name: 'Erev Yom Kippur', nameHe: 'ערב יום כיפור', date: '2026-09-20', isWorkDay: false, isErev: true },
  { name: 'Yom Kippur', nameHe: 'יום כיפור', date: '2026-09-21', isWorkDay: false, isErev: false },
  // סוכות
  { name: 'Sukkot 1', nameHe: 'סוכות א׳', date: '2026-09-26', isWorkDay: false, isErev: false },
  { name: 'Sukkot 2', nameHe: 'סוכות ב׳', date: '2026-09-27', isWorkDay: false, isErev: false },
  { name: 'Shmini Atzeret', nameHe: 'שמיני עצרת / שמחת תורה', date: '2026-10-03', isWorkDay: false, isErev: false },
  // חנוכה
  { name: 'Chanukah 1', nameHe: 'חנוכה', date: '2026-12-05', isWorkDay: true, isErev: false },
  // פורים
  { name: 'Purim', nameHe: 'פורים', date: '2027-03-04', isWorkDay: true, isErev: false },
  // פסח
  { name: 'Pesach 1', nameHe: 'פסח א׳', date: '2027-03-22', isWorkDay: false, isErev: false },
  { name: 'Pesach 7', nameHe: 'שביעי של פסח', date: '2027-03-28', isWorkDay: false, isErev: false },
  // יום הזיכרון + יום העצמאות
  { name: 'Yom HaZikaron', nameHe: 'יום הזיכרון', date: '2027-04-13', isWorkDay: false, isErev: false },
  { name: 'Yom HaAtzmaut', nameHe: 'יום העצמאות', date: '2027-04-14', isWorkDay: false, isErev: false },
  // שבועות
  { name: 'Shavuot', nameHe: 'שבועות', date: '2027-05-12', isWorkDay: false, isErev: false },
]

// ── Public API ──────────────────────────────────────

/** Get holiday for a specific date */
export function getHoliday(date: string): HebrewHoliday | null {
  return HOLIDAYS_5786_5787.find(h => h.date === date) || null
}

/** Check if a date is a non-working holiday */
export function isHolidayNoWork(date: string): boolean {
  const holiday = getHoliday(date)
  return holiday !== null && !holiday.isWorkDay
}

/** Check if a date is erev chag (might close early) */
export function isErevChag(date: string): boolean {
  const holiday = getHoliday(date)
  return holiday !== null && holiday.isErev
}

/** Get all holidays */
export function getAllHolidays(): HebrewHoliday[] {
  return HOLIDAYS_5786_5787
}

/** Get unique holiday groups (for settings UI) */
export function getHolidayGroups(): { name: string; nameHe: string; dates: string[]; isWorkDay: boolean }[] {
  const groups: Record<string, { name: string; nameHe: string; dates: string[]; isWorkDay: boolean }> = {}
  for (const h of HOLIDAYS_5786_5787) {
    // Group by base name (remove numbers)
    const baseName = h.name.replace(/\s*\d+$/, '').replace('Erev ', '')
    if (!groups[baseName]) {
      groups[baseName] = { name: baseName, nameHe: h.nameHe.replace(/\s*[אב]׳$/, ''), dates: [], isWorkDay: h.isWorkDay }
    }
    groups[baseName].dates.push(h.date)
  }
  // Deduplicate
  const seen = new Set<string>()
  return Object.values(groups).filter(g => {
    if (seen.has(g.nameHe)) return false
    seen.add(g.nameHe)
    return true
  })
}

/** Get all holidays for a specific month */
export function getHolidaysForMonth(year: number, month: number): HebrewHoliday[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return HOLIDAYS_5786_5787.filter(h => h.date.startsWith(prefix))
}

/** Get holiday name in Hebrew for display */
export function getHolidayName(date: string): string | null {
  const holiday = getHoliday(date)
  return holiday ? holiday.nameHe : null
}

// ── Business-aware holiday checks ──────────────────

export interface HolidaysConfig {
  closed_holidays: string[] // Holiday names that are closed (e.g., "Yom Kippur")
  custom_closed_dates: string[] // Custom closed dates (YYYY-MM-DD)
  erev_close_time?: string // Early closing time on erev (e.g., "14:00")
}

const DEFAULT_CLOSED = [
  'Rosh Hashana', 'Yom Kippur', 'Erev Yom Kippur',
  'Sukkot', 'Shmini Atzeret',
  'Pesach', 'Erev Pesach',
  'Shavuot', 'Erev Shavuot',
  'Yom HaZikaron', 'Yom HaAtzmaut',
  'Tisha BAv',
]

/** Check if date is closed for this business */
export function isClosedForBusiness(date: string, config?: HolidaysConfig | null): boolean {
  const holiday = getHoliday(date)
  if (!holiday) {
    // Check custom closed dates
    return config?.custom_closed_dates?.includes(date) || false
  }

  const closedList = config?.closed_holidays || DEFAULT_CLOSED
  // Check if any closed holiday name matches (partial match)
  return closedList.some(closed =>
    holiday.name.includes(closed) || closed.includes(holiday.name)
  )
}

/** Get erev closing time */
export function getErevCloseTime(date: string, config?: HolidaysConfig | null): string | null {
  if (!isErevChag(date)) return null
  return config?.erev_close_time || '14:00'
}

/** Build a string for the AI prompt listing upcoming holidays */
export function getUpcomingHolidaysForPrompt(fromDate: string, days: number = 14, config?: HolidaysConfig | null): string {
  const from = new Date(fromDate + 'T00:00:00')
  const to = new Date(from)
  to.setDate(to.getDate() + days)
  const toStr = to.toISOString().split('T')[0]

  const upcoming = HOLIDAYS_5786_5787.filter(h => h.date >= fromDate && h.date <= toStr)
  if (upcoming.length === 0) return ''

  return `\n## חגים קרובים:\n` +
    upcoming.map(h => {
      const closed = isClosedForBusiness(h.date, config)
      return `- ${h.date}: ${h.nameHe}${closed ? ' — סגור!' : h.isErev ? ' — ערב חג, סגירה מוקדמת' : ' — פתוח'}`
    }).join('\n')
}
